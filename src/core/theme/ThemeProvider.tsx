import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { ColorScheme, Palette, palettes } from './tokens';

export type ThemePreference = 'system' | ColorScheme;

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  isDark: boolean;
}

const STORAGE_KEY = 'zirve.theme.preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreferenceState(value);
        }
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      preference,
      setPreference,
      isDark: scheme === 'dark',
    }),
    [scheme, preference, setPreference],
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
