import type {
  AdventureType,
  BookingWithParties,
  BusinessFilter,
  BusinessWithOwner,
  CreateStayInput,
  CreateStoryInput,
  EmergencyCenterWithDistance,
  EmergencyContact,
  LibraryFilter,
  LibraryPlaceWithDistance,
  LocationShare,
  LocationShareWithUser,
  Plan,
  PlaceKind,
  RegisterBusinessInput,
  SosEvent,
  StartShareInput,
  StayBookingWithBusiness,
  Story,
  StoryGroup,
  CommentWithAuthor,
  CreateBookingInput,
  CreateListingInput,
  CreateMatchInput,
  CreatePostInput,
  FeedPost,
  GeoPoint,
  ISODate,
  HazardZoneWithReporter,
  ID,
  InstructorFilter,
  InstructorReviewWithAuthor,
  InstructorWithUser,
  ListingFilter,
  ListingWithSeller,
  LiveStreamWithHost,
  MatchCandidate,
  Message,
  NotificationWithSender,
  ReportHazardInput,
  Route,
  SignInInput,
  SignUpInput,
  RequestOtpInput,
  VerifyOtpInput,
  OtpChallenge,
  OtpVerification,
  CompleteProfileInput,
  StartStreamInput,
  StreamMessageWithAuthor,
  TrendingLocation,
  User,
  ZMatchWithUsers,
  AiContext,
  AiThread,
  AiThreadWithMessages,
  AiMessage,
  TripPlan,
  TrailGraph,
  PlannedRoute,
  SavedRoute,
  MapPack,
  RouteProfile,
  Crag,
  CragWithDistance,
  CragSector,
  ClimbingRoute,
  AscentWithUser,
  LogAscentInput,
  SubmitRouteInput,
  ClimbingFilter,
  SatDevice,
  SatMessage,
  SosSession,
  LinkStatus,
  PairDeviceInput,
  SendSatMessageInput,
  StayUnit,
  Availability,
  Quote,
  QuoteInput,
  BookingWithPayment,
  RefundPreview,
  StayReviewWithAuthor,
  HostProfile,
  UnitBlock,
  Club,
  ClubWithMembership,
  ClubEventWithClub,
  ClubFilter,
  CreateClubEventInput,
  StudentVerification,
  FunSummary,
  BadgeWithStatus,
  ChallengeWithProgress,
  LeaderboardEntry,
  LeaderboardScope,
  QuizQuestion,
  QuizResult,
  PassportStamp,
  RouletteSuggestion,
  XpEvent,
  Destination,
  DestinationWithDistance,
  DestinationFilter,
  DestinationStage,
  AmsCheck,
  ReturnPlan,
  CreateReturnPlanInput,
  VisionRequest,
  VisionAdvice,
  VisionHistoryItem,
  CreateStatusPostInput,
  ReactionType,
  Collection,
  HashtagSummary,
  SocialFilter,
  Group,
  GroupWithMembership,
  GroupMessageWithSender,
  CreateGroupInput,
  SendGroupMessageInput,
  GroupFilter,
  GroupRole,
  Course,
  CourseWithInstructor,
  CourseFilter,
  Lesson,
  CourseSession,
  Enrollment,
  Certificate,
  CourseReview,
  Track,
  TrackWithUser,
  TrackPoi,
  TrackPoiWithDistance,
  CommunityTrail,
  CommunityTrailWithDetails,
  NavigationStep,
  SaveTrackInput,
  TrackFilter,
  WeatherForecast,
  AvalancheBulletin,
  CountryGuide,
  CountryChecklist,
  WriterProfile,
  WriterWithUser,
  Article,
  ArticleWithAuthor,
  ArticleComment,
  CreateArticleInput,
  ArticleFilter,
  Species,
  SpeciesFilter,
  SpeciesIdentification,
  WildlifeQuestion,
  WildlifeQuestionWithDetails,
  WildlifeAnswer,
  DeterrentProfile,
  DeterrentEvent,
  DeterrentAnimal,
  DeterrentSound,
  DoctorWithUser,
  DoctorSpecialty,
  Consultation,
  ConsultationWithDetails,
  ConsultMessage,
  RequestConsultInput,
  TvChannel,
  TvProgramWithChannel,
  TvSchedule,
  NewsItem,
  TvFilter,
  HeritageSiteWithDistance,
  AudioGuideStop,
  HeritageTour,
  HeritageFilter,
  KidPlaceWithDistance,
  KidPlaceFilter,
  HuntTask,
  HuntProgress,
  FamilyChecklistItem,
  ChildProfile,
  KidAgeBand,
} from '@/domain';

/**
 * Veri katmanı sözleşmeleri.
 * UI yalnızca bu arayüzlere bağımlıdır; mock ya da gerçek API aynı sözleşmeyi uygular.
 */

export interface AuthRepository {
  getSession(): Promise<User | null>;
  /** Geliştirme/demo girişi (e-posta + şifre). Üretimde telefon akışı esastır. */
  signIn(input: SignInInput): Promise<User>;
  signUp(input: SignUpInput): Promise<User>;
  signOut(): Promise<void>;
}

/**
 * Telefon + SMS doğrulama (OTP) yüzeyi.
 *
 * `AuthRepository`'den ayrı bir arayüzdir: e-posta/şifre uygulaması ile telefon
 * uygulaması farklı dosyalarda yaşar (uzak sağlayıcıda `repos/core.ts` ve
 * `repos/auth.ts`), sağlayıcı ikisini birleştirir. Ekranlar ikisini tek nesne
 * olarak görür (`AuthApi`).
 */
