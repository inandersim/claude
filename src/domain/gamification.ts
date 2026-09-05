import type { AdventureType, LeaderboardScope, XpSource } from './enums';
import { distanceKm } from './geo';
import type {
  Challenge,
  ChallengeProgress,
  ClubMember,
  Follow,
  GeoPoint,
  ID,
  ISODate,
  LeaderboardEntry,
  LevelInfo,
  LibraryPlace,
  PassportStamp,
  QuizQuestion,
  QuizResult,
  RouletteSuggestion,
  User,
  XpEvent,
} from './types';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** Epoch'tan bu yana geçen gün sayısı (UTC). Seri ve günün sorusu için ortak anahtar. */
export function dayNumber(date: Date | number | string): number {
  const ms = typeof date === 'number' ? date : new Date(date).getTime();
  return Math.floor(ms / DAY_MS);
}

/** `YYYY-MM-DD` biçiminde gün anahtarı (quizAttempts tablosu bunu kullanır). */
export function isoDayKey(date: Date | number | string): string {
  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/** Deterministik PRNG (mulberry32). Aynı tohum → aynı dizi. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = seededRandom(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* XP ve seviye                                                        */
/* ------------------------------------------------------------------ */

/** Kaynağa göre temel XP. quiz/streak/challenge meta ile hesaplanır. */
export const XP_TABLE: Record<XpSource, number> = {
  post: 10,
  route: 25,
  ascent: 30,
  hazard_report: 40,
  challenge: 100,
  quiz: 5,
  event: 50,
  streak: 2,
};

/** Tam puanlı bilgi yarışması bonusu */
export const QUIZ_PERFECT_BONUS = 25;

export interface XpMeta {
  /** quiz: doğru sayısı */
  correct?: number;
  /** quiz: toplam soru (tam puan bonusu için) */
  total?: number;
  /** streak: ardışık gün */
  days?: number;
  /** challenge: görevin ödülü */
  rewardXp?: number;
}

/** Kaynak ve meta bilgisine göre kazanılacak XP. */
export function xpFor(source: XpSource, meta: XpMeta = {}): number {
  switch (source) {
    case 'quiz': {
      const correct = Math.max(0, meta.correct ?? 0);
      const perfect = meta.total !== undefined && meta.total > 0 && correct === meta.total;
      return correct * XP_TABLE.quiz + (perfect ? QUIZ_PERFECT_BONUS : 0);
    }
    case 'streak':
      return Math.max(0, meta.days ?? 0) * XP_TABLE.streak;
    case 'challenge':
      return Math.max(XP_TABLE.challenge, meta.rewardXp ?? XP_TABLE.challenge);
    default:
      return XP_TABLE[source];
  }
}

/** Seviye unvanları (i18n anahtarı) — seviye eşiğine göre artan. */
export const LEVEL_TITLES: { minLevel: number; key: string }[] = [
  { minLevel: 1, key: 'fun.level.rookie' },
  { minLevel: 3, key: 'fun.level.explorer' },
  { minLevel: 5, key: 'fun.level.trailWolf' },
  { minLevel: 7, key: 'fun.level.summitHunter' },
  { minLevel: 10, key: 'fun.level.mountainGoat' },
  { minLevel: 13, key: 'fun.level.stormRider' },
  { minLevel: 16, key: 'fun.level.legend' },
  { minLevel: 20, key: 'fun.level.titan' },
];

/** `level` seviyesine ulaşmak için gereken toplam XP: 100·(n−1)·n/2 → 0, 100, 300, 600, 1000… */
export function xpThreshold(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return (100 * (n - 1) * n) / 2;
}

export function levelTitleFor(level: number): string {
  let key = LEVEL_TITLES[0]!.key;
  for (const item of LEVEL_TITLES) if (level >= item.minLevel) key = item.key;
  return key;
}

/** Toplam XP'den seviye bilgisi. Eşikler artan aralıklı, sonsuza dek devam eder. */
export function levelFor(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpThreshold(level + 1) <= safeXp) level += 1;
  const current = xpThreshold(level);
  const next = xpThreshold(level + 1);
  const progress = (safeXp - current) / (next - current);
  return {
    level,
    title: levelTitleFor(level),
    xp: safeXp,
    nextLevelXp: next,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

/** Olay listesinin toplam XP'si */
export function totalXp(events: XpEvent[]): number {
  return events.reduce((sum, e) => sum + e.amount, 0);
}

/** Kullanıcı başına toplam XP */
export function xpByUser(events: XpEvent[]): Record<ID, number> {
  const out: Record<ID, number> = {};
  for (const e of events) out[e.userId] = (out[e.userId] ?? 0) + e.amount;
  return out;
}

/** Son `days` gün içindeki XP (haftalık sıralama vb.) */
export function xpSince(events: XpEvent[], since: Date | number): Record<ID, number> {
  const ms = typeof since === 'number' ? since : since.getTime();
  return xpByUser(events.filter((e) => new Date(e.createdAt).getTime() >= ms));
}

/* ------------------------------------------------------------------ */
/* Seri (streak)                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ardışık aktif gün sayısı. Bugün ya da dün olay varsa seri sürer;
 * ikisinde de yoksa seri kırılmıştır (0).
 */
export function streakDays(events: XpEvent[], now: Date | number = Date.now()): number {
  const days = new Set(events.map((e) => dayNumber(e.createdAt)));
  const today = dayNumber(now);
  let cursor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (cursor === null) return 0;
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor -= 1;
  }
  return count;
}

/** Seri bonusu: gün × 2 XP (7. günden sonra sabitlenir). */
export function streakBonus(days: number): number {
  return xpFor('streak', { days: Math.min(days, 30) });
}

/* ------------------------------------------------------------------ */
/* Rozetler                                                            */
/* ------------------------------------------------------------------ */

/** Rozet koşullarını değerlendirmek için kullanıcı istatistikleri. */
export interface GamificationStats {
  posts: number;
  /** Paylaşılan farklı rota sayısı */
  routes: number;
  /** Tek rotada en yüksek tırmanış (m) */
  maxAscentM: number;
  nightCamps: number;
  dives: number;
  /** Pasaportta farklı ülke sayısı */
  countries: number;
  streakDays: number;
  hazardReportsConfirmed: number;
  perfectQuizzes: number;
  clubEvents: number;
  totalDistanceKm: number;
  earlyStarts: number;
  nightActivities: number;
  winterAdventures: number;
  flights: number;
  summits: number;
  challengesCompleted: number;
  weeklyWins: number;
  level: number;
  xp: number;
}

export const EMPTY_STATS: GamificationStats = {
  posts: 0,
  routes: 0,
  maxAscentM: 0,
  nightCamps: 0,
  dives: 0,
  countries: 0,
  streakDays: 0,
  hazardReportsConfirmed: 0,
  perfectQuizzes: 0,
  clubEvents: 0,
  totalDistanceKm: 0,
  earlyStarts: 0,
  nightActivities: 0,
  winterAdventures: 0,
  flights: 0,
  summits: 0,
  challengesCompleted: 0,
  weeklyWins: 0,
  level: 1,
  xp: 0,
};

/** Rozet kimliği → koşul. Seed'deki 20 rozetle birebir. */
export const BADGE_RULES: Record<ID, (s: GamificationStats) => boolean> = {
  b_first_post: (s) => s.posts >= 1,
  b_ten_routes: (s) => s.routes >= 10,
  b_ascent_1000: (s) => s.maxAscentM >= 1000,
  b_night_camp: (s) => s.nightCamps >= 1,
  b_five_dives: (s) => s.dives >= 5,
  b_three_countries: (s) => s.countries >= 3,
  b_streak_7: (s) => s.streakDays >= 7,
  b_hazard_hero: (s) => s.hazardReportsConfirmed >= 1,
  b_quiz_perfect: (s) => s.perfectQuizzes >= 1,
  b_club_event: (s) => s.clubEvents >= 1,
  b_100km: (s) => s.totalDistanceKm >= 100,
  b_early_bird: (s) => s.earlyStarts >= 3,
  b_night_owl: (s) => s.nightActivities >= 3,
  b_winter: (s) => s.winterAdventures >= 3,
  b_first_flight: (s) => s.flights >= 1,
  b_five_summits: (s) => s.summits >= 5,
  b_five_challenges: (s) => s.challengesCompleted >= 5,
  b_weekly_champion: (s) => s.weeklyWins >= 1,
  b_level_15: (s) => s.level >= 15,
  b_xp_10k: (s) => s.xp >= 10_000,
};

/**
 * Koşulu sağlanan ama henüz kazanılmamış rozet kimlikleri.
 * Kurallı olmayan rozetler (manuel verilenler) değerlendirilmez.
 */
export function evaluateBadges(stats: GamificationStats, earned: ID[]): ID[] {
  const have = new Set(earned);
  return Object.entries(BADGE_RULES)
    .filter(([id, rule]) => !have.has(id) && rule(stats))
    .map(([id]) => id);
}

/* ------------------------------------------------------------------ */
/* Görevler                                                            */
/* ------------------------------------------------------------------ */

export function isChallengeActive(challenge: Challenge, now: Date | number = Date.now()): boolean {
  const ms = typeof now === 'number' ? now : now.getTime();
  return new Date(challenge.startsAt).getTime() <= ms && ms <= new Date(challenge.endsAt).getTime();
}

/** Görev ilerlemesi yüzde (0–100). Katılmamışsa 0. */
export function challengeProgressPct(
  progress: Pick<ChallengeProgress, 'value'> | null,
  challenge: Pick<Challenge, 'target'>,
): number {
  if (!progress || challenge.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress.value / challenge.target) * 100)));
}

