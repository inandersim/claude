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
  type Story,
  type StoryGroup,
  type ZMatch,
  type ZMatchWithUsers,
} from '@/domain';
import { gecerliOlcum } from '@/domain/altitude';

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
import { FEED_PAGE_SIZE } from '../../repositories';
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
  return value
    .trim()
    .replace(/[(),"*]/g, ' ')
    .trim();
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
        options: {
          data: { username: username.trim().toLowerCase(), display_name: displayName.trim() },
        },
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
      if (patch.baselineRestingHr !== undefined) {
        // Sınır dışı değer kırpılmaz, düşürülür: uydurma bir bazal, bazal
        // olmamasından kötüdür — nabız sapmasını sistematik olarak yanıltır.
        payload.baseline_resting_hr = gecerliOlcum('restingHr', patch.baselineRestingHr);
      }
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
      // Kürsör: bu tarihten eski gönderiler. Ofset değil, çünkü akışa sürekli
      // yeni gönderi ekleniyor ve ofsetli sayfalamada araya giren bir gönderi
      // sonraki sayfayı kaydırır — kullanıcı aynı kaydı iki kez görür.
      if (filter.before) query = query.lt('created_at', filter.before);
      // Ölçülen: bu satır (gönderi + gömülü yazar profili) ~2 KB. Tavan
      // olmadan PostgREST 1.000 satır dönüyor, yani her açılışta ~2 MB.
      const data = await rows(query, 'akış okunamadı', {
        limit: filter.limit ?? FEED_PAGE_SIZE,
      });
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
          db.from('trending_locations').select('*').or(`name.ilike.*${q}*,region.ilike.*${q}*`),
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
    const users = await fetchUsers(
      db,
      matches.flatMap((m) => [m.requesterId, m.receiverId]),
    );
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
          db.from('matches').select('*').or(`requester_id.eq.${meId},receiver_id.eq.${meId}`),
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
          ,
        'eşleşme okunamadı',
        { limit: 1 },
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

    async registerPushToken(meId, token) {
      // Satır bazlı upsert: dizi sütunundaki oku-birleştir-yaz yarışı yok.
      // `last_seen_at` her açılışta tazeleniyor; ölü cihazları ayıklamak
      // isteyen bir temizlik işi buna bakabilir.
      await rows(
        db.from('push_tokens').upsert(
          { user_id: meId, token, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,token' },
        ),
        'bildirim adresi kaydedilemedi',
      );
    },

    async unregisterPushToken(meId, token) {
      await rows(
        db.from('push_tokens').delete().eq('user_id', meId).eq('token', token),
        'bildirim adresi silinemedi',
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
    const reporters = await fetchUsers(
      db,
      hazards.map((h) => h.reporterId),
    );
    const ids = hazards.map((h) => h.id);
    const confirmed = ids.length
      ? await rows(
          db
            .from('hazard_confirmations')
            .select('hazard_id')
            .eq('user_id', meId)
            .in('hazard_id', ids),
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

/* ================================================================== */
/* Canlı yayın                                                        */
/* ================================================================== */

const STREAM_ORDER: Record<LiveStream['status'], number> = { live: 0, scheduled: 1, ended: 2 };

export function createLiveRepository(ctx: RemoteContext): LiveRepository {
  const { db } = ctx;
  const STREAM_SELECT = `*, host:profiles!host_id(${PROFILE_SELECT})`;

  const withHost = (row: Row): LiveStreamWithHost => ({
    ...toLiveStream(row),
    host: toUser((row.host ?? {}) as Row),
  });

  const one = async (id: ID): Promise<LiveStreamWithHost> => {
    const row = await oneRow(
      db.from('live_streams').select(STREAM_SELECT).eq('id', id),
      'yayın okunamadı',
    );
    return withHost(row);
  };

  return {
    async list() {
      const data = await rows(db.from('live_streams').select(STREAM_SELECT), 'yayınlar okunamadı');
      return data.map(withHost).sort((a, b) => {
        if (STREAM_ORDER[a.status] !== STREAM_ORDER[b.status]) {
          return STREAM_ORDER[a.status] - STREAM_ORDER[b.status];
        }
        if (a.status === 'live') return b.viewerCount - a.viewerCount;
        if (a.status === 'scheduled')
          return (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '');
        return (b.endedAt ?? '').localeCompare(a.endedAt ?? '');
      });
    },

    async getById(id) {
      const row = await maybeRow(
        db.from('live_streams').select(STREAM_SELECT).eq('id', id),
        'yayın okunamadı',
      );
      return row ? withHost(row) : null;
    },

    async messages(streamId) {
      const data = await rows(
        db
          .from('stream_messages')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('stream_id', streamId)
          .order('created_at', { ascending: true }),
        'yayın mesajları okunamadı',
      );
      return data.map((row) => ({
        ...toStreamMessage(row),
        author: toUser((row.author ?? {}) as Row),
      }));
    },

    async sendMessage(meId, streamId, content) {
      const created = await oneRow(
        db
          .from('stream_messages')
          .insert({ stream_id: streamId, author_id: meId, content: content.trim() })
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`),
        'mesaj gönderilemedi',
      );
      return { ...toStreamMessage(created), author: toUser((created.author ?? {}) as Row) };
    },

    async start(meId, input) {
      const host = await requireUser(db, meId);
      const nowIso = new Date().toISOString();
      // Aynı kullanıcının açık yayınlarını kapat.
      await rows(
        db
          .from('live_streams')
          .update({ status: 'ended', ended_at: nowIso })
          .eq('host_id', meId)
          .eq('status', 'live'),
        'önceki yayın kapatılamadı',
      );
      const created = await oneRow(
        db
          .from('live_streams')
          .insert({
            host_id: meId,
            title: input.title.trim(),
            description: input.description.trim(),
            adventure_type: input.adventureType,
            status: 'live',
            location_name: input.locationName.trim() || host.locationName,
            coords: fromGeoPoint(input.coords ?? host.coords),
            viewer_count: 1,
            peak_viewers: 1,
            playback_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            started_at: nowIso,
            source: input.source ?? 'camera',
            drone_telemetry:
              input.source === 'drone'
                ? {
                    altitudeM: 120,
                    speedKmh: 0,
                    batteryPct: 100,
                    headingDeg: 0,
                    distanceFromPilotM: 0,
                  }
                : null,
          })
          .select(STREAM_SELECT),
        'yayın başlatılamadı',
      );
      await notifyMany(db, await followerIds(db, meId), {
        type: 'stream_live',
        senderId: meId,
        message: input.title.trim(),
        postId: null,
        matchId: null,
        targetId: String(created.id),
      });
      return withHost(created);
    },

    async end(meId, streamId) {
      const row = await maybeRow(
        db.from('live_streams').select('id, host_id').eq('id', streamId),
        'yayın okunamadı',
      );
      if (!row) throw new NotFoundError('Yayın', streamId);
      if (String(row.host_id) !== meId) throw new AuthError('Yalnızca yayıncı yayını bitirebilir.');
      await rows(
        db
          .from('live_streams')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            viewer_count: 0,
            playback_url:
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          })
          .eq('id', streamId),
        'yayın bitirilemedi',
      );
      return await one(streamId);
    },

    async like(streamId) {
      const row = await maybeRow(
        db.from('live_streams').select('id, likes_count').eq('id', streamId),
        'yayın okunamadı',
      );
      if (!row) throw new NotFoundError('Yayın', streamId);
      await rows(
        db
          .from('live_streams')
          .update({ likes_count: num(row.likes_count) + 1 })
          .eq('id', streamId),
        'beğeni yazılamadı',
      );
      return { likesCount: num(row.likes_count) + 1 };
    },

    async join(streamId) {
      const row = await maybeRow(
        db.from('live_streams').select('id, status, viewer_count, peak_viewers').eq('id', streamId),
        'yayın okunamadı',
      );
      if (!row || row.status !== 'live') return;
      const next = num(row.viewer_count) + 1;
      await rows(
        db
          .from('live_streams')
          .update({ viewer_count: next, peak_viewers: Math.max(num(row.peak_viewers), next) })
          .eq('id', streamId),
        'izleyici sayacı güncellenemedi',
      );
    },

    async leave(streamId) {
      const row = await maybeRow(
        db.from('live_streams').select('id, status, viewer_count').eq('id', streamId),
        'yayın okunamadı',
      );
      if (!row || row.status !== 'live' || num(row.viewer_count) <= 0) return;
      await rows(
        db
          .from('live_streams')
          .update({ viewer_count: num(row.viewer_count) - 1 })
          .eq('id', streamId),
        'izleyici sayacı güncellenemedi',
      );
    },
  };
}

/* ================================================================== */
/* Market                                                            */
/* ================================================================== */

export function createMarketRepository(ctx: RemoteContext): MarketRepository {
  const { db } = ctx;

  const enrich = async (listings: Listing[], viewerId: ID): Promise<ListingWithSeller[]> => {
    const sellers = await fetchUsers(
      db,
      listings.map((l) => l.sellerId),
    );
    const ids = listings.map((l) => l.id);
    const favorites = ids.length
      ? await rows(
          db
            .from('listing_favorites')
            .select('listing_id')
            .eq('user_id', viewerId)
            .in('listing_id', ids),
          'favoriler okunamadı',
        )
      : [];
    const mine = new Set(favorites.map((row) => String(row.listing_id)));
    return listings.map((l) => ({
      ...l,
      seller: pickUser(sellers, l.sellerId),
      favoritedByMe: mine.has(l.id),
    }));
  };

  return {
    async list(viewerId, filter = {}) {
      const data = await rows(db.from('listings').select('*'), 'ilanlar okunamadı');
      return await enrich(filterListings(data.map(toListing), filter), viewerId);
    },

    async getById(viewerId, id) {
      const row = await maybeRow(db.from('listings').select('*').eq('id', id), 'ilan okunamadı');
      if (!row) return null;
      const [result] = await enrich([toListing(row)], viewerId);
      return result ?? null;
    },

    async create(sellerId, input) {
      const seller = await requireUser(db, sellerId);
      const created = await oneRow(
        db
          .from('listings')
          .insert({
            seller_id: sellerId,
            title: input.title.trim(),
            description: input.description.trim(),
            price_try: Math.max(0, Math.round(input.priceTry)),
            category: input.category,
            condition: input.condition,
            image_urls: input.imageUri ? [input.imageUri] : [],
            location_name: input.locationName.trim() || seller.locationName,
            coords: fromGeoPoint(seller.coords),
            adventure_types: input.adventureTypes,
          })
          .select('*'),
        'ilan oluşturulamadı',
      );
      const [result] = await enrich([toListing(created)], sellerId);
      if (!result) throw new NotFoundError('İlan', String(created.id));
      return result;
    },

    async toggleFavorite(viewerId, id) {
      const listing = await maybeRow(
        db.from('listings').select('id').eq('id', id),
        'ilan okunamadı',
      );
      if (!listing) throw new NotFoundError('İlan', id);
      const existing = await maybeRow(
        db
          .from('listing_favorites')
          .select('listing_id')
          .eq('user_id', viewerId)
          .eq('listing_id', id),
        'favori okunamadı',
      );
      if (existing) {
        await rows(
          db.from('listing_favorites').delete().eq('user_id', viewerId).eq('listing_id', id),
          'favori kaldırılamadı',
        );
      } else {
        await rows(
          db.from('listing_favorites').insert({ user_id: viewerId, listing_id: id }),
          'favoriye eklenemedi',
        );
      }
      const fresh = await oneRow(
        db.from('listings').select('favorites_count').eq('id', id),
        'ilan okunamadı',
      );
      return { favorited: !existing, favoritesCount: num(fresh.favorites_count) };
    },

    async markSold(sellerId, id) {
      const row = await maybeRow(
        db.from('listings').select('id, seller_id').eq('id', id),
        'ilan okunamadı',
      );
      if (!row) throw new NotFoundError('İlan', id);
      if (String(row.seller_id) !== sellerId)
        throw new AuthError('Yalnızca satıcı ilanı kapatabilir.');
      const updated = await oneRow(
        db
          .from('listings')
          .update({ is_sold: true, sold_at: new Date().toISOString() })
          .eq('id', id)
          .select('*'),
        'ilan kapatılamadı',
      );
      const [result] = await enrich([toListing(updated)], sellerId);
      if (!result) throw new NotFoundError('İlan', id);
      return result;
    },
  };
}

/* ================================================================== */
/* Eğitmenler                                                         */
/* ================================================================== */

export function createInstructorRepository(ctx: RemoteContext): InstructorRepository {
  const { db } = ctx;

  const withUser = async (
    instructor: Instructor,
    origin: GeoPoint | null,
  ): Promise<InstructorWithUser> => ({
    ...instructor,
    user: await requireUser(db, instructor.userId),
    distanceKm: origin ? distanceKm(origin, instructor.coords) : null,
  });

  const bookingWithParties = async (bookingRows: Row[]) => {
    const bookings = bookingRows.map(toBooking);
    const instructorIds = bookings.map((b) => b.instructorId);
    const instructorRows = instructorIds.length
      ? await rows(
          db.from('instructors').select('*').in('id', instructorIds),
          'eğitmenler okunamadı',
        )
      : [];
    const instructors = new Map(instructorRows.map((row) => [String(row.id), toInstructor(row)]));
    const users = await fetchUsers(db, [
      ...bookings.map((b) => b.studentId),
      ...instructorRows.map((row) => String(row.user_id)),
    ]);
    return bookings.map((b) => {
      const instructor = instructors.get(b.instructorId);
      if (!instructor) throw new NotFoundError('Eğitmen', b.instructorId);
      return {
        ...b,
        instructor: { ...instructor, user: pickUser(users, instructor.userId), distanceKm: null },
        student: pickUser(users, b.studentId),
      };
    });
  };

  return {
    async list(origin, filter = {}) {
      const data = await rows(db.from('instructors').select('*'), 'eğitmenler okunamadı');
      const instructors = data.map(toInstructor);
      const users = await fetchUsers(
        db,
        instructors.map((i) => i.userId),
      );
      return rankInstructors({
        instructors,
        users: Array.from(users.values()),
        origin,
        filter,
      }).map((r) => ({ ...r.instructor, user: r.user, distanceKm: r.distanceKm }));
    },

    async getById(id, origin) {
      const row = await maybeRow(
        db.from('instructors').select('*').eq('id', id),
        'eğitmen okunamadı',
      );
      return row ? await withUser(toInstructor(row), origin) : null;
    },

    async getByUserId(userId) {
      const row = await maybeRow(
        db.from('instructors').select('*').eq('user_id', userId),
        'eğitmen okunamadı',
      );
      return row ? await withUser(toInstructor(row), null) : null;
    },

    async reviews(instructorId) {
      const data = await rows(
        db
          .from('instructor_reviews')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('instructor_id', instructorId)
          .order('created_at', { ascending: false }),
        'yorumlar okunamadı',
      );
      return data.map((row) => ({
        ...toInstructorReview(row),
        author: toUser((row.author ?? {}) as Row),
      }));
    },

    async book(meId, input) {
      const row = await maybeRow(
        db.from('instructors').select('*').eq('id', input.instructorId),
        'eğitmen okunamadı',
      );
      if (!row) throw new NotFoundError('Eğitmen', input.instructorId);
      const instructor = toInstructor(row);
      if (instructor.userId === meId) throw new AuthError('Kendinden ders talep edemezsin.');
      const created = await oneRow(
        db
          .from('bookings')
          .insert({
            instructor_id: instructor.id,
            student_id: meId,
            adventure_type: input.adventureType,
            date: input.date,
            message: input.message.trim(),
            status: 'pending',
            price_try: instructor.pricePerSessionTry,
          })
          .select('*'),
        'rezervasyon oluşturulamadı',
      );
      await notify(db, {
        type: 'booking_request',
        senderId: meId,
        receiverId: instructor.userId,
        message: instructor.headline,
        postId: null,
        matchId: null,
        targetId: String(created.id),
      });
      const [result] = await bookingWithParties([created]);
      if (!result) throw new NotFoundError('Rezervasyon', String(created.id));
      return result;
    },

    async myBookings(meId) {
      const mine = await rows(
        db.from('instructors').select('id').eq('user_id', meId),
        'eğitmen okunamadı',
      );
      const ids = mine.map((row) => String(row.id));
      const filter = ids.length
        ? `student_id.eq.${meId},instructor_id.in.(${ids.join(',')})`
        : `student_id.eq.${meId}`;
      const data = await rows(
        db.from('bookings').select('*').or(filter).order('created_at', { ascending: false }),
        'rezervasyonlar okunamadı',
      );
      return await bookingWithParties(data);
    },

    async respondBooking(meId, bookingId, accept) {
      const row = await maybeRow(
        db.from('bookings').select('*').eq('id', bookingId),
        'rezervasyon okunamadı',
      );
      if (!row) throw new NotFoundError('Rezervasyon', bookingId);
      const instructorRow = await maybeRow(
        db.from('instructors').select('*').eq('id', row.instructor_id),
        'eğitmen okunamadı',
      );
      if (!instructorRow || String(instructorRow.user_id) !== meId) {
        throw new AuthError('Bu talebe yalnızca eğitmen yanıt verebilir.');
      }
      const instructor = toInstructor(instructorRow);
      const updated = await oneRow(
        db
          .from('bookings')
          .update({
            status: accept ? 'confirmed' : 'declined',
            responded_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .select('*'),
        'rezervasyon güncellenemedi',
      );
      if (accept) {
        await rows(
          db
            .from('instructors')
            .update({ students_count: instructor.studentsCount + 1 })
            .eq('id', instructor.id),
          'öğrenci sayacı güncellenemedi',
        );
      }
      await notify(db, {
        type: accept ? 'booking_confirmed' : 'booking_declined',
        senderId: meId,
        receiverId: instructor.userId,
        message: instructor.headline,
        postId: null,
        matchId: null,
        targetId: bookingId,
      });
      const [result] = await bookingWithParties([updated]);
      if (!result) throw new NotFoundError('Rezervasyon', bookingId);
      return result;
    },
  };
}

/* ================================================================== */
/* Kütüphane                                                          */
/* ================================================================== */

export function createLibraryRepository(ctx: RemoteContext): LibraryRepository {
  const { db } = ctx;

  const all = async () => {
    const data = await rows(db.from('places').select('*'), 'kütüphane okunamadı');
    return data.map(toLibraryPlace);
  };

  return {
    async search(filter) {
      return searchLibrary(await all(), filter);
    },

    async getById(id, origin) {
      const row = await maybeRow(db.from('places').select('*').eq('id', id), 'yer okunamadı');
      if (!row) return null;
      const place = toLibraryPlace(row);
      return {
        ...place,
        distanceKm: origin
          ? distanceKm(origin, { latitude: place.lat, longitude: place.lng })
          : null,
      };
    },

    async nearby(origin, radiusKm, kind = null, limit = 20) {
      // Uzamsal ön eleme sunucuda; sıralama/biçim domain fonksiyonunda.
      const shortlist = await rows(
        db.rpc('nearby_places', {
          lat: origin.latitude,
          lng: origin.longitude,
          radius_km: radiusKm,
          place_kind: kind ?? null,
          max_rows: Math.max(limit * 3, 60),
        }),
        'yakın yerler okunamadı',
      );
      const ids = shortlist.map((row) => String(row.id));
      if (!ids.length) return [];
      const data = await rows(db.from('places').select('*').in('id', ids), 'yerler okunamadı');
      return searchLibrary(data.map(toLibraryPlace), { origin, radiusKm, kind }).slice(0, limit);
    },

    async countries() {
      return countByCountry(await all());
    },
  };
}

/* ================================================================== */
/* Canlı konum                                                        */
/* ================================================================== */

export function createPresenceRepository(ctx: RemoteContext): PresenceRepository {
  const { db } = ctx;

  return {
    async list(meId, origin) {
      const [shareRows, followRows, matchRows] = await Promise.all([
        rows(db.from('location_shares').select('*'), 'paylaşımlar okunamadı'),
        rows(db.from('follows').select('follower_id, following_id'), 'takipler okunamadı'),
        rows(
          db
            .from('matches')
            .select('*')
            .eq('status', 'accepted')
            .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`),
          'eşleşmeler okunamadı',
        ),
      ]);
      const shares = shareRows.map(toLocationShare);
      const users = await fetchUsers(
        db,
        shares.map((s) => s.userId),
      );
      const iFollow = new Set(
        followRows.filter((f) => String(f.follower_id) === meId).map((f) => String(f.following_id)),
      );
      const friendIds = new Set(
        followRows
          .filter((f) => String(f.following_id) === meId && iFollow.has(String(f.follower_id)))
          .map((f) => String(f.follower_id)),
      );
      const matchIds = new Set(
        matchRows.map(toMatch).map((m) => (m.requesterId === meId ? m.receiverId : m.requesterId)),
      );
      return visibleShares({
        meId,
        origin,
        shares,
        users: Array.from(users.values()),
        friendIds,
        matchIds,
      });
    },

    async mine(meId) {
      const row = await maybeRow(
        db.from('location_shares').select('*').eq('user_id', meId),
        'paylaşım okunamadı',
      );
      if (!row) return null;
      const share = toLocationShare(row);
      if (share.expiresAt && share.expiresAt < new Date().toISOString()) return null;
      return share;
    },

    async start(meId, input) {
      const nowIso = new Date().toISOString();
      const payload: Row = {
        user_id: meId,
        coords: fromGeoPoint(input.coords),
        mode: input.mode,
        started_at: nowIso,
        expires_at: expiresAtFor(input.durationMin),
        updated_at: nowIso,
        battery_pct: input.batteryPct ?? null,
        altitude_m: input.altitudeM ?? null,
        speed_kmh: null,
      };
      const created = await oneRow(
        db.from('location_shares').upsert(payload, { onConflict: 'user_id' }).select('*'),
        'paylaşım başlatılamadı',
      );
      return toLocationShare(created);
    },

    async update(meId, coords, extra = {}) {
      const existing = await maybeRow(
        db.from('location_shares').select('*').eq('user_id', meId),
        'paylaşım okunamadı',
      );
      if (!existing) return null;
      const payload: Row = { coords: fromGeoPoint(coords), updated_at: new Date().toISOString() };
      if (extra.batteryPct !== undefined) payload.battery_pct = extra.batteryPct;
      if (extra.altitudeM !== undefined) payload.altitude_m = extra.altitudeM;
      if (extra.speedKmh !== undefined) payload.speed_kmh = extra.speedKmh;
      const updated = await oneRow(
        db.from('location_shares').update(payload).eq('user_id', meId).select('*'),
        'paylaşım güncellenemedi',
      );
      return toLocationShare(updated);
    },

    async stop(meId) {
      await rows(db.from('location_shares').delete().eq('user_id', meId), 'paylaşım durdurulamadı');
    },
  };
}

/* ================================================================== */
/* Anlar                                                              */
/* ================================================================== */

export function createStoryRepository(ctx: RemoteContext): StoryRepository {
  const { db } = ctx;
  return {
    async groups(meId) {
      const nowIso = new Date().toISOString();
      const data = await rows(
        db.from('stories').select('*').gt('expires_at', nowIso),
        'anlar okunamadı',
      );
      const stories = data.map(toStory);
      if (!stories.length) return [];
      const seenRows = await rows(
        db.from('story_views').select('story_id').eq('user_id', meId),
        'an görüntülemeleri okunamadı',
      );
      const seen = new Set(seenRows.map((row) => String(row.story_id)));
      const users = await fetchUsers(
        db,
        stories.map((s) => s.authorId),
      );
      const byAuthor = new Map<ID, Story[]>();
      for (const s of stories) byAuthor.set(s.authorId, [...(byAuthor.get(s.authorId) ?? []), s]);

      const groups: StoryGroup[] = [];
      for (const [authorId, list] of byAuthor) {
        const sorted = list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        groups.push({
          author: pickUser(users, authorId),
          stories: sorted,
          allSeen: sorted.every((s) => seen.has(s.id) || s.authorId === meId),
          latestAt: sorted[sorted.length - 1]?.createdAt ?? nowIso,
        });
      }
      return groups.sort((a, b) => {
        if (a.author.id === meId) return -1;
        if (b.author.id === meId) return 1;
        if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
        return b.latestAt.localeCompare(a.latestAt);
      });
    },

    async create(meId, input) {
      const me = await requireUser(db, meId);
      const created = await oneRow(
        db
          .from('stories')
          .insert({
            author_id: meId,
            media_url: input.mediaUri,
            media_type: 'image',
            caption: input.caption.trim(),
            adventure_type: input.adventureType,
            location_name: input.locationName.trim() || me.locationName,
            coords: fromGeoPoint(input.coords ?? me.coords),
            altitude_m: input.altitudeM ?? null,
            expires_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          })
          .select('*'),
        'an paylaşılamadı',
      );
      await notifyMany(db, await followerIds(db, meId), {
        type: 'story_posted',
        senderId: meId,
        message: input.caption.trim(),
        postId: null,
        matchId: null,
        targetId: String(created.id),
      });
      return toStory(created);
    },

    async markSeen(meId, storyId) {
      const story = await maybeRow(
        db.from('stories').select('id, author_id').eq('id', storyId),
        'an okunamadı',
      );
      if (!story || String(story.author_id) === meId) return;
      const existing = await maybeRow(
        db.from('story_views').select('story_id').eq('user_id', meId).eq('story_id', storyId),
        'görüntüleme okunamadı',
      );
      if (existing) return;
      await rows(
        db.from('story_views').insert({ user_id: meId, story_id: storyId }),
        'görüntüleme yazılamadı',
      );
    },
  };
}

/* ================================================================== */
/* İşletmeler & konaklama                                             */
/* ================================================================== */

export function createBusinessRepository(ctx: RemoteContext): BusinessRepository {
  const { db } = ctx;

  const withOwner = async (
    businesses: Business[],
    origin: GeoPoint | null,
  ): Promise<BusinessWithOwner[]> => {
    const owners = await fetchUsers(
      db,
      businesses.map((b) => b.ownerId),
    );
    return businesses.map((b) => ({
      ...b,
      owner: pickUser(owners, b.ownerId),
      distanceKm: origin ? distanceKm(origin, b.coords) : null,
    }));
  };

  return {
    async list(filter = {}) {
      let query = db.from('businesses').select('*');
      if (filter.type) query = query.eq('type', filter.type);
      if (filter.staysOnly) query = query.not('price_from_try', 'is', null);
      const data = await rows(query, 'işletmeler okunamadı');
      const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
      const businesses = data
        .map(toBusiness)
        .filter(
          (b) =>
            !q ||
            b.name.toLocaleLowerCase('tr-TR').includes(q) ||
            b.locationName.toLocaleLowerCase('tr-TR').includes(q) ||
            b.description.toLocaleLowerCase('tr-TR').includes(q),
        );
      const enriched = await withOwner(businesses, filter.origin ?? null);
      return enriched.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewCount - a.reviewCount;
      });
    },

    async getById(id, origin) {
      const row = await maybeRow(
        db.from('businesses').select('*').eq('id', id),
        'işletme okunamadı',
      );
      if (!row) return null;
      const [result] = await withOwner([toBusiness(row)], origin);
      return result ?? null;
    },

    async register(meId, input) {
      const owner = await requireUser(db, meId);
      const created = await oneRow(
        db
          .from('businesses')
          .insert({
            owner_id: meId,
            name: input.name.trim(),
            type: input.type,
            description: input.description.trim(),
            location_name: input.locationName.trim() || owner.locationName,
            coords: fromGeoPoint(owner.coords),
            price_from_try: input.priceFromTry,
            amenities: input.amenities,
            adventure_types: input.adventureTypes,
            website: input.website,
            phone: input.phone,
            plan: owner.plan === 'business' ? 'business' : 'free',
          })
          .select('*'),
        'işletme kaydedilemedi',
      );
      const [result] = await withOwner([toBusiness(created)], null);
      if (!result) throw new NotFoundError('İşletme', String(created.id));
      return result;
    },

    async reserve(meId, input) {
      const row = await maybeRow(
        db.from('businesses').select('*').eq('id', input.businessId),
        'işletme okunamadı',
      );
      if (!row) throw new NotFoundError('İşletme', input.businessId);
      const business = toBusiness(row);
      if (business.priceFromTry === null) throw new AuthError('Bu işletme konaklama sunmuyor.');
      const nights = nightsBetween(input.checkIn, input.checkOut);
      if (nights < 1) throw new AuthError('Çıkış tarihi girişten sonra olmalı.');
      const totals = stayTotal(business.priceFromTry, nights);
      const created = await oneRow(
        db
          .from('stay_bookings')
          .insert({
            business_id: business.id,
            unit_id: null,
            guest_id: meId,
            check_in: input.checkIn.slice(0, 10),
            check_out: input.checkOut.slice(0, 10),
            guests: input.guests,
            nights,
            total_try: totals.totalTry,
            platform_fee_try: totals.feeTry,
            status: 'pending',
          })
          .select('*'),
        'rezervasyon oluşturulamadı',
      );
      await notify(db, {
        type: 'stay_request',
        senderId: meId,
        receiverId: business.ownerId,
        message: business.name,
        postId: null,
        matchId: null,
        targetId: String(created.id),
      });
      return { ...toStayBooking(created), business };
    },

    async myStays(meId) {
      const data = await rows(
        db
          .from('stay_bookings')
          .select('*, business:businesses!business_id(*)')
          .eq('guest_id', meId)
          .order('created_at', { ascending: false }),
        'konaklamalar okunamadı',
      );
      return data.map((row) => ({
        ...toStayBooking(row),
        business: toBusiness((row.business ?? {}) as Row),
      }));
    },
  };
}

/* ================================================================== */
/* Abonelik                                                           */
/* ================================================================== */

export function createBillingRepository(ctx: RemoteContext): BillingRepository {
  const { db } = ctx;
  return {
    async currentPlan(meId) {
      const user = await requireUser(db, meId);
      return user.plan;
    },

    async subscribe(meId, plan, period) {
      const spec = await maybeRow(
        db.from('plan_definitions').select('*').eq('plan', plan),
        'plan okunamadı',
      );
      const priceTry = spec
        ? num(period === 'yearly' ? spec.yearly_price_try : spec.monthly_price_try)
        : 0;
      // `sync_profile_plan` tetikleyicisi profiles.plan alanını günceller.
      await rows(
        db.from('subscriptions').insert({
          user_id: meId,
          plan,
          period,
          price_try: priceTry,
          provider: 'mock',
          current_end_at: new Date(
            Date.now() + (period === 'yearly' ? 365 : 30) * 86_400_000,
          ).toISOString(),
        }),
        'abonelik oluşturulamadı',
      );
      await rows(
        db
          .from('businesses')
          .update({ plan: plan === 'business' ? 'business' : 'free' })
          .eq('owner_id', meId),
        'işletme planı güncellenemedi',
      );
      return await requireUser(db, meId);
    },

    async earnings(meId) {
      const user = await requireUser(db, meId);
      const [instructorRows, businessRows] = await Promise.all([
        rows(db.from('instructors').select('id').eq('user_id', meId), 'eğitmen okunamadı'),
        rows(db.from('businesses').select('id').eq('owner_id', meId), 'işletmeler okunamadı'),
      ]);
      const instructorIds = instructorRows.map((row) => String(row.id));
      const businessIds = businessRows.map((row) => String(row.id));
      const [bookingRows, stayRows] = await Promise.all([
        instructorIds.length
          ? rows(
              db
                .from('bookings')
                .select('*')
                .in('instructor_id', instructorIds)
                .in('status', ['confirmed', 'completed']),
              'rezervasyonlar okunamadı',
            )
          : Promise.resolve<Row[]>([]),
        businessIds.length
          ? rows(
              db
                .from('stay_bookings')
                .select('*')
                .in('business_id', businessIds)
                .in('status', ['confirmed', 'completed']),
              'konaklamalar okunamadı',
            )
          : Promise.resolve<Row[]>([]),
      ]);
      const bookings = bookingRows.map(toBooking);
      const stays = stayRows.map(toStayBooking);
      const gross =
        bookings.reduce((sum, b) => sum + b.priceTry, 0) +
        stays.reduce((sum, s) => sum + s.totalTry - s.platformFeeTry, 0);
      const split = splitPayment(gross, user.plan);
      return {
        grossTry: split.grossTry,
        commissionTry: split.commissionTry,
        netTry: split.netTry,
        bookings: bookings.length + stays.length,
      };
    },
  };
}

/* ================================================================== */
/* Acil durum                                                         */
/* ================================================================== */

export function createEmergencyRepository(ctx: RemoteContext): EmergencyRepository {
  const { db } = ctx;
  return {
    async centers(origin, limit = 6) {
      const shortlist = await rows(
        db.rpc('nearby_emergency_centers', {
          lat: origin.latitude,
          lng: origin.longitude,
          max_rows: Math.max(limit * 3, 20),
        }),
        'acil merkezler okunamadı',
      );
      const ids = shortlist.map((row) => String(row.id));
      if (!ids.length) return [];
      const data = await rows(
        db.from('emergency_centers').select('*').in('id', ids),
        'acil merkezler okunamadı',
      );
      return nearestCenters(data.map(toEmergencyCenter), origin, { limit });
    },

    async triggerSos(meId, coords) {
      const me = await requireUser(db, meId);
      const nowIso = new Date().toISOString();
      const created = await oneRow(
        db
          .from('sos_events')
          .insert({
            user_id: meId,
            coords: fromGeoPoint(coords),
            notified_contacts: me.emergencyContacts.length,
          })
          .select('*'),
        'SOS oluşturulamadı',
      );
      const share: Row = {
        user_id: meId,
        coords: fromGeoPoint(coords),
        mode: 'sos',
        started_at: nowIso,
        expires_at: null,
        updated_at: nowIso,
        battery_pct: null,
        altitude_m: null,
        speed_kmh: null,
      };
      await rows(
        db.from('location_shares').upsert(share, { onConflict: 'user_id' }),
        'SOS konumu paylaşılamadı',
      );
      await notifyMany(
        db,
        me.emergencyContacts.map((c) => c.userId).filter((id): id is ID => Boolean(id)),
        {
          type: 'sos_alert',
          senderId: meId,
          message: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
          postId: null,
          matchId: null,
          targetId: String(created.id),
        },
      );
      return toSosEvent(created);
    },

    async activeSos(meId) {
      const row = await maybeRow(
        db
          .from('sos_events')
          .select('*')
          .eq('user_id', meId)
          .is('resolved_at', null)
          .order('created_at', { ascending: false }),
        'SOS okunamadı',
        { limit: 1 },
      );
      return row ? toSosEvent(row) : null;
    },

    async resolveSos(meId) {
      await rows(
        db
          .from('sos_events')
          .update({ resolved_at: new Date().toISOString() })
          .eq('user_id', meId)
          .is('resolved_at', null),
        'SOS kapatılamadı',
      );
      await rows(
        db.from('location_shares').delete().eq('user_id', meId).eq('mode', 'sos'),
        'SOS konumu kaldırılamadı',
      );
    },

    async updateContacts(meId, contacts) {
      const cleaned = contacts
        .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim() }))
        .filter((c) => c.name && c.phone);
      await rows(
        db.from('emergency_contacts').delete().eq('user_id', meId),
        'acil kişiler temizlenemedi',
      );
      if (cleaned.length) {
        await rows(
          db.from('emergency_contacts').insert(
            cleaned.map((c, index) => ({
              user_id: meId,
              name: c.name,
              phone: c.phone,
              contact_user_id: c.userId,
              position: index,
            })),
          ),
          'acil kişiler kaydedilemedi',
        );
      }
      return await requireUser(db, meId);
    },
  };
}
