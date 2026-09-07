import type { MapPack, TrailGraph } from '@/domain';
import { fallbackReason } from '@/features/maps/vector/fallback';
import {
  matchServerPack,
  pickLocalPack,
  pickServerPack,
  resolveSource,
  type ServerPack,
} from '@/features/maps/vector/source';

const graph: TrailGraph = {
  regionId: 'reg_uludag',
  nodes: [
    { id: 'n1', name: 'A', coords: { latitude: 40.1, longitude: 29.1 }, elevationM: 900 },
    { id: 'n2', name: 'B', coords: { latitude: 40.12, longitude: 29.14 }, elevationM: 1400 },
  ],
  edges: [
    {
      id: 'e1',
      from: 'n1',
      to: 'n2',
      distanceKm: 2,
      surface: 'trail',
      profiles: ['hike'],
      technical: 0.2,
    },
  ],
};

const center = { latitude: 40.11, longitude: 29.12 };

const localPack: MapPack = {
  id: 'pack_uludag',
  name: 'Uludağ',
  countryCode: 'TR',
  bbox: [29.0, 40.02, 29.45, 40.35],
  sizeMb: 24,
  version: '2026.09',
  format: 'pmtiles',
  status: 'downloaded',
  progress: 1,
  updatedAt: '2026-09-01T00:00:00.000Z',
  localPath: 'file:///map-packs/pack_uludag.pmtiles',
};

const serverPack: ServerPack = {
  id: 'uludag',
  format: 'pmtiles',
  sizeMb: 24,
  version: '2026.09',
  bbox: [29.1, 40.09, 29.4, 40.3],
  minzoom: 6,
  maxzoom: 14,
  url: '/tiles/uludag.pmtiles',
  graphUrl: '/graphs/uludag.json',
};

describe('zarif düşüş kararı', () => {
  const base = {
    hasSource: true,
    hasStyle: true,
    engineStatus: 'ready' as const,
    hasEngineComponent: true,
    failure: null,
  };

  it('her şey hazırsa vektör harita çizilir', () => {
    expect(fallbackReason(base)).toBeNull();
  });

  it('karo kaynağı yoksa SVG görünümüne düşülür', () => {
    expect(fallbackReason({ ...base, hasSource: false })).toBe('no-source');
  });

  it('stil çözülemezse SVG görünümüne düşülür', () => {
    expect(fallbackReason({ ...base, hasStyle: false })).toBe('style-error');
  });

  it('MapLibre yüklenemezse SVG görünümüne düşülür', () => {
    expect(fallbackReason({ ...base, engineStatus: 'unavailable' })).toBe('engine-unavailable');
    expect(fallbackReason({ ...base, hasEngineComponent: false })).toBe('engine-unavailable');
  });

  it('motor çalışma anında hata verirse bildirilen neden korunur', () => {
    expect(fallbackReason({ ...base, failure: 'style-error' })).toBe('style-error');
  });

  it('kaynak eksikliği motor hatasından önce gelir', () => {
    expect(
      fallbackReason({ ...base, hasSource: false, engineStatus: 'unavailable' }),
    ).toBe('no-source');
  });
});

describe('kaynak çözümleme kademeleri', () => {
  it('1. kademe: cihazdaki paket önceliklidir', () => {
    const resolved = resolveSource({
      center,
      localPacks: [localPack],
      serverPacks: [serverPack],
      graph,
      baseUrl: 'http://localhost:8090',
    });
    expect(resolved.kind).toBe('pack');
    expect(resolved.source).toEqual({ kind: 'pmtiles', url: localPack.localPath });
  });

  it('2. kademe: paket yoksa karo sunucusu kullanılır', () => {
    const resolved = resolveSource({
      center,
      localPacks: [],
      serverPacks: [serverPack],
      graph,
      baseUrl: 'http://localhost:8090',
    });
    expect(resolved.kind).toBe('server');
    expect(resolved.source).toEqual({
      kind: 'pmtiles',
      url: 'http://localhost:8090/tiles/uludag.pmtiles',
    });
  });

  it('cihazdaki paketin yükseklik dosyası varsa kabartma kaynağı da döner', () => {
    const resolved = resolveSource({
      center,
      localPacks: [localPack],
      serverPacks: [],
      graph,
      baseUrl: null,
      demPath: (id) => (id === localPack.id ? 'file:///packs/uludag-dem.pmtiles' : null),
    });
    expect(resolved.kind).toBe('pack');
    expect(resolved.demSource).toEqual({
      kind: 'pmtiles',
      url: 'file:///packs/uludag-dem.pmtiles',
    });
  });

  it('yükseklik dosyası inmemişse kabartma kaynağı boş kalır', () => {
    // Katman sessizce yanlış çizilmektense hiç çizilmemeli.
    const resolved = resolveSource({
      center,
      localPacks: [localPack],
      serverPacks: [],
      graph,
      baseUrl: null,
      demPath: () => null,
    });
    expect(resolved.kind).toBe('pack');
    expect(resolved.demSource).toBeNull();
  });

  it('karo sunucusu paketi yükseklik sunuyorsa adresi çözülür', () => {
    const resolved = resolveSource({
      center,
      localPacks: [],
      serverPacks: [{ ...serverPack, demUrl: '/tiles/uludag-dem.pmtiles' }],
      graph,
      baseUrl: 'http://localhost:8090',
    });
    expect(resolved.kind).toBe('server');
    expect(resolved.demSource).toMatchObject({
      kind: 'pmtiles',
      url: 'http://localhost:8090/tiles/uludag-dem.pmtiles',
    });
  });

  it('3. kademe: karo yoksa patika grafından GeoJSON üretilir', () => {
    const resolved = resolveSource({ center, graph, baseUrl: null });
    expect(resolved.kind).toBe('graph');
    expect(resolved.availableLayers).toEqual(['trails']);
    expect(resolved.source).toMatchObject({ kind: 'geojson' });
  });

  it('hiçbir kaynak yoksa "none" döner — MapView SVG çizer', () => {
    expect(resolveSource({ center, baseUrl: null }).kind).toBe('none');
    expect(resolveSource({ center: null, baseUrl: null }).source).toBeNull();
  });

  it('indirilmemiş paket kaynak sayılmaz', () => {
    const notInstalled = { ...localPack, status: 'available' as const, localPath: null };
    expect(pickLocalPack([notInstalled], center)).toBeNull();
    expect(resolveSource({ center, localPacks: [notInstalled], baseUrl: null }).kind).toBe('none');
  });

  it('sunucu paketi sınır kutusuna göre seçilir; en dar kapsayan kazanır', () => {
    const wide: ServerPack = { ...serverPack, id: 'marmara', bbox: [28, 39, 31, 41] };
    expect(pickServerPack([wide, serverPack], center)?.id).toBe('uludag');
    expect(pickServerPack([serverPack], { latitude: 36.5, longitude: 29.1 })).toBeNull();
  });

  it('uygulama paketi sunucudaki dosyayla kimlik ya da konum üzerinden eşleşir', () => {
    expect(matchServerPack([serverPack], localPack)?.id).toBe('uludag');
    expect(matchServerPack([{ ...serverPack, id: 'pack_uludag' }], localPack)?.id).toBe(
      'pack_uludag',
    );
    expect(matchServerPack([serverPack], { id: 'pack_likya', bbox: [28.9, 36.1, 30.9, 36.95] })).
      toBeNull();
  });
});
