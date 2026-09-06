import { generateId } from '@/core/utils/format';
import type { CourseRepository } from '@/data/repositories';
import {
  canAcceptPaidBookings,
  certificateCode,
  certificateExpiry,
  filterCourses,
  progressOf,
  slugify,
  upcomingSession,
  type Certificate,
  type Course,
  type CourseWithInstructor,
  type Enrollment,
  type ID,
  type Lesson,
  type User,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/**
 * courses modülü mock repository fabrikası.
 *
 * - Ücretli kursa kayıt demo ödeme sayılır; oturum seçildiyse kontenjan düşer.
 * - Ders tamamlanınca ilerleme yeniden hesaplanır; %100'de kayıt `completed`
 *   olur ve kursun sertifikası varsa deterministik kodla sertifika üretilir.
 * - Yorum yalnızca kayıtlı kullanıcıdan kabul edilir.
 * - Kurs oluşturma Pro Guide/Business planı ve eğitmen profili ister.
 */
export function createCourseRepository(ctx: MockContext): CourseRepository {
  const { db, wait, requireUser, pushNotification } = ctx;

  const findCourse = (t: Tables, id: ID): Course => {
    const course = t.courses.find((c) => c.id === id);
    if (!course) throw new Error(`Kurs bulunamadı: ${id}`);
    return course;
  };

  const instructorUser = (t: Tables, course: Course): User | null => {
    if (!course.instructorId) return null;
    const instructor = t.instructors.find((i) => i.id === course.instructorId);
    if (!instructor) return null;
    return t.users.find((u) => u.id === instructor.userId) ?? null;
  };

  const enrollmentOf = (t: Tables, courseId: ID, meId: ID): Enrollment | null =>
    t.enrollments.find((e) => e.courseId === courseId && e.userId === meId) ?? null;

  const decorate = (t: Tables, course: Course, meId: ID): CourseWithInstructor => ({
    ...course,
    instructor: instructorUser(t, course),
    enrollment: enrollmentOf(t, course.id, meId),
    nextSession: upcomingSession(
      t.courseSessions.filter((s) => s.courseId === course.id),
      Date.now(),
    ),
  });

  const lessonsOf = (t: Tables, courseId: ID): Lesson[] =>
    t.lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);

  const issueCertificate = (t: Tables, course: Course, user: User, issuedAt: string) => {
    const existing = t.certificates.find((c) => c.courseId === course.id && c.userId === user.id);
    if (existing) return existing;
    const cert: Certificate = {
      id: generateId('cert'),
      userId: user.id,
      courseId: course.id,
      code: certificateCode(user.id, course.id, issuedAt),
      issuedAt,
      expiresAt: certificateExpiry(issuedAt, course.validityMonths),
      holderName: user.displayName,
    };
    t.certificates.push(cert);
    return cert;
  };

  return {
    async list(meId, filter) {
      await wait();
      const t = await db.load();
      const sorted = [...t.courses].sort(
        (a, b) => b.enrolledCount - a.enrolledCount || b.rating - a.rating,
      );
      return filterCourses(sorted, filter).map((c) => decorate(t, c, meId));
    },

    async getById(meId, id) {
      await wait();
      const t = await db.load();
      const course = t.courses.find((c) => c.id === id);
      return course ? decorate(t, course, meId) : null;
    },

    async lessons(courseId) {
      await wait();
      const t = await db.load();
      return lessonsOf(t, courseId);
    },

    async lessonById(id) {
      await wait();
      const t = await db.load();
      return t.lessons.find((l) => l.id === id) ?? null;
    },

    async sessions(courseId) {
      await wait();
      const t = await db.load();
      return t.courseSessions
        .filter((s) => s.courseId === courseId)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    },

    async enroll(meId, courseId, sessionId = null) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const course = findCourse(t, courseId);
      const existing = enrollmentOf(t, courseId, meId);
      if (existing && existing.status !== 'expired') throw new Error('Bu kursa zaten kayıtlısın.');

      if (course.format === 'in_person' && !sessionId) {
        throw new Error('Yüz yüze kurs için bir oturum seçmelisin.');
      }
      let sessionPrice = 0;
      if (sessionId) {
        const session = t.courseSessions.find((s) => s.id === sessionId && s.courseId === courseId);
        if (!session) throw new Error('Oturum bulunamadı.');
        if (new Date(session.startsAt).getTime() < Date.now()) {
          throw new Error('Bu oturumun tarihi geçmiş.');
        }
        if (session.seatsLeft <= 0) throw new Error('Bu oturumun kontenjanı dolu.');
        session.seatsLeft -= 1;
        sessionPrice = session.priceTry;
      }
      // Demo ödeme: ücretli kursta ödeme başarılı sayılır.
      void (course.priceTry + sessionPrice);

      const enrollment: Enrollment = {
        id: generateId('enr'),
        courseId,
        userId: meId,
        sessionId,
        status: 'active',
        completedLessonIds: [],
        progress: 0,
        quizScores: {},
        enrolledAt: new Date().toISOString(),
        completedAt: null,
      };
      if (existing) {
        const idx = t.enrollments.indexOf(existing);
        t.enrollments.splice(idx, 1, enrollment);
      } else {
        t.enrollments.push(enrollment);
      }
      course.enrolledCount += 1;

      const instructor = instructorUser(t, course);
      if (instructor) {
        await pushNotification({
          type: 'course_enrolled',
          senderId: meId,
          receiverId: instructor.id,
          message: `${me.displayName}, "${course.title}" kursuna kaydoldu.`,
          postId: null,
          matchId: null,
          targetId: courseId,
        });
      }
      db.markDirty();
      return enrollment;
    },

    async completeLesson(meId, courseId, lessonId, quizScore = null) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const course = findCourse(t, courseId);
      const enrollment = enrollmentOf(t, courseId, meId);
      if (!enrollment || enrollment.status === 'expired') {
        throw new Error('Bu kursa kayıtlı değilsin.');
      }
      const lessons = lessonsOf(t, courseId);
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new Error('Ders bulunamadı.');
      if (lesson.type === 'practical' && !enrollment.sessionId) {
        throw new Error('Uygulamalı dersler yalnızca oturuma kayıtlıysan tamamlanabilir.');
      }

      if (!enrollment.completedLessonIds.includes(lessonId)) {
        enrollment.completedLessonIds.push(lessonId);
      }
      if (quizScore !== null && quizScore !== undefined) {
        enrollment.quizScores[lessonId] = quizScore;
      }
      enrollment.progress = progressOf(enrollment, lessons);

      if (enrollment.progress >= 1 && enrollment.status !== 'completed') {
        const nowIso = new Date().toISOString();
        enrollment.status = 'completed';
        enrollment.completedAt = nowIso;
        if (course.certificateName) {
          issueCertificate(t, course, me, nowIso);
          const instructor = instructorUser(t, course);
          if (instructor) {
            await pushNotification({
              type: 'certificate_issued',
              senderId: instructor.id,
              receiverId: meId,
              message: `"${course.certificateName}" sertifikan hazır.`,
              postId: null,
              matchId: null,
              targetId: courseId,
            });
          }
        }
      }
      db.markDirty();
      return enrollment;
    },

    async myCourses(meId) {
      await wait();
      const t = await db.load();
      return t.enrollments
        .filter((e) => e.userId === meId)
        .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime())
        .map((e) => t.courses.find((c) => c.id === e.courseId))
        .filter((c): c is Course => Boolean(c))
        .map((c) => decorate(t, c, meId));
    },

    async certificates(meId) {
      await wait();
      const t = await db.load();
      return t.certificates
        .filter((c) => c.userId === meId)
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
        .map((c) => ({ ...c, course: findCourse(t, c.courseId) }));
    },

    async reviews(courseId) {
      await wait();
      const t = await db.load();
      return t.courseReviews
        .filter((r) => r.courseId === courseId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((r) => ({ ...r, author: requireUser(t.users, r.authorId) }));
    },

    async review(meId, courseId, rating, text) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const course = findCourse(t, courseId);
      const enrollment = enrollmentOf(t, courseId, meId);
      if (!enrollment) throw new Error('Yorum yazmak için kursa kayıtlı olmalısın.');
      const clean = text.trim();
      if (clean.length < 10) throw new Error('Yorum en az 10 karakter olmalı.');
      const safeRating = Math.min(5, Math.max(1, Math.round(rating)));
      if (t.courseReviews.some((r) => r.courseId === courseId && r.authorId === meId)) {
        throw new Error('Bu kursu zaten değerlendirdin.');
      }
      const review = {
        id: generateId('crv'),
        courseId,
        authorId: meId,
        rating: safeRating,
        text: clean,
        createdAt: new Date().toISOString(),
      };
      t.courseReviews.unshift(review);
      const total = course.rating * course.reviewCount + safeRating;
      course.reviewCount += 1;
      course.rating = Math.round((total / course.reviewCount) * 100) / 100;
      db.markDirty();
      return review;
    },

    async createCourse(meId, input, lessons) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      if (!canAcceptPaidBookings(me.plan)) {
        throw new Error('Kurs oluşturmak için Pro Guide ya da Business planı gerekir.');
      }
      const instructor = t.instructors.find((i) => i.userId === meId);
      if (!instructor) throw new Error('Önce eğitmen profili oluşturmalısın.');
      if (input.title.trim().length < 5) throw new Error('Kurs başlığı en az 5 karakter olmalı.');
      if (input.priceTry < 0) throw new Error('Fiyat negatif olamaz.');

      const id = generateId('crs');
      const course: Course = {
        ...input,
        id,
        slug: `${slugify(input.title)}-${id.slice(-4)}`,
        instructorId: instructor.id,
        lessonCount: lessons.length,
        rating: 0,
        reviewCount: 0,
        enrolledCount: 0,
        createdAt: new Date().toISOString(),
      };
      t.courses.unshift(course);
      lessons.forEach((l, i) => {
        t.lessons.push({ ...l, id: `${id}_l${i + 1}`, courseId: id, order: i + 1 });
      });
      db.markDirty();
      return decorate(t, course, meId);
    },
  };
}
