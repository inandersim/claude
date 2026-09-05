import { filterListings, formatPriceTry } from '../marketplace';
import type { Listing } from '../types';

const item = (o: Partial<Listing>): Listing => ({
  id: 'l',
  sellerId: 's',
  title: 'Osprey Çanta',
  description: '48 litre',
  priceTry: 1000,
  category: 'equipment',
  condition: 'good',
  imageUrls: [],
  locationName: 'Kadıköy, İstanbul',
  coords: { latitude: 41, longitude: 29 },
  adventureTypes: ['hiking'],
  isSold: false,
  favoritesCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...o,
});

describe('filterListings', () => {
  const list = [
    item({ id: 'a', createdAt: '2026-09-01T00:00:00.000Z' }),
    item({
      id: 'b',
      title: 'La Sportiva Ayakkabı',
      category: 'footwear',
      createdAt: '2026-09-03T00:00:00.000Z',
    }),
    item({ id: 'sold', isSold: true, createdAt: '2026-09-04T00:00:00.000Z' }),
    item({
      id: 'other-seller',
      sellerId: 'x',
      locationName: 'Antalya',
      createdAt: '2026-09-02T00:00:00.000Z',
    }),
  ];

  it('satılmışları varsayılan olarak gizler ve en yeniyi öne alır', () => {
    expect(filterListings(list).map((l) => l.id)).toEqual(['b', 'other-seller', 'a']);
  });
  it('includeSold ile satılmışları da içerir', () => {
    expect(filterListings(list, { includeSold: true })).toHaveLength(4);
  });
  it('kategori ve satıcıya göre süzer', () => {
    expect(filterListings(list, { category: 'footwear' }).map((l) => l.id)).toEqual(['b']);
    expect(filterListings(list, { sellerId: 'x' }).map((l) => l.id)).toEqual(['other-seller']);
  });
  it('Türkçe duyarsız metin araması yapar (başlık, açıklama, konum)', () => {
    expect(filterListings(list, { query: 'ÇANTA' }).map((l) => l.id)).toEqual([
      'other-seller',
      'a',
    ]);
    expect(filterListings(list, { query: 'antalya' }).map((l) => l.id)).toEqual(['other-seller']);
    expect(filterListings(list, { query: 'litre' })).toHaveLength(3);
  });
});

describe('formatPriceTry', () => {
  it('binlik ayraçla ₺ biçimler', () => {
    expect(formatPriceTry(1250)).toBe('₺1.250');
    expect(formatPriceTry(1250, 'en')).toBe('₺1,250');
  });
  it('0 için Ücretsiz döner', () => {
    expect(formatPriceTry(0)).toBe('Ücretsiz');
    expect(formatPriceTry(0, 'en')).toBe('Free');
  });
});
