import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('Maps provider', () => {
  it('tohum verisi: 4 bölge, 8 paket, graf boyutları ve kayıtlı rotalar', async () => {
    const p = make();
    const regions = await p.maps.regions();
    expect(regions).toHaveLength(4);
    const packs = await p.maps.packs();
    expect(packs).toHaveLength(8);
    expect(packs.filter((x) => x.status === 'downloaded')).toHaveLength(1);
    expect(packs.filter((x) => x.status === 'update_available')).toHaveLength(1);
    for (const r of regions) {
      const g = await p.maps.graph(r.id);
      expect(g.nodes.length).toBeGreaterThanOrEqual(12);
      expect(g.nodes.length).toBeLessThanOrEqual(20);
      expect(g.edges.length).toBeGreaterThanOrEqual(15);
      expect(g.edges.length).toBeLessThanOrEqual(30);
      const ids = new Set(g.nodes.map((n) => n.id));
      expect(g.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    }
    const saved = await p.maps.savedRoutes(CURRENT_USER_ID);
    expect(saved).toHaveLength(2);
    expect(saved[0]!.planned.nodeIds.length).toBeGreaterThan(1);
  });

  it('rota planlama: zirve rotası, profil kısıtı ve hata', async () => {
    const p = make();
    const hike = await p.maps.plan('reg_kackar', 'kc_olgunlar', 'kc_zirve', 'hike');
    expect(hike.nodeIds[0]).toBe('kc_olgunlar');
    expect(hike.nodeIds[hike.nodeIds.length - 1]).toBe('kc_zirve');
    expect(hike.maxElevationM).toBe(3937);
    expect(hike.ascentM).toBeGreaterThan(1700);
    await expect(p.maps.plan('reg_kackar', 'kc_ayder', 'kc_zirve', 'mtb')).rejects.toThrow();
    await expect(p.maps.plan('reg_yok', 'a', 'b', 'hike')).rejects.toThrow();
    const gravel = await p.maps.plan('reg_likya', 'ly_ovacik', 'ly_bel', 'gravel');
    expect(gravel.surfaces.rock).toBeUndefined();
  });

  it('indirme simülasyonu: downloading → downloaded, kaldırma → available', async () => {
    const p = make();
    const started = await p.maps.download('pack_kapadokya');
    expect(started.status).toBe('downloading');
    expect(started.progress).toBe(0);
    await tick();
    const done = (await p.maps.packs()).find((x) => x.id === 'pack_kapadokya')!;
    expect(done.status).toBe('downloaded');
    expect(done.progress).toBe(1);
    expect(done.localPath).toBe('file:///maps/pack_kapadokya.pmtiles');

    const updated = await p.maps.download('pack_likya');
    expect(updated.version).toBe('2026.06');
    await tick();

    const removed = await p.maps.remove('pack_kapadokya');
    expect(removed.status).toBe('available');
    expect(removed.localPath).toBeNull();
    await expect(p.maps.download('pack_yok')).rejects.toThrow();
  });

  it('rota kaydetme ve silme', async () => {
    const p = make();
    const planned = await p.maps.plan('reg_kapadokya', 'kp_goreme', 'kp_uchisar', 'hike');
    const saved = await p.maps.saveRoute(CURRENT_USER_ID, {
      regionId: 'reg_kapadokya',
      name: '  Göreme → Uçhisar ',
      routeProfile: 'hike',
      planned,
    });
    expect(saved.name).toBe('Göreme → Uçhisar');
    const list = await p.maps.savedRoutes(CURRENT_USER_ID);
    expect(list[0]!.id).toBe(saved.id);
    await expect(
      p.maps.saveRoute(CURRENT_USER_ID, {
        regionId: 'reg_kapadokya',
        name: '',
        routeProfile: 'hike',
        planned,
      }),
    ).rejects.toThrow();
    await p.maps.deleteRoute(CURRENT_USER_ID, saved.id);
    expect((await p.maps.savedRoutes(CURRENT_USER_ID)).map((r) => r.id)).not.toContain(saved.id);
    await expect(p.maps.deleteRoute('u_elif', 'sr_kackar_zirve')).rejects.toThrow();
  });
});
