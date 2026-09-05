import type {
  AdventureType,
  BookingStatus,
  BusinessType,
  EmergencyCenterType,
  FirstAidCategory,
  Plan,
  PlaceKind,
  ShareMode,
  StayStatus,
  StreamSource,
  DifficultyGrade,
  HazardSeverity,
  HazardStatus,
  HazardType,
  ListingCategory,
  ListingCondition,
  MatchStatus,
  NotificationType,
  StreamStatus,
  TrailCondition,
} from './enums';

export type ID = string;
/** ISO 8601 zaman damgası */
export type ISODate = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface User {
  id: ID;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  locationName: string;
  coords: GeoPoint;
  isVerified: boolean;
  totalDistanceKm: number;
  totalAdventures: number;
  followersCount: number;
  followingCount: number;
  /** 0–100 arası güvenilirlik skoru */
  trustScore: number;
  favoriteTypes: AdventureType[];
  joinedAt: ISODate;
  /** Abonelik planı */
  plan: Plan;
  /** Acil durumda canlı konumun paylaşılacağı kişiler */
  emergencyContacts: EmergencyContact[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  /** Uygulama içi kullanıcıysa kimliği */
  userId: ID | null;
}

export interface Post {
  id: ID;
  authorId: ID;
  imageUrl: string | null;
  caption: string;
  adventureType: AdventureType;
  difficulty: DifficultyGrade;
  altitudeM: number;
  distanceKm: number;
  temperatureC: number;
  windKmh: number;
  trailCondition: TrailCondition;
  durationMin: number;
  locationName: string;
  coords: GeoPoint;
  likesCount: number;
  commentsCount: number;
  isVerifiedInfo: boolean;
  routeId: ID | null;
  createdAt: ISODate;
}

/** Oturum açmış kullanıcıya göre zenginleştirilmiş gönderi */
export interface FeedPost extends Post {
  author: User;
  likedByMe: boolean;
}

export interface Comment {
  id: ID;
  postId: ID;
  authorId: ID;
  content: string;
  createdAt: ISODate;
}

export interface CommentWithAuthor extends Comment {
  author: User;
}

export interface Follow {
  followerId: ID;
  followingId: ID;
  createdAt: ISODate;
}

export interface Route {
  id: ID;
  name: string;
  adventureType: AdventureType;
  difficulty: DifficultyGrade;
  distanceKm: number;
  elevationGainM: number;
  locationName: string;
  path: GeoPoint[];
}

export interface ZMatch {
  id: ID;
  requesterId: ID;
  receiverId: ID;
  status: MatchStatus;
  message: string;
  plannedDate: ISODate | null;
  locationName: string | null;
  adventureType: AdventureType;
  createdAt: ISODate;
  respondedAt: ISODate | null;
}

export interface ZMatchWithUsers extends ZMatch {
  requester: User;
  receiver: User;
}

export interface Message {
  id: ID;
  senderId: ID;
  receiverId: ID;
  content: string;
  matchId: ID | null;
  createdAt: ISODate;
  readAt: ISODate | null;
}

export interface Notification {
  id: ID;
  type: NotificationType;
  senderId: ID;
  receiverId: ID;
  message: string;
  isRead: boolean;
  postId: ID | null;
  matchId: ID | null;
  /** Tehlike, yayın, ilan veya rezervasyon gibi ek hedef kimliği */
  targetId: ID | null;
  createdAt: ISODate;
}

export interface NotificationWithSender extends Notification {
  sender: User;
}

export interface TrendingLocation {
  id: ID;
  name: string;
  region: string;
  description: string;
  imageUrl: string | null;
  adventureTypes: AdventureType[];
  difficulty: DifficultyGrade;
  postsCount: number;
  coords: GeoPoint;
  bestSeason: string;
  /** Son 7 gündeki büyüme yüzdesi */
  trendPercent: number;
}

/** ZMatch adayı: kullanıcı + hesaplanmış mesafe */
export interface MatchCandidate {
  user: User;
  distanceKm: number;
  sharedTypes: AdventureType[];
  /** Zaten gönderilmiş bekleyen istek varsa */
  existingMatch: ZMatch | null;
}

export interface CreatePostInput {
  caption: string;
  imageUri: string | null;
  adventureType: AdventureType;
  difficulty: DifficultyGrade;
  trailCondition: TrailCondition;
  altitudeM: number;
  distanceKm: number;
  temperatureC: number;
  windKmh: number;
  durationMin: number;
  locationName: string;
  coords?: GeoPoint;
}

export interface CreateMatchInput {
  receiverId: ID;
  message: string;
  adventureType: AdventureType;
  plannedDate: ISODate | null;
  locationName: string | null;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  username: string;
  displayName: string;
}

/* ------------------------------------------------------------------ */
/* Tehlikeli yerler                                                    */
/* ------------------------------------------------------------------ */

export interface HazardZone {
  id: ID;
  type: HazardType;
  severity: HazardSeverity;
  status: HazardStatus;
  title: string;
  description: string;
  locationName: string;
  coords: GeoPoint;
  /** Etki yarıçapı (metre) */
  radiusM: number;
  reporterId: ID;
  confirmations: number;
  createdAt: ISODate;
  /** Null ise süresiz; aksi halde bu tarihten sonra listelenmez */
  expiresAt: ISODate | null;
  resolvedAt: ISODate | null;
}

export interface HazardZoneWithReporter extends HazardZone {
  reporter: User;
  confirmedByMe: boolean;
  /** Arama merkezine uzaklık (km); merkez verilmediyse null */
  distanceKm: number | null;
}

export interface ReportHazardInput {
  type: HazardType;
  severity: HazardSeverity;
  title: string;
  description: string;
  locationName: string;
  coords: GeoPoint;
  radiusM: number;
  /** Kaç saat sonra otomatik düşsün; null → süresiz */
  expiresInHours: number | null;
}

/* ------------------------------------------------------------------ */
/* Canlı yayın                                                         */
/* ------------------------------------------------------------------ */

export interface LiveStream {
  id: ID;
  hostId: ID;
  title: string;
  description: string;
  adventureType: AdventureType;
  status: StreamStatus;
  locationName: string;
  coords: GeoPoint;
  viewerCount: number;
  peakViewers: number;
  likesCount: number;
  thumbnailUrl: string | null;
  /** HLS / MP4 oynatma adresi (canlı veya tekrar) */
  playbackUrl: string | null;
  scheduledAt: ISODate | null;
  startedAt: ISODate | null;
  endedAt: ISODate | null;
  /** Yayın sırasında canlı irtifa (metre) — opsiyonel telemetri */
  altitudeM: number | null;
  /** Kamera ya da drone */
  source: StreamSource;
  /** Drone yayınlarında anlık telemetri */
  droneTelemetry: DroneTelemetry | null;
}

export interface DroneTelemetry {
  altitudeM: number;
  speedKmh: number;
  batteryPct: number;
  headingDeg: number;
  distanceFromPilotM: number;
}

export interface LiveStreamWithHost extends LiveStream {
  host: User;
}

export interface StreamMessage {
  id: ID;
  streamId: ID;
  authorId: ID;
  content: string;
  createdAt: ISODate;
}

export interface StreamMessageWithAuthor extends StreamMessage {
  author: User;
}

export interface StartStreamInput {
  title: string;
  description: string;
  adventureType: AdventureType;
  locationName: string;
  coords?: GeoPoint;
  source?: StreamSource;
}

/* ------------------------------------------------------------------ */
/* Market                                                              */
/* ------------------------------------------------------------------ */

export interface Listing {
  id: ID;
  sellerId: ID;
  title: string;
  description: string;
  priceTry: number;
  category: ListingCategory;
  condition: ListingCondition;
  imageUrls: string[];
  locationName: string;
  coords: GeoPoint;
  adventureTypes: AdventureType[];
  isSold: boolean;
  favoritesCount: number;
  createdAt: ISODate;
}

export interface ListingWithSeller extends Listing {
  seller: User;
  favoritedByMe: boolean;
}

export interface CreateListingInput {
  title: string;
  description: string;
  priceTry: number;
  category: ListingCategory;
  condition: ListingCondition;
  imageUri: string | null;
  locationName: string;
  adventureTypes: AdventureType[];
}

export interface ListingFilter {
  query?: string;
  category?: ListingCategory | null;
  sellerId?: ID;
  includeSold?: boolean;
}

/* ------------------------------------------------------------------ */
/* Eğitmenler                                                          */
/* ------------------------------------------------------------------ */

export interface Instructor {
  id: ID;
  userId: ID;
  headline: string;
  bio: string;
  specialties: AdventureType[];
  certifications: string[];
  rating: number;
  reviewCount: number;
  pricePerSessionTry: number;
  sessionDurationMin: number;
  languages: string[];
  yearsExperience: number;
  locationName: string;
  coords: GeoPoint;
  /** 0 = Pazar … 6 = Cumartesi */
  availableDays: number[];
  studentsCount: number;
}

export interface InstructorWithUser extends Instructor {
  user: User;
  distanceKm: number | null;
}

export interface InstructorReview {
  id: ID;
  instructorId: ID;
  authorId: ID;
  rating: number;
  content: string;
  createdAt: ISODate;
}

export interface InstructorReviewWithAuthor extends InstructorReview {
  author: User;
}

export interface Booking {
  id: ID;
  instructorId: ID;
  studentId: ID;
  adventureType: AdventureType;
  date: ISODate;
  message: string;
  status: BookingStatus;
  priceTry: number;
  createdAt: ISODate;
  respondedAt: ISODate | null;
}

export interface BookingWithParties extends Booking {
  instructor: InstructorWithUser;
  student: User;
}

export interface CreateBookingInput {
  instructorId: ID;
  adventureType: AdventureType;
  date: ISODate;
  message: string;
}

export interface InstructorFilter {
  adventureType?: AdventureType | null;
  query?: string;
  sortBy?: 'rating' | 'distance' | 'price';
}

/* ------------------------------------------------------------------ */
/* Kütüphane                                                           */
/* ------------------------------------------------------------------ */

export interface PlaceImage {
  url: string;
  thumbUrl: string;
  license: string;
  author: string;
  attribution: string;
}

/** Veri hattının ürettiği birleşik yer kaydı (tools/data-pipeline ile aynı şema). */
export interface LibraryPlace {
  id: ID;
  source: 'osm' | 'wikidata' | 'curated';
  kind: PlaceKind;
  name: string;
  names: Partial<Record<string, string>>;
  adventureTypes: AdventureType[];
  lat: number;
  lng: number;
  elevationM: number | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  countryCode: string | null;
  tags: Record<string, string>;
  wikidataId: string | null;
  image: PlaceImage | null;
  license: string;
  attribution: string;
  updatedAt: ISODate;
}

export interface LibraryPlaceWithDistance extends LibraryPlace {
  distanceKm: number | null;
}

export interface LibraryFilter {
  query?: string;
  kind?: PlaceKind | null;
  countryCode?: string | null;
  adventureType?: AdventureType | null;
  /** Yakınlık sıralaması için merkez */
  origin?: GeoPoint | null;
  radiusKm?: number | null;
}

/* ------------------------------------------------------------------ */
/* Canlı konum                                                         */
/* ------------------------------------------------------------------ */

export interface LocationShare {
  userId: ID;
  coords: GeoPoint;
  mode: ShareMode;
  startedAt: ISODate;
  expiresAt: ISODate | null;
  updatedAt: ISODate;
  batteryPct: number | null;
  altitudeM: number | null;
  speedKmh: number | null;
}

export interface LocationShareWithUser extends LocationShare {
  user: User;
  distanceKm: number | null;
  /** Paylaşımın güncelliğini yitirip yitirmediği (>15 dk) */
  isStale: boolean;
}

export interface StartShareInput {
  mode: ShareMode;
  coords: GeoPoint;
  /** Dakika; null → kapatana kadar */
  durationMin: number | null;
  batteryPct?: number | null;
  altitudeM?: number | null;
}

/* ------------------------------------------------------------------ */
/* Anlar (hikâyeler)                                                   */
/* ------------------------------------------------------------------ */

export interface Story {
  id: ID;
  authorId: ID;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  caption: string;
  adventureType: AdventureType;
  locationName: string;
  coords: GeoPoint;
  altitudeM: number | null;
  createdAt: ISODate;
  expiresAt: ISODate;
  viewsCount: number;
}

export interface StoryGroup {
  author: User;
  stories: Story[];
  /** Görüntüleyen kullanıcı tüm anları izledi mi */
  allSeen: boolean;
  latestAt: ISODate;
}

export interface CreateStoryInput {
  mediaUri: string | null;
  caption: string;
  adventureType: AdventureType;
  locationName: string;
  coords?: GeoPoint;
  altitudeM?: number | null;
}

/* ------------------------------------------------------------------ */
/* İşletmeler & konaklama                                              */
/* ------------------------------------------------------------------ */

export interface Business {
  id: ID;
  ownerId: ID;
  name: string;
  type: BusinessType;
  description: string;
  locationName: string;
  coords: GeoPoint;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  /** Konaklama için gecelik başlangıç fiyatı; diğerleri için null */
  priceFromTry: number | null;
  amenities: string[];
  adventureTypes: AdventureType[];
  website: string | null;
  phone: string | null;
  plan: Plan;
  /** Öne çıkarılmış (ücretli) */
  isFeatured: boolean;
  createdAt: ISODate;
}

export interface BusinessWithOwner extends Business {
  owner: User;
  distanceKm: number | null;
}

export interface StayBooking {
  id: ID;
  businessId: ID;
  guestId: ID;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
  nights: number;
  totalTry: number;
  platformFeeTry: number;
  status: StayStatus;
  createdAt: ISODate;
}

export interface StayBookingWithBusiness extends StayBooking {
  business: Business;
}

export interface CreateStayInput {
  businessId: ID;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
}

export interface RegisterBusinessInput {
  name: string;
  type: BusinessType;
  description: string;
  locationName: string;
  priceFromTry: number | null;
  amenities: string[];
  adventureTypes: AdventureType[];
  phone: string | null;
  website: string | null;
}

export interface BusinessFilter {
  query?: string;
  type?: BusinessType | null;
  staysOnly?: boolean;
  origin?: GeoPoint | null;
}

/* ------------------------------------------------------------------ */
/* Acil durum & ilk yardım                                             */
/* ------------------------------------------------------------------ */

export interface EmergencyCenter {
  id: ID;
  name: string;
  type: EmergencyCenterType;
  coords: GeoPoint;
  locationName: string;
  phone: string | null;
  open24h: boolean;
  countryCode: string;
}

export interface EmergencyCenterWithDistance extends EmergencyCenter {
  distanceKm: number;
}

export interface FirstAidGuide {
  slug: string;
  category: FirstAidCategory;
  title: string;
  summary: string;
  /** Adım adım talimatlar */
  steps: string[];
  /** Yapılmaması gerekenler */
  donts: string[];
  /** Ne zaman acil yardım çağrılmalı */
  callHelpWhen: string;
  icon: string;
}

export interface SosEvent {
  id: ID;
  userId: ID;
  coords: GeoPoint;
  createdAt: ISODate;
  resolvedAt: ISODate | null;
  notifiedContacts: number;
}
