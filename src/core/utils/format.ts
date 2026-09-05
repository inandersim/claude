/** 12345 → "12,3B", 1500 → "1,5B", 999 → "999" */
export function formatCompact(value: number, locale = 'tr'): string {
  const sep = locale === 'tr' ? ',' : '.';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', sep)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}${locale === 'tr' ? 'B' : 'K'}`;
  if (value >= 1_000)
    return `${(value / 1000).toFixed(1).replace('.', sep)}${locale === 'tr' ? 'B' : 'K'}`;
  return value.toString();
}

export function formatNumber(value: number, locale = 'tr', fractionDigits = 0): string {
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

export function formatAltitude(meters: number, locale = 'tr'): string {
  return `${formatNumber(meters, locale)} m`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function generateId(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
