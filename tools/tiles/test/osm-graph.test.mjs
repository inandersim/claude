import assert from 'node:assert/strict';
import { test } from 'node:test';

import { elevationProfile } from '../lib/elevation.mjs';
import {
  buildGraph,
  componentStats,
  distanceKm,
  largestComponent,
  nodeKey,
  profilesOf,
  simplifyGraph,
  surfaceOf,
  technicalOf,
} from '../lib/osm-graph.mjs';

/** İki noktalı basit bir yol üretir. */
const way = (id, coords, tags) => ({
  type: 'way',
  id,
  tags,
  geometry: coords.map(([lat, lon]) => ({ lat, lon })),
});

test('surfaceOf: OSM yüzey etiketlerini uygulama enum’una çevirir', () => {
  assert.equal(surfaceOf({ surface: 'asphalt' }), 'paved');
  assert.equal(surfaceOf({ surface: 'fine_gravel' }), 'gravel');
  assert.equal(surfaceOf({ surface: 'scree' }), 'scree');
  assert.equal(surfaceOf({ surface: 'ice' }), 'snow');
  assert.equal(surfaceOf({ highway: 'via_ferrata' }), 'rock');
  assert.equal(surfaceOf({ highway: 'path' }), 'trail');
  assert.equal(surfaceOf({ highway: 'secondary' }), 'paved');
  assert.equal(surfaceOf({}), 'trail');
});

test('technicalOf: SAC ölçeği ve görünürlük teknik puanı belirler', () => {
  assert.equal(technicalOf({ sac_scale: 'hiking' }), 0.05);
  assert.ok(technicalOf({ sac_scale: 'alpine_hiking' }) > technicalOf({ sac_scale: 'mountain_hiking' }));
  assert.equal(technicalOf({ highway: 'via_ferrata' }), 0.95);
  const clear = technicalOf({ sac_scale: 'mountain_hiking', trail_visibility: 'excellent' });
  const faint = technicalOf({ sac_scale: 'mountain_hiking', trail_visibility: 'horrible' });
  assert.ok(faint > clear, 'silik patika daha teknik olmalı');
  assert.ok(technicalOf({ sac_scale: 'difficult_alpine_hiking', ladder: 'yes' }) <= 1);
});

test('profilesOf: tekerlekli profiller merdiven ve ferratayı dışlar', () => {
  assert.deepEqual(profilesOf({ highway: 'steps' }).includes('mtb'), false);
  assert.deepEqual(profilesOf({ highway: 'via_ferrata' }), ['hike']);
  const track = profilesOf({ highway: 'track', surface: 'gravel' });
  assert.ok(track.includes('mtb') && track.includes('gravel'));
  assert.deepEqual(profilesOf({ highway: 'path', foot: 'no' }), []);
  assert.ok(profilesOf({ highway: 'path' }).includes('hike'));
});

test('distanceKm ve nodeKey', () => {
  const a = { latitude: 41, longitude: 29 };
  const b = { latitude: 41.01, longitude: 29 };
  assert.ok(Math.abs(distanceKm(a, b) - 1.112) < 0.01);
  assert.equal(distanceKm(a, a), 0);
  assert.equal(nodeKey({ latitude: 41.123456, longitude: 29.654321 }), '41.12346,29.65432');
});

test('buildGraph: paylaşılan koordinatta kavşak oluşur', () => {
  const elements = [
    way(1, [[40.0, 30.0], [40.001, 30.0], [40.002, 30.0]], { highway: 'path', name: 'Kuzey' }),
    way(2, [[40.001, 30.0], [40.001, 30.001]], { highway: 'path' }),
  ];
  const g = buildGraph(elements, { regionId: 'test' });
  assert.equal(g.regionId, 'test');
  assert.equal(g.nodes.length, 4, 'ortak düğüm tek kez sayılmalı');
  assert.equal(g.edges.length, 3);
  const junction = g.nodes.find((n) => n.degree === 3);
  assert.ok(junction, 'üç kenarlı kavşak bulunmalı');
  assert.ok(g.edges.every((e) => e.distanceKm > 0));
  assert.ok(g.edges.every((e) => e.profiles.includes('hike')));
});