export interface PhoneAuthRepository {
  /**
   * Telefona SMS doğrulama kodu ister.
   *
   * Hız sınırı (`domain/phone.ts`) burada uygulanır: bekleme süresi dolmadan
   * ya da saatlik kota aşıldığında `OtpError` fırlatılır. Mock sağlayıcıda
   * üretilen kod `devCode` alanında döner ve konsola yazılır; uzak sağlayıcıda
   * `devCode` her zaman `null`'dır.
   */
  requestOtp(input: RequestOtpInput): Promise<OtpChallenge>;

  /**
   * Kodu doğrular ve oturumu açar.
   *
   * Numara ilk kez doğrulanıyorsa `needsProfile: true` döner ve `user` boştur;
   * kayıt `completeProfile` ile tamamlanır.
   */
  verifyOtp(input: VerifyOtpInput): Promise<OtpVerification>;

  /** Doğrulanmış numara için görünen ad + kullanıcı adı yazar, kaydı tamamlar. */
  completeProfile(input: CompleteProfileInput): Promise<User>;

  /** Kullanıcı adı benzersizlik kontrolü (kayıt tamamlama adımında canlı). */
  isUsernameAvailable(username: string): Promise<boolean>;
}

/** Ekranların gördüğü tam kimlik yüzeyi: e-posta/şifre + telefon OTP. */
export type AuthApi = AuthRepository & PhoneAuthRepository;

export interface UserRepository {
  getById(id: ID): Promise<User | null>;
  search(query: string): Promise<User[]>;
  isFollowing(followerId: ID, followingId: ID): Promise<boolean>;
  toggleFollow(followerId: ID, followingId: ID): Promise<{ following: boolean }>;
  updateProfile(
    id: ID,
    patch: Partial<Pick<User, 'displayName' | 'bio' | 'locationName' | 'favoriteTypes'>>,
  ): Promise<User>;
}

/**
 * Akış sayfa boyu — **her iki sağlayıcı da bunu kullanır.**
 *
 * Mock ve remote'da ayrı ayrı yazılırsa biri değişip diğeri kalabilir; o zaman
 * "son sayfa mı" kararı (dönen kayıt sayısı < sayfa boyu) sessizce yanlış olur
 * ve sonsuz kaydırma ya erken durur ya hiç durmaz.
 */
export const FEED_PAGE_SIZE = 40;

export interface FeedPage {
  posts: FeedPost[];
  /** Sonraki sayfanın kürsörü; `null` ise son sayfa. */
  nextCursor: ISODate | null;
}

export interface FeedFilter {
  adventureType?: AdventureType | null;
  authorId?: ID;
  locationName?: string;
  /**
   * Kürsör: bu `createdAt` değerinden **eski** gönderiler. Ofset yerine kürsör
   * çünkü akışa sürekli yeni gönderi ekleniyor; ofsetli sayfalamada araya giren
   * bir gönderi sonraki sayfayı kaydırır ve kullanıcı aynı kaydı iki kez görür.
   */
  before?: ISODate | null;
  /** Sayfa boyu. Verilmezse veri katmanının varsayılanı uygulanır. */
  limit?: number;
}

export interface FeedRepository {
  list(viewerId: ID, filter?: FeedFilter): Promise<FeedPost[]>;
  getById(viewerId: ID, postId: ID): Promise<FeedPost | null>;
  create(authorId: ID, input: CreatePostInput): Promise<FeedPost>;
  toggleLike(viewerId: ID, postId: ID): Promise<{ liked: boolean; likesCount: number }>;
  listComments(postId: ID): Promise<CommentWithAuthor[]>;
  addComment(authorId: ID, postId: ID, content: string): Promise<CommentWithAuthor>;
  getRoute(routeId: ID): Promise<Route | null>;
}

export interface ExploreRepository {
  trendingLocations(): Promise<TrendingLocation[]>;
  getLocation(id: ID): Promise<TrendingLocation | null>;
  popularRoutes(): Promise<Route[]>;
  search(query: string): Promise<{ locations: TrendingLocation[]; users: User[]; routes: Route[] }>;
}

export interface MatchRepository {
  candidates(
    meId: ID,
    origin: GeoPoint,
    radiusKm: number,
    type?: AdventureType | null,
  ): Promise<MatchCandidate[]>;
  listMine(meId: ID): Promise<ZMatchWithUsers[]>;
  getById(id: ID): Promise<ZMatchWithUsers | null>;
  request(meId: ID, input: CreateMatchInput): Promise<ZMatchWithUsers>;
  respond(meId: ID, matchId: ID, accept: boolean): Promise<ZMatchWithUsers>;
}

export interface NotificationRepository {
  list(meId: ID): Promise<NotificationWithSender[]>;
  unreadCount(meId: ID): Promise<number>;
  markRead(meId: ID, id: ID): Promise<void>;
  markAllRead(meId: ID): Promise<void>;
  /**
   * Cihazın anlık bildirim (push) adresini kaydeder.
   *
   * Dağıtım (`supabase/functions/push-fanout`) bu listeyi okur; yazılmazsa
   * uygulama kapalıyken hiçbir uyarı kullanıcıya ulaşmaz. Aynı token birden
   * çok kez kaydedilebilir — yinelenen ayıklanır.
   */
  registerPushToken(meId: ID, token: string): Promise<void>;
  /** Çıkışta ya da cihaz devredilirken adresi düşürür. */
  unregisterPushToken(meId: ID, token: string): Promise<void>;
}

