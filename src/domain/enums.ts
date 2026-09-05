import type { TranslationKey } from '@/core/i18n';

/** Macera türleri — her biri kendi ikon ve rengiyle. */
export const ADVENTURE_TYPES = [
  'hiking',
  'climbing',
  'diving',
  'skiing',
  'cycling',
  'paragliding',
  'rafting',
  'canoe',
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
  | 'flame'
  | 'waves-arrow-up'
  | 'ship';

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
  rafting: {
    labelKey: 'adventure.rafting',
    icon: 'waves-arrow-up',
    color: '#6CB4FF',
    softColor: 'rgba(108, 180, 255, 0.18)',
    gradient: ['#0F2A47', '#1F5A8A'],
  },
  canoe: {
    labelKey: 'adventure.canoe',
    icon: 'ship',
    color: '#4DD0E1',
    softColor: 'rgba(77, 208, 225, 0.18)',
    gradient: ['#0B3A3F', '#1A6B72'],
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
  'sos_alert',
  'stay_request',
  'stay_confirmed',
  'story_posted',
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

/* ------------------------------------------------------------------ */
/* Kütüphane (dünya lokasyonları)                                      */
/* ------------------------------------------------------------------ */

export const PLACE_KINDS = [
  'campsite',
  'climbing',
  'diving',
  'dive_centre',
  'hiking_route',
  'rafting',
  'canoe',
  'paragliding',
  'ski',
  'peak',
  'cave',
  'viewpoint',
  'shelter',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export type PlaceIconName =
  | 'tent'
  | 'mountain'
  | 'droplets'
  | 'life-buoy'
  | 'footprints'
  | 'waves-arrow-up'
  | 'ship'
  | 'wind'
  | 'snowflake'
  | 'mountain-snow'
  | 'landmark'
  | 'eye'
  | 'house';

export const PLACE_KIND_META: Record<
  PlaceKind,
  { labelKey: TranslationKey; icon: PlaceIconName; color: string }
> = {
  campsite: { labelKey: 'placeKind.campsite', icon: 'tent', color: '#5EE39B' },
  climbing: { labelKey: 'placeKind.climbing', icon: 'mountain', color: '#FF8A5B' },
  diving: { labelKey: 'placeKind.diving', icon: 'droplets', color: '#4FC3F7' },
  dive_centre: { labelKey: 'placeKind.dive_centre', icon: 'life-buoy', color: '#4FC3F7' },
  hiking_route: { labelKey: 'placeKind.hiking_route', icon: 'footprints', color: '#5EE39B' },
  rafting: { labelKey: 'placeKind.rafting', icon: 'waves-arrow-up', color: '#6CB4FF' },
  canoe: { labelKey: 'placeKind.canoe', icon: 'ship', color: '#6CB4FF' },
  paragliding: { labelKey: 'placeKind.paragliding', icon: 'wind', color: '#CE93D8' },
  ski: { labelKey: 'placeKind.ski', icon: 'snowflake', color: '#B3E5FC' },
  peak: { labelKey: 'placeKind.peak', icon: 'mountain-snow', color: '#F2F7F4' },
  cave: { labelKey: 'placeKind.cave', icon: 'landmark', color: '#FFB547' },
  viewpoint: { labelKey: 'placeKind.viewpoint', icon: 'eye', color: '#FFD54F' },
  shelter: { labelKey: 'placeKind.shelter', icon: 'house', color: '#A3E635' },
};

/* ------------------------------------------------------------------ */
/* Canlı konum, Anlar, işletmeler, planlar, acil durum                 */
/* ------------------------------------------------------------------ */

export const SHARE_MODES = ['friends', 'matches', 'sos'] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const STREAM_SOURCES = ['camera', 'drone'] as const;
export type StreamSource = (typeof STREAM_SOURCES)[number];

export const BUSINESS_TYPES = [
  'hotel',
  'pension',
  'campsite',
  'glamping',
  'shop',
  'rental',
  'tour_operator',
  'dive_center',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export type BusinessIconName =
  'building-2' | 'house' | 'tent' | 'trees' | 'store' | 'key-round' | 'compass' | 'life-buoy';

export const BUSINESS_TYPE_META: Record<
  BusinessType,
  { labelKey: TranslationKey; icon: BusinessIconName; stay: boolean }
> = {
  hotel: { labelKey: 'businessType.hotel', icon: 'building-2', stay: true },
  pension: { labelKey: 'businessType.pension', icon: 'house', stay: true },
  campsite: { labelKey: 'businessType.campsite', icon: 'tent', stay: true },
  glamping: { labelKey: 'businessType.glamping', icon: 'trees', stay: true },
  shop: { labelKey: 'businessType.shop', icon: 'store', stay: false },
  rental: { labelKey: 'businessType.rental', icon: 'key-round', stay: false },
  tour_operator: { labelKey: 'businessType.tour_operator', icon: 'compass', stay: false },
  dive_center: { labelKey: 'businessType.dive_center', icon: 'life-buoy', stay: false },
};

export const PLANS = ['free', 'pro', 'pro_guide', 'business'] as const;
export type Plan = (typeof PLANS)[number];

export const STAY_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
export type StayStatus = (typeof STAY_STATUSES)[number];

export const EMERGENCY_CENTER_TYPES = [
  'hospital',
  'ambulance',
  'mountain_rescue',
  'pharmacy',
  'ranger',
  'coast_guard',
] as const;
export type EmergencyCenterType = (typeof EMERGENCY_CENTER_TYPES)[number];

export type EmergencyIconName =
  'cross' | 'ambulance' | 'mountain-snow' | 'pill' | 'trees' | 'anchor';

export const EMERGENCY_CENTER_META: Record<
  EmergencyCenterType,
  { labelKey: TranslationKey; icon: EmergencyIconName; color: string }
> = {
  hospital: { labelKey: 'emergencyType.hospital', icon: 'cross', color: '#FF6B6B' },
  ambulance: { labelKey: 'emergencyType.ambulance', icon: 'ambulance', color: '#FF8A5B' },
  mountain_rescue: {
    labelKey: 'emergencyType.mountain_rescue',
    icon: 'mountain-snow',
    color: '#6CB4FF',
  },
  pharmacy: { labelKey: 'emergencyType.pharmacy', icon: 'pill', color: '#5EE39B' },
  ranger: { labelKey: 'emergencyType.ranger', icon: 'trees', color: '#A3E635' },
  coast_guard: { labelKey: 'emergencyType.coast_guard', icon: 'anchor', color: '#4FC3F7' },
};

export const FIRST_AID_CATEGORIES = ['critical', 'injury', 'environment', 'animal'] as const;
export type FirstAidCategory = (typeof FIRST_AID_CATEGORIES)[number];
