import type { TranslationKey } from '@/core/i18n';

import { AVALANCHE_LEVELS } from './enums';
import type { AvalancheLevel } from './enums';
import type {
  AvalancheBulletin,
  GeoPoint,
  ISODate,
  WeatherAlert,
  WeatherDay,
  WeatherForecast,
  WeatherHour,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Standart atmosferde sıcaklık düşüş oranı (°C / 1000 m) */
export const LAPSE_RATE_C_PER_KM = 6.5;

/** Uyarı eşikleri — tek kaynaktan yönetilir, testlerde de kullanılır. */
export const WEATHER_THRESHOLDS = {
  windWarningKmh: 50,
  windDangerKmh: 80,
  coldWarningC: -10,
  coldDangerC: -20,
  heatWarningC: 35,
  heatDangerC: 40,
  snowWarningCm: 10,
  snowDangerCm: 30,
  rainWarningMm: 20,
  rainDangerMm: 50,
  uvWarning: 8,
  uvDanger: 11,
} as const;

/** Hava ikonu adları — `IconName` alt kümesi (Icon kaydında mevcut olmalı). */
export type WeatherIcon =
  'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'cloud-lightning' | 'snowflake' | 'wind';

export type WmoGroup =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'showers'
  | 'snowShowers'
  | 'thunderstorm'
  | 'hail';

export interface WmoMeta {
  group: WmoGroup;
  icon: WeatherIcon;
  labelKey: TranslationKey;
  /** Yağış getiren bir kod mu */
  wet: boolean;
}

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/* ------------------------------------------------------------------ */
/* WMO kodları                                                         */
/* ------------------------------------------------------------------ */

/** WMO 4677 hava kodunu ikon + i18n grubuna eşler. */
export function wmoCodeMeta(code: number): WmoMeta {
  const c = Math.round(code);
  let group: WmoGroup;
  if (c === 0) group = 'clear';
  else if (c === 1 || c === 2) group = 'partlyCloudy';
  else if (c === 3) group = 'cloudy';
  else if (c === 45 || c === 48) group = 'fog';
  else if (c >= 51 && c <= 57) group = 'drizzle';
  else if (c === 66 || c === 67) group = 'freezingRain';
  else if (c >= 61 && c <= 65) group = 'rain';
  else if (c >= 71 && c <= 77) group = 'snow';
  else if (c >= 80 && c <= 82) group = 'showers';
  else if (c === 85 || c === 86) group = 'snowShowers';
  else if (c === 96 || c === 99) group = 'hail';
  else if (c >= 95 && c <= 99) group = 'thunderstorm';
  else if (c < 0) group = 'clear';
  else group = 'cloudy';

  const icon: WeatherIcon =
    group === 'clear'
      ? 'sun'
      : group === 'partlyCloudy'
        ? 'cloud-sun'
        : group === 'cloudy' || group === 'fog'
          ? 'cloud'
          : group === 'snow' || group === 'snowShowers'
            ? 'snowflake'
            : group === 'thunderstorm' || group === 'hail'
              ? 'cloud-lightning'
              : 'cloud-rain';

  const wet = !(
    group === 'clear' ||
    group === 'partlyCloudy' ||
    group === 'cloudy' ||
    group === 'fog'
  );

  return { group, icon, labelKey: `weather.wmo.${group}` as TranslationKey, wet };
}

/** Yıldırım içeren WMO kodları (95–99). */
export function isLightningCode(code: number): boolean {
  return code >= 95 && code <= 99;
}

/* ------------------------------------------------------------------ */
/* Fizik yardımcıları                                                  */
/* ------------------------------------------------------------------ */

/** Sıcaklığı bir rakımdan diğerine −6,5 °C/1000 m ile taşır. */
export function lapseRateAdjust(tempC: number, fromElevM: number, toElevM: number): number {
  return tempC - (LAPSE_RATE_C_PER_KM * (toElevM - fromElevM)) / 1000;
}

/**
 * Rüzgâr soğuğu (JAG/TI formülü). 10 °C üstü ya da 4,8 km/sa altı rüzgârda
 * hissedilen = ölçülen kabul edilir.
 */
export function windChill(tempC: number, windKmh: number): number {
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const v = Math.pow(windKmh, 0.16);
  return Math.round((13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v) * 10) / 10;
}

/**
 * Donma seviyesi (m): önce ilk saatin `freezingLevelM` değeri, yoksa hava sıcaklığından
 * ve rakımdan lapse-rate ile türetilir (referans rakım verilmişse).
 */
export function freezingLevel(
  hourly: WeatherHour[],
  referenceElevM: number | null = null,
): number | null {
  const first = hourly[0];
  if (!first) return null;
  if (first.freezingLevelM != null) return Math.round(first.freezingLevelM);
  if (referenceElevM == null) return null;
  return Math.max(
    0,
    Math.round(referenceElevM + (first.temperatureC * 1000) / LAPSE_RATE_C_PER_KM),
  );
}

/** Derece → 8 yönlü pusula etiketi (rüzgârın GELDİĞİ yön). */
export function compassDirection(deg: number): CompassDirection {
  const dirs: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx] ?? 'N';
}

