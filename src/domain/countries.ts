import type { TranslationKey } from '@/core/i18n';

import { rescueCountryFlag } from './rescue';
import type { CountryChecklist, CountryGuide, ISODate, VisaInfo } from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

export const COUNTRIES_MODULE = 'countries';

/** Bölge anahtarları — i18n `countries.region.<key>` ile eşleşir. */
export const COUNTRY_REGIONS = [
  'europe',
  'caucasus',
  'central_asia',
  'south_asia',
  'east_asia',
  'southeast_asia',
  'middle_east',
  'africa',
  'north_america',
  'south_america',
  'oceania',
] as const;
export type CountryRegion = (typeof COUNTRY_REGIONS)[number];

const REGION_BY_CODE: Record<string, CountryRegion> = {
  FR: 'europe',
  CH: 'europe',
  IT: 'europe',
  AT: 'europe',
  DE: 'europe',
  NO: 'europe',
  IS: 'europe',
  GB: 'europe',
  ES: 'europe',
  GR: 'europe',
  RU: 'europe',
  SI: 'europe',
  PT: 'europe',
  SE: 'europe',
  FI: 'europe',
  PL: 'europe',
  SK: 'europe',
  ME: 'europe',
  AL: 'europe',
  BG: 'europe',
  GE: 'caucasus',
  AM: 'caucasus',
  AZ: 'caucasus',
  KZ: 'central_asia',
  KG: 'central_asia',
  UZ: 'central_asia',
  TJ: 'central_asia',
  MN: 'central_asia',
  NP: 'south_asia',
  IN: 'south_asia',
  PK: 'south_asia',
  BT: 'south_asia',
  LK: 'south_asia',
  JP: 'east_asia',
  KR: 'east_asia',
  CN: 'east_asia',
  TW: 'east_asia',
  TH: 'southeast_asia',
  ID: 'southeast_asia',
  VN: 'southeast_asia',
  MY: 'southeast_asia',
  PH: 'southeast_asia',
  LA: 'southeast_asia',
  IR: 'middle_east',
  AE: 'middle_east',
  OM: 'middle_east',
  JO: 'middle_east',
  SA: 'middle_east',
  TR: 'middle_east',
  TZ: 'africa',
  KE: 'africa',
  MA: 'africa',
  EG: 'africa',
  ZA: 'africa',
  ET: 'africa',
  UG: 'africa',
  NA: 'africa',
  US: 'north_america',
  CA: 'north_america',
  MX: 'north_america',
  CL: 'south_america',
  AR: 'south_america',
  PE: 'south_america',
  BO: 'south_america',
  BR: 'south_america',
  EC: 'south_america',
  CO: 'south_america',
  AU: 'oceania',
  NZ: 'oceania',
};

/** Vize başvurusu için güvenli tampon (işlem süresine eklenir). */
export const VISA_BUFFER_DAYS = 7;

/** Kontrol listesinde vize belgesinin anahtarı. */
export const VISA_DOCUMENT_KEY = 'visa';

export type VisaUrgency = 'ok' | 'soon' | 'late';

/** Seyahat tarihi hızlı seçimleri. */
export const TRIP_DATE_PRESETS = ['2w', '1m', '2m', '3m'] as const;
export type TripDatePreset = (typeof TRIP_DATE_PRESETS)[number];

const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Metin yardımcıları                                                  */
/* ------------------------------------------------------------------ */