export interface MessageRepository {
  thread(meId: ID, otherId: ID): Promise<Message[]>;
  send(meId: ID, otherId: ID, content: string, matchId?: ID | null): Promise<Message>;
}

export interface HazardRepository {
  /** Aktif tehlikeler; origin verilirse mesafe hesaplanır ve radiusKm ile süzülür */
  list(
    meId: ID,
    origin: GeoPoint | null,
    radiusKm?: number,
    includeResolved?: boolean,
  ): Promise<HazardZoneWithReporter[]>;
  getById(meId: ID, id: ID, origin: GeoPoint | null): Promise<HazardZoneWithReporter | null>;
  report(meId: ID, input: ReportHazardInput): Promise<HazardZoneWithReporter>;
  confirm(meId: ID, id: ID): Promise<HazardZoneWithReporter>;
  resolve(meId: ID, id: ID): Promise<HazardZoneWithReporter>;
}

export interface LiveRepository {
  list(): Promise<LiveStreamWithHost[]>;
  getById(id: ID): Promise<LiveStreamWithHost | null>;
  messages(streamId: ID): Promise<StreamMessageWithAuthor[]>;
  sendMessage(meId: ID, streamId: ID, content: string): Promise<StreamMessageWithAuthor>;
  start(meId: ID, input: StartStreamInput): Promise<LiveStreamWithHost>;
  end(meId: ID, streamId: ID): Promise<LiveStreamWithHost>;
  like(streamId: ID): Promise<{ likesCount: number }>;
  /** İzleyici katıldı/ayrıldı sayacı (demo) */
  join(streamId: ID): Promise<void>;
  leave(streamId: ID): Promise<void>;
}

export interface MarketRepository {
  list(viewerId: ID, filter?: ListingFilter): Promise<ListingWithSeller[]>;
  getById(viewerId: ID, id: ID): Promise<ListingWithSeller | null>;
  create(sellerId: ID, input: CreateListingInput): Promise<ListingWithSeller>;
  toggleFavorite(viewerId: ID, id: ID): Promise<{ favorited: boolean; favoritesCount: number }>;
  markSold(sellerId: ID, id: ID): Promise<ListingWithSeller>;
}

export interface InstructorRepository {
  list(origin: GeoPoint | null, filter?: InstructorFilter): Promise<InstructorWithUser[]>;
  getById(id: ID, origin: GeoPoint | null): Promise<InstructorWithUser | null>;
  getByUserId(userId: ID): Promise<InstructorWithUser | null>;
  reviews(instructorId: ID): Promise<InstructorReviewWithAuthor[]>;
  book(meId: ID, input: CreateBookingInput): Promise<BookingWithParties>;
  myBookings(meId: ID): Promise<BookingWithParties[]>;
  respondBooking(meId: ID, bookingId: ID, accept: boolean): Promise<BookingWithParties>;
}

export interface LibraryRepository {
  search(filter: LibraryFilter): Promise<LibraryPlaceWithDistance[]>;
  getById(id: ID, origin: GeoPoint | null): Promise<LibraryPlaceWithDistance | null>;
  nearby(
    origin: GeoPoint,
    radiusKm: number,
    kind?: PlaceKind | null,
    limit?: number,
  ): Promise<LibraryPlaceWithDistance[]>;
  countries(): Promise<{ countryCode: string; count: number }[]>;
}

export interface PresenceRepository {
  /** Bana görünür paylaşımlar */
  list(meId: ID, origin: GeoPoint | null): Promise<LocationShareWithUser[]>;
  mine(meId: ID): Promise<LocationShare | null>;
  start(meId: ID, input: StartShareInput): Promise<LocationShare>;
  update(
    meId: ID,
    coords: GeoPoint,
    extra?: Partial<Pick<LocationShare, 'batteryPct' | 'altitudeM' | 'speedKmh'>>,
  ): Promise<LocationShare | null>;
  stop(meId: ID): Promise<void>;
}

export interface StoryRepository {
  groups(meId: ID): Promise<StoryGroup[]>;
  create(meId: ID, input: CreateStoryInput): Promise<Story>;
  markSeen(meId: ID, storyId: ID): Promise<void>;
}

export interface BusinessRepository {
  list(filter: BusinessFilter): Promise<BusinessWithOwner[]>;
  getById(id: ID, origin: GeoPoint | null): Promise<BusinessWithOwner | null>;
  register(meId: ID, input: RegisterBusinessInput): Promise<BusinessWithOwner>;
  reserve(meId: ID, input: CreateStayInput): Promise<StayBookingWithBusiness>;
  myStays(meId: ID): Promise<StayBookingWithBusiness[]>;
}

export interface BillingRepository {
  currentPlan(meId: ID): Promise<Plan>;
  subscribe(meId: ID, plan: Plan, period: 'monthly' | 'yearly'): Promise<User>;
  /** Eğitmen/işletme için brüt-net özet */
  earnings(
    meId: ID,
  ): Promise<{ grossTry: number; commissionTry: number; netTry: number; bookings: number }>;
}

