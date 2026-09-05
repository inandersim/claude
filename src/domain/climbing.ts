import type { AscentStyle, ClimbType, GradeSystem, VerificationStatus } from './enums';
import { distanceKm } from './geo';
import type {
  Ascent,
  ClimbingFilter,
  ClimbingRoute,
  Crag,
  CragWithDistance,
  GeoPoint,
} from './types';

/* ------------------------------------------------------------------ */
/* Derece tabloları                                                    */
/* ------------------------------------------------------------------ */

/**
 * Her derece ortak bir "zorluk puanı"na (10–66) eşlenir. Sistemler arası dönüşüm
 * en yakın puanlı dereceyi seçer; eşitlikte kolay olan tercih edilir.
 * Rota sistemleri (french/yds/uiaa) ve boulder sistemleri (font/v_scale) ayrı ailelerdir.
 */
type GradeRow = readonly [grade: string, score: number];

const FRENCH: readonly GradeRow[] = [
  ['3', 10],
  ['3+', 12],
  ['4a', 14],
  ['4b', 16],
  ['4c', 18],
  ['5a', 20],
  ['5b', 22],
  ['5c', 24],
  ['6a', 26],
  ['6a+', 28],
  ['6b', 30],
  ['6b+', 32],
  ['6c', 34],
  ['6c+', 36],
  ['7a', 38],
  ['7a+', 40],
  ['7b', 42],
  ['7b+', 44],
  ['7c', 46],
  ['7c+', 48],
  ['8a', 50],
  ['8a+', 52],
  ['8b', 54],
  ['8b+', 56],
  ['8c', 58],
  ['8c+', 60],
  ['9a', 62],
  ['9a+', 64],
  ['9b', 66],
];

const YDS: readonly GradeRow[] = [
  ['5.4', 10],
  ['5.5', 13],
  ['5.6', 16],
  ['5.7', 18],
  ['5.8', 20],
  ['5.9', 22],
  ['5.10a', 26],
  ['5.10b', 28],
  ['5.10c', 30],
  ['5.10d', 32],
  ['5.11a', 34],
  ['5.11b', 36],
  ['5.11c', 38],
  ['5.11d', 40],
  ['5.12a', 42],
  ['5.12b', 44],
  ['5.12c', 46],
  ['5.12d', 46.5],
  ['5.13a', 48],
  ['5.13b', 50],
  ['5.13c', 52],
  ['5.13d', 54],
  ['5.14a', 56],
  ['5.14b', 58],
  ['5.14c', 60],
  ['5.14d', 62],
  ['5.15a', 64],
  ['5.15b', 66],
];

const UIAA: readonly GradeRow[] = [
  ['III', 10],
  ['III+', 12],
  ['IV', 14],
  ['IV+', 16],
  ['V-', 18],
  ['V', 20],
  ['V+', 22],
  ['VI-', 24],
  ['VI', 25],
  ['VI+', 26],
  ['VII-', 28],
  ['VII', 30],
  ['VII+', 32],
  ['VIII-', 34],
  ['VIII', 37],
  ['VIII+', 40],
  ['IX-', 42],
  ['IX', 44],
  ['IX+', 46],
  ['X-', 48],
  ['X', 50],
  ['X+', 52],
  ['XI-', 54],
  ['XI', 56],
  ['XI+', 58],
  ['XII-', 60],
  ['XII', 62],
  ['XII+', 64],
];

const FONT: readonly GradeRow[] = [
  ['3', 10],
  ['4', 14],
  ['4+', 16],
  ['5', 18],
  ['5+', 20],
  ['6A', 24],
  ['6A+', 26],
  ['6B', 28],
  ['6B+', 30],
  ['6C', 32],
  ['6C+', 34],
  ['7A', 36],
  ['7A+', 38],
  ['7B', 40],
  ['7B+', 42],
  ['7C', 44],
  ['7C+', 46],
  ['8A', 48],
  ['8A+', 50],
  ['8B', 52],
  ['8B+', 54],
  ['8C', 56],
  ['8C+', 58],
];

