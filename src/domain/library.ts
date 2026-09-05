import { distanceKm } from './geo';
import type { LibraryFilter, LibraryPlace, LibraryPlaceWithDistance } from './types';

/** Yerel adı (tr) varsa onu, yoksa kaynak adı döner. */
export function localizedPlaceName(place: LibraryPlace, locale: string): string {
  return place.names[locale] ?? place.name;
}

/**
 * Kütüphane araması: metin (Türkçe duyarsız), tür, ülke, macera türü ve yarıçap.
 * Sıralama: origin varsa mesafe; yoksa görseli/açıklaması olanlar önce, ardından ad.
 */
export function searchLibrary(
  places: LibraryPlace[],
  filter: LibraryFilter = {},
): LibraryPlaceWithDistance[] {
  const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
  const origin = filter.origin ?? null;
  return places
    .filter((p) => !filter.kind || p.kind === filter.kind)
    .filter((p) => !filter.countryCode || p.countryCode === filter.countryCode)
    .filter((p) => !filter.adventureType || p.adventureTypes.includes(filter.adventureType))
    .filter(
      (p) =>
        !q ||
        p.name.toLocaleLowerCase('tr-TR').includes(q) ||
        Object.values(p.names).some((n) => n?.toLocaleLowerCase('tr-TR').includes(q)) ||
        (p.description?.toLocaleLowerCase('tr-TR').includes(q) ?? false) ||
        p.countryCode?.toLocaleLowerCase('tr-TR') === q,
    )
    .map((p) => ({
      ...p,
      distanceKm: origin ? distanceKm(origin, { latitude: p.lat, longitude: p.lng }) : null,
    }))
    .filter((p) => !filter.radiusKm || p.distanceKm === null || p.distanceKm <= filter.radiusKm)
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      const scoreA = (a.image ? 2 : 0) + (a.description ? 1 : 0);
      const scoreB = (b.image ? 2 : 0) + (b.description ? 1 : 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.name.localeCompare(b.name, 'tr');
    });
}

/** Ülke koduna göre sayım (filtre çipleri için). */
export function countByCountry(places: LibraryPlace[]): { countryCode: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of places)
    if (p.countryCode) map.set(p.countryCode, (map.get(p.countryCode) ?? 0) + 1);
  return [...map.entries()]
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count);
}

/** Cihazın harita uygulamasında açmak için evrensel bağlantı. */
export function mapsUrl(lat: number, lng: number, label?: string): string {
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label ? `${label} @${q}` : q)}`;
}