export interface EmergencyRepository {
  centers(origin: GeoPoint, limit?: number): Promise<EmergencyCenterWithDistance[]>;
  triggerSos(meId: ID, coords: GeoPoint): Promise<SosEvent>;
  activeSos(meId: ID): Promise<SosEvent | null>;
  resolveSos(meId: ID): Promise<void>;
  updateContacts(meId: ID, contacts: EmergencyContact[]): Promise<User>;
}

/* ------------------------------------------------------------------ */
/* v1.2 — Yeni modüller                                                 */
/* ------------------------------------------------------------------ */

export interface AiRepository {
  threads(meId: ID): Promise<AiThread[]>;
  thread(meId: ID, threadId: ID): Promise<AiThreadWithMessages | null>;
  /** Yeni ileti gönderir; yanıt (assistant) mesajını döner. threadId null → yeni sohbet */
  send(meId: ID, threadId: ID | null, content: string, ctx: AiContext): Promise<AiMessage>;
  planTrip(meId: ID, prompt: string, ctx: AiContext): Promise<TripPlan>;
  deleteThread(meId: ID, threadId: ID): Promise<void>;
}

export interface MapsRepository {
  packs(): Promise<MapPack[]>;
  download(packId: ID): Promise<MapPack>;
  remove(packId: ID): Promise<MapPack>;
  graph(regionId: ID): Promise<TrailGraph>;
  regions(): Promise<{ id: ID; name: string; countryCode: string; center: GeoPoint }[]>;
  plan(regionId: ID, fromNodeId: ID, toNodeId: ID, profile: RouteProfile): Promise<PlannedRoute>;
  savedRoutes(meId: ID): Promise<SavedRoute[]>;
  saveRoute(
    meId: ID,
    input: { regionId: ID; name: string; routeProfile: RouteProfile; planned: PlannedRoute },
  ): Promise<SavedRoute>;
  deleteRoute(meId: ID, routeId: ID): Promise<void>;
}

export interface ClimbingRepository {
  crags(filter: ClimbingFilter): Promise<CragWithDistance[]>;
  crag(id: ID, origin: GeoPoint | null): Promise<CragWithDistance | null>;
  sectors(cragId: ID): Promise<CragSector[]>;
  routes(cragId: ID, sectorId?: ID | null): Promise<ClimbingRoute[]>;
  /** `meId` verilirse `confirmedByMe` doldurulur (onay durumu sunucuda tutulur). */
  route(
    id: ID,
    meId?: ID,
  ): Promise<(ClimbingRoute & { crag: Crag; sector: CragSector; confirmedByMe: boolean }) | null>;
  ascents(routeId: ID): Promise<AscentWithUser[]>;
  myAscents(meId: ID): Promise<(AscentWithUser & { route: ClimbingRoute; crag: Crag })[]>;
  logAscent(meId: ID, input: LogAscentInput): Promise<AscentWithUser>;
  submitRoute(meId: ID, input: SubmitRouteInput): Promise<ClimbingRoute>;
  confirmRoute(meId: ID, routeId: ID): Promise<ClimbingRoute>;
}

export interface SatelliteRepository {
  devices(meId: ID): Promise<SatDevice[]>;
  pair(meId: ID, input: PairDeviceInput): Promise<SatDevice>;
  unpair(meId: ID, deviceId: ID): Promise<void>;
  linkStatus(meId: ID): Promise<LinkStatus>;
  /** Simülasyon: hücresel/uydu/none arasında geçiş */
  setLink(meId: ID, link: LinkStatus['link']): Promise<LinkStatus>;
  messages(meId: ID): Promise<SatMessage[]>;
  send(meId: ID, input: SendSatMessageInput): Promise<SatMessage>;
  /** Kuyruktaki mesajları göndermeyi dener */
  flush(meId: ID): Promise<SatMessage[]>;
  sos(meId: ID): Promise<SosSession | null>;
  startSos(meId: ID, coords: GeoPoint): Promise<SosSession>;
  advanceSos(meId: ID): Promise<SosSession>;
  cancelSos(meId: ID): Promise<void>;
}

export interface InventoryRepository {
  units(businessId: ID): Promise<StayUnit[]>;
  availability(unitId: ID, from: ISODate, to: ISODate): Promise<Availability[]>;
  quote(input: QuoteInput): Promise<Quote>;
  book(meId: ID, input: QuoteInput): Promise<BookingWithPayment>;
  booking(meId: ID, bookingId: ID): Promise<BookingWithPayment | null>;
  myBookings(meId: ID): Promise<BookingWithPayment[]>;
  refundPreview(meId: ID, bookingId: ID): Promise<RefundPreview>;
  cancel(meId: ID, bookingId: ID): Promise<BookingWithPayment>;
  checkIn(meId: ID, bookingId: ID): Promise<BookingWithPayment>;
  reviews(businessId: ID): Promise<StayReviewWithAuthor[]>;
  review(meId: ID, bookingId: ID, rating: number, text: string): Promise<StayReviewWithAuthor>;
  host(meId: ID, businessId: ID): Promise<HostProfile>;
  hostBookings(meId: ID, businessId: ID): Promise<BookingWithPayment[]>;
  blockDates(meId: ID, unitId: ID, from: ISODate, to: ISODate): Promise<UnitBlock>;
  upsertUnit(meId: ID, unit: Omit<StayUnit, 'id'> & { id?: ID }): Promise<StayUnit>;
  verifyHost(meId: ID, businessId: ID, level: HostProfile['verification']): Promise<HostProfile>;
}

