import {
  filterHeritageSites,
  guideDurationMin,
  heritageCenturyLabel,
  heritageCountries,
  heritageFeeLabel,
  heritageOpenNow,
  heritageSiteScript,
  heritageTourSummary,
  heritageUnescoLabel,
  heritageVisitPlan,
  nearbyHeritageSites,
  parseHeritageHours,
  validateHeritageTourInput,
  type AudioGuideStop,
  type HeritageSite,
} from '@/domain';

const site = (
  over: Partial<HeritageSite> & Pick<HeritageSite, 'id' | 'name' | 'coords'>,
): HeritageSite => ({
  slug: over.id,
  kind: 'ancient_city',
  eras: ['roman'],
  countryCode: 'TR',
  region: 'Antalya',
  elevationM: 10,
  imageUrl: null,
  summary: 'özet',
  history: 'tarihçe',
  isUnesco: false,
  unescoYear: null,
  openingHours: '08:30–19:00',
  entryFeeTry: 200,
  museumPassValid: true,
  visitDurationMin: 60,
  accessibility: 'easy',
  nearestTrailhead: null,
  linkedTrailId: null,
  linkedDestinationId: null,
  adventureTypes: ['hiking'],
  rules: [],
  bestMonths: [4, 5],
  rating: 4.5,
  reviewCount: 10,
  sources: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const antalya = { latitude: 36.8969, longitude: 30.7133 };
const patara = site({
  id: 'patara',
  name: 'Patara',
  coords: { latitude: 36.2622, longitude: 29.3144 },
  eras: ['lycian', 'roman'],
});
const perge = site({
  id: 'perge',
  name: 'Perge',
  coords: { latitude: 36.9614, longitude: 30.8539 },
  eras: ['greek', 'roman'],
});
const olympos = site({
  id: 'olympos',
  name: 'Olympos',
  coords: { latitude: 36.3961, longitude: 30.4739 },
  eras: ['lycian'],
  kind: 'ancient_city',
});
const giza = site({
  id: 'giza',
  name: 'Giza',
  coords: { latitude: 29.9792, longitude: 31.1342 },
  eras: ['egyptian'],
  kind: 'tomb',
  countryCode: 'EG',
  isUnesco: true,
  unescoYear: 1979,
  entryFeeTry: null,
  visitDurationMin: 240,
});
const all = [patara, perge, olympos, giza];

describe('filterHeritageSites', () => {
  it('ülke, dönem, tür ve UNESCO filtreleri', () => {
    expect(filterHeritageSites(all, { countryCode: 'EG' }).map((s) => s.id)).toEqual(['giza']);
    expect(filterHeritageSites(all, { era: 'lycian' }).map((s) => s.id)).toEqual([
      'patara',
      'olympos',
    ]);
    expect(filterHeritageSites(all, { kind: 'tomb' }).map((s) => s.id)).toEqual(['giza']);
    expect(filterHeritageSites(all, { unescoOnly: true }).map((s) => s.id)).toEqual(['giza']);
  });

  it('arama Türkçe küçük harfe duyarsız ve origin mesafeye göre sıralar', () => {
    expect(filterHeritageSites(all, { query: 'PATARA' }).map((s) => s.id)).toEqual(['patara']);
    const near = filterHeritageSites(all, { origin: antalya });
    expect(near.map((s) => s.id)).toEqual(['perge', 'olympos', 'patara', 'giza']);
  });
});

describe('parseHeritageHours / heritageOpenNow', () => {
  it('saat aralıklarını ayrıştırır', () => {
    expect(parseHeritageHours('08:30–19:00')).toEqual({ openMin: 510, closeMin: 1140 });
    expect(parseHeritageHours('09.00 - 17.30')).toEqual({ openMin: 540, closeMin: 1050 });
    expect(parseHeritageHours('24 saat')).toEqual({ openMin: 0, closeMin: 1440 });
    expect(parseHeritageHours('Kapalı')).toBeNull();
  });

  it('şu an açık mı', () => {
    const s = { openingHours: '08:30–19:00' };
    expect(heritageOpenNow(s, new Date(2026, 5, 1, 10, 0))).toBe(true);
    expect(heritageOpenNow(s, new Date(2026, 5, 1, 8, 29))).toBe(false);
    expect(heritageOpenNow(s, new Date(2026, 5, 1, 19, 0))).toBe(false);
    expect(heritageOpenNow({ openingHours: '24 saat' }, new Date(2026, 5, 1, 3, 0))).toBe(true);
    expect(heritageOpenNow({ openingHours: '?' }, new Date())).toBeNull();
    // gece yarısını aşan aralık
    expect(heritageOpenNow({ openingHours: '22:00–02:00' }, new Date(2026, 5, 1, 1, 0))).toBe(true);
    expect(heritageOpenNow({ openingHours: '22:00–02:00' }, new Date(2026, 5, 1, 12, 0))).toBe(
      false,
    );
  });
});

describe('heritageVisitPlan', () => {
  it('en yakın komşu sırasıyla dizer ve toplamları hesaplar', () => {
    const plan = heritageVisitPlan([patara, perge, olympos], antalya);
    expect(plan.order.map((s) => s.id)).toEqual(['perge', 'olympos', 'patara']);
    expect(plan.legs[0]?.fromPrevKm).toBeGreaterThan(10);
    expect(plan.legs[0]?.fromPrevKm).toBeLessThan(20);
    expect(plan.totalDurationMin).toBe(180);
    expect(plan.totalDistanceKm).toBeGreaterThan(150);
  });

  it('başlangıç yoksa ilk alandan başlar', () => {
    const plan = heritageVisitPlan([patara, perge, olympos], null);
    expect(plan.order[0]?.id).toBe('patara');
    expect(plan.legs[0]?.fromPrevKm).toBe(0);
    expect(plan.order.map((s) => s.id)).toEqual(['patara', 'olympos', 'perge']);
  });
});

describe('heritageTourSummary', () => {
  it('sıralı alanları çözer, bilinmeyen id atlar', () => {
    const s = heritageTourSummary({ siteIds: ['perge', 'yok', 'patara', 'giza'] }, all);
    expect(s.sites.map((x) => x.id)).toEqual(['perge', 'patara', 'giza']);
    expect(s.totalDurationMin).toBe(360);
    expect(s.unescoCount).toBe(1);
    expect(s.countries).toEqual(['TR', 'EG']);
    expect(s.totalDistanceKm).toBeGreaterThan(700);
    expect(s.estimatedDays).toBeGreaterThanOrEqual(2);
  });
});

describe('guideDurationMin / heritageSiteScript', () => {
  const stops: AudioGuideStop[] = [
    {
      id: 'b',
      siteId: 'x',
      order: 2,
      title: 'İkinci',
      coords: null,
      durationSec: 100,
      script: 'B metni',
      imageUrl: null,
    },
    {
      id: 'a',
      siteId: 'x',
      order: 1,
      title: 'Birinci',
      coords: null,
      durationSec: 50,
      script: 'A metni',
      imageUrl: null,
    },
  ];
  it('toplam süreyi dakikaya yukarı yuvarlar', () => {
    expect(guideDurationMin(stops)).toBe(3);
    expect(guideDurationMin([])).toBe(0);
  });
  it('tam metin sıralı üretilir', () => {
    const text = heritageSiteScript({ name: 'Alan', summary: 'Özet.' }, stops);
    expect(text.startsWith('Alan. Özet.')).toBe(true);
    expect(text.indexOf('1. Birinci')).toBeLessThan(text.indexOf('2. İkinci'));
  });
});

describe('etiketler ve yardımcılar', () => {
  it('ücret / UNESCO / yüzyıl etiketleri', () => {
    expect(heritageFeeLabel({ entryFeeTry: null })).toBe('Ücretsiz');
    expect(heritageFeeLabel({ entryFeeTry: 0 }, 'en')).toBe('Free');
    expect(heritageFeeLabel({ entryFeeTry: 200 })).toContain('200');
    expect(heritageUnescoLabel(giza)).toBe('UNESCO 1979');
    expect(heritageUnescoLabel(patara)).toBeNull();
    expect(heritageCenturyLabel('lycian')).toContain('MÖ');
    expect(heritageCenturyLabel('inca', 'en')).toContain('century');
  });

  it('yakındaki alanlar ve ülke sıralaması', () => {
    const near = nearbyHeritageSites(perge, all, 4, 80);
    expect(near.map((s) => s.id)).toEqual(['olympos']);
    expect(near[0]?.distanceKm).toBeGreaterThan(0);
    expect(heritageCountries([giza, patara, perge])).toEqual(['TR', 'EG']);
  });

  it('tur doğrulama', () => {
    expect(validateHeritageTourInput({ title: '', siteIds: ['a', 'b'], date: null })).toBe(
      'nameRequired',
    );
    expect(validateHeritageTourInput({ title: 'T', siteIds: ['a'], date: null })).toBe('minSites');
    expect(validateHeritageTourInput({ title: 'T', siteIds: ['a', 'b'], date: '12/05/2026' })).toBe(
      'invalidDate',
    );
    expect(
      validateHeritageTourInput({ title: 'T', siteIds: ['a', 'b'], date: '2026-05-12' }),
    ).toBeNull();
  });
});
