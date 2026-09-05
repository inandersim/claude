/**
 * inventory modülü saf iş mantığı — birim envanteri, müsaitlik takvimi,
 * dinamik gecelik fiyat, emanet (escrow) ödeme makinesi, iptal politikaları,
 * ev sahibi güven skoru ve ödeme özetleri.
 *
 * Tüm tarih hesapları UTC gün anahtarı ("YYYY-MM-DD") üzerinden yapılır;
 * böylece cihaz saat dilimi sonucu değiştirmez.
 */
import type { CancellationPolicy, HostVerificationLevel, PaymentStatus } from './enums';
import type {
  Availability,
  HostProfile,
  ID,
  ISODate,
  Payment,
  Quote,
  QuoteInput,
  RefundPreview,
  StayBooking,
  StayReview,
  StayUnit,
  UnitBlock,
} from './types';

export const INVENTORY_MODULE = 'inventory';

/** Misafirden alınan platform ücreti oranı */
export const PLATFORM_FEE_PCT = 0.08;
/** Ön ödeme (depozito) oranı — toplamın yüzdesi */
export const DEPOSIT_PCT = 0.2;
/** Yorum yazma penceresi (çıkıştan sonra gün) */
export const REVIEW_WINDOW_DAYS = 30;
/** Emanet serbest bırakma gecikmesi (girişten sonra saat) */
export const RELEASE_AFTER_HOURS = 24;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------ */
/* Ek tipler                                                            */
/* ------------------------------------------------------------------ */

export type PaymentEvent = 'authorize' | 'capture' | 'release' | 'refund' | 'fail';

export interface PaymentStep {
  status: PaymentStatus;
  at: ISODate | null;
  state: 'done' | 'current' | 'upcoming';
}

