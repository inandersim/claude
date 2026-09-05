import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { useCallback } from 'react';
import { create } from 'zustand';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { ja } from './ja';
import { pt } from './pt';
import { ru } from './ru';
import { tr } from './tr';

export type Locale = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'ja' | 'pt' | 'ru';
export const LOCALES: Locale[] = ['tr', 'en', 'de', 'fr', 'es', 'it', 'ja', 'pt', 'ru'];

const STORAGE_KEY = 'zirve.locale';

export const i18n = new I18n({ tr, en, de, fr, es, it, ja, pt, ru });
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

function detectLocale(): Locale {
  const first = getLocales()[0]?.languageCode ?? 'tr';
  return (LOCALES as string[]).includes(first) ? (first as Locale) : 'en';
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

/**
 * Bileşenlerde kullanılır; dil değişince yeniden render tetikler.
 * Dönen `t` dile bağlı yeni bir fonksiyondur — React Compiler'ın
 * `t('...')` sonuçlarını dil değişse de önbellekte tutmasını engeller.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const tl = useCallback(
    (key: TranslationKey, options?: Record<string, string | number>) =>
      i18n.t(key, { ...options, locale }),
    [locale],
  );
  return { t: tl, locale };
}
