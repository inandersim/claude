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
  AiIntent,
  AiRole,
  AscentStyle,
  BadgeTier,
  CancellationPolicy,
  ChallengePeriod,
  ClimbType,
  ClubEventKind,
  ClubRole,
  GradeSystem,
  HostVerificationLevel,
  LinkType,
  MapPackStatus,
  MembershipStatus,
  PaymentStatus,
  RouteProfile,
  SatDeviceType,
  SatMessageKind,
  SatMessageStatus,
  SosStage,
  Surface,
  UnitKind,
  VerificationStatus,
  XpSource,
  CourseCategory,
  CourseFormat,
  CourseLevel,
  DestinationType,
  EnrollmentStatus,
  GroupKind,
  GroupMessageType,
  GroupPrivacy,
  GroupRole,
  LessonType,
  PostKind,
  ReactionType,
  RiskLevel,
  StageKind,
  TransportMode,
  TripPlanStatus,
  VisionSituation,
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
  /* v1.3 — sosyal alanlar (eski kayıtlar için isteğe bağlı; yokluğunda 'adventure') */
  kind?: PostKind;
  /** Çoklu fotoğraf (imageUrl ilk kare) */
  images?: string[];
  hashtags?: string[];
  mentions?: ID[];
  repostOfId?: ID | null;
  savesCount?: number;
  repostsCount?: number;
}

