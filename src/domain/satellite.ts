import type { TranslationKey } from '@/core/i18n';

import { SOS_STAGES } from './enums';
import type { LinkType, SatDeviceType, SatMessageKind, SosStage } from './enums';
import { distanceKm } from './geo';
import type {
  EmergencyContact,
  GeoPoint,
  SatDevice,
  SatMessage,
  SendSatMessageInput,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Uydu mesajı üst sınırı (SBD / SMS uyumlu tek segment) */
export const SAT_MESSAGE_MAX_LEN = 160;
/** Bu sayıdan sonra mesaj kalıcı olarak başarısız sayılır */
export const SAT_MAX_ATTEMPTS = 5;
/** Hücresel sinyal bu eşiğin altındaysa güvenilmez sayılır (0..100) */
export const CELLULAR_MIN_SIGNAL = 15;
/** Uydu bağlantısı için görüşteki en az uydu sayısı */
export const SATELLITE_MIN_IN_VIEW = 1;

/** Cihaz türü meta verisi: ikon, etiket, kredi başı ücret ve kota dışı fiyat (₺) */
export const SAT_DEVICE_META: Record<
  SatDeviceType,
  { labelKey: TranslationKey; icon: string; overQuotaPriceTry: number; network: string }
> = {
  inreach: {
    labelKey: 'satellite.deviceType.inreach',
    icon: 'satellite',
    overQuotaPriceTry: 18,
    network: 'Iridium',
  },
  zoleo: {
    labelKey: 'satellite.deviceType.zoleo',
    icon: 'radio',
    overQuotaPriceTry: 15,
    network: 'Iridium',
  },
  spot: {
    labelKey: 'satellite.deviceType.spot',
    icon: 'radio-tower',
    overQuotaPriceTry: 12,
    network: 'Globalstar',
  },
  phone_satellite: {
    labelKey: 'satellite.deviceType.phone_satellite',
    icon: 'phone',
    overQuotaPriceTry: 0,
    network: 'Globalstar / Skylo',
  },
  starlink_mini: {
    labelKey: 'satellite.deviceType.starlink_mini',
    icon: 'satellite-dish',
    overQuotaPriceTry: 0,
    network: 'Starlink',
  },
};

export const LINK_META: Record<LinkType, { labelKey: TranslationKey; icon: string }> = {
  cellular: { labelKey: 'satellite.link.cellular', icon: 'signal' },
  wifi: { labelKey: 'satellite.link.wifi', icon: 'wifi' },
  satellite: { labelKey: 'satellite.link.satellite', icon: 'satellite' },
  none: { labelKey: 'satellite.link.none', icon: 'wifi-off' },
};

export const SAT_KIND_META: Record<SatMessageKind, { labelKey: TranslationKey; icon: string }> = {
  checkin: { labelKey: 'satellite.kind.checkin', icon: 'circle-check' },
  text: { labelKey: 'satellite.kind.text', icon: 'message-circle' },
  sos: { labelKey: 'satellite.kind.sos', icon: 'siren' },
  location: { labelKey: 'satellite.kind.location', icon: 'map-pin' },
};

/* ------------------------------------------------------------------ */
/* Bağlantı katmanı seçimi                                             */
/* ------------------------------------------------------------------ */

export interface LinkProbe {
  /** Hücresel sinyal 0..100 */
  cellular: number;
  wifi: boolean;
  /** Görüşteki uydu sayısı */
  satellite: number;
}

/** Öncelik: hücresel → wifi → uydu → yok. Eşikler sabitlerde. */
export function chooseLink(status: LinkProbe): LinkType {
  if (status.cellular >= CELLULAR_MIN_SIGNAL) return 'cellular';
  if (status.wifi) return 'wifi';
  if (status.satellite >= SATELLITE_MIN_IN_VIEW) return 'satellite';
  return 'none';
}

/** Sinyal gücünü 0..4 çubuğa çevirir. */
export function signalBars(signal: number): 0 | 1 | 2 | 3 | 4 {
  if (signal <= 0) return 0;
  if (signal < 25) return 1;
  if (signal < 50) return 2;
  if (signal < 75) return 3;
  return 4;
}

/* ------------------------------------------------------------------ */
/* Mesaj kodlama / sıkıştırma                                          */
/* ------------------------------------------------------------------ */

const KIND_CODES: Record<SatMessageKind, string> = {
  checkin: 'C',
  text: 'T',
  sos: 'S',
  location: 'L',
};
const CODE_KINDS: Record<string, SatMessageKind> = Object.fromEntries(
  Object.entries(KIND_CODES).map(([k, v]) => [v, k as SatMessageKind]),
);

/**
 * Sık kullanılan Türkçe kelimeler → kısa kod. Anahtarlar sadeleştirilmiş (ASCII, küçük harf),
 * değerler Türkçe karakterli orijinal kelime ile geri açılır.
 */
export const SAT_DICTIONARY: Record<string, { code: string; word: string }> = {
  konum: { code: 'kn', word: 'konum' },
  konumum: { code: 'knm', word: 'konumum' },
  guvendeyim: { code: 'gv', word: 'güvendeyim' },
  iyiyim: { code: 'iy', word: 'iyiyim' },
  yardim: { code: 'yd', word: 'yardım' },
  gecikiyorum: { code: 'gc', word: 'gecikiyorum' },
  kamp: { code: 'kp', word: 'kamp' },
  kamptayim: { code: 'kpt', word: 'kamptayım' },
  zirve: { code: 'zv', word: 'zirve' },
  zirvedeyim: { code: 'zvd', word: 'zirvedeyim' },
  hava: { code: 'hv', word: 'hava' },
  donuyorum: { code: 'dn', word: 'dönüyorum' },
  yarali: { code: 'yl', word: 'yaralı' },
  acil: { code: 'ac', word: 'acil' },
  lutfen: { code: 'lt', word: 'lütfen' },
  ihtiyacim: { code: 'ih', word: 'ihtiyacım' },
  bugun: { code: 'bg', word: 'bugün' },
  yarin: { code: 'yr', word: 'yarın' },
  aksam: { code: 'aks', word: 'akşam' },
  sabah: { code: 'sbh', word: 'sabah' },
  alinmam: { code: 'alm', word: 'alınmam' },
  gerek: { code: 'grk', word: 'gerek' },
  plan: { code: 'pl', word: 'plan' },
  devam: { code: 'dv', word: 'devam' },
  saat: { code: 'st', word: 'saat' },
  rota: { code: 'rt', word: 'rota' },
  firtina: { code: 'frt', word: 'fırtına' },
  telefon: { code: 'tlf', word: 'telefon' },
  pil: { code: 'pl2', word: 'pil' },
  dusuk: { code: 'dsk', word: 'düşük' },
};

const CODE_WORDS: Record<string, string> = Object.fromEntries(
  Object.values(SAT_DICTIONARY).map(({ code, word }) => [code, word]),
);

const TR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  I: 'I',
  İ: 'I',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
};

