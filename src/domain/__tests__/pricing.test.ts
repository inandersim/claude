import {
  canAcceptPaidBookings,
  canUseDrone,
  nightsBetween,
  PLAN_SPECS,
  splitPayment,
  stayTotal,
  yearlySavings,
} from '../pricing';

describe('splitPayment', () => {
  it('ücretsiz planda %15, Pro Guide’da %5 komisyon uygular', () => {
    expect(splitPayment(1000, 'free')).toEqual({
      grossTry: 1000,
      commissionTry: 150,
      netTry: 850,
      rate: 0.15,
    });
    expect(splitPayment(1000, 'pro_guide')).toEqual({
      grossTry: 1000,
      commissionTry: 50,
      netTry: 950,
      rate: 0.05,
    });
    expect(splitPayment(1000, 'business').commissionTry).toBe(100);
  });
});

describe('stayTotal / nightsBetween', () => {
  it('gece × fiyat + %5 misafir ücreti', () => {
    expect(stayTotal(3200, 2)).toEqual({ subtotalTry: 6400, feeTry: 320, totalTry: 6720 });
  });
  it('gece sayısını tarihlerden hesaplar', () => {
    expect(nightsBetween('2026-10-01T12:00:00.000Z', '2026-10-04T10:00:00.000Z')).toBe(3);
    expect(nightsBetween('2026-10-04T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toBe(0);
  });
});

describe('plan yetenekleri', () => {
  it('yıllık tasarruf oranı ve yetkiler', () => {
    expect(yearlySavings('free')).toBe(0);
    expect(yearlySavings('pro')).toBeGreaterThan(0.3);
    expect(canUseDrone('pro')).toBe(false);
    expect(canUseDrone('pro_guide')).toBe(true);
    expect(canAcceptPaidBookings('business')).toBe(true);
    expect(PLAN_SPECS.pro.featureKeys).toContain('plans.f.offlineMaps');
  });
});
