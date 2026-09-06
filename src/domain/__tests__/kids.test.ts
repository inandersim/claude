import {
  earnedStickers,
  familyChecklistFor,
  familyTripPlan,
  filterKidPlaces,
  groupFamilyChecklist,
  huntCardTasks,
  huntCompletionPct,
  huntTasksFor,
  kidPlaceOpenInMonth,
  kidSafetyLevel,
  kidSuitabilityScore,
  nextSticker,
  stickerFor,
  withKidPlaceDistance,
} from '../kids';
import type { FamilyChecklistItem, HuntTask, KidPlace, KidPlaceWithDistance } from '../types';

const base: KidPlace = {
  id: 'p1',
  name: 'Gölcük Tabiat Parkı',
  kind: 'nature_park',
  ageBands: ['0_3', '4_6', '7_10', '11_14'],
  coords: { latitude: 40.65, longitude: 31.6 },
  locationName: 'Bolu',
  countryCode: 'TR',
  description: 'Göl çevresinde düz yol',
  imageUrl: null,
  facilities: ['piknik', 'bungalov'],
  strollerFriendly: true,
  shade: true,
  toilets: true,
  water: true,
  safetyNotes: [],
  trailKm: 2,
  trailMin: 40,
  entryFeeTry: 40,
  rating: 4.6,
  reviewCount: 700,
  seasonMonths: [],
  linkedBusinessId: null,
  linkedLibraryPlaceId: null,
};

const wd = (p: KidPlace, distanceKm: number | null = null): KidPlaceWithDistance => ({
  ...p,
  distanceKm,
  savedByMe: false,
});

const beach: KidPlace = {
  ...base,
  id: 'p2',
  name: 'Kaputaş Plajı',
  kind: 'beach',
  ageBands: ['7_10', '11_14'],
  locationName: 'Kaş, Antalya',
  facilities: ['büfe'],
  strollerFriendly: false,
  shade: false,
  water: false,
  safetyNotes: ['Deniz hızla derinleşir; dalga ve akıntı', '187 basamak', 'Gölge yok'],
  trailKm: null,
  trailMin: null,
  rating: 4.2,
  seasonMonths: [5, 6, 7, 8, 9, 10],
};

const trail: KidPlace = {
  ...base,
  id: 'p3',
  name: 'Eymir Gölü',
  kind: 'easy_trail',
  ageBands: ['4_6', '7_10', '11_14'],
  locationName: 'Ankara',
  facilities: ['bisiklet'],
  safetyNotes: ['Kene riski', 'Güneş'],
  trailKm: 12,
  trailMin: 180,
  rating: 4.4,
};

