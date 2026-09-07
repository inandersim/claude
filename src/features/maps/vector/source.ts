import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { packCoversPoint, type GeoPoint, type MapPack, type TrailGraph } from '@/domain';

import { tilesBaseUrl } from '../pack-manager';
import { graphToGeoJson } from './graph-source';
import type { MapDemSource, MapSource } from './types';

/** Karo sunucusunun `/packs` yanıtı (tools/tiles/serve.mjs ile aynı sözleşme). */
export interface ServerPack {
  id: string;
  format: 'pmtiles';
  sizeMb: number;
  /** Ham boyut — indirme ilerlemesinin ağırlıklandırılmasında kullanılır */
  sizeBytes?: number;
  version: string;
  /** [minLon, minLat, maxLon, maxLat] — PMTiles başlığından okunur */
  bbox: [number, number, number, number] | null;
  minzoom: number | null;
  maxzoom: number | null;
  url: string;
  graphUrl: string | null;
  /** Yükseklik karosu (kabartma + 3B); paket taşımıyorsa null */
  demUrl?: string | null;
  /**
   * DEM arşivinin **kendi** zum aralığı. Vektör paketinkiyle aynı değildir:
   * yükseklik ızgarası çok daha kaba üretilir (ör. paket z15'e kadar,
   * DEM z10'da biter).
   */
  demMinzoom?: number | null;
  demMaxzoom?: number | null;
  /** Yükseklik dosyasının boyutu — indirme ilerlemesi bayta göre ağırlıklandırılır */
  demSizeBytes?: number | null;
}

/** Sunucudaki paketleri listeler; `EXPO_PUBLIC_TILES_URL` yoksa boş dizi. */
export function useTileServerPacks() {
  const base = tilesBaseUrl();
  return useQuery({
    queryKey: queryKeys.maps.tileServer,
    enabled: Boolean(base),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ServerPack[]> => {
      const response = await fetch(`${base}/packs`);
      if (!response.ok) throw new Error(`Karo sunucusu ${response.status}`);
      return (await response.json()) as ServerPack[];
    },
  });
}

/** Bir noktayı kapsayan sunucu paketi (en küçük kapsayan kazanır). */
export function pickServerPack(packs: ServerPack[], point: GeoPoint): ServerPack | null {
  const covering = packs.filter(
    (p) =>
      p.bbox &&
      point.longitude >= p.bbox[0] &&
      point.longitude <= p.bbox[2] &&
      point.latitude >= p.bbox[1] &&
      point.latitude <= p.bbox[3],
  );
  if (covering.length === 0) return null;
  const area = (p: ServerPack) =>
    p.bbox ? (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1]) : Infinity;
  return covering.sort((a, b) => area(a) - area(b))[0] ?? null;
}

/**
 * Cihazda gerçekten duran ve noktayı kapsayan paket.
 * `isInstalled` verilirse dosyanın varlığı da doğrulanır — demo verisindeki
 * `localPath` alanı tek başına yeterli değildir, yoksa MapLibre olmayan bir
 * dosyayı okumaya çalışır ve harita boş kalır.
 */
export function pickLocalPack(
  packs: MapPack[],
  point: GeoPoint,
  isInstalled?: (packId: string) => boolean,
): MapPack | null {
  return (
    packs.find(
      (p) =>
        p.status !== 'available' &&
        Boolean(p.localPath) &&
        packCoversPoint(p, point) &&
        (isInstalled ? isInstalled(p.id) : true),
    ) ?? null
  );
}

/**
 * Bir uygulama paketine (MapPack) karşılık gelen sunucu paketi.
 * Önce kimlik, sonra sınır kutusu merkezine göre eşleşir; böylece sunucudaki
 * dosya adı uygulamadaki paket kimliğiyle birebir aynı olmak zorunda değildir.
 */
