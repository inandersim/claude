import type { TranslationKey } from '@/core/i18n';

/** Macera türleri — her biri kendi ikon ve rengiyle. */
export const ADVENTURE_TYPES = [
  'hiking',
  'climbing',
  'diving',
  'skiing',
  'cycling',
  'paragliding',
] as const;
export type AdventureType = (typeof ADVENTURE_TYPES)[number];

export type IconName =
  | 'mountain'
  | 'mountain-snow'
  | 'footprints'
  | 'bike'
  | 'snowflake'
  | 'wind'
  | 'droplets'
  | 'flame';

export interface AdventureTypeMeta {
  labelKey: TranslationKey;
  icon: IconName;
  color: string;
  /** Renk üzerinde yumuşak arka plan için alfa değeri */
  softColor: string;
  gradient: [string, string];
}

export const ADVENTURE_TYPE_META: Record<AdventureType, AdventureTypeMeta> = {
  hiking: {
    labelKey: 'adventure.hiking',
    icon: 'footprints',
    color: '#5EE39B',
    softColor: 'rgba(94, 227, 155, 0.18)',
    gradient: ['#1B4332', '#2D6A4F'],
  },
  climbing: {
    labelKey: 'adventure.climbing',
    icon: 'mountain',
    color: '#FF8A5B',
    softColor: 'rgba(255, 138, 91, 0.18)',
    gradient: ['#4A1F12', '#8A3B22'],
  },
  diving: {
    labelKey: 'adventure.diving',
    icon: 'droplets',
    color: '#4FC3F7',
    softColor: 'rgba(79, 195, 247, 0.18)',
    gradient: ['#0B2A4A', '#125B8A'],
  },
  skiing: {
    labelKey: 'adventure.skiing',
    icon: 'snowflake',
    color: '#B3E5FC',
    softColor: 'rgba(179, 229, 252, 0.18)',
    gradient: ['#1E3A5F', '#4A6FA5'],
  },
  cycling: {
    labelKey: 'adventure.cycling',
    icon: 'bike',
    color: '#FFD54F',
    softColor: 'rgba(255, 213, 79, 0.18)',
    gradient: ['#4A3B0A', '#8A6D14'],
  },
  paragliding: {
    labelKey: 'adventure.paragliding',
    icon: 'wind',
    color: '#CE93D8',
    softColor: 'rgba(206, 147, 216, 0.18)',
    gradient: ['#2E1A47', '#5B3A8A'],
  },
};

/** Zorluk dereceleri: Başlangıç → Ekstrem */
export const DIFFICULTY_GRADES = ['beginner', 'easy', 'moderate', 'hard', 'extreme'] as const;
export type DifficultyGrade = (typeof DIFFICULTY_GRADES)[number];

export interface DifficultyMeta {
  labelKey: TranslationKey;
  level: 1 | 2 | 3 | 4 | 5;
  color: string;
}

export const DIFFICULTY_META: Record<DifficultyGrade, DifficultyMeta> = {
  beginner: { labelKey: 'difficulty.beginner', level: 1, color: '#5EE39B' },
  easy: { labelKey: 'difficulty.easy', level: 2, color: '#A3E635' },
  moderate: { labelKey: 'difficulty.moderate', level: 3, color: '#FFB547' },
  hard: { labelKey: 'difficulty.hard', level: 4, color: '#FF8A5B' },
  extreme: { labelKey: 'difficulty.extreme', level: 5, color: '#FF6B6B' },
};

/** Rota durumu: Mükemmel → Kapalı */
export const TRAIL_CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'closed'] as const;
export type TrailCondition = (typeof TRAIL_CONDITIONS)[number];

export interface TrailConditionMeta {
  labelKey: TranslationKey;
  color: string;
}

export const TRAIL_CONDITION_META: Record<TrailCondition, TrailConditionMeta> = {
  excellent: { labelKey: 'trail.excellent', color: '#5EE39B' },
  good: { labelKey: 'trail.good', color: '#A3E635' },
  fair: { labelKey: 'trail.fair', color: '#FFB547' },
  poor: { labelKey: 'trail.poor', color: '#FF8A5B' },
  closed: { labelKey: 'trail.closed', color: '#FF6B6B' },
};

/** Eşleşme durumu */
export const MATCH_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_META: Record<MatchStatus, { labelKey: TranslationKey; color: string }> = {
  pending: { labelKey: 'zmatch.pending', color: '#FFB547' },
  accepted: { labelKey: 'zmatch.accepted', color: '#5EE39B' },
  rejected: { labelKey: 'zmatch.rejected', color: '#FF6B6B' },
};

