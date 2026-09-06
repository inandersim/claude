import {
  canAccessLesson,
  certificateCode,
  certificateExpiry,
  courseDurationLabel,
  filterCourses,
  gradeQuiz,
  isCertificateValid,
  moduleGroups,
  nextLesson,
  nextLevel,
  progressOf,
  recommendCourses,
  sessionAvailability,
  slugify,
  upcomingSession,
  type Course,
  type Enrollment,
  type Lesson,
} from '@/domain';

const lesson = (id: string, order: number, type: Lesson['type'], preview = false): Lesson => ({
  id,
  courseId: 'c1',
  moduleTitle: order <= 2 ? 'Modül 1' : 'Modül 2',
  order,
  title: id,
  type,
  durationMin: 10,
  videoUrl: null,
  body: '',
  quiz:
    type === 'quiz'
      ? [
          { question: 'q1', options: ['a', 'b'], answerIndex: 1 },
          { question: 'q2', options: ['a', 'b'], answerIndex: 0 },
          { question: 'q3', options: ['a', 'b'], answerIndex: 1 },
        ]
      : null,
  preview,
});

const lessons: Lesson[] = [
  lesson('l1', 1, 'video', true),
  lesson('l2', 2, 'reading'),
  lesson('l3', 3, 'quiz'),
  lesson('l4', 4, 'practical'),
];

const enrollment = (partial: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1',
  courseId: 'c1',
  userId: 'u_me',
  sessionId: null,
  status: 'active',
  completedLessonIds: [],
  progress: 0,
  quizScores: {},
  enrolledAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  ...partial,
});

