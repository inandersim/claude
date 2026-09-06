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
  'reaction',
  'mention',
  'repost',
  'group_invite',
  'group_message',
  'trip_overdue',
  'course_enrolled',
  'certificate_issued',
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

/* ------------------------------------------------------------------ */
/* v1.2 — Tırmanış veritabanı                                          */
/* ------------------------------------------------------------------ */

export const GRADE_SYSTEMS = ['french', 'yds', 'uiaa', 'font', 'v_scale'] as const;
export type GradeSystem = (typeof GRADE_SYSTEMS)[number];

export const CLIMB_TYPES = ['sport', 'trad', 'boulder', 'multipitch', 'ice', 'alpine'] as const;
export type ClimbType = (typeof CLIMB_TYPES)[number];

export const ASCENT_STYLES = ['onsight', 'flash', 'redpoint', 'toprope', 'attempt'] as const;
export type AscentStyle = (typeof ASCENT_STYLES)[number];

/** unverified: kullanıcı girdisi · community: 3+ bağımsız onay · verified: moderatör/kulüp onayı */
export const VERIFICATION_STATUSES = ['unverified', 'community', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Uydu bağlantısı                                              */
/* ------------------------------------------------------------------ */

export const SAT_DEVICE_TYPES = [
  'inreach',
  'zoleo',
  'spot',
  'phone_satellite',
  'starlink_mini',
] as const;
export type SatDeviceType = (typeof SAT_DEVICE_TYPES)[number];

export const SAT_MESSAGE_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'failed'] as const;
export type SatMessageStatus = (typeof SAT_MESSAGE_STATUSES)[number];

export const SAT_MESSAGE_KINDS = ['checkin', 'text', 'sos', 'location'] as const;
export type SatMessageKind = (typeof SAT_MESSAGE_KINDS)[number];

export const SOS_STAGES = [
  'idle',
  'armed',
  'sent',
  'acknowledged',
  'dispatched',
  'resolved',
] as const;
export type SosStage = (typeof SOS_STAGES)[number];