export interface PayoutSummary {
  /** Emanette bekleyen net tutar (komisyon düşülmüş) */
  pendingTry: number;
  /** İşletmeye aktarılmış net tutar */
  paidTry: number;
  /** Platform komisyonu (bekleyen + ödenen üzerinden) */
  commissionTry: number;
  /** İade edilen brüt tutar */
  refundedTry: number;
  count: number;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export type TrustLabel = 'low' | 'good' | 'excellent' | 'superhost';

/** Rezervasyon girdisi; ödeme sağlayıcı seçimi demo amaçlıdır. */
export interface BookStayInput extends QuoteInput {
  provider?: 'iyzico' | 'card';
}

/* ------------------------------------------------------------------ */
/* Takvim                                                              */
/* ------------------------------------------------------------------ */

/** ISO tarih ya da gün anahtarını "YYYY-MM-DD" biçimine indirger. */
export function toDayKey(iso: ISODate): string {
  return iso.slice(0, 10);
}

/** Gün anahtarını UTC gece yarısı epoch milisaniyesine çevirir. */
export function dayToMs(key: string): number {
  const [y, m, d] = toDayKey(key).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Epoch milisaniyesini gün anahtarına çevirir. */
export function msToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Gün anahtarına n gün ekler. */
export function addDays(key: string, n: number): string {
  return msToDay(dayToMs(key) + n * DAY_MS);
}

/** İki gün anahtarı arasındaki gece sayısı (checkOut − checkIn). */
export function nightsBetweenDays(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((dayToMs(checkOut) - dayToMs(checkIn)) / DAY_MS);
}

/** Giriş (dahil) ile çıkış (hariç) arasındaki her gece için gün anahtarı listesi. */
export function eachNight(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const start = dayToMs(checkIn);
  const end = dayToMs(checkOut);
  const out: ISODate[] = [];
  for (let ms = start; ms < end; ms += DAY_MS) out.push(msToDay(ms));
  return out;
}

/** Cuma (5) ve Cumartesi (6) geceleri hafta sonu sayılır. */
export function isWeekendNight(date: ISODate): boolean {
  const dow = new Date(dayToMs(date)).getUTCDay();
  return dow === 5 || dow === 6;
}

/** Tarihin denk geldiği sezon çarpanı (aralıklar dahil sınırlı); yoksa 1. */
export function seasonMultiplier(unit: Pick<StayUnit, 'seasons'>, date: ISODate): number {
  const key = toDayKey(date);
  for (const s of unit.seasons) {
    if (key >= toDayKey(s.from) && key <= toDayKey(s.to)) return s.multiplier;
  }
  return 1;
}

/** Bir gecenin fiyatı: taban × hafta sonu çarpanı × sezon çarpanı (tam sayıya yuvarlanır). */
export function nightlyPrice(
  unit: Pick<StayUnit, 'basePriceTry' | 'weekendMultiplier' | 'seasons'>,
  date: ISODate,
): number {
  const weekend = isWeekendNight(date) ? unit.weekendMultiplier : 1;
  return Math.round(unit.basePriceTry * weekend * seasonMultiplier(unit, date));
}

/** Yarı açık aralıklar [from, to) kesişiyor mu? */
export function overlaps(a: DateRange, b: DateRange): boolean {
  return toDayKey(a.from) < toDayKey(b.to) && toDayKey(b.from) < toDayKey(a.to);
}

/** Verilen gecede birimi kaç blok kapatıyor? */
function blockedCount(unitId: ID, blocks: UnitBlock[], night: ISODate): number {
  const range = { from: night, to: addDays(night, 1) };
  return blocks.filter((b) => b.unitId === unitId && overlaps(b, range)).length;
}

/** Aralıktaki her gece için kalan adet ve fiyat (adet − çakışan bloklar). */
export function availabilityFor(
  unit: StayUnit,
  blocks: UnitBlock[],
  from: ISODate,
  to: ISODate,
): Availability[] {
  return eachNight(from, to).map((date) => ({
    unitId: unit.id,
    date,
    available: Math.max(0, unit.quantity - blockedCount(unit.id, blocks, date)),
    priceTry: nightlyPrice(unit, date),
  }));
}

/** Aralığın her gecesinde en az bir birim boş mu? */
export function isAvailable(
  unit: StayUnit,
  blocks: UnitBlock[],
  from: ISODate,
  to: ISODate,
): boolean {
  const nights = availabilityFor(unit, blocks, from, to);
  return nights.length > 0 && nights.every((n) => n.available > 0);
}

/* ------------------------------------------------------------------ */
/* Teklif                                                               */
/* ------------------------------------------------------------------ */

/** Gecelik kırılım, platform ücreti, toplam ve depozito içeren teklif. */
export function buildQuote(
  unit: StayUnit,
  blocks: UnitBlock[],
  policy: CancellationPolicy,
  input: Pick<QuoteInput, 'checkIn' | 'checkOut' | 'guests'>,
  feePct = PLATFORM_FEE_PCT,
): Quote {
  const nights = availabilityFor(unit, blocks, input.checkIn, input.checkOut);
  const nightly = nights.map((n) => ({ date: n.date, priceTry: n.priceTry }));
  const subtotalTry = nightly.reduce((sum, n) => sum + n.priceTry, 0);
  const platformFeeTry = Math.round(subtotalTry * feePct);
  const totalTry = subtotalTry + platformFeeTry;
  const available =
    nights.length > 0 &&
    nights.every((n) => n.available > 0) &&
    input.guests >= 1 &&
    input.guests <= unit.capacity;
  return {
    nights: nights.length,
    nightly,
    subtotalTry,
    platformFeeTry,
    totalTry,
    depositTry: Math.round(totalTry * DEPOSIT_PCT),
    policy,
    available,
  };
}

/* ------------------------------------------------------------------ */
/* Ödeme makinesi                                                       */
/* ------------------------------------------------------------------ */

const PAYMENT_TRANSITIONS: Record<PaymentStatus, Partial<Record<PaymentEvent, PaymentStatus>>> = {
  pending: { authorize: 'authorized', fail: 'failed' },
  authorized: { capture: 'escrow', refund: 'refunded', fail: 'failed' },
  escrow: { release: 'released', refund: 'refunded' },
  released: {},
  refunded: {},
  failed: {},
};

/** Bir ödeme olayının geçerli olup olmadığını söyler. */
export function canTransition(current: PaymentStatus, event: PaymentEvent): boolean {
  return PAYMENT_TRANSITIONS[current][event] !== undefined;
}

/** Ödeme durumunu ilerletir; geçersiz geçişte hata fırlatır. */
export function nextPaymentStatus(current: PaymentStatus, event: PaymentEvent): PaymentStatus {
  const next = PAYMENT_TRANSITIONS[current][event];
  if (!next) {
    throw new Error(`Geçersiz ödeme geçişi: ${current} → ${event}`);
  }
  return next;
}

/** Ödemeye olay uygular: durum + zaman çizelgesi (releasedAt/refundedTry dahil). */
export function applyPaymentEvent(
  payment: Payment,
  event: PaymentEvent,
  at: ISODate,
  refundTry = 0,
): Payment {
  const status = nextPaymentStatus(payment.status, event);
  return {
    ...payment,
    status,
    releasedAt: status === 'released' ? at : payment.releasedAt,
    refundedTry: status === 'refunded' ? refundTry : payment.refundedTry,
    timeline: [...payment.timeline, { status, at }],
  };
}

/**
 * Dikey adım çubuğu için ödeme yolculuğu: authorized → escrow → released.
 * İade/başarısızlıkta ulaşılmış adımlar + olumsuz son adım gösterilir.
 */
export function paymentTimeline(payment: Pick<Payment, 'status' | 'timeline'>): PaymentStep[] {
  const negative = payment.status === 'refunded' || payment.status === 'failed';
  const reached = (s: PaymentStatus) => payment.timeline.find((e) => e.status === s) ?? null;
  const path: PaymentStatus[] = negative
    ? [...(['authorized', 'escrow'] as const).filter((s) => reached(s) !== null), payment.status]
    : ['authorized', 'escrow', 'released'];
  return path.map((status) => {
    const hit = reached(status);
    if (status === payment.status) return { status, at: hit?.at ?? null, state: 'current' };
    if (hit) return { status, at: hit.at, state: 'done' };
    return { status, at: null, state: 'upcoming' };
  });
}

/* ------------------------------------------------------------------ */
/* İptal & yorum kuralları                                              */
/* ------------------------------------------------------------------ */

function toMs(iso: ISODate | number | Date): number {
  if (typeof iso === 'number') return iso;
  if (iso instanceof Date) return iso.getTime();
  return new Date(iso).getTime();
}

/**
 * Politikaya göre iade tutarı.
 * flexible: girişe 24 sa kalana kadar %100, sonra %0
 * moderate: 5 gün öncesine kadar %100, sonra %50
 * strict:   14 gün öncesine kadar %50, sonra %0
 * Giriş saati geçtiyse her politikada %0.
 */
export function refundAmount(
  policy: CancellationPolicy,
  checkIn: ISODate,
  now: ISODate | number | Date,
  totalTry: number,
): RefundPreview {
  const hoursLeft = (toMs(checkIn) - toMs(now)) / HOUR_MS;
  const daysLeft = hoursLeft / 24;
  let pct = 0;
  let reason = 'inventory.refund.reason.afterCheckIn';
  if (hoursLeft > 0) {
    switch (policy) {
      case 'flexible':
        pct = hoursLeft >= 24 ? 1 : 0;
        reason =
          pct === 1
            ? 'inventory.refund.reason.flexibleFull'
            : 'inventory.refund.reason.flexibleLate';
        break;
      case 'moderate':
        pct = daysLeft >= 5 ? 1 : 0.5;
        reason =
          pct === 1
            ? 'inventory.refund.reason.moderateFull'
            : 'inventory.refund.reason.moderateHalf';
        break;
      case 'strict':
        pct = daysLeft >= 14 ? 0.5 : 0;
        reason =
          pct === 0.5 ? 'inventory.refund.reason.strictHalf' : 'inventory.refund.reason.strictNone';
        break;
    }
  }
  const refundTry = Math.round(totalTry * pct);
  return { refundTry, keptTry: totalTry - refundTry, reason };
}

/** Rezervasyon giriş saatinden önce ve aktifse iptal edilebilir. */
export function canCancel(
  booking: Pick<StayBooking, 'status' | 'checkIn'>,
  now: ISODate | number | Date,
): boolean {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  return toMs(now) < toMs(booking.checkIn);
}

/** Yalnızca tamamlanmış konaklama ve çıkıştan sonra 30 gün içinde yorum yazılabilir. */
export function canReview(
  booking: Pick<StayBooking, 'status' | 'checkOut'>,
  now: ISODate | number | Date,
): boolean {
  if (booking.status !== 'completed') return false;
  const daysSince = (toMs(now) - toMs(booking.checkOut)) / DAY_MS;
  return daysSince <= REVIEW_WINDOW_DAYS;
}

/** Girişten 24 saat sonra emanet işletmeye aktarılmalı. */
export function releaseDue(
  booking: Pick<StayBooking, 'status' | 'checkIn'>,
  now: ISODate | number | Date,
): boolean {
  if (booking.status !== 'confirmed' && booking.status !== 'completed') return false;
  return toMs(now) >= toMs(booking.checkIn) + RELEASE_AFTER_HOURS * HOUR_MS;
}

/* ------------------------------------------------------------------ */
/* Güven                                                                */
/* ------------------------------------------------------------------ */

const VERIFICATION_POINTS: Record<HostVerificationLevel, number> = {
  none: 0,
  id: 15,
  address: 25,
  premium: 35,
};

/** Doğrulama seviyesi sırası (yükseltme kontrolü için). */
export const VERIFICATION_RANK: Record<HostVerificationLevel, number> = {
  none: 0,
  id: 1,
  address: 2,
  premium: 3,
};

/**
 * 0..100 ev sahibi güven skoru:
 * doğrulama (≤35) + yanıt oranı (≤25) + yorum ortalaması (≤25) + doğrulanmış yorum oranı (≤15).
 */
export function hostTrustScore(
  profile: Pick<HostProfile, 'verification' | 'responseRatePct'>,
  reviews: Pick<StayReview, 'rating' | 'verifiedStay'>[],
): number {
  const verification = VERIFICATION_POINTS[profile.verification];
  const response = Math.max(0, Math.min(100, profile.responseRatePct)) * 0.25;
  let ratingPts = 0;
  let verifiedPts = 0;
  if (reviews.length > 0) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    ratingPts = (Math.max(0, Math.min(5, avg)) / 5) * 25;
    verifiedPts = (reviews.filter((r) => r.verifiedStay).length / reviews.length) * 15;
  }
  return Math.round(Math.max(0, Math.min(100, verification + response + ratingPts + verifiedPts)));
}

/** Skorun etiketi (i18n: inventory.trust.<label>). */
export function trustLabel(score: number): TrustLabel {
  if (score >= 90) return 'superhost';
  if (score >= 70) return 'excellent';
  if (score >= 40) return 'good';
  return 'low';
}

/** Yorum ortalaması (yorum yoksa 0). */
export function averageRating(reviews: Pick<StayReview, 'rating'>[]): number {
  if (reviews.length === 0) return 0;
  return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Ödemeler                                                             */
/* ------------------------------------------------------------------ */

/** İşletmenin rezervasyonlarına ait ödemelerden bekleyen/ödenen/komisyon özeti. */
export function payoutSummary(
  bookings: Pick<StayBooking, 'id'>[],
  payments: Pick<
    Payment,
    'bookingId' | 'amountTry' | 'platformFeeTry' | 'status' | 'refundedTry'
  >[],
): PayoutSummary {
  const ids = new Set(bookings.map((b) => b.id));
  const summary: PayoutSummary = {
    pendingTry: 0,
    paidTry: 0,
    commissionTry: 0,
    refundedTry: 0,
    count: 0,
  };
  for (const p of payments) {
    if (!ids.has(p.bookingId)) continue;
    summary.count += 1;
    const net = p.amountTry - p.platformFeeTry;
    if (p.status === 'escrow' || p.status === 'authorized') {
      summary.pendingTry += net;
      summary.commissionTry += p.platformFeeTry;
    } else if (p.status === 'released') {
      summary.paidTry += net;
      summary.commissionTry += p.platformFeeTry;
    } else if (p.status === 'refunded') {
      summary.refundedTry += p.refundedTry;
      // Kısmi iadede kalan tutar işletmeye aktarılır
      const kept = p.amountTry - p.refundedTry;
      if (kept > 0) {
        const fee = Math.min(p.platformFeeTry, kept);
        summary.paidTry += kept - fee;
        summary.commissionTry += fee;
      }
    }
  }
  return summary;
}
