import type {
  AdventureType,
  CommentWithAuthor,
  CreateMatchInput,
  CreatePostInput,
  FeedPost,
  GeoPoint,
  ID,
  MatchCandidate,
  Message,
  NotificationWithSender,
  Route,
  SignInInput,
  SignUpInput,
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

export interface DataProvider {
  auth: AuthRepository;
  users: UserRepository;
  feed: FeedRepository;
  explore: ExploreRepository;
  matches: MatchRepository;
  notifications: NotificationRepository;
  messages: MessageRepository;
  /** Demo verilerini sıfırlar (yalnızca mock sağlayıcı için anlamlı) */
  reset(): Promise<void>;
}
