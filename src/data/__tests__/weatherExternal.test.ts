import { computeAlerts } from '@/domain';

import caamlSample from '../external/__fixtures__/caaml-sample.json';
import openMeteoSample from '../external/__fixtures__/open-meteo-sample.json';
import { CACHE_TTL, clearExternalCache, coordKey, getCached } from '../external/cache';
import { parseCaaml, parseDangerValue, type CaamlDocument } from '../external/eaws';
import {
  buildElevationUrl,
  buildForecastUrl,
  localToIso,
  toForecast,
  type OpenMeteoForecastJson,
} from '../external/openMeteo';

const coords = { latitude: 40.65, longitude: 30.45 };

describe('Open-Meteo dönüştürücü', () => {
  it('localToIso yerel zamanı UTC ISO yapar', () => {
    expect(localToIso('2026-01-05T06:00', 10800)).toBe('2026-01-05T03:00:00.000Z');
    expect(localToIso('2026-01-05', 10800)).toBe('2026-01-04T21:00:00.000Z');
    expect(localToIso('2026-01-05T06:00:00Z', 10800)).toBe('2026-01-05T06:00:00.000Z');
  });

  it('toForecast fixture', () => {
    const f = toForecast(
      openMeteoSample as OpenMeteoForecastJson,
      coords,
      '2026-01-05T04:00:00.000Z',
    );
    expect(f.source).toBe('open-meteo');
    expect(f.timezone).toBe('Europe/Istanbul');
    expect(f.elevationM).toBe(1850);
    expect(f.hourly).toHaveLength(4);
    expect(f.daily).toHaveLength(2);
    expect(f.alerts).toEqual([]);
    const h2 = f.hourly[2]!;
    expect(h2.time).toBe('2026-01-05T05:00:00.000Z');
    expect(h2).toMatchObject({
      temperatureC: -2.1,
      apparentC: -8.3,
      precipitationMm: 1.2,
      precipitationProbability: 60,
      windKmh: 55.2,
      windGustKmh: 91.4,
      windDirectionDeg: 305,
      cloudCoverPct: 100,
      weatherCode: 73,
      snowfallCm: 0.84,
      freezingLevelM: 1420,
    });
    const d1 = f.daily[1]!;
    expect(d1.date).toBe('2026-01-05T21:00:00.000Z');
    expect(d1).toMatchObject({ minC: -8.9, maxC: -1.2, precipitationMm: 24.6, uvIndex: 1.4 });
    expect(d1.sunrise).toBe('2026-01-06T05:24:00.000Z');
    // uyarılar domain ile hesaplanır: 91 km/sa hamle → tehlike, 24,6 mm → yağış uyarısı
    const alerts = computeAlerts(f);
    expect(alerts.some((a) => a.kind === 'wind' && a.level === 'danger')).toBe(true);
    expect(alerts.some((a) => a.kind === 'rain' && a.level === 'warning')).toBe(true);
  });

  it('eksik alanları ve null değerleri tolere eder', () => {
    const f = toForecast(
      { latitude: 1, longitude: 2, hourly: { time: ['2026-01-05T06:00'], temperature_2m: [null] } },
      coords,
      '2026-01-05T04:00:00.000Z',
      2500,
    );
    expect(f.elevationM).toBe(2500);
    expect(f.hourly[0]).toMatchObject({ temperatureC: 0, freezingLevelM: null, windGustKmh: 0 });
    expect(f.daily).toEqual([]);
  });

  it('URL kurucular', () => {
    const url = buildForecastUrl(coords, 1850);
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain('latitude=40.6500');
    expect(url).toContain('freezing_level_height');
    expect(url).toContain('uv_index_max');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('elevation=1850');
    expect(buildForecastUrl(coords)).not.toContain('elevation=');
    const el = buildElevationUrl([coords, { latitude: 41, longitude: 29 }]);
    expect(el).toContain('latitude=40.65000%2C41.00000');
  });
});

describe('CAAML ayrıştırıcı', () => {
  it('parseDangerValue', () => {
    expect(parseDangerValue('considerable')).toBe(3);
    expect(parseDangerValue('Very High')).toBe(5);
    expect(parseDangerValue('4')).toBe(4);
    expect(parseDangerValue('weird')).toBeNull();
    expect(parseDangerValue(undefined)).toBeNull();
  });

  it('bölgeye göre bülten seçer; alt/üst bant, problemler ve özet', () => {
    const b = parseCaaml(caamlSample as CaamlDocument, 'AT-07', 'Tirol');
    expect(b).not.toBeNull();
    expect(b).toMatchObject({
      regionCode: 'AT-07',
      regionName: 'Tirol',
      dangerLevel: 2,
      dangerAbove: { elevationM: 2200, level: 3 },
      problems: ['wind_slab', 'persistent_weak_layers'],
      source: 'eaws',
      validFrom: '2026-01-05T16:00:00.000Z',
      validTo: '2026-01-06T16:00:00.000Z',
    });
    expect(b!.summary).toContain('Fresh wind slabs');
    expect(b!.summary).toContain('prone to triggering on steep shady slopes');
    expect(b!.url).toContain('avalanche.report');
  });

  it('tek bantlı bülten ve eşleşme yoksa ilk bülten', () => {
    const it = parseCaaml(caamlSample as CaamlDocument, 'IT-32');
    expect(it).toMatchObject({ dangerLevel: 1, dangerAbove: null, problems: [] });
    expect(it!.regionName).toBe('Val Müstair Alps');
    const fallback = parseCaaml(caamlSample as CaamlDocument, 'ZZ');
    expect(fallback!.dangerLevel).toBe(2);
    expect(parseCaaml({ bulletins: [] }, 'AT')).toBeNull();
    expect(parseCaaml({ bulletins: [{ dangerRatings: [] }] }, 'AT')).toBeNull();
  });
});

describe('TTL önbellek', () => {
  beforeEach(async () => {
    await clearExternalCache();
  });

  it('taze veriyi döner, süresi geçince yeniden yükler, hata olursa stale döner', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { n: calls };
    };
    const first = await getCached('k', 1000, loader, 1_000_000);
    expect(first).toMatchObject({ value: { n: 1 }, fromCache: false, stale: false });
    const second = await getCached('k', 1000, loader, 1_000_500);
    expect(second).toMatchObject({ value: { n: 1 }, fromCache: true, stale: false });
    const third = await getCached('k', 1000, loader, 1_002_000);
    expect(third).toMatchObject({ value: { n: 2 }, fromCache: false });
    const failing = async () => {
      throw new Error('offline');
    };
    const stale = await getCached('k', 1000, failing, 1_010_000);
    expect(stale).toMatchObject({ value: { n: 2 }, stale: true, storedAt: 1_002_000 });
    await expect(getCached('missing', 1000, failing)).rejects.toThrow('offline');
  });

  it('coordKey ve TTL sabitleri', () => {
    expect(coordKey(41.00821, 28.97835)).toBe('41.01,28.98');
    expect(CACHE_TTL.weather).toBe(30 * 60_000);
    expect(CACHE_TTL.elevation).toBe(30 * 24 * 3_600_000);
    expect(CACHE_TTL.avalanche).toBe(2 * 3_600_000);
  });
});
