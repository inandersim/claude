import {
  bestMonthsLabel,
  campingLaw,
  checklistProgress,
  COUNTRY_FLAG,
  countriesOfDestinations,
  daysBetween,
  documentsDue,
  filterCountries,
  lawTone,
  normalizeCountryText,
  regionOf,
  sortAlphabetically,
  sortByRelevance,
  sourceHost,
  tripDateFromPreset,
  visaLabel,
  visaSteps,
  visaUrgency,
} from '../countries';
import type { CountryChecklist, CountryGuide } from '../types';

const NOW = new Date('2026-09-06T09:00:00.000Z');
const DAY = 86_400_000;
const plusDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

const guide = (over: Partial<CountryGuide> = {}): CountryGuide => ({
  countryCode: 'NP',
  name: 'Nepal',
  region: 'Güney Asya · Himalaya',
  languages: ['ne'],
  currency: 'NPR',
  tryRate: 0.33,
  timezone: 'UTC+5:45',
  plugTypes: ['C'],
  visa: {
    type: 'on_arrival',
    maxStayDays: 90,
    costTry: 1350,
    processingDays: 0,
    url: null,
    note: '',
  },
  documents: [
    { key: 'passport', label: 'Pasaport', required: true, note: '' },
    { key: 'insurance', label: 'Sigorta', required: true, note: '' },
    { key: 'visa', label: 'Vize', required: true, note: '' },
    { key: 'idp', label: 'Ehliyet', required: false, note: '' },
  ],
  etiquette: [],
  dressCode: '',
  religionNotes: '',
  photographyRules: '',
  tipping: '',
  bargaining: '',
  watchOut: [],
  womenTravelers: '',
  laws: ['Drone yasak', 'Vahşi kamp milli parklarda yasak, ateş yasak'],
  droneRules: 'Yasak',
  alcoholRules: '18 yaş',
  money: '',
  connectivity: '',
  health: [],
  vaccines: [],
  bestMonths: [10, 3, 4],
  dailyTips: [],
  sources: [],
  updatedAt: NOW.toISOString(),
  ...over,
});

const checklist = (over: Partial<CountryChecklist> = {}): CountryChecklist => ({
  userId: 'u_me',
  countryCode: 'NP',
  done: [],
  tripDate: null,
  updatedAt: NOW.toISOString(),
  ...over,
});

const embassy = (processingDays: number | null) =>
  guide({
    countryCode: 'US',
    name: 'ABD',
    visa: { type: 'embassy', maxStayDays: 180, costTry: 8300, processingDays, url: null, note: '' },
  });

describe('normalizeCountryText / filterCountries', () => {
  const list = [
    guide(),
    guide({ countryCode: 'GE', name: 'Gürcistan', region: 'Kafkasya' }),
    guide({ countryCode: 'IS', name: 'İzlanda', region: 'Kuzey Avrupa' }),
    guide({ countryCode: 'CH', name: 'İsviçre', region: 'Batı Avrupa · Alpler' }),
  ];

  it('Türkçe karakterleri ve aksanları normalize eder', () => {
    expect(normalizeCountryText('İzlanda')).toBe('izlanda');
    expect(normalizeCountryText('GÜRCİSTAN')).toBe('gurcistan');
    expect(normalizeCountryText('Isviçre')).toBe('isvicre');
  });

  it('boş sorgu listeyi değiştirmez', () => {
    expect(filterCountries(list, '')).toBe(list);
    expect(filterCountries(list, null)).toHaveLength(4);
  });

  it('ad, bölge, kod ve bölge anahtarıyla aksansız eşleşir', () => {
    expect(filterCountries(list, 'gurcistan').map((c) => c.countryCode)).toEqual(['GE']);
    expect(filterCountries(list, 'izl').map((c) => c.countryCode)).toEqual(['IS']);
    expect(filterCountries(list, 'ch').map((c) => c.countryCode)).toContain('CH');
    expect(
      filterCountries(list, 'avrupa')
        .map((c) => c.countryCode)
        .sort(),
    ).toEqual(['CH', 'IS']);
    expect(filterCountries(list, 'himalaya').map((c) => c.countryCode)).toEqual(['NP']);
    expect(filterCountries(list, 'kafkas').map((c) => c.countryCode)).toEqual(['GE']);
  });

  it('eşleşme yoksa boş döner', () => {
    expect(filterCountries(list, 'atlantis')).toEqual([]);
  });
});

