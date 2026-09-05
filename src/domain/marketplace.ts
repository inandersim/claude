import type { Listing, ListingFilter } from './types';

/** İlanları arama metni, kategori ve satıcıya göre süzer; en yeni önce sıralar. */
export function filterListings(listings: Listing[], filter: ListingFilter = {}): Listing[] {
  const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
  return listings
    .filter((l) => filter.includeSold || !l.isSold)
    .filter((l) => !filter.category || l.category === filter.category)
    .filter((l) => !filter.sellerId || l.sellerId === filter.sellerId)
    .filter(
      (l) =>
        !q ||
        l.title.toLocaleLowerCase('tr-TR').includes(q) ||
        l.description.toLocaleLowerCase('tr-TR').includes(q) ||
        l.locationName.toLocaleLowerCase('tr-TR').includes(q),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 1250 → "₺1.250", 0 → "Ücretsiz" */
export function formatPriceTry(value: number, locale = 'tr', zeroAsFree = true): string {
  if (value === 0 && zeroAsFree) return locale === 'tr' ? 'Ücretsiz' : 'Free';
  return `₺${new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 }).format(value)}`;
}