/** Aksansız, küçük harf karşılaştırma (Türkçe ı/İ dahil). */
export function normalizeCountryText(value: string): string {
  return value
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Bayrak emojisi — kurtarma dizinindeki tanımı yeniden kullanır. */
export function COUNTRY_FLAG(code: string | null | undefined): string {
  return rescueCountryFlag(code);
}

/** Ülke kodunun bölgesi; bilinmeyen kod → `null`. */
export function regionOf(code: string | null | undefined): CountryRegion | null {
  if (!code) return null;
  return REGION_BY_CODE[code.toUpperCase()] ?? null;
}

/** Bölge i18n anahtarı. */
export function regionLabel(region: CountryRegion): TranslationKey {
  return `countries.region.${region}` as TranslationKey;
}

/** Vize türü i18n anahtarı. */
export function visaLabel(visa: Pick<VisaInfo, 'type'>, _locale = 'tr'): TranslationKey {
  return `countries.visa.${visa.type}` as TranslationKey;
}

/** Vize gerektiren türler (Türk pasaportu için önceden işlem gerekir). */
export function visaRequiresApplication(visa: Pick<VisaInfo, 'type'>): boolean {
  return visa.type === 'e_visa' || visa.type === 'embassy';
}

/* ------------------------------------------------------------------ */
/* Filtreleme ve sıralama                                              */
/* ------------------------------------------------------------------ */

/** Ad / bölge / ülke kodu ile aksansız arama; boş sorgu listeyi olduğu gibi döner. */
export function filterCountries<T extends Pick<CountryGuide, 'name' | 'region' | 'countryCode'>>(
  list: T[],
  query: string | null | undefined,
): T[] {
  const q = normalizeCountryText(query ?? '');
  if (!q) return list;
  return list.filter((c) => {
    const region = regionOf(c.countryCode);
    const hay = normalizeCountryText(
      `${c.name} ${c.region} ${c.countryCode} ${region ?? ''} ${regionNameTr(region)}`,
    );
    return hay.includes(q);
  });
}

/** Aramada bölge adının Türkçesi de eşleşsin diye küçük yedek tablo. */
function regionNameTr(region: CountryRegion | null): string {
  switch (region) {
    case 'europe':
      return 'avrupa';
    case 'caucasus':
      return 'kafkasya';
    case 'central_asia':
      return 'orta asya';
    case 'south_asia':
      return 'güney asya himalaya';
    case 'east_asia':
      return 'doğu asya';
    case 'southeast_asia':
      return 'güneydoğu asya';
    case 'middle_east':
      return 'orta doğu';
    case 'africa':
      return 'afrika';
    case 'north_america':
      return 'kuzey amerika';
    case 'south_america':
      return 'güney amerika';
    case 'oceania':
      return 'okyanusya';
    default:
      return '';
  }
}

/** Alfabetik (Türkçe) sıralama. */
export function sortAlphabetically<T extends Pick<CountryGuide, 'name'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/**
 * Önce kaydedilen destinasyonların ülkeleri (kayıt sayısına göre), sonra
 * kullanıcının bulunduğu ülke, kalanlar alfabetik.
 */
export function sortByRelevance<T extends Pick<CountryGuide, 'name' | 'countryCode'>>(
  list: T[],
  userCountry: string | null | undefined,
  destinations: { countryCode: string }[],
): T[] {
  const weight = new Map<string, number>();
  for (const d of destinations) {
    const code = d.countryCode.toUpperCase();
    weight.set(code, (weight.get(code) ?? 0) + 1);
  }
  const user = userCountry?.toUpperCase() ?? null;
  const score = (code: string): number => {
    const saved = weight.get(code) ?? 0;
    if (saved > 0) return 1000 + saved;
    if (user && code === user) return 500;
    return 0;
  };
  return [...list].sort((a, b) => {
    const diff = score(b.countryCode) - score(a.countryCode);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'tr');
  });
}

/** Listedeki ülke kodlarından destinasyonu olanları döner (kaydedilen ülke kartları için). */
export function countriesOfDestinations<T extends Pick<CountryGuide, 'countryCode'>>(
  list: T[],
  destinations: { countryCode: string }[],
): T[] {
  const codes = new Set(destinations.map((d) => d.countryCode.toUpperCase()));
  return list.filter((c) => codes.has(c.countryCode.toUpperCase()));
}

/* ------------------------------------------------------------------ */
/* Kontrol listesi                                                     */
/* ------------------------------------------------------------------ */

export interface ChecklistProgress {
  required: { done: number; total: number };
  optional: { done: number; total: number };
  /** 0..1 — tüm belgeler */
  ratio: number;
  /** Zorunlu belgelerin tamamı işaretli mi */
  requiredComplete: boolean;
}

/** Zorunlu / isteğe bağlı belge ilerlemesi. */
export function checklistProgress(
  guide: Pick<CountryGuide, 'documents'>,
  checklist: Pick<CountryChecklist, 'done'> | null | undefined,
): ChecklistProgress {
  const done = new Set(checklist?.done ?? []);
  const required = { done: 0, total: 0 };
  const optional = { done: 0, total: 0 };
  for (const doc of guide.documents) {
    const bucket = doc.required ? required : optional;
    bucket.total += 1;
    if (done.has(doc.key)) bucket.done += 1;
  }
  const total = required.total + optional.total;
  const ratio = total === 0 ? 0 : (required.done + optional.done) / total;
  return { required, optional, ratio, requiredComplete: required.done === required.total };
}

/** Tam gün farkı (yukarı yuvarlar): `target - now`. */
export function daysBetween(now: Date | number | string, target: Date | number | string): number {
  const a = new Date(now).getTime();
  const b = new Date(target).getTime();
  return Math.ceil((b - a) / DAY_MS);
}

/** Hızlı seçim → ISO tarih (gün başına yuvarlanmış UTC). */
export function tripDateFromPreset(preset: TripDatePreset, now: Date | number): ISODate {
  const d = new Date(now);
  d.setUTCHours(12, 0, 0, 0);
  switch (preset) {
    case '2w':
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case '1m':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case '2m':
      d.setUTCMonth(d.getUTCMonth() + 2);
      break;
    case '3m':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
  }
  return d.toISOString();
}