describe('regionOf / COUNTRY_FLAG / visaLabel', () => {
  it('bilinen kodların bölgesi ve bayrağı', () => {
    expect(regionOf('np')).toBe('south_asia');
    expect(regionOf('FR')).toBe('europe');
    expect(regionOf('XX')).toBeNull();
    expect(regionOf(null)).toBeNull();
    expect(COUNTRY_FLAG('TR')).toBe('🇹🇷');
    expect(COUNTRY_FLAG(null)).toBe('🏳️');
  });
  it('vize etiketi i18n anahtarı', () => {
    expect(visaLabel({ type: 'e_visa' })).toBe('countries.visa.e_visa');
  });
});

describe('checklistProgress', () => {
  it('zorunlu ve isteğe bağlı ayrı sayılır', () => {
    const p = checklistProgress(guide(), checklist({ done: ['passport', 'idp'] }));
    expect(p.required).toEqual({ done: 1, total: 3 });
    expect(p.optional).toEqual({ done: 1, total: 1 });
    expect(p.ratio).toBeCloseTo(0.5);
    expect(p.requiredComplete).toBe(false);
  });
  it('tanımsız anahtarlar sayılmaz, checklist yoksa sıfır', () => {
    const p = checklistProgress(guide(), checklist({ done: ['ghost'] }));
    expect(p.required.done).toBe(0);
    expect(checklistProgress(guide(), null).ratio).toBe(0);
    expect(checklistProgress(guide({ documents: [] }), null).ratio).toBe(0);
  });
  it('tüm zorunlular işaretliyse requiredComplete', () => {
    const p = checklistProgress(guide(), checklist({ done: ['passport', 'insurance', 'visa'] }));
    expect(p.requiredComplete).toBe(true);
    expect(p.ratio).toBeCloseTo(0.75);
  });
});

describe('visaUrgency — tarih sınırları', () => {
  it('tarih yoksa ya da vize gerekmiyorsa ok', () => {
    expect(visaUrgency(embassy(90), checklist(), NOW)).toBe('ok');
    expect(visaUrgency(guide(), checklist({ tripDate: plusDays(3) }), NOW)).toBe('ok');
    expect(
      visaUrgency(
        guide({ visa: { ...guide().visa, type: 'visa_free' } }),
        checklist({ tripDate: plusDays(1) }),
        NOW,
      ),
    ).toBe('ok');
  });

  it('now + processing + 7 > tripDate → soon; now + processing > tripDate → late', () => {
    const g = embassy(10);
    expect(visaUrgency(g, checklist({ tripDate: plusDays(30) }), NOW)).toBe('ok');
    expect(visaUrgency(g, checklist({ tripDate: plusDays(17) }), NOW)).toBe('ok'); // tam sınır: eşit → ok
    expect(visaUrgency(g, checklist({ tripDate: plusDays(16) }), NOW)).toBe('soon');
    expect(visaUrgency(g, checklist({ tripDate: plusDays(10) }), NOW)).toBe('soon'); // tam sınır: eşit → soon
    expect(visaUrgency(g, checklist({ tripDate: plusDays(9) }), NOW)).toBe('late');
    expect(visaUrgency(g, checklist({ tripDate: plusDays(-1) }), NOW)).toBe('late');
  });

  it('processingDays null → 0 kabul edilir; vize işaretliyse ok', () => {
    expect(visaUrgency(embassy(null), checklist({ tripDate: plusDays(5) }), NOW)).toBe('soon');
    expect(visaUrgency(embassy(null), checklist({ tripDate: plusDays(8) }), NOW)).toBe('ok');
    expect(
      visaUrgency(embassy(90), checklist({ tripDate: plusDays(5), done: ['visa'] }), NOW),
    ).toBe('ok');
  });
});

describe('documentsDue', () => {
  it('kalan gün, eksik zorunlular ve başvuru son tarihi', () => {
    const due = documentsDue(
      embassy(10),
      checklist({ tripDate: plusDays(45), done: ['passport'] }),
      NOW,
    );
    expect(due.daysLeft).toBe(45);
    expect(due.urgency).toBe('ok');
    expect(due.applyNow).toBe(false);
    expect(due.visaDone).toBe(false);
    expect(due.missingRequired.map((d) => d.key)).toEqual(['insurance', 'visa']);
    expect(due.applyBy).toBe(plusDays(45 - 17));
  });

  it('acil durumda applyNow, vize işaretliyse değil', () => {
    expect(documentsDue(embassy(10), checklist({ tripDate: plusDays(12) }), NOW).applyNow).toBe(
      true,
    );
    expect(
      documentsDue(embassy(10), checklist({ tripDate: plusDays(12), done: ['visa'] }), NOW)
        .applyNow,
    ).toBe(false);
  });

  it('vize gerekmeyen ülkede applyBy null, tarih yoksa daysLeft null', () => {
    const due = documentsDue(guide(), checklist({ tripDate: plusDays(3) }), NOW);
    expect(due.applyBy).toBeNull();
    expect(due.applyNow).toBe(false);
    expect(documentsDue(guide(), null, NOW).daysLeft).toBeNull();
  });
});

