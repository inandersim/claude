import {
  computeTrustScore,
  distanceKm,
  filterListings,
  findMatchCandidates,
  nearestCenters,
  rankInstructors,
  selectHazards,
  searchLibrary,
  countByCountry,
  expiresAtFor,
  nightsBetween,
  splitPayment,
  stayTotal,
  visibleShares,
  type Business,
  type BusinessWithOwner,
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
  type LocationShare,
  type Post,
  type Story,
  type StoryGroup,
  type User,
  type ZMatch,
  type ZMatchWithUsers,
} from '@/domain';

import type {
  AuthRepository,
  BillingRepository,
  BusinessRepository,
  EmergencyRepository,
  ExploreRepository,
  FeedRepository,
  HazardRepository,
  InstructorRepository,
  LibraryRepository,
  LiveRepository,
  MarketRepository,
  MatchRepository,
  MessageRepository,
  NotificationRepository,
  PresenceRepository,
  StoryRepository,
  UserRepository,
} from '../../repositories';
import {
  AuthError,
  NotFoundError,
  PROFILE_SELECT,
  fetchUser,
  fetchUsers,
  followerIds,
  notify,
  notifyMany,
  pickUser,
  requireUser,
  type RemoteContext,
} from '../context';
import {
  fromGeoPoint,
  toBooking,
  toBusiness,
  toComment,
  toEmergencyCenter,
  toHazard,
  toInstructor,
  toInstructorReview,
  toLibraryPlace,
  toListing,
  toLiveStream,
  toLocationShare,
  toMatch,
  toMessage,
  toNotification,
  toPost,
  toRoute,
  toSosEvent,
  toStayBooking,
  toStory,
  toStreamMessage,
  toTrendingLocation,
  toUser,
  num,
  requireGeoPoint,
} from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/** `ilike` süzgecini kırabilecek karakterleri temizler. */
function safeQuery(value: string): string {
  return value.trim().replace(/[(),"*]/g, ' ').trim();
}

/* ================================================================== */
/* Oturum & kullanıcılar                                              */
/* ================================================================== */

export function createAuthRepository(ctx: RemoteContext): AuthRepository {
  const { db } = ctx;
  return {
    async getSession() {
      const result = await db.auth.getUser();
      const id = result.data?.user?.id ?? null;
      ctx.setSessionUserId(id);
      if (!id) return null;
      return await fetchUser(db, id);
    },

    async signIn({ email, password }) {
      if (!email.includes('@')) throw new AuthError('Geçersiz e-posta.');
      if (password.length < 6) throw new AuthError('Şifre en az 6 karakter olmalı.');
      const result = await db.auth.signInWithPassword({ email, password });
      if (result.error) throw new AuthError(result.error.message);
      const id = result.data?.user?.id;
      if (!id) throw new AuthError('Oturum açılamadı.');
      ctx.setSessionUserId(id);
      return await requireUser(db, id);
    },

    async signUp({ email, password, username, displayName }) {
      if (!email.includes('@')) throw new AuthError('Geçersiz e-posta.');
      if (password.length < 6) throw new AuthError('Şifre en az 6 karakter olmalı.');
      const result = await db.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim().toLowerCase(), display_name: displayName.trim() } },
      });
      if (result.error) throw new AuthError(result.error.message);
      const id = result.data?.user?.id;
      if (!id) throw new AuthError('Kayıt tamamlanamadı.');
      ctx.setSessionUserId(id);
      // `handle_new_auth_user` tetikleyicisi profili oluşturur; adları garantiye alalım.
      const patch: Row = {};
      if (username.trim()) patch.username = username.trim().toLowerCase();
      if (displayName.trim()) patch.display_name = displayName.trim();
      if (Object.keys(patch).length) {
        await rows(db.from('profiles').update(patch).eq('id', id), 'profil güncellenemedi');
      }
      return await requireUser(db, id);
    },

    async signOut() {
      await db.auth.signOut();
      ctx.setSessionUserId(null);
    },
  };
}

