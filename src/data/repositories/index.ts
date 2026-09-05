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
} from '@/domain';

/**
 * Veri katmanı sözleşmeleri.
 * UI yalnızca bu arayüzlere bağımlıdır; mock ya da gerçek API aynı sözleşmeyi uygular.
 */

export interface AuthRepository {
  getSession(): Promise<User | null>;
  signIn(input: SignInInput): Promise<User>;
  signUp(input: SignUpInput): Promise<User>;
  signOut(): Promise<void>;
}

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

export interface FeedFilter {
  adventureType?: AdventureType | null;
  authorId?: ID;
  locationName?: string;
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
  route(id: ID): Promise<(ClimbingRoute & { crag: Crag; sector: CragSector }) | null>;
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

export interface DataProvider {
  auth: AuthRepository;
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
  /** Demo verilerini sıfırlar (yalnızca mock sağlayıcı için anlamlı) */
  reset(): Promise<void>;
}
