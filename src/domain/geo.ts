import type { GeoPoint } from './types';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** İki koordinat arasındaki büyük daire mesafesini km olarak döner (Haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Mesafeyi okunabilir biçime çevirir: 0.8 km → "800 m", 12.34 → "12,3 km" */
export function formatDistance(km: number, locale: string = 'tr'): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  const value = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  const localized = locale === 'tr' ? value.replace('.', ',') : value;
  return `${localized} km`;
}

/** Varsayılan konum: İstanbul (konum izni verilmediğinde kullanılır) */
export const DEFAULT_LOCATION: GeoPoint = { latitude: 41.0082, longitude: 28.9784 };
