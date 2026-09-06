import type { TranslationKey } from '@/core/i18n';

const COUNTRY_KEYS = ['TR', 'PE', 'JO', 'KH', 'MX', 'IE', 'US', 'EG'] as const;
type KnownCountry = (typeof COUNTRY_KEYS)[number];

/** Ülke kodu için çeviri anahtarı; bilinmeyen kod → null (kod olduğu gibi gösterilir). */
export function heritageCountryLabelKey(cc: string): TranslationKey | null {
  return (COUNTRY_KEYS as readonly string[]).includes(cc)
    ? (`heritage.country.${cc as KnownCountry}` as TranslationKey)
    : null;
}

/** Erişilebilirlik seviyesi → çeviri anahtarı. */
export function accessibilityKey(level: 'easy' | 'moderate' | 'hard'): TranslationKey {
  return `heritage.accessibility.${level}`;
}
