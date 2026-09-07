import { deepClone } from '@/core/utils/clone';
import { generateId } from '@/core/utils/format';
import {
  computeTrustScore,
  countByCountry,
  expiresAtFor,
  filterListings,
  findMatchCandidates,
  nearestCenters,
  nextRating,
  nightsBetween,
  rankInstructors,
  searchLibrary,
  selectHazards,
  splitPayment,
  stayTotal,
  visibleShares,
  distanceKm,
  OtpError,
  normalizeUsername,
  validateDisplayName,
  validatePhone,
  validateUsername,
  type CompleteProfileInput,
  type OtpChallenge,
  type OtpVerification,
  type RequestOtpInput,
  type VerifyOtpInput,
  type Business,
  type BusinessFilter,
  type BusinessWithOwner,
  type CreateStayInput,
  type CreateStoryInput,
  type LocationShare,
  type RegisterBusinessInput,
  type SosEvent,
  type StartShareInput,
  type StayBooking,
  type StayBookingWithBusiness,
  type Story,
  type StoryGroup,
  type Booking,
  type BookingWithParties,
  type CommentWithAuthor,
  type CreateBookingInput,
  type CreateListingInput,
  type CreateMatchInput,
  type CreatePostInput,
  type FeedPost,
  type GeoPoint,
  type HazardZone,
  type HazardZoneWithReporter,
  type ID,
  type Instructor,
  type InstructorWithUser,
  type Listing,
  type ListingWithSeller,
  type LiveStream,
  type LiveStreamWithHost,
  type NotificationWithSender,
  type Post,
  type ReportHazardInput,
  type StartStreamInput,
  type User,
  type ZMatch,
  type ZMatchWithUsers,
} from '@/domain';
import { gecerliOlcum } from '@/domain/altitude';
import { tokenCikar, tokenEkle } from '@/domain/push';

import type {
  AuthApi,
  BillingRepository,
  BusinessRepository,
  DataProvider,
  EmergencyRepository,
  LibraryRepository,
  PresenceRepository,
  StoryRepository,
  ExploreRepository,
  FeedFilter,
  FeedRepository,
  HazardRepository,
  InstructorRepository,
  LiveRepository,
  MarketRepository,
  MatchRepository,
  MessageRepository,
  NotificationRepository,
  UserRepository,
} from '../repositories';
import { FEED_PAGE_SIZE } from '../repositories';
import type { MockContext } from './context';
import { MockDatabase, delay } from './database';
import { createAiRepository } from './repos/ai';
import { createClimbingRepository } from './repos/climbing';
import { createClubRepository } from './repos/clubs';
import { createFunRepository } from './repos/fun';
import { createInventoryRepository } from './repos/inventory';
import { createMapsRepository } from './repos/maps';
import { createSatelliteRepository } from './repos/satellite';
import { createCourseRepository } from './repos/courses';
import { createDestinationRepository } from './repos/destinations';
import { createGroupRepository } from './repos/groups';
import { createSocialRepository } from './repos/social';
import { createVisionRepository } from './repos/vision';
import { createTrackRepository } from './repos/tracks';
import { createWeatherRepository } from './repos/weather';
import { createHeritageRepository } from './repos/heritage';
import { createKidsRepository } from './repos/kids';
import { createTvRepository } from './repos/tv';
import { createArticleRepository } from './repos/articles';
import { createCountryRepository } from './repos/countries';
import { createTelemedRepository } from './repos/telemed';
import { createWildlifeRepository } from './repos/wildlife';
import { MockOtpService } from './otp';
import { CURRENT_USER_ID } from './seed';

interface Options {
  persist?: boolean;
  latencyMs?: number;
  /** Testlerde kodu sabitlemek için değiştirilebilir OTP motoru. */
  otp?: MockOtpService;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} bulunamadı: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Cihaz bildirim adresleri — mock tarafı.
 *
 * Bilerek `User` nesnesine konmadı: adres profilin parçası değil (gerçek
 * şemada da ayrı ve yalnızca sahibine açık bir tabloda, bkz. migration 0036)
 * ve uygulama her açılışta yeniden kaydediyor. Kalıcılık gerekmiyor.
 */
const pushAdresleri = new Map<string, string[]>();