/** Türkçe karakterleri ASCII karşılığına indirger (GSM-7 uyumu). */
export function simplifyTurkish(text: string): string {
  return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_MAP[ch] ?? ch);
}

/** Boşlukları sıkıştırır, Türkçe karakterleri sadeleştirir ve sözlükteki kelimeleri kısaltır. */
export function compressText(text: string): string {
  const simplified = simplifyTurkish(text).replace(/\s+/g, ' ').replace(/;/g, ',').trim();
  return simplified.replace(/[A-Za-z]+/g, (w) => {
    const entry = SAT_DICTIONARY[w.toLowerCase()];
    return entry ? entry.code : w;
  });
}

/** compressText'in tersi: kodları Türkçe kelimelere açar. */
export function decompressText(text: string): string {
  return text.replace(/[A-Za-z0-9]+/g, (w) => CODE_WORDS[w] ?? w);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Mesajı ≤160 karakterlik dar bant biçimine kodlar:
 * `k:<C|T|S|L>;t:HHMM;g:<lat>,<lon>;m:<sıkıştırılmış metin>`
 * Konum yoksa `g:` atlanır, metin boşsa `m:` atlanır. Fazla metin kırpılır.
 */
export function encodeSatMessage(input: SendSatMessageInput, now: Date): string {
  const parts = [
    `k:${KIND_CODES[input.kind]}`,
    `t:${pad2(now.getHours())}${pad2(now.getMinutes())}`,
  ];
  if (input.coords) {
    parts.push(`g:${input.coords.latitude.toFixed(5)},${input.coords.longitude.toFixed(5)}`);
  }
  const head = parts.join(';');
  const text = compressText(input.body);
  if (!text) return head.slice(0, SAT_MESSAGE_MAX_LEN);
  const budget = SAT_MESSAGE_MAX_LEN - head.length - ';m:'.length;
  if (budget <= 0) return head.slice(0, SAT_MESSAGE_MAX_LEN);
  return `${head};m:${text.slice(0, budget)}`;
}

export interface DecodedSatMessage {
  kind: SatMessageKind;
  /** HH:MM ya da null */
  time: string | null;
  coords: GeoPoint | null;
  text: string;
}

/** encodeSatMessage çıktısını çözer; biçim tanınmazsa tamamı serbest metin sayılır. */
export function decodeSatMessage(body: string): DecodedSatMessage {
  if (!/^k:[CTSL](;|$)/.test(body)) {
    return { kind: 'text', time: null, coords: null, text: decompressText(body) };
  }
  const mIndex = body.indexOf(';m:');
  const head = mIndex >= 0 ? body.slice(0, mIndex) : body;
  const text = mIndex >= 0 ? decompressText(body.slice(mIndex + 3)) : '';
  let kind: SatMessageKind = 'text';
  let time: string | null = null;
  let coords: GeoPoint | null = null;
  for (const seg of head.split(';')) {
    const [key, value] = [seg.slice(0, 1), seg.slice(2)];
    if (key === 'k') kind = CODE_KINDS[value] ?? 'text';
    else if (key === 't' && /^\d{4}$/.test(value)) time = `${value.slice(0, 2)}:${value.slice(2)}`;
    else if (key === 'g') {
      const [lat, lon] = value.split(',').map(Number);
      if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
        coords = { latitude: lat, longitude: lon };
      }
    }
  }
  return { kind, time, coords, text };
}

