import { distanceKm } from './geo';
import type { EmergencyCenter, EmergencyCenterWithDistance, GeoPoint } from './types';

/** Ülke koduna göre acil numaralar (varsayılan: 112). */
export const EMERGENCY_NUMBERS: Record<string, { general: string; label: string }> = {
  TR: { general: '112', label: 'Acil Çağrı Merkezi (112)' },
  US: { general: '911', label: 'Emergency (911)' },
  CA: { general: '911', label: 'Emergency (911)' },
  GB: { general: '999', label: 'Emergency (999 / 112)' },
  AU: { general: '000', label: 'Emergency (000)' },
  NZ: { general: '111', label: 'Emergency (111)' },
  JP: { general: '119', label: '救急 (119)' },
  BR: { general: '192', label: 'SAMU (192)' },
  NP: { general: '102', label: 'Ambulance (102)' },
  EG: { general: '123', label: 'Ambulance (123)' },
  TH: { general: '1669', label: 'Ambulance (1669)' },
  ID: { general: '118', label: 'Ambulance (118)' },
  MA: { general: '150', label: 'Ambulance (150)' },
  RU: { general: '112', label: 'Экстренная служба (112)' },
};

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
