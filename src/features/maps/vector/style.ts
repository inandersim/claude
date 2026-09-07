import baseStyle from '@/assets/map-style/zirtan-outdoor.json';
import { deepClone } from '@/core/utils/clone';
import type { GeoPoint } from '@/domain';

import type {
  GeoJsonCollection,
  GeoJsonFeature,
  MapDemSource,
  MapMarker,
  MapSource,
  MapStyleSpec,
  MapStyleVariant,
} from './types';

/** Stil içinde temel karo kaynağının adı. */
export const SOURCE_ID = 'zirtan-outdoor';
/** Yükseklik (DEM) kaynağının adı — kabartma ve 3B arazi bunu kullanır. */
export const DEM_SOURCE_ID = 'zirtan-dem';
/** Karo paketinin taşıdığı katmanlar (tools/tiles/build-tiles.mjs ile aynı). */
export const PACK_LAYERS = ['trails', 'roads', 'water', 'landuse', 'poi'];

/**
 * Arazi katmanları: OpenStreetMap'ten değil, DEM'den hesaplanır
 * (`tools/tiles/build-tiles.mjs --terrain`). Eski paketlerde bulunmayabilir;
 * stil çözümleyici bulunmayan katmanı zaten atar.
 */
export const TERRAIN_LAYERS = ['contours', 'slope'] as const;

/** Eğim gölgelendirmesinin stildeki katman kimlikleri (çığ bantları). */
export const SLOPE_LAYER_IDS = [
  'slope-moderate',
  'slope-considerable',
  'slope-high',
  'slope-very_high',
  'slope-extreme',
] as const;

const OVERLAY_PREFIX = 'zirtan-ov';

interface StyleMetadata {
  'zirtan:variants': Record<MapStyleVariant, Record<string, string>>;
  'zirtan:sourceLayers'?: string[];
}

/** Ham stil belgesi (renkler hâlâ `@token`). */
export function rawMapStyle(): MapStyleSpec {
  return baseStyle as unknown as MapStyleSpec;
}

/** Stil dosyasının tanımladığı varyantlar. */
export function styleVariants(): MapStyleVariant[] {
  const meta = (baseStyle as unknown as MapStyleSpec).metadata as unknown as StyleMetadata;
  return Object.keys(meta['zirtan:variants']) as MapStyleVariant[];
}

/** `@token` göstergelerini varyant paletinden çözer; diğer değerleri olduğu gibi bırakır. */
function substitute(value: unknown, tokens: Record<string, string>): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith('@')) return value;
    const token = tokens[value.slice(1)];
    if (token === undefined) throw new Error(`Stil göstergesi tanımsız: ${value}`);
    return token;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, tokens));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substitute(v, tokens);
    }
    return out;
  }
  return value;
}

/** Kaynak türüne göre MapLibre kaynak tanımları. */
function sourcesFor(
  source: MapSource,
  attribution: string,
): {
  sources: Record<string, Record<string, unknown>>;
  sourceOf: (layer: string) => string | null;
} {
  if (source.kind === 'geojson') {
    const sources: Record<string, Record<string, unknown>> = {};
    for (const [layer, data] of Object.entries(source.data)) {
      if (!data) continue;
      sources[`${SOURCE_ID}__${layer}`] = { type: 'geojson', data, attribution };
    }
    return {
      sources,
      sourceOf: (layer) => (sources[`${SOURCE_ID}__${layer}`] ? `${SOURCE_ID}__${layer}` : null),
    };
  }
  const spec: Record<string, unknown> =
    source.kind === 'pmtiles'
      ? { type: 'vector', url: `pmtiles://${source.url}`, attribution }
      : {
          type: 'vector',
          tiles: source.tiles,
          minzoom: source.minzoom ?? 6,
          maxzoom: source.maxzoom ?? 14,
          attribution,
        };
  return { sources: { [SOURCE_ID]: spec }, sourceOf: () => SOURCE_ID };
}

export interface ResolveOptions {
  variant: MapStyleVariant;
  source: MapSource;
  /** Karo paketinde gerçekten bulunan katmanlar; verilmezse `PACK_LAYERS` */
  availableLayers?: string[];
  attribution?: string;
  overlay?: MapOverlay;
  /**
   * Eğim açısı gölgelendirmesi (çığ bantları) açık mı?
   *
   * Varsayılan **kapalı**: 30–45° bantları kışın hayat kurtarır ama yazın
   * haritayı okunmaz hâle getirir. Kullanıcı açıkça açar.
   */
  slopeShading?: boolean;
  /** Yükseklik karosu; yoksa kabartma ve 3B arazi katmanları atılır */
  demSource?: MapDemSource | null;
  /** Kabartma gölgelendirme; DEM varsa varsayılan açık */
  hillshade?: boolean;
  /** 3B arazi; varsayılan kapalı (pil ve GPU maliyeti) */
  terrain3d?: boolean;
  /** 3B abartma katsayısı (1 = gerçek ölçek) */
  terrainExaggeration?: number;
}

