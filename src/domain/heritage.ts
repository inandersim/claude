import type { TranslationKey } from '@/core/i18n';

import { HERITAGE_ERAS, type HeritageEra, type HeritageKind } from './enums';
import { distanceKm } from './geo';
import { formatPriceTry } from './marketplace';
import type {
  AudioGuideStop,
  GeoPoint,
  HeritageFilter,
  HeritageSite,
  HeritageSiteWithDistance,
  HeritageTour,
} from './types';

/* ------------------------------------------------------------------ */
/* Meta                                                                */
/* ------------------------------------------------------------------ */

/** Ekranlarda kullanılan ikon adları (Icon registry'sinde mevcut olanlar). */
export type HeritageIcon =
  | 'landmark'
  | 'hexagon'
  | 'shield'
  | 'house'
  | 'layers'
  | 'image'
  | 'stamp'
  | 'anchor'
  | 'book-open'
  | 'link'
  | 'bone'
  | 'swords'
  | 'crown'
  | 'flame'
  | 'sun'
  | 'globe'
  | 'gem'
  | 'star'
  | 'moon'
  | 'mountain'
  | 'trees'
  | 'sparkle';

export interface HeritageMeta {
  labelKey: TranslationKey;
  icon: HeritageIcon;
  color: string;
}

/** Dönem → etiket, ikon ve renk. */
export const heritageEraMeta: Record<HeritageEra, HeritageMeta> = {
  prehistoric: { labelKey: 'heritage.era.prehistoric', icon: 'bone', color: '#A47148' },
  hittite: { labelKey: 'heritage.era.hittite', icon: 'swords', color: '#B5651D' },
  urartu: { labelKey: 'heritage.era.urartu', icon: 'shield', color: '#8D6E63' },
  phrygian: { labelKey: 'heritage.era.phrygian', icon: 'crown', color: '#C77D4F' },
  lycian: { labelKey: 'heritage.era.lycian', icon: 'stamp', color: '#4FA3A5' },
  greek: { labelKey: 'heritage.era.greek', icon: 'landmark', color: '#5B8DEF' },
  roman: { labelKey: 'heritage.era.roman', icon: 'hexagon', color: '#C0392B' },
  byzantine: { labelKey: 'heritage.era.byzantine', icon: 'star', color: '#8E44AD' },
  seljuk: { labelKey: 'heritage.era.seljuk', icon: 'moon', color: '#1ABC9C' },
  ottoman: { labelKey: 'heritage.era.ottoman', icon: 'sparkle', color: '#D35400' },
  inca: { labelKey: 'heritage.era.inca', icon: 'mountain', color: '#E67E22' },
  maya: { labelKey: 'heritage.era.maya', icon: 'sun', color: '#27AE60' },
  khmer: { labelKey: 'heritage.era.khmer', icon: 'trees', color: '#16A085' },
  nabataean: { labelKey: 'heritage.era.nabataean', icon: 'gem', color: '#E74C3C' },
  egyptian: { labelKey: 'heritage.era.egyptian', icon: 'flame', color: '#F1C40F' },
  other: { labelKey: 'heritage.era.other', icon: 'globe', color: '#7F8C8D' },
};

/** Tür → etiket, ikon ve renk. */
export const heritageKindMeta: Record<HeritageKind, HeritageMeta> = {
  ancient_city: { labelKey: 'heritage.kind.ancient_city', icon: 'landmark', color: '#5B8DEF' },
  temple: { labelKey: 'heritage.kind.temple', icon: 'hexagon', color: '#E67E22' },
  castle: { labelKey: 'heritage.kind.castle', icon: 'shield', color: '#7F8C8D' },
  monastery: { labelKey: 'heritage.kind.monastery', icon: 'house', color: '#8E44AD' },
  underground_city: {
    labelKey: 'heritage.kind.underground_city',
    icon: 'layers',
    color: '#A47148',
  },
  rock_art: { labelKey: 'heritage.kind.rock_art', icon: 'image', color: '#C0392B' },
  tomb: { labelKey: 'heritage.kind.tomb', icon: 'stamp', color: '#F1C40F' },
  sunken_city: { labelKey: 'heritage.kind.sunken_city', icon: 'anchor', color: '#4FC3F7' },
  museum: { labelKey: 'heritage.kind.museum', icon: 'book-open', color: '#27AE60' },
  bridge: { labelKey: 'heritage.kind.bridge', icon: 'link', color: '#1ABC9C' },
};

