import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { useCallback } from 'react';
import { I18nManager, Platform } from 'react-native';
import { create } from 'zustand';

import { ar } from './ar';
import { cs } from './cs';
import { de } from './de';
import { el } from './el';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { id } from './id';
import { it } from './it';
import { ja } from './ja';
import { ka } from './ka';
import { ko } from './ko';
import { LANGUAGE_META, LOCALES, isRtl, type Locale } from './languages';
import { nb } from './nb';
import { ne } from './ne';
import { nl } from './nl';
import { pl } from './pl';
import { pt } from './pt';
import { ru } from './ru';
import { sv } from './sv';
import { th } from './th';
import { tr } from './tr';
import { zh } from './zh';

export type { Locale };
export { LANGUAGE_META, LOCALES, isRtl };

const STORAGE_KEY = 'zirtan.locale';

export const i18n = new I18n({
  tr,
  en,
  de,
  fr,
  es,
  it,
  ja,
  pt,
  ru,
  zh,
  ko,
  hi,
  ne,
  ar,
  ka,
  el,
  pl,
  cs,
  nl,
  sv,
  nb,
  id,
  th,
});
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

function detectLocale(): Locale {
  const first = getLocales()[0]?.languageCode ?? 'tr';
  return (LOCALES as string[]).includes(first) ? (first as Locale) : 'en';
}

i18n.locale = detectLocale();

/**
 * Yazı yönü: Arapça gibi RTL dillerde yerleşim aynalanır. Yerel platformda
 * `forceRTL` yeniden başlatmada etkili olur; web'de `dir` özniteliği anında uygulanır.
 */
function applyDirection(locale: Locale) {
  const rtl = isRtl(locale);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', locale);
    return;
  }
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

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
    applyDirection(locale);
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (LOCALES as string[]).includes(stored)) {
        i18n.locale = stored;
        applyDirection(stored as Locale);
        set({ locale: stored as Locale, hydrated: true });
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