/** Bitişe kalan tam gün (en az 0). */
export function challengeDaysLeft(challenge: Challenge, now: Date | number = Date.now()): number {
  const ms = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - ms) / DAY_MS));
}

/**
 * İlerlemeye katkı ekler; hedefe ulaşıldıysa `completedAt` damgalar.
 * Zaten tamamlanmışsa dokunmaz.
 */
export function completeChallenge(
  progress: ChallengeProgress,
  challenge: Challenge,
  now: Date | number = Date.now(),
  delta = 0,
): ChallengeProgress {
  if (progress.completedAt) return progress;
  const value = Math.max(progress.value, Math.min(challenge.target, progress.value + delta));
  const done = value >= challenge.target;
  return {
    ...progress,
    value,
    completedAt: done ? new Date(now).toISOString() : null,
  };
}

/* ------------------------------------------------------------------ */
/* Liderlik tablosu                                                    */
/* ------------------------------------------------------------------ */

export interface LeaderboardMeta {
  follows: Follow[];
  clubMembers: ClubMember[];
  /** Aynı şehir sayılacak azami mesafe (km) */
  cityRadiusKm?: number;
}

/** `Kadıköy, İstanbul` → `istanbul` */
export function cityKey(locationName: string): string {
  const parts = locationName
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return (parts[parts.length - 1] ?? '').toLocaleLowerCase('tr-TR');
}