export function createUserRepository(ctx: RemoteContext): UserRepository {
  const { db } = ctx;
  return {
    async getById(id) {
      return await fetchUser(db, id);
    },

    async search(query) {
      const q = safeQuery(query);
      if (!q) return [];
      const data = await rows(
        db
          .from('profiles')
          .select(PROFILE_SELECT)
          .or(`display_name.ilike.*${q}*,username.ilike.*${q}*,location_name.ilike.*${q}*`),
        'kullanıcı araması başarısız',
      );
      return data.map(toUser);
    },

    async isFollowing(followerId, followingId) {
      const row = await maybeRow(
        db
          .from('follows')
          .select('follower_id')
          .eq('follower_id', followerId)
          .eq('following_id', followingId),
        'takip durumu okunamadı',
      );
      return row !== null;
    },

    async toggleFollow(followerId, followingId) {
      const existing = await maybeRow(
        db
          .from('follows')
          .select('follower_id')
          .eq('follower_id', followerId)
          .eq('following_id', followingId),
        'takip durumu okunamadı',
      );
      if (existing) {
        await rows(
          db.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId),
          'takipten çıkılamadı',
        );
        return { following: false };
      }
      await rows(
        db.from('follows').insert({ follower_id: followerId, following_id: followingId }),
        'takip edilemedi',
      );
      await notify(db, {
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
      const payload: Row = {};
      if (patch.displayName !== undefined) payload.display_name = patch.displayName;
      if (patch.bio !== undefined) payload.bio = patch.bio;
      if (patch.locationName !== undefined) payload.location_name = patch.locationName;
      if (patch.favoriteTypes !== undefined) payload.favorite_types = patch.favoriteTypes;
      if (Object.keys(payload).length) {
        await rows(db.from('profiles').update(payload).eq('id', id), 'profil güncellenemedi');
      }
      return await requireUser(db, id);
    },
  };
}

/* ================================================================== */
/* Akış                                                               */
/* ================================================================== */

const POST_SELECT = `*, author:profiles!author_id(${PROFILE_SELECT})`;

export function createFeedRepository(ctx: RemoteContext): FeedRepository {
  const { db } = ctx;

  /** Görüntüleyenin beğendiği gönderi kimlikleri (tek istekte). */
  const likedIds = async (viewerId: ID, postIds: ID[]): Promise<Set<ID>> => {
    if (!postIds.length) return new Set();
    const data = await rows(
      db.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
      'beğeniler okunamadı',
    );
    return new Set(data.map((row) => String(row.post_id)));
  };

  const toFeedPosts = async (data: Row[], viewerId: ID): Promise<FeedPost[]> => {
    const posts = data.map((row) => ({ row, post: toPost(row) }));
    const liked = await likedIds(
      viewerId,
      posts.map((p) => p.post.id),
    );
    return posts.map(({ row, post }) => ({
      ...post,
      author: toUser((row.author ?? {}) as Row),
      likedByMe: liked.has(post.id),
    }));
  };

  /** Gönderi sonrası profil sayaçlarını ve güven skorunu mock ile aynı şekilde tazeler. */
  const refreshAuthorStats = async (authorId: ID, addedDistanceKm: number): Promise<void> => {
    const profile = await oneRow(
      db.from('profiles').select(PROFILE_SELECT).eq('id', authorId),
      'profil okunamadı',
    );
    const user = toUser(profile);
    const authored = await rows(
      db.from('posts').select('id, is_verified_info').eq('author_id', authorId),
      'gönderiler okunamadı',
    );
    const accepted = await rows(
      db
        .from('matches')
        .select('id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${authorId},receiver_id.eq.${authorId}`),
      'eşleşmeler okunamadı',
    );
    const totalDistance = Math.round((user.totalDistanceKm + addedDistanceKm) * 10) / 10;
    const trustScore = computeTrustScore({
      isVerified: user.isVerified,
      totalPosts: authored.length,
      verifiedPosts: authored.filter((row) => row.is_verified_info === true).length,
      acceptedMatches: accepted.length,
      followersCount: user.followersCount,
    });
    await rows(
      db
        .from('profiles')
        .update({
          total_adventures: user.totalAdventures + 1,
          total_distance_km: totalDistance,
          trust_score: trustScore,
        })
        .eq('id', authorId),
      'profil sayaçları güncellenemedi',
    );
  };

  return {
    async list(viewerId, filter = {}) {
      let query = db.from('posts').select(POST_SELECT).order('created_at', { ascending: false });
      if (filter.adventureType) query = query.eq('adventure_type', filter.adventureType);
      if (filter.authorId) query = query.eq('author_id', filter.authorId);
      if (filter.locationName) {
        query = query.ilike('location_name', `*${safeQuery(filter.locationName)}*`);
      }
      const data = await rows(query, 'akış okunamadı');
      return await toFeedPosts(data, viewerId);
    },

    async getById(viewerId, postId) {
      const row = await maybeRow(
        db.from('posts').select(POST_SELECT).eq('id', postId),
        'gönderi okunamadı',
      );
      if (!row) return null;
      const [post] = await toFeedPosts([row], viewerId);
      return post ?? null;
    },

    async create(authorId, input) {
      const author = await requireUser(db, authorId);
      const created = await oneRow(
        db
          .from('posts')
          .insert({
            author_id: authorId,
            kind: 'adventure',
            image_url: input.imageUri,
            images: input.imageUri ? [input.imageUri] : [],
            caption: input.caption.trim(),
            adventure_type: input.adventureType,
            difficulty: input.difficulty,
            trail_condition: input.trailCondition,
            altitude_m: input.altitudeM,
            distance_km: input.distanceKm,
            temperature_c: input.temperatureC,
            wind_kmh: input.windKmh,
            duration_min: input.durationMin,
            location_name: input.locationName.trim(),
            coords: fromGeoPoint(input.coords ?? author.coords),
            is_verified_info: author.isVerified,
          })
          .select(POST_SELECT),
        'gönderi oluşturulamadı',
      );
      await refreshAuthorStats(authorId, input.distanceKm);
      const [post] = await toFeedPosts([created], authorId);
      if (!post) throw new NotFoundError('Gönderi', String(created.id));
      // Yazar sayaçları güncellendi; yazar bilgisini tazele.
      return { ...post, author: await requireUser(db, authorId) };
    },

    async toggleLike(viewerId, postId) {
      const post = await maybeRow(
        db.from('posts').select('id, author_id, likes_count').eq('id', postId),
        'gönderi okunamadı',
      );
      if (!post) throw new NotFoundError('Gönderi', postId);
      const existing = await maybeRow(
        db.from('post_likes').select('post_id').eq('user_id', viewerId).eq('post_id', postId),
        'beğeni okunamadı',
      );
      if (existing) {
        await rows(
          db.from('post_likes').delete().eq('user_id', viewerId).eq('post_id', postId),
          'beğeni kaldırılamadı',
        );
      } else {
        await rows(
          db.from('post_likes').insert({ user_id: viewerId, post_id: postId }),
          'beğenilemedi',
        );
        await notify(db, {
          type: 'like',
          senderId: viewerId,
          receiverId: String(post.author_id),
          message: '',
          postId,
          matchId: null,
        });
      }
      // Sayaç tetikleyici tarafından güncellenir; taze değeri oku.
      const fresh = await oneRow(
        db.from('posts').select('likes_count').eq('id', postId),
        'gönderi okunamadı',
      );
      return { liked: !existing, likesCount: num(fresh.likes_count) };
    },

    async listComments(postId) {
      const data = await rows(
        db
          .from('comments')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
        'yorumlar okunamadı',
      );
      return data.map((row) => ({ ...toComment(row), author: toUser((row.author ?? {}) as Row) }));
    },

    async addComment(authorId, postId, content) {
      const post = await maybeRow(
        db.from('posts').select('id, author_id').eq('id', postId),
        'gönderi okunamadı',
      );
      if (!post) throw new NotFoundError('Gönderi', postId);
      const created = await oneRow(
        db
          .from('comments')
          .insert({ post_id: postId, author_id: authorId, content: content.trim() })
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`),
        'yorum eklenemedi',
      );
      await notify(db, {
        type: 'comment',
        senderId: authorId,
        receiverId: String(post.author_id),
        message: content.trim(),
        postId,
        matchId: null,
      });
      return { ...toComment(created), author: toUser((created.author ?? {}) as Row) };
    },

    async getRoute(routeId) {
      const row = await maybeRow(db.from('routes').select('*').eq('id', routeId), 'rota okunamadı');
      return row ? toRoute(row) : null;
    },
  };
}

/* ================================================================== */
/* Keşfet                                                             */
/* ================================================================== */

export function createExploreRepository(ctx: RemoteContext): ExploreRepository {
  const { db } = ctx;
  return {
    async trendingLocations() {
      const data = await rows(
        db.from('trending_locations').select('*').order('trend_percent', { ascending: false }),
        'popüler yerler okunamadı',
      );
      return data.map(toTrendingLocation);
    },

    async getLocation(id) {
      const row = await maybeRow(
        db.from('trending_locations').select('*').eq('id', id),
        'yer okunamadı',
      );
      return row ? toTrendingLocation(row) : null;
    },

    async popularRoutes() {
      const data = await rows(db.from('routes').select('*'), 'rotalar okunamadı');
      return data.map(toRoute);
    },

    async search(query) {
      const q = safeQuery(query);
      if (!q) return { locations: [], users: [], routes: [] };
      const [locations, users, routes] = await Promise.all([
        rows(
          db
            .from('trending_locations')
            .select('*')
            .or(`name.ilike.*${q}*,region.ilike.*${q}*`),
          'yer araması başarısız',
        ),
        rows(
          db
            .from('profiles')
            .select(PROFILE_SELECT)
            .or(`display_name.ilike.*${q}*,username.ilike.*${q}*`),
          'kullanıcı araması başarısız',
        ),
        rows(
          db.from('routes').select('*').or(`name.ilike.*${q}*,location_name.ilike.*${q}*`),
          'rota araması başarısız',
        ),
      ]);
      return {
        locations: locations.map(toTrendingLocation),
        users: users.map(toUser),
        routes: routes.map(toRoute),
      };
    },
  };
}

/* ================================================================== */
/* Eşleşmeler                                                         */
/* ================================================================== */

export function createMatchRepository(ctx: RemoteContext): MatchRepository {
  const { db } = ctx;

  const withUsers = async (matches: ZMatch[]): Promise<ZMatchWithUsers[]> => {
    const users = await fetchUsers(db, matches.flatMap((m) => [m.requesterId, m.receiverId]));
    return matches.map((m) => ({
      ...m,
      requester: pickUser(users, m.requesterId),
      receiver: pickUser(users, m.receiverId),
    }));
  };

  const one = async (match: ZMatch): Promise<ZMatchWithUsers> => {
    const [result] = await withUsers([match]);
    if (!result) throw new NotFoundError('Eşleşme', match.id);
    return result;
  };

  return {
    async candidates(meId, origin, radiusKm, type) {
      const me = await requireUser(db, meId);
      // Uzamsal ön eleme sunucuda (RPC), iş kuralları domain fonksiyonunda.
      const shortlist = await rows(
        db.rpc('match_candidates', {
          origin_lat: origin.latitude,
          origin_lng: origin.longitude,
          radius_km: radiusKm,
          want: type ?? null,
          max_rows: 200,
        }),
        'aday araması başarısız',
      );
      const ids = shortlist.map((row) => String(row.user_id));
      if (!ids.length) return [];
      const [profiles, matchRows] = await Promise.all([
        rows(db.from('profiles').select(PROFILE_SELECT).in('id', ids), 'profiller okunamadı'),
        rows(
          db
            .from('matches')
            .select('*')
            .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`),
          'eşleşmeler okunamadı',
        ),
      ]);
      return findMatchCandidates({
        me,
        origin,
        users: profiles.map(toUser),
        matches: matchRows.map(toMatch),
        radiusKm,
        adventureType: type ?? null,
      });
    },

    async listMine(meId) {
      const data = await rows(
        db
          .from('matches')
          .select('*')
          .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`)
          .order('created_at', { ascending: false }),
        'eşleşmeler okunamadı',
      );
      return await withUsers(data.map(toMatch));
    },

    async getById(id) {
      const row = await maybeRow(db.from('matches').select('*').eq('id', id), 'eşleşme okunamadı');
      return row ? await one(toMatch(row)) : null;
    },

    async request(meId, input) {
      const pending = await rows(
        db
          .from('matches')
          .select('*')
          .eq('status', 'pending')
          .or(
            `and(requester_id.eq.${meId},receiver_id.eq.${input.receiverId}),` +
              `and(requester_id.eq.${input.receiverId},receiver_id.eq.${meId})`,
          )
          .limit(1),
        'eşleşme okunamadı',
      );
      const existing = pending[0];
      if (existing) return await one(toMatch(existing));

      const created = await oneRow(
        db
          .from('matches')
          .insert({
            requester_id: meId,
            receiver_id: input.receiverId,
            status: 'pending',
            message: input.message.trim(),
            planned_date: input.plannedDate,
            location_name: input.locationName,
            adventure_type: input.adventureType,
          })
          .select('*'),
        'eşleşme isteği gönderilemedi',
      );
      await notify(db, {
        type: 'match_request',
        senderId: meId,
        receiverId: input.receiverId,
        message: input.locationName ?? '',
        postId: null,
        matchId: String(created.id),
      });
      return await one(toMatch(created));
    },

    async respond(meId, matchId, accept) {
      const row = await maybeRow(
        db.from('matches').select('*').eq('id', matchId),
        'eşleşme okunamadı',
      );
      if (!row) throw new NotFoundError('Eşleşme', matchId);
      if (String(row.receiver_id) !== meId) {
        throw new AuthError('Bu isteğe yalnızca alıcı yanıt verebilir.');
      }
      const updated = await oneRow(
        db
          .from('matches')
          .update({
            status: accept ? 'accepted' : 'rejected',
            responded_at: new Date().toISOString(),
          })
          .eq('id', matchId)
          .select('*'),
        'eşleşme güncellenemedi',
      );
      await notify(db, {
        type: accept ? 'match_accepted' : 'match_rejected',
        senderId: meId,
        receiverId: String(row.requester_id),
        message: row.location_name ? String(row.location_name) : '',
        postId: null,
        matchId,
      });
      return await one(toMatch(updated));
    },
  };
}

/* ================================================================== */
/* Bildirimler & mesajlar                                             */
/* ================================================================== */

export function createNotificationRepository(ctx: RemoteContext): NotificationRepository {
  const { db } = ctx;
  return {
    async list(meId) {
      const data = await rows(
        db
          .from('notifications')
          .select(`*, sender:profiles!sender_id(${PROFILE_SELECT})`)
          .eq('receiver_id', meId)
          .order('created_at', { ascending: false }),
        'bildirimler okunamadı',
      );
      return data.map((row) => ({
        ...toNotification(row),
        sender: toUser((row.sender ?? {}) as Row),
      }));
    },

    async unreadCount(meId) {
      const data = await rows(
        db.from('notifications').select('id').eq('receiver_id', meId).is('is_read', false),
        'okunmamış bildirimler okunamadı',
      );
      return data.length;
    },

    async markRead(meId, id) {
      await rows(
        db
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('receiver_id', meId)
          .is('is_read', false),
        'bildirim güncellenemedi',
      );
    },

    async markAllRead(meId) {
      await rows(
        db
          .from('notifications')
          .update({ is_read: true })
          .eq('receiver_id', meId)
          .is('is_read', false),
        'bildirimler güncellenemedi',
      );
    },
  };
}

export function createMessageRepository(ctx: RemoteContext): MessageRepository {
  const { db } = ctx;
  return {
    async thread(meId, otherId) {
      const data = await rows(
        db
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`,
          )
          .order('created_at', { ascending: true }),
        'mesajlar okunamadı',
      );
      const list = data.map(toMessage);
      const unread = list.filter((m) => m.receiverId === meId && !m.readAt).map((m) => m.id);
      if (unread.length) {
        const readAt = new Date().toISOString();
        await rows(
          db.from('messages').update({ read_at: readAt }).in('id', unread),
          'mesajlar okundu işaretlenemedi',
        );
        return list.map((m) => (unread.includes(m.id) ? { ...m, readAt } : m));
      }
      return list;
    },

    async send(meId, otherId, content, matchId = null) {
      const created = await oneRow(
        db
          .from('messages')
          .insert({
            sender_id: meId,
            receiver_id: otherId,
            content: content.trim(),
            match_id: matchId ?? null,
          })
          .select('*'),
        'mesaj gönderilemedi',
      );
      await notify(db, {
        type: 'message',
        senderId: meId,
        receiverId: otherId,
        message: content.trim(),
        postId: null,
        matchId: matchId ?? null,
      });
      return toMessage(created);
    },
  };
}