export interface ClubRepository {
  list(meId: ID, filter: ClubFilter): Promise<ClubWithMembership[]>;
  getById(meId: ID, id: ID): Promise<ClubWithMembership | null>;
  members(clubId: ID): Promise<(User & { role: ClubWithMembership['role'] })[]>;
  join(meId: ID, clubId: ID): Promise<ClubWithMembership>;
  leave(meId: ID, clubId: ID): Promise<ClubWithMembership>;
  events(meId: ID, clubId?: ID | null): Promise<ClubEventWithClub[]>;
  event(meId: ID, eventId: ID): Promise<ClubEventWithClub | null>;
  rsvp(meId: ID, eventId: ID): Promise<ClubEventWithClub>;
  createEvent(meId: ID, input: CreateClubEventInput): Promise<ClubEventWithClub>;
  ranking(): Promise<Club[]>;
  studentVerification(meId: ID): Promise<StudentVerification | null>;
  verifyStudent(meId: ID, email: string): Promise<StudentVerification>;
  myClubs(meId: ID): Promise<ClubWithMembership[]>;
}

export interface FunRepository {
  summary(meId: ID): Promise<FunSummary>;
  badges(meId: ID): Promise<BadgeWithStatus[]>;
  challenges(meId: ID): Promise<ChallengeWithProgress[]>;
  joinChallenge(meId: ID, challengeId: ID): Promise<ChallengeWithProgress>;
  leaderboard(meId: ID, scope: LeaderboardScope): Promise<LeaderboardEntry[]>;
  quiz(meId: ID, count?: number): Promise<QuizQuestion[]>;
  submitQuiz(meId: ID, answers: { questionId: ID; answerIndex: number }[]): Promise<QuizResult>;
  stamps(meId: ID): Promise<PassportStamp[]>;
  roulette(meId: ID, origin: GeoPoint | null): Promise<RouletteSuggestion>;
  xpHistory(meId: ID): Promise<XpEvent[]>;
}

/* ------------------------------------------------------------------ */
/* v1.3 — Yeni modüller                                                 */
/* ------------------------------------------------------------------ */

export interface DestinationRepository {
  list(meId: ID, filter: DestinationFilter): Promise<DestinationWithDistance[]>;
  getById(meId: ID, id: ID, origin: GeoPoint | null): Promise<DestinationWithDistance | null>;
  stages(destinationId: ID): Promise<DestinationStage[]>;
  toggleSave(meId: ID, destinationId: ID): Promise<{ saved: boolean }>;
  saved(meId: ID): Promise<Destination[]>;
  amsChecks(meId: ID): Promise<AmsCheck[]>;
  logAms(
    meId: ID,
    input: Omit<AmsCheck, 'id' | 'userId' | 'score' | 'severity' | 'createdAt'>,
  ): Promise<AmsCheck>;
  returnPlans(meId: ID): Promise<ReturnPlan[]>;
  createReturnPlan(meId: ID, input: CreateReturnPlanInput): Promise<ReturnPlan>;
  /** Dönüş bildir → returned */
  markReturned(meId: ID, planId: ID): Promise<ReturnPlan>;
  cancelReturnPlan(meId: ID, planId: ID): Promise<void>;
  /** Süresi geçenleri overdue yapar ve acil kişilere bildirim gönderir; güncellenenleri döner */
  checkOverdue(meId: ID, now: ISODate): Promise<ReturnPlan[]>;
}

export interface VisionRepository {
  analyze(meId: ID, input: VisionRequest): Promise<VisionAdvice>;
  history(meId: ID): Promise<VisionHistoryItem[]>;
  clearHistory(meId: ID): Promise<void>;
}

export interface SocialRepository {
  feed(meId: ID, filter: SocialFilter): Promise<FeedPost[]>;
  /**
   * Sayfalı akış — sonsuz kaydırma bunu kullanır.
   *
   * Neden ayrı bir metot ve neden `nextCursor` sunucudan geliyor: domain
   * süzgeci ("takip", "maceralar", hashtag) sayfayı **kısaltabilir**. Kürsörü
   * ve "daha var mı" kararını süzülmüş listeden çıkarmak, sayfa küçüldüğünde
   * kaydırmayı erken durdurur ve kullanıcı eski gönderileri hiç göremez.
   * Karar bu yüzden **ham** okuma sayısına dayanıyor ve repository'de veriliyor.
   */
  feedPage(meId: ID, filter: SocialFilter): Promise<FeedPage>;
  createStatus(meId: ID, input: CreateStatusPostInput): Promise<FeedPost>;
  react(meId: ID, postId: ID, type: ReactionType | null): Promise<FeedPost>;
  toggleSave(meId: ID, postId: ID, collectionId?: ID | null): Promise<FeedPost>;
  repost(meId: ID, postId: ID, caption: string): Promise<FeedPost>;
  collections(meId: ID): Promise<Collection[]>;
  createCollection(meId: ID, name: string): Promise<Collection>;
  savedPosts(meId: ID, collectionId?: ID | null): Promise<FeedPost[]>;
  hashtags(limit?: number): Promise<HashtagSummary[]>;
  byHashtag(meId: ID, tag: string): Promise<FeedPost[]>;
  searchUsers(query: string): Promise<User[]>;
  deletePost(meId: ID, postId: ID): Promise<void>;
}