export function matchServerPack(
  serverPacks: ServerPack[],
  pack: Pick<MapPack, 'id' | 'bbox'>,
): ServerPack | null {
  const byId = serverPacks.find((s) => s.id === pack.id || pack.id.endsWith(`_${s.id}`));
  if (byId) return byId;
  return (
    serverPacks.find((s) => {
      if (!s.bbox) return false;
      const center = {
        longitude: (s.bbox[0] + s.bbox[2]) / 2,
        latitude: (s.bbox[1] + s.bbox[3]) / 2,
      };
      return packCoversPoint(pack, center);
    }) ?? null
  );
}

export type MapSourceKind = 'pack' | 'server' | 'graph' | 'none';

export interface ResolvedSource {
  source: MapSource | null;
  kind: MapSourceKind;
  /** Kaynakta gerçekten bulunan stil katmanları */
  availableLayers?: string[];
  /**
   * Yükseklik karosu — kabartma gölgelendirme ve 3B arazi için.
   * İndirilmiş pakette yerel dosyadan, karo sunucusu yolunda uzak adresten gelir.
   * Paket DEM taşımıyorsa null kalır ve ilgili katmanlar çizilmez.
   */
  demSource?: MapDemSource | null;
}

/**
 * Harita kaynağını üç kademede çözer:
 *
 * 1. **pack** — cihazda indirilmiş PMTiles paketi (tam kartografya, çevrimdışı)
 * 2. **server** — karo sunucusundaki PMTiles (geliştirme / çevrimiçi)
 * 3. **graph** — patika grafından türetilen GeoJSON (paket yokken de gerçek vektör harita)
 *
 * Üçü de yoksa `none` döner ve `MapView` SVG görünümüne düşer.
 */
export function resolveSource(options: {
  center: GeoPoint | null;
  localPacks?: MapPack[];
  serverPacks?: ServerPack[];
  graph?: TrailGraph | null;
  baseUrl?: string | null;
  /** Paket dosyasının cihazda gerçekten olup olmadığını söyler */
  isInstalled?: (packId: string) => boolean;
  /** İndirilmiş paketin yükseklik dosyasının yerel adresi (yoksa null) */
  demPath?: (packId: string) => string | null;
}): ResolvedSource {
  const {
    center,
    localPacks = [],
    serverPacks = [],
    graph = null,
    isInstalled,
    demPath,
  } = options;
  const baseUrl = options.baseUrl ?? tilesBaseUrl();

  if (center) {
    const local = pickLocalPack(localPacks, center, isInstalled);
    if (local?.localPath) {
      const dem = demPath?.(local.id) ?? null;
      return {
        source: { kind: 'pmtiles', url: local.localPath },
        kind: 'pack',
        demSource: dem ? { kind: 'pmtiles', url: dem } : null,
      };
    }
    if (baseUrl) {
      const remote = pickServerPack(serverPacks, center);
      if (remote) {
        return {
          source: { kind: 'pmtiles', url: `${baseUrl}${remote.url}` },
          kind: 'server',
          demSource: remote.demUrl
            ? {
                kind: 'pmtiles',
                url: `${baseUrl}${remote.demUrl}`,
                // **Paketin değil, DEM'in kendi aralığı.** Buraya vektör
                // paketinin maxzoom'u yazıldığında MapLibre arşivde olmayan
                // bir zumdan karo istiyor, kaynak hiç "yüklendi" demiyor,
                // harita `idle` olmuyor ve kabartma hiç çizilmiyordu.
                // Değer yoksa hiç yazılmaz: `pmtiles://` protokolü arşivin
                // başlığından doğru aralığı zaten bildiriyor.
                ...(remote.demMinzoom != null ? { minzoom: remote.demMinzoom } : {}),
                ...(remote.demMaxzoom != null ? { maxzoom: remote.demMaxzoom } : {}),
              }
            : null,
        };
      }
    }
  }

  if (graph && graph.nodes.length > 0) {
    return {
      source: { kind: 'geojson', data: graphToGeoJson(graph) },
      kind: 'graph',
      availableLayers: ['trails'],
    };
  }

  return { source: null, kind: 'none' };
}
