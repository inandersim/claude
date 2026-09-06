import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const antalya = { latitude: 36.8969, longitude: 30.7133 };

describe('Heritage provider', () => {
  it('liste, filtre, detay ve sesli rehber', async () => {
    const p = make();
    const all = await p.heritage.list(CURRENT_USER_ID, {});
    expect(all.length).toBeGreaterThanOrEqual(30);
    const unesco = await p.heritage.list(CURRENT_USER_ID, { unescoOnly: true, countryCode: 'TR' });
    expect(unesco.every((s) => s.isUnesco && s.countryCode === 'TR')).toBe(true);
    const near = await p.heritage.list(CURRENT_USER_ID, { origin: antalya });
    expect(near[0]?.id).toBe('her_perge');
    expect(near[0]?.distanceKm).toBeLessThan(20);

    const detail = await p.heritage.getById(CURRENT_USER_ID, 'her_efes', antalya);
    expect(detail?.history.length).toBeGreaterThan(600);
    expect(detail?.savedByMe).toBe(false);
    expect(await p.heritage.getById(CURRENT_USER_ID, 'yok', null)).toBeNull();

    const stops = await p.heritage.audioGuide('her_efes');
    expect(stops.length).toBeGreaterThanOrEqual(4);
    expect(stops.map((s) => s.order)).toEqual(stops.map((_, i) => i + 1));
    const guided = new Set(
      (await Promise.all(all.map((s) => p.heritage.audioGuide(s.id)))).filter((g) => g.length >= 4),
    );
    expect(guided.size).toBeGreaterThanOrEqual(8);
  });

  it('toggleSave', async () => {
    const p = make();
    expect(await p.heritage.toggleSave(CURRENT_USER_ID, 'her_patara')).toBe(true);
    expect((await p.heritage.getById(CURRENT_USER_ID, 'her_patara', null))?.savedByMe).toBe(true);
    expect(await p.heritage.toggleSave(CURRENT_USER_ID, 'her_patara')).toBe(false);
    expect((await p.heritage.getById(CURRENT_USER_ID, 'her_patara', null))?.savedByMe).toBe(false);
    await expect(p.heritage.toggleSave(CURRENT_USER_ID, 'yok')).rejects.toThrow();
  });

  it('markVisited XP verir, geri alınca XP kaldırılır', async () => {
    const p = make();
    const before = await p.fun.xpHistory(CURRENT_USER_ID);
    expect(await p.heritage.markVisited(CURRENT_USER_ID, 'her_gobeklitepe')).toBe(true);
    const after = await p.fun.xpHistory(CURRENT_USER_ID);
    expect(after.length).toBe(before.length + 1);
    expect(after[0]?.source).toBe('route');
    expect(after[0]?.amount).toBe(20);
    expect((await p.heritage.getById(CURRENT_USER_ID, 'her_gobeklitepe', null))?.visitedByMe).toBe(true);

    expect(await p.heritage.markVisited(CURRENT_USER_ID, 'her_gobeklitepe')).toBe(false);
    expect((await p.fun.xpHistory(CURRENT_USER_ID)).length).toBe(before.length);
  });

  it('createTour / tours / deleteTour', async () => {
    const p = make();
    const initial = await p.heritage.tours(CURRENT_USER_ID);
    expect(initial.length).toBe(1);
    expect(initial[0]?.siteIds.length).toBe(5);

    await expect(
      p.heritage.createTour(CURRENT_USER_ID, {
        title: 'x',
        siteIds: ['her_efes'],
        date: null,
        notes: '',
      }),
    ).rejects.toThrow();
    const tour = await p.heritage.createTour(CURRENT_USER_ID, {
      title: 'Pamfilya günü',
      siteIds: ['her_perge', 'her_aspendos', 'yok'],
      date: '2026-10-03',
      notes: ' Sabah erken ',
    });
    expect(tour.siteIds).toEqual(['her_perge', 'her_aspendos']);
    expect(tour.notes).toBe('Sabah erken');
    expect((await p.heritage.tours(CURRENT_USER_ID))[0]?.id).toBe(tour.id);

    await p.heritage.deleteTour(CURRENT_USER_ID, tour.id);
    expect((await p.heritage.tours(CURRENT_USER_ID)).length).toBe(1);
    await expect(p.heritage.deleteTour(CURRENT_USER_ID, tour.id)).rejects.toThrow();
  });

  it('nearby yarıçapa göre filtreler', async () => {
    const p = make();
    const near = await p.heritage.nearby(antalya, 60);
    expect(near.length).toBeGreaterThanOrEqual(3);
    expect(near.every((s) => (s.distanceKm ?? 0) <= 60)).toBe(true);
    expect(near.map((s) => s.id)).toContain('her_termessos');
  });
});