export interface GroupRepository {
  list(meId: ID, filter: GroupFilter): Promise<GroupWithMembership[]>;
  getById(meId: ID, groupId: ID): Promise<GroupWithMembership | null>;
  create(meId: ID, input: CreateGroupInput): Promise<GroupWithMembership>;
  join(meId: ID, groupId: ID): Promise<GroupWithMembership>;
  joinByCode(meId: ID, code: string): Promise<GroupWithMembership>;
  leave(meId: ID, groupId: ID): Promise<void>;
  members(groupId: ID): Promise<(User & { role: GroupRole; joinedAt: ISODate })[]>;
  setRole(meId: ID, groupId: ID, userId: ID, role: GroupRole): Promise<void>;
  messages(
    meId: ID,
    groupId: ID,
    before?: ISODate | null,
    limit?: number,
  ): Promise<GroupMessageWithSender[]>;
  send(meId: ID, groupId: ID, input: SendGroupMessageInput): Promise<GroupMessageWithSender>;
  vote(meId: ID, groupId: ID, messageId: ID, optionIds: ID[]): Promise<GroupMessageWithSender>;
  pin(meId: ID, groupId: ID, messageId: ID | null): Promise<Group>;
  markRead(meId: ID, groupId: ID): Promise<void>;
  toggleMute(meId: ID, groupId: ID): Promise<boolean>;
  invite(meId: ID, groupId: ID, userId: ID): Promise<void>;
}

export interface CourseRepository {
  list(meId: ID, filter: CourseFilter): Promise<CourseWithInstructor[]>;
  getById(meId: ID, id: ID): Promise<CourseWithInstructor | null>;
  lessons(courseId: ID): Promise<Lesson[]>;
  /** Derin bağlantı için: yalnızca ders kimliğinden dersi çözer. */
  lessonById(id: ID): Promise<Lesson | null>;
  sessions(courseId: ID): Promise<CourseSession[]>;
  enroll(meId: ID, courseId: ID, sessionId?: ID | null): Promise<Enrollment>;
  completeLesson(
    meId: ID,
    courseId: ID,
    lessonId: ID,
    quizScore?: number | null,
  ): Promise<Enrollment>;
  myCourses(meId: ID): Promise<CourseWithInstructor[]>;
  certificates(meId: ID): Promise<(Certificate & { course: Course })[]>;
  reviews(courseId: ID): Promise<(CourseReview & { author: User })[]>;
  review(meId: ID, courseId: ID, rating: number, text: string): Promise<CourseReview>;
  /** Eğitmen (Pro Guide) kendi kursunu ekler */
  createCourse(
    meId: ID,
    input: Omit<
      Course,
      'id' | 'slug' | 'rating' | 'reviewCount' | 'enrolledCount' | 'createdAt' | 'lessonCount'
    >,
    lessons: Omit<Lesson, 'id' | 'courseId'>[],
  ): Promise<CourseWithInstructor>;
}

/* ------------------------------------------------------------------ */
/* v1.4 — Topluluk rotaları, navigasyon, açık veri                     */
/* ------------------------------------------------------------------ */

export interface TrackRepository {
  list(meId: ID, filter: TrackFilter): Promise<TrackWithUser[]>;
  getById(meId: ID, id: ID): Promise<(TrackWithUser & { pois: TrackPoi[] }) | null>;
  save(meId: ID, input: SaveTrackInput): Promise<TrackWithUser>;
  importGpx(
    meId: ID,
    gpxXml: string,
    source: Track['source'],
    name?: string | null,
  ): Promise<TrackWithUser>;
  publish(meId: ID, trackId: ID): Promise<TrackWithUser>;
  remove(meId: ID, trackId: ID): Promise<void>;
  communityTrails(
    meId: ID,
    origin: GeoPoint | null,
    radiusKm?: number | null,
  ): Promise<CommunityTrailWithDetails[]>;
  communityTrail(meId: ID, id: ID): Promise<CommunityTrailWithDetails | null>;
  /** Kullanıcı bu rotayı yürüyüp doğruladı */
  verifyTrail(meId: ID, id: ID): Promise<CommunityTrailWithDetails>;
  /** Yayınlanan parçalardan topluluk rotalarını (yeniden) türetir */
  rebuildCommunityTrails(): Promise<CommunityTrail[]>;
  poisNear(
    meId: ID,
    origin: GeoPoint,
    radiusKm: number,
    kind?: TrackPoi['kind'] | null,
  ): Promise<TrackPoiWithDistance[]>;
  addPoi(
    meId: ID,
    input: Omit<TrackPoi, 'id' | 'userId' | 'confirmations' | 'createdAt'>,
  ): Promise<TrackPoi>;
  confirmPoi(meId: ID, poiId: ID): Promise<TrackPoiWithDistance>;
  /** An/yayın/gönderi konumlarından önerilen POI'ler (henüz kaydedilmemiş) */
  suggestedPoisFromMedia(meId: ID, origin: GeoPoint | null): Promise<TrackPoi[]>;
  navigation(id: ID, kind: 'track' | 'community'): Promise<NavigationStep[]>;
  /** Topluluk rotasını planlayıcının kullandığı graf biçimine çevirir */
  toGraph(id: ID): Promise<TrailGraph>;
}

export interface WeatherRepository {
  forecast(coords: GeoPoint, elevationM?: number | null): Promise<WeatherForecast>;
  elevation(points: GeoPoint[]): Promise<(number | null)[]>;
  avalanche(coords: GeoPoint): Promise<AvalancheBulletin | null>;
}

