import type { TrailEdge, TrailGraph, TrailNode } from '../types';
import {
  difficultyOf,
  edgeDurationMin,
  elevationProfilePoints,
  fromGpx,
  isEdgeAllowed,
  nearestNode,
  packCoversPoint,
  packSizeEstimateMb,
  planRoute,
  routeStats,
  simplifyPoints,
  toGpx,
  toblerSpeedKmh,
} from '../routing';

/* Test grafı: A–B–C düz hat, A–D–C teknik kestirme (mtb için yasak), E kopuk */
const n = (id: string, lat: number, lng: number, ele: number): TrailNode => ({
  id,
  name: id,
  coords: { latitude: lat, longitude: lng },
  elevationM: ele,
});
const e = (
  id: string,
  from: string,
  to: string,
  distanceKm: number,
  extra: Partial<TrailEdge> = {},
): TrailEdge => ({
  id,
  from,
  to,
  distanceKm,
  surface: 'trail',
  profiles: ['hike', 'trail_run', 'mtb', 'gravel'],
  technical: 0.2,
  ...extra,
});

const graph: TrailGraph = {
  regionId: 'test',
  nodes: [
    n('A', 40.0, 30.0, 1000),
    n('B', 40.01, 30.0, 1050),
    n('C', 40.02, 30.0, 1100),
    n('D', 40.01, 30.01, 1300),
    n('E', 41.0, 31.0, 500),
  ],
  edges: [
    e('ab', 'A', 'B', 1.2),
    e('bc', 'B', 'C', 1.2),
    // Kısa ama teknik kaya kestirmesi
    e('ad', 'A', 'D', 0.8, { surface: 'rock', technical: 0.9, profiles: ['hike'] }),
    e('dc', 'D', 'C', 0.8, { surface: 'rock', technical: 0.9, profiles: ['hike'] }),
  ],
};

describe('Tobler süre modeli', () => {
  it('düz zeminde ~5 km/sa, dikleştikçe yavaşlar (monoton)', () => {
    expect(toblerSpeedKmh(0)).toBeCloseTo(5.04, 1);
    let prev = toblerSpeedKmh(-0.05);
    for (let slope = 0; slope <= 0.6; slope += 0.05) {
      const speed = toblerSpeedKmh(slope);
      expect(speed).toBeLessThan(prev);
      prev = speed;
    }
  });

  it('yokuş yukarı süre, düz kenardan uzun; yüzey çarpanı süreyi artırır', () => {
    const flat = edgeDurationMin(
      e('x', 'A', 'B', 1),
      n('A', 0, 0, 100),
      n('B', 0, 0.01, 100),
      'hike',
    )!;
    const up = edgeDurationMin(
      e('x', 'A', 'B', 1),
      n('A', 0, 0, 100),
      n('B', 0, 0.01, 250),
      'hike',
    )!;
    const scree = edgeDurationMin(
      e('x', 'A', 'B', 1, { surface: 'scree' }),
      n('A', 0, 0, 100),
      n('B', 0, 0.01, 100),
      'hike',
    )!;
    expect(up).toBeGreaterThan(flat);
    expect(scree).toBeGreaterThan(flat);
    expect(flat).toBeGreaterThan(10);
    expect(flat).toBeLessThan(16);
  });
});

describe('planRoute (A*)', () => {
  it('yürüyüş için en hızlı yolu bulur (kısa ama teknik kestirme değil)', () => {
    const r = planRoute(graph, 'A', 'C', 'hike')!;
    expect(r).not.toBeNull();
    expect(r.nodeIds).toEqual(['A', 'B', 'C']);
    expect(r.distanceKm).toBeCloseTo(2.4, 5);
    expect(r.ascentM).toBe(100);
    expect(r.descentM).toBe(0);
    expect(r.durationMin).toBeGreaterThan(25);
  });

  it('teknik kestirme cezası düşürülünce oraya sapar', () => {
    const easy: TrailGraph = {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === 'ad' || edge.id === 'dc' ? { ...edge, surface: 'trail', technical: 0 } : edge,
      ),
    };
    const flatD: TrailGraph = {
      ...easy,
      nodes: easy.nodes.map((node) => (node.id === 'D' ? { ...node, elevationM: 1050 } : node)),
    };
    expect(planRoute(flatD, 'A', 'C', 'hike')!.nodeIds).toEqual(['A', 'D', 'C']);
  });

  it('mtb teknik kenardan kaçınır; ski_tour patika kullanamaz', () => {
    const mtb = planRoute(graph, 'A', 'C', 'mtb')!;
    expect(mtb.nodeIds).toEqual(['A', 'B', 'C']);
    expect(isEdgeAllowed(graph.edges[2]!, 'mtb')).toBe(false);
    expect(isEdgeAllowed(graph.edges[2]!, 'hike')).toBe(true);
    expect(planRoute(graph, 'A', 'C', 'ski_tour')).toBeNull();
  });

  it('kopuk düğüm ve bilinmeyen düğüm için null döner; aynı düğüm için sıfır rota', () => {
    expect(planRoute(graph, 'A', 'E', 'hike')).toBeNull();
    expect(planRoute(graph, 'A', 'Z', 'hike')).toBeNull();
    const same = planRoute(graph, 'B', 'B', 'hike')!;
    expect(same.distanceKm).toBe(0);
    expect(same.nodeIds).toEqual(['B']);
  });
});

