import { distanceKm } from './geo';
import { RESCUE_DIRECTORY } from './rescue';
import type { EmergencyCenter, EmergencyCenterWithDistance, GeoPoint } from './types';

/** Genel acil numara için okunabilir etiket (çoğunlukla "Emergency (112)"). */
function emergencyLabel(countryCode: string, general: string): string {
  switch (countryCode) {
    case 'TR':
      return `Acil Çağrı Merkezi (${general})`;
    case 'JP':
      return `救急 (${general})`;
    case 'RU':
      return `Экстренная служба (${general})`;
    case 'BR':
      return `SAMU (${general})`;
    default:
      return `Emergency (${general})`;
  }
}

/**
 * Ülke koduna göre acil numaralar (varsayılan: 112). `RESCUE_DIRECTORY`'den
 * türetilir; ayrıntılı dizin için `rescueProfileFor` kullan.
 */
export const EMERGENCY_NUMBERS: Record<string, { general: string; label: string }> =
  Object.fromEntries(
    Object.values(RESCUE_DIRECTORY).map((p) => [
      p.countryCode,
      { general: p.emergency.general, label: emergencyLabel(p.countryCode, p.emergency.general) },
    ]),
  );

export function emergencyNumber(countryCode: string | null | undefined): {
  general: string;
  label: string;
} {
  return (
    EMERGENCY_NUMBERS[(countryCode ?? 'TR').toUpperCase()] ?? {
      general: '112',
      label: 'Emergency (112)',
    }
  );
}

/** En yakın acil merkezleri döner; türe göre süzülebilir. */
export function nearestCenters(
  centers: EmergencyCenter[],
  origin: GeoPoint,
  { limit = 5, types }: { limit?: number; types?: EmergencyCenter['type'][] } = {},
): EmergencyCenterWithDistance[] {
  return centers
    .filter((c) => !types || types.includes(c.type))
    .map((c) => ({ ...c, distanceKm: distanceKm(origin, c.coords) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Yaklaşık ambulans varış süresi (dk): yol faktörü 1,4 × ortalama 50 km/s. */
export function estimateEtaMin(distanceKmValue: number): number {
  return Math.max(3, Math.round((distanceKmValue * 1.4) / (50 / 60)));
}

/** Konum + acil mesaj metni (SMS/WhatsApp paylaşımı için). */
export function sosMessage(name: string, coords: GeoPoint, locale = 'tr'): string {
  const link = `https://maps.google.com/?q=${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
  return locale === 'tr'
    ? `ACİL DURUM — ${name} yardım istiyor. Konum: ${link} (Zirve SOS)`
    : `EMERGENCY — ${name} needs help. Location: ${link} (Zirve SOS)`;
}