export interface MessageCost {
  /** Harcanacak mesaj kredisi (segment sayısı) */
  credits: number;
  /** Kota dışına taşan kısmın ücreti (₺) */
  priceTry: number;
  overQuota: boolean;
}

/** Kodlanmış gövdeye ve cihaz kotasına göre maliyet tahmini. */
export function messageCostEstimate(body: string, device: SatDevice | null): MessageCost {
  const credits = Math.max(1, Math.ceil(body.length / SAT_MESSAGE_MAX_LEN));
  if (!device || device.monthlyQuota <= 0) return { credits, priceTry: 0, overQuota: false };
  const overflow = Math.max(0, device.usedThisMonth + credits - device.monthlyQuota);
  const price = SAT_DEVICE_META[device.type].overQuotaPriceTry;
  return { credits, priceTry: overflow * price, overQuota: overflow > 0 };
}

/* ------------------------------------------------------------------ */
/* Sakla-ilet kuyruğu                                                  */
/* ------------------------------------------------------------------ */

export type QueueDecision = 'send' | 'wait' | 'fail';

const KIND_PRIORITY: Record<SatMessageKind, number> = { sos: 0, checkin: 1, location: 2, text: 3 };

/**
 * Kuyruk kararı: 5 denemeden sonra `fail`; bağlantı yoksa `wait`;
 * uyduda öncelikli türler (sos/checkin/location) hemen gider, serbest metin ilk turda bekler
 * ve bir sonraki flush'ta gönderilir.
 */
export function queuePolicy(
  message: Pick<SatMessage, 'kind'>,
  link: LinkType,
  attempts: number,
): QueueDecision {
  if (attempts >= SAT_MAX_ATTEMPTS) return 'fail';
  if (link === 'none') return 'wait';
  if (link === 'satellite' && message.kind === 'text' && attempts === 0) return 'wait';
  return 'send';
}

/** Üstel geri çekilme: 15, 30, 60, 120, 240 sn; üst sınır 300 sn. */
export function nextRetryDelayS(attempts: number): number {
  return Math.min(300, 15 * 2 ** Math.max(0, attempts));
}

/** sos > checkin > location > text; aynı türde eski → yeni. */
export function prioritize<T extends Pick<SatMessage, 'kind' | 'createdAt'>>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const p = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    return p !== 0 ? p : a.createdAt.localeCompare(b.createdAt);
  });
}

export interface QueueSummary {
  queued: number;
  failed: number;
  sent: number;
  delivered: number;
}

