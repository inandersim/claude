import type { PlannedRoute, TrackPoint } from '@/domain';
import { shareGpx, type GpxShareResult } from '@/features/maps/gpx';

/** Parça noktalarını `toGpx`'in beklediği PlannedRoute biçimine çevirir */
export function trackToPlanned(points: TrackPoint[]): PlannedRoute {
  let km = 0;
  const profile: [number, number][] = [];
  let minE = Infinity;
  let maxE = -Infinity;
  points.forEach((p, i) => {
    if (i > 0) {
      const a = points[i - 1]!;
      const dLat = (p.latitude - a.latitude) * 110.574;
      const dLng = (p.longitude - a.longitude) * 111.32 * Math.cos((p.latitude * Math.PI) / 180);
      km += Math.hypot(dLat, dLng);
    }
    const ele = p.elevationM ?? 0;
    minE = Math.min(minE, ele);
    maxE = Math.max(maxE, ele);
    profile.push([Math.round(km * 1000) / 1000, Math.round(ele)]);
  });
  return {
    nodeIds: [],
    points: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    distanceKm: Math.round(km * 100) / 100,
    ascentM: 0,
    descentM: 0,
    durationMin: 0,
    maxElevationM: Number.isFinite(maxE) ? maxE : 0,
    minElevationM: Number.isFinite(minE) ? minE : 0,
    profile,
    surfaces: {},
  };
}

/** Parçayı GPX olarak paylaşır (dosya → metin → pano yedekleri) */
export function shareTrackGpx(points: TrackPoint[], name: string): Promise<GpxShareResult> {
  return shareGpx(trackToPlanned(points), name);
}
