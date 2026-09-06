import { isDaylight, schemeFromClock, schemeFromLux, sunTimesUtc } from '../ambient';

describe('ambient theme', () => {
  it('lux eşikleri ve histerezis', () => {
    expect(schemeFromLux(10, null)).toBe('dark');
    expect(schemeFromLux(500, null)).toBe('light');
    expect(schemeFromLux(5000, null)).toBe('sun');
    // sun modundayken küçük düşüşler modu değiştirmez
    expect(schemeFromLux(2600, 'sun')).toBe('sun');
    expect(schemeFromLux(1500, 'sun')).toBe('light');
    // dark modundayken küçük artışlar modu değiştirmez
    expect(schemeFromLux(28, 'dark')).toBe('dark');
    expect(schemeFromLux(60, 'dark')).toBe('light');
  });

  it('İstanbul için yaz gününde doğuş/batış makul aralıkta', () => {
    const t = sunTimesUtc(new Date(Date.UTC(2026, 5, 21, 12)), 41.0, 28.97);
    expect(t).not.toBeNull();
    expect(t!.sunriseH).toBeGreaterThan(2); // ~02:30 UTC (05:30 TRT)
    expect(t!.sunriseH).toBeLessThan(3.5);
    expect(t!.sunsetH).toBeGreaterThan(17); // ~17:40 UTC (20:40 TRT)
    expect(t!.sunsetH).toBeLessThan(18.5);
  });

  it('gündüz/gece kararı', () => {
    expect(isDaylight(new Date(Date.UTC(2026, 5, 21, 10)), 41, 29)).toBe(true);
    expect(isDaylight(new Date(Date.UTC(2026, 5, 21, 23)), 41, 29)).toBe(false);
    expect(schemeFromClock(new Date(Date.UTC(2026, 11, 21, 22)), 41, 29)).toBe('dark');
    // kutup gecesi: Tromsø aralık
    expect(isDaylight(new Date(Date.UTC(2026, 11, 21, 12)), 69.6, 18.9)).toBe(false);
  });
});