const V_SCALE: readonly GradeRow[] = [
  ['VB', 10],
  ['V0', 17.5],
  ['V1', 21],
  ['V2', 24.5],
  ['V3', 27],
  ['V4', 30],
  ['V5', 33],
  ['V6', 36],
  ['V7', 38],
  ['V8', 40],
  ['V9', 44],
  ['V10', 46],
  ['V11', 48],
  ['V12', 50],
  ['V13', 52],
  ['V14', 54],
  ['V15', 56],
  ['V16', 58],
  ['V17', 60],
];

const TABLES: Record<GradeSystem, readonly GradeRow[]> = {
  french: FRENCH,
  yds: YDS,
  uiaa: UIAA,
  font: FONT,
  v_scale: V_SCALE,
};

export type GradeFamily = 'route' | 'boulder';
export type GradeBucket = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export const GRADE_BUCKETS: readonly GradeBucket[] = [
  'beginner',
  'intermediate',
  'advanced',
  'elite',
];

const SCORE_MIN = 10;
const SCORE_MAX = 66;

/** Sistemin ailesi: rota (french/yds/uiaa) veya boulder (font/v_scale). */
export function gradeFamily(system: GradeSystem): GradeFamily {
  return system === 'font' || system === 'v_scale' ? 'boulder' : 'route';
}

/** Tırmanış türü için varsayılan derece sistemi. */
export function defaultSystemFor(type: ClimbType): GradeSystem {
  return type === 'boulder' ? 'font' : 'french';
}

/** Verilen sistemin kolaydan zora sıralı derece listesi. */
export function gradesFor(system: GradeSystem): string[] {
  return TABLES[system].map(([g]) => g);
}

function normalize(grade: string, system: GradeSystem): string {
  const g = grade.trim();
  // Fransız ve YDS küçük harf (6a+, 5.10a); UIAA, Font ve V-scale büyük harf (VI+, 6B+, V4)
  return system === 'french' || system === 'yds' ? g.toLowerCase() : g.toUpperCase();
}

/** Derecenin sistem içindeki sırası (0 tabanlı); bilinmiyorsa -1. */
export function gradeIndex(grade: string, system: GradeSystem): number {
  const n = normalize(grade, system);
  return TABLES[system].findIndex(([g]) => g === n);
}

/** Ortak zorluk puanı (10–66); bilinmeyen derece için null. */
export function gradeScore(grade: string, system: GradeSystem): number | null {
  const i = gradeIndex(grade, system);
  return i < 0 ? null : TABLES[system][i]![1];
}

/**
 * Dereceyi başka bir sisteme çevirir. Aynı aile içinde en yakın puanlı dereceyi
 * seçer (eşitlikte kolay olan). Rota↔boulder çapraz dönüşüm ve bilinmeyen derece için null.
 */
export function convertGrade(grade: string, from: GradeSystem, to: GradeSystem): string | null {
  if (gradeFamily(from) !== gradeFamily(to)) return null;
  const score = gradeScore(grade, from);
  if (score === null) return null;
  if (from === to) return TABLES[to][gradeIndex(grade, from)]![0];
  let best: GradeRow | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const row of TABLES[to]) {
    const diff = Math.abs(row[1] - score);
    if (diff < bestDiff) {
      best = row;
      bestDiff = diff;
    }
  }
  return best ? best[0] : null;
}

/** Derecenin tüm sistemlerdeki karşılıkları (çapraz aile için null). */
export function gradeVariants(
  grade: string,
  system: GradeSystem,
): Record<GradeSystem, string | null> {
  return {
    french: convertGrade(grade, system, 'french'),
    yds: convertGrade(grade, system, 'yds'),
    uiaa: convertGrade(grade, system, 'uiaa'),
    font: convertGrade(grade, system, 'font'),
    v_scale: convertGrade(grade, system, 'v_scale'),
  };
}

