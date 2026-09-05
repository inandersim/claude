import {
  ascentStats,
  bestSeasonLabel,
  canConfirm,
  compareGrades,
  convertGrade,
  cragSummary,
  cragVerificationOf,
  effectiveSystem,
  filterCrags,
  formatGrade,
  gradeBucket,
  gradeColor,
  gradeIndex,
  gradeVariants,
  pyramidOf,
  verificationOf,
} from '../climbing';
import type { Ascent, ClimbingRoute, Crag } from '../types';

const route = (o: Partial<ClimbingRoute>): ClimbingRoute => ({
  id: 'r',
  cragId: 'c',
  sectorId: 's',
  name: 'Rota',
  type: 'sport',
  grade: '6a',
  gradeSystem: 'french',
  lengthM: 20,
  pitches: 1,
  bolts: 8,
  stars: 3,
  firstAscent: null,
  description: '',
  verification: 'verified',
  confirmations: 0,
  ascentCount: 0,
  submittedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

const crag = (o: Partial<Crag>): Crag => ({
  id: 'c',
  name: 'Kaya',
  locationName: 'Yer',
  countryCode: 'TR',
  coords: { latitude: 37, longitude: 30 },
  rockType: 'Kireçtaşı',
  description: '',
  imageUrl: null,
  climbTypes: ['sport'],
  routeCount: 10,
  verification: 'verified',
  seasons: [10, 11, 12, 1, 2, 3],
  approachMin: 10,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

const ascent = (o: Partial<Ascent>): Ascent => ({
  id: 'a',
  routeId: 'r',
  userId: 'u_me',
  style: 'redpoint',
  date: '2026-06-01T00:00:00.000Z',
  note: '',
  feltGrade: null,
  ...o,
});

describe('derece dönüşümü', () => {
  it('rota sistemleri arasında çevirir: 6a → 5.10a → VI+', () => {
    expect(convertGrade('6a', 'french', 'yds')).toBe('5.10a');
    expect(convertGrade('6a', 'french', 'uiaa')).toBe('VI+');
    expect(convertGrade('5.10a', 'yds', 'french')).toBe('6a');
    expect(convertGrade('VI+', 'uiaa', 'yds')).toBe('5.10a');
    expect(convertGrade('7a', 'french', 'yds')).toBe('5.11c');
    expect(convertGrade('8a', 'french', 'uiaa')).toBe('X');
  });

  it('boulder sistemleri arasında çevirir: V4 → 6B+', () => {
    expect(convertGrade('V4', 'v_scale', 'font')).toBe('6B+');
    expect(convertGrade('6B+', 'font', 'v_scale')).toBe('V4');
    expect(convertGrade('7A', 'font', 'v_scale')).toBe('V6');
    expect(convertGrade('V0', 'v_scale', 'font')).toBe('5');
  });

  it('çapraz aile ve bilinmeyen derece için null döner', () => {
    expect(convertGrade('6a', 'french', 'font')).toBeNull();
    expect(convertGrade('V4', 'v_scale', 'yds')).toBeNull();
    expect(convertGrade('12z', 'french', 'yds')).toBeNull();
  });

  it('aynı sisteme çevirirken yazımı normalize eder', () => {
    expect(convertGrade('6A+', 'french', 'french')).toBe('6a+');
    expect(convertGrade('6b+', 'font', 'font')).toBe('6B+');
    expect(gradeIndex('6a', 'french')).toBe(8);
    expect(gradeIndex('yok', 'french')).toBe(-1);
  });

  it('gradeVariants tüm karşılıkları verir', () => {
    const v = gradeVariants('6b', 'french');
    expect(v).toEqual({ french: '6b', yds: '5.10c', uiaa: 'VII', font: null, v_scale: null });
  });

  it('formatGrade tercih edilen sisteme çevirir, olmuyorsa orijinali döner', () => {
    expect(formatGrade({ grade: '6a', gradeSystem: 'french' }, 'yds')).toBe('5.10a');
    expect(formatGrade({ grade: '6A', gradeSystem: 'font' }, 'yds')).toBe('6A');
    expect(effectiveSystem('font', 'yds')).toBe('v_scale');
    expect(effectiveSystem('french', 'font')).toBe('french');
    expect(effectiveSystem('french', 'uiaa')).toBe('uiaa');
  });
});

describe('karşılaştırma, kova ve renk', () => {
  it('sistemler arası karşılaştırır', () => {
    expect(compareGrades('6a', 'french', '5.9', 'yds')).toBeGreaterThan(0);
    expect(compareGrades('5.10a', 'yds', '6a', 'french')).toBe(0);
    expect(compareGrades('V2', 'v_scale', '7A', 'font')).toBeLessThan(0);
    expect(compareGrades('??', 'french', '3', 'french')).toBeLessThan(0);
  });

  it('kovalar puana göre ayrılır', () => {
    expect(gradeBucket('5a', 'french')).toBe('beginner');
    expect(gradeBucket('6b', 'french')).toBe('intermediate');
    expect(gradeBucket('7a', 'french')).toBe('advanced');
    expect(gradeBucket('8b', 'french')).toBe('elite');
    expect(gradeBucket('V10', 'v_scale')).toBe('advanced');
  });

  it('renk kolaydan zora yeşilden mora gider', () => {
    expect(gradeColor('3', 'french')).toBe('#22c55e');
    expect(gradeColor('9b', 'french')).toBe('#a855f7');
    expect(gradeColor('6a', 'french')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('doğrulama', () => {
  it('verificationOf eşikleri', () => {
    expect(verificationOf(0, false, false)).toBe('unverified');
    expect(verificationOf(2, false, false)).toBe('unverified');
    expect(verificationOf(3, false, false)).toBe('community');
    expect(verificationOf(0, true, false)).toBe('verified');
    expect(verificationOf(0, false, true)).toBe('verified');
  });

  it('canConfirm: kendi rotan, tekrar ve zaten doğrulanmış', () => {
    const r = route({ id: 'r1', submittedBy: 'u_a', verification: 'unverified' });
    expect(canConfirm(r, 'u_a', [])).toBe(false);
    expect(canConfirm(r, 'u_b', [])).toBe(true);
    expect(canConfirm(r, 'u_b', [{ userId: 'u_b', routeId: 'r1' }])).toBe(false);
    expect(canConfirm(r, 'u_b', [{ userId: 'u_b', routeId: 'r2' }])).toBe(true);
    expect(canConfirm(route({ verification: 'verified' }), 'u_b', [])).toBe(false);
  });

  it('cragVerificationOf çoğunluğa bakar', () => {
    expect(cragVerificationOf([])).toBe('unverified');
    expect(
      cragVerificationOf([
        route({ verification: 'verified' }),
        route({ verification: 'verified' }),
        route({ verification: 'unverified' }),
      ]),
    ).toBe('verified');
    expect(
      cragVerificationOf([
        route({ verification: 'verified' }),
        route({ verification: 'community' }),
        route({ verification: 'unverified' }),
      ]),
    ).toBe('community');
    expect(
      cragVerificationOf([
        route({ verification: 'unverified' }),
        route({ verification: 'community' }),
      ]),
    ).toBe('unverified');
  });
});

describe('filterCrags', () => {
  const crags = [
    crag({ id: 'a', name: 'Geyikbayırı', coords: { latitude: 36.98, longitude: 30.53 } }),
    crag({
      id: 'b',
      name: 'Ballıkayalar',
      routeCount: 5,
      verification: 'community',
      coords: { latitude: 40.83, longitude: 29.42 },
    }),
    crag({
      id: 'c',
      name: 'Fontainebleau',
      countryCode: 'FR',
      climbTypes: ['boulder'],
      routeCount: 50,
      verification: 'unverified',
      coords: { latitude: 48.4, longitude: 2.6 },
    }),
  ];

  it('metin araması Türkçe büyük/küçük harfe duyarsız', () => {
    expect(filterCrags(crags, { query: 'BALLI' }, null).map((c) => c.id)).toEqual(['b']);
    expect(filterCrags(crags, { query: 'geyİk' }, null).map((c) => c.id)).toEqual(['a']);
  });

  it('ülke, tür ve doğrulama filtreleri', () => {
    expect(filterCrags(crags, { countryCode: 'FR' }, null).map((c) => c.id)).toEqual(['c']);
    expect(filterCrags(crags, { climbType: 'boulder' }, null).map((c) => c.id)).toEqual(['c']);
    expect(filterCrags(crags, { verifiedOnly: true }, null).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('konum verilirse mesafeye, yoksa rota sayısına göre sıralar', () => {
    const istanbul = { latitude: 41.0, longitude: 29.0 };
    const near = filterCrags(crags, {}, istanbul);
    expect(near.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(near[0]?.distanceKm).toBeGreaterThan(0);
    const far = filterCrags(crags, {}, null);
    expect(far.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(far[0]?.distanceKm).toBeNull();
  });
});

describe('özetler', () => {
  const routes = [
    route({ id: 'r1', grade: '5a', stars: 2 }),
    route({ id: 'r2', grade: '6b', stars: 4, type: 'multipitch' }),
    route({ id: 'r3', grade: '7b', stars: 5 }),
    route({ id: 'r4', grade: '7A', gradeSystem: 'font', type: 'boulder', stars: 3 }),
  ];

  it('cragSummary tür dağılımı, histogram ve ortalama yıldız', () => {
    const s = cragSummary(routes);
    expect(s.total).toBe(4);
    expect(s.byType).toEqual({ sport: 2, multipitch: 1, boulder: 1 });
    expect(s.histogram).toEqual({ beginner: 1, intermediate: 2, advanced: 1, elite: 0 });
    expect(s.avgStars).toBe(3.5);
    expect(s.easiest?.id).toBe('r1');
    expect(s.hardest?.id).toBe('r3');
  });

  it('ascentStats stil sayıları ve en zor başarılı çıkış', () => {
    const ascents = [
      ascent({ id: 'a1', routeId: 'r1', style: 'onsight' }),
      ascent({ id: 'a2', routeId: 'r2', style: 'flash' }),
      ascent({ id: 'a3', routeId: 'r3', style: 'attempt' }),
      ascent({ id: 'a4', routeId: 'r4', style: 'redpoint' }),
      ascent({ id: 'a5', routeId: 'r2', style: 'toprope' }),
    ];
    const s = ascentStats(ascents, routes);
    expect(s.total).toBe(5);
    expect(s.sends).toBe(3);
    expect(s.byStyle).toEqual({ onsight: 1, flash: 1, redpoint: 1, toprope: 1, attempt: 1 });
    // 7A boulder (36) > 6b (30); 7b deneme sayılmaz
    expect(s.hardest?.route.id).toBe('r4');
    expect(s.cragCount).toBe(1);
  });

  it('pyramidOf yalnızca başarılı çıkışları sayar ve tercih edilen sisteme çevirir', () => {
    const ascents = [
      ascent({ id: 'a1', routeId: 'r2', style: 'redpoint' }),
      ascent({ id: 'a2', routeId: 'r2', style: 'flash' }),
      ascent({ id: 'a3', routeId: 'r1', style: 'onsight' }),
      ascent({ id: 'a4', routeId: 'r3', style: 'attempt' }),
      ascent({ id: 'a5', routeId: 'r4', style: 'redpoint' }),
    ];
    const rows = pyramidOf(ascents, routes, 'yds');
    expect(rows.map((r) => [r.grade, r.system, r.count])).toEqual([
      ['V6', 'v_scale', 1],
      ['5.10c', 'yds', 2],
      ['5.8', 'yds', 1],
    ]);
  });

  it('bestSeasonLabel yıl sonu sarmalını tek aralık yapar', () => {
    expect(bestSeasonLabel([10, 11, 12, 1, 2, 3, 4], 'tr')).toBe('Eki–Nis');
    expect(bestSeasonLabel([3, 4, 5, 9, 10, 11], 'en')).toBe('Mar–May, Sep–Nov');
    expect(bestSeasonLabel([6], 'tr')).toBe('Haz');
    expect(bestSeasonLabel([], 'tr')).toBe('');
    expect(bestSeasonLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'en')).toBe('All year');
  });
});