/**
 * MapLibre `raster-dem` kaynağı.
 *
 * `tileSize: 256` ve `encoding: 'terrarium'`, `tools/tiles/lib/terrain-rgb.mjs`
 * ile birebir eşleşmek zorundadır: kodlama uyuşmazsa harita çöker değil,
 * **yanlış** arazi çizer — sessiz ve tehlikeli bir hata.
 */
function demSourceSpec(dem: MapDemSource, attribution: string): Record<string, unknown> {
  const base = {
    type: 'raster-dem',
    encoding: 'terrarium',
    tileSize: 256,
    // Üretilen arşiv bu zumun üstünü taşımaz; MapLibre üstünü büyüterek kullanır.
    maxzoom: dem.maxzoom ?? 12,
    attribution,
  };
  return dem.kind === 'pmtiles'
    ? { ...base, url: `pmtiles://${dem.url}` }
    : { ...base, tiles: dem.tiles };
}

/**
 * Gömülü outdoor stilini tema varyantı ve kaynak türüne göre çalıştırılabilir
 * MapLibre stiline dönüştürür. Kaynakta bulunmayan katmanlar atılır — aksi hâlde
 * MapLibre "source-layer yok" hatası basar.
 */
export function resolveMapStyle(options: ResolveOptions): MapStyleSpec {
  const {
    variant,
    source,
    availableLayers = PACK_LAYERS,
    attribution = '© OpenStreetMap katkıcıları',
    overlay,
    slopeShading = false,
    demSource = null,
    hillshade = true,
    terrain3d = false,
    terrainExaggeration = 1,
  } = options;
  const base = deepClone(baseStyle as unknown as MapStyleSpec);
  const meta = base.metadata as unknown as StyleMetadata;
  const palette = meta['zirtan:variants'][variant];
  if (!palette) throw new Error(`Bilinmeyen stil varyantı: ${variant}`);
  // `@source` gerçek kaynak adıyla katman katman değiştirilir; burada yalnızca
  // yer tutucu olarak çözülür ki gösterge taraması tek geçişte kalsın.
  const tokens = { ...palette, source: SOURCE_ID, dem: DEM_SOURCE_ID };

  const { sources, sourceOf } = sourcesFor(source, attribution);
  const layers: Record<string, unknown>[] = [];
  for (const raw of base.layers) {
    const layer = substitute(raw, tokens) as Record<string, unknown>;
    if (layer.type === 'background') {
      layers.push(layer);
      continue;
    }
    // Kabartma katmanının `source-layer`ı yoktur; DEM kaynağına bağlıdır.
    if (layer.type === 'hillshade') {
      if (demSource && hillshade) layers.push(layer);
      continue;
    }
    const sourceLayer = layer['source-layer'] as string | undefined;
    if (!sourceLayer || !availableLayers.includes(sourceLayer)) continue;
    const mapped = sourceOf(sourceLayer);
    if (!mapped) continue;
    layer.source = mapped;
    if (source.kind === 'geojson') delete layer['source-layer'];
    // Eğim bantları stilde kapalı tanımlıdır; açılmasını kullanıcı ister.
    if (sourceLayer === 'slope') {
      layer.layout = { ...(layer.layout as object), visibility: slopeShading ? 'visible' : 'none' };
    }
    layers.push(layer);
  }

  if (demSource) {
    sources[DEM_SOURCE_ID] = demSourceSpec(demSource, attribution);
  }

  const style: MapStyleSpec = {
    version: 8,
    name: base.name,
    metadata: { 'zirtan:variant': variant },
    sources,
    layers,
  };

  // 3B arazi yalnızca DEM varken açılabilir; kaynağı olmayan `terrain` bildirimi
  // MapLibre'de stilin tamamını düşürür.
  if (demSource && terrain3d) {
    style.terrain = { source: DEM_SOURCE_ID, exaggeration: terrainExaggeration };
  }
  if (overlay) applyOverlay(style, overlay, palette, variant);
  return style;
}

/* ------------------------------------------------------------------ */
/* Üst katman: rota, iz, işaretler, kullanıcı konumu                   */
/* ------------------------------------------------------------------ */

export interface MapOverlay {
  route?: GeoPoint[];
  routeDone?: GeoPoint[];
  track?: GeoPoint[];
  markers?: MapMarker[];
  userLocation?: GeoPoint | null;
  offRoute?: boolean;
  /** Tema renkleri — rota/konum vurgusu uygulamanın paletiyle aynı olsun diye */
  colors?: { route: string; track: string; user: string; danger: string; halo: string };
}

