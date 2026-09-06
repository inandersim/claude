import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('Courses', () => {
  it('katalog, eğitmen, kayıt ve sıradaki oturum', async () => {
    const p = make();
    const all = await p.courses.list(CURRENT_USER_ID, {});
    expect(all.length).toBeGreaterThanOrEqual(24);
    const avy = all.find((c) => c.id === 'crs_avy1');
    expect(avy?.instructor?.id).toBe('u_emre');
    expect(avy?.enrollment?.status).toBe('active');
    expect(avy?.nextSession?.seatsLeft).toBeGreaterThan(0);
    const online = await p.courses.list(CURRENT_USER_ID, { format: 'online' });
    expect(online.every((c) => c.format === 'online')).toBe(true);
    const lessons = await p.courses.lessons('crs_nav');
    expect(lessons.length).toBe(10);
    expect(lessons.filter((l) => l.preview)).toHaveLength(2);
  });

  it('eğitimlerim ve sertifikalar seed ile tutarlı', async () => {
    const p = make();
    const mine = await p.courses.myCourses(CURRENT_USER_ID);
    expect(mine.map((c) => c.id).sort()).toEqual(['crs_avy1', 'crs_rock1', 'crs_wfa']);
    const certs = await p.courses.certificates(CURRENT_USER_ID);
    expect(certs).toHaveLength(1);
    expect(certs[0]?.course.id).toBe('crs_wfa');
    expect(certs[0]?.code).toMatch(/^ZRV-/);
  });

  it('enroll: oturum kontenjanı düşer, eğitmene bildirim gider, tekrar kayıt hata', async () => {
    const p = make();
    const before = await p.courses.sessions('crs_padi_ow');
    const session = before[0]!;
    const seats = session.seatsLeft;
    const enrollment = await p.courses.enroll(CURRENT_USER_ID, 'crs_padi_ow', session.id);
    expect(enrollment.sessionId).toBe(session.id);
    const after = await p.courses.sessions('crs_padi_ow');
    expect(after.find((s) => s.id === session.id)?.seatsLeft).toBe(seats - 1);
    await expect(p.courses.enroll(CURRENT_USER_ID, 'crs_padi_ow', session.id)).rejects.toThrow();
    // Yüz yüze kurs oturumsuz kaydolamaz
    await expect(p.courses.enroll(CURRENT_USER_ID, 'crs_ice')).rejects.toThrow();
    // Eğitmen (u_zeynep) course_enrolled bildirimi alır
    const notifications = await p.notifications.list('u_zeynep');
    expect(
      notifications.some((n) => n.type === 'course_enrolled' && n.senderId === CURRENT_USER_ID),
    ).toBe(true);
  });

  it('completeLesson: ilerleme, %100 → completed + sertifika', async () => {
    const p = make();
    await p.courses.enroll(CURRENT_USER_ID, 'crs_nav');
    const lessons = await p.courses.lessons('crs_nav');
    let last = await p.courses.completeLesson(CURRENT_USER_ID, 'crs_nav', lessons[0]!.id);
    expect(last.progress).toBeCloseTo(0.1, 5);
    for (const l of lessons.slice(1)) {
      last = await p.courses.completeLesson(
        CURRENT_USER_ID,
        'crs_nav',
        l.id,
        l.type === 'quiz' ? 100 : null,
      );
    }
    expect(last.status).toBe('completed');
    expect(last.progress).toBe(1);
    expect(Object.keys(last.quizScores)).toHaveLength(3);
    const certs = await p.courses.certificates(CURRENT_USER_ID);
    const nav = certs.find((c) => c.courseId === 'crs_nav');
    expect(nav).toBeDefined();
    expect(nav?.expiresAt).toBeNull();
    expect(nav?.holderName).toBe('Deniz Kaya');
    // Sertifika bildirimi kullanıcıya (eğitmen u_elif gönderici)
    const notifications = await p.notifications.list(CURRENT_USER_ID);
    expect(notifications.some((n) => n.type === 'certificate_issued')).toBe(true);
  });

  it('completeLesson: online kayıtta practical ders işaretlenemez; kayıtsız hata', async () => {
    const p = make();
    const lessons = await p.courses.lessons('crs_avy1');
    const practical = lessons.find((l) => l.type === 'practical')!;
    await expect(
      p.courses.completeLesson(CURRENT_USER_ID, 'crs_avy1', practical.id),
    ).rejects.toThrow();
    await expect(
      p.courses.completeLesson(CURRENT_USER_ID, 'crs_photo', 'crs_photo_l1'),
    ).rejects.toThrow();
  });

  it('review yalnızca kayıtlı; puan ortalaması güncellenir', async () => {
    const p = make();
    await expect(
      p.courses.review(CURRENT_USER_ID, 'crs_photo', 5, 'Harika bir kurs'),
    ).rejects.toThrow();
    const before = (await p.courses.getById(CURRENT_USER_ID, 'crs_avy1'))!;
    const review = await p.courses.review(CURRENT_USER_ID, 'crs_avy1', 3, 'İyi ama videolar uzun.');
    expect(review.rating).toBe(3);
    const after = (await p.courses.getById(CURRENT_USER_ID, 'crs_avy1'))!;
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    expect(after.rating).toBeLessThan(before.rating);
    const reviews = await p.courses.reviews('crs_avy1');
    expect(reviews[0]?.author.id).toBe(CURRENT_USER_ID);
    await expect(
      p.courses.review(CURRENT_USER_ID, 'crs_avy1', 5, 'İkinci yorum denemesi'),
    ).rejects.toThrow();
  });

  it('createCourse: plan kapısı ve eğitmen profili', async () => {
    const p = make();
    const input = {
      title: 'Deneme Kursu',
      category: 'climbing' as const,
      level: 'beginner' as const,
      format: 'online' as const,
      summary: 'Özet',
      description: 'Açıklama',
      imageUrl: null,
      instructorId: null,
      provider: 'Test',
      certificateName: null,
      validityMonths: null,
      priceTry: 0,
      durationHours: 2,
      languages: ['Türkçe'],
      prerequisites: [],
      outcomes: ['Bir şey'],
      adventureTypes: ['climbing' as const],
    };
    // u_me: pro → engellenir
    await expect(p.courses.createCourse(CURRENT_USER_ID, input, [])).rejects.toThrow(/Pro Guide/);
    // u_can: pro_guide + eğitmen profili → başarılı
    const created = await p.courses.createCourse('u_can', input, [
      {
        moduleTitle: 'Modül 1',
        order: 1,
        title: 'Giriş',
        type: 'video',
        durationMin: 5,
        videoUrl: null,
        body: '',
        quiz: null,
        preview: true,
      },
    ]);
    expect(created.instructorId).toBe('i_can');
    expect(created.instructor?.id).toBe('u_can');
    expect(created.lessonCount).toBe(1);
    const lessons = await p.courses.lessons(created.id);
    expect(lessons[0]?.courseId).toBe(created.id);
  });
});