export const NOTIFICATION_TYPES = [
  'match_request',
  'match_accepted',
  'match_rejected',
  'message',
  'like',
  'comment',
  'follow',
  'booking_request',
  'booking_confirmed',
  'booking_declined',
  'hazard_alert',
  'hazard_confirmed',
  'stream_live',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Tehlikeli yerler                                                    */
/* ------------------------------------------------------------------ */

export const HAZARD_TYPES = [
  'rockfall',
  'avalanche',
  'flood',
  'wildlife',
  'weather',
  'trail_damage',
  'closure',
  'other',
] as const;
export type HazardType = (typeof HAZARD_TYPES)[number];

export type HazardIconName =
  | 'mountain'
  | 'snowflake'
  | 'waves-arrow-up'
  | 'paw-print'
  | 'cloud-lightning'
  | 'construction'
  | 'ban'
  | 'triangle-alert';

export const HAZARD_TYPE_META: Record<
  HazardType,
  { labelKey: TranslationKey; icon: HazardIconName }
> = {
  rockfall: { labelKey: 'hazardType.rockfall', icon: 'mountain' },
  avalanche: { labelKey: 'hazardType.avalanche', icon: 'snowflake' },
  flood: { labelKey: 'hazardType.flood', icon: 'waves-arrow-up' },
  wildlife: { labelKey: 'hazardType.wildlife', icon: 'paw-print' },
  weather: { labelKey: 'hazardType.weather', icon: 'cloud-lightning' },
  trail_damage: { labelKey: 'hazardType.trail_damage', icon: 'construction' },
  closure: { labelKey: 'hazardType.closure', icon: 'ban' },
  other: { labelKey: 'hazardType.other', icon: 'triangle-alert' },
};

export const HAZARD_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type HazardSeverity = (typeof HAZARD_SEVERITIES)[number];

export const HAZARD_SEVERITY_META: Record<
  HazardSeverity,
  { labelKey: TranslationKey; color: string; level: 1 | 2 | 3 | 4 }
> = {
  low: { labelKey: 'hazardSeverity.low', color: '#FFD54F', level: 1 },
  medium: { labelKey: 'hazardSeverity.medium', color: '#FFB547', level: 2 },
  high: { labelKey: 'hazardSeverity.high', color: '#FF8A5B', level: 3 },
  critical: { labelKey: 'hazardSeverity.critical', color: '#FF6B6B', level: 4 },
};

export const HAZARD_STATUSES = ['active', 'resolved'] as const;
export type HazardStatus = (typeof HAZARD_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Canlı yayın                                                         */
/* ------------------------------------------------------------------ */

export const STREAM_STATUSES = ['scheduled', 'live', 'ended'] as const;
export type StreamStatus = (typeof STREAM_STATUSES)[number];

export const STREAM_STATUS_META: Record<StreamStatus, { labelKey: TranslationKey; color: string }> =
  {
    scheduled: { labelKey: 'live.scheduled', color: '#6CB4FF' },
    live: { labelKey: 'live.liveNow', color: '#FF6B6B' },
    ended: { labelKey: 'live.replay', color: '#9AAEA3' },
  };

/* ------------------------------------------------------------------ */
/* Market                                                              */
/* ------------------------------------------------------------------ */

export const LISTING_CATEGORIES = [
  'equipment',
  'clothing',
  'footwear',
  'camping',
  'electronics',
  'rental',
  'other',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export type ListingIconName =
  'backpack' | 'shirt' | 'footprints' | 'tent' | 'watch' | 'key-round' | 'package';

export const LISTING_CATEGORY_META: Record<
  ListingCategory,
  { labelKey: TranslationKey; icon: ListingIconName }
> = {
  equipment: { labelKey: 'listingCategory.equipment', icon: 'backpack' },
  clothing: { labelKey: 'listingCategory.clothing', icon: 'shirt' },
  footwear: { labelKey: 'listingCategory.footwear', icon: 'footprints' },
  camping: { labelKey: 'listingCategory.camping', icon: 'tent' },
  electronics: { labelKey: 'listingCategory.electronics', icon: 'watch' },
  rental: { labelKey: 'listingCategory.rental', icon: 'key-round' },
  other: { labelKey: 'listingCategory.other', icon: 'package' },
};

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const LISTING_CONDITION_META: Record<
  ListingCondition,
  { labelKey: TranslationKey; color: string }
> = {
  new: { labelKey: 'listingCondition.new', color: '#5EE39B' },
  like_new: { labelKey: 'listingCondition.like_new', color: '#A3E635' },
  good: { labelKey: 'listingCondition.good', color: '#FFB547' },
  fair: { labelKey: 'listingCondition.fair', color: '#FF8A5B' },
};

/* ------------------------------------------------------------------ */
/* Eğitmen rezervasyonu                                                */
/* ------------------------------------------------------------------ */

export const BOOKING_STATUSES = ['pending', 'confirmed', 'declined', 'completed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { labelKey: TranslationKey; color: string }
> = {
  pending: { labelKey: 'booking.pending', color: '#FFB547' },
  confirmed: { labelKey: 'booking.confirmed', color: '#5EE39B' },
  declined: { labelKey: 'booking.declined', color: '#FF6B6B' },
  completed: { labelKey: 'booking.completed', color: '#6CB4FF' },
};