/* ------------------------------------------------------------------ */
/* Uyarılar                                                            */
/* ------------------------------------------------------------------ */

type AlertLevel = WeatherAlert['level'];

const LEVEL_RANK: Record<AlertLevel, number> = { info: 0, warning: 1, danger: 2 };

function addHours(iso: ISODate, hours: number): ISODate {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

/**
 * Saatlik diziyi bir koşula göre tarar; ardışık eşleşen saatleri tek pencerede birleştirir.
 * `level` fonksiyonu saat başına seviye verir; pencere seviyesi en yükseği alır.
 */
function scanHourly(
  hourly: WeatherHour[],
  kind: WeatherAlert['kind'],
  pick: (h: WeatherHour) => { level: AlertLevel; value: number } | null,
): WeatherAlert[] {
  const out: WeatherAlert[] = [];
  let current: WeatherAlert | null = null;
  let lastIdx = -2;
  hourly.forEach((h, idx) => {
    const hit = pick(h);
    if (hit && current && idx === lastIdx + 1) {
      current.to = addHours(h.time, 1);
      if (LEVEL_RANK[hit.level] > LEVEL_RANK[current.level]) current.level = hit.level;
      current.value = Math.max(current.value, hit.value);
      lastIdx = idx;
      return;
    }
    if (hit) {
      current = { kind, level: hit.level, from: h.time, to: addHours(h.time, 1), value: hit.value };
      out.push(current);
      lastIdx = idx;
      return;
    }
    current = null;
  });
  return out;
}

/**
 * Tahminden uyarı listesi üretir. Eşikler `WEATHER_THRESHOLDS`:
 * rüzgâr/hamle > 50 uyarı, > 80 tehlike; yıldırım kodları 95–99; soğuk < −10; sıcak > 35;
 * kar > 10 cm/gün; yağış > 20 mm/gün; UV ≥ 8. Sonuç seviyeye göre sıralıdır (tehlike önce).
 */
export function computeAlerts(forecast: Pick<WeatherForecast, 'hourly' | 'daily'>): WeatherAlert[] {
  const T = WEATHER_THRESHOLDS;
  const { hourly, daily } = forecast;
  const alerts: WeatherAlert[] = [];

  // Yıldırım / fırtına — rüzgârla birleşince "storm"
  const lightning = scanHourly(hourly, 'lightning', (h) =>
    isLightningCode(h.weatherCode)
      ? { level: 'danger', value: Math.max(h.windKmh, h.windGustKmh) }
      : null,
  );
  for (const a of lightning) {
    if (a.value > T.windWarningKmh) alerts.push({ ...a, kind: 'storm' });
    else alerts.push(a);
  }

  // Rüzgâr (yıldırımla çakışan saatler "storm" olarak zaten kapsandı)
  const stormWindows = alerts.filter((a) => a.kind === 'storm');
  const inStorm = (time: ISODate) => stormWindows.some((s) => time >= s.from && time < s.to);
  alerts.push(
    ...scanHourly(hourly, 'wind', (h) => {
      if (inStorm(h.time)) return null;
      const v = Math.max(h.windKmh, h.windGustKmh);
      if (v > T.windDangerKmh) return { level: 'danger', value: Math.round(v) };
      if (v > T.windWarningKmh) return { level: 'warning', value: Math.round(v) };
      return null;
    }),
  );

  // Soğuk / sıcak (hissedilen dikkate alınır)
  alerts.push(
    ...scanHourly(hourly, 'cold', (h) => {
      const v = Math.min(h.temperatureC, h.apparentC);
      if (v < T.coldDangerC) return { level: 'danger', value: Math.round(v) };
      if (v < T.coldWarningC) return { level: 'warning', value: Math.round(v) };
      return null;
    }),
  );
  alerts.push(
    ...scanHourly(hourly, 'heat', (h) => {
      const v = Math.max(h.temperatureC, h.apparentC);
      if (v > T.heatDangerC) return { level: 'danger', value: Math.round(v) };
      if (v > T.heatWarningC) return { level: 'warning', value: Math.round(v) };
      return null;
    }),
  );

  // Günlük kar toplamı (saatlikten), yağış ve UV (günlükten)
  const snowByDay = new Map<string, number>();
  for (const h of hourly) {
    const day = h.time.slice(0, 10);
    snowByDay.set(day, (snowByDay.get(day) ?? 0) + h.snowfallCm);
  }
  for (const [day, cm] of snowByDay) {
    if (cm > T.snowWarningCm) {
      alerts.push({
        kind: 'snow',
        level: cm > T.snowDangerCm ? 'danger' : 'warning',
        from: `${day}T00:00:00.000Z`,
        to: `${day}T23:59:59.000Z`,
        value: Math.round(cm * 10) / 10,
      });
    }
  }
  for (const d of daily) {
    const day = d.date.slice(0, 10);
    const daySnow = snowByDay.get(day) ?? 0;
    if (d.precipitationMm > T.rainWarningMm && daySnow <= T.snowWarningCm) {
      alerts.push({
        kind: 'rain',
        level: d.precipitationMm > T.rainDangerMm ? 'danger' : 'warning',
        from: `${day}T00:00:00.000Z`,
        to: `${day}T23:59:59.000Z`,
        value: Math.round(d.precipitationMm),
      });
    }
    if (d.uvIndex >= T.uvWarning) {
      alerts.push({
        kind: 'uv',
        level: d.uvIndex >= T.uvDanger ? 'danger' : 'warning',
        from: d.sunrise,
        to: d.sunset,
        value: Math.round(d.uvIndex * 10) / 10,
      });
    }
  }

  return alerts.sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.from.localeCompare(b.from),
  );
}

