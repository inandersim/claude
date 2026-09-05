import { deepClone } from '@/core/utils/clone';
import { generateId } from '@/core/utils/format';
import {
  computeTrustScore,
  filterListings,
  findMatchCandidates,
  nextRating,
  rankInstructors,
  selectHazards,
  distanceKm,
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

import type {
  AuthRepository,
  DataProvider,
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
import { MockDatabase, delay } from './database';
import { CURRENT_USER_ID } from './seed';

interface Options {
  persist?: boolean;
  latencyMs?: number;
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

export function createMockProvider(options: Options = {}): DataProvider {
  const db = new MockDatabase(options.persist ?? true);
  const latency = options.latencyMs ?? 260;
  const wait = () => delay(latency);

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

  const auth: AuthRepository = {
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
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
