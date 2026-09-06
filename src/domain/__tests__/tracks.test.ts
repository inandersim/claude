import type { LiveStream, Post, Story, Track, TrackPoi, TrackPoint } from '../types';
import {
  bearing,
  buildNavigation,
  clusterTracks,
  destinationPoint,
  detectAdventureType,
  maneuverFor,
  maskStart,
  mergeIntoExisting,
  parseGpxTrack,
  poiHeuristics,
  poisFromMedia,
  progressAlong,
  resample,
  simplifyTrack,
  snapToGridKey,
  stravaStreamsToPoints,
  trackOverlap,
  trackStats,
  trackToGraph,
  turnAngle,
  verifyThreshold,
} from '../tracks';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const ORIGIN = { latitude: 40.95, longitude: 41.1 };

/** Başlangıçtan verilen yönde `stepM` aralıklı düz hat (yükseklik + zaman ile) */
function line(
  bearingDeg: number,
  count: number,
  stepM = 50,
  start = ORIGIN,
  eleStart = 1000,
  elePerStep = 5,
): TrackPoint[] {
  const out: TrackPoint[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    out.push({
      latitude: cur.latitude,
      longitude: cur.longitude,
      elevationM: eleStart + i * elePerStep,
      t: 1_700_000_000_000 + i * 60_000,
    });
    cur = destinationPoint(cur, bearingDeg, stepM);
  }
  return out;
}

/** İki düz hattı birleştirir (ikinci hat ilkinin sonundan başlar) */
function bent(first: number, second: number, n1 = 12, n2 = 12): TrackPoint[] {
  const a = line(first, n1);
  const last = a[a.length - 1]!;
  const b = line(second, n2, 50, last, last.elevationM ?? 1000).slice(1);
  return [...a, ...b.map((p, i) => ({ ...p, t: (last.t ?? 0) + (i + 1) * 60_000 }))];
}

function track(id: string, points: TrackPoint[], extra: Partial<Track> = {}): Track {
  const stats = trackStats(points);
  return {
    id,
    userId: 'u_me',
    name: id,
    adventureType: 'hiking',
    source: 'recorded',
    status: 'published',
    points,
    distanceKm: stats.distanceKm,
    ascentM: stats.ascentM,
    descentM: stats.descentM,
    durationMin: stats.durationMin,
    maxElevationM: stats.maxElevationM,
    startedAt: '2026-08-01T05:00:00.000Z',
    regionName: 'Test',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 0,
    communityTrailId: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...extra,
  };
}

function poi(id: string, coords: { latitude: number; longitude: number }, name = id): TrackPoi {
  return {
    id,
    trackId: null,
    communityTrailId: null,
    userId: 'u_me',
    kind: 'water',
    coords,
    elevationM: null,
    name,
    note: '',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
  };
}

const localIso = (hour: number) => new Date(2026, 7, 1, hour, 0, 0).toISOString();