const DEFAULT_COLORS: Record<MapStyleVariant, MapOverlay['colors']> = {
  light: {
    route: '#2F7D4F',
    track: '#E8722A',
    user: '#3A8DDE',
    danger: '#D8443C',
    halo: '#FFFFFF',
  },
  dark: { route: '#6FD59A', track: '#F5A05A', user: '#7CBCFF', danger: '#FF7A70', halo: '#0B1210' },
  sun: { route: '#0F6B36', track: '#C24E00', user: '#0B4FA8', danger: '#B80000', halo: '#FFFFFF' },
};

const line = (points: GeoPoint[]): GeoJsonCollection => ({
  type: 'FeatureCollection',
  features:
    points.length >= 2
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: points.map((p) => [p.longitude, p.latitude] as [number, number]),
            },
            properties: {},
          },
        ]
      : [],
});

const points = (markers: MapMarker[], defaultStroke = '#FFFFFF'): GeoJsonCollection => ({
  type: 'FeatureCollection',
  features: markers.map((m): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.coords.longitude, m.coords.latitude] },
    properties: {
      id: m.id,
      color: m.color,
      label: m.label ?? '',
      kind: m.kind ?? 'poi',
      size: m.kind === 'start' || m.kind === 'end' ? 8 : 6,
    },
  })),
});

/** Rota/iz/işaret katmanlarını hazır stile ekler (aynı kod hem web hem yerelde). */
export function applyOverlay(
  style: MapStyleSpec,
  overlay: MapOverlay,
  tokens: Record<string, string>,
  variant: MapStyleVariant,
): MapStyleSpec {
  const colors = overlay.colors ?? DEFAULT_COLORS[variant] ?? DEFAULT_COLORS.light;
  if (!colors) return style;
  const routeColor = overlay.offRoute ? colors.danger : colors.route;

  const add = (id: string, data: GeoJsonCollection, layer: Record<string, unknown>) => {
    style.sources[`${OVERLAY_PREFIX}-${id}`] = { type: 'geojson', data };
    style.layers.push({
      id: `${OVERLAY_PREFIX}-${id}`,
      source: `${OVERLAY_PREFIX}-${id}`,
      ...layer,
    });
  };

  if (overlay.track?.length) {
    add('track', line(overlay.track), {
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.track, 'line-width': 3, 'line-opacity': 0.9 },
    });
  }

  if (overlay.route?.length) {
    add('route-halo', line(overlay.route), {
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.halo, 'line-width': 8, 'line-opacity': 0.75 },
    });
    add('route', line(overlay.route), {
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': routeColor, 'line-width': 4.5 },
    });
  }

  if (overlay.routeDone?.length) {
    add('route-done', line(overlay.routeDone), {
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': routeColor, 'line-width': 4.5, 'line-opacity': 0.35 },
    });
  }

  if (overlay.markers?.length) {
    add('markers', points(overlay.markers, tokens.poiStroke ?? colors.halo), {
      type: 'circle',
      paint: {
        'circle-radius': ['get', 'size'],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': ['get', 'stroke'],
        'circle-stroke-width': 2,
      },
    });
  }

  if (overlay.userLocation) {
    const userColor = overlay.offRoute ? colors.danger : colors.user;
    const data = points(
      [{ id: 'me', coords: overlay.userLocation, color: userColor, kind: 'step' }],
      colors.halo,
    );
    add('user-halo', data, {
      type: 'circle',
      paint: { 'circle-radius': 16, 'circle-color': userColor, 'circle-opacity': 0.2 },
    });
    add('user', data, {
      type: 'circle',
      paint: {
        'circle-radius': 6,
        'circle-color': userColor,
        'circle-stroke-color': colors.halo,
        'circle-stroke-width': 2.5,
      },
    });
  }

  return style;
}

/** Overlay kaynaklarının canlı güncellenmesi için veri üretir (web motoru kullanır). */
export function overlayData(overlay: MapOverlay): Record<string, GeoJsonCollection> {
  const out: Record<string, GeoJsonCollection> = {};
  if (overlay.track) out[`${OVERLAY_PREFIX}-track`] = line(overlay.track);
  if (overlay.route) {
    out[`${OVERLAY_PREFIX}-route`] = line(overlay.route);
    out[`${OVERLAY_PREFIX}-route-halo`] = line(overlay.route);
  }
  if (overlay.routeDone) out[`${OVERLAY_PREFIX}-route-done`] = line(overlay.routeDone);
  if (overlay.markers) out[`${OVERLAY_PREFIX}-markers`] = points(overlay.markers);
  return out;
}

/** Noktalardan sınır kutusu; kamera uydurmak için. */
export function boundsOfPoints(list: GeoPoint[]): [number, number, number, number] | null {
  if (list.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const p of list) {
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
  }
  return [minLon, minLat, maxLon, maxLat];
}