/**
 * İki dereceyi karşılaştırır: negatif → a daha kolay, pozitif → a daha zor, 0 → eşdeğer.
 * Bilinmeyen dereceler en kolay kabul edilir.
 */
export function compareGrades(a: string, sysA: GradeSystem, b: string, sysB: GradeSystem): number {
  const sa = gradeScore(a, sysA) ?? SCORE_MIN - 1;
  const sb = gradeScore(b, sysB) ?? SCORE_MIN - 1;
  return sa - sb;
}

/** Derece kovası: puana göre başlangıç / orta / ileri / elit. */
export function gradeBucket(grade: string, system: GradeSystem): GradeBucket {
  const s = gradeScore(grade, system) ?? SCORE_MIN;
  if (s < 24) return 'beginner';
  if (s < 38) return 'intermediate';
  if (s < 54) return 'advanced';
  return 'elite';
}

const COLOR_STOPS: readonly [t: number, rgb: [number, number, number]][] = [
  [0, [34, 197, 94]], // yeşil
  [0.3, [234, 179, 8]], // sarı
  [0.55, [249, 115, 22]], // turuncu
  [0.78, [239, 68, 68]], // kırmızı
  [1, [168, 85, 247]], // mor
];

function hex2(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');
}

/** Kolaydan zora yeşil → sarı → turuncu → kırmızı → mor renk skalası. */
export function gradeColor(grade: string, system: GradeSystem): string {
  const s = gradeScore(grade, system) ?? SCORE_MIN;
  const t = Math.max(0, Math.min(1, (s - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));
  let lo = COLOR_STOPS[0]!;
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1]!;
  for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
    if (t >= COLOR_STOPS[i]![0] && t <= COLOR_STOPS[i + 1]![0]) {
      lo = COLOR_STOPS[i]!;
      hi = COLOR_STOPS[i + 1]!;
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const k = (t - lo[0]) / span;
  const mix = (i: 0 | 1 | 2) => lo[1][i] + (hi[1][i] - lo[1][i]) * k;
  return `#${hex2(mix(0))}${hex2(mix(1))}${hex2(mix(2))}`;
}

/** Rotanın derecesini tercih edilen sisteme çevirir; çevrilemiyorsa orijinali döner. */
export function formatGrade(
  route: Pick<ClimbingRoute, 'grade' | 'gradeSystem'>,
  preferredSystem: GradeSystem,
): string {
  return convertGrade(route.grade, route.gradeSystem, preferredSystem) ?? route.grade;
}

/**
 * Tercih edilen sistemle aynı ailedeki hedef sistemi seçer: boulder rotası için
 * kullanıcı 'yds' seçmişse 'v_scale', rota için 'font' seçmişse 'french' gibi.
 */
export function effectiveSystem(routeSystem: GradeSystem, preferred: GradeSystem): GradeSystem {
  if (gradeFamily(routeSystem) === gradeFamily(preferred)) return preferred;
  if (gradeFamily(routeSystem) === 'boulder') return preferred === 'yds' ? 'v_scale' : 'font';
  return preferred === 'v_scale' ? 'yds' : 'french';
}

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

export const COMMUNITY_CONFIRMATION_THRESHOLD = 3;

export interface RouteConfirmation {
  userId: string;
  routeId: string;
}

/**
 * Doğrulama durumu: moderatör veya doğrulanmış kulüp → verified;
 * 3+ bağımsız onay → community; aksi halde unverified.
 */
export function verificationOf(
  confirmations: number,
  submittedByVerifiedClub: boolean,
  moderatorApproved: boolean,
): VerificationStatus {
  if (moderatorApproved || submittedByVerifiedClub) return 'verified';
  if (confirmations >= COMMUNITY_CONFIRMATION_THRESHOLD) return 'community';
  return 'unverified';
}

/**
 * Kullanıcı bu rotayı onaylayabilir mi? Kendi gönderdiği rotayı onaylayamaz,
 * yalnızca bir kez onaylayabilir; zaten moderatör onaylı rota için onay gerekmez.
 */
export function canConfirm(
  route: Pick<ClimbingRoute, 'id' | 'submittedBy' | 'verification'>,
  userId: string,
  confirmations: RouteConfirmation[],
): boolean {
  if (route.verification === 'verified') return false;
  if (route.submittedBy === userId) return false;
  return !confirmations.some((c) => c.userId === userId && c.routeId === route.id);
}

/** Kayanın doğrulama durumu rota çoğunluğuna göre belirlenir. */
export function cragVerificationOf(
  routes: Pick<ClimbingRoute, 'verification'>[],
): VerificationStatus {
  if (routes.length === 0) return 'unverified';
  const verified = routes.filter((r) => r.verification === 'verified').length;
  const community = routes.filter((r) => r.verification === 'community').length;
  const half = routes.length / 2;
  if (verified > half) return 'verified';
  if (verified + community > half) return 'community';
  return 'unverified';
}

/* ------------------------------------------------------------------ */
/* Listeleme ve özetler                                                */
/* ------------------------------------------------------------------ */

const fold = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * Metin, ülke, tür ve doğrulama filtresi uygular; konum verilmişse mesafeye,
 * yoksa rota sayısına göre sıralar.
 */
export function filterCrags(
  crags: Crag[],
  filter: ClimbingFilter,
  origin: GeoPoint | null,
): CragWithDistance[] {
  const q = filter.query ? fold(filter.query.trim()) : '';
  const list = crags
    .filter((c) => {
      if (filter.countryCode && c.countryCode !== filter.countryCode) return false;
      if (filter.climbType && !c.climbTypes.includes(filter.climbType)) return false;
      if (filter.verifiedOnly && c.verification === 'unverified') return false;
      if (q) {
        const hay = fold(`${c.name} ${c.locationName} ${c.rockType}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map<CragWithDistance>((c) => ({
      ...c,
      distanceKm: origin ? distanceKm(origin, c.coords) : null,
    }));
  list.sort((a, b) =>
    origin ? (a.distanceKm ?? 0) - (b.distanceKm ?? 0) : b.routeCount - a.routeCount,
  );
  return list;
}

export interface CragSummary {
  total: number;
  byType: Partial<Record<ClimbType, number>>;
  histogram: Record<GradeBucket, number>;
  avgStars: number;
  /** Puana göre en kolay ve en zor rota */
  easiest: ClimbingRoute | null;
  hardest: ClimbingRoute | null;
}

/** Tür dağılımı, derece histogramı (kovalara göre) ve ortalama yıldız. */
export function cragSummary(routes: ClimbingRoute[]): CragSummary {
  const byType: Partial<Record<ClimbType, number>> = {};
  const histogram: Record<GradeBucket, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    elite: 0,
  };
  let stars = 0;
  let easiest: ClimbingRoute | null = null;
  let hardest: ClimbingRoute | null = null;
  for (const r of routes) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    histogram[gradeBucket(r.grade, r.gradeSystem)] += 1;
    stars += r.stars;
    if (!easiest || compareGrades(r.grade, r.gradeSystem, easiest.grade, easiest.gradeSystem) < 0)
      easiest = r;
    if (!hardest || compareGrades(r.grade, r.gradeSystem, hardest.grade, hardest.gradeSystem) > 0)
      hardest = r;
  }
  return {
    total: routes.length,
    byType,
    histogram,
    avgStars: routes.length ? Math.round((stars / routes.length) * 10) / 10 : 0,
    easiest,
    hardest,
  };
}

/** Başarılı sayılan stiller (piramit ve "en zor" hesapları için). */
export const SEND_STYLES: readonly AscentStyle[] = ['onsight', 'flash', 'redpoint'];

export interface AscentStats {
  total: number;
  byStyle: Record<AscentStyle, number>;
  sends: number;
  hardest: { grade: string; system: GradeSystem; route: ClimbingRoute } | null;
  cragCount: number;
}

/** Stil sayıları ve en zor başarılı çıkış. */
export function ascentStats(ascents: Ascent[], routes: ClimbingRoute[]): AscentStats {
  const byStyle: Record<AscentStyle, number> = {
    onsight: 0,
    flash: 0,
    redpoint: 0,
    toprope: 0,
    attempt: 0,
  };
  const byId = new Map(routes.map((r) => [r.id, r]));
  const crags = new Set<string>();
  let hardest: AscentStats['hardest'] = null;
  for (const a of ascents) {
    byStyle[a.style] += 1;
    const route = byId.get(a.routeId);
    if (!route) continue;
    crags.add(route.cragId);
    if (!SEND_STYLES.includes(a.style)) continue;
    if (
      !hardest ||
      compareGrades(route.grade, route.gradeSystem, hardest.grade, hardest.system) > 0
    ) {
      hardest = { grade: route.grade, system: route.gradeSystem, route };
    }
  }
  return {
    total: ascents.length,
    byStyle,
    sends: byStyle.onsight + byStyle.flash + byStyle.redpoint,
    hardest,
    cragCount: crags.size,
  };
}

export interface PyramidRow {
  grade: string;
  system: GradeSystem;
  count: number;
  score: number;
}

/**
 * Derece piramidi: başarılı çıkışları (onsight/flash/redpoint) dereceye göre sayar.
 * `preferred` verilirse dereceler o sistemin ailesine çevrilir. Zordan kolaya sıralı.
 */
export function pyramidOf(
  ascents: Ascent[],
  routes: ClimbingRoute[],
  preferred: GradeSystem = 'french',
): PyramidRow[] {
  const byId = new Map(routes.map((r) => [r.id, r]));
  const rows = new Map<string, PyramidRow>();
  for (const a of ascents) {
    if (!SEND_STYLES.includes(a.style)) continue;
    const route = byId.get(a.routeId);
    if (!route) continue;
    const system = effectiveSystem(route.gradeSystem, preferred);
    const grade = convertGrade(route.grade, route.gradeSystem, system) ?? route.grade;
    const key = `${system}:${grade}`;
    const existing = rows.get(key);
    if (existing) existing.count += 1;
    else rows.set(key, { grade, system, count: 1, score: gradeScore(grade, system) ?? 0 });
  }
  return [...rows.values()].sort((a, b) => b.score - a.score || a.system.localeCompare(b.system));
}

const MONTHS: Record<'tr' | 'en', string[]> = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/**
 * Ay listesini kısa aralık etiketine çevirir: [10,11,12,1,2,3] → "Eki–Mar".
 * Yıl sonu sarmalı aralıklar tek parça olarak gösterilir; boş liste → "".
 */
export function bestSeasonLabel(months: number[], locale: string = 'tr'): string {
  const names = MONTHS[locale === 'tr' ? 'tr' : 'en'];
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0) return '';
  if (set.size === 12) return locale === 'tr' ? 'Tüm yıl' : 'All year';
  // Aralık başlangıçları: bir önceki ay listede olmayan aylar
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  const ranges = starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1) && end !== (start === 1 ? 12 : start - 1)) {
      end = end === 12 ? 1 : end + 1;
    }
    return start === end ? names[start - 1]! : `${names[start - 1]}–${names[end - 1]}`;
  });
  return ranges.join(', ');
}

/** Ay şu an en iyi sezonda mı? */
export function isInSeason(months: number[], now: Date = new Date()): boolean {
  return months.includes(now.getMonth() + 1);
}

/** Ülke koduna bayrak emojisi. */
export function countryFlag(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  if (cc.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