function sameCity(a: User, b: User, radiusKm: number): boolean {
  const ka = cityKey(a.locationName);
  const kb = cityKey(b.locationName);
  if (ka && kb && ka === kb) return true;
  return distanceKm(a.coords, b.coords) <= radiusKm;
}

/**
 * Kapsama göre filtrelenmiş, XP'ye göre sıralı liderlik tablosu.
 * Kullanıcı her kapsamda listede yer alır (XP'si 0 olsa bile).
 */
export function buildLeaderboard(
  users: User[],
  xpByUserMap: Record<ID, number>,
  meId: ID,
  scope: LeaderboardScope,
  meta: LeaderboardMeta,
): LeaderboardEntry[] {
  const me = users.find((u) => u.id === meId);
  let pool: User[];
  switch (scope) {
    case 'friends': {
      const ids = new Set(
        meta.follows.filter((f) => f.followerId === meId).map((f) => f.followingId),
      );
      pool = users.filter((u) => u.id === meId || ids.has(u.id));
      break;
    }
    case 'city': {
      pool = me
        ? users.filter((u) => u.id === meId || sameCity(me, u, meta.cityRadiusKm ?? 40))
        : [];
      break;
    }
    case 'club': {
      const myClubs = new Set(
        meta.clubMembers.filter((m) => m.userId === meId).map((m) => m.clubId),
      );
      const ids = new Set(
        meta.clubMembers.filter((m) => myClubs.has(m.clubId)).map((m) => m.userId),
      );
      pool = users.filter((u) => u.id === meId || ids.has(u.id));
      break;
    }
    default:
      pool = users;
  }
  return pool
    .map((user) => ({ user, xp: xpByUserMap[user.id] ?? 0 }))
    .sort((a, b) => b.xp - a.xp || a.user.displayName.localeCompare(b.user.displayName, 'tr'))
    .map((row, i) => ({ rank: i + 1, user: row.user, xp: row.xp, isMe: row.user.id === meId }));
}

/* ------------------------------------------------------------------ */
/* Bilgi yarışması                                                     */
/* ------------------------------------------------------------------ */

/** Günün soru seti tohumu: gün numarası. */
export function quizSeedFor(now: Date | number = Date.now()): number {
  return dayNumber(now);
}

/** Deterministik karışık seçim; aynı tohum aynı soruları aynı sırayla verir. */
export function pickQuiz(questions: QuizQuestion[], count: number, seed: number): QuizQuestion[] {
  return seededShuffle(questions, seed).slice(0, Math.max(0, count));
}