export function createMockProvider(options: Options = {}): DataProvider {
  const db = new MockDatabase(options.persist ?? true);
  const latency = options.latencyMs ?? 260;
  const wait = () => delay(latency);
  /** SMS sağlayıcısı yerine geçen geliştirme motoru (kodu gerçekten üretir). */
  const otp = options.otp ?? new MockOtpService();

  const requireUser = (users: User[], id: ID): User => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new NotFoundError('Kullanıcı', id);
    return user;
  };

  const toFeedPost = (
    post: Post,
    viewerId: ID,
    users: User[],
    likes: { userId: string; postId: string }[],
  ): FeedPost => ({
    ...post,
    author: requireUser(users, post.authorId),
    likedByMe: likes.some((l) => l.userId === viewerId && l.postId === post.id),
  });

  const withUsers = (match: ZMatch, users: User[]): ZMatchWithUsers => ({
    ...match,
    requester: requireUser(users, match.requesterId),
    receiver: requireUser(users, match.receiverId),
  });

  const pushNotification = async (
    input: Omit<NotificationWithSender, 'id' | 'createdAt' | 'isRead' | 'sender' | 'targetId'> & {
      targetId?: ID | null;
    },
  ) => {
    const t = await db.load();
    if (input.senderId === input.receiverId) return;
    t.notifications.unshift({
      ...input,
      targetId: input.targetId ?? null,
      id: generateId('n'),
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    db.markDirty();
  };

  /** Modül repository'leri için ortak bağlam (bkz. ./repos/*) */
  const ctx: MockContext = { db, wait, latencyMs: latency, requireUser, pushNotification };

  const recomputeTrust = async (userId: ID) => {
    const t = await db.load();
    const user = requireUser(t.users, userId);
    const posts = t.posts.filter((p) => p.authorId === userId);
    user.trustScore = computeTrustScore({
      isVerified: user.isVerified,
      totalPosts: posts.length,
      verifiedPosts: posts.filter((p) => p.isVerifiedInfo).length,
      acceptedMatches: t.matches.filter(
        (m) => m.status === 'accepted' && (m.requesterId === userId || m.receiverId === userId),
      ).length,
      followersCount: user.followersCount,
    });
  };

  const auth: AuthApi = {
    async getSession() {
      const t = await db.load();
      if (!t.sessionUserId) return null;
      return t.users.find((u) => u.id === t.sessionUserId) ?? null;
    },
    async signIn({ email, password }) {
      await wait();
      if (!email.includes('@')) throw new AuthError('Geçersiz e-posta.');
      if (password.length < 6) throw new AuthError('Şifre en az 6 karakter olmalı.');
      const t = await db.load();
      // Demo: her giriş, demo kullanıcısına bağlanır.
      t.sessionUserId = CURRENT_USER_ID;
      db.markDirty();
      return requireUser(t.users, CURRENT_USER_ID);
    },
    async signUp({ email, password, username, displayName }) {
      await wait();
      if (!email.includes('@')) throw new AuthError('Geçersiz e-posta.');
      if (password.length < 6) throw new AuthError('Şifre en az 6 karakter olmalı.');
      const t = await db.load();
      const me = requireUser(t.users, CURRENT_USER_ID);
      // Demo: mevcut demo profili yeni bilgilerle güncellenir.
      me.username = username.trim().toLowerCase() || me.username;
      me.displayName = displayName.trim() || me.displayName;
      t.sessionUserId = CURRENT_USER_ID;
      db.markDirty();
      return me;
    },
    async signOut() {
      const t = await db.load();
      t.sessionUserId = null;
      db.markDirty();
    },

    /* ---------------- Telefon + SMS doğrulama (OTP) ---------------- */

    async requestOtp({ phone, locale }: RequestOtpInput): Promise<OtpChallenge> {
      await wait();
      const check = validatePhone(phone);
      if (!check.valid || !check.e164) throw new OtpError('invalidPhone');

      const now = Date.now();
      const issued = otp.issue(check.e164, now);
      void locale; // gerçek sağlayıcıda SMS metninin dili

      return {
        phone: check.e164,
        expiresAt: new Date(issued.expiresAt).toISOString(),
        resendAvailableAt: new Date(issued.resendAvailableAt).toISOString(),
        attemptsRemaining: issued.attemptsRemaining,
        // Sunucusuz geliştirmede kod ekranda rozet olarak gösterilir.
        devCode: issued.code,
      };
    },

    async verifyOtp({ phone, code }: VerifyOtpInput): Promise<OtpVerification> {
      await wait();
      const check = validatePhone(phone);
      if (!check.valid || !check.e164) throw new OtpError('invalidPhone');

      otp.verify(check.e164, code);

      const t = await db.load();
      const link = t.phoneLinks.find((l) => l.phone === check.e164);
      if (!link) return { user: null, needsProfile: true, phone: check.e164 };

      const user = t.users.find((u) => u.id === link.userId);
      if (!user) return { user: null, needsProfile: true, phone: check.e164 };

      t.sessionUserId = user.id;
      db.markDirty();
      return { user, needsProfile: false, phone: check.e164 };
    },

    async completeProfile({
      phone,
      displayName,
      username,
      locale,
    }: CompleteProfileInput): Promise<User> {
      await wait();
      const check = validatePhone(phone);
      if (!check.valid || !check.e164) throw new OtpError('invalidPhone');
      if (!otp.isVerified(check.e164)) throw new OtpError('notVerified');

      if (validateDisplayName(displayName)) throw new AuthError('Görünen ad geçersiz.');
      const handle = normalizeUsername(username);
      if (validateUsername(handle)) throw new AuthError('Kullanıcı adı geçersiz.');

      const t = await db.load();
      const taken = t.users.some((u) => u.username.toLowerCase() === handle);
      if (taken) throw new OtpError('usernameTaken');

      const existing = t.phoneLinks.find((l) => l.phone === check.e164);
      const user: User = existing
        ? requireUser(t.users, existing.userId)
        : {
            id: generateId('u'),
            username: handle,
            displayName: displayName.trim(),
            avatarUrl: null,
            coverUrl: null,
            bio: '',
            locationName: '',
            coords: { latitude: 41.0082, longitude: 28.9784 },
            isVerified: false,
            totalDistanceKm: 0,
            totalAdventures: 0,
            followersCount: 0,
            followingCount: 0,
            trustScore: 50,
            favoriteTypes: [],
            joinedAt: new Date().toISOString(),
            plan: 'free',
            emergencyContacts: [],
          };

      user.username = handle;
      user.displayName = displayName.trim();
      if (!existing) {
        t.users.push(user);
        t.phoneLinks.push({ phone: check.e164, userId: user.id });
      }
      t.sessionUserId = user.id;
      db.markDirty();
      otp.clear(check.e164);
      void locale;
      return user;
    },

    async isUsernameAvailable(username: string): Promise<boolean> {
      const handle = normalizeUsername(username);
      if (validateUsername(handle)) return false;
      const t = await db.load();
      return !t.users.some((u) => u.username.toLowerCase() === handle);
    },
  };

  const users: UserRepository = {
    async getById(id) {
      await wait();
      const t = await db.load();
      return t.users.find((u) => u.id === id) ?? null;
    },
    async search(query) {
      const t = await db.load();
      const q = query.trim().toLocaleLowerCase('tr-TR');
      if (!q) return [];
      return t.users.filter(
        (u) =>
          u.displayName.toLocaleLowerCase('tr-TR').includes(q) ||
          u.username.toLocaleLowerCase('tr-TR').includes(q) ||
          u.locationName.toLocaleLowerCase('tr-TR').includes(q),
      );
    },
    async isFollowing(followerId, followingId) {
      const t = await db.load();
      return t.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
    },
    async toggleFollow(followerId, followingId) {
      await wait();
      const t = await db.load();
      const idx = t.follows.findIndex(
        (f) => f.followerId === followerId && f.followingId === followingId,
      );
      const follower = requireUser(t.users, followerId);
      const following = requireUser(t.users, followingId);
      if (idx >= 0) {
        t.follows.splice(idx, 1);
        follower.followingCount = Math.max(0, follower.followingCount - 1);
        following.followersCount = Math.max(0, following.followersCount - 1);
        db.markDirty();
        return { following: false };
      }
      t.follows.push({ followerId, followingId, createdAt: new Date().toISOString() });
      follower.followingCount += 1;
      following.followersCount += 1;
      db.markDirty();
      await pushNotification({
        type: 'follow',
        senderId: followerId,
        receiverId: followingId,
        message: '',
        postId: null,
        matchId: null,
      });
      return { following: true };
    },
    async updateProfile(id, patch) {
      await wait();
      const t = await db.load();
      const user = requireUser(t.users, id);
      Object.assign(user, patch);
      if (patch.baselineRestingHr !== undefined) {
        // Uzak sağlayıcıyla aynı kural: sınır dışı değer kırpılmaz, düşürülür.
        // Uydurma bir bazal, bazal olmamasından kötüdür — nabız sapmasını
        // sistematik olarak yanıltır.
        user.baselineRestingHr = gecerliOlcum('restingHr', patch.baselineRestingHr);
      }
      db.markDirty();
      return user;
    },
  };

  const feed: FeedRepository = {
    async list(viewerId, filter: FeedFilter = {}) {
      await wait();
      const t = await db.load();
      return t.posts
        .filter((p) => !filter.adventureType || p.adventureType === filter.adventureType)
        .filter((p) => !filter.authorId || p.authorId === filter.authorId)
        .filter(
          (p) =>
            !filter.locationName ||
            p.locationName
              .toLocaleLowerCase('tr-TR')
              .includes(filter.locationName.toLocaleLowerCase('tr-TR')),
        )
        .filter((p) => !filter.before || p.createdAt < filter.before)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? FEED_PAGE_SIZE)
        .map((p) => toFeedPost(p, viewerId, t.users, t.likes));
    },
    async getById(viewerId, postId) {
      await wait();
      const t = await db.load();
      const post = t.posts.find((p) => p.id === postId);
      return post ? toFeedPost(post, viewerId, t.users, t.likes) : null;
    },
    async create(authorId, input: CreatePostInput) {
      await wait();
      const t = await db.load();
      const author = requireUser(t.users, authorId);
      const post: Post = {
        id: generateId('p'),
        authorId,
        imageUrl: input.imageUri,
        caption: input.caption.trim(),
        adventureType: input.adventureType,
        difficulty: input.difficulty,
        trailCondition: input.trailCondition,
        altitudeM: input.altitudeM,
        distanceKm: input.distanceKm,
        temperatureC: input.temperatureC,
        windKmh: input.windKmh,
        durationMin: input.durationMin,
        locationName: input.locationName.trim(),
        coords: input.coords ?? author.coords,
        likesCount: 0,
        commentsCount: 0,
        isVerifiedInfo: author.isVerified,
        routeId: null,
        createdAt: new Date().toISOString(),
      };
      t.posts.unshift(post);
      author.totalAdventures += 1;
      author.totalDistanceKm = Math.round((author.totalDistanceKm + input.distanceKm) * 10) / 10;
      await recomputeTrust(authorId);
      db.markDirty();
      return toFeedPost(post, authorId, t.users, t.likes);
    },
    async toggleLike(viewerId, postId) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      const post = t.posts.find((p) => p.id === postId);
      if (!post) throw new NotFoundError('Gönderi', postId);
      const idx = t.likes.findIndex((l) => l.userId === viewerId && l.postId === postId);
      if (idx >= 0) {
        t.likes.splice(idx, 1);
        post.likesCount = Math.max(0, post.likesCount - 1);
        db.markDirty();
        return { liked: false, likesCount: post.likesCount };
      }
      t.likes.push({ userId: viewerId, postId });
      post.likesCount += 1;
      db.markDirty();
      await pushNotification({
        type: 'like',
        senderId: viewerId,
        receiverId: post.authorId,
        message: '',
        postId,
        matchId: null,
      });
      return { liked: true, likesCount: post.likesCount };
    },
    async listComments(postId) {
      await wait();
      const t = await db.load();
      return t.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map<CommentWithAuthor>((c) => ({ ...c, author: requireUser(t.users, c.authorId) }));
    },
    async addComment(authorId, postId, content) {
      await wait();
      const t = await db.load();
      const post = t.posts.find((p) => p.id === postId);
      if (!post) throw new NotFoundError('Gönderi', postId);
      const comment = {
        id: generateId('c'),
        postId,
        authorId,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      t.comments.push(comment);
      post.commentsCount += 1;
      db.markDirty();
      await pushNotification({
        type: 'comment',
        senderId: authorId,
        receiverId: post.authorId,
        message: comment.content,
        postId,
        matchId: null,
      });
      return { ...comment, author: requireUser(t.users, authorId) };
    },
    async getRoute(routeId) {
      await wait();
      const t = await db.load();
      return t.routes.find((r) => r.id === routeId) ?? null;
    },
  };

  const explore: ExploreRepository = {
    async trendingLocations() {
      await wait();
      const t = await db.load();
      return [...t.locations].sort((a, b) => b.trendPercent - a.trendPercent);
    },
    async getLocation(id) {
      await wait();
      const t = await db.load();
      return t.locations.find((l) => l.id === id) ?? null;
    },
    async popularRoutes() {
      await wait();
      const t = await db.load();
      return t.routes;
    },
    async search(query) {
      await delay(Math.min(latency, 150));
      const t = await db.load();
      const q = query.trim().toLocaleLowerCase('tr-TR');
      if (!q) return { locations: [], users: [], routes: [] };
      const includes = (value: string) => value.toLocaleLowerCase('tr-TR').includes(q);
      return {
        locations: t.locations.filter((l) => includes(l.name) || includes(l.region)),
        users: t.users.filter((u) => includes(u.displayName) || includes(u.username)),
        routes: t.routes.filter((r) => includes(r.name) || includes(r.locationName)),
      };
    },
  };

  const matches: MatchRepository = {
    async candidates(meId, origin, radiusKm, type) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      return findMatchCandidates({
        me,
        origin,
        users: t.users,
        matches: t.matches,
        radiusKm,
        adventureType: type ?? null,
      });
    },
    async listMine(meId) {
      await wait();
      const t = await db.load();
      return t.matches
        .filter((m) => m.requesterId === meId || m.receiverId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((m) => withUsers(m, t.users));
    },
    async getById(id) {
      await wait();
      const t = await db.load();
      const match = t.matches.find((m) => m.id === id);
      return match ? withUsers(match, t.users) : null;
    },
    async request(meId, input: CreateMatchInput) {
      await wait();
      const t = await db.load();
      const duplicate = t.matches.find(
        (m) =>
          m.status === 'pending' &&
          ((m.requesterId === meId && m.receiverId === input.receiverId) ||
            (m.requesterId === input.receiverId && m.receiverId === meId)),
      );
      if (duplicate) return withUsers(duplicate, t.users);

      const match: ZMatch = {
        id: generateId('m'),
        requesterId: meId,
        receiverId: input.receiverId,
        // Doğru davranış: yeni istek her zaman "pending" durumuyla oluşturulur.
        status: 'pending',
        message: input.message.trim(),
        plannedDate: input.plannedDate,
        locationName: input.locationName,
        adventureType: input.adventureType,
        createdAt: new Date().toISOString(),
        respondedAt: null,
      };
      t.matches.unshift(match);
      db.markDirty();
      await pushNotification({
        type: 'match_request',
        senderId: meId,
        receiverId: input.receiverId,
        message: input.locationName ?? '',
        postId: null,
        matchId: match.id,
      });
      return withUsers(match, t.users);
    },
    async respond(meId, matchId, accept) {
      await wait();
      const t = await db.load();
      const match = t.matches.find((m) => m.id === matchId);
      if (!match) throw new NotFoundError('Eşleşme', matchId);
      if (match.receiverId !== meId)
        throw new AuthError('Bu isteğe yalnızca alıcı yanıt verebilir.');
      match.status = accept ? 'accepted' : 'rejected';
      match.respondedAt = new Date().toISOString();
      db.markDirty();
      await pushNotification({
        type: accept ? 'match_accepted' : 'match_rejected',
        senderId: meId,
        receiverId: match.requesterId,
        message: match.locationName ?? '',
        postId: null,
        matchId,
      });
      if (accept) {
        await recomputeTrust(meId);
        await recomputeTrust(match.requesterId);
      }
      return withUsers(match, t.users);
    },
  };

  const notifications: NotificationRepository = {
    async list(meId) {
      await wait();
      const t = await db.load();
      return t.notifications
        .filter((n) => n.receiverId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => ({ ...n, sender: requireUser(t.users, n.senderId) }));
    },
    async unreadCount(meId) {
      const t = await db.load();
      return t.notifications.filter((n) => n.receiverId === meId && !n.isRead).length;
    },
    async markRead(meId, id) {
      const t = await db.load();
      const n = t.notifications.find((x) => x.id === id && x.receiverId === meId);
      if (n && !n.isRead) {
        n.isRead = true;
        db.markDirty();
      }
    },
    async markAllRead(meId) {
      const t = await db.load();
      let changed = false;
      for (const n of t.notifications) {
        if (n.receiverId === meId && !n.isRead) {
          n.isRead = true;
          changed = true;
        }
      }
      if (changed) db.markDirty();
    },
    async registerPushToken(meId, token) {
      pushAdresleri.set(meId, tokenEkle(pushAdresleri.get(meId) ?? [], token));
    },
    async unregisterPushToken(meId, token) {
      const mevcut = pushAdresleri.get(meId);
      if (mevcut) pushAdresleri.set(meId, tokenCikar(mevcut, token));
    },
  };

  const messages: MessageRepository = {
    async thread(meId, otherId) {
      await delay(Math.min(latency, 150));
      const t = await db.load();
      const list = t.messages
        .filter(
          (m) =>
            (m.senderId === meId && m.receiverId === otherId) ||
            (m.senderId === otherId && m.receiverId === meId),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      let changed = false;
      for (const m of list) {
        if (m.receiverId === meId && !m.readAt) {
          m.readAt = new Date().toISOString();
          changed = true;
        }
      }
      if (changed) db.markDirty();
      return list;
    },
    async send(meId, otherId, content, matchId = null) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      const message = {
        id: generateId('msg'),
        senderId: meId,
        receiverId: otherId,
        content: content.trim(),
        matchId,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      t.messages.push(message);
      db.markDirty();
      await pushNotification({
        type: 'message',
        senderId: meId,
        receiverId: otherId,
        message: message.content,
        postId: null,
        matchId,
      });
      return message;
    },
  };

  /* ---------------------------------------------------------------- */
  /* Tehlikeli yerler                                                  */
  /* ---------------------------------------------------------------- */

  const toHazard = (
    h: HazardZone,
    meId: ID,
    origin: GeoPoint | null,
    users: User[],
    confirmations: { userId: string; hazardId: string }[],
  ): HazardZoneWithReporter => ({
    ...h,
    reporter: requireUser(users, h.reporterId),
    confirmedByMe: confirmations.some((c) => c.userId === meId && c.hazardId === h.id),
    distanceKm: origin ? distanceKm(origin, h.coords) : null,
  });

  const hazards: HazardRepository = {
    async list(meId, origin, radiusKm, includeResolved = false) {
      await wait();
      const t = await db.load();
      return selectHazards({ hazards: t.hazards, origin, radiusKm, includeResolved }).map(
        ({ hazard }) => toHazard(hazard, meId, origin, t.users, t.hazardConfirmations),
      );
    },
    async getById(meId, id, origin) {
      await wait();
      const t = await db.load();
      const h = t.hazards.find((x) => x.id === id);
      return h ? toHazard(h, meId, origin, t.users, t.hazardConfirmations) : null;
    },
    async report(meId, input: ReportHazardInput) {
      await wait();
      const t = await db.load();
      const hazard: HazardZone = {
        id: generateId('h'),
        type: input.type,
        severity: input.severity,
        status: 'active',
        title: input.title.trim(),
        description: input.description.trim(),
        locationName: input.locationName.trim(),
        coords: input.coords,
        radiusM: input.radiusM,
        reporterId: meId,
        confirmations: 0,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresInHours
          ? new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString()
          : null,
        resolvedAt: null,
      };
      t.hazards.unshift(hazard);
      db.markDirty();
      // Etki alanına 25 km'den yakın kullanıcıları bilgilendir (demo: takipçiler yerine yakınlık)
      for (const user of t.users) {
        if (user.id === meId) continue;
        if (distanceKm(user.coords, hazard.coords) <= 25) {
          await pushNotification({
            type: 'hazard_alert',
            senderId: meId,
            receiverId: user.id,
            message: hazard.title,
            postId: null,
            matchId: null,
            targetId: hazard.id,
          });
        }
      }
      return toHazard(hazard, meId, input.coords, t.users, t.hazardConfirmations);
    },
    async confirm(meId, id) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      const h = t.hazards.find((x) => x.id === id);
      if (!h) throw new NotFoundError('Tehlike', id);
      if (h.reporterId === meId) throw new AuthError('Kendi bildirdiğin tehlikeyi onaylayamazsın.');
      const exists = t.hazardConfirmations.some((c) => c.userId === meId && c.hazardId === id);
      if (!exists) {
        t.hazardConfirmations.push({ userId: meId, hazardId: id });
        h.confirmations += 1;
        db.markDirty();
        await pushNotification({
          type: 'hazard_confirmed',
          senderId: meId,
          receiverId: h.reporterId,
          message: h.title,
          postId: null,
          matchId: null,
          targetId: h.id,
        });
      }
      return toHazard(h, meId, null, t.users, t.hazardConfirmations);
    },
    async resolve(meId, id) {
      await wait();
      const t = await db.load();
      const h = t.hazards.find((x) => x.id === id);
      if (!h) throw new NotFoundError('Tehlike', id);
      if (h.reporterId !== meId)
        throw new AuthError('Yalnızca bildiren kişi çözüldü olarak işaretleyebilir.');
      h.status = 'resolved';
      h.resolvedAt = new Date().toISOString();
      db.markDirty();
      return toHazard(h, meId, null, t.users, t.hazardConfirmations);
    },
  };

  /* ---------------------------------------------------------------- */
  /* Canlı yayın                                                       */
  /* ---------------------------------------------------------------- */

  const withHost = (s: LiveStream, users: User[]): LiveStreamWithHost => ({
    ...s,
    host: requireUser(users, s.hostId),
  });
  const streamOrder: Record<LiveStream['status'], number> = { live: 0, scheduled: 1, ended: 2 };

  const live: LiveRepository = {
    async list() {
      await wait();
      const t = await db.load();
      return [...t.streams]
        .sort((a, b) => {
          if (streamOrder[a.status] !== streamOrder[b.status])
            return streamOrder[a.status] - streamOrder[b.status];
          if (a.status === 'live') return b.viewerCount - a.viewerCount;
          if (a.status === 'scheduled')
            return (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '');
          return (b.endedAt ?? '').localeCompare(a.endedAt ?? '');
        })
        .map((s) => withHost(s, t.users));
    },
    async getById(id) {
      await wait();
      const t = await db.load();
      const s = t.streams.find((x) => x.id === id);
      return s ? withHost(s, t.users) : null;
    },
    async messages(streamId) {
      await delay(Math.min(latency, 100));
      const t = await db.load();
      return t.streamMessages
        .filter((m) => m.streamId === streamId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({ ...m, author: requireUser(t.users, m.authorId) }));
    },
    async sendMessage(meId, streamId, content) {
      await delay(Math.min(latency, 100));
      const t = await db.load();
      const message = {
        id: generateId('sm'),
        streamId,
        authorId: meId,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      t.streamMessages.push(message);
      db.markDirty();
      return { ...message, author: requireUser(t.users, meId) };
    },
    async start(meId, input: StartStreamInput) {
      await wait();
      const t = await db.load();
      const host = requireUser(t.users, meId);
      // Aynı kullanıcının açık yayını varsa kapat
      for (const s of t.streams) {
        if (s.hostId === meId && s.status === 'live') {
          s.status = 'ended';
          s.endedAt = new Date().toISOString();
        }
      }
      const stream: LiveStream = {
        id: generateId('s'),
        hostId: meId,
        title: input.title.trim(),
        description: input.description.trim(),
        adventureType: input.adventureType,
        status: 'live',
        locationName: input.locationName.trim() || host.locationName,
        coords: input.coords ?? host.coords,
        viewerCount: 1,
        peakViewers: 1,
        likesCount: 0,
        thumbnailUrl: null,
        playbackUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        scheduledAt: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        altitudeM: null,
        source: input.source ?? 'camera',
        droneTelemetry:
          input.source === 'drone'
            ? { altitudeM: 120, speedKmh: 0, batteryPct: 100, headingDeg: 0, distanceFromPilotM: 0 }
            : null,
      };
      t.streams.unshift(stream);
      db.markDirty();
      // Takipçilere bildir
      for (const f of t.follows) {
        if (f.followingId === meId) {
          await pushNotification({
            type: 'stream_live',
            senderId: meId,
            receiverId: f.followerId,
            message: stream.title,
            postId: null,
            matchId: null,
            targetId: stream.id,
          });
        }
      }
      return withHost(stream, t.users);
    },
    async end(meId, streamId) {
      await wait();
      const t = await db.load();
      const s = t.streams.find((x) => x.id === streamId);
      if (!s) throw new NotFoundError('Yayın', streamId);
      if (s.hostId !== meId) throw new AuthError('Yalnızca yayıncı yayını bitirebilir.');
      s.status = 'ended';
      s.endedAt = new Date().toISOString();
      s.viewerCount = 0;
      s.playbackUrl =
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      db.markDirty();
      return withHost(s, t.users);
    },
    async like(streamId) {
      const t = await db.load();
      const s = t.streams.find((x) => x.id === streamId);
      if (!s) throw new NotFoundError('Yayın', streamId);
      s.likesCount += 1;
      db.markDirty();
      return { likesCount: s.likesCount };
    },
    async join(streamId) {
      const t = await db.load();
      const s = t.streams.find((x) => x.id === streamId);
      if (s && s.status === 'live') {
        s.viewerCount += 1;
        s.peakViewers = Math.max(s.peakViewers, s.viewerCount);
        db.markDirty();
      }
    },
    async leave(streamId) {
      const t = await db.load();
      const s = t.streams.find((x) => x.id === streamId);
      if (s && s.status === 'live' && s.viewerCount > 0) {
        s.viewerCount -= 1;
        db.markDirty();
      }
    },
  };

  /* ---------------------------------------------------------------- */
  /* Market                                                            */
  /* ---------------------------------------------------------------- */

  const toListing = (
    l: Listing,
    viewerId: ID,
    users: User[],
    favorites: { userId: string; listingId: string }[],
  ): ListingWithSeller => ({
    ...l,
    seller: requireUser(users, l.sellerId),
    favoritedByMe: favorites.some((f) => f.userId === viewerId && f.listingId === l.id),
  });

  const market: MarketRepository = {
    async list(viewerId, filter = {}) {
      await wait();
      const t = await db.load();
      return filterListings(t.listings, filter).map((l) =>
        toListing(l, viewerId, t.users, t.favorites),
      );
    },
    async getById(viewerId, id) {
      await wait();
      const t = await db.load();
      const l = t.listings.find((x) => x.id === id);
      return l ? toListing(l, viewerId, t.users, t.favorites) : null;
    },
    async create(sellerId, input: CreateListingInput) {
      await wait();
      const t = await db.load();
      const seller = requireUser(t.users, sellerId);
      const listing: Listing = {
        id: generateId('l'),
        sellerId,
        title: input.title.trim(),
        description: input.description.trim(),
        priceTry: Math.max(0, Math.round(input.priceTry)),
        category: input.category,
        condition: input.condition,
        imageUrls: input.imageUri ? [input.imageUri] : [],
        locationName: input.locationName.trim() || seller.locationName,
        coords: seller.coords,
        adventureTypes: input.adventureTypes,
        isSold: false,
        favoritesCount: 0,
        createdAt: new Date().toISOString(),
      };
      t.listings.unshift(listing);
      db.markDirty();
      return toListing(listing, sellerId, t.users, t.favorites);
    },
    async toggleFavorite(viewerId, id) {
      await delay(Math.min(latency, 100));
      const t = await db.load();
      const l = t.listings.find((x) => x.id === id);
      if (!l) throw new NotFoundError('İlan', id);
      const idx = t.favorites.findIndex((f) => f.userId === viewerId && f.listingId === id);
      if (idx >= 0) {
        t.favorites.splice(idx, 1);
        l.favoritesCount = Math.max(0, l.favoritesCount - 1);
        db.markDirty();
        return { favorited: false, favoritesCount: l.favoritesCount };
      }
      t.favorites.push({ userId: viewerId, listingId: id });
      l.favoritesCount += 1;
      db.markDirty();
      return { favorited: true, favoritesCount: l.favoritesCount };
    },
    async markSold(sellerId, id) {
      await wait();
      const t = await db.load();
      const l = t.listings.find((x) => x.id === id);
      if (!l) throw new NotFoundError('İlan', id);
      if (l.sellerId !== sellerId) throw new AuthError('Yalnızca satıcı ilanı kapatabilir.');
      l.isSold = true;
      db.markDirty();
      return toListing(l, sellerId, t.users, t.favorites);
    },
  };

  /* ---------------------------------------------------------------- */
  /* Eğitmenler                                                        */
  /* ---------------------------------------------------------------- */

  const toInstructor = (
    i: Instructor,
    users: User[],
    origin: GeoPoint | null,
  ): InstructorWithUser => ({
    ...i,
    user: requireUser(users, i.userId),
    distanceKm: origin ? distanceKm(origin, i.coords) : null,
  });

  const toBooking = (
    b: Booking,
    t: { instructors: Instructor[]; users: User[] },
  ): BookingWithParties => {
    const instructor = t.instructors.find((i) => i.id === b.instructorId);
    if (!instructor) throw new NotFoundError('Eğitmen', b.instructorId);
    return {
      ...b,
      instructor: toInstructor(instructor, t.users, null),
      student: requireUser(t.users, b.studentId),
    };
  };

  const instructors: InstructorRepository = {
    async list(origin, filter = {}) {
      await wait();
      const t = await db.load();
      return rankInstructors({ instructors: t.instructors, users: t.users, origin, filter }).map(
        (r) => ({
          ...r.instructor,
          user: r.user,
          distanceKm: r.distanceKm,
        }),
      );
    },
    async getById(id, origin) {
      await wait();
      const t = await db.load();
      const i = t.instructors.find((x) => x.id === id);
      return i ? toInstructor(i, t.users, origin) : null;
    },
    async getByUserId(userId) {
      const t = await db.load();
      const i = t.instructors.find((x) => x.userId === userId);
      return i ? toInstructor(i, t.users, null) : null;
    },
    async reviews(instructorId) {
      await wait();
      const t = await db.load();
      return t.instructorReviews
        .filter((r) => r.instructorId === instructorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ ...r, author: requireUser(t.users, r.authorId) }));
    },
    async book(meId, input: CreateBookingInput) {
      await wait();
      const t = await db.load();
      const instructor = t.instructors.find((i) => i.id === input.instructorId);
      if (!instructor) throw new NotFoundError('Eğitmen', input.instructorId);
      if (instructor.userId === meId) throw new AuthError('Kendinden ders talep edemezsin.');
      const booking: Booking = {
        id: generateId('b'),
        instructorId: input.instructorId,
        studentId: meId,
        adventureType: input.adventureType,
        date: input.date,
        message: input.message.trim(),
        status: 'pending',
        priceTry: instructor.pricePerSessionTry,
        createdAt: new Date().toISOString(),
        respondedAt: null,
      };
      t.bookings.unshift(booking);
      db.markDirty();
      await pushNotification({
        type: 'booking_request',
        senderId: meId,
        receiverId: instructor.userId,
        message: instructor.headline,
        postId: null,
        matchId: null,
        targetId: booking.id,
      });
      return toBooking(booking, t);
    },
    async myBookings(meId) {
      await wait();
      const t = await db.load();
      const mine = t.instructors.filter((i) => i.userId === meId).map((i) => i.id);
      return t.bookings
        .filter((b) => b.studentId === meId || mine.includes(b.instructorId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((b) => toBooking(b, t));
    },
    async respondBooking(meId, bookingId, accept) {
      await wait();
      const t = await db.load();
      const b = t.bookings.find((x) => x.id === bookingId);
      if (!b) throw new NotFoundError('Rezervasyon', bookingId);
      const instructor = t.instructors.find((i) => i.id === b.instructorId);
      if (!instructor || instructor.userId !== meId)
        throw new AuthError('Bu talebe yalnızca eğitmen yanıt verebilir.');
      b.status = accept ? 'confirmed' : 'declined';
      b.respondedAt = new Date().toISOString();
      if (accept) instructor.studentsCount += 1;
      db.markDirty();
      await pushNotification({
        type: accept ? 'booking_confirmed' : 'booking_declined',
        senderId: meId,
        receiverId: b.studentId,
        message: instructor.headline,
        postId: null,
        matchId: null,
        targetId: b.id,
      });
      return toBooking(b, t);
    },
  };

  /* ---------------------------------------------------------------- */
  /* Kütüphane                                                         */
  /* ---------------------------------------------------------------- */

  const library: LibraryRepository = {
    async search(filter) {
      await wait();
      const t = await db.load();
      return searchLibrary(t.library, filter);
    },
    async getById(id, origin) {
      await wait();
      const t = await db.load();
      const found = searchLibrary(t.library, { origin }).find((p) => p.id === id);
      return found ?? null;
    },
    async nearby(origin, radiusKm, kind = null, limit = 20) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      return searchLibrary(t.library, { origin, radiusKm, kind }).slice(0, limit);
    },
    async countries() {
      const t = await db.load();
      return countByCountry(t.library);
    },
  };

  /* ---------------------------------------------------------------- */
  /* Canlı konum                                                       */
  /* ---------------------------------------------------------------- */

  const friendIdsOf = (t: { follows: { followerId: string; followingId: string }[] }, meId: ID) => {
    const iFollow = new Set(
      t.follows.filter((f) => f.followerId === meId).map((f) => f.followingId),
    );
    return new Set(
      t.follows
        .filter((f) => f.followingId === meId && iFollow.has(f.followerId))
        .map((f) => f.followerId),
    );
  };
  const matchIdsOf = (t: { matches: ZMatch[] }, meId: ID) =>
    new Set(
      t.matches
        .filter((m) => m.status === 'accepted' && (m.requesterId === meId || m.receiverId === meId))
        .map((m) => (m.requesterId === meId ? m.receiverId : m.requesterId)),
    );

  const presence: PresenceRepository = {
    async list(meId, origin) {
      await delay(Math.min(latency, 150));
      const t = await db.load();
      return visibleShares({
        meId,
        origin,
        shares: t.shares,
        users: t.users,
        friendIds: friendIdsOf(t, meId),
        matchIds: matchIdsOf(t, meId),
      });
    },
    async mine(meId) {
      const t = await db.load();
      const s = t.shares.find((x) => x.userId === meId);
      if (!s) return null;
      if (s.expiresAt && s.expiresAt < new Date().toISOString()) return null;
      return s;
    },
    async start(meId, input: StartShareInput) {
      await delay(Math.min(latency, 150));
      const t = await db.load();
      const nowIso = new Date().toISOString();
      const share: LocationShare = {
        userId: meId,
        coords: input.coords,
        mode: input.mode,
        startedAt: nowIso,
        expiresAt: expiresAtFor(input.durationMin),
        updatedAt: nowIso,
        batteryPct: input.batteryPct ?? null,
        altitudeM: input.altitudeM ?? null,
        speedKmh: null,
      };
      t.shares = t.shares.filter((x) => x.userId !== meId);
      t.shares.push(share);
      db.markDirty();
      return share;
    },
    async update(meId, coords, extra = {}) {
      const t = await db.load();
      const s = t.shares.find((x) => x.userId === meId);
      if (!s) return null;
      s.coords = coords;
      s.updatedAt = new Date().toISOString();
      if (extra.batteryPct !== undefined) s.batteryPct = extra.batteryPct;
      if (extra.altitudeM !== undefined) s.altitudeM = extra.altitudeM;
      if (extra.speedKmh !== undefined) s.speedKmh = extra.speedKmh;
      db.markDirty();
      return s;
    },
    async stop(meId) {
      const t = await db.load();
      t.shares = t.shares.filter((x) => x.userId !== meId);
      db.markDirty();
    },
  };

  /* ---------------------------------------------------------------- */
  /* Anlar                                                             */
  /* ---------------------------------------------------------------- */

  const stories: StoryRepository = {
    async groups(meId) {
      await delay(Math.min(latency, 150));
      const t = await db.load();
      const nowIso = new Date().toISOString();
      const active = t.stories.filter((s) => s.expiresAt > nowIso);
      const seen = new Set(t.storyViews.filter((v) => v.userId === meId).map((v) => v.storyId));
      const byAuthor = new Map<string, Story[]>();
      for (const s of active) byAuthor.set(s.authorId, [...(byAuthor.get(s.authorId) ?? []), s]);
      const groups: StoryGroup[] = [];
      for (const [authorId, list] of byAuthor) {
        const sorted = list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        groups.push({
          author: requireUser(t.users, authorId),
          stories: sorted,
          allSeen: sorted.every((s) => seen.has(s.id) || s.authorId === meId),
          latestAt: sorted[sorted.length - 1]?.createdAt ?? nowIso,
        });
      }
      // Kendi anım önce, sonra görülmemişler, sonra en yeni
      return groups.sort((a, b) => {
        if (a.author.id === meId) return -1;
        if (b.author.id === meId) return 1;
        if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
        return b.latestAt.localeCompare(a.latestAt);
      });
    },
    async create(meId, input: CreateStoryInput) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const story: Story = {
        id: generateId('st'),
        authorId: meId,
        mediaUrl: input.mediaUri,
        mediaType: 'image',
        caption: input.caption.trim(),
        adventureType: input.adventureType,
        locationName: input.locationName.trim() || me.locationName,
        coords: input.coords ?? me.coords,
        altitudeM: input.altitudeM ?? null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        viewsCount: 0,
      };
      t.stories.unshift(story);
      db.markDirty();
      for (const f of t.follows) {
        if (f.followingId === meId) {
          await pushNotification({
            type: 'story_posted',
            senderId: meId,
            receiverId: f.followerId,
            message: story.caption,
            postId: null,
            matchId: null,
            targetId: story.id,
          });
        }
      }
      return story;
    },
    async markSeen(meId, storyId) {
      const t = await db.load();
      if (t.storyViews.some((v) => v.userId === meId && v.storyId === storyId)) return;
      const story = t.stories.find((s) => s.id === storyId);
      if (!story || story.authorId === meId) return;
      t.storyViews.push({ userId: meId, storyId });
      story.viewsCount += 1;
      db.markDirty();
    },
  };

  /* ---------------------------------------------------------------- */
  /* İşletmeler & konaklama                                            */
  /* ---------------------------------------------------------------- */

  const withOwner = (b: Business, users: User[], origin: GeoPoint | null): BusinessWithOwner => ({
    ...b,
    owner: requireUser(users, b.ownerId),
    distanceKm: origin ? distanceKm(origin, b.coords) : null,
  });

  const businesses: BusinessRepository = {
    async list(filter: BusinessFilter = {}) {
      await wait();
      const t = await db.load();
      const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
      return t.businesses
        .filter((b) => !filter.type || b.type === filter.type)
        .filter((b) => !filter.staysOnly || b.priceFromTry !== null)
        .filter(
          (b) =>
            !q ||
            b.name.toLocaleLowerCase('tr-TR').includes(q) ||
            b.locationName.toLocaleLowerCase('tr-TR').includes(q) ||
            b.description.toLocaleLowerCase('tr-TR').includes(q),
        )
        .map((b) => withOwner(b, t.users, filter.origin ?? null))
        .sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;
        });
    },
    async getById(id, origin) {
      await wait();
      const t = await db.load();
      const b = t.businesses.find((x) => x.id === id);
      return b ? withOwner(b, t.users, origin) : null;
    },
    async register(meId, input: RegisterBusinessInput) {
      await wait();
      const t = await db.load();
      const owner = requireUser(t.users, meId);
      const business: Business = {
        id: generateId('biz'),
        ownerId: meId,
        name: input.name.trim(),
        type: input.type,
        description: input.description.trim(),
        locationName: input.locationName.trim() || owner.locationName,
        coords: owner.coords,
        imageUrl: null,
        rating: 0,
        reviewCount: 0,
        isVerified: false,
        priceFromTry: input.priceFromTry,
        amenities: input.amenities,
        adventureTypes: input.adventureTypes,
        website: input.website,
        phone: input.phone,
        plan: owner.plan === 'business' ? 'business' : 'free',
        isFeatured: false,
        createdAt: new Date().toISOString(),
      };
      t.businesses.push(business);
      db.markDirty();
      return withOwner(business, t.users, null);
    },
    async reserve(meId, input: CreateStayInput) {
      await wait();
      const t = await db.load();
      const b = t.businesses.find((x) => x.id === input.businessId);
      if (!b) throw new NotFoundError('İşletme', input.businessId);
      if (b.priceFromTry === null) throw new AuthError('Bu işletme konaklama sunmuyor.');
      const nights = nightsBetween(input.checkIn, input.checkOut);
      if (nights < 1) throw new AuthError('Çıkış tarihi girişten sonra olmalı.');
      const totals = stayTotal(b.priceFromTry, nights);
      const booking: StayBooking = {
        id: generateId('sb'),
        businessId: b.id,
        // Basit rezervasyon: envanter birimi seçilmez.
        unitId: null,
        guestId: meId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        nights,
        totalTry: totals.totalTry,
        platformFeeTry: totals.feeTry,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      t.stayBookings.unshift(booking);
      db.markDirty();
      await pushNotification({
        type: 'stay_request',
        senderId: meId,
        receiverId: b.ownerId,
        message: b.name,
        postId: null,
        matchId: null,
        targetId: booking.id,
      });
      return { ...booking, business: b };
    },
    async myStays(meId) {
      await wait();
      const t = await db.load();
      return t.stayBookings
        .filter((s) => s.guestId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map<StayBookingWithBusiness>((s) => ({
          ...s,
          business: t.businesses.find((b) => b.id === s.businessId)!,
        }));
    },
  };

  /* ---------------------------------------------------------------- */
  /* Abonelik                                                          */
  /* ---------------------------------------------------------------- */

  const billing: BillingRepository = {
    async currentPlan(meId) {
      const t = await db.load();
      return requireUser(t.users, meId).plan;
    },
    async subscribe(meId, plan) {
      await wait();
      const t = await db.load();
      const user = requireUser(t.users, meId);
      user.plan = plan;
      for (const b of t.businesses)
        if (b.ownerId === meId) b.plan = plan === 'business' ? 'business' : 'free';
      db.markDirty();
      return user;
    },
    async earnings(meId) {
      const t = await db.load();
      const user = requireUser(t.users, meId);
      const myInstructorIds = t.instructors.filter((i) => i.userId === meId).map((i) => i.id);
      const myBusinessIds = t.businesses.filter((b) => b.ownerId === meId).map((b) => b.id);
      const grossBookings = t.bookings.filter(
        (b) =>
          myInstructorIds.includes(b.instructorId) &&
          (b.status === 'confirmed' || b.status === 'completed'),
      );
      const grossStays = t.stayBookings.filter(
        (s) =>
          myBusinessIds.includes(s.businessId) &&
          (s.status === 'confirmed' || s.status === 'completed'),
      );
      const gross =
        grossBookings.reduce((a, b) => a + b.priceTry, 0) +
        grossStays.reduce((a, s) => a + s.totalTry - s.platformFeeTry, 0);
      const split = splitPayment(gross, user.plan);
      return {
        grossTry: split.grossTry,
        commissionTry: split.commissionTry,
        netTry: split.netTry,
        bookings: grossBookings.length + grossStays.length,
      };
    },
  };

  /* ---------------------------------------------------------------- */
  /* Acil durum                                                        */
  /* ---------------------------------------------------------------- */

  const emergency: EmergencyRepository = {
    async centers(origin, limit = 6) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      return nearestCenters(t.emergencyCenters, origin, { limit });
    },
    async triggerSos(meId, coords) {
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const event: SosEvent = {
        id: generateId('sos'),
        userId: meId,
        coords,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        notifiedContacts: me.emergencyContacts.length,
      };
      t.sosEvents.unshift(event);
      // SOS modunda canlı konum paylaşımı
      t.shares = t.shares.filter((x) => x.userId !== meId);
      t.shares.push({
        userId: meId,
        coords,
        mode: 'sos',
        startedAt: event.createdAt,
        expiresAt: null,
        updatedAt: event.createdAt,
        batteryPct: null,
        altitudeM: null,
        speedKmh: null,
      });
      db.markDirty();
      for (const c of me.emergencyContacts) {
        if (c.userId) {
          await pushNotification({
            type: 'sos_alert',
            senderId: meId,
            receiverId: c.userId,
            message: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
            postId: null,
            matchId: null,
            targetId: event.id,
          });
        }
      }
      return event;
    },
    async activeSos(meId) {
      const t = await db.load();
      return t.sosEvents.find((e) => e.userId === meId && !e.resolvedAt) ?? null;
    },
    async resolveSos(meId) {
      const t = await db.load();
      for (const e of t.sosEvents)
        if (e.userId === meId && !e.resolvedAt) e.resolvedAt = new Date().toISOString();
      t.shares = t.shares.filter((x) => !(x.userId === meId && x.mode === 'sos'));
      db.markDirty();
    },
    async updateContacts(meId, contacts) {
      await delay(Math.min(latency, 120));
      const t = await db.load();
      const me = requireUser(t.users, meId);
      me.emergencyContacts = contacts
        .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim() }))
        .filter((c) => c.name && c.phone);
      db.markDirty();
      return me;
    },
  };

  // nextRating: yorum ekleme akışı eklendiğinde kullanılacak; şimdilik referans olarak dışa aktarılıyor
  void nextRating;

  return {
    auth: atBoundary(auth),
    users: atBoundary(users),
    feed: atBoundary(feed),
    explore: atBoundary(explore),
    matches: atBoundary(matches),
    notifications: atBoundary(notifications),
    messages: atBoundary(messages),
    hazards: atBoundary(hazards),
    live: atBoundary(live),
    market: atBoundary(market),
    instructors: atBoundary(instructors),
    library: atBoundary(library),
    presence: atBoundary(presence),
    stories: atBoundary(stories),
    businesses: atBoundary(businesses),
    billing: atBoundary(billing),
    emergency: atBoundary(emergency),
    ai: atBoundary(createAiRepository(ctx)),
    maps: atBoundary(createMapsRepository(ctx)),
    climbing: atBoundary(createClimbingRepository(ctx)),
    satellite: atBoundary(createSatelliteRepository(ctx)),
    inventory: atBoundary(createInventoryRepository(ctx)),
    clubs: atBoundary(createClubRepository(ctx)),
    fun: atBoundary(createFunRepository(ctx)),
    destinations: atBoundary(createDestinationRepository(ctx)),
    vision: atBoundary(createVisionRepository(ctx)),
    social: atBoundary(createSocialRepository(ctx)),
    groups: atBoundary(createGroupRepository(ctx)),
    courses: atBoundary(createCourseRepository(ctx)),
    tracks: atBoundary(createTrackRepository(ctx)),
    weather: atBoundary(createWeatherRepository(ctx)),
    tv: atBoundary(createTvRepository(ctx)),
    heritage: atBoundary(createHeritageRepository(ctx)),
    kids: atBoundary(createKidsRepository(ctx)),
    // Demo verisinde canlı bir kaynak yok; ekranlar sorgulamaya devam eder.
    realtime: null,
    countries: atBoundary(createCountryRepository(ctx)),
    articles: atBoundary(createArticleRepository(ctx)),
    wildlife: atBoundary(createWildlifeRepository(ctx)),
    telemed: atBoundary(createTelemedRepository(ctx)),
    reset: () => db.reset(),
  };
}

/**
 * Repository sınırında sonuçları kopyalar; böylece bellek içi kayıtlar
 * UI tarafından doğrudan mutasyona uğratılamaz ve React Query önbelleği
 * yalnızca gerçek değişikliklerde yeni referans görür.
 */
function atBoundary<T extends object>(repo: T): T {
  const wrapped: Record<string, unknown> = {};
  for (const key of Object.keys(repo) as (keyof T & string)[]) {
    const fn = repo[key];
    if (typeof fn !== 'function') continue;
    wrapped[key] = async (...args: unknown[]) => {
      const result = await (fn as (...a: unknown[]) => Promise<unknown>).apply(repo, args);
      return result === undefined || result === null ? result : deepClone(result);
    };
  }
  return wrapped as T;
}
