import type { TranslationKey } from '@/core/i18n';

import { foldText } from './ai';
import { KID_AGE_BANDS, type KidAgeBand, type KidPlaceKind } from './enums';
import { distanceKm } from './geo';
import type {
  FamilyChecklistItem,
  GeoPoint,
  HuntProgress,
  HuntTask,
  KidPlace,
  KidPlaceFilter,
  KidPlaceWithDistance,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

export const KIDS_MODULE = 'kids';

/** Çıkartma anahtarları (kazanım sırasına göre). */
export const KID_STICKERS = ['leaf', 'cone', 'explorer', 'ranger'] as const;
export type KidSticker = (typeof KID_STICKERS)[number];

/** Çıkartma puan eşikleri: 50 Yaprak, 120 Kozalak, 250 Kaşif, 400 Orman Bekçisi. */
export const KID_STICKER_THRESHOLDS: readonly { sticker: KidSticker; points: number }[] = [
  { sticker: 'leaf', points: 50 },
  { sticker: 'cone', points: 120 },
  { sticker: 'explorer', points: 250 },
  { sticker: 'ranger', points: 400 },
];

export const KID_STICKER_META: Record<
  KidSticker,
  { labelKey: TranslationKey; icon: string; emoji: string; color: string }
> = {
  leaf: { labelKey: 'kids.hunt.sticker.leaf', icon: 'trees', emoji: '🍃', color: '#4CAF50' },
  cone: { labelKey: 'kids.hunt.sticker.cone', icon: 'tree-pine', emoji: '🌲', color: '#8D6E63' },
  explorer: {
    labelKey: 'kids.hunt.sticker.explorer',
    icon: 'compass',
    emoji: '🧭',
    color: '#FF9800',
  },
  ranger: {
    labelKey: 'kids.hunt.sticker.ranger',
    icon: 'shield-check',
    emoji: '🦉',
    color: '#3F51B5',
  },
};

export type KidSafetyLevel = 'low' | 'medium' | 'high';

export const kidAgeBandMeta: Record<
  KidAgeBand,
  { labelKey: TranslationKey; icon: string; color: string; minAge: number; maxAge: number }
> = {
  '0_3': { labelKey: 'kids.ageBand.0_3', icon: 'heart', color: '#F48FB1', minAge: 0, maxAge: 3 },
  '4_6': { labelKey: 'kids.ageBand.4_6', icon: 'sparkles', color: '#FFB547', minAge: 4, maxAge: 6 },
  '7_10': {
    labelKey: 'kids.ageBand.7_10',
    icon: 'compass',
    color: '#4CAF50',
    minAge: 7,
    maxAge: 10,
  },
  '11_14': {
    labelKey: 'kids.ageBand.11_14',
    icon: 'mountain',
    color: '#3F51B5',
    minAge: 11,
    maxAge: 14,
  },
};

export const kidPlaceKindMeta: Record<
  KidPlaceKind,
  { labelKey: TranslationKey; icon: string; color: string }
> = {
  playground: { labelKey: 'kids.kind.playground', icon: 'puzzle', color: '#FF7043' },
  nature_park: { labelKey: 'kids.kind.nature_park', icon: 'trees', color: '#43A047' },
  family_camp: { labelKey: 'kids.kind.family_camp', icon: 'tent', color: '#8D6E63' },
  farm: { labelKey: 'kids.kind.farm', icon: 'paw-print', color: '#F9A825' },
  easy_trail: { labelKey: 'kids.kind.easy_trail', icon: 'footprints', color: '#26A69A' },
  beach: { labelKey: 'kids.kind.beach', icon: 'sun', color: '#29B6F6' },
  adventure_park: { labelKey: 'kids.kind.adventure_park', icon: 'zap', color: '#AB47BC' },
  museum: { labelKey: 'kids.kind.museum', icon: 'landmark', color: '#5C6BC0' },
  zoo: { labelKey: 'kids.kind.zoo', icon: 'bird', color: '#EC407A' },
};

export const huntCategoryMeta: Record<
  HuntTask['category'],
  { labelKey: TranslationKey; color: string }
> = {
  plant: { labelKey: 'kids.hunt.category.plant', color: '#43A047' },
  animal: { labelKey: 'kids.hunt.category.animal', color: '#F9A825' },
  rock: { labelKey: 'kids.hunt.category.rock', color: '#8D6E63' },
  water: { labelKey: 'kids.hunt.category.water', color: '#29B6F6' },
  sky: { labelKey: 'kids.hunt.category.sky', color: '#5C6BC0' },
  sound: { labelKey: 'kids.hunt.category.sound', color: '#AB47BC' },
  craft: { labelKey: 'kids.hunt.category.craft', color: '#FF7043' },
};

export const familyChecklistCategoryMeta: Record<
  FamilyChecklistItem['category'],
  { labelKey: TranslationKey; icon: string; color: string }
> = {
  safety: { labelKey: 'kids.checklist.category.safety', icon: 'shield', color: '#E53935' },
  comfort: { labelKey: 'kids.checklist.category.comfort', icon: 'shirt', color: '#26A69A' },
  food: { labelKey: 'kids.checklist.category.food', icon: 'package', color: '#F9A825' },
  fun: { labelKey: 'kids.checklist.category.fun', icon: 'sparkles', color: '#AB47BC' },
  health: { labelKey: 'kids.checklist.category.health', icon: 'heart-pulse', color: '#EC407A' },
};

/** Ana ekranda dönen güvenlik ipuçları şeridi. */
export const KID_SAFETY_TIPS: readonly { key: TranslationKey; icon: string }[] = [
  { key: 'kids.safety.tips.sun', icon: 'sun' },
  { key: 'kids.safety.tips.tick', icon: 'bug' },
  { key: 'kids.safety.tips.water', icon: 'droplets' },
  { key: 'kids.safety.tips.cliff', icon: 'mountain' },
  { key: 'kids.safety.tips.whistle', icon: 'siren' },
  { key: 'kids.safety.tips.hydration', icon: 'thermometer' },
  { key: 'kids.safety.tips.wildlife', icon: 'paw-print' },
];

/** Çocuk profili avatar seçenekleri (emoji). */
export const CHILD_AVATARS = ['🦊', '🐻', '🦉', '🐸', '🦋', '🐢', '🦜', '🐿️'] as const;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

export function isKidAgeBand(value: unknown): value is KidAgeBand {
  return typeof value === 'string' && (KID_AGE_BANDS as readonly string[]).includes(value);
}

/** Yaş bandının sıralama indeksi (küçükten büyüğe). */
export function kidAgeBandRank(band: KidAgeBand): number {
  return KID_AGE_BANDS.indexOf(band);
}

/** Yer, verilen ayda açık mı (seasonMonths boşsa tüm yıl). */
export function kidPlaceOpenInMonth(place: Pick<KidPlace, 'seasonMonths'>, month: number): boolean {
  return place.seasonMonths.length === 0 || place.seasonMonths.includes(month);
}

/** Mesafe ve kayıt bilgisini ekler. */
export function withKidPlaceDistance(
  place: KidPlace,
  origin: GeoPoint | null | undefined,
  savedByMe: boolean,
): KidPlaceWithDistance {
  return {
    ...place,
    distanceKm: origin ? Math.round(distanceKm(origin, place.coords) * 10) / 10 : null,
    savedByMe,
  };
}

/* ------------------------------------------------------------------ */
/* Filtreleme                                                           */
/* ------------------------------------------------------------------ */

/**
 * Yerleri arama/tür/yaş/bebek arabası ölçütlerine göre süzer.
 * Sıralama: mesafe (origin varsa) → puan.
 */
export function filterKidPlaces(
  places: KidPlaceWithDistance[],
  filter: KidPlaceFilter,
): KidPlaceWithDistance[] {
  const q = filter.query ? foldText(filter.query) : '';
  const out = places.filter((p) => {
    if (filter.kind && p.kind !== filter.kind) return false;
    if (filter.ageBand && !p.ageBands.includes(filter.ageBand)) return false;
    if (filter.strollerOnly && !p.strollerFriendly) return false;
    if (q) {
      const hay = foldText(
        [p.name, p.locationName, p.description, ...p.facilities, p.countryCode ?? ''].join(' '),
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return out.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return b.rating - a.rating || a.name.localeCompare(b.name, 'tr');
  });
}

/* ------------------------------------------------------------------ */
/* Uygunluk ve güvenlik                                                 */
/* ------------------------------------------------------------------ */

/** Yaş bandına göre tolere edilen en uzun patika (km). */
const MAX_TRAIL_KM: Record<KidAgeBand, number> = { '0_3': 2, '4_6': 4, '7_10': 8, '11_14': 14 };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * 0–100 arası uygunluk puanı: yaş bandı eşleşmesi, olanaklar, patika uzunluğu,
 * güvenlik notu sayısı ve kullanıcı puanı birlikte değerlendirilir.
 */
export function kidSuitabilityScore(place: KidPlace, ageBand: KidAgeBand): number {
  let score = place.ageBands.includes(ageBand) ? 60 : 20;
  if (place.strollerFriendly) score += ageBand === '0_3' ? 15 : ageBand === '4_6' ? 8 : 2;
  if (place.shade) score += 5;
  if (place.toilets) score += 5;
  if (place.water) score += 5;
  if (place.trailKm !== null) {
    const over = place.trailKm - MAX_TRAIL_KM[ageBand];
    if (over > 0) score -= Math.min(25, Math.ceil(over * 5));
  }
  score -= Math.min(12, place.safetyNotes.length * 3);
  score += clamp((place.rating - 4) * 10, -10, 10);
  return clamp(Math.round(score), 0, 100);
}

const HIGH_RISK = ['uçurum', 'derin', 'akıntı', 'dalga', 'ayı', 'kaya düşmesi', 'trafik'];

/** Güvenlik notlarından risk seviyesi türetir. */
export function kidSafetyLevel(place: Pick<KidPlace, 'safetyNotes'>): KidSafetyLevel {
  const notes = place.safetyNotes.map((n) => foldText(n));
  if (notes.some((n) => HIGH_RISK.some((k) => n.includes(foldText(k))))) return 'high';
  if (notes.length >= 2) return 'medium';
  return 'low';
}

export const KID_SAFETY_LEVEL_META: Record<
  KidSafetyLevel,
  {
    labelKey: TranslationKey;
    hintKey: TranslationKey;
    icon: string;
    tone: 'success' | 'warning' | 'danger';
  }
> = {
  low: {
    labelKey: 'kids.safety.low',
    hintKey: 'kids.safety.lowHint',
    icon: 'shield-check',
    tone: 'success',
  },
  medium: {
    labelKey: 'kids.safety.medium',
    hintKey: 'kids.safety.mediumHint',
    icon: 'shield-alert',
    tone: 'warning',
  },
  high: {
    labelKey: 'kids.safety.high',
    hintKey: 'kids.safety.highHint',
    icon: 'triangle-alert',
    tone: 'danger',
  },
};

/* ------------------------------------------------------------------ */
/* Doğa avı                                                             */
/* ------------------------------------------------------------------ */

/** Yaş bandına uygun görevler; puan → id sırasıyla (null: tümü). */
export function huntTasksFor(tasks: HuntTask[], ageBand: KidAgeBand | null): HuntTask[] {
  return tasks
    .filter((t) => !ageBand || t.ageBands.includes(ageBand))
    .sort((a, b) => a.points - b.points || a.id.localeCompare(b.id));
}

/** Kart için görev seçimi: yaş bandına uygun ilk n×n görev (kararlı sıra). */
export function huntCardTasks(
  tasks: HuntTask[],
  ageBand: KidAgeBand | null,
  size: 3 | 4,
): HuntTask[] {
  const pool = huntTasksFor(tasks, ageBand);
  // Kategori çeşitliliği: sırayla farklı kategorilerden seç
  const byCat = new Map<HuntTask['category'], HuntTask[]>();
  for (const t of pool) {
    const list = byCat.get(t.category) ?? [];
    list.push(t);
    byCat.set(t.category, list);
  }
  const picked: HuntTask[] = [];
  const target = size * size;
  while (picked.length < target) {
    let any = false;
    for (const list of byCat.values()) {
      const next = list.shift();
      if (next) {
        picked.push(next);
        any = true;
        if (picked.length >= target) break;
      }
    }
    if (!any) break;
  }
  return picked;
}

/** Karttaki görevlerin yüzde kaçı tamamlandı (0–100). */
export function huntCompletionPct(
  progress: Pick<HuntProgress, 'completedTaskIds'>,
  tasks: HuntTask[],
): number {
  if (tasks.length === 0) return 0;
  const ids = new Set(progress.completedTaskIds);
  const done = tasks.filter((t) => ids.has(t.id)).length;
  return Math.round((done / tasks.length) * 100);
}

/** Puana göre kazanılmış en yüksek çıkartma (yoksa null). */
export function stickerFor(points: number): KidSticker | null {
  let best: KidSticker | null = null;
  for (const s of KID_STICKER_THRESHOLDS) {
    if (points >= s.points) best = s.sticker;
  }
  return best;
}

/** Puanla kazanılmış tüm çıkartmalar (sıralı). */
export function earnedStickers(points: number): KidSticker[] {
  return KID_STICKER_THRESHOLDS.filter((s) => points >= s.points).map((s) => s.sticker);
}

/** Sıradaki çıkartma ve ona ilerleme (0..1); hepsi kazanıldıysa null. */
export function nextSticker(
  points: number,
): { sticker: KidSticker; points: number; remaining: number; progress: number } | null {
  const next = KID_STICKER_THRESHOLDS.find((s) => points < s.points);
  if (!next) return null;
  const idx = KID_STICKER_THRESHOLDS.indexOf(next);
  const prevPoints = idx > 0 ? KID_STICKER_THRESHOLDS[idx - 1]!.points : 0;
  const span = next.points - prevPoints;
  return {
    sticker: next.sticker,
    points: next.points,
    remaining: next.points - points,
    progress: clamp((points - prevPoints) / span, 0, 1),
  };
}

/* ------------------------------------------------------------------ */
/* Kontrol listesi                                                      */
/* ------------------------------------------------------------------ */

export const FAMILY_CHECKLIST_CATEGORY_ORDER: FamilyChecklistItem['category'][] = [
  'safety',
  'health',
  'comfort',
  'food',
  'fun',
];

/** Yaş bandına uygun maddeler; kategori sırasına göre. */
export function familyChecklistFor(
  items: FamilyChecklistItem[],
  ageBand: KidAgeBand | null,
): FamilyChecklistItem[] {
  return items
    .filter((i) => !ageBand || i.ageBands.includes(ageBand))
    .sort(
      (a, b) =>
        FAMILY_CHECKLIST_CATEGORY_ORDER.indexOf(a.category) -
        FAMILY_CHECKLIST_CATEGORY_ORDER.indexOf(b.category),
    );
}

/** Kategoriye göre gruplar (sıra korunur). */
export function groupFamilyChecklist(
  items: FamilyChecklistItem[],
): { category: FamilyChecklistItem['category']; items: FamilyChecklistItem[] }[] {
  const out: { category: FamilyChecklistItem['category']; items: FamilyChecklistItem[] }[] = [];
  for (const cat of FAMILY_CHECKLIST_CATEGORY_ORDER) {
    const list = items.filter((i) => i.category === cat);
    if (list.length) out.push({ category: cat, items: list });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Gezi planı                                                           */
/* ------------------------------------------------------------------ */

export interface FamilyTripPlan {
  /** Tahmini toplam süre (dk) */
  durationMin: number;
  /** Önerilen mola sayısı */
  breaks: number;
  /** Bir çocuk + bir yetişkin için su (litre) */
  waterLiters: number;
  /** Atıştırmalık porsiyon */
  snacks: number;
}

/** Yaşa göre süre çarpanı, mola aralığı (dk) ve saatlik su ihtiyacı (L). */
const PLAN_PARAMS: Record<
  KidAgeBand,
  { factor: number; breakEveryMin: number; waterPerHour: number }
> = {
  '0_3': { factor: 1.6, breakEveryMin: 20, waterPerHour: 0.2 },
  '4_6': { factor: 1.4, breakEveryMin: 30, waterPerHour: 0.3 },
  '7_10': { factor: 1.2, breakEveryMin: 45, waterPerHour: 0.4 },
  '11_14': { factor: 1.0, breakEveryMin: 60, waterPerHour: 0.5 },
};

/** Yetişkin saatlik su ihtiyacı (L). */
const ADULT_WATER_PER_HOUR = 0.5;

/**
 * Yer ve yaş bandına göre aile gezi önerisi. Patika süresi yoksa 90 dk kabul edilir;
 * çocuk hızı çarpanıyla uzatılır, mola aralığına göre mola sayısı hesaplanır.
 */
export function familyTripPlan(
  place: Pick<KidPlace, 'trailMin' | 'trailKm' | 'shade' | 'water'>,
  ageBand: KidAgeBand,
): FamilyTripPlan {
  const p = PLAN_PARAMS[ageBand];
  const base = place.trailMin ?? (place.trailKm !== null ? place.trailKm * 20 : 90);
  const durationMin = Math.round((base * p.factor) / 5) * 5;
  const breaks = Math.max(1, Math.ceil(durationMin / p.breakEveryMin) - 1);
  const hours = durationMin / 60;
  let water = hours * (p.waterPerHour + ADULT_WATER_PER_HOUR);
  if (!place.shade) water *= 1.25;
  // Yerde su varsa daha az taşınabilir
  if (place.water) water *= 0.75;
  const waterLiters = Math.max(0.5, Math.round(water * 2) / 2);
  const snacks = Math.max(1, Math.ceil(hours));
  return { durationMin, breaks, waterLiters, snacks };
}