/** Bağlantı katmanı: hücresel → wifi → uydu → yok */
export const LINK_TYPES = ['cellular', 'wifi', 'satellite', 'none'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Çevrimdışı haritalar & rota motoru                           */
/* ------------------------------------------------------------------ */

export const ROUTE_PROFILES = ['hike', 'trail_run', 'mtb', 'gravel', 'ski_tour'] as const;
export type RouteProfile = (typeof ROUTE_PROFILES)[number];

export const SURFACES = ['trail', 'rock', 'scree', 'snow', 'gravel', 'paved'] as const;
export type Surface = (typeof SURFACES)[number];

export const MAP_PACK_STATUSES = [
  'available',
  'downloading',
  'downloaded',
  'update_available',
] as const;
export type MapPackStatus = (typeof MAP_PACK_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Rezervasyon envanteri & ödeme güveni                         */
/* ------------------------------------------------------------------ */

export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

/**
 * authorized: kart bloke · escrow: Zirtan emanetinde · released: giriş sonrası
 * işletmeye aktarıldı · refunded: iade edildi
 */
export const PAYMENT_STATUSES = [
  'pending',
  'authorized',
  'escrow',
  'released',
  'refunded',
  'failed',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const HOST_VERIFICATION_LEVELS = ['none', 'id', 'address', 'premium'] as const;
export type HostVerificationLevel = (typeof HOST_VERIFICATION_LEVELS)[number];

export const UNIT_KINDS = ['room', 'tent_pitch', 'bungalow', 'dorm_bed', 'rv_spot'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Üniversite kulüpleri                                         */
/* ------------------------------------------------------------------ */

export const CLUB_ROLES = ['member', 'officer', 'president'] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const MEMBERSHIP_STATUSES = ['none', 'requested', 'member'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CLUB_EVENT_KINDS = ['trip', 'training', 'social', 'competition', 'talk'] as const;
export type ClubEventKind = (typeof CLUB_EVENT_KINDS)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Eğlence & oyunlaştırma                                       */
/* ------------------------------------------------------------------ */

export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'legend'] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];

export const CHALLENGE_PERIODS = ['weekly', 'monthly', 'seasonal'] as const;
export type ChallengePeriod = (typeof CHALLENGE_PERIODS)[number];

export const LEADERBOARD_SCOPES = ['friends', 'city', 'club', 'global'] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export const XP_SOURCES = [
  'post',
  'route',
  'ascent',
  'hazard_report',
  'challenge',
  'quiz',
  'event',
  'streak',
] as const;
export type XpSource = (typeof XP_SOURCES)[number];

/* ------------------------------------------------------------------ */
/* v1.2 — Yapay zekâ asistanı                                          */
/* ------------------------------------------------------------------ */

export const AI_INTENTS = [
  'plan_trip',
  'safety_brief',
  'packing_list',
  'find_place',
  'gear_advice',
  'first_aid',
  'weather',
  'general',
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

export const AI_ROLES = ['user', 'assistant'] as const;
export type AiRole = (typeof AI_ROLES)[number];

/* ------------------------------------------------------------------ */
/* v1.3 — Destinasyon arşivi, yol planı, AMS                           */
/* ------------------------------------------------------------------ */

export const STAGE_KINDS = [
  'trailhead',
  'village',
  'teahouse',
  'camp',
  'hut',
  'base_camp',
  'pass',
  'summit',
  'viewpoint',
] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const TRANSPORT_MODES = ['flight', 'bus', 'jeep', 'train', 'ferry', 'trek', 'taxi'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const DESTINATION_TYPES = [
  'trek',
  'expedition',
  'climbing_area',
  'dive_region',
  'ski_region',
  'multi_sport',
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const TRIP_PLAN_STATUSES = [
  'planned',
  'active',
  'overdue',
  'returned',
  'cancelled',
] as const;
export type TripPlanStatus = (typeof TRIP_PLAN_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* v1.3 — Kamera ile AI tavsiye                                        */
/* ------------------------------------------------------------------ */

export const VISION_SITUATIONS = [
  'terrain',
  'weather',
  'gear',
  'injury',
  'wildlife',
  'plant',
  'map',
  'water',
  'camp',
  'other',
] as const;
export type VisionSituation = (typeof VISION_SITUATIONS)[number];

export const RISK_LEVELS = ['low', 'moderate', 'high', 'extreme'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/* ------------------------------------------------------------------ */
/* v1.3 — Sosyal paylaşım                                              */
/* ------------------------------------------------------------------ */

export const POST_KINDS = ['adventure', 'status', 'photo'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const REACTION_TYPES = ['like', 'love', 'wow', 'fire', 'strong'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const FEED_TABS = ['all', 'following', 'adventures', 'status'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/* ------------------------------------------------------------------ */
/* v1.3 — Gruplar & kanallar                                            */
/* ------------------------------------------------------------------ */

export const GROUP_KINDS = ['group', 'channel'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const GROUP_PRIVACIES = ['public', 'private'] as const;
export type GroupPrivacy = (typeof GROUP_PRIVACIES)[number];

export const GROUP_ROLES = ['member', 'admin', 'owner'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const GROUP_MESSAGE_TYPES = [
  'text',
  'image',
  'location',
  'route',
  'poll',
  'system',
] as const;
export type GroupMessageType = (typeof GROUP_MESSAGE_TYPES)[number];

/* ------------------------------------------------------------------ */
/* v1.3 — Eğitimler                                                    */
/* ------------------------------------------------------------------ */

export const COURSE_CATEGORIES = [
  'mountaineering',
  'climbing',
  'avalanche',
  'first_aid',
  'navigation',
  'diving',
  'paragliding',
  'paddling',
  'winter',
  'drone',
  'ethics',
  'photography',
] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_FORMATS = ['online', 'in_person', 'hybrid'] as const;
export type CourseFormat = (typeof COURSE_FORMATS)[number];

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const LESSON_TYPES = ['video', 'reading', 'quiz', 'practical'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const ENROLLMENT_STATUSES = ['active', 'completed', 'expired'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* v1.4 — Topluluk rotaları, navigasyon, açık veri                     */
/* ------------------------------------------------------------------ */

export const TRACK_SOURCES = [
  'recorded',
  'gpx',
  'strava',
  'komoot',
  'alltrails',
  'wikiloc',
  'garmin',
  'media',
] as const;
export type TrackSource = (typeof TRACK_SOURCES)[number];

export const TRACK_STATUSES = ['draft', 'published', 'verified'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

export const POI_KINDS = [
  'campsite',
  'water',
  'viewpoint',
  'shelter',
  'danger',
  'junction',
  'summit',
  'parking',
  'food',
  'trailhead',
  'other',
] as const;
export type PoiKind = (typeof POI_KINDS)[number];

export const POI_SOURCES = ['user', 'story', 'stream', 'post', 'track', 'osm'] as const;
export type PoiSource = (typeof POI_SOURCES)[number];

export const NAV_MANEUVERS = [
  'start',
  'continue',
  'slight_left',
  'left',
  'sharp_left',
  'slight_right',
  'right',
  'sharp_right',
  'uturn',
  'waypoint',
  'arrive',
] as const;
export type NavManeuver = (typeof NAV_MANEUVERS)[number];

export const AVALANCHE_LEVELS = [1, 2, 3, 4, 5] as const;
export type AvalancheLevel = (typeof AVALANCHE_LEVELS)[number];

/* ------------------------------------------------------------------ */
/* v1.5 — Ülke rehberi, yazarlar, canlı tanımlama, tele-tıp            */
/* ------------------------------------------------------------------ */

export const VISA_TYPES = ['visa_free', 'e_visa', 'on_arrival', 'embassy', 'banned'] as const;
export type VisaType = (typeof VISA_TYPES)[number];

export const ARTICLE_STATUSES = ['draft', 'published', 'featured'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_CATEGORIES = [
  'trip_report',
  'guide',
  'gear',
  'safety',
  'culture',
  'photography',
  'opinion',
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const SPECIES_GROUPS = [
  'snake',
  'mammal',
  'insect',
  'arachnid',
  'marine',
  'bird',
  'plant',
  'fungus',
] as const;
export type SpeciesGroup = (typeof SPECIES_GROUPS)[number];

export const DANGER_LEVELS = ['harmless', 'caution', 'dangerous', 'deadly'] as const;
export type DangerLevel = (typeof DANGER_LEVELS)[number];

export const DETERRENT_ANIMALS = [
  'bear',
  'wolf',
  'boar',
  'dog',
  'snake',
  'jackal',
  'monkey',
  'elephant',
  'big_cat',
] as const;
export type DeterrentAnimal = (typeof DETERRENT_ANIMALS)[number];

export const DETERRENT_SOUNDS = [
  'air_horn',
  'siren',
  'whistle',
  'shout',
  'clap',
  'metal_clang',
  'ultrasonic',
  'stomp',
] as const;
export type DeterrentSound = (typeof DETERRENT_SOUNDS)[number];

export const QUESTION_STATUSES = ['open', 'answered', 'resolved'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const DOCTOR_SPECIALTIES = [
  'emergency',
  'toxicology',
  'wilderness',
  'orthopedics',
  'dermatology',
  'general',
  'pediatrics',
  'dive_medicine',
  'altitude_medicine',
] as const;
export type DoctorSpecialty = (typeof DOCTOR_SPECIALTIES)[number];

export const CONSULT_STATUSES = ['requested', 'active', 'completed', 'cancelled'] as const;
export type ConsultStatus = (typeof CONSULT_STATUSES)[number];

export const CONSULT_URGENCIES = ['low', 'medium', 'high', 'critical'] as const;
export type ConsultUrgency = (typeof CONSULT_URGENCIES)[number];
