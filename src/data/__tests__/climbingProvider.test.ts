import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const antalya = { latitude: 36.9, longitude: 30.7 };

describe('Climbing', () => {
  it('kaya listesi, filtre ve mesafe sıralaması', async () => {
    const p = make();
    const all = await p.climbing.crags({});
    expect(all.length).toBe(10);
    expect(all[0]?.distanceKm).toBeNull();
    const near = await p.climbing.crags({ origin: antalya });
    expect(near[0]?.id).toBe('c_geyik');
    expect(near[0]?.distanceKm).toBeLessThan(40);
    const boulder = await p.climbing.crags({ climbType: 'boulder', verifiedOnly: true });
    expect(boulder.every((c) => c.climbTypes.includes('boulder'))).toBe(true);
    expect(boulder.some((c) => c.id === 'c_karakaya')).toBe(false);
    const fr = await p.climbing.crags({ countryCode: 'FR' });
    expect(fr.map((c) => c.id)).toEqual(['c_font']);
  });

  it('sektör, rota ve detay; rota sayıları tutarlı', async () => {
    const p = make();
    const crag = await p.climbing.crag('c_geyik', antalya);
    const sectors = await p.climbing.sectors('c_geyik');
    const routes = await p.climbing.routes('c_geyik');
    expect(sectors.length).toBe(4);
    expect(routes.length).toBe(crag?.routeCount);
    expect(sectors.reduce((s, x) => s + x.routeCount, 0)).toBe(routes.length);
    const sarkit = await p.climbing.routes('c_geyik', 's_geyik_sarkit');
    expect(sarkit.every((r) => r.sectorId === 's_geyik_sarkit')).toBe(true);
    // kolaydan zora sıralı
    expect(sarkit.map((r) => r.grade)).toEqual(['6b', '7c', '8a']);
    const detail = await p.climbing.route('r_kalymnos_01');
    expect(detail?.crag.name).toBe('Kalymnos');
    expect(detail?.sector.name).toBe('Grande Grotta');
    expect(await p.climbing.route('yok')).toBeNull();
  });

  it('çıkış kaydı ascentCount artırır ve logbook’a düşer', async () => {
    const p = make();
    const before = await p.climbing.route('r_geyik_03');
    const mine = await p.climbing.myAscents(CURRENT_USER_ID);
    const logged = await p.climbing.logAscent(CURRENT_USER_ID, {
      routeId: 'r_geyik_03',
      style: 'redpoint',
      note: 'Sonunda!',
      feltGrade: '7a+',
    });
    expect(logged.user.id).toBe(CURRENT_USER_ID);
    const after = await p.climbing.route('r_geyik_03');
    expect(after?.ascentCount).toBe((before?.ascentCount ?? 0) + 1);
    const mineAfter = await p.climbing.myAscents(CURRENT_USER_ID);
    expect(mineAfter.length).toBe(mine.length + 1);
    expect(mineAfter[0]?.route.id).toBe('r_geyik_03');
    expect(mineAfter[0]?.crag.id).toBe('c_geyik');
    const ascents = await p.climbing.ascents('r_geyik_03');
    expect(ascents[0]?.id).toBe(logged.id);
  });

  it('rota gönderimi unverified başlar ve sayaçları günceller', async () => {
    const p = make();
    const cragBefore = await p.climbing.crag('c_datca', null);
    const route = await p.climbing.submitRoute(CURRENT_USER_ID, {
      cragId: 'c_datca',
      sectorId: 's_datca_kargi',
      name: 'Yeni Hat',
      type: 'sport',
      grade: '6b',
      gradeSystem: 'french',
      lengthM: 20,
      pitches: 1,
      description: '',
    });
    expect(route.verification).toBe('unverified');
    expect(route.submittedBy).toBe(CURRENT_USER_ID);
    const cragAfter = await p.climbing.crag('c_datca', null);
    expect(cragAfter?.routeCount).toBe((cragBefore?.routeCount ?? 0) + 1);
    const sector = (await p.climbing.sectors('c_datca')).find((s) => s.id === 's_datca_kargi');
    expect(sector?.routeCount).toBe(3);
    await expect(
      p.climbing.submitRoute(CURRENT_USER_ID, {
        cragId: 'c_datca',
        sectorId: 's_geyik_sarkit',
        name: 'Yanlış',
        type: 'sport',
        grade: '6b',
        gradeSystem: 'french',
        lengthM: null,
        pitches: 1,
        description: '',
      }),
    ).rejects.toThrow();
  });

  it('onay: eşik, tekrar ve kendi rotası kuralları', async () => {
    const p = make();
    // r_geyik_12: 2 onay, u_can gönderdi
    const confirmed = await p.climbing.confirmRoute(CURRENT_USER_ID, 'r_geyik_12');
    expect(confirmed.confirmations).toBe(3);
    expect(confirmed.verification).toBe('community');
    await expect(p.climbing.confirmRoute(CURRENT_USER_ID, 'r_geyik_12')).rejects.toThrow();
    // u_emre gönderdi: başkası onaylayabilir, kendisi onaylayamaz
    expect((await p.climbing.confirmRoute('u_can', 'r_datca_03')).confirmations).toBe(1);
    await expect(p.climbing.confirmRoute('u_emre', 'r_datca_03')).rejects.toThrow();
    // zaten onaylı rota
    await expect(p.climbing.confirmRoute(CURRENT_USER_ID, 'r_geyik_01')).rejects.toThrow();
  });

  it('kaya doğrulaması rota çoğunluğunu izler', async () => {
    const p = make();
    // Datça: 1 community + 3 unverified → unverified
    expect((await p.climbing.crag('c_datca', null))?.verification).toBe('unverified');
    await p.climbing.confirmRoute('u_lale', 'r_datca_02'); // 2
    await p.climbing.confirmRoute('u_kerem', 'r_datca_02'); // 3 → community
    expect((await p.climbing.crag('c_datca', null))?.verification).toBe('unverified');
    await p.climbing.confirmRoute('u_nil', 'r_datca_04'); // 3 → community; 3/4 community → community
    expect((await p.climbing.crag('c_datca', null))?.verification).toBe('community');
  });
});
