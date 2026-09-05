import { HAZARD_SEVERITY_META } from './enums';
import { distanceKm } from './geo';
import type { GeoPoint, HazardZone } from './types';

export interface NearbyHazardOptions {
  hazards: HazardZone[];
  origin: GeoPoint | null;
  radiusKm?: number;
  now?: Date;
  includeResolved?: boolean;
}

/**
 * Aktif ve süresi dolmamış tehlike bölgelerini döner.
 * Sıralama: önce şiddet (kritik → düşük), eşitlikte mesafe (yakın → uzak), sonra tarih (yeni → eski).
 */
export function selectHazards({
  hazards,
  origin,
  radiusKm,
  now = new Date(),
  includeResolved = false,
}: NearbyHazardOptions) {
  const nowIso = now.toISOString();
  return hazards
    .filter((h) => includeResolved || h.status === 'active')
    .filter((h) => !h.expiresAt || h.expiresAt > nowIso)
    .map((h) => ({ hazard: h, distanceKm: origin ? distanceKm(origin, h.coords) : null }))
    .filter((x) => radiusKm === undefined || x.distanceKm === null || x.distanceKm <= radiusKm)
    .sort((a, b) => {
      const sev =
        HAZARD_SEVERITY_META[b.hazard.severity].level -
        HAZARD_SEVERITY_META[a.hazard.severity].level;
      if (sev !== 0) return sev;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.hazard.createdAt.localeCompare(a.hazard.createdAt);
    });
}

/** Bir nokta tehlike bölgesinin etki yarıçapı içinde mi? */
export function isInsideHazard(point: GeoPoint, hazard: HazardZone): boolean {
  return distanceKm(point, hazard.coords) * 1000 <= hazard.radiusM;
}

/** İki nokta arasındaki yönü derece olarak döner (0 = kuzey, saat yönü). Radar görünümü için. */
export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
