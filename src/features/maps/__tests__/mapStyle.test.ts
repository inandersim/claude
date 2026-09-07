import rawStyle from '@/assets/map-style/zirtan-outdoor.json';
import type { Surface, TrailGraph } from '@/domain';
import { graphToGeoJson, nearestNode, sacScaleFor } from '@/features/maps/vector/graph-source';
import {
  DEM_SOURCE_ID,
  PACK_LAYERS,
  SLOPE_LAYER_IDS,
  SOURCE_ID,
  TERRAIN_LAYERS,
  resolveMapStyle,
  styleVariants,
} from '@/features/maps/vector/style';
import type { MapStyleSpec } from '@/features/maps/vector/types';

/** Belgede kalan çözülmemiş `@gösterge` var mı? */
function unresolvedTokens(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string' && value.startsWith('@')) found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => unresolvedTokens(v, found));
  else if (value && typeof value === 'object')
    Object.values(value as Record<string, unknown>).forEach((v) => unresolvedTokens(v, found));
  return found;
}

const graph: TrailGraph = {
  regionId: 'reg_test',
  nodes: [
    { id: 'n1', name: 'Başlangıç', coords: { latitude: 40.1, longitude: 29.1 }, elevationM: 900 },
    { id: 'n2', name: null, coords: { latitude: 40.11, longitude: 29.12 }, elevationM: 1100 },
    { id: 'n3', name: 'Zirve', coords: { latitude: 40.12, longitude: 29.14 }, elevationM: 1600 },
  ],
  edges: [
    {
      id: 'e1',
      from: 'n1',
      to: 'n2',
      distanceKm: 1.4,
      surface: 'trail' as Surface,
      profiles: ['hike'],
      technical: 0.2,
    },
    {
      id: 'e2',
      from: 'n2',
      to: 'n3',
      distanceKm: 1.1,
      surface: 'rock' as Surface,
      profiles: ['hike'],
      technical: 0.8,
    },
  ],
};

