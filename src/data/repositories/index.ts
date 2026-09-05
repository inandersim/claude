import type {
  AdventureType,
  BookingWithParties,
  CommentWithAuthor,
  CreateBookingInput,
  CreateListingInput,
  CreateMatchInput,
  CreatePostInput,
  FeedPost,
  GeoPoint,
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
  /** Demo verilerini sıfırlar (yalnızca mock sağlayıcı için anlamlı) */
  reset(): Promise<void>;
}
