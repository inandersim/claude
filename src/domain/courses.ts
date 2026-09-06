import type { IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/core/i18n';

import {
  COURSE_LEVELS,
  type AdventureType,
  type CourseCategory,
  type CourseLevel,
  type Plan,
} from './enums';
import type {
  Certificate,
  Course,
  CourseFilter,
  CourseSession,
  Enrollment,
  ID,
  ISODate,
  Lesson,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Quiz geçme notu (yüzde). */
export const QUIZ_PASS_SCORE = 70;

/** Seviye sıralaması — bir sonraki seviyeyi bulmak için. */
export const levelOrder: Record<CourseLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  professional: 3,
};

export interface CategoryMeta {
  labelKey: TranslationKey;
  icon: IconName;
  color: string;
}

/** Kategori ikon/renk/etiket eşlemesi. */
export const CATEGORY_META: Record<CourseCategory, CategoryMeta> = {
  mountaineering: {
    labelKey: 'courses.category.mountaineering',
    icon: 'mountain-snow',
    color: '#5EE39B',
  },
  climbing: { labelKey: 'courses.category.climbing', icon: 'mountain', color: '#F97316' },
  avalanche: { labelKey: 'courses.category.avalanche', icon: 'snowflake', color: '#6CB4FF' },
  first_aid: { labelKey: 'courses.category.first_aid', icon: 'heart-pulse', color: '#FF6B6B' },
  navigation: { labelKey: 'courses.category.navigation', icon: 'compass', color: '#A78BFA' },
  diving: { labelKey: 'courses.category.diving', icon: 'droplets', color: '#38BDF8' },
  paragliding: { labelKey: 'courses.category.paragliding', icon: 'wind', color: '#FFB547' },
  paddling: { labelKey: 'courses.category.paddling', icon: 'ship', color: '#2DD4BF' },
  winter: { labelKey: 'courses.category.winter', icon: 'tent', color: '#93C5FD' },
  drone: { labelKey: 'courses.category.drone', icon: 'radar', color: '#C084FC' },
  ethics: { labelKey: 'courses.category.ethics', icon: 'tree-pine', color: '#4ADE80' },
  photography: { labelKey: 'courses.category.photography', icon: 'camera', color: '#FB7185' },
};

/** Ders türü ikonları. */
export const LESSON_TYPE_ICON: Record<Lesson['type'], IconName> = {
  video: 'circle-play',
  reading: 'book-open',
  quiz: 'list-checks',
  practical: 'target',
};

/** Format ikonları. */
export const FORMAT_ICON: Record<Course['format'], IconName> = {
  online: 'wifi',
  in_person: 'map-pin',
  hybrid: 'layers',
};

/* ------------------------------------------------------------------ */
/* Filtreleme                                                          */
/* ------------------------------------------------------------------ */

const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Çığ" ve "cig" eşleşir. */
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .trim()
    .split('')
    .map((ch) => FOLD[ch] ?? ch)
    .join('');

/** Katalog filtresi: serbest metin + kategori/format/seviye/macera türü. */
export function filterCourses<T extends Course>(list: T[], filter: CourseFilter): T[] {
  const q = filter.query ? normalize(filter.query) : '';
  return list.filter((c) => {
    if (filter.category && c.category !== filter.category) return false;
    if (filter.format && c.format !== filter.format) return false;
    if (filter.level && c.level !== filter.level) return false;
    if (filter.adventureType && !c.adventureTypes.includes(filter.adventureType)) return false;
    if (q) {
      const hay = normalize(
        [c.title, c.summary, c.provider, c.certificateName ?? '', ...c.outcomes].join(' '),
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* İlerleme                                                            */
/* ------------------------------------------------------------------ */

/**
 * İlerlemeye sayılan dersler. Uygulamalı (practical) dersler yalnızca bir
 * oturuma kayıtlıysa sayılır; salt online kayıtta otomatik tamamlanamaz.
 */
export function countableLessons(enrollment: Pick<Enrollment, 'sessionId'>, lessons: Lesson[]) {
  const inPerson = enrollment.sessionId !== null;
  return lessons
    .filter((l) => inPerson || l.type !== 'practical')
    .sort((a, b) => a.order - b.order);
}

/** 0..1 arası ilerleme. Ders yoksa 0. */
export function progressOf(
  enrollment: Pick<Enrollment, 'sessionId' | 'completedLessonIds'>,
  lessons: Lesson[],
): number {
  const countable = countableLessons(enrollment, lessons);
  if (countable.length === 0) return 0;
  const done = new Set(enrollment.completedLessonIds);
  const completed = countable.filter((l) => done.has(l.id)).length;
  return Math.min(1, Math.round((completed / countable.length) * 1000) / 1000);
}

/** Sırada tamamlanmamış ilk ders; hepsi bittiyse null. */
export function nextLesson(
  enrollment: Pick<Enrollment, 'sessionId' | 'completedLessonIds'>,
  lessons: Lesson[],
): Lesson | null {
  const done = new Set(enrollment.completedLessonIds);
  return countableLessons(enrollment, lessons).find((l) => !done.has(l.id)) ?? null;
}

/** Önizleme dersleri herkese, diğerleri yalnızca kayıtlılara açık. */
export function canAccessLesson(
  lesson: Pick<Lesson, 'preview'>,
  enrollment: Pick<Enrollment, 'status'> | null | undefined,
): boolean {
  if (lesson.preview) return true;
  if (!enrollment) return false;
  return enrollment.status === 'active' || enrollment.status === 'completed';
}

/** Dersleri modül başlığına göre sıralı gruplar. */
export function moduleGroups(lessons: Lesson[]): { title: string; lessons: Lesson[] }[] {
  const groups: { title: string; lessons: Lesson[] }[] = [];
  for (const lesson of [...lessons].sort((a, b) => a.order - b.order)) {
    const last = groups[groups.length - 1];
    if (last && last.title === lesson.moduleTitle) last.lessons.push(lesson);
    else groups.push({ title: lesson.moduleTitle, lessons: [lesson] });
  }
  return groups;
}

/** Derslerin toplam süresi (dakika). */
export function totalLessonMinutes(lessons: Pick<Lesson, 'durationMin'>[]): number {
  return lessons.reduce((sum, l) => sum + l.durationMin, 0);
}

/* ------------------------------------------------------------------ */
/* Sertifika                                                           */
/* ------------------------------------------------------------------ */

/** Süresiz sertifika her zaman geçerli; diğerleri bitiş tarihinden önce. */
export function isCertificateValid(
  cert: Pick<Certificate, 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  if (!cert.expiresAt) return true;
  return new Date(cert.expiresAt).getTime() > now;
}

/** Sertifika bitiş tarihi; validityMonths null ise süresiz. */
export function certificateExpiry(
  issuedAt: ISODate,
  validityMonths: number | null,
): ISODate | null {
  if (validityMonths === null) return null;
  const d = new Date(issuedAt);
  d.setUTCMonth(d.getUTCMonth() + validityMonths);
  return d.toISOString();
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** FNV-1a 32-bit — bağımlılıksız deterministik hash. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function encodeBlock(n: number): string {
  let out = '';
  let v = n;
  for (let i = 0; i < 4; i++) {
    out = CODE_ALPHABET[v % CODE_ALPHABET.length] + out;
    v = Math.floor(v / CODE_ALPHABET.length);
  }
  return out;
}

/** Deterministik doğrulama kodu: ZRV-XXXX-XXXX. Aynı girdi → aynı kod. */
export function certificateCode(userId: ID, courseId: ID, issuedAt: ISODate): string {
  const a = fnv1a(`${userId}|${courseId}|${issuedAt}`);
  const b = fnv1a(`${issuedAt}|${courseId}|${userId}|zirve`);
  return `ZRV-${encodeBlock(a)}-${encodeBlock(b)}`;
}

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

export interface LessonQuizResult {
  correct: number;
  total: number;
  /** 0..100 */
  score: number;
  passed: boolean;
  /** Yanlış cevaplanan soru indeksleri */
  wrongIndexes: number[];
}

/** Cevap dizisini (soru sırasına göre seçilen seçenek indeksleri) notlar. */
export function gradeQuiz(
  lesson: Pick<Lesson, 'quiz'>,
  answers: (number | null)[],
): LessonQuizResult {
  const questions = lesson.quiz ?? [];
  const wrongIndexes: number[] = [];
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) correct += 1;
    else wrongIndexes.push(i);
  });
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, score, passed: total > 0 && score >= QUIZ_PASS_SCORE, wrongIndexes };
}

/* ------------------------------------------------------------------ */
/* Biçimleme                                                           */
/* ------------------------------------------------------------------ */

/** "40 saat" / "40 h"; 1 saatten kısaysa dakika. */
export function courseDurationLabel(hours: number, locale = 'tr'): string {
  if (hours < 1) {
    const min = Math.round(hours * 60);
    return locale === 'tr' ? `${min} dk` : `${min} min`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return locale === 'tr' ? `${rounded} saat` : `${rounded} h`;
}

/* ------------------------------------------------------------------ */
/* Oturumlar                                                           */
/* ------------------------------------------------------------------ */

export type SessionAvailability = 'open' | 'few' | 'full' | 'past';

/** Oturum durumu: geçmiş, dolu, az kontenjan (≤3) ya da açık. */
export function sessionAvailability(
  session: Pick<CourseSession, 'startsAt' | 'seatsLeft'>,
  now: number = Date.now(),
): SessionAvailability {
  if (new Date(session.startsAt).getTime() < now) return 'past';
  if (session.seatsLeft <= 0) return 'full';
  if (session.seatsLeft <= 3) return 'few';
  return 'open';
}

/** Gelecekteki, kontenjanı olan en yakın oturum; yoksa gelecekteki ilk oturum. */
export function upcomingSession(sessions: CourseSession[], now: number = Date.now()) {
  const future = sessions
    .filter((s) => new Date(s.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return future.find((s) => s.seatsLeft > 0) ?? future[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Öneriler                                                            */
/* ------------------------------------------------------------------ */

export interface RecommendationUser {
  favoriteTypes: AdventureType[];
  plan: Plan;
  enrollments: Pick<Enrollment, 'courseId' | 'status'>[];
}

/** Bir seviye üstü (professional'ın üstü yok). */
export function nextLevel(level: CourseLevel): CourseLevel | null {
  return COURSE_LEVELS[levelOrder[level] + 1] ?? null;
}

/**
 * Kişiye özel öneri: kayıtlı olmadığı kurslar arasında, tamamladığı kursların
 * bir üst seviyesi (aynı kategori) önce; sonra favori macera türleriyle örtüşenler;
 * eşitlikte puan ve kayıt sayısı belirler.
 */
export function recommendCourses<T extends Course>(
  courses: T[],
  user: RecommendationUser,
  limit = 6,
): T[] {
  const enrolledIds = new Set(user.enrollments.map((e) => e.courseId));
  const completed = user.enrollments
    .filter((e) => e.status === 'completed')
    .map((e) => courses.find((c) => c.id === e.courseId))
    .filter((c): c is T => Boolean(c));
  const wantedNext = new Set(
    completed
      .map((c) => {
        const next = nextLevel(c.level);
        return next ? `${c.category}:${next}` : null;
      })
      .filter((k): k is string => Boolean(k)),
  );
  const completedCategories = new Set(completed.map((c) => c.category));
  const favorites = new Set(user.favoriteTypes);

  const scored = courses
    .filter((c) => !enrolledIds.has(c.id))
    .map((c) => {
      let score = 0;
      if (wantedNext.has(`${c.category}:${c.level}`)) score += 10;
      else if (completedCategories.has(c.category) && c.level !== 'beginner') score += 3;
      const overlap = c.adventureTypes.filter((a) => favorites.has(a)).length;
      score += overlap * 3;
      if (c.level === 'beginner' && completed.length === 0) score += 2;
      if (c.priceTry === 0 && user.plan === 'free') score += 1;
      // Ön koşulu olan ileri kurslar, hiç geçmişi olmayan kullanıcıya önerilmez
      if (c.prerequisites.length > 0 && completed.length === 0 && c.level !== 'beginner')
        score -= 10;
      score += c.rating;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.c.enrolledCount - a.c.enrolledCount);

  return scored.slice(0, limit).map((s) => s.c);
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

/** URL dostu slug (Türkçe karakterler sadeleştirilir). */
export function slugify(title: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    Ç: 'c',
    Ğ: 'g',
    İ: 'i',
    Ö: 'o',
    Ş: 's',
    Ü: 'u',
  };
  return title
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
