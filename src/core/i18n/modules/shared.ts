import type { Locale } from '../index';

/**
 * Modül çevirileri: tr ve en zorunlu, diğer diller verilmezse İngilizceye düşer.
 * Böylece her modül kendi dosyasında çevirilerini tutar; tr.ts/en.ts yalnızca bağlar.
 */
export function localeSet<T>(
  tr: T,
  en: T,
  rest: Partial<Record<Exclude<Locale, 'tr' | 'en'>, T>> = {},
): Record<Locale, T> {
  return {
    tr,
    en,
    de: rest.de ?? en,
    fr: rest.fr ?? en,
    es: rest.es ?? en,
    it: rest.it ?? en,
    ja: rest.ja ?? en,
    pt: rest.pt ?? en,
    ru: rest.ru ?? en,
  };
}