describe('routeStats / profil / zorluk', () => {
  it('yüzey dağılımı, profil noktaları ve min/max yükseklik', () => {
    const s = routeStats(graph, ['A', 'D', 'C'], 'hike');
    expect(s.surfaces.rock).toBeCloseTo(1.6, 5);
    expect(s.profile).toEqual([
      [0, 1000],
      [0.8, 1300],
      [1.6, 1100],
    ]);
    expect(s.maxElevationM).toBe(1300);
    expect(s.minElevationM).toBe(1000);
    expect(s.ascentM).toBe(300);
    expect(s.descentM).toBe(200);
  });

  it('SVG profil noktaları genişliğe/yüksekliğe sığar', () => {
    const s = routeStats(graph, ['A', 'D', 'C'], 'hike');
    const pts = elevationProfilePoints(s, 200, 100, 10);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 90 });
    expect(pts[1]).toEqual({ x: 100, y: 10 });
    expect(pts[2]!.x).toBe(200);
  });

  it('zorluk mesafe + tırmanış + teknik yüzeye göre artar', () => {
    const short = routeStats(graph, ['A', 'B'], 'hike');
    expect(difficultyOf(short)).toBe('easy');
    const big = { ...short, distanceKm: 22, ascentM: 1500, maxElevationM: 3000 };
    expect(difficultyOf(big)).toBe('expert');
    const technical = { ...short, distanceKm: 5, surfaces: { rock: 4, trail: 1 } };
    expect(difficultyOf(technical)).toBe('moderate');
  });

  it('en yakın düğüm', () => {
    expect(nearestNode(graph, { latitude: 40.011, longitude: 30.009 })?.id).toBe('D');
    expect(
      nearestNode({ regionId: 'x', nodes: [], edges: [] }, { latitude: 0, longitude: 0 }),
    ).toBeNull();
  });
});

describe('GPX', () => {
  it('gidiş-dönüş: toGpx → fromGpx koordinat ve yükseklikleri korur, adı kaçışlar', () => {
    const planned = planRoute(graph, 'A', 'C', 'hike')!;
    const xml = toGpx(planned, 'Zirve & "Test" <rota>');
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('&amp;');
    expect(xml).not.toContain('<rota>');
    const parsed = fromGpx(xml);
    expect(parsed.name).toBe('Zirve & "Test" <rota>');
    expect(parsed.points).toHaveLength(3);
    expect(parsed.points[0]).toEqual({ latitude: 40, longitude: 30, elevationM: 1000 });
    expect(parsed.points[2]!.elevationM).toBe(1100);
  });

  it('rtept ve eksiz noktaları da okur', () => {
    const xml = `<gpx><rte><rtept lat="1.5" lon="2.5"/><rtept lat="x" lon="3"/><rtept lat="1.6" lon="2.6"><ele>abc</ele></rtept></rte></gpx>`;
    const parsed = fromGpx(xml);
    expect(parsed.name).toBeNull();
    expect(parsed.points).toEqual([
      { latitude: 1.5, longitude: 2.5, elevationM: null },
      { latitude: 1.6, longitude: 2.6, elevationM: null },
    ]);
  });
});

describe('simplifyPoints (Douglas–Peucker)', () => {
  it('küçük sapmaları eler, uç noktaları ve köşeleri korur', () => {
    const line = Array.from({ length: 21 }, (_, i) => ({
      latitude: 40 + i * 0.001,
      longitude: 30 + (i % 2 ? 0.00002 : 0),
    }));
    const corner = { latitude: 40.02, longitude: 30.01 };
    const points = [...line, corner];
    const simplified = simplifyPoints(points, 15);
    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(corner);
    expect(simplified).toContainEqual(line[line.length - 1]);
    expect(simplifyPoints(points, 0.0001).length).toBeGreaterThan(simplified.length);
    expect(simplifyPoints(points.slice(0, 2), 10)).toHaveLength(2);
  });
});

describe('Harita paketleri', () => {
  it('packCoversPoint bbox kontrolü', () => {
    const pack = { bbox: [40.3, 40.55, 42.1, 41.35] as [number, number, number, number] };
    expect(packCoversPoint(pack, { latitude: 40.8355, longitude: 41.1583 })).toBe(true);
    expect(packCoversPoint(pack, { latitude: 36.5, longitude: 29.1 })).toBe(false);
    expect(packCoversPoint(pack, { latitude: 41.35, longitude: 40.3 })).toBe(true);
  });

  it('packSizeEstimateMb alan ve zoom ile büyür', () => {
    const small = packSizeEstimateMb([34.4, 38.35, 35.2, 38.95], 14);
    const big = packSizeEstimateMb([6.0, 45.8, 13.0, 47.8], 14);
    const deeper = packSizeEstimateMb([34.4, 38.35, 35.2, 38.95], 15);
    expect(small).toBeGreaterThan(5);
    expect(big).toBeGreaterThan(small * 10);
    expect(deeper).toBeGreaterThan(small * 2);
    expect(packSizeEstimateMb([0, 0, 0.001, 0.001], 10)).toBe(1);
  });
});
