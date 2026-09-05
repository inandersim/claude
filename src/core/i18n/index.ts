import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { create } from 'zustand';

import { en } from './en';
import { tr } from './tr';

export type Locale = 'tr' | 'en';

const STORAGE_KEY = 'zirve.locale';

export const i18n = new I18n({ tr, en });
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

function detectLocale(): Locale {
  const first = getLocales()[0]?.languageCode;
  return first === 'en' ? 'en' : 'tr';
}

i18n.locale = detectLocale();

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => Promise<void>;
}

/**
 * Dil tercihini tutan store. `locale` değiştiğinde bileşenler yeniden render edilir,
 * böylece `t()` her zaman güncel dili döner.
 */
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: i18n.locale as Locale,
  hydrated: false,
  setLocale: (locale) => {
    i18n.locale = locale;
    set({ locale });
    AsyncStorage.setItem(STORAGE_KEY, locale).catch(() => undefined);
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'tr' || stored === 'en') {
        i18n.locale = stored;
        set({ locale: stored, hydrated: true });
        return;
      }
    } catch {
      // yoksay
    }
    set({ hydrated: true });
  },
}));

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof tr>;

/** Tip güvenli çeviri fonksiyonu. */
export function t(key: TranslationKey, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}

/** Bileşenlerde kullanılır; dil değişince yeniden render tetikler. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return { t, locale };
}
