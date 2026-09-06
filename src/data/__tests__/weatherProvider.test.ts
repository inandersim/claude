import { clearExternalCache } from '../external/cache';
import { createMockProvider } from '../mock/provider';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const uludag = { latitude: 40.07, longitude: 29.22 };
const innsbruck = { latitude: 47.27, longitude: 11.39 };

describe('Weather repository (ağ kapalı → mock)', () => {
  const originalFetch = globalThis.fetch;
  beforeAll(() => {
    globalThis.fetch = (() => Promise.reject(new Error('network disabled'))) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });
  beforeEach(async () => {
    await clearExternalCache();
  });

  it('forecast mock’a düşer, uyarıları hesaplar, verilen rakımı korur', async () => {
    const p = make();
    const f = await p.weather.forecast(uludag, 2100);
    expect(f.source).toBe('mock');
    expect(f.elevationM).toBe(2100);
    expect(f.hourly).toHaveLength(72);
    expect(f.daily).toHaveLength(7);
    expect(Array.isArray(f.alerts)).toBe(true);
    const again = await p.weather.forecast(uludag, 2100);
    expect(again.hourly[0]!.temperatureC).toBe(f.hourly[0]!.temperatureC);
  });

  it('elevation: bilinen kütüphane noktasından irtifa devralır, bilinmeyen null', async () => {
    const p = make();
    const agri = await p.library.getById('cur:peak:agri', null);
    expect(agri).not.toBeNull();
    const [known, unknown] = await p.weather.elevation([
      { latitude: agri!.lat, longitude: agri!.lng },
      { latitude: -45.0, longitude: 170.0 },
    ]);
    expect(known).toBe(agri!.elevationM);
    expect(unknown).toBeNull();
    expect(await p.weather.elevation([])).toEqual([]);
  });

  it('avalanche: bölge yoksa null, Türkiye resmi olmayan mock, Alpler EAWS başarısız → mock', async () => {
    const p = make();
    expect(await p.weather.avalanche({ latitude: 27.98, longitude: 86.92 })).toBeNull();
    const tr = await p.weather.avalanche(uludag);
    expect(tr).toMatchObject({ regionCode: 'TR-unofficial', source: 'mock' });
    const alps = await p.weather.avalanche(innsbruck);
    expect(alps).toMatchObject({ regionCode: 'EUREGIO', source: 'mock' });
    expect(alps!.url).toBe('https://avalanche.report');
  });
});
