import type { ReactNode } from 'react';

import type { GeoPoint, ID } from '@/domain';

/**
 * 3B araziyi görünür kılan kamera eğimi (derece).
 *
 * 0° tepeden bakıştır ve yükseklik farkı hiç görünmez: `style.terrain`
 * bildirimi yükseklik verisini bağlar ama kamera düz kaldığı için ekranda
 * hiçbir şey değişmez. 60° yaygın seçim — tepeler belirginleşir, ufuk
 * çizgisi ekranı yutmaz.
 *
 * İki motor (web/native) aynı görünsün diye tek yerde.
 */
export const UC_BOYUT_EGIM = 60;

/** Stil varyantları uygulamanın renk şemalarıyla birebir eşleşir. */
export type MapStyleVariant = 'light' | 'dark' | 'sun';

/** Basit GeoJSON tipleri — harita katmanı dışında kimse kullanmadığı için yerel. */
export interface GeoJsonFeature {
  type: 'Feature';
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: [number, number][] };
  properties: Record<string, string | number | boolean | null>;
}

export interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * Haritanın besleneceği vektör kaynağı.
 * - `pmtiles`: tek dosyalık arşiv (yerel dosya ya da HTTP Range destekli URL)
 * - `vector`: klasik z/x/y karo şablonu
 * - `geojson`: karo üretilememiş bölgeler için doğrudan GeoJSON (geliştirme/küçük bölge)
 */
export type MapSource =
  | { kind: 'pmtiles'; url: string }
  | { kind: 'vector'; tiles: string[]; minzoom?: number; maxzoom?: number }
  | { kind: 'geojson'; data: Partial<Record<string, GeoJsonCollection>> };

/**
 * Yükseklik karosu kaynağı — kabartma gölgelendirme ve 3B arazi için.
 *
 * Vektör karolardan **ayrı** bir arşivdir (`<bölge>-dem.pmtiles`): kullanıcı
 * kabartma istemiyorsa indirmez. Kodlama terrarium
 * (`tools/tiles/lib/terrain-rgb.mjs`).
 */
/**
 * Yükseklik (DEM) kaynağı.
 *
 * `minzoom`/`maxzoom` **DEM arşivinin kendi** aralığıdır; vektör paketininkiyle
 * karıştırılmamalı. Yanlış aralık MapLibre'nin arşivde olmayan karoyu
 * beklemesine yol açar: kaynak hiç yüklenmiş sayılmaz, harita `idle` olmaz ve
 * kabartma çizilmez. `pmtiles` için değer verilmezse protokol arşiv başlığından
 * doğru aralığı bildirir — tahmin etmektense boş bırakmak doğrudur.
 */
export type MapDemSource =
  | { kind: 'pmtiles'; url: string; minzoom?: number; maxzoom?: number }
  | { kind: 'raster'; tiles: string[]; minzoom?: number; maxzoom?: number };

/** Harita üzerindeki nokta işareti (başlangıç/bitiş, POI, adım). */
export interface MapMarker {
  id: ID;
  coords: GeoPoint;
  color: string;
  /** Çerçeve rengi; verilmezse tema halesi kullanılır */
  stroke?: string;
  /** Erişilebilirlik metni ve yedek SVG çiziminde görünen etiket */
  label?: string;
  kind?: 'start' | 'end' | 'poi' | 'step' | 'hazard';
}

export interface MapRegion {
  center: GeoPoint;
  zoom: number;
  /** [minLon, minLat, maxLon, maxLat] */
  bounds: [number, number, number, number] | null;
}

/** Zarif düşüşün nedeni — üst katman kullanıcıya farklı ipucu gösterebilir. */
export type MapFallbackReason = 'no-source' | 'engine-unavailable' | 'style-error';

export interface MapViewProps {
  center?: GeoPoint | null;
  zoom?: number;
  /** Verilirse kameraya bu sınır kutusu uygulanır (center/zoom yerine) */
  bounds?: [number, number, number, number] | null;
  /** Dış stil URL'i; verilmezse gömülü `zirtan-outdoor` stili kullanılır */
  styleUrl?: string | null;
  /** Stil varyantı; verilmezse aktif temadan türetilir */
  variant?: MapStyleVariant;
  source?: MapSource | null;
  /** Karo paketinde bulunan katmanlar; eksik olanların stil katmanları atılır */
  availableLayers?: string[];
  /**
   * Eğim açısı gölgelendirmesi (çığ bantları: 27–30°, 30–35°, 35–40°, 40–45°, 45°+).
   * Varsayılan kapalı — kışın hayat kurtarır ama yazın haritayı okunmaz yapar.
   */
  slopeShading?: boolean;
  /** Yükseklik karosu; verilirse kabartma gölgelendirme ve 3B arazi açılabilir */
  demSource?: MapDemSource | null;
  /** Kabartma gölgelendirme (DEM kaynağı varsa varsayılan **açık**) */
  hillshade?: boolean;
  /**
   * 3B arazi. Varsayılan kapalı: kamerayı eğmek pil ve GPU maliyeti getirir,
   * düz haritada rota okumak da daha kolaydır.
   */
  terrain3d?: boolean;
  /** 3B arazi abartma katsayısı (1 = gerçek ölçek) */
  terrainExaggeration?: number;
  /** Planlanan/kayıtlı rota çizgisi */
  route?: GeoPoint[];
  /** Rotanın katedilmiş bölümü (navigasyonda soluk çizilir) */
  routeDone?: GeoPoint[];
  /** Kaydedilmiş iz (GPS parçası) */
  track?: GeoPoint[];
  markers?: MapMarker[];
  userLocation?: GeoPoint | null;
  /** Kullanıcı rotadan saptıysa rota ve konum uyarı rengine döner */
  offRoute?: boolean;
  interactive?: boolean;
  height?: number;
  attribution?: string;
  /** Harita kaynağını (paket / sunucu / graf / basit görünüm) gösteren küçük etiket */
  sourceLabel?: string;
  onPress?: (coords: GeoPoint) => void;
  onRegionChange?: (region: MapRegion) => void;
  onMarkerPress?: (id: ID) => void;
  /** Vektör harita çizilemediğinde gösterilecek içerik (mevcut SVG görünümü) */
  fallback?: ReactNode;
  onFallback?: (reason: MapFallbackReason) => void;
  accessibilityLabel?: string;
  testID?: string;
}

/** Motorun (web/yerel) MapView'a sunduğu bileşen sözleşmesi. */
export interface MapEngineProps extends MapViewProps {
  style: MapStyleSpec;
  onError: (reason: MapFallbackReason) => void;
}

/** MapLibre stil belgesi — sözlük olarak taşınır, doğrulama MapLibre'de yapılır. */
export interface MapStyleSpec {
  version: 8;
  name?: string;
  metadata?: Record<string, unknown>;
  sources: Record<string, Record<string, unknown>>;
  layers: Record<string, unknown>[];
  glyphs?: string;
  sprite?: string;
  /** 3B arazi; `source` bir `raster-dem` kaynağını göstermek zorundadır */
  terrain?: { source: string; exaggeration?: number };
}