/* ------------------------------------------------------------------ */
/* v1.5 — Ülke rehberi, yazarlar, canlı tanımlama, tele-tıp            */
/* ------------------------------------------------------------------ */

export interface CountryRepository {
  list(query?: string | null): Promise<CountryGuide[]>;
  getByCode(code: string): Promise<CountryGuide | null>;
  checklist(meId: ID, code: string): Promise<CountryChecklist>;
  toggleDocument(meId: ID, code: string, key: string): Promise<CountryChecklist>;
  setTripDate(meId: ID, code: string, date: ISODate | null): Promise<CountryChecklist>;
}

export interface ArticleRepository {
  list(meId: ID, filter: ArticleFilter): Promise<ArticleWithAuthor[]>;
  getBySlug(meId: ID, slug: string): Promise<ArticleWithAuthor | null>;
  writers(meId: ID, query?: string | null): Promise<WriterWithUser[]>;
  writer(meId: ID, userId: ID): Promise<WriterWithUser | null>;
  myWriterProfile(meId: ID): Promise<WriterProfile | null>;
  applyWriter(
    meId: ID,
    input: Pick<WriterProfile, 'penName' | 'bio' | 'languages' | 'topics' | 'website'>,
  ): Promise<WriterProfile>;
  create(meId: ID, input: CreateArticleInput): Promise<ArticleWithAuthor>;
  update(meId: ID, articleId: ID, input: Partial<CreateArticleInput>): Promise<ArticleWithAuthor>;
  toggleLike(meId: ID, articleId: ID): Promise<ArticleWithAuthor>;
  toggleSave(meId: ID, articleId: ID): Promise<ArticleWithAuthor>;
  toggleFollowWriter(meId: ID, userId: ID): Promise<WriterWithUser>;
  comments(articleId: ID): Promise<(ArticleComment & { author: User })[]>;
  addComment(meId: ID, articleId: ID, content: string): Promise<ArticleComment & { author: User }>;
  saved(meId: ID): Promise<ArticleWithAuthor[]>;
  mine(meId: ID): Promise<Article[]>;
}

export interface WildlifeRepository {
  species(filter: SpeciesFilter): Promise<Species[]>;
  speciesById(id: ID): Promise<Species | null>;
  identify(
    meId: ID,
    input: {
      imageUri: string | null;
      imageBase64: string | null;
      description: string;
      coords: GeoPoint | null;
      locale: string;
    },
  ): Promise<SpeciesIdentification>;
  identifications(meId: ID): Promise<SpeciesIdentification[]>;
  questions(
    meId: ID,
    filter?: {
      status?: WildlifeQuestion['status'] | null;
      urgentOnly?: boolean;
      mineOnly?: boolean;
    },
  ): Promise<WildlifeQuestionWithDetails[]>;
  question(meId: ID, id: ID): Promise<WildlifeQuestionWithDetails | null>;
  ask(
    meId: ID,
    input: Omit<
      WildlifeQuestion,
      'id' | 'authorId' | 'status' | 'answersCount' | 'acceptedAnswerId' | 'createdAt'
    >,
  ): Promise<WildlifeQuestionWithDetails>;
  answer(
    meId: ID,
    questionId: ID,
    body: string,
    speciesId?: ID | null,
  ): Promise<WildlifeQuestionWithDetails>;
  upvote(meId: ID, answerId: ID): Promise<WildlifeAnswer>;
  accept(meId: ID, questionId: ID, answerId: ID): Promise<WildlifeQuestionWithDetails>;
  deterrents(): Promise<DeterrentProfile[]>;
  deterrent(animal: DeterrentAnimal): Promise<DeterrentProfile>;
  logDeterrent(
    meId: ID,
    animal: DeterrentAnimal,
    sound: DeterrentSound,
    coords: GeoPoint | null,
    durationS: number,
  ): Promise<DeterrentEvent>;
  /** Çevrimiçi ve soru yanıtlayabilecek kullanıcı sayısı (mock presence) */
  onlineHelpers(): Promise<{ count: number; experts: User[] }>;
}

export interface TelemedRepository {
  doctors(specialty?: DoctorSpecialty | null, onlineOnly?: boolean): Promise<DoctorWithUser[]>;
  doctor(id: ID): Promise<DoctorWithUser | null>;
  request(meId: ID, input: RequestConsultInput): Promise<ConsultationWithDetails>;
  consultation(meId: ID, id: ID): Promise<ConsultationWithDetails | null>;
  myConsultations(meId: ID): Promise<ConsultationWithDetails[]>;
  send(
    meId: ID,
    consultationId: ID,
    content: string,
    imageUri?: string | null,
  ): Promise<ConsultMessage & { sender: User }>;
  end(meId: ID, consultationId: ID, summary?: string | null): Promise<ConsultationWithDetails>;
  cancel(meId: ID, consultationId: ID): Promise<void>;
  /** Doktor tarafı (demo): bekleyen talepleri kabul */
  accept(doctorUserId: ID, consultationId: ID): Promise<ConsultationWithDetails>;
  /** AI ön triyaj: şikâyetten aciliyet + adımlar (yerel kural tabanlı; gateway varsa uzaktan) */
  triage(input: { complaint: string; speciesId?: ID | null; locale: string }): Promise<{
    urgency: Consultation['urgency'];
    steps: string[];
    firstAidSlug: string | null;
    callEmergency: boolean;
    /**
     * Sonucun gerçekte nereden geldiği. Ağ geçidi tanımlı olsa bile istek
     * başarısız olursa yerele düşülür; arayüz bu alana bakmalı, ortam
     * değişkenine değil (tıbbi bağlamda yanlış "yapay zekâ" iddiası olmasın).
     */
    source: 'local' | 'remote';
  }>;
}