export interface QuizAnswer {
  questionId: ID;
  answerIndex: number;
}

/** Skor: doğru × 5 XP, tam puanda +25; `streak` en uzun doğru serisidir. */
export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswer[]): QuizResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.answerIndex]));
  let correct = 0;
  let run = 0;
  let best = 0;
  for (const q of questions) {
    if (byId.get(q.id) === q.answerIndex) {
      correct += 1;
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  const total = questions.length;
  return { correct, total, xpEarned: xpFor('quiz', { correct, total }), streak: best };
}

/* ------------------------------------------------------------------ */
/* Macera ruleti                                                       */
/* ------------------------------------------------------------------ */

export type RouletteReason =
  | 'fun.reason.preference'
  | 'fun.reason.nearby'
  | 'fun.reason.altitude'
  | 'fun.reason.abroad'
  | 'fun.reason.surprise';

function rouletteWeight(
  place: LibraryPlace,
  origin: GeoPoint | null,
  preferences: AdventureType[],
): { weight: number; distance: number | null } {
  const distance = origin
    ? distanceKm(origin, { latitude: place.lat, longitude: place.lng })
    : null;
  let weight = 1;
  if (preferences.some((p) => place.adventureTypes.includes(p))) weight += 4;
  if (distance !== null) {
    if (distance <= 150) weight += 3;
    else if (distance <= 600) weight += 1;
  }
  if (place.image) weight += 0.5;
  return { weight, distance };
}

/**
 * Tercihlere ve yakınlığa göre ağırlıklı, tohumla deterministik yer önerisi.
 * `reason` bir i18n anahtarıdır; ekran `{{name}}`, `{{distance}}`, `{{type}}` ile çevirir.
 */
export function spinRoulette(
  places: LibraryPlace[],
  origin: GeoPoint | null,
  preferences: AdventureType[],
  seed: number,
): RouletteSuggestion | null {
  const candidates = places.filter((p) => p.adventureTypes.length > 0);
  if (candidates.length === 0) return null;
  const scored = candidates.map((place) => ({
    place,
    ...rouletteWeight(place, origin, preferences),
  }));
  const total = scored.reduce((s, x) => s + x.weight, 0);
  const rng = seededRandom(seed);
  let ticket = rng() * total;
  let chosen = scored[scored.length - 1]!;
  for (const item of scored) {
    ticket -= item.weight;
    if (ticket <= 0) {
      chosen = item;
      break;
    }
  }
  const { place, distance } = chosen;
  const adventureType =
    preferences.find((p) => place.adventureTypes.includes(p)) ??
    place.adventureTypes[0] ??
    'hiking';

  let reason: RouletteReason = 'fun.reason.surprise';
  if (preferences.includes(adventureType) && preferences.length > 0)
    reason = 'fun.reason.preference';
  else if (distance !== null && distance <= 150) reason = 'fun.reason.nearby';
  else if ((place.elevationM ?? 0) >= 2000) reason = 'fun.reason.altitude';
  else if (place.countryCode && place.countryCode !== 'TR') reason = 'fun.reason.abroad';

  return {
    title: place.name,
    adventureType,
    placeId: place.id,
    placeName: place.name,
    distanceKm: distance === null ? null : Math.round(distance),
    reason,
  };
}

/* ------------------------------------------------------------------ */
/* Zirve pasaportu                                                     */
/* ------------------------------------------------------------------ */

export interface PassportSummary {
  total: number;
  countries: number;
  highestM: number | null;
  highestName: string | null;
  byType: Partial<Record<AdventureType, number>>;
  latestAt: ISODate | null;
}

export function passportSummary(stamps: PassportStamp[]): PassportSummary {
  const byType: Partial<Record<AdventureType, number>> = {};
  let highest: PassportStamp | null = null;
  let latest: ISODate | null = null;
  for (const s of stamps) {
    byType[s.adventureType] = (byType[s.adventureType] ?? 0) + 1;
    if (s.elevationM !== null && (highest === null || s.elevationM > (highest.elevationM ?? -1)))
      highest = s;
    if (!latest || s.stampedAt > latest) latest = s.stampedAt;
  }
  return {
    total: stamps.length,
    countries: new Set(stamps.map((s) => s.countryCode)).size,
    highestM: highest?.elevationM ?? null,
    highestName: highest?.placeName ?? null,
    byType,
    latestAt: latest,
  };
}

/** Ülke kodunu bayrak emojisine çevirir (`TR` → 🇹🇷). */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