/* ================================================================== */
/* Tehlikeler                                                          */
/* ================================================================== */

export function createHazardRepository(ctx: RemoteContext): HazardRepository {
  const { db } = ctx;

  const enrich = async (
    hazards: HazardZone[],
    meId: ID,
    origin: GeoPoint | null,
  ): Promise<HazardZoneWithReporter[]> => {
    const reporters = await fetchUsers(db, hazards.map((h) => h.reporterId));
    const ids = hazards.map((h) => h.id);
    const confirmed = ids.length
      ? await rows(
          db.from('hazard_confirmations').select('hazard_id').eq('user_id', meId).in('hazard_id', ids),
          'tehlike onayları okunamadı',
        )
      : [];
    const mine = new Set(confirmed.map((row) => String(row.hazard_id)));
    return hazards.map((h) => ({
      ...h,
      reporter: pickUser(reporters, h.reporterId),
      confirmedByMe: mine.has(h.id),
      distanceKm: origin ? distanceKm(origin, h.coords) : null,
    }));
  };

  const one = async (id: ID, meId: ID, origin: GeoPoint | null) => {
    const row = await oneRow(db.from('hazards').select('*').eq('id', id), 'tehlike okunamadı');
    const [result] = await enrich([toHazard(row)], meId, origin);
    if (!result) throw new NotFoundError('Tehlike', id);
    return result;
  };

  return {
    async list(meId, origin, radiusKm, includeResolved = false) {
      const data = await rows(db.from('hazards').select('*'), 'tehlikeler okunamadı');
      const selected = selectHazards({
        hazards: data.map(toHazard),
        origin,
        radiusKm,
        includeResolved,
      });
      return await enrich(
        selected.map(({ hazard }) => hazard),
        meId,
        origin,
      );
    },

    async getById(meId, id, origin) {
      const row = await maybeRow(db.from('hazards').select('*').eq('id', id), 'tehlike okunamadı');
      if (!row) return null;
      const [result] = await enrich([toHazard(row)], meId, origin);
      return result ?? null;
    },

    async report(meId, input) {
      const created = await oneRow(
        db
          .from('hazards')
          .insert({
            type: input.type,
            severity: input.severity,
            status: 'active',
            title: input.title.trim(),
            description: input.description.trim(),
            location_name: input.locationName.trim(),
            coords: fromGeoPoint(input.coords),
            radius_m: input.radiusM,
            reporter_id: meId,
            expires_at: input.expiresInHours
              ? new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString()
              : null,
          })
          .select('*'),
        'tehlike bildirilemedi',
      );
      // Etki alanına 25 km'den yakın kullanıcıları uyar (mock ile aynı kural).
      const profiles = await rows(db.from('profiles').select('id, coords'), 'profiller okunamadı');
      const receivers = profiles
        .filter((row) => String(row.id) !== meId)
        .filter((row) => distanceKm(requireGeoPoint(row.coords), input.coords) <= 25)
        .map((row) => String(row.id));
      await notifyMany(db, receivers, {
        type: 'hazard_alert',
        senderId: meId,
        message: input.title.trim(),
        postId: null,
        matchId: null,
        targetId: String(created.id),
      });
      const [result] = await enrich([toHazard(created)], meId, input.coords);
      if (!result) throw new NotFoundError('Tehlike', String(created.id));
      return result;
    },

    async confirm(meId, id) {
      const row = await maybeRow(
        db.from('hazards').select('id, reporter_id, title').eq('id', id),
        'tehlike okunamadı',
      );
      if (!row) throw new NotFoundError('Tehlike', id);
      if (String(row.reporter_id) === meId) {
        throw new AuthError('Kendi bildirdiğin tehlikeyi onaylayamazsın.');
      }
      const existing = await maybeRow(
        db.from('hazard_confirmations').select('hazard_id').eq('user_id', meId).eq('hazard_id', id),
        'onay okunamadı',
      );
      if (!existing) {
        await rows(
          db.from('hazard_confirmations').insert({ user_id: meId, hazard_id: id }),
          'tehlike onaylanamadı',
        );
        await notify(db, {
          type: 'hazard_confirmed',
          senderId: meId,
          receiverId: String(row.reporter_id),
          message: String(row.title ?? ''),
          postId: null,
          matchId: null,
          targetId: id,
        });
      }
      return await one(id, meId, null);
    },

    async resolve(meId, id) {
      const row = await maybeRow(
        db.from('hazards').select('id, reporter_id').eq('id', id),
        'tehlike okunamadı',
      );
      if (!row) throw new NotFoundError('Tehlike', id);
      if (String(row.reporter_id) !== meId) {
        throw new AuthError('Yalnızca bildiren kişi çözüldü olarak işaretleyebilir.');
      }
      // `sync_hazard_resolution` tetikleyicisi resolved_at alanını doldurur.
      await rows(
        db.from('hazards').update({ status: 'resolved' }).eq('id', id),
        'tehlike güncellenemedi',
      );
      return await one(id, meId, null);
    },
  };
}
