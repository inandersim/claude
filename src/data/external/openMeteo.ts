import type { GeoPoint, WeatherDay, WeatherForecast, WeatherHour } from '@/domain';

/* ------------------------------------------------------------------ */
/* Open-Meteo — ücretsiz, anahtar gerektirmeyen hava ve yükseklik API'si */
/* Lisans: CC BY 4.0 — https://open-meteo.com                           */
/* ------------------------------------------------------------------ */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

/** İstek zaman aşımı (ms) */
export const OPEN_METEO_TIMEOUT_MS = 8_000;

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'cloud_cover',
  'weather_code',
  'snowfall',
  'freezing_level_height',
] as const;

const DAILY_VARS = [
  'temperature_2m_min',
  'temperature_2m_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'weather_code',
  'sunrise',
  'sunset',
  'uv_index_max',
] as const;

/** Open-Meteo forecast yanıtının kullandığımız alt kümesi. */
export interface OpenMeteoForecastJson {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: {
    time: string[];
    temperature_2m?: (number | null)[];
    apparent_temperature?: (number | null)[];
    precipitation?: (number | null)[];
    precipitation_probability?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    cloud_cover?: (number | null)[];
    weather_code?: (number | null)[];
    snowfall?: (number | null)[];
    freezing_level_height?: (number | null)[];
  };
  daily?: {
    time: string[];
    temperature_2m_min?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    weather_code?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
    uv_index_max?: (number | null)[];
  };
}

export interface OpenMeteoElevationJson {
  elevation: (number | null)[];
}

/* ------------------------------------------------------------------ */
/* Saf dönüştürücüler (test edilebilir)                                 */
/* ------------------------------------------------------------------ */

/** Open-Meteo yerel zaman damgasını ("2026-01-05T06:00") ISO UTC'ye çevirir. */
export function localToIso(local: string, utcOffsetSeconds: number): string {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(local)) return new Date(local).toISOString();
  const asUtc = Date.parse(local.length === 10 ? `${local}T00:00:00Z` : `${local}:00Z`);
  if (Number.isNaN(asUtc)) return new Date(local).toISOString();
  return new Date(asUtc - utcOffsetSeconds * 1000).toISOString();
}

const num = (arr: (number | null)[] | undefined, i: number, fallback = 0): number => {
  const v = arr?.[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

/**
 * Ham Open-Meteo JSON'unu `WeatherForecast`'a dönüştürür (uyarılar boş bırakılır;
 * domain `computeAlerts` doldurur). Saf fonksiyon.
 */
export function toForecast(
  json: OpenMeteoForecastJson,
  coords: GeoPoint,
  fetchedAt: string,
  elevationOverride: number | null = null,
): WeatherForecast {
  const offset = json.utc_offset_seconds ?? 0;
  const hourly: WeatherHour[] = [];
  const h = json.hourly;
  if (h) {
    for (let i = 0; i < h.time.length; i += 1) {
      const time = h.time[i];
      if (!time) continue;
      const freezing = h.freezing_level_height?.[i];
      hourly.push({
        time: localToIso(time, offset),
        temperatureC: num(h.temperature_2m, i),
        apparentC: num(h.apparent_temperature, i, num(h.temperature_2m, i)),
        precipitationMm: num(h.precipitation, i),
        precipitationProbability: num(h.precipitation_probability, i),
        windKmh: num(h.wind_speed_10m, i),
        windGustKmh: num(h.wind_gusts_10m, i, num(h.wind_speed_10m, i)),
        windDirectionDeg: num(h.wind_direction_10m, i),
        cloudCoverPct: num(h.cloud_cover, i),
        weatherCode: num(h.weather_code, i),
        snowfallCm: num(h.snowfall, i),
        freezingLevelM: typeof freezing === 'number' ? Math.round(freezing) : null,
      });
    }
  }

  const daily: WeatherDay[] = [];
  const d = json.daily;
  if (d) {
    for (let i = 0; i < d.time.length; i += 1) {
      const date = d.time[i];
      if (!date) continue;
      const dayIso = localToIso(date, offset);
      daily.push({
        date: dayIso,
        minC: num(d.temperature_2m_min, i),
        maxC: num(d.temperature_2m_max, i),
        precipitationMm: num(d.precipitation_sum, i),
        precipitationProbability: num(d.precipitation_probability_max, i),
        windMaxKmh: num(d.wind_speed_10m_max, i),
        weatherCode: num(d.weather_code, i),
        sunrise: d.sunrise?.[i] ? localToIso(d.sunrise[i]!, offset) : dayIso,
        sunset: d.sunset?.[i] ? localToIso(d.sunset[i]!, offset) : dayIso,
        uvIndex: num(d.uv_index_max, i),
      });
    }
  }

  return {
    coords: { latitude: coords.latitude, longitude: coords.longitude },
    elevationM:
      elevationOverride ?? (typeof json.elevation === 'number' ? Math.round(json.elevation) : null),
    timezone: json.timezone ?? 'UTC',
    fetchedAt,
    source: 'open-meteo',
    hourly,
    daily,
    alerts: [],
  };
}

/* ------------------------------------------------------------------ */
/* Ağ                                                                   */
/* ------------------------------------------------------------------ */

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = OPEN_METEO_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Open-Meteo forecast isteği URL'sini kurar (test edilebilir). */
export function buildForecastUrl(coords: GeoPoint, elevationM?: number | null): string {
  const params = new URLSearchParams({
    latitude: coords.latitude.toFixed(4),
    longitude: coords.longitude.toFixed(4),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    forecast_days: '7',
  });
  if (elevationM != null && Number.isFinite(elevationM)) {
    params.set('elevation', String(Math.round(elevationM)));
  }
  return `${FORECAST_URL}?${params.toString()}`;
}

/**
 * 7 günlük saatlik + günlük tahmin. `elevation` verilirse Open-Meteo sıcaklıkları o rakıma
 * indirger. Hata/zaman aşımında throw eder — çağıran mock'a düşer.
 */
export async function fetchOpenMeteoForecast(
  coords: GeoPoint,
  options: { elevation?: number | null; now?: number } = {},
): Promise<WeatherForecast> {
  const json = await fetchJsonWithTimeout<OpenMeteoForecastJson>(
    buildForecastUrl(coords, options.elevation),
  );
  const fetchedAt = new Date(options.now ?? Date.now()).toISOString();
  return toForecast(json, coords, fetchedAt, options.elevation ?? null);
}

/** Yükseklik uç noktası URL'si (en fazla 100 nokta). */
export function buildElevationUrl(points: GeoPoint[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.latitude.toFixed(5)).join(','),
    longitude: points.map((p) => p.longitude.toFixed(5)).join(','),
  });
  return `${ELEVATION_URL}?${params.toString()}`;
}

/**
 * Noktalar için yükseklik (Copernicus DEM 90 m). 100'lük partilerle sorgular;
 * yanıt eksikse ilgili indeks null olur. Hata → throw.
 */
export async function fetchOpenMeteoElevation(points: GeoPoint[]): Promise<(number | null)[]> {
  if (points.length === 0) return [];
  const out: (number | null)[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const json = await fetchJsonWithTimeout<OpenMeteoElevationJson>(buildElevationUrl(batch));
    for (let j = 0; j < batch.length; j += 1) {
      const v = json.elevation?.[j];
      out.push(typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
    }
  }
  return out;
}
