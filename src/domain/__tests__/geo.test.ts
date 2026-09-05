import { DEFAULT_LOCATION, distanceKm, formatDistance } from '../geo';

describe('distanceKm', () => {
  it('aynı nokta için 0 döner', () => {
    expect(distanceKm(DEFAULT_LOCATION, DEFAULT_LOCATION)).toBe(0);
  });

  it('İstanbul–Ankara arası yaklaşık 350 km hesaplar', () => {
    const istanbul = { latitude: 41.0082, longitude: 28.9784 };
    const ankara = { latitude: 39.9334, longitude: 32.8597 };
    const d = distanceKm(istanbul, ankara);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(360);
  });

  it('simetriktir', () => {
    const a = { latitude: 36.2, longitude: 29.64 };
    const b = { latitude: 40.83, longitude: 41.12 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
});

describe('formatDistance', () => {
  it('1 km altını metre olarak gösterir', () => {
    expect(formatDistance(0.8)).toBe('800 m');
  });
  it('10 km altını bir ondalıkla, Türkçe ayraçla gösterir', () => {
    expect(formatDistance(4.26)).toBe('4,3 km');
    expect(formatDistance(4.26, 'en')).toBe('4.3 km');
  });
  it('10 km üstünü yuvarlar', () => {
    expect(formatDistance(62.4)).toBe('62 km');
  });
});
