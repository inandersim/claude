/**
 * Desteklenen diller: yerel ad, İngilizce ad, bayrak ve yazı yönü.
 * Sıralama: Türkçe, İngilizce, sonra maceraperest yoğunluğu / destinasyon ülkeleri.
 */
export const LANGUAGE_META = {
  tr: { native: 'Türkçe', english: 'Turkish', flag: '🇹🇷', rtl: false },
  en: { native: 'English', english: 'English', flag: '🇬🇧', rtl: false },
  de: { native: 'Deutsch', english: 'German', flag: '🇩🇪', rtl: false },
  fr: { native: 'Français', english: 'French', flag: '🇫🇷', rtl: false },
  es: { native: 'Español', english: 'Spanish', flag: '🇪🇸', rtl: false },
  it: { native: 'Italiano', english: 'Italian', flag: '🇮🇹', rtl: false },
  pt: { native: 'Português', english: 'Portuguese', flag: '🇧🇷', rtl: false },
  ru: { native: 'Русский', english: 'Russian', flag: '🇷🇺', rtl: false },
  ja: { native: '日本語', english: 'Japanese', flag: '🇯🇵', rtl: false },
  zh: { native: '中文', english: 'Chinese', flag: '🇨🇳', rtl: false },
  ko: { native: '한국어', english: 'Korean', flag: '🇰🇷', rtl: false },
  hi: { native: 'हिन्दी', english: 'Hindi', flag: '🇮🇳', rtl: false },
  ne: { native: 'नेपाली', english: 'Nepali', flag: '🇳🇵', rtl: false },
  ar: { native: 'العربية', english: 'Arabic', flag: '🇸🇦', rtl: true },
  ka: { native: 'ქართული', english: 'Georgian', flag: '🇬🇪', rtl: false },
  el: { native: 'Ελληνικά', english: 'Greek', flag: '🇬🇷', rtl: false },
  pl: { native: 'Polski', english: 'Polish', flag: '🇵🇱', rtl: false },
  cs: { native: 'Čeština', english: 'Czech', flag: '🇨🇿', rtl: false },
  nl: { native: 'Nederlands', english: 'Dutch', flag: '🇳🇱', rtl: false },
  sv: { native: 'Svenska', english: 'Swedish', flag: '🇸🇪', rtl: false },
  nb: { native: 'Norsk', english: 'Norwegian', flag: '🇳🇴', rtl: false },
  id: { native: 'Bahasa Indonesia', english: 'Indonesian', flag: '🇮🇩', rtl: false },
  th: { native: 'ไทย', english: 'Thai', flag: '🇹🇭', rtl: false },
} as const;

export type Locale = keyof typeof LANGUAGE_META;
export const LOCALES = Object.keys(LANGUAGE_META) as Locale[];

export function isRtl(locale: Locale): boolean {
  return LANGUAGE_META[locale].rtl;
}