/** Ziyaret başına verilen XP. */
export const HERITAGE_VISIT_XP = 20;

/** "Yakındaki alanlar" için varsayılan yarıçap. */
export const HERITAGE_NEARBY_RADIUS_KM = 80;

/* ------------------------------------------------------------------ */
/* Dönem etiketleri                                                    */
/* ------------------------------------------------------------------ */

const ERA_PERIODS: Record<HeritageEra, { tr: string; en: string }> = {
  prehistoric: { tr: 'MÖ 10. binyıl – MÖ 3000', en: '10th millennium BC – 3000 BC' },
  hittite: { tr: 'MÖ 17. – 12. yüzyıl', en: '17th – 12th century BC' },
  urartu: { tr: 'MÖ 9. – 6. yüzyıl', en: '9th – 6th century BC' },
  phrygian: { tr: 'MÖ 12. – 7. yüzyıl', en: '12th – 7th century BC' },
  lycian: { tr: 'MÖ 15. – 4. yüzyıl', en: '15th – 4th century BC' },
  greek: { tr: 'MÖ 8. – 1. yüzyıl', en: '8th – 1st century BC' },
  roman: { tr: 'MÖ 1. – MS 4. yüzyıl', en: '1st century BC – 4th century AD' },
  byzantine: { tr: 'MS 4. – 15. yüzyıl', en: '4th – 15th century AD' },
  seljuk: { tr: 'MS 11. – 13. yüzyıl', en: '11th – 13th century AD' },
  ottoman: { tr: 'MS 14. – 20. yüzyıl', en: '14th – 20th century AD' },
  inca: { tr: 'MS 15. – 16. yüzyıl', en: '15th – 16th century AD' },
  maya: { tr: 'MS 3. – 16. yüzyıl', en: '3rd – 16th century AD' },
  khmer: { tr: 'MS 9. – 15. yüzyıl', en: '9th – 15th century AD' },
  nabataean: { tr: 'MÖ 4. – MS 1. yüzyıl', en: '4th century BC – 1st century AD' },
  egyptian: { tr: 'MÖ 27. – 22. yüzyıl', en: '27th – 22nd century BC' },
  other: { tr: 'Çeşitli dönemler', en: 'Various periods' },
};

/** Dönemin kabaca kapsadığı yüzyıl aralığı (Türkçe/İngilizce). */
export function heritageCenturyLabel(era: HeritageEra, locale = 'tr'): string {
  const p = ERA_PERIODS[era];
  return locale === 'tr' ? p.tr : p.en;
}

