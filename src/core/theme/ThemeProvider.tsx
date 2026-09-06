import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import { schemeFromClock, schemeFromLux } from './ambient';
import { ColorScheme, Palette, palettes } from './tokens';

/**
 * system: cihaz ayarı · light/dark/sun: sabit · auto: ortam ışığı (sensör) ya da gün ışığı saatine göre
 */
export type ThemePreference = 'system' | 'auto' | ColorScheme;
export type AmbientSource = 'sensor' | 'clock' | null;

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  isDark: boolean;
  /** 'auto' modunda kararı neyin verdiği */
  ambientSource: AmbientSource;
  /** Son okunan lux (sensör yoksa null) */
  ambientLux: number | null;
}

const PREFERENCES: ThemePreference[] = ['system', 'auto', 'light', 'dark', 'sun'];
/** Sensör yokken gün ışığı hesabı için varsayılan konum (İstanbul); konum izni varsa güncellenir */
const DEFAULT_COORDS = { latitude: 41.0082, longitude: 28.9784 };

/**
 * Ortam ışığı sensörünü (Android) dinler; iOS/web'de saat tabanlı gündüz-gece kararı verir.
 */
function useAmbientScheme(enabled: boolean): {
  scheme: ColorScheme;
  source: AmbientSource;
  lux: number | null;
} {
  const [lux, setLux] = useState<number | null>(null);
  const [clockScheme, setClockScheme] = useState<ColorScheme>(() =>
    schemeFromClock(new Date(), DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude),
  );
  const [sensorScheme, setSensorScheme] = useState<ColorScheme | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      if (Platform.OS !== 'android') return;
      try {
        const { LightSensor } = await import('expo-sensors');
        if (!(await LightSensor.isAvailableAsync()) || cancelled) return;
        LightSensor.setUpdateInterval(2000);
        subscription = LightSensor.addListener(({ illuminance }) => {
          setLux(illuminance);
          setSensorScheme((prev) => schemeFromLux(illuminance, prev));
        });
      } catch {
        // sensör yok → saat tabanlı
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () =>
      setClockScheme(
        schemeFromClock(new Date(), DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude),
      );
    tick();
    const timer = setInterval(tick, 5 * 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled]);

  if (sensorScheme) return { scheme: sensorScheme, source: 'sensor', lux };
  return { scheme: clockScheme, source: 'clock', lux: null };
}

const STORAGE_KEY = 'zirtan.theme.preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
  const ambient = useAmbientScheme(preference === 'auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value && (PREFERENCES as string[]).includes(value)) {
          setPreferenceState(value as ThemePreference);
        }
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference === 'auto'
        ? ambient.scheme
        : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      preference,
      setPreference,
      isDark: scheme === 'dark',
      ambientSource: preference === 'auto' ? ambient.source : null,
      ambientLux: preference === 'auto' ? ambient.lux : null,
    }),
    [scheme, preference, setPreference, ambient.source, ambient.lux],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme yalnızca ThemeProvider içinde kullanılabilir.');
  }
  return ctx;
}
