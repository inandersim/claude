import {
  canAcceptPaidBookings,
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

import type { CourseRepository } from '../../repositories';
import { PROFILE_SELECT, fetchUsers, notify, requireUser, type RemoteContext } from '../context';
import {
  toCertificate,
  toCourse,
  toCourseReview,
  toCourseSession,
  toEnrollment,
  toLesson,
  toUser,
} from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/**
 * courses modülü uzak repository fabrikası.
 *
 * Sertifika üretimi `issue_certificate_on_completion` tetikleyicisiyle
 * veritabanında yapılır; kod `fill_certificate_code` ile doldurulur.
 */
export function createCourseRepository(ctx: RemoteContext): CourseRepository {
  const { db } = ctx;

  const findCourse = async (id: ID): Promise<Course> => {
    const row = await maybeRow(db.from('courses').select('*').eq('id', id), 'kurs okunamadı');
    if (!row) throw new Error(`Kurs bulunamadı: ${id}`);
    return toCourse(row);
  };

  const lessonsOf = async (courseId: ID): Promise<Lesson[]> => {
    const data = await rows(
      db.from('lessons').select('*').eq('course_id', courseId).order('order', { ascending: true }),
      'dersler okunamadı',
    );
    return data.map(toLesson);
  };

  const enrollmentOf = async (courseId: ID, meId: ID): Promise<Enrollment | null> => {
    const row = await maybeRow(
      db.from('enrollments').select('*').eq('course_id', courseId).eq('user_id', meId),
      'kayıt okunamadı',
    );
    return row ? toEnrollment(row) : null;
  };

  /** Eğitmen kullanıcısı (kurs → eğitmen kaydı → profil). */
  const instructorUsers = async (courses: Course[]): Promise<Map<ID, User>> => {
    const instructorIds = courses
      .map((c) => c.instructorId)
      .filter((id): id is ID => Boolean(id));
    if (!instructorIds.length) return new Map();
    const instructorRows = await rows(
      db.from('instructors').select('id, user_id').in('id', instructorIds),
      'eğitmenler okunamadı',
    );
    const users = await fetchUsers(db, instructorRows.map((row) => String(row.user_id)));
    const out = new Map<ID, User>();
    for (const row of instructorRows) {
      const user = users.get(String(row.user_id));
      if (user) out.set(String(row.id), user);
    }
    return out;
  };

  const decorateMany = async (courses: Course[], meId: ID): Promise<CourseWithInstructor[]> => {
    if (!courses.length) return [];
    const ids = courses.map((c) => c.id);
    const [instructors, enrollmentRows, sessionRows] = await Promise.all([
      instructorUsers(courses),
      rows(
        db.from('enrollments').select('*').eq('user_id', meId).in('course_id', ids),
        'kayıtlar okunamadı',
      ),
      rows(db.from('course_sessions').select('*').in('course_id', ids), 'oturumlar okunamadı'),
    ]);
    const enrollments = new Map(
      enrollmentRows.map((row) => [String(row.course_id), toEnrollment(row)]),
    );
    const sessions = sessionRows.map(toCourseSession);
    const now = Date.now();
    return courses.map((course) => ({
      ...course,
      instructor: course.instructorId ? (instructors.get(course.instructorId) ?? null) : null,
      enrollment: enrollments.get(course.id) ?? null,
      nextSession: upcomingSession(
        sessions.filter((s) => s.courseId === course.id),
        now,
      ),
    }));
  };

  const decorate = async (course: Course, meId: ID): Promise<CourseWithInstructor> => {
    const [result] = await decorateMany([course], meId);
    if (!result) throw new Error(`Kurs bulunamadı: ${course.id}`);
    return result;
  };

  return {
    async list(meId, filter) {
      const data = await rows(db.from('courses').select('*'), 'kurslar okunamadı');
      const sorted = data
        .map(toCourse)
        .sort((a, b) => b.enrolledCount - a.enrolledCount || b.rating - a.rating);
      return await decorateMany(filterCourses(sorted, filter), meId);
    },

    async getById(meId, id) {
      const row = await maybeRow(db.from('courses').select('*').eq('id', id), 'kurs okunamadı');
      return row ? await decorate(toCourse(row), meId) : null;
    },

    async lessons(courseId) {
      return await lessonsOf(courseId);
    },

    async lessonById(id) {
      const row = await maybeRow(db.from('lessons').select('*').eq('id', id), 'ders okunamadı');
      return row ? toLesson(row) : null;
    },

    async sessions(courseId) {
      const data = await rows(
        db
          .from('course_sessions')
          .select('*')
          .eq('course_id', courseId)
          .order('starts_at', { ascending: true }),
        'oturumlar okunamadı',
      );
      return data.map(toCourseSession);
    },

    async enroll(meId, courseId, sessionId = null) {
      const me = await requireUser(db, meId);
      const course = await findCourse(courseId);
      const existing = await enrollmentOf(courseId, meId);
      if (existing && existing.status !== 'expired') throw new Error('Bu kursa zaten kayıtlısın.');

      if (course.format === 'in_person' && !sessionId) {
        throw new Error('Yüz yüze kurs için bir oturum seçmelisin.');
      }
      if (sessionId) {
        const row = await maybeRow(
          db.from('course_sessions').select('*').eq('id', sessionId).eq('course_id', courseId),
          'oturum okunamadı',
        );
        if (!row) throw new Error('Oturum bulunamadı.');
        const session = toCourseSession(row);
        if (new Date(session.startsAt).getTime() < Date.now()) {
          throw new Error('Bu oturumun tarihi geçmiş.');
        }
        if (session.seatsLeft <= 0) throw new Error('Bu oturumun kontenjanı dolu.');
        await rows(
          db.from('course_sessions').update({ seats_left: session.seatsLeft - 1 }).eq('id', sessionId),
          'kontenjan güncellenemedi',
        );
      }
      // Demo ödeme: ücretli kursta ödeme başarılı sayılır.
      if (existing) {
        await rows(db.from('enrollments').delete().eq('id', existing.id), 'eski kayıt silinemedi');
      }
      const created = await oneRow(
        db
          .from('enrollments')
          .insert({
            course_id: courseId,
            user_id: meId,
            session_id: sessionId,
            status: 'active',
            completed_lesson_ids: [],
            progress: 0,
            quiz_scores: {},
          })
          .select('*'),
        'kursa kaydolunamadı',
      );
      const instructors = await instructorUsers([course]);
      const instructor = course.instructorId ? instructors.get(course.instructorId) : null;
      if (instructor) {
        await notify(db, {
          type: 'course_enrolled',
          senderId: meId,
          receiverId: instructor.id,
          message: `${me.displayName}, "${course.title}" kursuna kaydoldu.`,
          postId: null,
          matchId: null,
          targetId: courseId,
        });
      }
      return toEnrollment(created);
    },

    async completeLesson(meId, courseId, lessonId, quizScore = null) {
      await requireUser(db, meId);
      const course = await findCourse(courseId);
      const enrollment = await enrollmentOf(courseId, meId);
      if (!enrollment || enrollment.status === 'expired') {
        throw new Error('Bu kursa kayıtlı değilsin.');
      }
      const lessons = await lessonsOf(courseId);
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new Error('Ders bulunamadı.');
      if (lesson.type === 'practical' && !enrollment.sessionId) {
        throw new Error('Uygulamalı dersler yalnızca oturuma kayıtlıysan tamamlanabilir.');
      }
      const completed = enrollment.completedLessonIds.includes(lessonId)
        ? enrollment.completedLessonIds
        : [...enrollment.completedLessonIds, lessonId];
      const quizScores = { ...enrollment.quizScores };
      if (quizScore !== null && quizScore !== undefined) quizScores[lessonId] = quizScore;
      const progress = progressOf({ ...enrollment, completedLessonIds: completed }, lessons);
      const done = progress >= 1 && enrollment.status !== 'completed';
      const nowIso = new Date().toISOString();

      const updated = await oneRow(
        db
          .from('enrollments')
          .update({
            completed_lesson_ids: completed,
            quiz_scores: quizScores,
            progress,
            status: done ? 'completed' : enrollment.status,
            completed_at: done ? nowIso : enrollment.completedAt,
          })
          .eq('id', enrollment.id)
          .select('*'),
        'ders tamamlanamadı',
      );
      if (done && course.certificateName) {
        // Sertifika `issue_certificate_on_completion` tetikleyicisiyle üretilir.
        const instructors = await instructorUsers([course]);
        const instructor = course.instructorId ? instructors.get(course.instructorId) : null;
        if (instructor) {
          await notify(db, {
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
      return toEnrollment(updated);
    },

    async myCourses(meId) {
      const enrollmentRows = await rows(
        db
          .from('enrollments')
          .select('course_id, enrolled_at')
          .eq('user_id', meId)
          .order('enrolled_at', { ascending: false }),
        'kayıtlar okunamadı',
      );
      const ids = enrollmentRows.map((row) => String(row.course_id));
      if (!ids.length) return [];
      const data = await rows(db.from('courses').select('*').in('id', ids), 'kurslar okunamadı');
      const byId = new Map(data.map((row) => [String(row.id), toCourse(row)]));
      const ordered = ids.map((id) => byId.get(id)).filter((c): c is Course => Boolean(c));
      return await decorateMany(ordered, meId);
    },

    async certificates(meId) {
      const data = await rows(
        db
          .from('certificates')
          .select('*')
          .eq('user_id', meId)
          .order('issued_at', { ascending: false }),
        'sertifikalar okunamadı',
      );
      const certificates = data.map(toCertificate);
      if (!certificates.length) return [];
      const courseRows = await rows(
        db.from('courses').select('*').in('id', certificates.map((c) => c.courseId)),
        'kurslar okunamadı',
      );
      const courses = new Map(courseRows.map((row) => [String(row.id), toCourse(row)]));
      return certificates.flatMap<Certificate & { course: Course }>((c) => {
        const course = courses.get(c.courseId);
        return course ? [{ ...c, course }] : [];
      });
    },

    async reviews(courseId) {
      const data = await rows(
        db
          .from('course_reviews')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('course_id', courseId)
          .order('created_at', { ascending: false }),
        'yorumlar okunamadı',
      );
      return data.map((row) => ({
        ...toCourseReview(row),
        author: toUser((row.author ?? {}) as Row),
      }));
    },

    async review(meId, courseId, rating, text) {
      await requireUser(db, meId);
      await findCourse(courseId);
      const enrollment = await enrollmentOf(courseId, meId);
      if (!enrollment) throw new Error('Yorum yazmak için kursa kayıtlı olmalısın.');
      const clean = text.trim();
      if (clean.length < 10) throw new Error('Yorum en az 10 karakter olmalı.');
      const safeRating = Math.min(5, Math.max(1, Math.round(rating)));
      const existing = await maybeRow(
        db.from('course_reviews').select('id').eq('course_id', courseId).eq('author_id', meId),
        'yorum okunamadı',
      );
      if (existing) throw new Error('Bu kursu zaten değerlendirdin.');
      // `course_reviews_rating` tetikleyicisi kurs puanını günceller.
      const created = await oneRow(
        db
          .from('course_reviews')
          .insert({ course_id: courseId, author_id: meId, rating: safeRating, text: clean })
          .select('*'),
        'yorum yazılamadı',
      );
      return toCourseReview(created);
    },

    async createCourse(meId, input, lessons) {
      const me = await requireUser(db, meId);
      if (!canAcceptPaidBookings(me.plan)) {
        throw new Error('Kurs oluşturmak için Pro Guide ya da Business planı gerekir.');
      }
      const instructor = await maybeRow(
        db.from('instructors').select('id').eq('user_id', meId),
        'eğitmen okunamadı',
      );
      if (!instructor) throw new Error('Önce eğitmen profili oluşturmalısın.');
      if (input.title.trim().length < 5) throw new Error('Kurs başlığı en az 5 karakter olmalı.');
      if (input.priceTry < 0) throw new Error('Fiyat negatif olamaz.');

      const suffix = Math.random().toString(36).slice(2, 6);
      const created = await oneRow(
        db
          .from('courses')
          .insert({
            slug: `${slugify(input.title)}-${suffix}`,
            title: input.title,
            category: input.category,
            level: input.level,
            format: input.format,
            summary: input.summary,
            description: input.description,
            image_url: input.imageUrl,
            instructor_id: String(instructor.id),
            provider: input.provider,
            certificate_name: input.certificateName,
            validity_months: input.validityMonths,
            price_try: input.priceTry,
            duration_hours: input.durationHours,
            languages: input.languages,
            prerequisites: input.prerequisites,
            outcomes: input.outcomes,
            adventure_types: input.adventureTypes,
            is_published: true,
          })
          .select('*'),
        'kurs oluşturulamadı',
      );
      const courseId = String(created.id);
      if (lessons.length) {
        // `sync_lesson_count` tetikleyicisi ders sayısını günceller.
        await rows(
          db.from('lessons').insert(
            lessons.map((l, i) => ({
              course_id: courseId,
              module_title: l.moduleTitle,
              order: i + 1,
              title: l.title,
              type: l.type,
              duration_min: l.durationMin,
              video_url: l.videoUrl,
              body: l.body,
              quiz: l.quiz,
              preview: l.preview,
            })),
          ),
          'dersler eklenemedi',
        );
      }
      return await decorate(await findCourse(courseId), meId);
    },
  };
}
