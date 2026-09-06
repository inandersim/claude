import { generateId } from '@/core/utils/format';
import type { SocialRepository } from '@/data/repositories';
import {
  applyFeedFilter,
  canDelete,
  emptyReactionCounts,
  matchUsers,
  MAX_STATUS_PHOTOS,
  normalizeHashtag,
  parseHashtags,
  parseMentions,
  statusKindFor,
  trendingHashtags,
  type Collection,
  type FeedPost,
  type ID,
  type Post,
  type ReactionType,
  type User,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/**
 * Sosyal paylaşım mock repository'si.
 *
 * Tutarlılık kuralı: `likes` tablosu "etkileşimde bulundu" kaydıdır, `reactions`
 * ise türünü tutar. `likesCount` toplam tepki sayısıdır; 'like' türünün sayısı
 * diğer türlerin toplamından geriye kalandır. Böylece eski `toggleLike` ile
 * `react` aynı sayacı paylaşır.
 */
export function createSocialRepository(ctx: MockContext): SocialRepository {
  const findPost = (t: Tables, postId: ID): Post => {
    const post = t.posts.find((p) => p.id === postId);
    if (!post) throw new Error(`Gönderi bulunamadı: ${postId}`);
    return post;
  };

  const reactionCountsOf = (t: Tables, post: Post): Record<ReactionType, number> => {
    const counts = emptyReactionCounts();
    for (const r of t.reactions) if (r.postId === post.id) counts[r.type] += 1;
    const others = counts.love + counts.wow + counts.fire + counts.strong;
    counts.like = Math.max(counts.like, post.likesCount - others);
    return counts;
  };

  const myReactionOf = (t: Tables, meId: ID, postId: ID): ReactionType | null => {
    const row = t.reactions.find((r) => r.userId === meId && r.postId === postId);
    if (row) return row.type;
    return t.likes.some((l) => l.userId === meId && l.postId === postId) ? 'like' : null;
  };

  const enrich = (t: Tables, post: Post, meId: ID): FeedPost => {
    const myReaction = myReactionOf(t, meId, post.id);
    const original = post.repostOfId ? t.posts.find((p) => p.id === post.repostOfId) : null;
    return {
      ...post,
      author: ctx.requireUser(t.users, post.authorId),
      likedByMe: myReaction !== null,
      myReaction,
      reactionCounts: reactionCountsOf(t, post),
      savedByMe: t.savedPosts.some((s) => s.userId === meId && s.postId === post.id),
      repostOf: original
        ? { ...original, author: ctx.requireUser(t.users, original.authorId) }
        : null,
    };
  };

  const buildPost = (
    t: Tables,
    author: User,
    input: {
      caption: string;
      images: string[];
      locationName: string | null;
      coords?: Post['coords'] | null;
      adventureType?: Post['adventureType'] | null;
      repostOfId?: ID | null;
    },
  ): Post => {
    const caption = input.caption.trim();
    return {
      id: generateId('s'),
      authorId: author.id,
      imageUrl: input.images[0] ?? null,
      caption,
      adventureType: input.adventureType ?? author.favoriteTypes[0] ?? 'hiking',
      difficulty: 'easy',
      altitudeM: 0,
      distanceKm: 0,
      temperatureC: 18,
      windKmh: 0,
      trailCondition: 'good',
      durationMin: 0,
      locationName: (input.locationName ?? '').trim() || author.locationName,
      coords: input.coords ?? author.coords,
      likesCount: 0,
      commentsCount: 0,
      isVerifiedInfo: false,
      routeId: null,
      createdAt: new Date().toISOString(),
      kind: statusKindFor(input.images.length),
      images: input.images,
      hashtags: parseHashtags(caption),
      mentions: parseMentions(caption, t.users),
      repostOfId: input.repostOfId ?? null,
      savesCount: 0,
      repostsCount: 0,
    };
  };

  const notifyMentions = async (post: Post) => {
    for (const userId of post.mentions ?? []) {
      await ctx.pushNotification({
        type: 'mention',
        senderId: post.authorId,
        receiverId: userId,
        message: post.caption.slice(0, 120),
        postId: post.id,
        matchId: null,
      });
    }
  };

  return {
    async feed(meId, filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      return applyFeedFilter(t.posts, filter, t.follows, meId).map((p) => enrich(t, p, meId));
    },

    async createStatus(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      const author = ctx.requireUser(t.users, meId);
      const images = input.imageUris.filter(Boolean);
      if (!input.caption.trim() && images.length === 0) {
        throw new Error('Bir metin ya da fotoğraf gerekli');
      }
      if (images.length > MAX_STATUS_PHOTOS) {
        throw new Error(`En fazla ${MAX_STATUS_PHOTOS} fotoğraf eklenebilir`);
      }
      const post = buildPost(t, author, {
        caption: input.caption,
        images,
        locationName: input.locationName,
        coords: input.coords,
        adventureType: input.adventureType,
      });
      t.posts.unshift(post);
      ctx.db.markDirty();
      await notifyMentions(post);
      return enrich(t, post, meId);
    },

    async react(meId, postId, type) {
      await ctx.wait();
      const t = await ctx.db.load();
      const post = findPost(t, postId);
      const idx = t.reactions.findIndex((r) => r.userId === meId && r.postId === postId);
      const likeIdx = t.likes.findIndex((l) => l.userId === meId && l.postId === postId);
      const previous = myReactionOf(t, meId, postId);

      if (type === null) {
        if (idx >= 0) t.reactions.splice(idx, 1);
        if (likeIdx >= 0) {
          t.likes.splice(likeIdx, 1);
          post.likesCount = Math.max(0, post.likesCount - 1);
        }
      } else {
        if (idx >= 0) t.reactions[idx]!.type = type;
        else {
          t.reactions.push({ postId, userId: meId, type, createdAt: new Date().toISOString() });
        }
        if (likeIdx < 0) {
          t.likes.push({ userId: meId, postId });
          post.likesCount += 1;
        }
      }
      ctx.db.markDirty();

      if (type !== null && previous !== type) {
        await ctx.pushNotification({
          type: 'reaction',
          senderId: meId,
          receiverId: post.authorId,
          message: type,
          postId,
          matchId: null,
        });
      }
      return enrich(t, post, meId);
    },

    async toggleSave(meId, postId, collectionId = null) {
      await ctx.wait();
      const t = await ctx.db.load();
      const post = findPost(t, postId);
      const idx = t.savedPosts.findIndex((s) => s.userId === meId && s.postId === postId);
      const adjustCollection = (id: ID | null, delta: number) => {
        if (!id) return;
        const col = t.collections.find((c) => c.id === id && c.userId === meId);
        if (!col) return;
        col.count = Math.max(0, col.count + delta);
        if (delta > 0 && !col.coverUrl && post.imageUrl) col.coverUrl = post.imageUrl;
      };

      if (idx >= 0) {
        const [removed] = t.savedPosts.splice(idx, 1);
        adjustCollection(removed?.collectionId ?? null, -1);
        post.savesCount = Math.max(0, (post.savesCount ?? 0) - 1);
      } else {
        if (
          collectionId &&
          !t.collections.some((c) => c.id === collectionId && c.userId === meId)
        ) {
          throw new Error(`Koleksiyon bulunamadı: ${collectionId}`);
        }
        t.savedPosts.push({
          userId: meId,
          postId,
          collectionId,
          createdAt: new Date().toISOString(),
        });
        adjustCollection(collectionId, 1);
        post.savesCount = (post.savesCount ?? 0) + 1;
      }
      ctx.db.markDirty();
      return enrich(t, post, meId);
    },

    async repost(meId, postId, caption) {
      await ctx.wait();
      const t = await ctx.db.load();
      const author = ctx.requireUser(t.users, meId);
      const target = findPost(t, postId);
      // Bir yeniden paylaşımı tekrar paylaşırken kök gönderiye bağlan
      const root = target.repostOfId
        ? (t.posts.find((p) => p.id === target.repostOfId) ?? target)
        : target;
      const post = buildPost(t, author, {
        caption,
        images: [],
        locationName: root.locationName,
        coords: root.coords,
        adventureType: root.adventureType,
        repostOfId: root.id,
      });
      post.kind = 'status';
      t.posts.unshift(post);
      root.repostsCount = (root.repostsCount ?? 0) + 1;
      ctx.db.markDirty();
      await ctx.pushNotification({
        type: 'repost',
        senderId: meId,
        receiverId: root.authorId,
        message: post.caption.slice(0, 120),
        postId: root.id,
        matchId: null,
      });
      await notifyMentions(post);
      return enrich(t, post, meId);
    },

    async collections(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.collections
        .filter((c) => c.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createCollection(meId, name) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Koleksiyon adı gerekli');
      const existing = t.collections.find(
        (c) =>
          c.userId === meId &&
          c.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'),
      );
      if (existing) return existing;
      const collection: Collection = {
        id: generateId('col'),
        userId: meId,
        name: trimmed,
        coverUrl: null,
        count: 0,
        createdAt: new Date().toISOString(),
      };
      t.collections.unshift(collection);
      ctx.db.markDirty();
      return collection;
    },

    async savedPosts(meId, collectionId = null) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.savedPosts
        .filter((s) => s.userId === meId && (!collectionId || s.collectionId === collectionId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => t.posts.find((p) => p.id === s.postId))
        .filter((p): p is Post => Boolean(p))
        .map((p) => enrich(t, p, meId));
    },

    async hashtags(limit = 10) {
      await ctx.wait();
      const t = await ctx.db.load();
      return trendingHashtags(t.posts, Date.now(), limit);
    },

    async byHashtag(meId, tag) {
      await ctx.wait();
      const t = await ctx.db.load();
      return applyFeedFilter(
        t.posts,
        { tab: 'all', hashtag: normalizeHashtag(tag) },
        t.follows,
        meId,
      ).map((p) => enrich(t, p, meId));
    },

    async searchUsers(query) {
      await ctx.wait();
      const t = await ctx.db.load();
      return matchUsers(t.users, query, 8);
    },

    async deletePost(meId, postId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const post = findPost(t, postId);
      if (!canDelete(post, meId)) throw new Error('Yalnızca kendi gönderini silebilirsin');

      // Kayıtlar ve koleksiyon sayaçları
      for (const s of t.savedPosts.filter((s) => s.postId === postId)) {
        const col = s.collectionId ? t.collections.find((c) => c.id === s.collectionId) : null;
        if (col) col.count = Math.max(0, col.count - 1);
      }
      t.savedPosts = t.savedPosts.filter((s) => s.postId !== postId);
      t.reactions = t.reactions.filter((r) => r.postId !== postId);
      t.likes = t.likes.filter((l) => l.postId !== postId);
      t.comments = t.comments.filter((c) => c.postId !== postId);

      if (post.repostOfId) {
        const root = t.posts.find((p) => p.id === post.repostOfId);
        if (root) root.repostsCount = Math.max(0, (root.repostsCount ?? 0) - 1);
      }
      // Bu gönderinin yeniden paylaşımları yetim kalır (repostOf null döner)
      t.posts = t.posts.filter((p) => p.id !== postId);

      if ((post.kind ?? 'adventure') === 'adventure') {
        const author = t.users.find((u) => u.id === meId);
        if (author) author.totalAdventures = Math.max(0, author.totalAdventures - 1);
      }
      ctx.db.markDirty();
    },
  };
}
