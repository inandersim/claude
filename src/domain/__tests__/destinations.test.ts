import {
  acclimatizationPlan,
  ascentRateWarning,
  budgetLabel,
  filterDestinations,
  formatCountdown,
  formatMonths,
  isOverdue,
  lakeLouiseScore,
  overdueMessage,
  packingForDestination,
  primaryPlan,
  returnPlanStatus,
  stageProfile,
  timeUntilReturn,
  totalAscent,
  totalDescent,
  totalDistance,
  validateReturnPlanInput,
  type Destination,
  type DestinationStage,
  type ReturnPlan,
} from '@/domain';

const stage = (
  order: number,
  elevationM: number,
  sleeping: boolean,
  extra: Partial<DestinationStage> = {},
): DestinationStage => ({
  id: `s${order}`,
  destinationId: 'd',
  order,
  name: `Stage ${order}`,
  kind: 'teahouse',
  coords: { latitude: 0, longitude: 0 },
  elevationM,
  distanceKm: 10,
  durationMin: 300,
  sleeping,
  facilities: [],
  waterAvailable: true,
  connectivity: 'none',
  note: '',
  restDayRecommended: false,
  ...extra,
});

const dest = (extra: Partial<Destination>): Destination => ({
  id: 'd',
  slug: 'd',
  name: 'Test',
  region: 'Region',
  countryCode: 'TR',
  type: 'trek',
  adventureTypes: ['hiking'],
  coords: { latitude: 41, longitude: 29 },
  imageUrl: null,
  summary: '',
  guide: '',
  maxElevationM: 3000,
  typicalDays: 5,
  totalDistanceKm: 50,
  difficulty: 'moderate',
  bestMonths: [6, 7, 8],
  transports: [],
  permits: [],
  budgetTry: { low: 1000, high: 2000 },
  risks: [],
  gear: [],
  rescueNote: '',
  insuranceRequired: false,
  stageCount: 0,
  rating: 4,
  reviewCount: 1,
  sources: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const plan = (extra: Partial<ReturnPlan>): ReturnPlan => ({
  id: 'p',
  userId: 'u_me',
  title: 'Zirve günü',
  destinationId: null,
  adventureType: 'hiking',
  startAt: '2026-09-06T06:00:00.000Z',
  expectedReturnAt: '2026-09-06T14:00:00.000Z',
  graceMin: 60,
  route: 'A → B',
  companions: '',
  contactIds: [],
  status: 'active',
  returnedAt: null,
  alertSentAt: null,
  createdAt: '2026-09-06T05:00:00.000Z',
  ...extra,
});

describe('lakeLouiseScore', () => {
  it('eşikler: 0–2 none, 3–5 mild, 6–9 moderate, ≥10 severe', () => {
    expect(lakeLouiseScore(1, 1, 0, 0)).toEqual({ score: 2, severity: 'none' });
    expect(lakeLouiseScore(1, 1, 1, 0)).toEqual({ score: 3, severity: 'mild' });
    expect(lakeLouiseScore(2, 1, 2, 0)).toEqual({ score: 5, severity: 'mild' });
    expect(lakeLouiseScore(2, 2, 2, 0)).toEqual({ score: 6, severity: 'moderate' });
    expect(lakeLouiseScore(3, 3, 3, 0)).toEqual({ score: 9, severity: 'moderate' });
    expect(lakeLouiseScore(3, 3, 3, 1)).toEqual({ score: 10, severity: 'severe' });
    expect(lakeLouiseScore(3, 3, 3, 3).severity).toBe('severe');
  });

  it('baş ağrısı yoksa skor ne olursa olsun AMS yok', () => {
    expect(lakeLouiseScore(0, 3, 3, 3)).toEqual({ score: 9, severity: 'none' });
  });
});

describe('ascentRateWarning / acclimatizationPlan', () => {
  const stages = [
    stage(1, 2860, true), // Lukla
    stage(2, 2610, true), // Phakding
    stage(3, 3440, true, { restDayRecommended: true }), // Namche (+830)
    stage(4, 3860, true), // Tengboche (+420)
    stage(5, 4410, true, { restDayRecommended: true }), // Dingboche (+550)
    stage(6, 4940, true), // Lobuche (+530)
    stage(7, 5364, false, { kind: 'base_camp' }), // EBC (uyunmaz)
    stage(8, 5164, true), // Gorak Shep (+224)
  ];

  it('uyku irtifası >500 m artan etapları işaretler; konaklanmayan etapları atlar', () => {
    const w = ascentRateWarning(stages);
    expect(w.map((x) => x.stageId)).toEqual(['s3', 's5', 's6']);
    expect(w[0]).toMatchObject({ fromElevationM: 2610, toElevationM: 3440, gainM: 830 });
  });

  it('2.500 m altındaki hedefler uyarı vermez', () => {
    expect(ascentRateWarning([stage(1, 500, true), stage(2, 1400, true)])).toEqual([]);
  });

  it('aklimatizasyon planı işaretli, eşik ve hızlı artış durakları önerir', () => {
    const p = acclimatizationPlan(stages);
    expect(p.map((x) => [x.stageId, x.reason])).toEqual([
      ['s3', 'marked'],
      ['s5', 'marked'],
      ['s6', 'gain'],
    ]);
  });

  it('boş listede uyarı yok', () => {
    expect(ascentRateWarning([])).toEqual([]);
    expect(acclimatizationPlan([])).toEqual([]);
  });
});

describe('stageProfile ve toplamlar', () => {
  const stages = [
    stage(2, 2000, true, { distanceKm: 5.5 }),
    stage(1, 1000, true, { distanceKm: 0 }),
    stage(3, 1500, true, { distanceKm: 4 }),
    stage(4, 3000, true, { distanceKm: 6 }),
  ];

  it('kümülatif km ve irtifa çiftleri (sıraya göre)', () => {
    expect(stageProfile(stages)).toEqual([
      [0, 1000],
      [5.5, 2000],
      [9.5, 1500],
      [15.5, 3000],
    ]);
  });

  it('toplam tırmanış / iniş / mesafe', () => {
    expect(totalAscent(stages)).toBe(1000 + 1500);
    expect(totalDescent(stages)).toBe(500);
    expect(totalDistance(stages)).toBe(15.5);
  });
});

describe('filterDestinations', () => {
  const list = [
    dest({
      id: 'a',
      name: 'Everest Base Camp',
      countryCode: 'NP',
      bestMonths: [3, 4, 10, 11],
      coords: { latitude: 27.99, longitude: 86.83 },
    }),
    dest({
      id: 'b',
      name: 'Kaçkar Dağları',
      region: 'Rize',
      countryCode: 'TR',
      bestMonths: [7, 8, 9],
      coords: { latitude: 40.83, longitude: 41.16 },
    }),
    dest({
      id: 'c',
      name: 'Kaş Dalış',
      countryCode: 'TR',
      type: 'dive_region',
      adventureTypes: ['diving'],
      bestMonths: [6, 7, 8, 9, 10],
      coords: { latitude: 36.2, longitude: 29.64 },
    }),
  ];

  it('ay ve ülkeye göre filtreler', () => {
    expect(filterDestinations(list, { month: 8 }).map((d) => d.id)).toEqual(['b', 'c']);
    expect(filterDestinations(list, { countryCode: 'NP' }).map((d) => d.id)).toEqual(['a']);
    expect(filterDestinations(list, { countryCode: 'TR', month: 6 }).map((d) => d.id)).toEqual([
      'c',
    ]);
  });

  it('tür ve macera türü', () => {
    expect(filterDestinations(list, { type: 'dive_region' }).map((d) => d.id)).toEqual(['c']);
    expect(filterDestinations(list, { adventureType: 'hiking' }).map((d) => d.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('metin araması Türkçe karakter duyarsız (ad/bölge)', () => {
    expect(filterDestinations(list, { query: 'kackar' }).map((d) => d.id)).toEqual(['b']);
    expect(filterDestinations(list, { query: 'RİZE' }).map((d) => d.id)).toEqual(['b']);
    expect(filterDestinations(list, { query: 'yok böyle' })).toEqual([]);
  });

  it('origin verilince mesafeye göre sıralar', () => {
    const origin = { latitude: 41.0, longitude: 29.0 }; // İstanbul
    const ids = filterDestinations(list, { origin }).map((d) => d.id);
    expect(ids).toEqual(['c', 'b', 'a']); // Kaş (~540 km), Kaçkar (~1000 km), Nepal
  });
});

describe('returnPlanStatus / isOverdue', () => {
  const p = plan({});

  it('başlangıçtan önce planned, arada active', () => {
    expect(returnPlanStatus(p, Date.parse('2026-09-06T05:00:00Z'))).toBe('planned');
    expect(returnPlanStatus(p, Date.parse('2026-09-06T10:00:00Z'))).toBe('active');
  });

  it('tolerans dolmadan gecikmiş sayılmaz, dolunca overdue', () => {
    expect(isOverdue(p, Date.parse('2026-09-06T14:30:00Z'))).toBe(false);
    expect(returnPlanStatus(p, Date.parse('2026-09-06T14:59:00Z'))).toBe('active');
    expect(isOverdue(p, Date.parse('2026-09-06T15:00:00Z'))).toBe(true);
    expect(returnPlanStatus(p, Date.parse('2026-09-06T16:00:00Z'))).toBe('overdue');
  });

  it('returned / cancelled sabit kalır', () => {
    const late = Date.parse('2026-09-07T00:00:00Z');
    expect(returnPlanStatus(plan({ status: 'returned' }), late)).toBe('returned');
    expect(isOverdue(plan({ status: 'cancelled' }), late)).toBe(false);
  });

  it('timeUntilReturn dakika döner, geçmişse negatif', () => {
    expect(timeUntilReturn(p, Date.parse('2026-09-06T12:00:00Z'))).toBe(120);
    expect(timeUntilReturn(p, Date.parse('2026-09-06T14:40:00Z'))).toBe(-40);
  });

  it('primaryPlan gecikmiş > aktif > planlı', () => {
    const now = Date.parse('2026-09-06T16:00:00Z');
    const overdue = plan({ id: 'o' });
    const active = plan({ id: 'a', expectedReturnAt: '2026-09-06T20:00:00Z' });
    const planned = plan({
      id: 'n',
      startAt: '2026-09-07T06:00:00Z',
      expectedReturnAt: '2026-09-07T12:00:00Z',
    });
    expect(primaryPlan([planned, active, overdue], now)?.id).toBe('o');
    expect(primaryPlan([planned, active], now)?.id).toBe('a');
    expect(primaryPlan([planned], now)?.id).toBe('n');
    expect(primaryPlan([plan({ status: 'returned' })], now)).toBeNull();
  });
});

describe('overdueMessage', () => {
  it('ad, plan, rota ve son konum uyarısı içerir', () => {
    const msg = overdueMessage(plan({ companions: 'Elif' }), { displayName: 'Deniz Kaya' }, 'tr');
    expect(msg).toContain('Deniz Kaya');
    expect(msg).toContain('Plan: Zirve günü');
    expect(msg).toContain('Rota: A → B');
    expect(msg).toContain('Yol arkadaşları: Elif');
    expect(msg).toContain('Son konum bilinmiyor');
    expect(msg).toContain('60 dk');
  });

  it('İngilizce sürüm ve bilinen konum', () => {
    const msg = overdueMessage(plan({}), { displayName: 'Deniz' }, 'en', 'Dilberdüzü');
    expect(msg).toContain('Last known location: Dilberdüzü');
    expect(msg).toContain('Route: A → B');
  });
});

describe('formatlar', () => {
  it('formatMonths aralıkları sıkıştırır', () => {
    expect(formatMonths([3, 4, 5, 9, 10, 11], 'tr')).toBe('Mar–May, Eyl–Kas');
    expect(formatMonths([6, 7, 8], 'en')).toBe('Jun–Aug');
    expect(formatMonths([1, 12], 'tr')).toBe('Oca, Ara');
    expect(formatMonths([], 'tr')).toBe('—');
    expect(formatMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'en')).toBe('All year');
  });

  it('budgetLabel ve formatCountdown', () => {
    expect(budgetLabel({ low: 45000, high: 90000 }, 'tr')).toBe('₺45.000 – ₺90.000');
    expect(budgetLabel({ low: 1000, high: 1000 }, 'en')).toBe('₺1,000');
    expect(formatCountdown(135, 'tr')).toBe('2 sa 15 dk');
    expect(formatCountdown(-40, 'en')).toBe('-40 m');
    expect(formatCountdown(1500, 'tr')).toBe('1 g 1 sa');
    expect(formatCountdown(0, 'tr')).toBe('0 dk');
  });
});

describe('packingForDestination', () => {
  it('irtifa/tür/mevsime göre ek eşya', () => {
    const keys = packingForDestination(
      dest({ maxElevationM: 5895, type: 'expedition', bestMonths: [1, 2, 7] }),
    ).map((i) => i.key);
    expect(keys).toContain('destinations.packing.doubleBoots');
    expect(keys).toContain('destinations.packing.sleepingBagMinus15');
    expect(keys).toContain('destinations.packing.harnessRope');
    expect(keys).toContain('destinations.packing.microspikes');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('dalış bölgesi için dalış eşyası, irtifa eşyası yok', () => {
    const keys = packingForDestination(
      dest({
        maxElevationM: 0,
        type: 'dive_region',
        adventureTypes: ['diving'],
        bestMonths: [6, 7],
      }),
    ).map((i) => i.key);
    expect(keys).toContain('destinations.packing.diveComputer');
    expect(keys).not.toContain('destinations.packing.downJacket');
  });
});

describe('validateReturnPlanInput', () => {
  it('başlık, sıra ve tolerans hataları', () => {
    expect(
      validateReturnPlanInput({
        title: ' ',
        startAt: '2026-09-06T10:00:00Z',
        expectedReturnAt: '2026-09-06T09:00:00Z',
        graceMin: 5000,
      }),
    ).toEqual([
      'destinations.plan.errors.title',
      'destinations.plan.errors.returnAfterStart',
      'destinations.plan.errors.grace',
    ]);
    expect(
      validateReturnPlanInput({
        title: 'ok',
        startAt: '2026-09-06T10:00:00Z',
        expectedReturnAt: '2026-09-06T12:00:00Z',
        graceMin: 30,
      }),
    ).toEqual([]);
  });
});
