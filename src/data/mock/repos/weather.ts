import type { WeatherRepository } from '@/data/repositories';
import type { AvalancheBulletin, GeoPoint, WeatherForecast } from '@/domain';
import { computeAlerts, distanceKm, eawsRegionFor, mockAvalanche, mockForecast } from '@/domain';

import { CACHE_TTL, coordKey, getCached } from '../../external/cache';
import { fetchEawsBulletin } from '../../external/eaws';
import { fetchOpenMeteoElevation, fetchOpenMeteoForecast } from '../../external/openMeteo';
import type { MockContext } from '../context';

/** Bilinen noktalardan yükseklik devralmak için en fazla uzaklık (km). */
const NEAREST_ELEVATION_MAX_KM = 3;

/** Mock tahmin tohumu — sabit tutulur ki aynı konum aynı demo veriyi versin. */
const MOCK_SEED = 'zirve-weather';

/**
 * weather modülü repository'si. Tablo yoktur; gerçek açık veri istemcilerini
 * (Open-Meteo, EAWS) önbellek ile dener, ağ yoksa deterministik mock'a düşer.
 */
export function createWeatherRepository(ctx: MockContext): WeatherRepository {
  /**
   * Kütüphane, parça noktaları ve rota grafı düğümlerinden en yakın bilinen irtifa.
   * `maxKm` içinde yoksa null.
   */
  async function nearestKnownElevation(point: GeoPoint, maxKm = NEAREST_ELEVATION_MAX_KM) {
    const t = await ctx.db.load();
    let best: { d: number; elev: number } | null = null;
    const consider = (lat: number, lng: number, elev: number | null) => {
      if (elev == null) return;
      const d = distanceKm(point, { latitude: lat, longitude: lng });
      if (d <= maxKm && (!best || d < best.d)) best = { d, elev };
    };
    for (const place of t.library) consider(place.lat, place.lng, place.elevationM);
    for (const graph of t.trailGraphs) {
      for (const node of graph.nodes)
        consider(node.coords.latitude, node.coords.longitude, node.elevationM);
    }
    for (const track of t.tracks) {
      for (const p of track.points) consider(p.latitude, p.longitude, p.elevationM);
    }
    for (const poi of t.trackPois)
      consider(poi.coords.latitude, poi.coords.longitude, poi.elevationM);
    return best ? (best as { d: number; elev: number }).elev : null;
  }

  const forecast: WeatherRepository['forecast'] = async (coords, elevationM = null) => {
    await ctx.wait();
    const now = Date.now();
    const key = `weather:${coordKey(coords.latitude, coords.longitude)}:${elevationM ?? 'auto'}`;
    let result: WeatherForecast;
    try {
      const cached = await getCached(
        key,
        CACHE_TTL.weather,
        () => fetchOpenMeteoForecast(coords, { elevation: elevationM, now }),
        now,
      );
      result = cached.value;
    } catch {
      const elev = elevationM ?? (await nearestKnownElevation(coords, 15));
      result = mockForecast(coords, MOCK_SEED, now, elev);
    }
    result.alerts = computeAlerts(result);
    return result;
  };

  return {
    forecast,

    async elevation(points) {
      await ctx.wait();
      if (points.length === 0) return [];
      const key = `elevation:${points.map((p) => coordKey(p.latitude, p.longitude, 4)).join(';')}`;
      try {
        const cached = await getCached(key, CACHE_TTL.elevation, () =>
          fetchOpenMeteoElevation(points),
        );
        return cached.value;
      } catch {
        return Promise.all(points.map((p) => nearestKnownElevation(p)));
      }
    },

    async avalanche(coords) {
      await ctx.wait();
      const region = eawsRegionFor(coords);
      if (!region) return null;
      const now = Date.now();
      let bulletin: AvalancheBulletin | null = null;
      if (region.official && region.caamlUrl) {
        try {
          const cached = await getCached(
            `avalanche:${region.code}`,
            CACHE_TTL.avalanche,
            () => fetchEawsBulletin(region.code),
            now,
          );
          bulletin = cached.value;
        } catch {
          bulletin = null;
        }
      }
      if (!bulletin) {
        // Mock seviyesi için son 72 saatlik tahmini (mock/önbellek) kullan
        const fc = await forecast(coords);
        bulletin = mockAvalanche(coords, now, fc);
      }
      return bulletin;
    },
  };
}