function story(id: string, caption: string, coords: Story['coords'], hour = 12): Story {
  return {
    id,
    authorId: 'u_elif',
    mediaUrl: null,
    mediaType: 'image',
    caption,
    adventureType: 'hiking',
    locationName: 'Kabak, Fethiye',
    coords,
    altitudeM: null,
    createdAt: localIso(hour),
    expiresAt: localIso(hour + 1),
    viewsCount: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Geometri & istatistik                                               */
/* ------------------------------------------------------------------ */

describe('geometri', () => {
  it('bearing / destinationPoint tutarlı', () => {
    const dest = destinationPoint(ORIGIN, 90, 1000);
    expect(bearing(ORIGIN, dest)).toBeCloseTo(90, 0);
    expect(turnAngle(350, 10)).toBe(20);
    expect(turnAngle(10, 350)).toBe(-20);
    expect(snapToGridKey(ORIGIN, 25)).toBe(
      snapToGridKey({ latitude: 40.95001, longitude: 41.10001 }, 25),
    );
  });

  it('trackStats: mesafe, 3 m gürültü filtresi, süre, max irtifa', () => {
    const pts = line(0, 21, 50); // 1 km, her adım +5 m
    const stats = trackStats(pts);
    expect(stats.distanceKm).toBeCloseTo(1, 1);
    expect(stats.ascentM).toBe(100);
    expect(stats.descentM).toBe(0);
    expect(stats.durationMin).toBe(20);
    expect(stats.maxElevationM).toBe(1100);
    expect(stats.avgSpeedKmh).toBeCloseTo(3, 0);

    // ±1 m gürültü (2 m salınım < 3 m eşik) tırmanışa sayılmaz
    const noisy = line(0, 10, 50, ORIGIN, 1000, 0).map((p, i) => ({
      ...p,
      elevationM: 1000 + (i % 2 === 0 ? 1 : -1),
    }));
    expect(trackStats(noisy).ascentM).toBe(0);
  });

  it('simplifyTrack yükseklik ve zamanı korur; resample eşit aralık üretir', () => {
    const pts = line(0, 30, 20);
    const simple = simplifyTrack(pts, 5);
    expect(simple.length).toBeLessThan(pts.length);
    expect(simple[0]!.t).toBe(pts[0]!.t);
    expect(simple[simple.length - 1]!.elevationM).toBe(pts[pts.length - 1]!.elevationM);
    const res = resample(pts, 100);
    expect(res.length).toBeGreaterThanOrEqual(6);
    expect(res.length).toBeLessThanOrEqual(8);
  });

  it('maskStart iki uçtan 300 m kırpar, kısa parçaya dokunmaz', () => {
    const pts = line(0, 41, 50); // 2 km
    const masked = maskStart(pts);
    expect(masked.length).toBeLessThan(pts.length);
    expect(masked[0]!.latitude).toBeGreaterThan(pts[0]!.latitude);
    expect(maskStart(line(0, 5, 50)).length).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/* Kümeleme                                                            */
/* ------------------------------------------------------------------ */

describe('clusterTracks', () => {
  it('çakışan iki parça → 1 topluluk rotası; farklı güzergâh ayrı kalır', () => {
    const a = track('a', bent(45, 120));
    // Aynı hat, 6 m yana kaydırılmış (GPS gürültüsü)
    const bPoints = bent(45, 120).map((p) => {
      const d = destinationPoint(p, 135, 6);
      return { ...p, latitude: d.latitude, longitude: d.longitude };
    });
    const b = track('b', bPoints, { userId: 'u_elif', likesCount: 3 });
    const far = track('c', line(0, 20, 50, { latitude: 41.5, longitude: 41.5 }));

    expect(trackOverlap(a.points, b.points)).toBeGreaterThanOrEqual(0.6);
    expect(trackOverlap(a.points, far.points)).toBe(0);

    const clusters = clusterTracks([a, b, far], { now: '2026-09-01T00:00:00.000Z' });
    expect(clusters).toHaveLength(1);
    const trail = clusters[0]!.trail;
    expect(clusters[0]!.trackIds.sort()).toEqual(['a', 'b']);
    expect(trail.trackCount).toBe(2);
    expect(trail.popularity).toBe(2 + 3);
    expect(trail.points.length).toBeGreaterThan(10);
    expect(trail.distanceKm).toBeCloseTo(a.distanceKm, 0);
    expect(trail.bbox[0]).toBeLessThan(trail.bbox[2]);
    expect(trail.bbox[1]).toBeLessThan(trail.bbox[3]);

    // Aynı girdi → aynı id (deterministik)
    const again = clusterTracks([b, a], { now: '2026-09-01T00:00:00.000Z' });
    expect(again[0]!.trail.id).toBe(trail.id);

    // Tek başına iki farklı parça → küme yok
    expect(clusterTracks([a, far])).toHaveLength(0);
  });

  it('mergeIntoExisting sayaçları artırır ve hattı korur', () => {
    const a = track('a', bent(45, 120));
    const [cluster] = clusterTracks([a, track('b', bent(45, 120), { userId: 'u_can' })]);
    const merged = mergeIntoExisting(cluster!.trail, track('c', bent(45, 120), { likesCount: 2 }));
    expect(merged.trackCount).toBe(3);
    expect(merged.popularity).toBe(cluster!.trail.popularity + 3);
    expect(merged.points).toHaveLength(cluster!.trail.points.length);
  });
});

/* ------------------------------------------------------------------ */
/* Medya POI                                                           */
/* ------------------------------------------------------------------ */

describe('poisFromMedia', () => {
  it('poiHeuristics: anahtar kelime > gece kuralı', () => {
    expect(poiHeuristics('Kabak Koyu’nda çadır kuruldu ⛺', 14)).toBe('campsite');
    expect(poiHeuristics('Zirvede gün doğumu', 5)).toBe('summit');
    expect(poiHeuristics('Muhteşem manzara', 12)).toBe('viewpoint');
    expect(poiHeuristics('Buz gibi pınar suyu', 12)).toBe('water');
    expect(poiHeuristics('Kaya düşmesi var, dikkat', 12)).toBe('danger');
    expect(poiHeuristics('Yorgunuz', 23)).toBe('campsite');
    expect(poiHeuristics('Yorgunuz', 12)).toBeNull();
  });

  it('sınıflandırır, 50 m tekilleştirir ve mevcut POI yakınını atlar', () => {
    const base = { latitude: 36.497, longitude: 29.139 };
    const near = destinationPoint(base, 90, 30);
    const farther = destinationPoint(base, 90, 200);
    const stories: Story[] = [
      story('st_tent', 'Çadır kuruldu ⛺', base, 23),
      story('st_dup', 'Kamp ateşi', near, 22), // daha eski + 30 m içinde → atlanır
      story('st_view', 'Manzara harika', farther, 11),
      story('st_none', 'Sıradan bir an', destinationPoint(base, 0, 500), 12), // ipucu yok
    ];
    const streams: LiveStream[] = [
      {
        id: 's_camp',
        hostId: 'u_kerem',
        title: 'Yüksek kamp canlı',
        description: 'çadırdayız',
        adventureType: 'hiking',
        status: 'live',
        locationName: 'Ağrı Dağı',
        coords: { latitude: 39.7, longitude: 44.3 },
        viewerCount: 0,
        peakViewers: 0,
        likesCount: 0,
        thumbnailUrl: null,
        playbackUrl: null,
        scheduledAt: null,
        startedAt: localIso(22),
        endedAt: null,
        altitudeM: 4200,
        source: 'camera',
      } as LiveStream,
    ];
    const posts: Post[] = [];
    const existing = [poi('poi_agri', { latitude: 39.7, longitude: 44.3 })];

    const out = poisFromMedia(stories, streams, posts, existing, {
      hourOf: (iso) => new Date(iso).getHours(),
    });
    const ids = out.map((p) => p.mediaId);
    expect(ids).toContain('st_tent');
    expect(ids).toContain('st_view');
    expect(ids).not.toContain('st_dup');
    expect(ids).not.toContain('st_none');
    expect(ids).not.toContain('s_camp'); // mevcut POI 50 m içinde
    const tent = out.find((p) => p.mediaId === 'st_tent')!;
    expect(tent.kind).toBe('campsite');
    expect(tent.source).toBe('story');
    expect(tent.name).toBe('Kabak');
    expect(out.find((p) => p.mediaId === 'st_view')!.kind).toBe('viewpoint');
  });
});

/* ------------------------------------------------------------------ */
/* Navigasyon                                                          */
/* ------------------------------------------------------------------ */

describe('navigasyon', () => {
  it('maneuverFor açı eşikleri', () => {
    expect(maneuverFor(10)).toBe('continue');
    expect(maneuverFor(35)).toBe('slight_right');
    expect(maneuverFor(-35)).toBe('slight_left');
    expect(maneuverFor(90)).toBe('right');
    expect(maneuverFor(-90)).toBe('left');
    expect(maneuverFor(140)).toBe('sharp_right');
    expect(maneuverFor(175)).toBe('uturn');
  });

  it('buildNavigation: start, dönüş, POI adımı ve arrive', () => {
    const pts = bent(0, 90); // kuzeye 550 m, sonra doğuya 550 m → sağa dönüş
    const corner = pts[11]!;
    const poiNearCorner = poi('p1', destinationPoint(corner, 45, 20), 'Köşe çeşmesi');
    const poiMid = poi('p2', destinationPoint(pts[17]!, 180, 30), 'Orta kamp');
    const steps = buildNavigation(pts, [poiNearCorner, poiMid]);

    expect(steps[0]!.maneuver).toBe('start');
    expect(steps[steps.length - 1]!.maneuver).toBe('arrive');
    const turn = steps.find((s) => s.maneuver === 'right')!;
    expect(turn).toBeDefined();
    expect(turn.poiName).toBe('Köşe çeşmesi');
    expect(turn.cumulativeM).toBeCloseTo(550, -1);
    const wp = steps.find((s) => s.maneuver === 'waypoint')!;
    expect(wp.poiName).toBe('Orta kamp');
    expect(wp.cumulativeM).toBeGreaterThan(turn.cumulativeM);
    // kümülatif mesafe artan sırada, distanceM toplamı rota uzunluğuna eşit
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.cumulativeM).toBeGreaterThanOrEqual(steps[i - 1]!.cumulativeM);
    const sum = steps.reduce((s, x) => s + x.distanceM, 0);
    expect(sum).toBeCloseTo(steps[steps.length - 1]!.cumulativeM, -1);
  });

  it('düz hat yalnızca start + arrive üretir', () => {
    const steps = buildNavigation(line(0, 20, 50));
    expect(steps.map((s) => s.maneuver)).toEqual(['start', 'arrive']);
  });

  it('progressAlong: ilerleme, adım geçişi, rotadan çıkış ve ETA', () => {
    const pts = bent(0, 90);
    const steps = buildNavigation(pts);
    const onRoute = progressAlong(pts, steps, destinationPoint(ORIGIN, 0, 300), 0);
    expect(onRoute.isOffRoute).toBe(false);
    expect(onRoute.offRouteM).toBeLessThan(5);
    expect(onRoute.remainingM).toBeCloseTo(800, -1);
    expect(onRoute.stepIndex).toBe(0);
    expect(onRoute.distanceToNextM).toBeCloseTo(250, -1);
    expect(onRoute.etaMin).toBeGreaterThan(10);

    const afterTurn = progressAlong(pts, steps, destinationPoint(pts[11]!, 90, 100), 0);
    expect(afterTurn.stepIndex).toBe(1);

    const off = progressAlong(pts, steps, destinationPoint(ORIGIN, 90, 150), 0);
    expect(off.isOffRoute).toBe(true);
    expect(off.offRouteM).toBeCloseTo(150, -1);

    // Adım indeksi geri gitmez
    const back = progressAlong(pts, steps, destinationPoint(ORIGIN, 0, 100), 1);
    expect(back.stepIndex).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* GPX / Strava / graf                                                 */
/* ------------------------------------------------------------------ */

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <metadata><name>Meta adı</name></metadata>
  <wpt lat="40.9500" lon="41.1000"><ele>1300</ele><name>Ayder çeşmesi</name><desc>Soğuk su</desc></wpt>
  <trk><name>Ayder &amp; Kavrun</name>
    <trkseg>
      <trkpt lat="40.9500" lon="41.1000"><ele>1300</ele><time>2026-08-15T05:40:00Z</time></trkpt>
      <trkpt lat="40.9490" lon="41.1010"><ele>1310.4</ele><time>2026-08-15T05:42:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="40.9480" lon="41.1020"><ele>1325</ele><time>2026-08-15T05:44:00Z</time></trkpt>
      <trkpt lat="bozuk" lon="41.1030"/>
    </trkseg>
  </trk>
</gpx>`;

describe('GPX / Strava / graf', () => {
  it('parseGpxTrack: segmentleri birleştirir, zamanı okur, wpt → POI adayı', () => {
    const parsed = parseGpxTrack(GPX);
    expect(parsed.name).toBe('Ayder & Kavrun');
    expect(parsed.points).toHaveLength(3);
    expect(parsed.points[1]!.elevationM).toBe(1310.4);
    expect(parsed.points[0]!.t).toBe(Date.parse('2026-08-15T05:40:00Z'));
    expect(parsed.waypoints).toHaveLength(1);
    expect(parsed.waypoints[0]!.kind).toBe('water');
    expect(parsed.waypoints[0]!.name).toBe('Ayder çeşmesi');
  });

  it('stravaStreamsToPoints ve detectAdventureType', () => {
    const pts = stravaStreamsToPoints(
      [
        [40.95, 41.1],
        [40.951, 41.1],
      ],
      [1000, 1005],
      [0, 60],
      1_700_000_000_000,
    );
    expect(pts).toHaveLength(2);
    expect(pts[1]!.t).toBe(1_700_000_000_000 + 60_000);
    expect(pts[1]!.elevationM).toBe(1005);

    const walk = line(0, 21, 50); // 3 km/sa
    expect(detectAdventureType(walk, trackStats(walk))).toBe('hiking');
    const ride = line(0, 21, 300); // 18 km/sa
    expect(detectAdventureType(ride, trackStats(ride))).toBe('cycling');
  });

  it('trackToGraph ardışık düğüm/kenar üretir', () => {
    const pts = line(0, 5, 100);
    const graph = trackToGraph({ id: 'ct_x', points: pts });
    expect(graph.regionId).toBe('ct_x');
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    expect(graph.edges[0]!.surface).toBe('trail');
    expect(graph.edges[0]!.profiles).toContain('hike');
    expect(graph.nodes[0]!.name).toBe('Start');
    expect(graph.edges[0]!.distanceKm).toBeCloseTo(0.1, 2);
  });

  it('verifyThreshold 3 doğrulamada true', () => {
    expect(verifyThreshold(2)).toBe(false);
    expect(verifyThreshold(3)).toBe(true);
  });
});