describe('filterKidPlaces', () => {
  const all = [wd(base, 5), wd(beach, 400), wd(trail, 300)];

  it('tür, yaş bandı ve bebek arabası süzgeçleri', () => {
    expect(filterKidPlaces(all, { kind: 'beach' }).map((p) => p.id)).toEqual(['p2']);
    expect(filterKidPlaces(all, { ageBand: '0_3' }).map((p) => p.id)).toEqual(['p1']);
    expect(filterKidPlaces(all, { strollerOnly: true }).map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('Türkçe karakter duyarsız arama; ad, konum ve olanaklarda arar', () => {
    expect(filterKidPlaces(all, { query: 'GOLCUK' }).map((p) => p.id)).toEqual(['p1']);
    expect(filterKidPlaces(all, { query: 'kaş' }).map((p) => p.id)).toEqual(['p2']);
    expect(filterKidPlaces(all, { query: 'bisiklet' }).map((p) => p.id)).toEqual(['p3']);
    expect(filterKidPlaces(all, { query: 'yok böyle' })).toEqual([]);
  });

  it('mesafeye göre, mesafe yoksa puana göre sıralar', () => {
    expect(filterKidPlaces(all, {}).map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
    const noDist = [wd(beach), wd(base), wd(trail)];
    expect(filterKidPlaces(noDist, {}).map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('withKidPlaceDistance mesafeyi 0.1 km hassasiyetle ekler', () => {
    const p = withKidPlaceDistance(base, { latitude: 40.65, longitude: 31.6 }, true);
    expect(p.distanceKm).toBe(0);
    expect(p.savedByMe).toBe(true);
    expect(withKidPlaceDistance(base, null, false).distanceKm).toBeNull();
  });
});

describe('kidSuitabilityScore', () => {
  it('yaş bandı eşleşmesi ve olanaklar puanı yükseltir', () => {
    expect(kidSuitabilityScore(base, '0_3')).toBeGreaterThanOrEqual(90);
    expect(kidSuitabilityScore(beach, '0_3')).toBeLessThan(30);
  });

  it('uzun patika küçük yaşlar için cezalandırılır', () => {
    expect(kidSuitabilityScore(trail, '4_6')).toBeLessThan(kidSuitabilityScore(trail, '11_14'));
  });

  it('0–100 aralığında kalır', () => {
    for (const p of [base, beach, trail]) {
      for (const b of ['0_3', '4_6', '7_10', '11_14'] as const) {
        const s = kidSuitabilityScore(p, b);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('kidSafetyLevel', () => {
  it('not yoksa low, iki+ not medium, tehlikeli anahtar kelime high', () => {
    expect(kidSafetyLevel(base)).toBe('low');
    expect(kidSafetyLevel({ safetyNotes: ['Kene riski'] })).toBe('low');
    expect(kidSafetyLevel(trail)).toBe('medium');
    expect(kidSafetyLevel(beach)).toBe('high');
    expect(kidSafetyLevel({ safetyNotes: ['Tepe kenarında UÇURUM'] })).toBe('high');
  });
});

const tasks: HuntTask[] = [
  {
    id: 't1',
    text: 'Kozalak',
    icon: 'tree-pine',
    category: 'plant',
    ageBands: ['0_3', '4_6', '7_10', '11_14'],
    points: 10,
  },
  {
    id: 't2',
    text: 'Kelebek',
    icon: 'bug',
    category: 'animal',
    ageBands: ['0_3', '4_6'],
    points: 15,
  },
  {
    id: 't3',
    text: 'Yankı',
    icon: 'mountain',
    category: 'sound',
    ageBands: ['7_10', '11_14'],
    points: 25,
  },
  {
    id: 't4',
    text: 'Bulut',
    icon: 'cloud',
    category: 'sky',
    ageBands: ['4_6', '7_10'],
    points: 10,
  },
  {
    id: 't5',
    text: 'Yosun',
    icon: 'droplets',
    category: 'plant',
    ageBands: ['4_6', '7_10'],
    points: 15,
  },
];

describe('huntTasksFor / huntCardTasks', () => {
  it('yaş bandına göre süzer, puana göre sıralar', () => {
    expect(huntTasksFor(tasks, '0_3').map((t) => t.id)).toEqual(['t1', 't2']);
    expect(huntTasksFor(tasks, '7_10').map((t) => t.id)).toEqual(['t1', 't4', 't5', 't3']);
    expect(huntTasksFor(tasks, null)).toHaveLength(5);
  });

  it('kart farklı kategorilerden sırayla seçer ve boyutu aşmaz', () => {
    const card = huntCardTasks(tasks, '4_6', 3);
    expect(card).toHaveLength(4); // 4_6 için 4 görev var, 9'a tamamlanamaz
    expect(card.slice(0, 3).map((t) => t.category)).toEqual(['plant', 'sky', 'animal']);
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...tasks[0]!,
      id: `x${i}`,
      category: (['plant', 'animal', 'rock'] as const)[i % 3]!,
    }));
    expect(huntCardTasks(many, null, 3)).toHaveLength(9);
    expect(huntCardTasks(many, null, 4)).toHaveLength(16);
  });
});

describe('huntCompletionPct', () => {
  it('kart görevlerine göre yüzde hesaplar; kart dışı görevleri saymaz', () => {
    const card = tasks.slice(0, 4);
    expect(huntCompletionPct({ completedTaskIds: [] }, card)).toBe(0);
    expect(huntCompletionPct({ completedTaskIds: ['t1', 't2'] }, card)).toBe(50);
    expect(huntCompletionPct({ completedTaskIds: ['t1', 't5'] }, card)).toBe(25);
    expect(huntCompletionPct({ completedTaskIds: ['t1'] }, [])).toBe(0);
  });
});

describe('çıkartmalar', () => {
  it('stickerFor eşikleri: 50 leaf, 120 cone, 250 explorer, 400 ranger', () => {
    expect(stickerFor(0)).toBeNull();
    expect(stickerFor(49)).toBeNull();
    expect(stickerFor(50)).toBe('leaf');
    expect(stickerFor(119)).toBe('leaf');
    expect(stickerFor(120)).toBe('cone');
    expect(stickerFor(250)).toBe('explorer');
    expect(stickerFor(400)).toBe('ranger');
    expect(stickerFor(9999)).toBe('ranger');
  });

  it('earnedStickers ve nextSticker', () => {
    expect(earnedStickers(130)).toEqual(['leaf', 'cone']);
    const n = nextSticker(130);
    expect(n?.sticker).toBe('explorer');
    expect(n?.remaining).toBe(120);
    expect(n?.progress).toBeCloseTo(10 / 130, 3);
    expect(nextSticker(0)?.progress).toBe(0);
    expect(nextSticker(400)).toBeNull();
  });
});

describe('kontrol listesi', () => {
  const items: FamilyChecklistItem[] = [
    { key: 'toy', label: 'Oyuncak', category: 'fun', ageBands: ['0_3'] },
    {
      key: 'sun',
      label: 'Güneş kremi',
      category: 'safety',
      ageBands: ['0_3', '4_6', '7_10', '11_14'],
    },
    { key: 'meds', label: 'İlaç', category: 'health', ageBands: ['4_6'] },
  ];

  it('yaş bandına göre süzer ve kategori sırasına dizer', () => {
    expect(familyChecklistFor(items, '0_3').map((i) => i.key)).toEqual(['sun', 'toy']);
    expect(familyChecklistFor(items, null).map((i) => i.key)).toEqual(['sun', 'meds', 'toy']);
    const groups = groupFamilyChecklist(familyChecklistFor(items, null));
    expect(groups.map((g) => g.category)).toEqual(['safety', 'health', 'fun']);
  });
});

describe('familyTripPlan', () => {
  it('küçük yaş daha uzun süre, daha çok mola', () => {
    const small = familyTripPlan(base, '0_3');
    const big = familyTripPlan(base, '11_14');
    expect(small.durationMin).toBeGreaterThan(big.durationMin);
    expect(small.breaks).toBeGreaterThanOrEqual(big.breaks);
    expect(big.durationMin).toBe(40);
    expect(small.durationMin).toBe(65);
  });

  it('patika bilgisi yoksa 90 dk varsayar; gölge yoksa su artar', () => {
    const p = familyTripPlan({ trailMin: null, trailKm: null, shade: true, water: false }, '11_14');
    expect(p.durationMin).toBe(90);
    const sunny = familyTripPlan(
      { trailMin: 120, trailKm: null, shade: false, water: false },
      '7_10',
    );
    const shady = familyTripPlan(
      { trailMin: 120, trailKm: null, shade: true, water: false },
      '7_10',
    );
    expect(sunny.waterLiters).toBeGreaterThan(shady.waterLiters);
    expect(shady.waterLiters % 0.5).toBe(0);
    expect(p.snacks).toBe(2);
  });
});

describe('kidPlaceOpenInMonth', () => {
  it('boş sezon tüm yıl açık demektir', () => {
    expect(kidPlaceOpenInMonth(base, 1)).toBe(true);
    expect(kidPlaceOpenInMonth(beach, 1)).toBe(false);
    expect(kidPlaceOpenInMonth(beach, 7)).toBe(true);
  });
});
