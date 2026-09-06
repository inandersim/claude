import {
  answerLocally,
  buildTripPlan,
  classifyIntent,
  foldText,
  matchPlaces,
  parseTripRequest,
  suggestPrompts,
  summarizeThreadTitle,
  type LocalKnowledge,
} from '../ai';
import type { AiContext, EmergencyCenter, HazardZone, LibraryPlace } from '../types';

const place = (o: Partial<LibraryPlace> & Pick<LibraryPlace, 'id' | 'name'>): LibraryPlace => ({
  source: 'curated',
  kind: 'peak',
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

const places: LibraryPlace[] = [
  place({
    id: 'cur:hike:kackar',
    name: 'Kaçkar Zirtan Rotası',
    kind: 'hiking_route',
    lat: 40.8608,
    lng: 41.1594,
    elevationM: 2200,
    description: 'Yukarı Kavron–Dilberdüzü–Zirve; 14 km, 1.400 m tırmanış.',
  }),
  place({
    id: 'cur:peak:kackar',
    name: 'Kaçkar Dağı',
    kind: 'peak',
    lat: 40.8356,
    lng: 41.1211,
    elevationM: 3937,
  }),
  place({
    id: 'cur:shelter:dilberduzu',
    name: 'Dilberdüzü Kamp Yeri',
    kind: 'shelter',
    lat: 40.846,
    lng: 41.14,
    elevationM: 3100,
  }),
  place({
    id: 'cur:camp:olimpos',
    name: 'Olimpos Kamp Alanı',
    kind: 'campsite',
    adventureTypes: ['hiking', 'climbing'],
    lat: 36.397,
    lng: 30.474,
    elevationM: 20,
  }),
  place({
    id: 'cur:dive:kas',
    name: 'Kaş — Kanyon',
    kind: 'diving',
    adventureTypes: ['diving'],
    lat: 36.19,
    lng: 29.63,
    elevationM: -32,
  }),
  place({
    id: 'cur:climb:geyikbayiri',
    name: 'Geyikbayırı',
    kind: 'climbing',
    adventureTypes: ['climbing'],
    lat: 36.94,
    lng: 30.52,
    elevationM: 620,
  }),
];

const hazards: HazardZone[] = [
  {
    id: 'h4',
    type: 'avalanche',
    severity: 'critical',
    status: 'active',
    title: 'Erciyes Tekir kuzey yamaç — çığ riski 4/5',
    description: 'Rüzgâr yüklü yamaçlar.',
    locationName: 'Erciyes, Kayseri',
    coords: { latitude: 38.53, longitude: 35.45 },
    radiusM: 3000,
    reporterId: 'u_1',
    confirmations: 4,
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: null,
    resolvedAt: null,
  },
  {
    id: 'h1',
    type: 'rockfall',
    severity: 'high',
    status: 'active',
    title: 'Belgrad Ormanı — kaya düşmesi',
    description: 'Patika kısmen kapalı.',
    locationName: 'Belgrad Ormanı, Sarıyer',
    coords: { latitude: 41.18, longitude: 28.98 },
    radiusM: 500,
    reporterId: 'u_1',
    confirmations: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: null,
    resolvedAt: null,
  },
  {
    id: 'h9',
    type: 'closure',
    severity: 'low',
    status: 'resolved',
    title: 'Çözülmüş kapanış',
    description: '-',
    locationName: 'İstanbul',
    coords: { latitude: 41.0, longitude: 29.0 },
    radiusM: 100,
    reporterId: 'u_1',
    confirmations: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    expiresAt: null,
    resolvedAt: '2026-07-02T00:00:00.000Z',
  },
];

const centers: EmergencyCenter[] = [
  {
    id: 'ec3',
    name: 'AKUT İstanbul',
    type: 'mountain_rescue',
    coords: { latitude: 41.06, longitude: 29.0 },
    locationName: 'Şişli',
    phone: '+90 212 217 04 10',
    open24h: true,
    countryCode: 'TR',
  },
];

const kb: LocalKnowledge = {
  places,
  hazards,
  emergencyCenters: centers,
  firstAidSlugs: ['cpr', 'bleeding', 'fracture', 'hypothermia', 'snakebite', 'avalanche'],
  crags: [],
  businesses: [],
};

const ctx: AiContext = {
  locale: 'tr',
  coords: { latitude: 41.0, longitude: 29.0 },
  adventureTypes: ['hiking', 'climbing'],
  plan: 'free',
};
const enCtx: AiContext = { ...ctx, locale: 'en' };
const now = new Date('2026-09-05T08:00:00.000Z');

describe('foldText', () => {
  it('Türkçe karakterleri indirger ve küçültür', () => {
    expect(foldText('Kaçkar Dağı İÇİN Çığ')).toBe('kackar dagi icin cig');
  });
});

describe('classifyIntent', () => {
  it.each<[string, string]>([
    ['Kanama nasıl durdurulur?', 'first_aid'],
    ['Arkadaşımı yılan ısırdı ne yapmalıyım', 'first_aid'],
    ['Kaçkar için 3 günlük rota planla', 'plan_trip'],
    ['Hafta sonu için plan yap', 'plan_trip'],
    ['Çantama ne koymalıyım?', 'packing_list'],
    ['Yakınımda kamp alanı öner', 'find_place'],
    ['Erciyes’te çığ riski var mı?', 'safety_brief'],
    ['Yarın hava nasıl olacak, yağmur var mı?', 'weather'],
    ['Kış yürüyüşü için hangi botu almalıyım?', 'gear_advice'],
    ['merhaba', 'general'],
  ])('tr: "%s" → %s', (text, intent) => {
    expect(classifyIntent(text, 'tr')).toBe(intent);
  });

  it.each<[string, string]>([
    ['How do I stop bleeding?', 'first_aid'],
    ['Plan a 2-day trip to Kaçkar', 'plan_trip'],
    ['What should I pack for a weekend?', 'packing_list'],
    ['Recommend a campsite near me', 'find_place'],
    ['Is there avalanche risk at Erciyes?', 'safety_brief'],
    ['What is the forecast for tomorrow?', 'weather'],
    ['Which boots should I buy?', 'gear_advice'],
    ['hello there', 'general'],
  ])('en: "%s" → %s', (text, intent) => {
    expect(classifyIntent(text, 'en')).toBe(intent);
  });
});

describe('parseTripRequest / matchPlaces', () => {
  it('gün, seviye, tür ve yer ayrıştırır', () => {
    const req = parseTripRequest('Kaçkar için 3 günlük zorlu yürüyüş planla', ctx, places);
    expect(req.days).toBe(3);
    expect(req.level).toBe('hard');
    expect(req.adventureType).toBe('hiking');
    expect(req.place?.id).toMatch(/kackar/);
  });

  it('gece sayısını gün sayısına çevirir ve sınırlar', () => {
    expect(parseTripRequest('2 gece kamp', ctx, places).days).toBe(3);
    expect(parseTripRequest('30 günlük tur', ctx, places).days).toBe(14);
    expect(parseTripRequest('günübirlik dalış', ctx, places).days).toBe(1);
  });

  it('yer eşleşmesi ek almış adlarla da çalışır', () => {
    const found = matchPlaces("Geyikbayırı'na tırmanışa gidelim", places);
    expect(found[0]?.id).toBe('cur:climb:geyikbayiri');
    expect(matchPlaces('hiç ilgisiz bir cümle', places)).toHaveLength(0);
  });

  it('tür belirtilmemişse kullanıcı ilgi alanına düşer', () => {
    const req = parseTripRequest(
      'bir şeyler yapalım',
      { ...ctx, adventureTypes: ['diving'] },
      places,
    );
    expect(req.adventureType).toBe('diving');
  });
});

describe('buildTripPlan', () => {
  it('gün sayısı kadar gün üretir, tırmanış > 0 ve yerleri kullanır', () => {
    const plan = buildTripPlan('Kaçkar için 3 günlük yürüyüş planla', ctx, places, now);
    expect(plan.days).toHaveLength(3);
    expect(plan.adventureType).toBe('hiking');
    expect(plan.days.every((d) => d.ascentM > 0 && d.distanceKm > 0)).toBe(true);
    expect(plan.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(plan.title).toContain('Kaçkar');
    expect(plan.title).toContain('3 günlük');
    // Kümedeki yakın yerler (Dilberdüzü, Kaçkar Dağı) gün başlıklarında döner
    expect(
      plan.days.some((d) => d.title.includes('Dilberdüzü') || d.title.includes('Kaçkar Dağı')),
    ).toBe(true);
    expect(plan.packing.length).toBeGreaterThan(8);
    expect(plan.packing.some((p) => p.includes('Çadır'))).toBe(true);
    expect(plan.safety.length).toBeGreaterThanOrEqual(4);
    expect(plan.safety.some((s) => s.includes('112'))).toBe(true);
  });

  it('yüksek irtifa ve kış için ek notlar ekler', () => {
    const winter = new Date('2026-01-15T08:00:00.000Z');
    const plan = buildTripPlan('Kaçkar Dağı 2 gün', ctx, places, winter);
    expect(plan.packing.some((p) => /Krampon/i.test(p))).toBe(true);
    expect(plan.safety.some((s) => /irtifa/i.test(s))).toBe(true);
    expect(plan.safety.some((s) => /Kısa gün ışığı/.test(s))).toBe(true);
  });

  it('İngilizce bağlamda İngilizce üretir ve dalışta çadır eklemez', () => {
    const plan = buildTripPlan('Plan 2 days of diving in Kaş', enCtx, places, now);
    expect(plan.adventureType).toBe('diving');
    expect(plan.title).toMatch(/^2-day diving plan/);
    expect(plan.packing.some((p) => /Tent/.test(p))).toBe(false);
    expect(plan.days[0]?.notes).toMatch(/surface interval/);
  });

  it('kütüphane boşsa yine de plan döner', () => {
    const plan = buildTripPlan('2 günlük plan', ctx, [], now);
    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]?.ascentM).toBeGreaterThan(0);
  });
});

describe('answerLocally', () => {
  it('yer önerisinde kütüphane bağlantıları döner', () => {
    const a = answerLocally('Yakınımda kamp alanı öner', ctx, kb);
    expect(a.intent).toBe('find_place');
    expect(a.actions.some((x) => x.href.startsWith('/library/'))).toBe(true);
    expect(a.actions.some((x) => x.href === '/library')).toBe(true);
    expect(a.content).toContain('1.');
  });

  it('adı geçen yeri önce getirir', () => {
    const a = answerLocally('Kaş’ta dalış noktası öner', ctx, kb);
    expect(a.actions[0]?.href).toBe('/library/cur:dive:kas');
  });

  it('ilk yardımda rehber slug bağlantısı ve acil merkez verir', () => {
    const a = answerLocally('Kanama nasıl durdurulur?', ctx, kb);
    expect(a.intent).toBe('first_aid');
    expect(a.actions.some((x) => x.href === '/first-aid/bleeding')).toBe(true);
    expect(a.actions.some((x) => x.href === '/first-aid/contacts')).toBe(true);
    expect(a.content).toContain('AKUT İstanbul');
    expect(a.content).toContain('112');
  });

  it('güvenlik brifinginde aktif tehlike bağlantıları döner, çözülmüşleri atlar', () => {
    const a = answerLocally('Erciyes’te çığ riski var mı?', ctx, kb);
    expect(a.intent).toBe('safety_brief');
    expect(a.actions[0]?.href).toBe('/hazards/h4');
    expect(a.actions.some((x) => x.href === '/hazards/h9')).toBe(false);
    expect(a.actions.some((x) => x.href === '/hazards')).toBe(true);
    expect(a.content).toContain('kritik');
  });

  it('gezi planında planlayıcı bağlantısı ve gün satırları döner', () => {
    const a = answerLocally('Kaçkar için 3 günlük plan yap', enCtx, kb);
    expect(a.intent).toBe('plan_trip');
    expect(a.content).toContain('Day 1');
    expect(a.actions.some((x) => x.href === '/maps/planner')).toBe(true);
    expect(a.actions.some((x) => /^\/library\/cur:(hike|peak):kackar$/.test(x.href))).toBe(true);
  });

  it('paketleme, ekipman, hava ve genel niyetlerde en az bir aksiyon döner', () => {
    for (const text of [
      'Çantama ne koymalıyım?',
      'Hangi botu almalıyım?',
      'Hava nasıl?',
      'selam',
    ]) {
      const a = answerLocally(text, ctx, kb);
      expect(a.actions.length).toBeGreaterThan(0);
      expect(a.content.length).toBeGreaterThan(20);
      expect(a.actions.every((x) => x.href.startsWith('/'))).toBe(true);
    }
    expect(answerLocally('Hava nasıl?', ctx, kb).actions.some((x) => x.href === '/satellite')).toBe(
      true,
    );
  });
});

describe('suggestPrompts', () => {
  it('ilgi alanına göre en fazla 6 öneri döner', () => {
    const tr = suggestPrompts(ctx, 'tr');
    expect(tr).toHaveLength(6);
    expect(tr[0]).toContain('Kaçkar');
    const en = suggestPrompts({ ...ctx, adventureTypes: [] }, 'en');
    expect(en[0]).toMatch(/Kaçkar/);
    expect(en.some((p) => /campsite/.test(p))).toBe(true);
  });
});

describe('summarizeThreadTitle', () => {
  it('kısaltır, noktalama temizler ve baş harfi büyütür', () => {
    expect(summarizeThreadTitle('  kaçkar için plan yap?  ')).toBe('Kaçkar için plan yap');
    const long = summarizeThreadTitle(
      'Bu çok uzun bir mesaj ve kesinlikle kırk sekiz karakterden daha uzun olacak şekilde yazıldı',
    );
    expect(long.length).toBeLessThanOrEqual(49);
    expect(long.endsWith('…')).toBe(true);
    expect(summarizeThreadTitle('   ')).toBe('Sohbet');
  });
});
