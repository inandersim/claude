import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { en } from './en';
import { tr, type AdminTranslationKey } from './tr';

export type AdminLocale = 'tr' | 'en';

const DICTS: Record<AdminLocale, Record<AdminTranslationKey, string>> = { tr, en };

const STORAGE_KEY = 'zirtan.admin.locale';

export type Translate = (key: AdminTranslationKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStored(): AdminLocale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'en' ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(readStored);

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* depolama kapalıysa yoksay */
    }
  }, []);

  const t = useCallback<Translate>(
    (key, params) => {
      const dict = DICTS[locale];
      let text: string = dict[key] ?? tr[key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n, I18nProvider içinde kullanılmalı');
  return context;
}

export function useT(): Translate {
  return useI18n().t;
}

export type { AdminTranslationKey };