export interface DocumentsDue {
  /** Seyahate kalan gün; tarih yoksa `null` */
  daysLeft: number | null;
  /** Vize başvurusuna hemen başlanmalı mı */
  applyNow: boolean;
  /** Vize alınmışsa (kontrol listesinde işaretli) */
  visaDone: boolean;
  /** Vize başvurusu için son güvenli gün (ISO) — vize gerekmiyorsa `null` */
  applyBy: ISODate | null;
  /** Henüz işaretlenmemiş zorunlu belgeler */
  missingRequired: CountryGuide['documents'];
  urgency: VisaUrgency;
}

/**
 * Seyahat tarihine göre belge durumu.
 * `now + processingDays + 7 gün > tripDate` → "vizeye şimdi başvur".
 * `now + processingDays > tripDate` → geç kalınmış olabilir.
 */
export function documentsDue(
  guide: Pick<CountryGuide, 'visa' | 'documents'>,
  checklist: Pick<CountryChecklist, 'done' | 'tripDate'> | null | undefined,
  now: Date | number,
): DocumentsDue {
  const done = new Set(checklist?.done ?? []);
  const missingRequired = guide.documents.filter((d) => d.required && !done.has(d.key));
  const tripDate = checklist?.tripDate ?? null;
  const daysLeft = tripDate ? daysBetween(now, tripDate) : null;
  const visaDone = done.has(VISA_DOCUMENT_KEY);
  const needsVisa = visaRequiresApplication(guide.visa);
  const processing = guide.visa.processingDays ?? 0;

  let applyBy: ISODate | null = null;
  if (needsVisa && tripDate) {
    applyBy = new Date(
      new Date(tripDate).getTime() - (processing + VISA_BUFFER_DAYS) * DAY_MS,
    ).toISOString();
  }

  const urgency = visaUrgency(guide, checklist, now);
  const applyNow = urgency !== 'ok' && !visaDone && needsVisa;
  return { daysLeft, applyNow, visaDone, applyBy, missingRequired, urgency };
}

/**
 * Vize aciliyeti:
 * - vize gerekmiyor, tarih yok ya da vize işaretli → 'ok'
 * - `now + processingDays > tripDate` → 'late'
 * - `now + processingDays + 7 > tripDate` → 'soon'
 */
export function visaUrgency(
  guide: Pick<CountryGuide, 'visa'>,
  checklist: Pick<CountryChecklist, 'done' | 'tripDate'> | null | undefined,
  now: Date | number,
): VisaUrgency {
  if (!checklist?.tripDate) return 'ok';
  if (!visaRequiresApplication(guide.visa)) return 'ok';
  if (checklist.done.includes(VISA_DOCUMENT_KEY)) return 'ok';
  const processing = guide.visa.processingDays ?? 0;
  const nowMs = new Date(now).getTime();
  const tripMs = new Date(checklist.tripDate).getTime();
  if (nowMs + processing * DAY_MS > tripMs) return 'late';
  if (nowMs + (processing + VISA_BUFFER_DAYS) * DAY_MS > tripMs) return 'soon';
  return 'ok';
}

/** Vize adımları — numaralı yol haritası (checklist ekranı). */
export function visaSteps(guide: Pick<CountryGuide, 'visa'>): TranslationKey[] {
  switch (guide.visa.type) {
    case 'visa_free':
      return [
        'countries.steps.passportValidity',
        'countries.steps.returnTicket',
        'countries.steps.insurance',
        'countries.steps.entryStamp',
      ] as TranslationKey[];
    case 'on_arrival':
      return [
        'countries.steps.passportValidity',
        'countries.steps.photosCash',
        'countries.steps.arrivalForm',
        'countries.steps.insurance',
        'countries.steps.entryStamp',
      ] as TranslationKey[];
    case 'e_visa':
      return [
        'countries.steps.passportValidity',
        'countries.steps.officialPortal',
        'countries.steps.uploadDocs',
        'countries.steps.payFee',
        'countries.steps.printApproval',
        'countries.steps.insurance',
      ] as TranslationKey[];
    case 'embassy':
      return [
        'countries.steps.passportValidity',
        'countries.steps.appointment',
        'countries.steps.gatherDocs',
        'countries.steps.biometrics',
        'countries.steps.waitDecision',
        'countries.steps.insurance',
      ] as TranslationKey[];
    case 'banned':
      return ['countries.steps.contactMinistry'] as TranslationKey[];
    default:
      return [];
  }
}

/** Ay numaralarından kısa Türkçe/İngilizce ay etiketi listesi ("Mar, Nis, May"). */
export function bestMonthsLabel(months: number[], locale = 'tr'): string {
  const tr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const names = locale === 'tr' ? tr : en;
  return [...months]
    .sort((a, b) => a - b)
    .map((m) => names[m - 1] ?? String(m))
    .join(', ');
}

/** Alan adını URL'den çıkarır (kaynak listesi görünümü). */
export function sourceHost(url: string): string {
  const match = /^https?:\/\/([^/]+)/i.exec(url);
  return match?.[1]?.replace(/^www\./, '') ?? url;
}
