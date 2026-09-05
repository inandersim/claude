import { emergencyNumber, estimateEtaMin, nearestCenters, sosMessage } from '../emergency';
import { countByCountry, localizedPlaceName, mapsUrl, searchLibrary } from '../library';
import type { EmergencyCenter, LibraryPlace } from '../types';

const place = (o: Partial<LibraryPlace>): LibraryPlace => ({
  id: 'p',
  source: 'curated',
  kind: 'peak',
  name: 'X',
  names: {},
  adventureTypes: ['hiking'],
  lat: 41,
  lng: 29,
  elevationM: null,
  description: null,
  website: null,
  phone: null,
  openingHours: null,
  countryCode: 'TR',
  tags: {},
  wikidataId: null,
  image: null,
  license: 'ODbL',
  attribution: 'OSM',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

describe('searchLibrary', () => {
  const list = [
    place({
      id: 'kackar',
      name: 'Kaçkar Dağı',
      kind: 'peak',
      description: 'Karadeniz',
      lat: 40.83,
      lng: 41.12,
    }),
    place({
      id: 'kalymnos',
      name: 'Kalymnos',
      names: { tr: 'Kalimnos' },
      kind: 'climbing',
      countryCode: 'GR',
      adventureTypes: ['climbing'],
      lat: 36.98,
      lng: 26.97,
      image: { url: 'u', thumbUrl: 't', license: 'CC', author: 'a', attribution: 'a' },
    }),
    place({
      id: 'kas',
      name: 'Kaş',
      kind: 'diving',
      adventureTypes: ['diving'],
      lat: 36.2,
      lng: 29.64,
    }),
  ];
  it('tür, ülke ve macera türüne göre süzer', () => {
    expect(searchLibrary(list, { kind: 'peak' }).map((p) => p.id)).toEqual(['kackar']);
    expect(searchLibrary(list, { countryCode: 'GR' }).map((p) => p.id)).toEqual(['kalymnos']);
    expect(searchLibrary(list, { adventureType: 'diving' }).map((p) => p.id)).toEqual(['kas']);
  });
  it('Türkçe duyarsız metin araması ad, yerel ad, açıklama ve ülke kodunda çalışır', () => {
    expect(searchLibrary(list, { query: 'KAÇKAR' }).map((p) => p.id)).toEqual(['kackar']);
    expect(searchLibrary(list, { query: 'kalimnos' }).map((p) => p.id)).toEqual(['kalymnos']);
    expect(searchLibrary(list, { query: 'karadeniz' }).map((p) => p.id)).toEqual(['kackar']);
    expect(searchLibrary(list, { query: 'gr' }).map((p) => p.id)).toEqual(['kalymnos']);
  });
  it('origin verilince mesafeye göre sıralar ve yarıçapla süzer', () => {
    const r = searchLibrary(list, { origin: { latitude: 36.2, longitude: 29.6 }, radiusKm: 400 });
    expect(r.map((p) => p.id)).toEqual(['kas', 'kalymnos']);
    expect(r[0]?.distanceKm).toBeLessThan(10);
  });
  it('origin yokken görseli/açıklaması olanları öne alır', () => {
    expect(searchLibrary(list).map((p) => p.id)).toEqual(['kalymnos', 'kackar', 'kas']);
  });
  it('yardımcılar', () => {
    expect(localizedPlaceName(list[1]!, 'tr')).toBe('Kalimnos');
    expect(localizedPlaceName(list[1]!, 'en')).toBe('Kalymnos');
    expect(countByCountry(list)).toEqual([
      { countryCode: 'TR', count: 2 },
      { countryCode: 'GR', count: 1 },
    ]);
    expect(mapsUrl(41, 29, 'Test')).toContain('41%2C29');
  });
});

describe('emergency', () => {
  const centers: EmergencyCenter[] = [
    {
      id: 'far',
      name: 'Uzak',
      type: 'hospital',
      coords: { latitude: 42, longitude: 30 },
      locationName: '',
      phone: null,
      open24h: true,
      countryCode: 'TR',
    },
    {
      id: 'near',
      name: 'Yakın',
      type: 'ambulance',
      coords: { latitude: 41.01, longitude: 29.0 },
      locationName: '',
      phone: '112',
      open24h: true,
      countryCode: 'TR',
    },
    {
      id: 'mid',
      name: 'Orta',
      type: 'pharmacy',
      coords: { latitude: 41.1, longitude: 29.1 },
      locationName: '',
      phone: null,
      open24h: false,
      countryCode: 'TR',
    },
  ];
  it('en yakın merkezleri mesafeye göre döner ve türe göre süzer', () => {
    expect(
      nearestCenters(centers, { latitude: 41, longitude: 29 }, { limit: 2 }).map((c) => c.id),
    ).toEqual(['near', 'mid']);
    expect(
      nearestCenters(centers, { latitude: 41, longitude: 29 }, { types: ['hospital'] }).map(
        (c) => c.id,
      ),
    ).toEqual(['far']);
  });
  it('acil numara ülkeye göre; bilinmeyen → 112', () => {
    expect(emergencyNumber('TR').general).toBe('112');
    expect(emergencyNumber('US').general).toBe('911');
    expect(emergencyNumber('XX').general).toBe('112');
    expect(emergencyNumber(null).general).toBe('112');
  });
  it('ETA ve SOS mesajı', () => {
    expect(estimateEtaMin(10)).toBe(17);
    expect(estimateEtaMin(0.5)).toBe(3);
    expect(sosMessage('Deniz', { latitude: 41, longitude: 29 })).toContain(
      'maps.google.com/?q=41.00000,29.00000',
    );
    expect(sosMessage('Deniz', { latitude: 41, longitude: 29 }, 'en')).toMatch(/^EMERGENCY/);
  });
});
