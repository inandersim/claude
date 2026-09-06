import type { TranslationKey } from '@/core/i18n';

import { distanceKm } from './geo';
import type {
  AmsCheck,
  Destination,
  DestinationFilter,
  DestinationStage,
  ReturnPlan,
  User,
} from './types';
import type { TripPlanStatus } from './enums';

/**
 * destinations modülü saf iş mantığı: destinasyon filtreleme, Lake Louise AMS skoru,
 * aklimatizasyon uyarıları, etap profili ve "Dönüş Sözü" yol planı durum makinesi.
 * React/RN bağımlılığı yoktur; tamamı test edilebilir.
 */

export const DESTINATIONS_MODULE = 'destinations';

/* ------------------------------------------------------------------ */
/* Filtreleme                                                          */
/* ------------------------------------------------------------------ */

/** Türkçe/İngilizce karakter farklarını yok sayan normalizasyon (arama için). */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

/**
 * Destinasyon listesini filtreler: metin (ad/bölge/ülke kodu), tür, macera türü, ay.
 * `origin` verildiyse mesafeye göre sıralar; yoksa seed sırasını (puan) korur.
 */
export function filterDestinations<T extends Destination>(
  list: T[],
  filter: DestinationFilter,
): T[] {
  const q = filter.query ? normalize(filter.query.trim()) : '';
  const out = list.filter((d) => {
    if (filter.countryCode && d.countryCode !== filter.countryCode) return false;
    if (filter.type && d.type !== filter.type) return false;
    if (filter.adventureType && !d.adventureTypes.includes(filter.adventureType)) return false;
    if (filter.month && !d.bestMonths.includes(filter.month)) return false;
    if (q) {
      const hay = normalize(`${d.name} ${d.region} ${d.countryCode} ${d.slug}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const origin = filter.origin;
  if (origin) {
    return out
      .map((d) => ({ d, km: distanceKm(origin, d.coords) }))
      .sort((a, b) => a.km - b.km)
      .map((x) => x.d);
  }
  return out;
}

/** Listedeki ülke kodlarını görülme sırasıyla döner (chip'ler için). */
export function countryCodesOf(list: Destination[]): string[] {
  const seen = new Set<string>();
  for (const d of list) seen.add(d.countryCode);
  return [...seen];
}

/* ------------------------------------------------------------------ */
/* Lake Louise AMS                                                     */
/* ------------------------------------------------------------------ */

export type AmsSeverity = AmsCheck['severity'];
export type AmsSymptomScore = 0 | 1 | 2 | 3;

export interface LakeLouiseResult {
  score: number;
  severity: AmsSeverity;
}

/** AMS şiddet meta bilgisi: etiket, tavsiye anahtarı ve renk tonu. */
export const AMS_SEVERITY_META: Record<
  AmsSeverity,
  {
    labelKey: TranslationKey;
    adviceKey: TranslationKey;
    tone: 'success' | 'info' | 'warning' | 'danger';
  }
> = {
  none: {
    labelKey: 'destinations.ams.severity.none',
    adviceKey: 'destinations.ams.advice.none',
    tone: 'success',
  },
  mild: {
    labelKey: 'destinations.ams.severity.mild',
    adviceKey: 'destinations.ams.advice.mild',
    tone: 'info',
  },
  moderate: {
    labelKey: 'destinations.ams.severity.moderate',
    adviceKey: 'destinations.ams.advice.moderate',
    tone: 'warning',
  },
  severe: {
    labelKey: 'destinations.ams.severity.severe',
    adviceKey: 'destinations.ams.advice.severe',
    tone: 'danger',
  },
};

/**
 * Lake Louise 2018 öz-değerlendirme skoru. Dört belirti 0–3 puanlanır (toplam 0–12).
 * Baş ağrısı olmadan AMS tanısı konmaz (toplam kaç olursa olsun `none`).
 * 3–5 hafif, 6–9 orta, ≥10 şiddetli.
 */
export function lakeLouiseScore(
  headache: AmsSymptomScore,
  gi: AmsSymptomScore,
  fatigue: AmsSymptomScore,
  dizziness: AmsSymptomScore,
): LakeLouiseResult {
  const score = headache + gi + fatigue + dizziness;
  if (headache === 0 || score < 3) return { score, severity: 'none' };
  if (score <= 5) return { score, severity: 'mild' };
  if (score <= 9) return { score, severity: 'moderate' };
  return { score, severity: 'severe' };
}

/** Şiddete göre tavsiye metninin i18n anahtarı. */
export function amsAdvice(severity: AmsSeverity): TranslationKey {
  return AMS_SEVERITY_META[severity].adviceKey;
}

/** AMS kayıtlarını tarihe göre eskiden yeniye sıralar (grafik için). */
export function sortAmsChecks(checks: AmsCheck[]): AmsCheck[] {
  return [...checks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ------------------------------------------------------------------ */
/* Etaplar ve aklimatizasyon                                           */
/* ------------------------------------------------------------------ */

/** Uyku irtifasında günlük güvenli artış (m). 2.500 m üzerinde geçerli. */
export const SAFE_SLEEP_GAIN_M = 500;
/** Bu irtifanın altında AMS riski düşük kabul edilir. */
export const AMS_THRESHOLD_M = 2500;

export interface AscentWarning {
  stageId: string;
  stageName: string;
  order: number;
  fromElevationM: number;
  toElevationM: number;
  gainM: number;
}

/** Etapları sıraya koyar (order). */
export function sortStages(stages: DestinationStage[]): DestinationStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

/**
 * Uyku irtifası bir önceki konaklamaya göre günde >500 m artan etapları işaretler.
 * Yalnızca konaklanan (`sleeping`) etaplar karşılaştırılır; 2.500 m altındaki hedefler atlanır.
 */
export function ascentRateWarning(stages: DestinationStage[]): AscentWarning[] {
  const sleeping = sortStages(stages).filter((s) => s.sleeping);
  const warnings: AscentWarning[] = [];
  for (let i = 1; i < sleeping.length; i += 1) {
    const prev = sleeping[i - 1]!;
    const cur = sleeping[i]!;
    const gain = cur.elevationM - prev.elevationM;
    if (gain > SAFE_SLEEP_GAIN_M && cur.elevationM >= AMS_THRESHOLD_M) {
      warnings.push({
        stageId: cur.id,
        stageName: cur.name,
        order: cur.order,
        fromElevationM: prev.elevationM,
        toElevationM: cur.elevationM,
        gainM: gain,
      });
    }
  }
  return warnings;
}

export interface AcclimatizationSuggestion {
  stageId: string;
  stageName: string;
  elevationM: number;
  reason: 'marked' | 'threshold' | 'gain';
}

/**
 * Önerilen ek aklimatizasyon günleri:
 * - seed'de `restDayRecommended` işaretli konaklamalar,
 * - 3.000 m üzerinde son dinlenmeden beri ≥1.000 m kazanç,
 * - günlük >500 m uyku irtifası artışı (ascentRateWarning) olan ve işaretli olmayan konaklamalar.
 */
export function acclimatizationPlan(stages: DestinationStage[]): AcclimatizationSuggestion[] {
  const sleeping = sortStages(stages).filter((s) => s.sleeping);
  const warned = new Set(ascentRateWarning(stages).map((w) => w.stageId));
  const out: AcclimatizationSuggestion[] = [];
  let lastRest = sleeping[0]?.elevationM ?? 0;
  for (const s of sleeping) {
    if (s.restDayRecommended) {
      out.push({ stageId: s.id, stageName: s.name, elevationM: s.elevationM, reason: 'marked' });
      lastRest = s.elevationM;
    } else if (s.elevationM >= 3000 && s.elevationM - lastRest >= 1000) {
      out.push({ stageId: s.id, stageName: s.name, elevationM: s.elevationM, reason: 'threshold' });
      lastRest = s.elevationM;
    } else if (warned.has(s.id)) {
      out.push({ stageId: s.id, stageName: s.name, elevationM: s.elevationM, reason: 'gain' });
      lastRest = s.elevationM;
    }
  }
  return out;
}

/** [kümülatif km, irtifa m] çiftleri — alan grafiği için. */
export function stageProfile(stages: DestinationStage[]): [number, number][] {
  let km = 0;
  return sortStages(stages).map((s) => {
    km += s.distanceKm;
    return [Math.round(km * 10) / 10, s.elevationM];
  });
}

/** Etaplar arası pozitif irtifa kazançlarının toplamı (m). */
export function totalAscent(stages: DestinationStage[]): number {
  const sorted = sortStages(stages);
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gain = sorted[i]!.elevationM - sorted[i - 1]!.elevationM;
    if (gain > 0) total += gain;
  }
  return total;
}

/** Etaplar arası pozitif iniş toplamı (m). */
export function totalDescent(stages: DestinationStage[]): number {
  const sorted = sortStages(stages);
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const loss = sorted[i - 1]!.elevationM - sorted[i]!.elevationM;
    if (loss > 0) total += loss;
  }
  return total;
}

/** Toplam mesafe (km). */
export function totalDistance(stages: DestinationStage[]): number {
  return Math.round(stages.reduce((sum, s) => sum + s.distanceKm, 0) * 10) / 10;
}

/** Etaplar arasında en yüksek irtifa. */
export function maxStageElevation(stages: DestinationStage[]): number {
  return stages.reduce((m, s) => Math.max(m, s.elevationM), 0);
}

/** Konaklanan gün sayısı (yürüyüş günü yaklaşık = uyku sayısı). */
export function sleepingNights(stages: DestinationStage[]): number {
  return stages.filter((s) => s.sleeping).length;
}

/* ------------------------------------------------------------------ */
/* Bütçe ve aylar                                                      */
/* ------------------------------------------------------------------ */

function formatTry(value: number, locale: string): string {
  return `₺${new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

/** "₺45.000 – ₺90.000" biçiminde bütçe aralığı. */
export function budgetLabel(budget: { low: number; high: number }, locale = 'tr'): string {
  if (budget.low === budget.high) return formatTry(budget.low, locale);
  return `${formatTry(budget.low, locale)} – ${formatTry(budget.high, locale)}`;
}

const MONTHS_TR = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Ay kısaltması (1–12). */
export function monthShort(month: number, locale = 'tr'): string {
  const list = locale === 'tr' ? MONTHS_TR : MONTHS_EN;
  return list[Math.min(12, Math.max(1, month)) - 1]!;
}

/**
 * Ay listesini ardışık aralıklara sıkıştırır: [3,4,5,9,10,11] → "Mar–May, Eyl–Kas".
 * Aralık/Ocak geçişi (12→1) ayrı aralıklar olarak gösterilir.
 */
export function formatMonths(months: number[], locale = 'tr'): string {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return '—';
  if (sorted.length === 12) return locale === 'tr' ? 'Tüm yıl' : 'All year';
  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (let i = 1; i <= sorted.length; i += 1) {
    const cur = sorted[i];
    if (cur !== undefined && cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(
      start === prev
        ? monthShort(start, locale)
        : `${monthShort(start, locale)}–${monthShort(prev, locale)}`,
    );
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return parts.join(', ');
}

/** Verilen ay en iyi aylar içinde mi (1–12; tarih verilirse ayı alınır). */
export function isBestMonth(dest: Pick<Destination, 'bestMonths'>, month: number | Date): boolean {
  const m = month instanceof Date ? month.getMonth() + 1 : month;
  return dest.bestMonths.includes(m);
}

/* ------------------------------------------------------------------ */
/* Ekipman                                                             */
/* ------------------------------------------------------------------ */

export interface PackingItem {
  key: TranslationKey;
  reason: 'altitude' | 'type' | 'season';
}

/**
 * Destinasyonun irtifası, türü ve mevsimine göre standart listeye eklenecek ek eşyalar.
 * Metinler i18n anahtarı olarak döner (`destinations.packing.*`).
 */
export function packingForDestination(
  dest: Pick<Destination, 'maxElevationM' | 'type' | 'bestMonths' | 'adventureTypes'>,
): PackingItem[] {
  const items: PackingItem[] = [];
  const add = (key: TranslationKey, reason: PackingItem['reason']) => {
    if (!items.some((i) => i.key === key)) items.push({ key, reason });
  };
  if (dest.maxElevationM >= 3000) {
    add('destinations.packing.sunglassesCat4', 'altitude');
    add('destinations.packing.downJacket', 'altitude');
    add('destinations.packing.waterPurifier', 'altitude');
  }
  if (dest.maxElevationM >= 4000) {
    add('destinations.packing.sleepingBagMinus15', 'altitude');
    add('destinations.packing.pulseOximeter', 'altitude');
    add('destinations.packing.amsMeds', 'altitude');
  }
  if (dest.maxElevationM >= 5500) {
    add('destinations.packing.doubleBoots', 'altitude');
    add('destinations.packing.cramponsAxe', 'altitude');
    add('destinations.packing.expeditionMitts', 'altitude');
  }
  switch (dest.type) {
    case 'expedition':
      add('destinations.packing.harnessRope', 'type');
      add('destinations.packing.stoveFuel', 'type');
      break;
    case 'climbing_area':
      add('destinations.packing.helmet', 'type');
      add('destinations.packing.harnessRope', 'type');
      break;
    case 'dive_region':
      add('destinations.packing.diveComputer', 'type');
      add('destinations.packing.wetsuit', 'type');
      break;
    case 'ski_region':
      add('destinations.packing.avalancheKit', 'type');
      break;
    case 'trek':
      add('destinations.packing.trekkingPoles', 'type');
      break;
    case 'multi_sport':
      add('destinations.packing.helmet', 'type');
      break;
  }
  if (dest.adventureTypes.includes('skiing')) add('destinations.packing.avalancheKit', 'type');
  const winter = dest.bestMonths.some((m) => m === 12 || m <= 2);
  const summerOnly = dest.bestMonths.every((m) => m >= 5 && m <= 9);
  if (winter) add('destinations.packing.microspikes', 'season');
  if (summerOnly) add('destinations.packing.sunHatElectrolytes', 'season');
  if (dest.bestMonths.some((m) => m >= 6 && m <= 9) && dest.maxElevationM < 3000) {
    add('destinations.packing.rainShell', 'season');
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Dönüş Sözü (yol planı)                                              */
/* ------------------------------------------------------------------ */

const MINUTE_MS = 60_000;

/** Beklenen dönüş + tolerans süresinin bittiği an (ms). */
export function overdueAt(plan: Pick<ReturnPlan, 'expectedReturnAt' | 'graceMin'>): number {
  return Date.parse(plan.expectedReturnAt) + plan.graceMin * MINUTE_MS;
}

/**
 * Planın "şimdi"ye göre efektif durumu. returned/cancelled sabittir; diğerleri zamana göre:
 * başlangıçtan önce `planned`, tolerans dolduysa `overdue`, aksi hâlde `active`.
 */
export function returnPlanStatus(plan: ReturnPlan, now: Date | number): TripPlanStatus {
  if (plan.status === 'returned' || plan.status === 'cancelled') return plan.status;
  const t = typeof now === 'number' ? now : now.getTime();
  if (t >= overdueAt(plan)) return 'overdue';
  if (t < Date.parse(plan.startAt)) return 'planned';
  return 'active';
}

/** Tolerans süresi de geçtiyse ve plan kapanmadıysa gecikmiş sayılır. */
export function isOverdue(plan: ReturnPlan, now: Date | number): boolean {
  return returnPlanStatus(plan, now) === 'overdue';
}

/** Beklenen dönüşe kalan dakika (geçtiyse negatif). */
export function timeUntilReturn(
  plan: Pick<ReturnPlan, 'expectedReturnAt'>,
  now: Date | number,
): number {
  const t = typeof now === 'number' ? now : now.getTime();
  return Math.round((Date.parse(plan.expectedReturnAt) - t) / MINUTE_MS);
}

/** Geri sayım metni: "2 sa 15 dk", "-40 dk" (geçti). */
export function formatCountdown(minutes: number, locale = 'tr'): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  const d = locale === 'tr' ? 'g' : 'd';
  const h = locale === 'tr' ? 'sa' : 'h';
  const m = locale === 'tr' ? 'dk' : 'm';
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${d}`);
  if (hours > 0) parts.push(`${hours} ${h}`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} ${m}`);
  return `${sign}${parts.slice(0, 2).join(' ')}`;
}

/** Aktif olarak takip edilen (kapanmamış) planlar. */
export function openPlans(plans: ReturnPlan[]): ReturnPlan[] {
  return plans.filter((p) => p.status !== 'returned' && p.status !== 'cancelled');
}

/** Ekranda üstte gösterilecek plan: gecikmiş > aktif > en yakın planlı. */
export function primaryPlan(plans: ReturnPlan[], now: Date | number): ReturnPlan | null {
  const open = openPlans(plans);
  const overdue = open.filter((p) => isOverdue(p, now));
  if (overdue[0]) return overdue[0];
  const active = open.filter((p) => returnPlanStatus(p, now) === 'active');
  if (active[0]) return active[0];
  return [...open].sort((a, b) => a.expectedReturnAt.localeCompare(b.expectedReturnAt))[0] ?? null;
}

function formatLocalDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Acil kişilere gidecek gecikme metni. Kullanıcının adı, plan başlığı, rota ve
 * "son konum bilinmiyor" uyarısı içerir; SMS/bildirim gövdesi olarak kullanılır.
 */
export function overdueMessage(
  plan: ReturnPlan,
  user: Pick<User, 'displayName'>,
  locale = 'tr',
  lastKnownLocation: string | null = null,
): string {
  const expected = formatLocalDateTime(plan.expectedReturnAt, locale);
  const route = plan.route.trim() || (locale === 'tr' ? 'belirtilmedi' : 'not specified');
  const companions = plan.companions.trim();
  if (locale === 'tr') {
    const lines = [
      `${user.displayName} planlanan dönüş saatini (${expected}) ${plan.graceMin} dk tolerans dahil geçti ve hâlâ "döndüm" demedi.`,
      `Plan: ${plan.title}`,
      `Rota: ${route}`,
      companions ? `Yol arkadaşları: ${companions}` : null,
      lastKnownLocation
        ? `Son bilinen konum: ${lastKnownLocation}`
        : 'Son konum bilinmiyor — canlı konum paylaşımı yoktu.',
      'Lütfen ulaşmayı deneyin; ulaşamazsanız 112 / yerel kurtarma ile iletişime geçin.',
    ];
    return lines.filter(Boolean).join('\n');
  }
  const lines = [
    `${user.displayName} is past the planned return time (${expected}) including a ${plan.graceMin} min grace period and has not checked in.`,
    `Plan: ${plan.title}`,
    `Route: ${route}`,
    companions ? `Companions: ${companions}` : null,
    lastKnownLocation
      ? `Last known location: ${lastKnownLocation}`
      : 'Last location unknown — live location sharing was off.',
    'Please try to reach them; if you cannot, contact 112 / local rescue.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Yol planı formu doğrulaması; hata anahtarlarını döner (boşsa geçerli). */
export function validateReturnPlanInput(input: {
  title: string;
  startAt: string;
  expectedReturnAt: string;
  graceMin: number;
}): TranslationKey[] {
  const errors: TranslationKey[] = [];
  if (!input.title.trim()) errors.push('destinations.plan.errors.title');
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.expectedReturnAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    errors.push('destinations.plan.errors.returnAfterStart');
  }
  if (input.graceMin < 0 || input.graceMin > 24 * 60) errors.push('destinations.plan.errors.grace');
  return errors;
}