export function summarizeQueue(messages: Pick<SatMessage, 'status'>[]): QueueSummary {
  const s: QueueSummary = { queued: 0, failed: 0, sent: 0, delivered: 0 };
  for (const m of messages) {
    if (m.status === 'queued' || m.status === 'sending') s.queued += 1;
    else if (m.status === 'failed') s.failed += 1;
    else if (m.status === 'sent') s.sent += 1;
    else if (m.status === 'delivered') s.delivered += 1;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* SOS aşama makinesi                                                  */
/* ------------------------------------------------------------------ */

/** idle→armed→sent→acknowledged→dispatched→resolved; resolved sabit kalır. */
export function advanceSosStage(stage: SosStage): SosStage {
  const i = SOS_STAGES.indexOf(stage);
  return SOS_STAGES[Math.min(i + 1, SOS_STAGES.length - 1)] ?? 'resolved';
}

export function isSosActive(stage: SosStage): boolean {
  return stage !== 'idle' && stage !== 'resolved';
}

const STAGE_NOTES: Record<SosStage, { tr: string; en: string }> = {
  idle: { tr: 'SOS hazır', en: 'SOS ready' },
  armed: { tr: 'SOS kuruldu, konum alındı', en: 'SOS armed, position fixed' },
  sent: { tr: 'Sinyal uydu üzerinden gönderildi', en: 'Signal sent via satellite' },
  acknowledged: {
    tr: 'Kurtarma koordinasyon merkezi sinyali aldı',
    en: 'Rescue coordination centre acknowledged',
  },
  dispatched: { tr: 'Kurtarma ekibi yola çıktı', en: 'Rescue team dispatched' },
  resolved: { tr: 'Olay kapatıldı', en: 'Incident closed' },
};

export function sosTimelineNote(stage: SosStage, locale = 'tr'): string {
  const n = STAGE_NOTES[stage];
  return locale === 'tr' ? n.tr : n.en;
}

/**
 * Dağ kurtarma için tahmini varış (dk): 20 dk hazırlık + arazi faktörü 1,6 × 40 km/s.
 * En az 15 dk.
 */
export function estimatedRescueEtaMin(coords: GeoPoint, center: GeoPoint): number {
  const km = distanceKm(coords, center);
  return Math.max(15, Math.round(20 + (km * 1.6) / (40 / 60)));
}

export interface SosPayloadUser {
  displayName: string;
  bloodType?: string | null;
}

/**
 * 160 karakter sınırında öncelik sırasıyla: SOS etiketi, ad, konum, saat, kan grubu (varsa),
 * ilk acil kişi telefonu. Sığmayan parça atlanır.
 */
export function buildSosPayload(
  user: SosPayloadUser,
  coords: GeoPoint,
  contacts: EmergencyContact[],
  now: Date = new Date(),
): string {
  const pieces = [
    'SOS',
    `n:${compressText(user.displayName).slice(0, 24)}`,
    `g:${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`,
    `t:${pad2(now.getHours())}${pad2(now.getMinutes())}`,
  ];
  if (user.bloodType) pieces.push(`kb:${user.bloodType.replace(/\s+/g, '')}`);
  const first = contacts[0];
  if (first) pieces.push(`ct:${first.phone.replace(/\s+/g, '')}`);
  let out = '';
  for (const piece of pieces) {
    const next = out ? `${out};${piece}` : piece;
    if (next.length > SAT_MESSAGE_MAX_LEN) break;
    out = next;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Kapsama                                                             */
/* ------------------------------------------------------------------ */

interface CountryBox {
  code: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Kaba sınır kutuları; özel olanlar (TR) genel bölgelerden (EU) önce gelir. */
const COUNTRY_BOXES: CountryBox[] = [
  { code: 'TR', minLat: 35.8, maxLat: 42.2, minLon: 25.6, maxLon: 44.9 },
  { code: 'GB', minLat: 49.8, maxLat: 59.5, minLon: -8.2, maxLon: 1.8 },
  { code: 'EU', minLat: 35, maxLat: 71.5, minLon: -10, maxLon: 31 },
  { code: 'US', minLat: 24.5, maxLat: 49.5, minLon: -125, maxLon: -66.5 },
  { code: 'CA', minLat: 49.5, maxLat: 70, minLon: -141, maxLon: -52 },
  { code: 'AU', minLat: -44, maxLat: -10, minLon: 112, maxLon: 154 },
  { code: 'NZ', minLat: -47.5, maxLat: -34, minLon: 166, maxLon: 179 },
  { code: 'JP', minLat: 30, maxLat: 45.5, minLon: 129, maxLon: 146 },
];

/** Telefon uydu servisinin (Apple/Skylo) sunulduğu ülkeler */
export const PHONE_SATELLITE_COUNTRIES = ['TR', 'GB', 'EU', 'US', 'CA', 'AU', 'NZ', 'JP'];
/** Starlink Mini'nin satıldığı/aktif olduğu bölgeler */
export const STARLINK_COUNTRIES = ['GB', 'EU', 'US', 'CA', 'AU', 'NZ', 'JP'];

export function countryFromCoords(coords: GeoPoint): string | null {
  const box = COUNTRY_BOXES.find(
    (b) =>
      coords.latitude >= b.minLat &&
      coords.latitude <= b.maxLat &&
      coords.longitude >= b.minLon &&
      coords.longitude <= b.maxLon,
  );
  return box?.code ?? null;
}

/**
 * Tahmini kapsama 0..1. Iridium (inReach/ZOLEO) küreseldir; Globalstar (SPOT) kutuplarda yoktur;
 * telefon uydu yalnızca belirli ülkelerde çalışır; |enlem| > 70° her ağda düşer.
 */
export function satelliteCoverage(coords: GeoPoint, deviceType: SatDeviceType): number {
  const absLat = Math.abs(coords.latitude);
  const polar = absLat > 70;
  const country = countryFromCoords(coords);
  let value: number;
  switch (deviceType) {
    case 'inreach':
    case 'zoleo':
      value = polar ? 0.75 : 1;
      break;
    case 'spot':
      value = absLat > 70 ? 0 : absLat > 60 ? 0.5 : 0.85;
      break;
    case 'phone_satellite':
      value = country && PHONE_SATELLITE_COUNTRIES.includes(country) ? (polar ? 0.3 : 0.9) : 0.1;
      break;
    case 'starlink_mini':
      value = country && STARLINK_COUNTRIES.includes(country) ? (polar ? 0.4 : 0.95) : 0.2;
      break;
    default:
      value = 0;
  }
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export type CoverageLevel = 'none' | 'poor' | 'fair' | 'good' | 'excellent';

export function coverageLabel(value: number): CoverageLevel {
  if (value <= 0.05) return 'none';
  if (value < 0.4) return 'poor';
  if (value < 0.7) return 'fair';
  if (value < 0.9) return 'good';
  return 'excellent';
}

/* ------------------------------------------------------------------ */
/* Check-in şablonları                                                 */
/* ------------------------------------------------------------------ */

export type CheckinPresetId = 'ok' | 'delayed' | 'camping' | 'need_pickup';

export interface CheckinPreset {
  id: CheckinPresetId;
  /** Uyduda gönderilen kısa kod */
  code: string;
  labelKey: TranslationKey;
  icon: string;
  /** Sıkıştırmadan önce gövde (Türkçe) */
  body: string;
}

export const CHECKIN_PRESETS: CheckinPreset[] = [
  {
    id: 'ok',
    code: 'OK',
    labelKey: 'satellite.checkin.ok',
    icon: 'circle-check',
    body: 'güvendeyim plan devam',
  },
  {
    id: 'delayed',
    code: 'DLY',
    labelKey: 'satellite.checkin.delayed',
    icon: 'clock',
    body: 'gecikiyorum iyiyim',
  },
  {
    id: 'camping',
    code: 'CMP',
    labelKey: 'satellite.checkin.camping',
    icon: 'tent',
    body: 'kamptayım konum ekli',
  },
  {
    id: 'need_pickup',
    code: 'PCK',
    labelKey: 'satellite.checkin.need_pickup',
    icon: 'navigation',
    body: 'alınmam gerek konum ekli',
  },
];

export function checkinPreset(id: CheckinPresetId): CheckinPreset {
  const preset = CHECKIN_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Bilinmeyen check-in şablonu: ${id}`);
  return preset;
}

/** Kod öneki + gövde; MessageRow'da kod tanınırsa şablon etiketi gösterilir. */
export function checkinPresetBody(id: CheckinPresetId): string {
  const p = checkinPreset(id);
  return `${p.code} ${p.body}`;
}

export function checkinPresetFromText(text: string): CheckinPreset | null {
  const code = text.trim().split(' ')[0]?.toUpperCase();
  return CHECKIN_PRESETS.find((p) => p.code === code) ?? null;
}