/** Oturum açmış kullanıcıya göre zenginleştirilmiş gönderi */
export interface FeedPost extends Post {
  author: User;
  likedByMe: boolean;
  /* v1.3 */
  myReaction?: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  savedByMe?: boolean;
  repostOf?: (Post & { author: User }) | null;
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

/* ------------------------------------------------------------------ */
/* v1.2 — Yapay zekâ asistanı                                          */
/* ------------------------------------------------------------------ */

export interface AiMessage {
  id: ID;
  threadId: ID;
  role: AiRole;
  content: string;
  intent: AiIntent | null;
  /** Yanıtta önerilen uygulama içi bağlantılar (rota, yer, rehber…) */
  actions: AiAction[];
  createdAt: ISODate;
}

export interface AiAction {
  label: string;
  /** Expo Router yolu, örn. "/library/lp_1" */
  href: string;
  icon: string;
}

export interface AiThread {
  id: ID;
  userId: ID;
  title: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AiThreadWithMessages extends AiThread {
  messages: AiMessage[];
}

export interface AiContext {
  locale: string;
  coords: GeoPoint | null;
  adventureTypes: AdventureType[];
  plan: Plan;
}

export interface TripPlanDay {
  day: number;
  title: string;
  distanceKm: number;
  ascentM: number;
  notes: string;
}

export interface TripPlan {
  title: string;
  adventureType: AdventureType;
  days: TripPlanDay[];
  packing: string[];
  safety: string[];
}

/* ------------------------------------------------------------------ */
/* v1.2 — Çevrimdışı haritalar & rota motoru                           */
/* ------------------------------------------------------------------ */

export interface TrailNode {
  id: ID;
  coords: GeoPoint;
  elevationM: number;
  name: string | null;
}

export interface TrailEdge {
  id: ID;
  from: ID;
  to: ID;
  distanceKm: number;
  surface: Surface;
  /** Hangi profiller bu kenarı kullanabilir */
  profiles: RouteProfile[];
  /** 0..1, 1 = teknik */
  technical: number;
}

export interface TrailGraph {
  regionId: ID;
  nodes: TrailNode[];
  edges: TrailEdge[];
}

export interface PlannedRoute {
  nodeIds: ID[];
  points: GeoPoint[];
  distanceKm: number;
  ascentM: number;
  descentM: number;
  durationMin: number;
  maxElevationM: number;
  minElevationM: number;
  /** [mesafeKm, yükseklikM] çiftleri */
  profile: [number, number][];
  surfaces: Partial<Record<Surface, number>>;
}

export interface SavedRoute {
  id: ID;
  userId: ID;
  regionId: ID;
  name: string;
  routeProfile: RouteProfile;
  planned: PlannedRoute;
  createdAt: ISODate;
}

export interface MapPack {
  id: ID;
  name: string;
  countryCode: string;
  bbox: [number, number, number, number];
  sizeMb: number;
  version: string;
  /** Vektör karo formatı (PMTiles) */
  format: 'pmtiles';
  status: MapPackStatus;
  progress: number;
  updatedAt: ISODate;
  /** İndirilmişse yerel yol */
  localPath: string | null;
}

/* ------------------------------------------------------------------ */
/* v1.2 — Tırmanış veritabanı                                          */
/* ------------------------------------------------------------------ */

export interface Crag {
  id: ID;
  name: string;
  locationName: string;
  countryCode: string;
  coords: GeoPoint;
  rockType: string;
  description: string;
  imageUrl: string | null;
  climbTypes: ClimbType[];
  routeCount: number;
  verification: VerificationStatus;
  /** En iyi mevsimler (ay numaraları 1-12) */
  seasons: number[];
  approachMin: number;
  updatedAt: ISODate;
}

export interface CragWithDistance extends Crag {
  distanceKm: number | null;
}

export interface CragSector {
  id: ID;
  cragId: ID;
  name: string;
  orientation: string;
  routeCount: number;
}

export interface ClimbingRoute {
  id: ID;
  cragId: ID;
  sectorId: ID;
  name: string;
  type: ClimbType;
  /** Derece, Fransız (spor/çok uzun) veya Fontainebleau (boulder) sisteminde kaynak */
  grade: string;
  gradeSystem: GradeSystem;
  lengthM: number | null;
  pitches: number;
  bolts: number | null;
  stars: number;
  firstAscent: string | null;
  description: string;
  verification: VerificationStatus;
  confirmations: number;
  ascentCount: number;
  submittedBy: ID | null;
  createdAt: ISODate;
}

export interface Ascent {
  id: ID;
  routeId: ID;
  userId: ID;
  style: AscentStyle;
  date: ISODate;
  note: string;
  /** Kullanıcının hissettiği derece (opsiyonel) */
  feltGrade: string | null;
}

export interface AscentWithUser extends Ascent {
  user: User;
}

export interface LogAscentInput {
  routeId: ID;
  style: AscentStyle;
  note: string;
  feltGrade?: string | null;
}

export interface SubmitRouteInput {
  cragId: ID;
  sectorId: ID;
  name: string;
  type: ClimbType;
  grade: string;
  gradeSystem: GradeSystem;
  lengthM: number | null;
  pitches: number;
  description: string;
}

export interface ClimbingFilter {
  query?: string;
  countryCode?: string | null;
  climbType?: ClimbType | null;
  origin?: GeoPoint | null;
  verifiedOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/* v1.2 — Uydu bağlantısı                                              */
/* ------------------------------------------------------------------ */

export interface SatDevice {
  id: ID;
  userId: ID;
  type: SatDeviceType;
  name: string;
  imei: string | null;
  batteryPct: number | null;
  pairedAt: ISODate;
  lastSeenAt: ISODate | null;
  /** Aylık plan dahil mesaj sayısı */
  monthlyQuota: number;
  usedThisMonth: number;
}

export interface SatMessage {
  id: ID;
  userId: ID;
  deviceId: ID | null;
  kind: SatMessageKind;
  /** Kısaltılmış/sıkıştırılmış gövde (≤160 karakter) */
  body: string;
  coords: GeoPoint | null;
  toContacts: string[];
  status: SatMessageStatus;
  link: LinkType;
  createdAt: ISODate;
  deliveredAt: ISODate | null;
  attempts: number;
}

export interface SosSession {
  id: ID;
  userId: ID;
  stage: SosStage;
  coords: GeoPoint;
  startedAt: ISODate;
  updatedAt: ISODate;
  /** Aşama geçmişi */
  timeline: { stage: SosStage; at: ISODate; note: string }[];
  rescueCenterId: ID | null;
  link: LinkType;
}

export interface LinkStatus {
  link: LinkType;
  /** dBm veya 0..100 normalize sinyal */
  signal: number;
  satellitesInView: number;
  estimatedLatencyS: number;
}

export interface PairDeviceInput {
  type: SatDeviceType;
  name: string;
  imei: string | null;
}

export interface SendSatMessageInput {
  kind: SatMessageKind;
  body: string;
  coords: GeoPoint | null;
  toContacts: string[];
}

/* ------------------------------------------------------------------ */
/* v1.2 — Rezervasyon envanteri & ödeme güveni                         */
/* ------------------------------------------------------------------ */

export interface StayUnit {
  id: ID;
  businessId: ID;
  name: string;
  kind: UnitKind;
  capacity: number;
  quantity: number;
  basePriceTry: number;
  /** Hafta sonu çarpanı (1.0 = değişmez) */
  weekendMultiplier: number;
  /** Sezon aralıkları */
  seasons: { from: ISODate; to: ISODate; multiplier: number }[];
  amenities: string[];
}

export interface UnitBlock {
  id: ID;
  unitId: ID;
  from: ISODate;
  to: ISODate;
  reason: 'booking' | 'maintenance' | 'owner';
  bookingId: ID | null;
}

export interface Availability {
  unitId: ID;
  date: ISODate;
  available: number;
  priceTry: number;
}

export interface Payment {
  id: ID;
  bookingId: ID;
  payerId: ID;
  amountTry: number;
  platformFeeTry: number;
  status: PaymentStatus;
  provider: 'iyzico' | 'stripe' | 'mock';
  createdAt: ISODate;
  releasedAt: ISODate | null;
  refundedTry: number;
  timeline: { status: PaymentStatus; at: ISODate }[];
}

export interface StayReview {
  id: ID;
  businessId: ID;
  bookingId: ID;
  authorId: ID;
  rating: number;
  text: string;
  /** Yalnızca tamamlanmış konaklama sonrası yazılabilir */
  verifiedStay: boolean;
  createdAt: ISODate;
}

export interface StayReviewWithAuthor extends StayReview {
  author: User;
}

export interface HostProfile {
  businessId: ID;
  verification: HostVerificationLevel;
  cancellationPolicy: CancellationPolicy;
  responseRatePct: number;
  responseTimeMin: number;
  payoutIban: string | null;
  /** Emanetten çıkmayı bekleyen tutar */
  pendingPayoutTry: number;
  paidOutTry: number;
}

export interface BookingWithPayment extends StayBooking {
  business: Business;
  unit: StayUnit | null;
  payment: Payment | null;
  policy: CancellationPolicy;
}

export interface QuoteInput {
  businessId: ID;
  unitId: ID;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
}

export interface Quote {
  nights: number;
  nightly: { date: ISODate; priceTry: number }[];
  subtotalTry: number;
  platformFeeTry: number;
  totalTry: number;
  depositTry: number;
  policy: CancellationPolicy;
  available: boolean;
}

export interface RefundPreview {
  refundTry: number;
  keptTry: number;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* v1.2 — Üniversite kulüpleri                                         */
/* ------------------------------------------------------------------ */

export interface Club {
  id: ID;
  name: string;
  university: string;
  city: string;
  countryCode: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  adventureTypes: AdventureType[];
  memberCount: number;
  foundedYear: number | null;
  isVerified: boolean;
  /** Bu dönem toplam XP (kulüp sıralaması için) */
  seasonXp: number;
  contactEmail: string | null;
  instagram: string | null;
  createdAt: ISODate;
}

export interface ClubMember {
  clubId: ID;
  userId: ID;
  role: ClubRole;
  joinedAt: ISODate;
}

export interface ClubWithMembership extends Club {
  membership: MembershipStatus;
  role: ClubRole | null;
  upcomingEventCount: number;
}

export interface ClubEvent {
  id: ID;
  clubId: ID;
  title: string;
  kind: ClubEventKind;
  adventureType: AdventureType;
  description: string;
  locationName: string;
  coords: GeoPoint | null;
  startsAt: ISODate;
  endsAt: ISODate;
  capacity: number | null;
  attendeeCount: number;
  /** Üye olmayanlar katılabilir mi */
  openToAll: boolean;
  priceTry: number;
}

export interface ClubEventWithClub extends ClubEvent {
  club: Club;
  rsvped: boolean;
}

export interface CreateClubEventInput {
  clubId: ID;
  title: string;
  kind: ClubEventKind;
  adventureType: AdventureType;
  description: string;
  locationName: string;
  startsAt: ISODate;
  endsAt: ISODate;
  capacity: number | null;
  openToAll: boolean;
  priceTry: number;
}

export interface ClubFilter {
  query?: string;
  city?: string | null;
  adventureType?: AdventureType | null;
  countryCode?: string | null;
}

export interface StudentVerification {
  userId: ID;
  email: string;
  university: string;
  verifiedAt: ISODate | null;
}

/* ------------------------------------------------------------------ */
/* v1.2 — Eğlence & oyunlaştırma                                       */
/* ------------------------------------------------------------------ */

export interface XpEvent {
  id: ID;
  userId: ID;
  source: XpSource;
  amount: number;
  note: string;
  createdAt: ISODate;
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  nextLevelXp: number;
  progress: number;
}

export interface Badge {
  id: ID;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  /** Kazanma koşulu (gösterim amaçlı) */
  criteria: string;
}

export interface EarnedBadge {
  badgeId: ID;
  userId: ID;
  earnedAt: ISODate;
}

export interface BadgeWithStatus extends Badge {
  earnedAt: ISODate | null;
}

export interface Challenge {
  id: ID;
  title: string;
  description: string;
  period: ChallengePeriod;
  adventureType: AdventureType | null;
  target: number;
  unit: 'km' | 'm' | 'count';
  rewardXp: number;
  badgeId: ID | null;
  startsAt: ISODate;
  endsAt: ISODate;
}

export interface ChallengeProgress {
  challengeId: ID;
  userId: ID;
  value: number;
  completedAt: ISODate | null;
  joinedAt: ISODate;
}

export interface ChallengeWithProgress extends Challenge {
  progress: ChallengeProgress | null;
  participants: number;
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
  xp: number;
  isMe: boolean;
}

export interface QuizQuestion {
  id: ID;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  adventureType: AdventureType | null;
}

export interface QuizResult {
  correct: number;
  total: number;
  xpEarned: number;
  streak: number;
}

export interface PassportStamp {
  id: ID;
  userId: ID;
  placeName: string;
  countryCode: string;
  adventureType: AdventureType;
  elevationM: number | null;
  stampedAt: ISODate;
}

export interface FunSummary {
  level: LevelInfo;
  streakDays: number;
  badgesEarned: number;
  badgesTotal: number;
  activeChallenges: number;
  stamps: number;
  weeklyRank: number | null;
}

export interface RouletteSuggestion {
  title: string;
  adventureType: AdventureType;
  placeId: ID | null;
  placeName: string;
  distanceKm: number | null;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* v1.3 — Destinasyon arşivi, yol planı, AMS                           */
/* ------------------------------------------------------------------ */

export interface DestinationTransport {
  mode: TransportMode;
  from: string;
  to: string;
  durationMin: number;
  costTry: number | null;
  note: string;
}

export interface DestinationPermit {
  name: string;
  costTry: number | null;
  where: string;
  note: string;
}

export interface DestinationStage {
  id: ID;
  destinationId: ID;
  order: number;
  name: string;
  kind: StageKind;
  coords: GeoPoint;
  elevationM: number;
  /** Önceki duraktan mesafe/süre */
  distanceKm: number;
  durationMin: number;
  /** Konaklama: lodge/teahouse/kamp — olanaklar ve kapasite */
  sleeping: boolean;
  facilities: string[];
  waterAvailable: boolean;
  connectivity: 'none' | 'sat_only' | '2g' | '4g' | 'wifi';
  note: string;
  /** Aklimatizasyon önerisi: burada ek gün */
  restDayRecommended: boolean;
}

export interface Destination {
  id: ID;
  slug: string;
  name: string;
  region: string;
  countryCode: string;
  type: DestinationType;
  adventureTypes: AdventureType[];
  coords: GeoPoint;
  imageUrl: string | null;
  summary: string;
  /** Uzun anlatım (nasıl gidilir, ne zaman, ne bekle) — Markdown benzeri düz metin */
  guide: string;
  maxElevationM: number;
  typicalDays: number;
  totalDistanceKm: number;
  difficulty: DifficultyGrade;
  /** En iyi aylar 1-12 */
  bestMonths: number[];
  transports: DestinationTransport[];
  permits: DestinationPermit[];
  /** Tahmini bütçe (kişi başı, ₺) */
  budgetTry: { low: number; high: number };
  risks: string[];
  gear: string[];
  /** Ülke acil numarası dışındaki yerel kurtarma bilgisi */
  rescueNote: string;
  insuranceRequired: boolean;
  stageCount: number;
  rating: number;
  reviewCount: number;
  sources: string[];
  updatedAt: ISODate;
}

export interface DestinationWithDistance extends Destination {
  distanceKm: number | null;
  /** Kullanıcının kaydettiği (favori) */
  savedByMe: boolean;
}

export interface DestinationFilter {
  query?: string;
  countryCode?: string | null;
  type?: DestinationType | null;
  adventureType?: AdventureType | null;
  origin?: GeoPoint | null;
  month?: number | null;
}

/** Lake Louise AMS öz-değerlendirme (0-3 puan × 4 belirti) */
export interface AmsCheck {
  id: ID;
  userId: ID;
  destinationId: ID | null;
  elevationM: number;
  headache: 0 | 1 | 2 | 3;
  gi: 0 | 1 | 2 | 3;
  fatigue: 0 | 1 | 2 | 3;
  dizziness: 0 | 1 | 2 | 3;
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  note: string;
  createdAt: ISODate;
}

export interface ReturnPlan {
  id: ID;
  userId: ID;
  title: string;
  destinationId: ID | null;
  adventureType: AdventureType;
  startAt: ISODate;
  /** Beklenen dönüş; bu saatten `graceMin` sonra hâlâ dönmediyse acil kişilere uyarı */
  expectedReturnAt: ISODate;
  graceMin: number;
  route: string;
  companions: string;
  contactIds: ID[];
  status: TripPlanStatus;
  returnedAt: ISODate | null;
  alertSentAt: ISODate | null;
  createdAt: ISODate;
}

export interface CreateReturnPlanInput {
  title: string;
  destinationId: ID | null;
  adventureType: AdventureType;
  startAt: ISODate;
  expectedReturnAt: ISODate;
  graceMin: number;
  route: string;
  companions: string;
}

/* ------------------------------------------------------------------ */
/* v1.3 — Kamera ile AI tavsiye                                        */
/* ------------------------------------------------------------------ */

export interface VisionRequest {
  /** data:image/jpeg;base64,… ya da dosya URI */
  imageUri: string | null;
  imageBase64: string | null;
  situation: VisionSituation;
  question: string;
  coords: GeoPoint | null;
  altitudeM: number | null;
  locale: string;
}

export interface VisionAdvice {
  id: ID;
  situation: VisionSituation;
  /** Görüntüde tespit edilenler (kısa maddeler) */
  observations: string[];
  risk: RiskLevel;
  advice: string[];
  /** Yapılmaması gerekenler */
  avoid: string[];
  /** Uygulama içi bağlantılar */
  actions: AiAction[];
  /** Yanıt kaynağı */
  source: 'remote' | 'local';
  confidence: number;
  createdAt: ISODate;
}

export interface VisionHistoryItem extends VisionAdvice {
  thumbnailUri: string | null;
  question: string;
}

/* ------------------------------------------------------------------ */
/* v1.3 — Sosyal paylaşım                                              */
/* ------------------------------------------------------------------ */

export interface Reaction {
  postId: ID;
  userId: ID;
  type: ReactionType;
  createdAt: ISODate;
}

export interface SavedPost {
  userId: ID;
  postId: ID;
  collectionId: ID | null;
  createdAt: ISODate;
}

export interface Collection {
  id: ID;
  userId: ID;
  name: string;
  coverUrl: string | null;
  count: number;
  createdAt: ISODate;
}

export interface CreateStatusPostInput {
  caption: string;
  imageUris: string[];
  locationName: string | null;
  coords?: GeoPoint | null;
  adventureType?: AdventureType | null;
}

export interface HashtagSummary {
  tag: string;
  count: number;
  /** Son 7 günde artış */
  trending: boolean;
}

export interface SocialFilter {
  tab: FeedTabValue;
  hashtag?: string | null;
}
export type FeedTabValue = 'all' | 'following' | 'adventures' | 'status';

/* ------------------------------------------------------------------ */
/* v1.3 — Gruplar & kanallar                                            */
/* ------------------------------------------------------------------ */

export interface Group {
  id: ID;
  name: string;
  kind: GroupKind;
  privacy: GroupPrivacy;
  description: string;
  avatarUrl: string | null;
  adventureTypes: AdventureType[];
  city: string | null;
  countryCode: string | null;
  ownerId: ID;
  memberCount: number;
  inviteCode: string;
  pinnedMessageId: ID | null;
  clubId: ID | null;
  createdAt: ISODate;
  lastMessageAt: ISODate | null;
}

export interface GroupMember {
  groupId: ID;
  userId: ID;
  role: GroupRole;
  joinedAt: ISODate;
  muted: boolean;
  lastReadAt: ISODate | null;
}

export interface GroupWithMembership extends Group {
  membership: GroupRole | null;
  unreadCount: number;
  lastMessage: GroupMessage | null;
}

export interface PollOption {
  id: ID;
  text: string;
  votes: number;
}

export interface GroupMessage {
  id: ID;
  groupId: ID;
  senderId: ID;
  type: GroupMessageType;
  text: string;
  imageUrl: string | null;
  coords: GeoPoint | null;
  routeId: ID | null;
  poll: { question: string; options: PollOption[]; multi: boolean } | null;
  replyToId: ID | null;
  createdAt: ISODate;
  editedAt: ISODate | null;
}

export interface GroupMessageWithSender extends GroupMessage {
  sender: User;
  myVote: ID[] | null;
  replyTo: (GroupMessage & { sender: User }) | null;
}

export interface CreateGroupInput {
  name: string;
  kind: GroupKind;
  privacy: GroupPrivacy;
  description: string;
  adventureTypes: AdventureType[];
  city: string | null;
}

export interface SendGroupMessageInput {
  type: GroupMessageType;
  text: string;
  imageUri?: string | null;
  coords?: GeoPoint | null;
  routeId?: ID | null;
  poll?: { question: string; options: string[]; multi: boolean } | null;
  replyToId?: ID | null;
}

export interface GroupFilter {
  query?: string;
  kind?: GroupKind | null;
  adventureType?: AdventureType | null;
  mineOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/* v1.3 — Eğitimler                                                    */
/* ------------------------------------------------------------------ */

export interface Lesson {
  id: ID;
  courseId: ID;
  moduleTitle: string;
  order: number;
  title: string;
  type: LessonType;
  durationMin: number;
  /** Video URL (demo), okuma metni ya da quiz soruları */
  videoUrl: string | null;
  body: string;
  quiz: { question: string; options: string[]; answerIndex: number }[] | null;
  /** Ücretsiz önizleme */
  preview: boolean;
}

export interface Course {
  id: ID;
  slug: string;
  title: string;
  category: CourseCategory;
  level: CourseLevel;
  format: CourseFormat;
  summary: string;
  description: string;
  imageUrl: string | null;
  instructorId: ID | null;
  /** Kurum (PADI, AIARE, NOLS, TDF vb.) */
  provider: string;
  certificateName: string | null;
  /** Sertifika geçerlilik ayı; null → süresiz */
  validityMonths: number | null;
  priceTry: number;
  durationHours: number;
  lessonCount: number;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  languages: string[];
  prerequisites: string[];
  outcomes: string[];
  adventureTypes: AdventureType[];
  createdAt: ISODate;
}

export interface CourseSession {
  id: ID;
  courseId: ID;
  startsAt: ISODate;
  endsAt: ISODate;
  locationName: string;
  coords: GeoPoint | null;
  seats: number;
  seatsLeft: number;
  priceTry: number;
}

export interface Enrollment {
  id: ID;
  courseId: ID;
  userId: ID;
  sessionId: ID | null;
  status: EnrollmentStatus;
  completedLessonIds: ID[];
  progress: number;
  quizScores: Record<ID, number>;
  enrolledAt: ISODate;
  completedAt: ISODate | null;
}

export interface Certificate {
  id: ID;
  userId: ID;
  courseId: ID;
  code: string;
  issuedAt: ISODate;
  expiresAt: ISODate | null;
  holderName: string;
}

export interface CourseWithInstructor extends Course {
  instructor: User | null;
  enrollment: Enrollment | null;
  nextSession: CourseSession | null;
}

export interface CourseReview {
  id: ID;
  courseId: ID;
  authorId: ID;
  rating: number;
  text: string;
  createdAt: ISODate;
}

export interface CourseFilter {
  query?: string;
  category?: CourseCategory | null;
  format?: CourseFormat | null;
  level?: CourseLevel | null;
  adventureType?: AdventureType | null;
}
