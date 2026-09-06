import type { ColorScheme } from './tokens';

/**
 * Ortam ışığına / gün ışığına göre tema seçimi (saf yardımcılar).
 * Işık sensörü (lux) varsa histerezisli eşikler; yoksa güneşin doğuş-batış saatleri.
 */

export const LUX_SUN = 3000; // doğrudan güneş / açık hava → 'sun'
export const LUX_LIGHT = 120; // iç mekân aydınlık → 'light'
export const LUX_DARK = 25; // loş / gece → 'dark'

/** Histerezis: mevcut şemayı korumak için eşiklerin biraz ötesine geçilmeli. */
export function schemeFromLux(lux: number, current: ColorScheme | null): ColorScheme {
  const margin = 0.25;
  if (current === 'sun') return lux < LUX_SUN * (1 - margin) ? schemeFromLux(lux, null) : 'sun';
  if (current === 'dark') return lux > LUX_DARK * (1 + margin) ? schemeFromLux(lux, null) : 'dark';
  if (current === 'light') {
    if (lux >= LUX_SUN * (1 + margin)) return 'sun';
    if (lux <= LUX_DARK * (1 - margin)) return 'dark';
    return 'light';
  }
  if (lux >= LUX_SUN) return 'sun';
  if (lux <= LUX_DARK) return 'dark';
  return 'light';
}

/** Basit güneş doğuş/batış hesabı (NOAA yaklaşımı, ±5 dk). UTC saat olarak döner. */
export function sunTimesUtc(
  date: Date,
  latitude: number,
  longitude: number,
): { sunriseH: number; sunsetH: number } | null {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const cosHa =
    Math.cos(90.833 * rad) / (Math.cos(latitude * rad) * Math.cos(decl)) -
    Math.tan(latitude * rad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null; // kutup günü/gecesi
  const ha = Math.acos(cosHa) / rad;
  const sunrise = 720 - 4 * (longitude + ha) - eqTime;
  const sunset = 720 - 4 * (longitude - ha) - eqTime;
  return { sunriseH: (((sunrise / 60) % 24) + 24) % 24, sunsetH: (((sunset / 60) % 24) + 24) % 24 };
}

/** Gün ışığı var mı? Kutup durumlarında güneş yüksekliğine göre karar verir. */
export function isDaylight(now: Date, latitude: number, longitude: number): boolean {
  const times = sunTimesUtc(now, latitude, longitude);
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (!times) {
    const month = now.getUTCMonth();
    const summer = month >= 3 && month <= 8;
    return latitude >= 0 ? summer : !summer;
  }
  const { sunriseH, sunsetH } = times;
  return sunriseH < sunsetH ? h >= sunriseH && h < sunsetH : h >= sunriseH || h < sunsetH;
}

/** Sensör yokken: gündüz → light, gece → dark. */
export function schemeFromClock(now: Date, latitude: number, longitude: number): ColorScheme {
  return isDaylight(now, latitude, longitude) ? 'light' : 'dark';
}
