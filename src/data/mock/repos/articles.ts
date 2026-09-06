import { generateId } from '@/core/utils/format';
import type { ArticleRepository } from '@/data/repositories';
import {
  canEdit,
  canPublish,
  filterArticles,
  isArticleValid,
  isPublished,
  matchWriters,
  normalizeTags,
  rankFeatured,
  rankWriters,
  readMinutes,
  slugifyTitle,
  sortByNewest,
  uniqueSlug,
  validateArticle,
  type Article,
  type ArticleComment,
  type ArticleWithAuthor,
  type ID,
  type User,
  type WriterProfile,
  type WriterWithUser,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/**
 * articles modülü mock repository fabrikası.
 *
 * Demo notu: `applyWriter` başvuruyu anında onaylanmış (`approvedAt: now`) kaydeder;
 * gerçek arka uçta bu alan editör onayına kadar `null` kalır. Seed'deki bekleyen
 * başvuru (`approvedAt: null`) rozet/akış görünümünü göstermek içindir.
 */
export function createArticleRepository(ctx: MockContext): ArticleRepository {
  const { db, wait, requireUser, pushNotification } = ctx;

  const findWriter = (t: Tables, userId: ID): WriterProfile | undefined =>
    t.writers.find((w) => w.userId === userId);

  const withAuthor = (t: Tables, a: Article, meId: ID): ArticleWithAuthor => ({
    ...a,
    author: requireUser(t.users, a.authorId),
    writer: findWriter(t, a.authorId) ?? null,
    likedByMe: t.articleLikes.some((l) => l.userId === meId && l.articleId === a.id),
    savedByMe: t.articleSaves.some((s) => s.userId === meId && s.articleId === a.id),
  });

  const withUser = (t: Tables, w: WriterProfile, meId: ID): WriterWithUser => ({
    ...w,
    user: requireUser(t.users, w.userId),
    followedByMe: t.writerFollows.some(
      (f) => f.followerId === meId && f.writerUserId === w.userId,
    ),
  });

  const findArticle = (t: Tables, id: ID): Article => {
    const a = t.articles.find((x) => x.id === id);
    if (!a) throw new Error(`Yazı bulunamadı: ${id}`);
    return a;
  };

  /** Taslaklar yalnızca sahibine görünür. */
  const visibleTo = (a: Article, meId: ID) => isPublished(a) || a.authorId === meId;

  const recountArticles = (t: Tables, userId: ID) => {
    const w = findWriter(t, userId);
    if (w) {
      w.articleCount = t.articles.filter((a) => a.authorId === userId && isPublished(a)).length;
    }
  };

  const commentWithAuthor = (t: Tables, c: ArticleComment): ArticleComment & { author: User } => ({
    ...c,
    author: requireUser(t.users, c.authorId),
  });

  return {
    async list(meId, filter) {
      await wait();
      const t = await db.load();
      const visible = t.articles.filter((a) => visibleTo(a, meId));
      return rankFeatured(filterArticles(visible, filter)).map((a) => withAuthor(t, a, meId));
    },

    async getBySlug(meId, slug) {
      await wait();
      const t = await db.load();
      const a = t.articles.find((x) => x.slug === slug);
      if (!a || !visibleTo(a, meId)) return null;
      if (a.authorId !== meId) {
        a.viewsCount += 1;
        db.markDirty();
      }
      return withAuthor(t, a, meId);
    },

    async writers(meId, query) {
      await wait();
      const t = await db.load();
      const approved = t.writers.filter((w) => w.approvedAt).map((w) => withUser(t, w, meId));
      return rankWriters(matchWriters(approved, query ?? ''));
    },

    async writer(meId, userId) {
      await wait();
      const t = await db.load();
      const w = findWriter(t, userId);
      return w ? withUser(t, w, meId) : null;
    },

    async myWriterProfile(meId) {
      await wait();
      const t = await db.load();
      return findWriter(t, meId) ?? null;
    },

    async applyWriter(meId, input) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const existing = findWriter(t, meId);
      if (existing?.approvedAt) throw new Error('Zaten onaylı bir yazarsın.');
      const nowIso = new Date().toISOString();
      const profile: WriterProfile = {
        userId: meId,
        penName: input.penName.trim(),
        bio: input.bio.trim(),
        languages: input.languages.map((l) => l.trim().toLowerCase()).filter(Boolean),
        topics: input.topics,
        website: input.website?.trim() || null,
        isVerified: false,
        followerCount: existing?.followerCount ?? 0,
        articleCount: existing?.articleCount ?? 0,
        appliedAt: existing?.appliedAt ?? nowIso,
        // Demo: anında onay (bkz. dosya başındaki not)
        approvedAt: nowIso,
      };
      if (existing) Object.assign(existing, profile);
      else t.writers.push(profile);
      db.markDirty();
      return profile;
    },

    async create(meId, input) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const writer = findWriter(t, meId);
      if (!canPublish(writer)) throw new Error('Önce yazar başvurusu yapmalısın.');
      const errors = validateArticle(input);
      if (!isArticleValid(errors)) {
        throw new Error(
          errors.title ? 'Başlık en az 8 karakter olmalı.' : 'Yazı en az 300 karakter olmalı.',
        );
      }
      const nowIso = new Date().toISOString();
      const article: Article = {
        id: generateId('art'),
        authorId: meId,
        slug: uniqueSlug(
          slugifyTitle(input.title),
          t.articles.map((a) => a.slug),
        ),
        title: input.title.trim(),
        subtitle: input.subtitle.trim(),
        coverUrl: input.coverUri,
        category: input.category,
        body: input.body.trim(),
        tags: normalizeTags(input.tags),
        destinationId: input.destinationId,
        countryCode: input.countryCode,
        adventureTypes: input.adventureTypes,
        readMinutes: readMinutes(input.body),
        status: input.publish ? 'published' : 'draft',
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        locale: 'tr',
        publishedAt: input.publish ? nowIso : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      t.articles.unshift(article);
      recountArticles(t, meId);
      db.markDirty();
      return withAuthor(t, article, meId);
    },

    async update(meId, articleId, input) {
      await wait();
      const t = await db.load();
      const a = findArticle(t, articleId);
      if (!canEdit(a, meId)) throw new Error('Bu yazıyı düzenleme yetkin yok.');
      const next = {
        title: input.title ?? a.title,
        body: input.body ?? a.body,
      };
      const errors = validateArticle(next);
      if (!isArticleValid(errors)) {
        throw new Error(
          errors.title ? 'Başlık en az 8 karakter olmalı.' : 'Yazı en az 300 karakter olmalı.',
        );
      }
      const nowIso = new Date().toISOString();
      if (input.title !== undefined && input.title.trim() !== a.title) {
        a.title = input.title.trim();
        a.slug = uniqueSlug(
          slugifyTitle(a.title),
          t.articles.filter((x) => x.id !== a.id).map((x) => x.slug),
        );
      }
      if (input.subtitle !== undefined) a.subtitle = input.subtitle.trim();
      if (input.coverUri !== undefined) a.coverUrl = input.coverUri;
      if (input.category !== undefined) a.category = input.category;
      if (input.body !== undefined) {
        a.body = input.body.trim();
        a.readMinutes = readMinutes(a.body);
      }
      if (input.tags !== undefined) a.tags = normalizeTags(input.tags);
      if (input.destinationId !== undefined) a.destinationId = input.destinationId;
      if (input.countryCode !== undefined) a.countryCode = input.countryCode;
      if (input.adventureTypes !== undefined) a.adventureTypes = input.adventureTypes;
      if (input.publish !== undefined) {
        if (input.publish && a.status === 'draft') {
          a.status = 'published';
          a.publishedAt = nowIso;
        } else if (!input.publish && a.status !== 'draft') {
          a.status = 'draft';
          a.publishedAt = null;
        }
      }
      a.updatedAt = nowIso;
      recountArticles(t, meId);
      db.markDirty();
      return withAuthor(t, a, meId);
    },

    async toggleLike(meId, articleId) {
      await wait();
      const t = await db.load();
      const a = findArticle(t, articleId);
      const idx = t.articleLikes.findIndex((l) => l.userId === meId && l.articleId === articleId);
      if (idx >= 0) {
        t.articleLikes.splice(idx, 1);
        a.likesCount = Math.max(0, a.likesCount - 1);
      } else {
        t.articleLikes.push({ userId: meId, articleId });
        a.likesCount += 1;
        await pushNotification({
          type: 'like',
          senderId: meId,
          receiverId: a.authorId,
          message: a.title,
          postId: null,
          matchId: null,
          targetId: a.id,
        });
      }
      db.markDirty();
      return withAuthor(t, a, meId);
    },

    async toggleSave(meId, articleId) {
      await wait();
      const t = await db.load();
      const a = findArticle(t, articleId);
      const idx = t.articleSaves.findIndex((s) => s.userId === meId && s.articleId === articleId);
      if (idx >= 0) t.articleSaves.splice(idx, 1);
      else t.articleSaves.push({ userId: meId, articleId });
      db.markDirty();
      return withAuthor(t, a, meId);
    },

    async toggleFollowWriter(meId, userId) {
      await wait();
      const t = await db.load();
      const w = findWriter(t, userId);
      if (!w) throw new Error(`Yazar bulunamadı: ${userId}`);
      if (userId === meId) throw new Error('Kendini takip edemezsin.');
      const idx = t.writerFollows.findIndex(
        (f) => f.followerId === meId && f.writerUserId === userId,
      );
      if (idx >= 0) {
        t.writerFollows.splice(idx, 1);
        w.followerCount = Math.max(0, w.followerCount - 1);
      } else {
        t.writerFollows.push({ followerId: meId, writerUserId: userId });
        w.followerCount += 1;
        await pushNotification({
          type: 'follow',
          senderId: meId,
          receiverId: userId,
          message: '',
          postId: null,
          matchId: null,
        });
      }
      db.markDirty();
      return withUser(t, w, meId);
    },

    async comments(articleId) {
      await wait();
      const t = await db.load();
      return t.articleComments
        .filter((c) => c.articleId === articleId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => commentWithAuthor(t, c));
    },

    async addComment(meId, articleId, content) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const a = findArticle(t, articleId);
      const text = content.trim();
      if (!text) throw new Error('Yorum boş olamaz.');
      const comment: ArticleComment = {
        id: generateId('ac'),
        articleId,
        authorId: meId,
        content: text,
        createdAt: new Date().toISOString(),
      };
      t.articleComments.push(comment);
      a.commentsCount += 1;
      await pushNotification({
        type: 'comment',
        senderId: meId,
        receiverId: a.authorId,
        message: text.slice(0, 120),
        postId: null,
        matchId: null,
        targetId: a.id,
      });
      db.markDirty();
      return commentWithAuthor(t, comment);
    },

    async saved(meId) {
      await wait();
      const t = await db.load();
      const ids = new Set(
        t.articleSaves.filter((s) => s.userId === meId).map((s) => s.articleId),
      );
      return sortByNewest(t.articles.filter((a) => ids.has(a.id) && visibleTo(a, meId))).map((a) =>
        withAuthor(t, a, meId),
      );
    },

    async mine(meId) {
      await wait();
      const t = await db.load();
      return [...t.articles]
        .filter((a) => a.authorId === meId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}