describe('zirtan-outdoor stili', () => {
  const style = rawStyle as unknown as MapStyleSpec;

  it('MapLibre stil sürümü 8 ve katmanlar benzersiz kimliklidir', () => {
    expect(style.version).toBe(8);
    const ids = style.layers.map((l) => l.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const layer of style.layers) {
      expect(typeof layer.id).toBe('string');
      expect(typeof layer.type).toBe('string');
    }
  });

  it('arka plan dışındaki her katman bilinen bir karo katmanına bağlanır', () => {
    // Bilinen katman listesi stil belgesinin kendi sözleşmesinden gelir; elle
    // sayılmaz, yoksa yeni bir katman eklendiğinde test sessizce eskir.
    const declared = (style.metadata as unknown as { 'zirtan:sourceLayers': string[] })[
      'zirtan:sourceLayers'
    ];
    expect(new Set(declared)).toEqual(new Set([...PACK_LAYERS, ...TERRAIN_LAYERS]));
    const known = new Set(declared);
    for (const layer of style.layers) {
      if (layer.type === 'background') continue;
      // Kabartma, karo paketine değil yükseklik (DEM) kaynağına bağlanır.
      if (layer.type === 'hillshade') {
        expect(layer.source).toBe('@dem');
        expect(layer['source-layer']).toBeUndefined();
        continue;
      }
      expect(layer.source).toBe('@source');
      expect(known.has(layer['source-layer'] as string)).toBe(true);
    }
  });

  it('kabartma gölgelendirme yalnızca DEM kaynağı varken çizilir', () => {
    const demsiz = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
    });
    expect(demsiz.layers.some((l) => l.type === 'hillshade')).toBe(false);
    expect(demsiz.sources[DEM_SOURCE_ID]).toBeUndefined();

    const demli = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      demSource: { kind: 'pmtiles', url: 'file:///x-dem.pmtiles' },
    });
    expect(demli.layers.some((l) => l.type === 'hillshade')).toBe(true);
    // Kodlama hattakiyle birebir aynı olmalı; uyuşmazsa harita çökmez, yanlış
    // arazi çizer — sessiz ve tehlikeli.
    expect(demli.sources[DEM_SOURCE_ID]).toMatchObject({
      type: 'raster-dem',
      encoding: 'terrarium',
      tileSize: 256,
    });
  });

  it('kabartma kapatılabilir ama DEM kaynağı 3B için kalır', () => {
    const style3d = resolveMapStyle({
      variant: 'dark',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      demSource: { kind: 'pmtiles', url: 'file:///x-dem.pmtiles' },
      hillshade: false,
      terrain3d: true,
      terrainExaggeration: 1.4,
    });
    expect(style3d.layers.some((l) => l.type === 'hillshade')).toBe(false);
    expect(style3d.terrain).toEqual({ source: DEM_SOURCE_ID, exaggeration: 1.4 });
  });

  it('DEM yokken 3B arazi bildirimi yazılmaz', () => {
    // Kaynağı olmayan `terrain`, MapLibre'de stilin tamamını düşürür.
    const style = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      terrain3d: true,
    });
    expect(style.terrain).toBeUndefined();
  });

  it('kabartma zeminin üstünde, arazi renklerinin altında kalır', () => {
    // Kabartma arazi renklerinin üstüne binerse harita gri bir kabartmaya döner.
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf('hillshade')).toBeGreaterThan(ids.indexOf('background'));
    expect(ids.indexOf('hillshade')).toBeLessThan(ids.indexOf('landuse-forest'));
  });

  it('eğim bantları çığ eşiklerini eksiksiz ve tek sefer kapsar', () => {
    const slopeLayers = style.layers.filter((l) => l['source-layer'] === 'slope');
    expect(slopeLayers.map((l) => l.id)).toEqual([...SLOPE_LAYER_IDS]);
    // Her katman tek bir banda bakmalı; iki katman aynı bandı boyarsa renk
    // üst üste biner ve eşik okunamaz hâle gelir.
    const bands = slopeLayers.map((l) => (l.filter as unknown[])[2]);
    expect(new Set(bands).size).toBe(bands.length);
    expect(bands).toEqual(['moderate', 'considerable', 'high', 'very_high', 'extreme']);
  });

  it('eğim gölgelendirmesi varsayılan kapalı, istenince açılır', () => {
    const kapali = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      availableLayers: [...PACK_LAYERS, ...TERRAIN_LAYERS],
    });
    const kapaliSlope = kapali.layers.filter((l) => SLOPE_LAYER_IDS.includes(l.id as never));
    expect(kapaliSlope.length).toBe(SLOPE_LAYER_IDS.length);
    for (const l of kapaliSlope) {
      expect((l.layout as { visibility?: string })?.visibility).toBe('none');
    }

    const acik = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      availableLayers: [...PACK_LAYERS, ...TERRAIN_LAYERS],
      slopeShading: true,
    });
    for (const l of acik.layers.filter((x) => SLOPE_LAYER_IDS.includes(x.id as never))) {
      expect((l.layout as { visibility?: string })?.visibility).toBe('visible');
    }
  });

  it('eğim ve eşyükselti katmanı olmayan eski paketlerde stil yine çözülür', () => {
    const eski = resolveMapStyle({
      variant: 'dark',
      source: { kind: 'pmtiles', url: 'file:///eski.pmtiles' },
      availableLayers: PACK_LAYERS,
      slopeShading: true,
    });
    expect(eski.layers.some((l) => SLOPE_LAYER_IDS.includes(l.id as never))).toBe(false);
    expect(eski.layers.some((l) => l.id === 'contour-line')).toBe(false);
    expect(eski.layers.length).toBeGreaterThan(5);
  });

  it('eğim katmanları patika ve yolların altında kalır', () => {
    // Eğim dolgusu patikanın üstüne binerse rota okunamaz hâle gelir.
    const ids = style.layers.map((l) => l.id);
    const enUstEgim = Math.max(...SLOPE_LAYER_IDS.map((id) => ids.indexOf(id)));
    for (const trail of ['trail-track', 'trail-path', 'road-fill']) {
      expect(ids.indexOf(trail)).toBeGreaterThan(enUstEgim);
    }
  });

  it('üç tema varyantı da aynı gösterge kümesini tanımlar', () => {
    const variants = styleVariants();
    expect(variants).toEqual(['light', 'dark', 'sun']);
    const meta = style.metadata as unknown as {
      'zirtan:variants': Record<string, Record<string, string>>;
    };
    const keys = Object.keys(meta['zirtan:variants'].light!).sort();
    for (const variant of variants) {
      expect(Object.keys(meta['zirtan:variants'][variant]!).sort()).toEqual(keys);
    }
  });

  it.each(styleVariants())('%s varyantı çözüldüğünde gösterge kalmaz', (variant) => {
    const resolved = resolveMapStyle({
      variant,
      source: { kind: 'pmtiles', url: 'https://cdn.example/uludag.pmtiles' },
    });
    expect(unresolvedTokens(resolved)).toEqual([]);
    expect(resolved.sources[SOURCE_ID]).toMatchObject({
      type: 'vector',
      url: 'pmtiles://https://cdn.example/uludag.pmtiles',
    });
  });

  it('bilinmeyen varyant hata verir', () => {
    expect(() =>
      resolveMapStyle({
        // @ts-expect-error kasıtlı geçersiz varyant
        variant: 'neon',
        source: { kind: 'pmtiles', url: 'x' },
      }),
    ).toThrow();
  });

  it('pakette olmayan katmanların stil katmanları atılır', () => {
    const resolved = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'x' },
      availableLayers: ['trails'],
    });
    const sourceLayers = resolved.layers
      .filter((l) => l.type !== 'background')
      .map((l) => l['source-layer']);
    expect(new Set(sourceLayers)).toEqual(new Set(['trails']));
  });

  it('GeoJSON kaynağında katman başına ayrı kaynak üretilir ve source-layer düşer', () => {
    const resolved = resolveMapStyle({
      variant: 'dark',
      source: { kind: 'geojson', data: graphToGeoJson(graph) },
      availableLayers: ['trails'],
    });
    expect(Object.keys(resolved.sources)).toEqual([`${SOURCE_ID}__trails`]);
    for (const layer of resolved.layers) {
      if (layer.type === 'background') continue;
      expect(layer.source).toBe(`${SOURCE_ID}__trails`);
      expect(layer['source-layer']).toBeUndefined();
    }
  });

  it('rota, iz ve işaret katmanları üst katman olarak eklenir', () => {
    const resolved = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'x' },
      overlay: {
        route: graph.nodes.map((n) => n.coords),
        track: graph.nodes.map((n) => n.coords),
        markers: [{ id: 'n1', coords: graph.nodes[0]!.coords, color: '#123456', kind: 'start' }],
        userLocation: { latitude: 40.1, longitude: 29.1 },
      },
    });
    const ids = resolved.layers.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'zirtan-ov-track',
        'zirtan-ov-route-halo',
        'zirtan-ov-route',
        'zirtan-ov-markers',
        'zirtan-ov-user',
      ]),
    );
    // Üst katmanlar en sonda: rota, karoların üstünde çizilmeli
    expect(ids.indexOf('zirtan-ov-route')).toBeGreaterThan(ids.indexOf('background'));
  });

  it('rotadan sapıldığında rota çizgisi uyarı rengine döner', () => {
    const build = (offRoute: boolean) =>
      resolveMapStyle({
        variant: 'light',
        source: { kind: 'pmtiles', url: 'x' },
        overlay: { route: graph.nodes.map((n) => n.coords), offRoute },
      }).layers.find((l) => l.id === 'zirtan-ov-route') as
        | { paint: Record<string, unknown> }
        | undefined;
    expect(build(false)?.paint['line-color']).not.toBe(build(true)?.paint['line-color']);
  });
});