/* ------------------------------------------------------------------ */
/* v1.6 — Zirtan TV, tarihi alanlar, çocuk modülü                      */
/* ------------------------------------------------------------------ */

export interface TvRepository {
  channels(): Promise<TvChannel[]>;
  programs(meId: ID, filter: TvFilter): Promise<TvProgramWithChannel[]>;
  program(meId: ID, id: ID): Promise<TvProgramWithChannel | null>;
  schedule(from: ISODate, to: ISODate): Promise<(TvSchedule & { channel: TvChannel })[]>;
  news(category?: NewsItem['category'] | null, countryCode?: string | null): Promise<NewsItem[]>;
  newsItem(id: ID): Promise<NewsItem | null>;
  saveProgress(meId: ID, programId: ID, positionSec: number, durationSec: number): Promise<void>;
  continueWatching(meId: ID): Promise<TvProgramWithChannel[]>;
  toggleWatchLater(meId: ID, programId: ID): Promise<boolean>;
  toggleLike(meId: ID, programId: ID): Promise<TvProgramWithChannel>;
  followChannel(meId: ID, channelId: ID): Promise<boolean>;
  /** Kullanıcı/kanal sahibi program yükler (demo: URL ile) */
  submitProgram(
    meId: ID,
    input: Omit<
      TvProgramWithChannel,
      | 'id'
      | 'channel'
      | 'progress'
      | 'watchLater'
      | 'likedByMe'
      | 'viewsCount'
      | 'likesCount'
      | 'publishedAt'
    >,
  ): Promise<TvProgramWithChannel>;
}

export interface HeritageRepository {
  list(meId: ID, filter: HeritageFilter): Promise<HeritageSiteWithDistance[]>;
  getById(meId: ID, id: ID, origin: GeoPoint | null): Promise<HeritageSiteWithDistance | null>;
  audioGuide(siteId: ID): Promise<AudioGuideStop[]>;
  toggleSave(meId: ID, siteId: ID): Promise<boolean>;
  markVisited(meId: ID, siteId: ID): Promise<boolean>;
  tours(meId: ID): Promise<HeritageTour[]>;
  createTour(
    meId: ID,
    input: Omit<HeritageTour, 'id' | 'userId' | 'createdAt'>,
  ): Promise<HeritageTour>;
  deleteTour(meId: ID, tourId: ID): Promise<void>;
  /** Yakındaki rota/destinasyon bağlantıları için */
  nearby(origin: GeoPoint, radiusKm: number): Promise<HeritageSiteWithDistance[]>;
}

export interface KidsRepository {
  places(meId: ID, filter: KidPlaceFilter): Promise<KidPlaceWithDistance[]>;
  place(meId: ID, id: ID, origin: GeoPoint | null): Promise<KidPlaceWithDistance | null>;
  toggleSave(meId: ID, placeId: ID): Promise<boolean>;
  children(meId: ID): Promise<ChildProfile[]>;
  addChild(meId: ID, name: string, ageBand: KidAgeBand, avatar: string): Promise<ChildProfile>;
  removeChild(meId: ID, childId: ID): Promise<void>;
  huntTasks(ageBand: KidAgeBand | null): Promise<HuntTask[]>;
  huntProgress(meId: ID, childName: string): Promise<HuntProgress>;
  completeTask(meId: ID, childName: string, taskId: ID): Promise<HuntProgress>;
  resetHunt(meId: ID, childName: string): Promise<HuntProgress>;
  checklist(ageBand: KidAgeBand | null): Promise<FamilyChecklistItem[]>;
}

export interface DataProvider {
  auth: AuthApi;
  users: UserRepository;
  feed: FeedRepository;
  explore: ExploreRepository;
  matches: MatchRepository;
  notifications: NotificationRepository;
  messages: MessageRepository;
  hazards: HazardRepository;
  live: LiveRepository;
  market: MarketRepository;
  instructors: InstructorRepository;
  library: LibraryRepository;
  presence: PresenceRepository;
  stories: StoryRepository;
  businesses: BusinessRepository;
  billing: BillingRepository;
  emergency: EmergencyRepository;
  ai: AiRepository;
  maps: MapsRepository;
  climbing: ClimbingRepository;
  satellite: SatelliteRepository;
  inventory: InventoryRepository;
  clubs: ClubRepository;
  fun: FunRepository;
  destinations: DestinationRepository;
  vision: VisionRepository;
  social: SocialRepository;
  groups: GroupRepository;
  courses: CourseRepository;
  tracks: TrackRepository;
  weather: WeatherRepository;
  countries: CountryRepository;
  articles: ArticleRepository;
  wildlife: WildlifeRepository;
  telemed: TelemedRepository;
  tv: TvRepository;
  heritage: HeritageRepository;
  kids: KidsRepository;
  /** Demo verilerini sıfırlar (yalnızca mock sağlayıcı için anlamlı) */
  reset(): Promise<void>;
}
