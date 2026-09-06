import { LOCALES, type Locale } from '../languages';

/**
 * Modül çevirileri: tr ve en zorunlu, diğer diller verilmezse İngilizceye düşer.
 * Böylece her modül kendi dosyasında çevirilerini tutar; tr.ts/en.ts yalnızca bağlar.
 */
export function localeSet<T>(
  tr: T,
  en: T,
  rest: Partial<Record<Exclude<Locale, 'tr' | 'en'>, T>> = {},
): Record<Locale, T> {
  const out = {} as Record<Locale, T>;
  for (const loc of LOCALES) {
    out[loc] = loc === 'tr' ? tr : loc === 'en' ? en : (rest[loc] ?? en);
  }
  return out;
}