test('buildGraph: geçilemeyen ve bozuk yolları atar', () => {
  const elements = [
    way(1, [[40, 30], [40.001, 30]], { highway: 'path', foot: 'no' }),
    way(2, [[40, 30]], { highway: 'path' }),
    { type: 'node', id: 3, lat: 40, lon: 30 },
    way(4, [[40, 30], [40.001, 30]], { highway: 'path', area: 'yes' }),
  ];
  const g = buildGraph(elements, { regionId: 'test' });
  assert.equal(g.edges.length, 0);
});

test('simplifyGraph: derecesi 2 olan ara düğümleri birleştirir', () => {
  const elements = [
    way(1, [[40, 30], [40.001, 30], [40.002, 30], [40.003, 30]], { highway: 'path' }),
  ];
  const g = buildGraph(elements, { regionId: 'test' });
  assert.equal(g.nodes.length, 4);
  const s = simplifyGraph(g);
  assert.equal(s.nodes.length, 2, 'yalnızca iki uç kalmalı');
  assert.equal(s.edges.length, 1);
  const total = g.edges.reduce((sum, e) => sum + e.distanceKm, 0);
  assert.ok(Math.abs(s.edges[0].distanceKm - total) < 0.001, 'mesafe korunmalı');
});

test('simplifyGraph: yüzey değişiminde ve isimli düğümde birleştirmez', () => {
  const mixed = buildGraph(
    [
      way(1, [[40, 30], [40.001, 30]], { highway: 'path', surface: 'ground' }),
      way(2, [[40.001, 30], [40.002, 30]], { highway: 'path', surface: 'scree' }),
    ],
    { regionId: 'test' },
  );
  assert.equal(simplifyGraph(mixed).nodes.length, 3, 'yüzey sınırı korunmalı');
});

test('componentStats ve largestComponent: kopuk adaları ayırır', () => {
  const g = buildGraph(
    [
      way(1, [[40, 30], [40.001, 30], [40.002, 30]], { highway: 'path' }),
      way(2, [[50, 20], [50.001, 20]], { highway: 'path' }),
    ],
    { regionId: 'test' },
  );
  const stats = componentStats(g);
  assert.equal(stats.components, 2);
  assert.equal(stats.largest, 3);
  const largest = largestComponent(g);
  assert.equal(largest.nodes.length, 3);
  assert.equal(largest.edges.length, 2);
  assert.ok(largest.nodes.every((n) => n.coords.latitude < 45));
});

test('elevationProfile: tırmanış ve inişi ayrı toplar', () => {
  const graph = {
    regionId: 'test',
    nodes: [
      { id: 'a', coords: { latitude: 40, longitude: 30 }, elevationM: 100, name: null },
      { id: 'b', coords: { latitude: 40.01, longitude: 30 }, elevationM: 350, name: null },
      { id: 'c', coords: { latitude: 40.02, longitude: 30 }, elevationM: 200, name: null },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', distanceKm: 1, surface: 'trail', profiles: ['hike'], technical: 0.2 },
      { id: 'e2', from: 'b', to: 'c', distanceKm: 1, surface: 'trail', profiles: ['hike'], technical: 0.2 },
    ],
  };
  const p = elevationProfile(graph);
  assert.equal(p.ascentM, 250);
  assert.equal(p.descentM, 150);
  assert.equal(p.minElevationM, 100);
  assert.equal(p.maxElevationM, 350);
});

test('graf çıktısı TrailGraph şekline uyar', () => {
  const g = buildGraph([way(1, [[40, 30], [40.001, 30]], { highway: 'path' })], { regionId: 'likya' });
  const [node] = g.nodes;
  assert.deepEqual(Object.keys(node).sort(), ['coords', 'degree', 'elevationM', 'id', 'name'].sort());
  assert.deepEqual(Object.keys(node.coords).sort(), ['latitude', 'longitude']);
  const [edge] = g.edges;
  assert.deepEqual(
    Object.keys(edge).sort(),
    ['distanceKm', 'from', 'id', 'profiles', 'surface', 'technical', 'to'].sort(),
  );
});

test('parseRange: HTTP Range başlığını çözer', async () => {
  const { parseRange } = await import('../serve.mjs');
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=0-9999', 1000), { start: 0, end: 999 }, 'aşan uç kırpılır');
  assert.equal(parseRange('bytes=900-100', 1000), null, 'ters aralık geçersiz');
  assert.equal(parseRange('bytes=2000-', 1000), null, 'dosya dışı geçersiz');
  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('saçma', 1000), null);
});

