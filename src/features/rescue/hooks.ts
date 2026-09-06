import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import {
  detectCountry,
  nearbyCountries,
  rescueProfileFor,
  type GeoPoint,
  type NearbyCountry,
  type RescueProfile,
} from '@/domain';

/* ------------------------------------------------------------------ */
/* Son bilinen ülke deposu                                             */
/* ------------------------------------------------------------------ */

const LAST_COUNTRY_KEY = 'zirtan.rescue.lastCountry';
const MANUAL_COUNTRY_KEY = 'zirtan.rescue.manualCountry';

export type CountrySource = 'geocode' | 'bbox' | 'fallback' | 'manual';

interface CountryState {
  /** Konumdan tespit edilen son ülke (uçak modunda da elde kalsın). */
  lastCountry: string | null;
  lastSource: Exclude<CountrySource, 'manual'>;
  /** Kullanıcının elle seçtiği ülke; otomatik tespiti geçersiz kılar. */
  manualCountry: string | null;
  hydrated: boolean;
  setDetected: (code: string, source: 'geocode' | 'bbox') => void;
  setManual: (code: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useCountryStore = create<CountryState>((set, get) => ({
  lastCountry: null,
  lastSource: 'fallback',
  manualCountry: null,
  hydrated: false,
  setDetected: (code, source) => {
    if (get().lastCountry === code && get().lastSource === source) return;
    set({ lastCountry: code, lastSource: source });
    AsyncStorage.setItem(LAST_COUNTRY_KEY, code).catch(() => undefined);
  },
  setManual: (code) => {
    set({ manualCountry: code });
    if (code) AsyncStorage.setItem(MANUAL_COUNTRY_KEY, code).catch(() => undefined);
    else AsyncStorage.removeItem(MANUAL_COUNTRY_KEY).catch(() => undefined);
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [last, manual] = await Promise.all([
        AsyncStorage.getItem(LAST_COUNTRY_KEY),
        AsyncStorage.getItem(MANUAL_COUNTRY_KEY),
      ]);
      set({
        lastCountry: last && get().lastCountry === null ? last : get().lastCountry,
        manualCountry: manual ?? null,
        hydrated: true,
      });
      return;
    } catch {
      // yoksay: bellekteki değerlerle devam
    }
    set({ hydrated: true });
  },
}));

// Uygulama açılışında bir kez yükle
useCountryStore
  .getState()
  .hydrate()
  .catch(() => undefined);

/* ------------------------------------------------------------------ */
/* Ters geokodlama                                                     */
/* ------------------------------------------------------------------ */

const GEOCODE_TIMEOUT_MS = 4000;

/**
 * `expo-location` ters geokodlama ile ISO ülke kodu; web'de/desteklenmeyen
 * cihazda ya da zaman aşımında `null` döner (çağıran bbox tablosuna düşer).
 */
async function geocodeCountry(coords: GeoPoint): Promise<string | null> {
  if (typeof Location.reverseGeocodeAsync !== 'function') return null;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS),
  );
  try {
    const result = await Promise.race([Location.reverseGeocodeAsync(coords), timeout]);
    const code = result?.[0]?.isoCountryCode;
    return code && code.length === 2 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface UseCountryResult {
  countryCode: string | null;
  source: CountrySource;
  profile: RescueProfile;
  /** Sınıra yakınsa komşu ülke profilleri (kutu kenarına < 30 km). */
  neighbors: NearbyCountry[];
  /** Elle ülke seçimi; `null` otomatik tespite döner. */
  setManualCountry: (code: string | null) => void;
  isManual: boolean;
}

/** ~1 km çözünürlüğe yuvarlar; her küçük GPS oynamasında yeniden geokodlamayı önler. */
function coarse(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Konumdan ülke tespiti: önce ters geokodlama, olmazsa kaba sınır kutuları,
 * o da olmazsa son bilinen ülke. Elle seçim her zaman önceliklidir.
 */
export function useCountry(coords: GeoPoint): UseCountryResult {
  const lastCountry = useCountryStore((s) => s.lastCountry);
  const lastSource = useCountryStore((s) => s.lastSource);
  const manualCountry = useCountryStore((s) => s.manualCountry);
  const setDetected = useCountryStore((s) => s.setDetected);
  const setManual = useCountryStore((s) => s.setManual);

  const latitude = coarse(coords.latitude);
  const longitude = coarse(coords.longitude);

  useEffect(() => {
    let cancelled = false;
    const point = { latitude, longitude };
    const byBox = detectCountry(point);
    // Önce anında bbox sonucu (çevrimdışı da çalışır), ardından geokodlama ile iyileştir.
    if (byBox) setDetected(byBox, 'bbox');
    geocodeCountry(point)
      .then((code) => {
        if (cancelled) return;
        if (code) setDetected(code, 'geocode');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, setDetected]);

  const countryCode = manualCountry ?? lastCountry;
  const source: CountrySource = manualCountry ? 'manual' : lastCountry ? lastSource : 'fallback';

  const profile = useMemo(() => rescueProfileFor(countryCode), [countryCode]);
  const neighbors = useMemo(
    () => (manualCountry ? [] : nearbyCountries({ latitude, longitude })),
    [latitude, longitude, manualCountry],
  );

  return {
    countryCode,
    source,
    profile,
    neighbors,
    setManualCountry: setManual,
    isManual: Boolean(manualCountry),
  };
}