/** Bilinmeyen bir dönem dizgesini güvenli biçimde HeritageEra'ya çevirir. */
export function isHeritageEra(value: string): value is HeritageEra {
  return (HERITAGE_ERAS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Filtreleme & mesafe                                                 */
/* ------------------------------------------------------------------ */

const norm = (s: string): string => s.toLocaleLowerCase('tr-TR').trim();

/** Arama, ülke, dönem, tür ve UNESCO filtrelerini uygular; origin varsa mesafeye göre sıralar. */
export function filterHeritageSites<T extends HeritageSite>(
  sites: T[],
  filter: HeritageFilter,
): T[] {
  const q = filter.query ? norm(filter.query) : '';
  let out = sites.filter((s) => {
    if (filter.countryCode && s.countryCode !== filter.countryCode) return false;
    if (filter.era && !s.eras.includes(filter.era)) return false;
    if (filter.kind && s.kind !== filter.kind) return false;
    if (filter.unescoOnly && !s.isUnesco) return false;
    if (q) {
      const hay = norm(`${s.name} ${s.region} ${s.summary} ${s.eras.join(' ')} ${s.kind}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (filter.origin) {
    const o = filter.origin;
    out = [...out].sort((a, b) => distanceKm(o, a.coords) - distanceKm(o, b.coords));
  }
  return out;
}

/** Bir alana mesafe ekler (origin yoksa null). */
export function withHeritageDistance<T extends HeritageSite>(
  site: T,
  origin: GeoPoint | null,
): T & { distanceKm: number | null } {
  return {
    ...site,
    distanceKm: origin ? Math.round(distanceKm(origin, site.coords) * 10) / 10 : null,
  };
}

/** Verilen alanın yakınındaki diğer alanlar (kendisi hariç), mesafeye göre sıralı. */
export function nearbyHeritageSites<T extends HeritageSite>(
  site: HeritageSite,
  all: T[],
  limit = 4,
  maxKm = HERITAGE_NEARBY_RADIUS_KM,
): (T & { distanceKm: number })[] {
  return all
    .filter((s) => s.id !== site.id)
    .map((s) => ({ ...s, distanceKm: Math.round(distanceKm(site.coords, s.coords) * 10) / 10 }))
    .filter((s) => s.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Açılış saatleri                                                     */
/* ------------------------------------------------------------------ */

export interface HeritageHourRange {
  /** Gün başından dakika */
  openMin: number;
  closeMin: number;
}

const TIME_RE = /(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/;

/**
 * "08:30–19:00", "09.00 - 17.30" gibi dizgeleri ayrıştırır. "24 saat" / "24/7" → tam gün.
 * Ayrıştırılamıyorsa null.
 */
export function parseHeritageHours(hours: string): HeritageHourRange | null {
  const h = hours.trim();
  if (!h) return null;
  if (/24\s*saat|24\/7|24\s*hours/i.test(h)) return { openMin: 0, closeMin: 24 * 60 };
  const m = TIME_RE.exec(h);
  if (!m) return null;
  const openMin = Number(m[1]) * 60 + Number(m[2]);
  const closeMin = Number(m[3]) * 60 + Number(m[4]);
  if (openMin < 0 || openMin > 24 * 60 || closeMin < 0 || closeMin > 24 * 60) return null;
  return { openMin, closeMin };
}

/**
 * Alanın şu an açık olup olmadığı. Saat bilgisi ayrıştırılamazsa null.
 * Kapanış açılıştan küçükse gece yarısını aşan aralık kabul edilir.
 */
export function heritageOpenNow(
  site: Pick<HeritageSite, 'openingHours'>,
  now: Date,
): boolean | null {
  const range = parseHeritageHours(site.openingHours);
  if (!range) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (range.closeMin >= range.openMin) return cur >= range.openMin && cur < range.closeMin;
  return cur >= range.openMin || cur < range.closeMin;
}

/* ------------------------------------------------------------------ */
/* Etiketler                                                           */
/* ------------------------------------------------------------------ */

/** Giriş ücreti metni: null/0 → ücretsiz. */
export function heritageFeeLabel(
  site: Pick<HeritageSite, 'entryFeeTry'>,
  locale = 'tr',
  freeLabel = locale === 'tr' ? 'Ücretsiz' : 'Free',
): string {
  if (site.entryFeeTry === null || site.entryFeeTry <= 0) return freeLabel;
  return formatPriceTry(site.entryFeeTry, locale, false);
}

/** "UNESCO 2015" ya da UNESCO değilse null. */
export function heritageUnescoLabel(
  site: Pick<HeritageSite, 'isUnesco' | 'unescoYear'>,
): string | null {
  if (!site.isUnesco) return null;
  return site.unescoYear ? `UNESCO ${site.unescoYear}` : 'UNESCO';
}

/* ------------------------------------------------------------------ */
/* Sesli rehber                                                        */
/* ------------------------------------------------------------------ */

/** Durakları sıraya dizer. */
export function sortGuideStops(stops: AudioGuideStop[]): AudioGuideStop[] {
  return [...stops].sort((a, b) => a.order - b.order);
}

/** Toplam rehber süresi (dakika, yukarı yuvarlanır). */
export function guideDurationMin(stops: Pick<AudioGuideStop, 'durationSec'>[]): number {
  const sec = stops.reduce((acc, s) => acc + Math.max(0, s.durationSec), 0);
  return Math.ceil(sec / 60);
}

/** Tüm rehberin tek metin hâli (TTS için). */
export function heritageSiteScript(
  site: Pick<HeritageSite, 'name' | 'summary'>,
  stops: AudioGuideStop[],
) {
  const parts = [`${site.name}. ${site.summary}`];
  for (const s of sortGuideStops(stops)) parts.push(`${s.order}. ${s.title}. ${s.script}`);
  return parts.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Ziyaret planı & tur                                                 */
/* ------------------------------------------------------------------ */

export interface HeritageVisitPlanLeg {
  site: HeritageSite;
  /** Bir önceki noktadan mesafe (ilk bacak başlangıç noktasından) */
  fromPrevKm: number;
}

export interface HeritageVisitPlan {
  order: HeritageSite[];
  legs: HeritageVisitPlanLeg[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

/**
 * En yakın komşu sıralaması: başlangıç noktasından itibaren hep en yakın ziyaret edilmemiş alan.
 * Toplam süre: alanların ziyaret süreleri toplamı (yol süresi hariç).
 */
export function heritageVisitPlan<T extends HeritageSite>(
  sites: T[],
  start: GeoPoint | null,
): HeritageVisitPlan {
  const remaining = [...sites];
  const order: T[] = [];
  const legs: HeritageVisitPlanLeg[] = [];
  let cursor: GeoPoint | null = start;
  let total = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestKm = 0;
    if (cursor) {
      const c = cursor;
      bestKm = Infinity;
      remaining.forEach((s, i) => {
        const d = distanceKm(c, s.coords);
        if (d < bestKm) {
          bestKm = d;
          bestIdx = i;
        }
      });
    }
    const [next] = remaining.splice(bestIdx, 1);
    if (!next) break;
    const km = cursor ? Math.round(bestKm * 10) / 10 : 0;
    order.push(next);
    legs.push({ site: next, fromPrevKm: km });
    total += km;
    cursor = next.coords;
  }
  return {
    order,
    legs,
    totalDistanceKm: Math.round(total * 10) / 10,
    totalDurationMin: order.reduce((acc, s) => acc + s.visitDurationMin, 0),
  };
}

export interface HeritageTourSummary {
  sites: HeritageSite[];
  totalDurationMin: number;
  /** Alanlar arası ardışık mesafe toplamı (tur sırasına göre) */
  totalDistanceKm: number;
  unescoCount: number;
  countries: string[];
  /** Günde ~8 saat gezi varsayımıyla tahmini gün sayısı */
  estimatedDays: number;
}

/** Turun alanlarını sırasıyla çözer ve toplamları hesaplar (bulunamayan id'ler atlanır). */
export function heritageTourSummary(
  tour: Pick<HeritageTour, 'siteIds'>,
  sites: HeritageSite[],
): HeritageTourSummary {
  const byId = new Map(sites.map((s) => [s.id, s]));
  const resolved = tour.siteIds
    .map((id) => byId.get(id))
    .filter((s): s is HeritageSite => Boolean(s));
  let km = 0;
  for (let i = 1; i < resolved.length; i++) {
    km += distanceKm(resolved[i - 1]!.coords, resolved[i]!.coords);
  }
  const totalDurationMin = resolved.reduce((acc, s) => acc + s.visitDurationMin, 0);
  return {
    sites: resolved,
    totalDurationMin,
    totalDistanceKm: Math.round(km * 10) / 10,
    unescoCount: resolved.filter((s) => s.isUnesco).length,
    countries: [...new Set(resolved.map((s) => s.countryCode))],
    estimatedDays: Math.max(1, Math.ceil((totalDurationMin + km * 1.2) / 480)),
  };
}

/** Tur girişi doğrulama; hata anahtarı döner (yoksa null). */
export function validateHeritageTourInput(input: {
  title: string;
  siteIds: string[];
  date: string | null;
}): 'nameRequired' | 'minSites' | 'invalidDate' | null {
  if (!input.title.trim()) return 'nameRequired';
  if (input.siteIds.length < 2) return 'minSites';
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'invalidDate';
  if (input.date && Number.isNaN(Date.parse(input.date))) return 'invalidDate';
  return null;
}

/** Listeyi kaydedilen/ziyaret edilen sekmeleri için ayırır. */
export function splitHeritageByMe(sites: HeritageSiteWithDistance[]) {
  return {
    saved: sites.filter((s) => s.savedByMe),
    visited: sites.filter((s) => s.visitedByMe),
  };
}

/** Ülke kodlarını görünme sıklığına göre sıralar (Türkiye önce). */
export function heritageCountries(sites: Pick<HeritageSite, 'countryCode'>[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sites) counts.set(s.countryCode, (counts.get(s.countryCode) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => {
      if (a[0] === 'TR') return -1;
      if (b[0] === 'TR') return 1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map(([cc]) => cc);
}