describe('graf → GeoJSON kaynağı', () => {
  it('her kenar için OSM etiketli bir çizgi üretir', () => {
    const { trails } = graphToGeoJson(graph);
    expect(trails.features).toHaveLength(2);
    const [first, second] = trails.features;
    expect(first!.properties).toMatchObject({ highway: 'path', surface: 'ground' });
    expect(second!.properties.sac_scale).toBe('difficult_alpine_hiking');
    expect(first!.geometry.coordinates).toEqual([
      [29.1, 40.1],
      [29.12, 40.11],
    ]);
  });

  it('teknik puan SAC ölçeğine eşlenir', () => {
    expect(sacScaleFor(0)).toBe('hiking');
    expect(sacScaleFor(0.3)).toBe('mountain_hiking');
    expect(sacScaleFor(0.5)).toBe('demanding_mountain_hiking');
    expect(sacScaleFor(1)).toBe('difficult_alpine_hiking');
  });

  it('dokunulan noktaya en yakın düğümü bulur, uzaktaki dokunuş seçim saymaz', () => {
    expect(nearestNode(graph, { latitude: 40.119, longitude: 29.139 })?.id).toBe('n3');
    expect(nearestNode(graph, { latitude: 41.5, longitude: 30.5 })).toBeNull();
  });
});
