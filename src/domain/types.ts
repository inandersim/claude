import type {
  AdventureType,
  DifficultyGrade,
  MatchStatus,
  NotificationType,
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
