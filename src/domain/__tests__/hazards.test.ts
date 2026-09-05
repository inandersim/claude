import { bearingDeg, isInsideHazard, selectHazards } from '../hazards';
import type { HazardZone } from '../types';

const base = (o: Partial<HazardZone>): HazardZone => ({
  id: 'h',
  type: 'rockfall',
  severity: 'medium',
  status: 'active',
  title: 't',
  description: '',
  locationName: '',
  coords: { latitude: 41, longitude: 29 },
  radiusM: 300,
  reporterId: 'u',
  confirmations: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: null,
  resolvedAt: null,
  ...o,
});

const origin = { latitude: 41, longitude: 29 };
const now = new Date('2026-09-05T12:00:00.000Z');

describe('selectHazards', () => {
  it('çözülmüş ve süresi dolmuş kayıtları eler', () => {
    const list = [
      base({ id: 'active' }),
      base({ id: 'resolved', status: 'resolved' }),
      base({ id: 'expired', expiresAt: '2026-09-05T11:00:00.000Z' }),
      base({ id: 'future', expiresAt: '2026-09-06T00:00:00.000Z' }),
    ];
    const ids = selectHazards({ hazards: list, origin, now }).map((x) => x.hazard.id);
    expect(ids).toEqual(['active', 'future']);
  });

  it('includeResolved ile çözülmüşleri de döner', () => {
    const list = [base({ id: 'a' }), base({ id: 'r', status: 'resolved' })];
    expect(selectHazards({ hazards: list, origin, now, includeResolved: true })).toHaveLength(2);
  });

  it('yarıçap dışını eler ve mesafe hesaplar', () => {
    const near = base({ id: 'near', coords: { latitude: 41.01, longitude: 29.01 } });
    const far = base({ id: 'far', coords: { latitude: 36.2, longitude: 29.6 } });
    const result = selectHazards({ hazards: [far, near], origin, radiusKm: 50, now });
    expect(result.map((x) => x.hazard.id)).toEqual(['near']);
    expect(result[0]?.distanceKm).toBeGreaterThan(1);
    expect(result[0]?.distanceKm).toBeLessThan(2);
  });

  it('önce şiddete, sonra mesafeye göre sıralar', () => {
    const list = [
      base({ id: 'low-near', severity: 'low', coords: { latitude: 41.001, longitude: 29 } }),
      base({ id: 'crit-far', severity: 'critical', coords: { latitude: 41.2, longitude: 29 } }),
      base({ id: 'crit-near', severity: 'critical', coords: { latitude: 41.01, longitude: 29 } }),
      base({ id: 'high', severity: 'high', coords: { latitude: 41.05, longitude: 29 } }),
    ];
    expect(selectHazards({ hazards: list, origin, now }).map((x) => x.hazard.id)).toEqual([
      'crit-near',
      'crit-far',
      'high',
      'low-near',
    ]);
  });

  it('origin yoksa mesafe null olur ve yarıçap filtresi uygulanmaz', () => {
    const result = selectHazards({ hazards: [base({})], origin: null, radiusKm: 1, now });
    expect(result).toHaveLength(1);
    expect(result[0]?.distanceKm).toBeNull();
  });
});

describe('isInsideHazard', () => {
  it('yarıçap içindeki noktayı tespit eder', () => {
    const h = base({ radiusM: 500 });
    expect(isInsideHazard({ latitude: 41.001, longitude: 29 }, h)).toBe(true);
    expect(isInsideHazard({ latitude: 41.01, longitude: 29 }, h)).toBe(false);
  });
});

describe('bearingDeg', () => {
  it('kuzeye 0°, doğuya ~90° verir', () => {
    expect(Math.round(bearingDeg(origin, { latitude: 42, longitude: 29 }))).toBe(0);
    expect(Math.round(bearingDeg(origin, { latitude: 41, longitude: 30 }))).toBeGreaterThan(85);
    expect(Math.round(bearingDeg(origin, { latitude: 41, longitude: 30 }))).toBeLessThan(95);
  });
});
