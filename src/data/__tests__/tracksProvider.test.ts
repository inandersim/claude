import { toGpx } from '@/domain/routing';
import { trackToPlanned } from '@/features/tracks/gpx';

import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';
import { seedTracks } from '../mock/seed.tracks';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ist = { latitude: 41.0, longitude: 29.0 };

const SMALL_GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <trk><name>Küçük tur</name><trkseg>
    <trkpt lat="40.9500" lon="41.1000"><ele>1300</ele><time>2026-08-15T05:40:00Z</time></trkpt>
    <trkpt lat="40.9490" lon="41.1010"><ele>1310</ele><time>2026-08-15T05:42:00Z</time></trkpt>
    <trkpt lat="40.9480" lon="41.1020"><ele>1325</ele><time>2026-08-15T05:44:00Z</time></trkpt>
  </trkseg></trk>
  <wpt lat="40.9490" lon="41.1010"><name>Çeşme</name></wpt>
</gpx>`;

describe('Tracks provider', () => {
  it('seed: liste, detay, topluluk rotaları ve yakınlık', async () => {
    const p = make();
    const mine = await p.tracks.list(CURRENT_USER_ID, { mineOnly: true });
    expect(mine).toHaveLength(3);
    expect(mine.every((t) => t.userId === CURRENT_USER_ID)).toBe(true);

    const all = await p.tracks.list(CURRENT_USER_ID, { origin: ist, radiusKm: 100 });
    // İstanbul çevresi: Aydos (taslak, kendi) + Belgrad
    expect(all.map((t) => t.id).sort()).toEqual(['trk_aydos_me', 'trk_belgrad_baris']);
    expect(all[0]!.distanceFromMeKm).not.toBeNull();

    const detail = await p.tracks.getById(CURRENT_USER_ID, 'trk_ayder_kavrun_me');
    expect(detail?.pois.length).toBeGreaterThanOrEqual(3);
    expect(detail?.status).toBe('verified'); // 4 doğrulamalı topluluk rotasına bağlı
    expect(detail?.communityTrailId).toBe('ct_ayder_kavrun');

    // Başkasının taslağı/gizlisi görünmez
    const trails = await p.tracks.communityTrails(CURRENT_USER_ID, null);
    expect(trails).toHaveLength(3);
    const ayder = trails.find((c) => c.id === 'ct_ayder_kavrun')!;
    expect(ayder.trackCount).toBe(2);
    expect(ayder.contributors.map((u) => u.id).sort()).toEqual(['u_elif', 'u_me']);
    expect(ayder.pois.length).toBeGreaterThanOrEqual(4);

    const near = await p.tracks.communityTrails(CURRENT_USER_ID, ist, 50);
    expect(near).toHaveLength(0);
  });

  it('importGpx → kaydeder, wpt POI olur, ad GPX’ten gelir', async () => {
    const p = make();
    const track = await p.tracks.importGpx(CURRENT_USER_ID, SMALL_GPX, 'komoot');
    expect(track.name).toBe('Küçük tur');
    expect(track.source).toBe('komoot');
    expect(track.status).toBe('draft');
    // Douglas–Peucker doğrusal orta noktayı atar; uçlar ve süre korunur
    expect(track.points).toHaveLength(2);
    expect(track.durationMin).toBe(4);
    expect(track.poiCount).toBe(1);
    const detail = await p.tracks.getById(CURRENT_USER_ID, track.id);
    expect(detail?.pois[0]?.name).toBe('Çeşme');
    expect(detail?.pois[0]?.source).toBe('track');

    await expect(p.tracks.importGpx(CURRENT_USER_ID, '<gpx></gpx>', 'gpx')).rejects.toThrow();
  });

  it('publish → aynı güzergâh yeni topluluk rotası türetir; remove geri alır', async () => {
    const p = make();
    const belgrad = seedTracks.find((t) => t.id === 'trk_belgrad_baris')!;
    const gpx = toGpx(trackToPlanned(belgrad.points), 'Belgrad kopyası');
    const imported = await p.tracks.importGpx(CURRENT_USER_ID, gpx, 'gpx');
    expect(imported.communityTrailId).toBeNull();

    const published = await p.tracks.publish(CURRENT_USER_ID, imported.id);
    expect(published.status).toBe('published');
    expect(published.isPublic).toBe(true);
    expect(published.communityTrailId).not.toBeNull();

    const trails = await p.tracks.communityTrails(CURRENT_USER_ID, null);
    expect(trails).toHaveLength(4);
    const created = trails.find((c) => c.id === published.communityTrailId)!;
    expect(created.trackCount).toBe(2);
    expect(created.contributors.map((u) => u.id).sort()).toEqual(['u_baris', 'u_me']);
    // Mevcut rotaların id'leri ve doğrulamaları korunur
    expect(trails.find((c) => c.id === 'ct_ayder_kavrun')?.verifiedCount).toBe(4);

    // Yayınlanan parça maskelendi ve sadeleştirildi (ham noktadan az)
    const detail = await p.tracks.getById(CURRENT_USER_ID, imported.id);
    expect(detail!.points.length).toBeLessThan(belgrad.points.length);

    await p.tracks.remove(CURRENT_USER_ID, imported.id);
    expect(await p.tracks.communityTrails(CURRENT_USER_ID, null)).toHaveLength(3);
    expect(await p.tracks.getById(CURRENT_USER_ID, imported.id)).toBeNull();
    await expect(p.tracks.remove(CURRENT_USER_ID, 'trk_belgrad_baris')).rejects.toThrow();
  });

  it('verifyTrail bir kez; eşikte parça durumu verified olur', async () => {
    const p = make();
    const before = await p.tracks.communityTrail(CURRENT_USER_ID, 'ct_kabak_alinca');
    expect(before?.verifiedCount).toBe(2);
    const after = await p.tracks.verifyTrail(CURRENT_USER_ID, 'ct_kabak_alinca');
    expect(after.verifiedCount).toBe(3);
    await expect(p.tracks.verifyTrail(CURRENT_USER_ID, 'ct_kabak_alinca')).rejects.toThrow();
    const track = await p.tracks.getById(CURRENT_USER_ID, 'trk_kabak_alinca_can');
    expect(track?.status).toBe('verified');
    const notifications = await p.notifications.list('u_can');
    expect(notifications.some((n) => n.targetId === 'ct_kabak_alinca')).toBe(true);
  });

  it('poisNear, addPoi ve confirmPoi (bir kez)', async () => {
    const p = make();
    const kackar = { latitude: 40.92, longitude: 41.13 };
    const near = await p.tracks.poisNear(CURRENT_USER_ID, kackar, 15);
    expect(near.length).toBeGreaterThanOrEqual(4);
    expect(near[0]!.distanceKm).toBeLessThanOrEqual(near[1]!.distanceKm ?? 0);
    const water = await p.tracks.poisNear(CURRENT_USER_ID, kackar, 15, 'water');
    expect(water.every((x) => x.kind === 'water')).toBe(true);
    expect(water.find((x) => x.id === 'poi_hazindak_water')?.confirmedByMe).toBe(true);

    const added = await p.tracks.addPoi(CURRENT_USER_ID, {
      trackId: 'trk_ayder_kavrun_me',
      communityTrailId: null,
      kind: 'shelter',
      coords: kackar,
      elevationM: 1900,
      name: 'Taş barınak',
      note: '',
      photoUrl: null,
      source: 'user',
      mediaId: null,
    });
    expect(added.communityTrailId).toBe('ct_ayder_kavrun');

    const confirmed = await p.tracks.confirmPoi('u_elif', added.id);
    expect(confirmed.confirmations).toBe(1);
    expect(confirmed.confirmedByMe).toBe(true);
    await expect(p.tracks.confirmPoi('u_elif', added.id)).rejects.toThrow();
    const notifications = await p.notifications.list(CURRENT_USER_ID);
    expect(notifications.some((n) => n.targetId === added.id)).toBe(true);
  });

  it('suggestedPoisFromMedia: anlardan kamp/manzara adayı, mevcut POI tekrarlanmaz', async () => {
    const p = make();
    const suggested = await p.tracks.suggestedPoisFromMedia(CURRENT_USER_ID, null);
    expect(suggested.length).toBeGreaterThan(0);
    const tent = suggested.find((s) => s.mediaId === 'st2');
    expect(tent?.kind).toBe('campsite');
    expect(tent?.source).toBe('story');
    // s1 (Ağrı kampı) zaten POI olarak kayıtlı → önerilmez
    expect(suggested.some((s) => s.mediaId === 's1')).toBe(false);
    expect(suggested.length).toBeLessThanOrEqual(12);
  });

  it('navigation ve toGraph', async () => {
    const p = make();
    const steps = await p.tracks.navigation('ct_ayder_kavrun', 'community');
    expect(steps[0]!.maneuver).toBe('start');
    expect(steps[steps.length - 1]!.maneuver).toBe('arrive');
    expect(steps.some((s) => s.poiName)).toBe(true);

    const trackSteps = await p.tracks.navigation('trk_kizilcukur_me', 'track');
    expect(trackSteps.length).toBeGreaterThan(2);

    const graph = await p.tracks.toGraph('ct_ayder_kavrun');
    expect(graph.regionId).toBe('ct_ayder_kavrun');
    expect(graph.edges.length).toBe(graph.nodes.length - 1);
    await expect(p.tracks.toGraph('yok')).rejects.toThrow();
  });
});
