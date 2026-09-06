import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  highestAlert,
  wmoCodeMeta,
  type GeoPoint,
  type WeatherAlert,
  type WeatherHour,
  type WmoMeta,
} from '@/domain';

/** Hava tahmini 30 dakika taze sayılır (Open-Meteo saatlik günceller). */
const FORECAST_STALE_MS = 30 * 60_000;
/** Çığ bülteni 2 saat taze. */
const AVALANCHE_STALE_MS = 2 * 3_600_000;
/** Yükseklik değişmez. */
const ELEVATION_STALE_MS = 30 * 24 * 3_600_000;

/** 7 günlük saatlik + günlük tahmin; rakım verilirse ona göre indirgenir. */
export function useForecast(coords: GeoPoint | null, elevationM?: number | null) {
  return useQuery({
    queryKey: [
      ...queryKeys.weather.forecast(coords ?? { latitude: 0, longitude: 0 }),
      elevationM ?? 'auto',
    ],
    queryFn: () => getDataProvider().weather.forecast(coords!, elevationM ?? null),
    enabled: !!coords,
    staleTime: FORECAST_STALE_MS,
    placeholderData: (prev) => prev,
  });
}

/** Bölge varsa EAWS bülteni; yoksa null (veri, mock ise `source: 'mock'`). */
export function useAvalanche(coords: GeoPoint | null) {
  return useQuery({
    queryKey: queryKeys.weather.avalanche(coords ?? { latitude: 0, longitude: 0 }),
    queryFn: () => getDataProvider().weather.avalanche(coords!),
    enabled: !!coords,
    staleTime: AVALANCHE_STALE_MS,
  });
}

/** Noktalar için yükseklik dizisi (aynı sırayla; bilinmeyen → null). */
export function useElevation(points: GeoPoint[]) {
  const sig = points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join(';');
  return useQuery({
    queryKey: ['weather', 'elevation', sig] as const,
    queryFn: () => getDataProvider().weather.elevation(points),
    enabled: points.length > 0,
    staleTime: ELEVATION_STALE_MS,
  });
}

export interface WeatherAtSummary {
  now: WeatherHour;
  meta: WmoMeta;
  temperatureC: number;
  alert: WeatherAlert | null;
  source: 'open-meteo' | 'mock';
  fetchedAt: string;
}

/**
 * Kart içi kısa özet: şimdiki saat, ikon, sıcaklık ve en yüksek uyarı.
 * Diğer modüller (rota, kamp, tırmanış) için hafif yardımcı.
 */
export function useWeatherAt(coords: GeoPoint | null, elevationM?: number | null) {
  const query = useForecast(coords, elevationM);
  const data = query.data;
  let summary: WeatherAtSummary | null = null;
  if (data) {
    // Render içinde Date.now() yok: tahminin alındığı an "şimdi" kabul edilir
    const nowMs = new Date(data.fetchedAt).getTime();
    const current =
      data.hourly.find((h) => new Date(h.time).getTime() + 3_600_000 > nowMs) ?? data.hourly[0];
    if (current) {
      summary = {
        now: current,
        meta: wmoCodeMeta(current.weatherCode),
        temperatureC: current.temperatureC,
        alert: highestAlert(data.alerts),
        source: data.source,
        fetchedAt: data.fetchedAt,
      };
    }
  }
  return { ...query, summary };
}
