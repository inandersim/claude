import {
  MAX_STATUS_PHOTOS,
  applyFeedFilter,
  canDelete,
  emptyReactionCounts,
  matchUsers,
  normalizeHashtag,
  parseHashtags,
  parseMentions,
  statusKindFor,
  trendingHashtags,
  type FeedPost,
  type ID,
  type Post,
  type ReactionType,
  type User,
} from '@/domain';

import { FEED_PAGE_SIZE } from '../../repositories';
import type { SocialRepository } from '../../repositories';
import {
  PROFILE_SELECT,
  fetchUsers,
  medyaAdresleri,
  notify,
  notifyMany,
  pickUser,
  requireUser,
  type RemoteContext,
} from '../context';
import { fromGeoPoint, num, toCollection, toPost, toUser } from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

const POST_COLUMNS = '*';

/**
 * Sosyal paylaşım uzak repository'si.
 *
 * Tutarlılık kuralı mock ile aynıdır: `post_likes` "etkileşimde bulundu"
 * kaydıdır, `reactions` türü tutar; `likes_count` toplam tepki sayısıdır
 * (tetikleyici `post_likes` üzerinden günceller).
 */
export function createSocialRepository(ctx: RemoteContext): SocialRepository {
  const { db } = ctx;

  const requirePost = async (postId: ID): Promise<Row> => {
    const row = await maybeRow(
      db.from('posts').select(POST_COLUMNS).eq('id', postId),
      'gönderi okunamadı',
    );
    if (!row) throw new Error(`Gönderi bulunamadı: ${postId}`);
    return row;
  };

  /** Tek istekte tepki/kayıt/beğeni bilgisi toplayıp FeedPost üretir. */
  const enrichMany = async (posts: Post[], meId: ID): Promise<FeedPost[]> => {
    if (!posts.length) return [];
    const ids = posts.map((p) => p.id);
    const rootIds = posts.map((p) => p.repostOfId).filter((id): id is ID => Boolean(id));

    const [reactionRows, likeRows, savedRows, rootRows] = await Promise.all([
      rows(
        db.from('reactions').select('post_id, user_id, type').in('post_id', ids),
        'tepkiler okunamadı',
      ),
      rows(
        db.from('post_likes').select('post_id').eq('user_id', meId).in('post_id', ids),
        'beğeniler okunamadı',
      ),
      rows(
        db.from('saved_posts').select('post_id').eq('user_id', meId).in('post_id', ids),
        'kayıtlar okunamadı',
      ),
      rootIds.length
        ? rows(db.from('posts').select(POST_COLUMNS).in('id', rootIds), 'kök gönderiler okunamadı')
        : Promise.resolve<Row[]>([]),
    ]);

    const authorIds = [
      ...posts.map((p) => p.authorId),
      ...rootRows.map((row) => String(row.author_id)),
    ];
    const users = await fetchUsers(db, authorIds);
    const roots = new Map(rootRows.map((row) => [String(row.id), toPost(row)]));
    const myLikes = new Set(likeRows.map((row) => String(row.post_id)));
    const mySaves = new Set(savedRows.map((row) => String(row.post_id)));

    return posts.map((post) => {
      const counts = emptyReactionCounts();
      let myReaction: ReactionType | null = null;
      for (const r of reactionRows) {
        if (String(r.post_id) !== post.id) continue;
        const type = String(r.type) as ReactionType;
        counts[type] += 1;
        if (String(r.user_id) === meId) myReaction = type;
      }
      const others = counts.love + counts.wow + counts.fire + counts.strong;
      counts.like = Math.max(counts.like, post.likesCount - others);
      if (!myReaction && myLikes.has(post.id)) myReaction = 'like';
      const root = post.repostOfId ? (roots.get(post.repostOfId) ?? null) : null;
      return {
        ...post,
        author: pickUser(users, post.authorId),
        likedByMe: myReaction !== null,
        myReaction,
        reactionCounts: counts,
        savedByMe: mySaves.has(post.id),
        repostOf: root ? { ...root, author: pickUser(users, root.authorId) } : null,
      };
    });
  };

  const enrichOne = async (postId: ID, meId: ID): Promise<FeedPost> => {
    const row = await requirePost(postId);
    const [result] = await enrichMany([toPost(row)], meId);
    if (!result) throw new Error(`Gönderi bulunamadı: ${postId}`);
    return result;
  };

  const insertPost = async (
    author: User,
    input: {
      caption: string;
      images: string[];
      locationName: string | null;
      coords?: Post['coords'] | null;
      adventureType?: Post['adventureType'] | null;
      repostOfId?: ID | null;
      kind?: Post['kind'];
    },
  ): Promise<Row> => {
    const caption = input.caption.trim();
    // Bahsetmeler için yalnızca metinde geçen kullanıcı adlarını çöz (tüm tabloyu çekme).
    const handles = Array.from(caption.matchAll(/@([\p{L}\p{N}._-]+)/gu)).map((m) => m[1] ?? '');
    const mentionRows = handles.length
      ? await rows(
          db
            .from('profiles')
            .select('id, username')
            .in(
              'username',
              handles.map((h) => h.toLowerCase()),
            ),
          'bahsedilen kullanıcılar okunamadı',
        )
      : [];
    const mentions = parseMentions(
      caption,
      mentionRows.map((row) => ({ id: String(row.id), username: String(row.username) })),
    );
    return await oneRow(
      db
        .from('posts')
        .insert({
          author_id: author.id,
          kind: input.kind ?? statusKindFor(input.images.length),
          image_url: input.images[0] ?? null,
          images: input.images,
          caption,
          adventure_type: input.adventureType ?? author.favoriteTypes[0] ?? 'hiking',
          difficulty: 'easy',
          altitude_m: 0,
          distance_km: 0,
          temperature_c: 18,
          wind_kmh: 0,
          trail_condition: 'good',
          duration_min: 0,
          location_name: (input.locationName ?? '').trim() || author.locationName,
          coords: fromGeoPoint(input.coords ?? author.coords),
          hashtags: parseHashtags(caption),
          mentions,
          repost_of_id: input.repostOfId ?? null,
          is_verified_info: false,
        })
        .select(POST_COLUMNS),
      'gönderi oluşturulamadı',
    );
  };

  const notifyMentions = async (post: Post): Promise<void> => {
    await notifyMany(db, post.mentions ?? [], {
      type: 'mention',
      senderId: post.authorId,
      message: post.caption.slice(0, 120),
      postId: post.id,
      matchId: null,
    });
  };

  return {
    async feed(meId, filter) {
      // Sunucu tarafı RPC ön eleme yapar; kesin sıralama/kural domain fonksiyonunda.
      const data = await rows(
        db.rpc('feed_posts', {
          tab: filter.tab,
          want: null,
          tag: filter.hashtag ? normalizeHashtag(filter.hashtag) : null,
          before_at: null,
          max_rows: 200,
        }),
        'akış okunamadı',
      );
      const follows = await rows(
        db.from('follows').select('follower_id, following_id').eq('follower_id', meId),
        'takipler okunamadı',
      );
      const posts = applyFeedFilter(
        data.map(toPost),
        filter,
        follows.map((row) => ({
          followerId: String(row.follower_id),
          followingId: String(row.following_id),
        })),
        meId,
      );
      return await enrichMany(posts, meId);
    },

    async feedPage(meId, filter) {
      // RPC zaten `before_at` ve `max_rows` alıyordu; istemci bunları hiç
      // kullanmıyor, her açılışta 200 satır çekiyordu.
      const ham = await rows(
        db.rpc('feed_posts', {
          tab: filter.tab,
          want: null,
          tag: filter.hashtag ? normalizeHashtag(filter.hashtag) : null,
          before_at: filter.before ?? null,
          max_rows: FEED_PAGE_SIZE,
        }),
        'akış okunamadı',
      );
      const follows = await rows(
        db.from('follows').select('follower_id, following_id').eq('follower_id', meId),
        'takipler okunamadı',
      );
      const hamPosts = ham.map(toPost);
      // Kürsör **ham** okumadan: domain süzgeci ("takip", "maceralar", hashtag)
      // sayfayı kısaltabilir; süzülmüş listeden karar vermek kaydırmayı erken
      // durdurur ve kullanıcı eski gönderileri hiç göremez.
      const nextCursor =
        hamPosts.length < FEED_PAGE_SIZE
          ? null
          : (hamPosts[hamPosts.length - 1]?.createdAt ?? null);
      const posts = applyFeedFilter(
        hamPosts,
        filter,
        follows.map((row) => ({
          followerId: String(row.follower_id),
          followingId: String(row.following_id),
        })),
        meId,
      );
      return { posts: await enrichMany(posts, meId), nextCursor };
    },

    async createStatus(meId, input) {
      const author = await requireUser(db, meId);
      const images = await medyaAdresleri(ctx, 'post-media', meId, input.imageUris);
      if (!input.caption.trim() && images.length === 0) {
        throw new Error('Bir metin ya da fotoğraf gerekli');
      }
      if (images.length > MAX_STATUS_PHOTOS) {
        throw new Error(`En fazla ${MAX_STATUS_PHOTOS} fotoğraf eklenebilir`);
      }
      const created = await insertPost(author, {
        caption: input.caption,
        images,
        locationName: input.locationName,
        coords: input.coords,
        adventureType: input.adventureType,
      });
      const post = toPost(created);
      await notifyMentions(post);
      return await enrichOne(post.id, meId);
    },

    async react(meId, postId, type) {
      const row = await requirePost(postId);
      const authorId = String(row.author_id);
      const [existingReaction, existingLike] = await Promise.all([
        maybeRow(
          db.from('reactions').select('type').eq('user_id', meId).eq('post_id', postId),
          'tepki okunamadı',
        ),
        maybeRow(
          db.from('post_likes').select('post_id').eq('user_id', meId).eq('post_id', postId),
          'beğeni okunamadı',
        ),
      ]);
      const previous: ReactionType | null = existingReaction
        ? (String(existingReaction.type) as ReactionType)
        : existingLike
          ? 'like'
          : null;

      if (type === null) {
        if (existingReaction) {
          await rows(
            db.from('reactions').delete().eq('user_id', meId).eq('post_id', postId),
            'tepki kaldırılamadı',
          );
        }
        if (existingLike) {
          await rows(
            db.from('post_likes').delete().eq('user_id', meId).eq('post_id', postId),
            'beğeni kaldırılamadı',
          );
        }
      } else {
        await rows(
          db
            .from('reactions')
            .upsert({ post_id: postId, user_id: meId, type }, { onConflict: 'post_id,user_id' }),
          'tepki yazılamadı',
        );
        if (!existingLike) {
          await rows(
            db.from('post_likes').insert({ user_id: meId, post_id: postId }),
            'beğeni yazılamadı',
          );
        }
      }
      if (type !== null && previous !== type) {
        await notify(db, {
          type: 'reaction',
          senderId: meId,
          receiverId: authorId,
          message: type,
          postId,
          matchId: null,
        });
      }
      return await enrichOne(postId, meId);
    },

    async toggleSave(meId, postId, collectionId = null) {
      const post = toPost(await requirePost(postId));
      const existing = await maybeRow(
        db
          .from('saved_posts')
          .select('post_id, collection_id')
          .eq('user_id', meId)
          .eq('post_id', postId),
        'kayıt okunamadı',
      );
      if (existing) {
        await rows(
          db.from('saved_posts').delete().eq('user_id', meId).eq('post_id', postId),
          'kayıt kaldırılamadı',
        );
      } else {
        if (collectionId) {
          const collection = await maybeRow(
            db
              .from('collections')
              .select('id, cover_url')
              .eq('id', collectionId)
              .eq('user_id', meId),
            'koleksiyon okunamadı',
          );
          if (!collection) throw new Error(`Koleksiyon bulunamadı: ${collectionId}`);
          if (!collection.cover_url && post.imageUrl) {
            await rows(
              db.from('collections').update({ cover_url: post.imageUrl }).eq('id', collectionId),
              'koleksiyon kapağı güncellenemedi',
            );
          }
        }
        await rows(
          db
            .from('saved_posts')
            .insert({ user_id: meId, post_id: postId, collection_id: collectionId }),
          'kaydedilemedi',
        );
      }
      return await enrichOne(postId, meId);
    },

    async repost(meId, postId, caption) {
      const author = await requireUser(db, meId);
      const target = toPost(await requirePost(postId));
      // Bir yeniden paylaşımı tekrar paylaşırken kök gönderiye bağlan.
      const rootRow = target.repostOfId
        ? await maybeRow(
            db.from('posts').select(POST_COLUMNS).eq('id', target.repostOfId),
            'kök gönderi okunamadı',
          )
        : null;
      const root = rootRow ? toPost(rootRow) : target;
      const created = await insertPost(author, {
        caption,
        images: [],
        locationName: root.locationName,
        coords: root.coords,
        adventureType: root.adventureType,
        repostOfId: root.id,
        kind: 'status',
      });
      const post = toPost(created);
      await notify(db, {
        type: 'repost',
        senderId: meId,
        receiverId: root.authorId,
        message: post.caption.slice(0, 120),
        postId: root.id,
        matchId: null,
      });
      await notifyMentions(post);
      return await enrichOne(post.id, meId);
    },

    async collections(meId) {
      const data = await rows(
        db
          .from('collections')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'koleksiyonlar okunamadı',
      );
      return data.map(toCollection);
    },

    async createCollection(meId, name) {
      await requireUser(db, meId);
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Koleksiyon adı gerekli');
      const existing = await rows(
        db.from('collections').select('*').eq('user_id', meId).ilike('name', trimmed),
        'koleksiyonlar okunamadı',
      );
      const first = existing[0];
      if (first) return toCollection(first);
      const created = await oneRow(
        db.from('collections').insert({ user_id: meId, name: trimmed }).select('*'),
        'koleksiyon oluşturulamadı',
      );
      return toCollection(created);
    },

    async savedPosts(meId, collectionId = null) {
      let query = db
        .from('saved_posts')
        .select('post_id, created_at, collection_id')
        .eq('user_id', meId)
        .order('created_at', { ascending: false });
      if (collectionId) query = query.eq('collection_id', collectionId);
      const saved = await rows(query, 'kayıtlar okunamadı');
      const ids = saved.map((row) => String(row.post_id));
      if (!ids.length) return [];
      const postRows = await rows(
        db.from('posts').select(POST_COLUMNS).in('id', ids),
        'gönderiler okunamadı',
      );
      const byId = new Map(postRows.map((row) => [String(row.id), toPost(row)]));
      const ordered = ids.map((id) => byId.get(id)).filter((p): p is Post => Boolean(p));
      return await enrichMany(ordered, meId);
    },

    async hashtags(limit = 10) {
      const data = await rows(
        db.rpc('trending_hashtags', { max_rows: Math.max(limit * 3, 30) }),
        'etiketler okunamadı',
      );
      // Sunucu sıralaması ile domain sıralaması aynı sonucu vermeli; kesin
      // biçimi domain fonksiyonuna bırakmak için ham gönderileri kullanırız.
      if (!data.length) return [];
      const posts = await rows(
        db.from('posts').select('hashtags, created_at'),
        'gönderiler okunamadı',
      );
      return trendingHashtags(
        posts.map((row) => toPost(row)),
        Date.now(),
        limit,
      );
    },

    async byHashtag(meId, tag) {
      const data = await rows(
        db.rpc('feed_posts', {
          tab: 'all',
          want: null,
          tag: normalizeHashtag(tag),
          before_at: null,
          max_rows: 200,
        }),
        'etiketli gönderiler okunamadı',
      );
      const posts = applyFeedFilter(
        data.map(toPost),
        { tab: 'all', hashtag: normalizeHashtag(tag) },
        [],
        meId,
      );
      return await enrichMany(posts, meId);
    },

    async searchUsers(query) {
      const q = query
        .replace(/^@/, '')
        .trim()
        .replace(/[(),"*]/g, '');
      const data = q
        ? await rows(
            db
              .from('profiles')
              .select(PROFILE_SELECT)
              .or(`username.ilike.*${q}*,display_name.ilike.*${q}*`),
            'kullanıcı araması başarısız',
            { limit: 50 },
          )
        : await rows(
            db.from('profiles').select(PROFILE_SELECT),
            'kullanıcılar okunamadı',
            { limit: 50 },
          );
      return matchUsers(data.map(toUser), query, 8);
    },

    async deletePost(meId, postId) {
      const post = toPost(await requirePost(postId));
      if (!canDelete(post, meId)) throw new Error('Yalnızca kendi gönderini silebilirsin');
      // Bağlı kayıtlar ON DELETE CASCADE ile düşer; sayaçlar tetikleyicilerle güncellenir.
      await rows(db.from('posts').delete().eq('id', postId), 'gönderi silinemedi');
      if ((post.kind ?? 'adventure') === 'adventure') {
        const author = await maybeRow(
          db.from('profiles').select('total_adventures').eq('id', meId),
          'profil okunamadı',
        );
        if (author) {
          await rows(
            db
              .from('profiles')
              .update({ total_adventures: Math.max(0, num(author.total_adventures) - 1) })
              .eq('id', meId),
            'profil güncellenemedi',
          );
        }
      }
    },
  };
}