/** Listedeki en yüksek seviyeli uyarı (yoksa null). */
export function highestAlert(alerts: WeatherAlert[]): WeatherAlert | null {
  let best: WeatherAlert | null = null;
  for (const a of alerts) {
    if (!best || LEVEL_RANK[a.level] > LEVEL_RANK[best.level]) best = a;
  }
  return best;
}

/** Uyarı metni i18n anahtarı (`weather.alerts.<kind>.<level>`). */
export function alertLabelKey(alert: WeatherAlert): TranslationKey {
  return `weather.alerts.${alert.kind}.${alert.level}` as TranslationKey;
}

/** Uyarı türü için ikon. */
export function alertIcon(kind: WeatherAlert['kind']): WeatherIcon | 'thermometer' | 'sun' {
  switch (kind) {
    case 'wind':
      return 'wind';
    case 'storm':
    case 'lightning':
      return 'cloud-lightning';
    case 'snow':
      return 'snowflake';
    case 'rain':
      return 'cloud-rain';
    case 'uv':
      return 'sun';
    default:
      return 'thermometer';
  }
}

/* ------------------------------------------------------------------ */
/* En uygun pencere                                                    */
/* ------------------------------------------------------------------ */

export interface BestWindow {
  from: ISODate;
  to: ISODate;
  /** 0 = ideal, 1+ = riskli */
  score: number;
  hours: WeatherHour[];
}

/** Tek saat için 0..~5 arası risk puanı (rüzgâr, yağış, yıldırım, soğuk, gece). */
export function hourRisk(h: WeatherHour): number {
  let r = 0;
  const wind = Math.max(h.windKmh, h.windGustKmh * 0.8);
  r += Math.min(2, wind / 50);
  r += h.precipitationProbability / 100;
  r += Math.min(1.5, h.precipitationMm * 0.25);
  r += Math.min(1, h.snowfallCm * 0.3);
  if (isLightningCode(h.weatherCode)) r += 2.5;
  if (h.apparentC < -10) r += 0.6;
  if (h.apparentC > 32) r += 0.4;
  const hour = new Date(h.time).getUTCHours();
  if (hour < 5 || hour > 20) r += 0.35;
  return Math.round(r * 100) / 100;
}

/**
 * Saatlik tahminde ardışık `hours` saatlik en düşük ortalama riskli pencereyi bulur.
 * Yıldırımlı saat içeren pencereler elenir; hiç uygun pencere yoksa null.
 */