const course = (partial: Partial<Course>): Course => ({
  id: 'c',
  slug: 'c',
  title: 'Kurs',
  category: 'climbing',
  level: 'beginner',
  format: 'online',
  summary: '',
  description: '',
  imageUrl: null,
  instructorId: null,
  provider: 'Zirtan',
  certificateName: null,
  validityMonths: null,
  priceTry: 0,
  durationHours: 4,
  lessonCount: 0,
  rating: 4.5,
  reviewCount: 10,
  enrolledCount: 100,
  languages: ['Türkçe'],
  prerequisites: [],
  outcomes: [],
  adventureTypes: ['climbing'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...partial,
});

describe('progressOf / nextLesson', () => {
  it('online kayıtta practical dersler sayılmaz', () => {
    const e = enrollment({ completedLessonIds: ['l1', 'l2', 'l3'] });
    expect(progressOf(e, lessons)).toBe(1);
    expect(nextLesson(e, lessons)).toBeNull();
  });

  it('oturumlu kayıtta practical dersler sayılır', () => {
    const e = enrollment({ sessionId: 's1', completedLessonIds: ['l1', 'l2', 'l3'] });
    expect(progressOf(e, lessons)).toBe(0.75);
    expect(nextLesson(e, lessons)?.id).toBe('l4');
  });

  it('sıradaki tamamlanmamış dersi döner; ders yoksa 0', () => {
    expect(nextLesson(enrollment({ completedLessonIds: ['l1'] }), lessons)?.id).toBe('l2');
    expect(progressOf(enrollment(), [])).toBe(0);
  });
});

describe('canAccessLesson', () => {
  it('önizleme herkese, diğerleri kayıtlılara açık', () => {
    expect(canAccessLesson(lessons[0]!, null)).toBe(true);
    expect(canAccessLesson(lessons[1]!, null)).toBe(false);
    expect(canAccessLesson(lessons[1]!, enrollment())).toBe(true);
    expect(canAccessLesson(lessons[1]!, enrollment({ status: 'completed' }))).toBe(true);
    expect(canAccessLesson(lessons[1]!, enrollment({ status: 'expired' }))).toBe(false);
  });
});

describe('moduleGroups', () => {
  it('sıralı modül grupları üretir', () => {
    const groups = moduleGroups([...lessons].reverse());
    expect(groups.map((g) => g.title)).toEqual(['Modül 1', 'Modül 2']);
    expect(groups[0]?.lessons.map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

describe('certificateCode', () => {
  it('deterministik ve biçimli', () => {
    const a = certificateCode('u_me', 'crs_wfa', '2026-03-01T10:00:00.000Z');
    const b = certificateCode('u_me', 'crs_wfa', '2026-03-01T10:00:00.000Z');
    expect(a).toBe(b);
    expect(a).toMatch(/^ZRV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('farklı girdiler farklı kod verir', () => {
    const a = certificateCode('u_me', 'crs_wfa', '2026-03-01T10:00:00.000Z');
    const c = certificateCode('u_elif', 'crs_wfa', '2026-03-01T10:00:00.000Z');
    const d = certificateCode('u_me', 'crs_avy1', '2026-03-01T10:00:00.000Z');
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });
});

describe('isCertificateValid / certificateExpiry', () => {
  const now = new Date('2026-09-06T00:00:00.000Z').getTime();
  it('süresiz her zaman geçerli', () => {
    expect(isCertificateValid({ expiresAt: null }, now)).toBe(true);
  });
  it('bitiş tarihine göre', () => {
    expect(isCertificateValid({ expiresAt: '2027-01-01T00:00:00.000Z' }, now)).toBe(true);
    expect(isCertificateValid({ expiresAt: '2026-01-01T00:00:00.000Z' }, now)).toBe(false);
  });
  it('ay ekler', () => {
    expect(certificateExpiry('2026-01-15T00:00:00.000Z', 24)).toBe('2028-01-15T00:00:00.000Z');
    expect(certificateExpiry('2026-01-15T00:00:00.000Z', null)).toBeNull();
  });
});

describe('gradeQuiz', () => {
  const quizLesson = lessons[2]!;
  it('doğru sayar ve %70 eşiğini uygular', () => {
    const pass = gradeQuiz(quizLesson, [1, 0, 1]);
    expect(pass).toMatchObject({
      correct: 3,
      total: 3,
      score: 100,
      passed: true,
      wrongIndexes: [],
    });
    const fail = gradeQuiz(quizLesson, [0, 0, 0]);
    expect(fail.correct).toBe(1);
    expect(fail.score).toBe(33);
    expect(fail.passed).toBe(false);
    expect(fail.wrongIndexes).toEqual([0, 2]);
  });
  it('eksik cevap yanlış sayılır; quiz yoksa geçilmez', () => {
    expect(gradeQuiz(quizLesson, [1]).correct).toBe(1);
    expect(gradeQuiz({ quiz: null }, []).passed).toBe(false);
  });
});

describe('filterCourses', () => {
  const list = [
    course({
      id: 'a',
      title: 'Çığ Güvenliği 1',
      category: 'avalanche',
      format: 'hybrid',
      adventureTypes: ['skiing'],
    }),
    course({
      id: 'b',
      title: 'PADI Open Water',
      category: 'diving',
      format: 'hybrid',
      level: 'beginner',
      adventureTypes: ['diving'],
    }),
    course({
      id: 'c',
      title: 'Kaya 2',
      category: 'climbing',
      format: 'in_person',
      level: 'intermediate',
    }),
  ];
  it('kategori, format, seviye ve macera türü', () => {
    expect(filterCourses(list, { category: 'diving' }).map((c) => c.id)).toEqual(['b']);
    expect(filterCourses(list, { format: 'hybrid' }).map((c) => c.id)).toEqual(['a', 'b']);
    expect(filterCourses(list, { level: 'intermediate' }).map((c) => c.id)).toEqual(['c']);
    expect(filterCourses(list, { adventureType: 'skiing' }).map((c) => c.id)).toEqual(['a']);
  });
  it('metin araması Türkçe duyarsız', () => {
    expect(filterCourses(list, { query: 'çığ' }).map((c) => c.id)).toEqual(['a']);
    expect(filterCourses(list, { query: 'padi' }).map((c) => c.id)).toEqual(['b']);
    expect(filterCourses(list, { query: 'yok böyle' })).toEqual([]);
  });
});

describe('recommendCourses', () => {
  const catalog = [
    course({ id: 'avy1', category: 'avalanche', level: 'beginner', adventureTypes: ['skiing'] }),
    course({
      id: 'avy2',
      category: 'avalanche',
      level: 'advanced',
      adventureTypes: ['skiing'],
      prerequisites: ['Çığ 1'],
    }),
    course({
      id: 'avy_mid',
      category: 'avalanche',
      level: 'intermediate',
      adventureTypes: ['skiing'],
    }),
    course({ id: 'dive', category: 'diving', level: 'beginner', adventureTypes: ['diving'] }),
    course({
      id: 'climb',
      category: 'climbing',
      level: 'beginner',
      adventureTypes: ['climbing'],
      rating: 4.9,
    }),
  ];
  it('kayıtlı kurslar hariç; tamamlananın bir üst seviyesi önce', () => {
    const recs = recommendCourses(catalog, {
      favoriteTypes: ['diving'],
      plan: 'free',
      enrollments: [{ courseId: 'avy1', status: 'completed' }],
    });
    expect(recs.map((c) => c.id)).not.toContain('avy1');
    expect(recs[0]?.id).toBe('avy_mid');
  });
  it('geçmişi olmayan kullanıcıya favori türler ve başlangıç kursları', () => {
    const recs = recommendCourses(catalog, {
      favoriteTypes: ['climbing'],
      plan: 'pro',
      enrollments: [],
    });
    expect(recs[0]?.id).toBe('climb');
    expect(recs.map((c) => c.id)).not.toContain('avy2');
  });
  it('limit uygular', () => {
    expect(
      recommendCourses(catalog, { favoriteTypes: [], plan: 'free', enrollments: [] }, 2),
    ).toHaveLength(2);
  });
});

describe('sessionAvailability / upcomingSession', () => {
  const now = new Date('2026-09-06T00:00:00.000Z').getTime();
  const s = (id: string, startsAt: string, seatsLeft: number) => ({
    id,
    courseId: 'c',
    startsAt,
    endsAt: startsAt,
    locationName: '',
    coords: null,
    seats: 10,
    seatsLeft,
    priceTry: 0,
  });
  it('durumlar', () => {
    expect(sessionAvailability(s('a', '2026-01-01T00:00:00.000Z', 5), now)).toBe('past');
    expect(sessionAvailability(s('a', '2026-10-01T00:00:00.000Z', 0), now)).toBe('full');
    expect(sessionAvailability(s('a', '2026-10-01T00:00:00.000Z', 2), now)).toBe('few');
    expect(sessionAvailability(s('a', '2026-10-01T00:00:00.000Z', 8), now)).toBe('open');
  });
  it('kontenjanı olan en yakın gelecek oturum', () => {
    const list = [
      s('past', '2026-01-01T00:00:00.000Z', 5),
      s('full', '2026-09-10T00:00:00.000Z', 0),
      s('open', '2026-09-20T00:00:00.000Z', 3),
    ];
    expect(upcomingSession(list, now)?.id).toBe('open');
    expect(upcomingSession([list[0]!], now)).toBeNull();
  });
});

describe('yardımcılar', () => {
  it('courseDurationLabel', () => {
    expect(courseDurationLabel(40, 'tr')).toBe('40 saat');
    expect(courseDurationLabel(1.5, 'en')).toBe('1.5 h');
    expect(courseDurationLabel(0.5, 'tr')).toBe('30 dk');
  });
  it('nextLevel ve slugify', () => {
    expect(nextLevel('beginner')).toBe('intermediate');
    expect(nextLevel('professional')).toBeNull();
    expect(slugify('Çığ Güvenliği 1 – AIARE')).toBe('cig-guvenligi-1-aiare');
  });
});
