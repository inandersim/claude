import type { GeoPoint, Surface, TrailEdge, TrailGraph, TrailNode } from '@/domain';
import { distanceKm } from '@/domain/geo';

import type { GeoJsonCollection, GeoJsonFeature } from './types';

/** Uygulamanın `Surface` değerleri → OSM `surface` etiketi (stil bunlara göre boyar). */
const SURFACE_TAG: Record<Surface, string> = {
  trail: 'ground',
  gravel: 'gravel',
  paved: 'asphalt',
  rock: 'rock',
  scree: 'scree',
  snow: 'snow',
};

/** Teknik puan → SAC ölçeği; stildeki "zorlu patika" katmanı bunu kullanır. */
export function sacScaleFor(technical: number): string {
  if (technical >= 0.8) return 'difficult_alpine_hiking';
  if (technical >= 0.65) return 'alpine_hiking';
  if (technical >= 0.45) return 'demanding_mountain_hiking';
  if (technical >= 0.25) return 'mountain_hiking';
  return 'hiking';
}

/** Kenarın hangi yol sınıfı gibi çizileceği. */
export function highwayFor(edge: TrailEdge): string {
  if (edge.surface === 'paved') return 'track';
  if (edge.surface === 'gravel') return 'track';
  return 'path';
}

/**
 * Patika grafını harita kaynağına çevirir.
 *
 * Karo paketi indirilmemiş bölgelerde bile **gerçek bir vektör harita** çizilebilsin diye
 * kullanılır: veri, rota planlayıcısının kullandığı grafın ta kendisidir, uydurma yoktur.
 * Özellik adları OSM etiketleriyle aynı tutulur; böylece aynı stil hem karo hem graf
 * kaynağıyla çalışır.
 */
export function graphToGeoJson(graph: TrailGraph): { trails: GeoJsonCollection } {
  const byId = new Map<string, TrailNode>(graph.nodes.map((n) => [n.id, n]));
  const features: GeoJsonFeature[] = [];
  for (const edge of graph.edges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) continue;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [a.coords.longitude, a.coords.latitude],
          [b.coords.longitude, b.coords.latitude],
        ],
      },
      properties: {
        highway: highwayFor(edge),
        surface: SURFACE_TAG[edge.surface],
        sac_scale: sacScaleFor(edge.technical),
        name: a.name ?? b.name ?? '',
        technical: edge.technical,
      },
    });
  }
  return { trails: { type: 'FeatureCollection', features } };
}

/** Grafın sınır kutusu [minLon, minLat, maxLon, maxLat]; boşsa null. */
export function graphBounds(graph: TrailGraph): [number, number, number, number] | null {
  if (graph.nodes.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const n of graph.nodes) {
    minLon = Math.min(minLon, n.coords.longitude);
    maxLon = Math.max(maxLon, n.coords.longitude);
    minLat = Math.min(minLat, n.coords.latitude);
    maxLat = Math.max(maxLat, n.coords.latitude);
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Dokunulan noktaya en yakın düğüm. `maxKm` yarıçapı dışındaki dokunuşlar
 * seçim sayılmaz (haritada boşluğa basmak başlangıcı değiştirmesin).
 */
export function nearestNode(
  graph: TrailGraph,
  point: GeoPoint,
  maxKm = 1.5,
): TrailNode | null {
  let best: TrailNode | null = null;
  let bestKm = Infinity;
  for (const node of graph.nodes) {
    const km = distanceKm(node.coords, point);
    if (km < bestKm) {
      bestKm = km;
      best = node;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}