export function bestWindow(hourly: WeatherHour[], hours = 6): BestWindow | null {
  if (hourly.length < hours || hours <= 0) return null;
  let best: BestWindow | null = null;
  for (let i = 0; i + hours <= hourly.length; i += 1) {
    const slice = hourly.slice(i, i + hours);
    if (slice.some((h) => isLightningCode(h.weatherCode))) continue;
    const score = slice.reduce((acc, h) => acc + hourRisk(h), 0) / hours;
    if (!best || score < best.score - 1e-9) {
      const last = slice[slice.length - 1]!;
      best = {
        from: slice[0]!.time,
        to: addHours(last.time, 1),
        score: Math.round(score * 100) / 100,
        hours: slice,
      };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Özetler                                                             */
/* ------------------------------------------------------------------ */

const DAY_SHORT: Record<string, string[]> = {
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** Kısa gün adı (UTC gün); yalnızca tr/en, diğerleri İngilizce. */
export function shortDayName(iso: ISODate, locale = 'tr'): string {
  const names = DAY_SHORT[locale] ?? DAY_SHORT.en!;
  return names[new Date(iso).getUTCDay()] ?? '';
}

/** "Cts · 4°/12° · yağış %40 · 25 km/sa" biçiminde tek satır gün özeti. */
export function summarizeDay(day: WeatherDay, locale = 'tr'): string {
  const name = shortDayName(day.date, locale);
  const temps = `${Math.round(day.minC)}°/${Math.round(day.maxC)}°`;
  const rain =
    locale === 'tr'
      ? `yağış %${Math.round(day.precipitationProbability)}`
      : `rain ${Math.round(day.precipitationProbability)}%`;
  const wind = `${Math.round(day.windMaxKmh)} ${locale === 'tr' ? 'km/sa' : 'km/h'}`;
  return `${name} · ${temps} · ${rain} · ${wind}`;
}

/** Tahmin yaşı dakika olarak. */
export function forecastAgeMin(fetchedAt: ISODate, now: Date | number): number {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, Math.round((nowMs - new Date(fetchedAt).getTime()) / 60_000));
}

/* ------------------------------------------------------------------ */
/* Çığ                                                                 */
/* ------------------------------------------------------------------ */

export interface AvalancheMeta {
  level: AvalancheLevel;
  color: string;
  /** Beşinci seviye için ikinci renk (siyah-kırmızı) */
  accentColor: string | null;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const AVALANCHE_COLORS: Record<AvalancheLevel, string> = {
  1: '#3CB44B',
  2: '#F5D000',
  3: '#F28C28',
  4: '#E02020',
  5: '#E02020',
};

/** EAWS tehlike seviyesi meta verisi (renk + i18n). */
export function avalancheMeta(level: AvalancheLevel): AvalancheMeta {
  return {
    level,
    color: AVALANCHE_COLORS[level],
    accentColor: level === 5 ? '#111111' : null,
    labelKey: `weather.avalanche.level${level}` as TranslationKey,
    descriptionKey: `weather.avalanche.level${level}Description` as TranslationKey,
  };
}

export type AvalancheProblemCode =
  | 'new_snow'
  | 'wind_slab'
  | 'persistent_weak_layers'
  | 'wet_snow'
  | 'gliding_snow'
  | 'cornices'
  | 'no_distinct_problem';

export const AVALANCHE_PROBLEMS: AvalancheProblemCode[] = [
  'new_snow',
  'wind_slab',
  'persistent_weak_layers',
  'wet_snow',
  'gliding_snow',
  'cornices',
  'no_distinct_problem',
];

/** Problem kodu bilinen listede ise i18n anahtarı, değilse null (ham metin gösterilir). */
export function avalancheProblemKey(problem: string): TranslationKey | null {
  return (AVALANCHE_PROBLEMS as string[]).includes(problem)
    ? (`weather.avalanche.problem.${problem}` as TranslationKey)
    : null;
}

export interface EawsRegion {
  code: string;
  name: string;
  /** Resmi bülten var mı (Türkiye için yok) */
  official: boolean;
  url: string | null;
  /** CAAML JSON uç noktası (varsa) */
  caamlUrl: string | null;
}

interface RegionBox {
  region: EawsRegion;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

const EAWS_BOXES: RegionBox[] = [
  {
    region: {
      code: 'EUREGIO',
      name: 'Tirol / Südtirol / Trentino',
      official: true,
      url: 'https://avalanche.report',
      caamlUrl: 'https://static.avalanche.report/bulletins/latest/EUREGIO_en_CAAMLv6.json',
    },
    latMin: 45.6,
    latMax: 47.8,
    lonMin: 10.0,
    lonMax: 12.6,
  },
  {
    region: {
      code: 'AT',
      name: 'Avusturya Alpleri',
      official: true,
      url: 'https://lawinen.at',
      caamlUrl: null,
    },
    latMin: 46.3,
    latMax: 48.1,
    lonMin: 9.5,
    lonMax: 16.0,
  },
  {
    region: {
      code: 'FR',
      name: 'Fransız Alpleri (Météo-France)',
      official: true,
      url: 'https://meteofrance.com/meteo-montagne',
      caamlUrl: null,
    },
    latMin: 43.7,
    latMax: 46.0,
    lonMin: 5.0,
    lonMax: 7.05,
  },
  {
    region: {
      code: 'CH',
      name: 'İsviçre Alpleri (SLF)',
      official: true,
      url: 'https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html',
      caamlUrl: null,
    },
    latMin: 45.8,
    latMax: 47.8,
    lonMin: 5.9,
    lonMax: 10.5,
  },
  {
    region: {
      code: 'IT',
      name: 'İtalyan Alpleri (AINEVA)',
      official: true,
      url: 'https://www.aineva.it',
      caamlUrl: null,
    },
    latMin: 44.0,
    latMax: 47.1,
    lonMin: 6.6,
    lonMax: 13.9,
  },
  {
    region: {
      code: 'DE',
      name: 'Bavyera Alpleri (LWD Bayern)',
      official: true,
      url: 'https://lawinenwarndienst.bayern.de',
      caamlUrl: null,
    },
    latMin: 47.2,
    latMax: 47.9,
    lonMin: 9.9,
    lonMax: 13.2,
  },
  {
    region: {
      code: 'SI',
      name: 'Julian Alpleri (ARSO)',
      official: true,
      url: 'https://meteo.arso.gov.si',
      caamlUrl: null,
    },
    latMin: 45.9,
    latMax: 46.7,
    lonMin: 13.3,
    lonMax: 15.2,
  },
  {
    region: {
      code: 'PYR',
      name: 'Pireneler',
      official: true,
      url: 'https://www.icgc.cat/en/Public-Administration-and-Enterprises/Services/Snow-and-avalanches',
      caamlUrl: null,
    },
    latMin: 42.2,
    latMax: 43.3,
    lonMin: -2.0,
    lonMax: 3.3,
  },
  {
    region: {
      code: 'NO',
      name: 'Norveç (Varsom)',
      official: true,
      url: 'https://varsom.no',
      caamlUrl: null,
    },
    latMin: 58.0,
    latMax: 71.5,
    lonMin: 4.5,
    lonMax: 31.5,
  },
  {
    region: {
      code: 'SCT',
      name: 'İskoçya (SAIS)',
      official: true,
      url: 'https://www.sais.gov.uk',
      caamlUrl: null,
    },
    latMin: 56.3,
    latMax: 58.5,
    lonMin: -6.5,
    lonMax: -2.5,
  },
  {
    region: {
      code: 'IS',
      name: 'İzlanda (Veður)',
      official: true,
      url: 'https://en.vedur.is/avalanches',
      caamlUrl: null,
    },
    latMin: 63.2,
    latMax: 66.7,
    lonMin: -24.6,
    lonMax: -13.3,
  },
  {
    region: {
      code: 'TR-unofficial',
      name: 'Türkiye (resmi bülten yok)',
      official: false,
      url: null,
      caamlUrl: null,
    },
    latMin: 35.8,
    latMax: 42.2,
    lonMin: 25.6,
    lonMax: 44.9,
  },
];

/**
 * Kaba coğrafi kutularla EAWS bölgesi seçer. Kutular çakışıyorsa daha dar olan
 * (EUREGIO gibi CAAML uç noktası olan) öncelik kazanır; liste o sırayla düzenlenmiştir.
 */
export function eawsRegionFor(coords: GeoPoint): EawsRegion | null {
  for (const box of EAWS_BOXES) {
    if (
      coords.latitude >= box.latMin &&
      coords.latitude <= box.latMax &&
      coords.longitude >= box.lonMin &&
      coords.longitude <= box.lonMax
    ) {
      return box.region;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Deterministik mock                                                  */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit — bağımlılıksız deterministik hash. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 — küçük, hızlı, deterministik PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Yılın günü (UTC, 0..365). */
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

/** Koordinat + rakım yoksa kaba bir rakım tahmini (mock için). */
function guessElevation(coords: GeoPoint, rand: () => number): number {
  // Türkiye içi: doğuya gittikçe yükselir; kıyı şeridi düşük
  const inTurkey =
    coords.latitude > 35.8 &&
    coords.latitude < 42.2 &&
    coords.longitude > 25.6 &&
    coords.longitude < 44.9;
  if (inTurkey) {
    const east = Math.max(0, coords.longitude - 29) / 15;
    return Math.round(150 + east * 1400 + rand() * 300);
  }
  return Math.round(200 + rand() * 900);
}

/**
 * Deniz seviyesine indirgenmiş mevsimsel ortalama sıcaklık. Enlem ve yılın gününe bağlı
 * basit bir sinüs modeli; güney yarımkürede mevsim tersine çevrilir.
 */
function seaLevelBaseTemp(lat: number, doy: number): number {
  const north = lat >= 0;
  const phase = ((doy - 200) / 365) * Math.PI * 2;
  const seasonal = 11 * Math.cos(phase) * (north ? 1 : -1);
  const latitudinal = 27 - 0.45 * Math.abs(lat);
  return latitudinal + seasonal;
}

/**
 * Deterministik 72 saat + 7 günlük tahmin. Aynı (coords, seed, now) → aynı çıktı.
 * Mevsim (yılın günü), enlem ve rakım (verilmemişse tahmin) sıcaklığı belirler;
 * rüzgâr rakımla artar; sıcaklık < 1 °C ise yağış kar olur.
 */
export function mockForecast(
  coords: GeoPoint,
  seed: string | number,
  now: Date | number,
  elevationM: number | null = null,
): WeatherForecast {
  const nowDate = new Date(typeof now === 'number' ? now : now.getTime());
  const rand = mulberry32(
    fnv1a(`${seed}|${coords.latitude.toFixed(2)}|${coords.longitude.toFixed(2)}`),
  );
  const elev = elevationM ?? guessElevation(coords, rand);
  const start = new Date(nowDate);
  start.setUTCMinutes(0, 0, 0);

  // Hava rejimi: 3 günlük bloklar; her blok bir "cephe" karakteri taşır
  const regimeCount = 4;
  const regimes: { wet: number; windy: number; cloud: number; storm: boolean }[] = [];
  for (let i = 0; i < regimeCount; i += 1) {
    const wet = rand();
    regimes.push({
      wet,
      windy: rand(),
      cloud: Math.min(1, wet * 0.7 + rand() * 0.5),
      storm: rand() > 0.72,
    });
  }

  const hourly: WeatherHour[] = [];
  const windBase = 8 + (elev / 1000) * 9 + rand() * 6;
  const windDirBase = rand() * 360;
  for (let i = 0; i < 72; i += 1) {
    const time = new Date(start.getTime() + i * 3_600_000);
    const doy = dayOfYear(time);
    const hourUtc = time.getUTCHours();
    // Yerel saat yaklaşımı: boylam/15
    const localHour = (hourUtc + coords.longitude / 15 + 24) % 24;
    const regime = regimes[Math.min(regimeCount - 1, Math.floor(i / 18))]!;
    const diurnal = 5.5 * Math.sin(((localHour - 9) / 24) * Math.PI * 2);
    const noise = (rand() - 0.5) * 2;
    const seaLevel =
      seaLevelBaseTemp(coords.latitude, doy) + diurnal * (1 - regime.cloud * 0.6) + noise;
    const temperatureC = Math.round(lapseRateAdjust(seaLevel, 0, elev) * 10) / 10;

    const gustFactor = 1.3 + regime.windy * 0.6;
    const windKmh = Math.round(
      Math.max(2, windBase * (0.6 + regime.windy) + Math.sin(i / 5) * 6 + (rand() - 0.5) * 8),
    );
    const windGustKmh = Math.round(windKmh * gustFactor);
    const windDirectionDeg = Math.round((windDirBase + Math.sin(i / 9) * 40 + 360) % 360);

    const cloudCoverPct = Math.round(
      Math.min(100, Math.max(0, regime.cloud * 100 + Math.sin(i / 3) * 20 + (rand() - 0.5) * 20)),
    );
    const wetChance = regime.wet * 0.8 + (cloudCoverPct / 100) * 0.3;
    const raining = rand() < wetChance * 0.5;
    const intensity = raining ? Math.round(rand() * rand() * 6 * (0.5 + regime.wet) * 10) / 10 : 0;
    const precipitationProbability = Math.round(
      Math.min(100, Math.max(0, wetChance * 90 + (rand() - 0.5) * 20)),
    );
    const snowing = temperatureC < 1 && intensity > 0;
    const snowfallCm = snowing ? Math.round(intensity * 0.9 * 10) / 10 : 0;
    const precipitationMm = intensity;

    const stormy =
      regime.storm && intensity > 1.5 && localHour > 12 && localHour < 21 && rand() > 0.5;
    let weatherCode = 0;
    if (stormy) weatherCode = intensity > 4 ? 96 : 95;
    else if (snowing) weatherCode = intensity > 2.5 ? 75 : intensity > 1 ? 73 : 71;
    else if (intensity > 3) weatherCode = 82;
    else if (intensity > 1.2) weatherCode = 63;
    else if (intensity > 0.3) weatherCode = 61;
    else if (intensity > 0) weatherCode = 51;
    else if (cloudCoverPct > 85) weatherCode = 3;
    else if (cloudCoverPct > 40) weatherCode = 2;
    else if (cloudCoverPct > 15) weatherCode = 1;
    else weatherCode = 0;
    if (!snowing && weatherCode === 0 && localHour < 9 && cloudCoverPct > 60 && rand() > 0.85) {
      weatherCode = 45;
    }

    const apparentC = Math.round(windChill(temperatureC, windKmh) * 10) / 10;
    const freezingLevelM = Math.max(
      0,
      Math.round(elev + (temperatureC * 1000) / LAPSE_RATE_C_PER_KM),
    );

    hourly.push({
      time: time.toISOString(),
      temperatureC,
      apparentC,
      precipitationMm,
      precipitationProbability,
      windKmh,
      windGustKmh,
      windDirectionDeg,
      cloudCoverPct,
      weatherCode,
      snowfallCm,
      freezingLevelM,
    });
  }

  const daily: WeatherDay[] = [];
  const dayStart = new Date(start);
  dayStart.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d < 7; d += 1) {
    const date = new Date(dayStart.getTime() + d * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const hours = hourly.filter((h) => h.time.startsWith(key));
    const doy = dayOfYear(date);
    // Gün uzunluğu: enlem + mevsim (kaba)
    const decl = 23.44 * Math.sin(((doy - 81) / 365) * Math.PI * 2);
    const latR = (coords.latitude * Math.PI) / 180;
    const declR = (decl * Math.PI) / 180;
    const cosH = Math.min(1, Math.max(-1, -Math.tan(latR) * Math.tan(declR)));
    const dayLenH = (Math.acos(cosH) * 2 * 12) / Math.PI;
    const solarNoonUtc = 12 - coords.longitude / 15;
    const sunriseH = solarNoonUtc - dayLenH / 2;
    const sunsetH = solarNoonUtc + dayLenH / 2;
    const sunrise = new Date(date.getTime() + sunriseH * 3_600_000).toISOString();
    const sunset = new Date(date.getTime() + sunsetH * 3_600_000).toISOString();

    let minC: number;
    let maxC: number;
    let precipitationMm: number;
    let precipitationProbability: number;
    let windMaxKmh: number;
    let weatherCode: number;
    if (hours.length >= 12) {
      minC = Math.min(...hours.map((h) => h.temperatureC));
      maxC = Math.max(...hours.map((h) => h.temperatureC));
      precipitationMm = Math.round(hours.reduce((a, h) => a + h.precipitationMm, 0) * 10) / 10;
      precipitationProbability = Math.max(...hours.map((h) => h.precipitationProbability));
      windMaxKmh = Math.max(...hours.map((h) => h.windGustKmh));
      // Gündüz saatlerinin en "kötü" kodu
      weatherCode = hours.reduce((worst, h) => Math.max(worst, h.weatherCode), 0);
    } else {
      const regime = regimes[Math.min(regimeCount - 1, Math.floor((d * 24) / 18))]!;
      const base = lapseRateAdjust(seaLevelBaseTemp(coords.latitude, doy), 0, elev);
      const spread = 4 + (1 - regime.cloud) * 5;
      minC = Math.round((base - spread + (rand() - 0.5) * 2) * 10) / 10;
      maxC = Math.round((base + spread + (rand() - 0.5) * 2) * 10) / 10;
      precipitationMm = Math.round(regime.wet * regime.wet * 28 * rand() * 10) / 10;
      precipitationProbability = Math.round(Math.min(100, regime.wet * 95));
      windMaxKmh = Math.round(windBase * (0.8 + regime.windy) * 1.5);
      weatherCode =
        precipitationMm > 8
          ? maxC < 2
            ? 75
            : regime.storm
              ? 95
              : 63
          : precipitationMm > 1
            ? maxC < 2
              ? 71
              : 61
            : regime.cloud > 0.7
              ? 3
              : regime.cloud > 0.35
                ? 2
                : 0;
    }
    const clearness = 1 - Math.min(1, precipitationProbability / 100) * 0.6;
    const uvIndex =
      Math.round(
        Math.max(0, (11 - Math.abs(coords.latitude - decl) * 0.16) * clearness + elev / 1500) * 10,
      ) / 10;

    daily.push({
      date: `${key}T00:00:00.000Z`,
      minC,
      maxC,
      precipitationMm,
      precipitationProbability,
      windMaxKmh,
      weatherCode,
      sunrise,
      sunset,
      uvIndex,
    });
  }

  const forecast: WeatherForecast = {
    coords: { latitude: coords.latitude, longitude: coords.longitude },
    elevationM: elev,
    timezone: 'UTC',
    fetchedAt: nowDate.toISOString(),
    source: 'mock',
    hourly,
    daily,
    alerts: [],
  };
  forecast.alerts = computeAlerts(forecast);
  return forecast;
}

/**
 * Deterministik çığ bülteni. Bölge yoksa null; Türkiye için "resmi olmayan" demo.
 * Seviye mevsime (kış ortası yüksek), rakıma ve koordinat hash'ine göre belirlenir.
 */
export function mockAvalanche(
  coords: GeoPoint,
  now: Date | number,
  forecast?: Pick<WeatherForecast, 'hourly' | 'elevationM'> | null,
): AvalancheBulletin | null {
  const region = eawsRegionFor(coords);
  if (!region) return null;
  const nowDate = new Date(typeof now === 'number' ? now : now.getTime());
  const rand = mulberry32(
    fnv1a(`avalanche|${region.code}|${coords.latitude.toFixed(1)}|${coords.longitude.toFixed(1)}`),
  );
  const doy = dayOfYear(nowDate);
  // Kış ortası (Ocak–Şubat) tepe; yaz dip
  const winterness = Math.max(0, Math.cos(((doy - 30) / 365) * Math.PI * 2));
  let score = winterness * 3 + rand() * 1.2;
  if (forecast) {
    const snow72h = forecast.hourly.reduce((a, h) => a + h.snowfallCm, 0);
    const gust = Math.max(0, ...forecast.hourly.map((h) => h.windGustKmh));
    if (snow72h > 10) score += 1;
    if (snow72h > 30) score += 1;
    if (gust > 60) score += 0.5;
  }
  const levelIdx = Math.min(AVALANCHE_LEVELS.length - 1, Math.max(0, Math.round(score) - 1));
  const dangerLevel: AvalancheLevel = winterness < 0.15 ? 1 : AVALANCHE_LEVELS[levelIdx]!;

  const problems: string[] =
    dangerLevel === 1
      ? ['no_distinct_problem']
      : dangerLevel === 2
        ? ['wind_slab']
        : dangerLevel === 3
          ? ['new_snow', 'wind_slab', 'persistent_weak_layers']
          : ['new_snow', 'wind_slab', 'persistent_weak_layers', 'wet_snow'];

  const baseElev = forecast?.elevationM ?? 1800;
  const bandElev = Math.round((baseElev + 400) / 100) * 100;
  const dangerAbove =
    dangerLevel >= 2 && dangerLevel < 5
      ? {
          elevationM: bandElev,
          level: AVALANCHE_LEVELS[Math.min(4, levelIdx + 1)]!,
        }
      : null;

  const validFrom = new Date(nowDate);
  validFrom.setUTCHours(17, 0, 0, 0);
  if (validFrom.getTime() > nowDate.getTime()) validFrom.setUTCDate(validFrom.getUTCDate() - 1);
  const validTo = new Date(validFrom.getTime() + 24 * 3_600_000);

  const summary = region.official
    ? `Demo bulletin for ${region.name}: danger level ${dangerLevel}${
        dangerAbove ? `, ${dangerAbove.level} above ${dangerAbove.elevationM} m` : ''
      }. Wind-affected slopes near ridgelines require caution.`
    : `Türkiye için resmi çığ bülteni yok. Son 72 saatteki kar, rüzgâr ve sıcaklık verisinden türetilen tahmini seviye: ${dangerLevel}. Kuzey ve rüzgâr altı yamaçlarda plaka oluşumuna dikkat.`;

  return {
    regionCode: region.code,
    regionName: region.name,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    dangerLevel,
    dangerAbove,
    problems,
    summary,
    source: 'mock',
    url: region.url,
  };
}