test('toGeoJson: node/way/alan geometrilerini ayırır', async () => {
  const { toGeoJson } = await import('../build-tiles.mjs');
  const fc = toGeoJson(
    [
      { type: 'node', id: 1, lat: 40, lon: 30, tags: { natural: 'peak', name: 'Zirve' } },
      { type: 'way', id: 2, tags: { highway: 'path' }, geometry: [{ lat: 40, lon: 30 }, { lat: 40.1, lon: 30.1 }] },
      {
        type: 'way', id: 3, tags: { natural: 'water' },
        geometry: [{ lat: 40, lon: 30 }, { lat: 40.1, lon: 30 }, { lat: 40.1, lon: 30.1 }, { lat: 40, lon: 30 }],
      },
    ],
    'poi',
  );
  assert.equal(fc.type, 'FeatureCollection');
  assert.deepEqual(fc.features.map((f) => f.geometry.type), ['Point', 'LineString', 'Polygon']);
  assert.equal(fc.features[0].properties.layer, 'poi');
  assert.equal(fc.features[0].properties.osm_id, 1);
});

test('listPacks: DEM paketin değil, kendi zum aralığını bildirir', async () => {
  // Gerçek hata: istemci DEM kaynağına vektör paketinin maxzoom'unu yazınca
  // MapLibre arşivde olmayan karoyu bekliyor, kaynak hiç yüklenmiş sayılmıyor,
  // harita `idle` olmuyor ve kabartma çizilmiyordu. Sunucu bu yüzden DEM'in
  // kendi aralığını ayrıca bildirmek zorunda.
  const { listPacks } = await import('../serve.mjs');
  const { packPmtiles } = await import('../lib/pmtiles-writer.mjs');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const dir = mkdtempSync(join(tmpdir(), 'zirtan-packs-'));
  try {
    const vektor = packPmtiles(
      new Map([['9/0/0', Buffer.from([1])], ['14/0/0', Buffer.from([2])]]),
      { minzoom: 9, maxzoom: 14, bbox: [29, 36, 30, 37], center: [29.5, 36.5, 11] },
    );
    const dem = packPmtiles(
      new Map([['9/0/0', Buffer.from([3])], ['10/0/0', Buffer.from([4])]]),
      {
        minzoom: 9,
        maxzoom: 10,
        bbox: [29, 36, 30, 37],
        center: [29.5, 36.5, 10],
        tileType: 'png',
      },
    );
    writeFileSync(join(dir, 'likya.pmtiles'), vektor.buffer);
    writeFileSync(join(dir, 'likya-dem.pmtiles'), dem.buffer);

    const packs = listPacks(dir, dir);
    assert.equal(packs.length, 1, 'DEM dosyası ayrı paket olarak listelenmemeli');
    const [p] = packs;
    assert.equal(p.id, 'likya');
    assert.equal(p.maxzoom, 14);
    assert.equal(p.demUrl, '/tiles/likya-dem.pmtiles');
    assert.equal(p.demMinzoom, 9);
    assert.equal(p.demMaxzoom, 10);
    assert.notEqual(p.demMaxzoom, p.maxzoom, 'DEM aralığı paketinkinden kopyalanmamalı');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listPacks: DEM yoksa alanlar null kalır', async () => {
  const { listPacks } = await import('../serve.mjs');
  const { packPmtiles } = await import('../lib/pmtiles-writer.mjs');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const dir = mkdtempSync(join(tmpdir(), 'zirtan-packs-'));
  try {
    writeFileSync(
      join(dir, 'uludag.pmtiles'),
      packPmtiles(new Map([['9/0/0', Buffer.from([1])]]), {
        minzoom: 9,
        maxzoom: 9,
        bbox: [29, 40, 30, 41],
        center: [29.5, 40.5, 9],
      }).buffer,
    );
    const [p] = listPacks(dir, dir);
    assert.equal(p.demUrl, null);
    assert.equal(p.demMinzoom, null);
    assert.equal(p.demMaxzoom, null);
    assert.equal(p.demSizeBytes, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