describe('tripDateFromPreset / daysBetween', () => {
  it('hızlı seçimler ileri tarih üretir', () => {
    expect(daysBetween(NOW, tripDateFromPreset('2w', NOW))).toBe(14);
    expect(daysBetween(NOW, tripDateFromPreset('1m', NOW))).toBe(30);
    expect(daysBetween(NOW, tripDateFromPreset('3m', NOW))).toBe(91);
    expect(daysBetween(NOW, NOW)).toBe(0);
    expect(daysBetween(NOW, plusDays(-2))).toBe(-2);
  });
});

describe('sortByRelevance / sortAlphabetically / countriesOfDestinations', () => {
  const list = [
    guide({ countryCode: 'US', name: 'ABD' }),
    guide({ countryCode: 'NP', name: 'Nepal' }),
    guide({ countryCode: 'GE', name: 'Gürcistan' }),
    guide({ countryCode: 'TZ', name: 'Tanzanya' }),
    guide({ countryCode: 'IS', name: 'İzlanda' }),
  ];
  const dests = [{ countryCode: 'NP' }, { countryCode: 'np' }, { countryCode: 'TZ' }];

  it('destinasyon ülkeleri (sayıya göre) → kullanıcı ülkesi → alfabetik', () => {
    expect(sortByRelevance(list, 'ge', dests).map((c) => c.countryCode)).toEqual([
      'NP',
      'TZ',
      'GE',
      'US',
      'IS',
    ]);
  });
  it('bağlam yoksa yalnızca Türkçe alfabetik', () => {
    expect(sortByRelevance(list, null, []).map((c) => c.name)).toEqual([
      'ABD',
      'Gürcistan',
      'İzlanda',
      'Nepal',
      'Tanzanya',
    ]);
    expect(sortAlphabetically(list).map((c) => c.countryCode)).toEqual([
      'US',
      'GE',
      'IS',
      'NP',
      'TZ',
    ]);
  });
  it('girdi listesi değişmez', () => {
    const copy = [...list];
    sortByRelevance(list, 'US', dests);
    expect(list).toEqual(copy);
  });
  it('destinasyonu olan ülkeleri süzer', () => {
    expect(countriesOfDestinations(list, dests).map((c) => c.countryCode)).toEqual(['NP', 'TZ']);
  });
});

describe('visaSteps / lawTone / campingLaw / etiketler', () => {
  it('vize türüne göre adım listesi', () => {
    expect(visaSteps(embassy(10))[1]).toBe('countries.steps.appointment');
    expect(visaSteps(guide())).toContain('countries.steps.photosCash');
    expect(visaSteps(guide({ visa: { ...guide().visa, type: 'banned' } }))).toEqual([
      'countries.steps.contactMinistry',
    ]);
  });
  it('yasa metninden sinyal', () => {
    expect(lawTone('Turistler için tam yasak')).toBe('banned');
    expect(lawTone('Yasak; taşımayı düşünme.')).toBe('banned');
    expect(lawTone('250 g üstü kayıt ve izin gerekir')).toBe('restricted');
    expect(lawTone('18 yaş; sokakta içmek serbest')).toBe('allowed');
    expect(campingLaw(guide())).toMatch(/kamp/i);
    expect(campingLaw(guide({ laws: [] }))).toBeNull();
  });
  it('ay etiketi sıralı ve yerelleştirilmiş; kaynak alan adı', () => {
    expect(bestMonthsLabel([10, 3, 4], 'tr')).toBe('Mar, Nis, Eki');
    expect(bestMonthsLabel([12, 1], 'en')).toBe('Jan, Dec');
    expect(sourceHost('https://www.immigration.gov.np/path')).toBe('immigration.gov.np');
    expect(sourceHost('kaynak')).toBe('kaynak');
  });
});
