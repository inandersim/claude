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
  type ArticleWithAuthor,
  type ID,
  type WriterProfile,
  type WriterWithUser,
} from '@/domain';

import type { ArticleRepository } from '../../repositories';
import { PROFILE_SELECT, fetchUsers, notify, pickUser, requireUser, type RemoteContext } from '../context';
import { toArticle, toArticleComment, toUser, toWriterProfile } from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/**
 * articles modülü uzak repository fabrikası.
 *
 * Demo notu: `applyWriter` başvuruyu anında onaylanmış (`approved_at = now()`)
 * kaydeder — mock ile aynı davranış. Gerçek editör akışında bu alan boş kalır.
 */
export function createArticleRepository(ctx: RemoteContext): ArticleRepository {
  const { db } = ctx;

  const findWriter = async (userId: ID): Promise<WriterProfile | null> => {
    const row = await maybeRow(
      db.from('writer_profiles').select('*').eq('user_id', userId),
      'yazar profili okunamadı',
    );
    return row ? toWriterProfile(row) : null;
  };

  const findArticle = async (id: ID): Promise<Article> => {
    const row = await maybeRow(db.from('articles').select('*').eq('id', id), 'yazı okunamadı');
    if (!row) throw new Error(`Yazı bulunamadı: ${id}`);
    return toArticle(row);
  };

  const withAuthorMany = async (articles: Article[], meId: ID): Promise<ArticleWithAuthor[]> => {
    if (!articles.length) return [];
    const ids = articles.map((a) => a.id);
    const authorIds = Array.from(new Set(articles.map((a) => a.authorId)));
    const [users, writerRows, likeRows, saveRows] = await Promise.all([
      fetchUsers(db, authorIds),
      rows(db.from('writer_profiles').select('*').in('user_id', authorIds), 'yazarlar okunamadı'),
      rows(
        db.from('article_likes').select('article_id').eq('user_id', meId).in('article_id', ids),
        'beğeniler okunamadı',
      ),
      rows(
        db.from('article_saves').select('article_id').eq('user_id', meId).in('article_id', ids),
        'kayıtlar okunamadı',
      ),
    ]);
    const writers = new Map(writerRows.map((row) => [String(row.user_id), toWriterProfile(row)]));
    const liked = new Set(likeRows.map((row) => String(row.article_id)));
    const saved = new Set(saveRows.map((row) => String(row.article_id)));
    return articles.map((a) => ({
      ...a,
      author: pickUser(users, a.authorId),
      writer: writers.get(a.authorId) ?? null,
      likedByMe: liked.has(a.id),
      savedByMe: saved.has(a.id),
    }));
  };

  const oneArticle = async (id: ID, meId: ID): Promise<ArticleWithAuthor> => {
    const [result] = await withAuthorMany([await findArticle(id)], meId);
    if (!result) throw new Error(`Yazı bulunamadı: ${id}`);
    return result;
  };

  const withUser = async (writer: WriterProfile, meId: ID): Promise<WriterWithUser> => {
    const user = await requireUser(db, writer.userId);
    const follow = await maybeRow(
      db
        .from('writer_follows')
        .select('writer_user_id')
        .eq('follower_id', meId)
        .eq('writer_user_id', writer.userId),
      'takip okunamadı',
    );
    return { ...writer, user, followedByMe: follow !== null };
  };

  /** Taslaklar yalnızca sahibine görünür. */
  const visibleTo = (a: Article, meId: ID) => isPublished(a) || a.authorId === meId;

  const recountArticles = async (userId: ID): Promise<void> => {
    // `articles_writer_count` tetikleyicisi bu sayacı zaten günceller;
    // ek bir işlem gerekmez.
    void userId;
  };

  return {
    async list(meId, filter) {
      const data = await rows(db.from('articles').select('*'), 'yazılar okunamadı');
      const visible = data.map(toArticle).filter((a) => visibleTo(a, meId));
      return await withAuthorMany(rankFeatured(filterArticles(visible, filter)), meId);
    },

    async getBySlug(meId, slug) {
      const row = await maybeRow(db.from('articles').select('*').eq('slug', slug), 'yazı okunamadı');
      if (!row) return null;
      const article = toArticle(row);
      if (!visibleTo(article, meId)) return null;
      if (article.authorId !== meId) {
        await rows(
          db.from('articles').update({ views_count: article.viewsCount + 1 }).eq('id', article.id),
          'okunma sayacı güncellenemedi',
        );
      }
      return await oneArticle(article.id, meId);
    },

    async writers(meId, query) {
      const data = await rows(
        db.from('writer_profiles').select('*').not('approved_at', 'is', null),
        'yazarlar okunamadı',
      );
      const writers = data.map(toWriterProfile);
      const users = await fetchUsers(db, writers.map((w) => w.userId));
      const follows = await rows(
        db.from('writer_follows').select('writer_user_id').eq('follower_id', meId),
        'takipler okunamadı',
      );
      const followed = new Set(follows.map((row) => String(row.writer_user_id)));
      const enriched = writers.flatMap<WriterWithUser>((w) => {
        const user = users.get(w.userId);
        return user ? [{ ...w, user, followedByMe: followed.has(w.userId) }] : [];
      });
      return rankWriters(matchWriters(enriched, query ?? ''));
    },

    async writer(meId, userId) {
      const writer = await findWriter(userId);
      return writer ? await withUser(writer, meId) : null;
    },

    async myWriterProfile(meId) {
      return await findWriter(meId);
    },

    async applyWriter(meId, input) {
      await requireUser(db, meId);
      const existing = await findWriter(meId);
      if (existing?.approvedAt) throw new Error('Zaten onaylı bir yazarsın.');
      const nowIso = new Date().toISOString();
      const created = await oneRow(
        db
          .from('writer_profiles')
          .upsert(
            {
              user_id: meId,
              pen_name: input.penName.trim(),
              bio: input.bio.trim(),
              languages: input.languages.map((l) => l.trim().toLowerCase()).filter(Boolean),
              topics: input.topics,
              website: input.website?.trim() || null,
              is_verified: false,
              applied_at: existing?.appliedAt ?? nowIso,
              // Demo: anında onay (bkz. dosya başındaki not)
              approved_at: nowIso,
            },
            { onConflict: 'user_id' },
          )
          .select('*'),
        'yazar başvurusu kaydedilemedi',
      );
      return toWriterProfile(created);
    },

    async create(meId, input) {
      await requireUser(db, meId);
      const writer = await findWriter(meId);
      if (!canPublish(writer)) throw new Error('Önce yazar başvurusu yapmalısın.');
      const errors = validateArticle(input);
      if (!isArticleValid(errors)) {
        throw new Error(
          errors.title ? 'Başlık en az 8 karakter olmalı.' : 'Yazı en az 300 karakter olmalı.',
        );
      }
      const slugs = await rows(db.from('articles').select('slug'), 'yazılar okunamadı');
      const nowIso = new Date().toISOString();
      const created = await oneRow(
        db
          .from('articles')
          .insert({
            author_id: meId,
            slug: uniqueSlug(
              slugifyTitle(input.title),
              slugs.map((row) => String(row.slug)),
            ),
            title: input.title.trim(),
            subtitle: input.subtitle.trim(),
            cover_url: input.coverUri,
            category: input.category,
            body: input.body.trim(),
            tags: normalizeTags(input.tags),
            destination_id: input.destinationId,
            country_code: input.countryCode,
            adventure_types: input.adventureTypes,
            read_minutes: readMinutes(input.body),
            status: input.publish ? 'published' : 'draft',
            locale: 'tr',
            published_at: input.publish ? nowIso : null,
          })
          .select('*'),
        'yazı oluşturulamadı',
      );
      await recountArticles(meId);
      return await oneArticle(String(created.id), meId);
    },

    async update(meId, articleId, input) {
      const article = await findArticle(articleId);
      if (!canEdit(article, meId)) throw new Error('Bu yazıyı düzenleme yetkin yok.');
      const next = { title: input.title ?? article.title, body: input.body ?? article.body };
      const errors = validateArticle(next);
      if (!isArticleValid(errors)) {
        throw new Error(
          errors.title ? 'Başlık en az 8 karakter olmalı.' : 'Yazı en az 300 karakter olmalı.',
        );
      }
      const nowIso = new Date().toISOString();
      const patch: Row = {};
      if (input.title !== undefined && input.title.trim() !== article.title) {
        const slugs = await rows(
          db.from('articles').select('slug').neq('id', articleId),
          'yazılar okunamadı',
        );
        patch.title = input.title.trim();
        patch.slug = uniqueSlug(
          slugifyTitle(input.title.trim()),
          slugs.map((row) => String(row.slug)),
        );
      }
      if (input.subtitle !== undefined) patch.subtitle = input.subtitle.trim();
      if (input.coverUri !== undefined) patch.cover_url = input.coverUri;
      if (input.category !== undefined) patch.category = input.category;
      if (input.body !== undefined) {
        patch.body = input.body.trim();
        patch.read_minutes = readMinutes(input.body);
      }
      if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
      if (input.destinationId !== undefined) patch.destination_id = input.destinationId;
      if (input.countryCode !== undefined) patch.country_code = input.countryCode;
      if (input.adventureTypes !== undefined) patch.adventure_types = input.adventureTypes;
      if (input.publish !== undefined) {
        if (input.publish && article.status === 'draft') {
          patch.status = 'published';
          patch.published_at = nowIso;
        } else if (!input.publish && article.status !== 'draft') {
          patch.status = 'draft';
          patch.published_at = null;
        }
      }
      if (Object.keys(patch).length) {
        await rows(db.from('articles').update(patch).eq('id', articleId), 'yazı güncellenemedi');
      }
      await recountArticles(meId);
      return await oneArticle(articleId, meId);
    },

    async toggleLike(meId, articleId) {
      const article = await findArticle(articleId);
      const existing = await maybeRow(
        db.from('article_likes').select('article_id').eq('user_id', meId).eq('article_id', articleId),
        'beğeni okunamadı',
      );
      // `article_likes_count` tetikleyicisi sayacı günceller.
      if (existing) {
        await rows(
          db.from('article_likes').delete().eq('user_id', meId).eq('article_id', articleId),
          'beğeni kaldırılamadı',
        );
      } else {
        await rows(
          db.from('article_likes').insert({ user_id: meId, article_id: articleId }),
          'beğenilemedi',
        );
        await notify(db, {
          type: 'like',
          senderId: meId,
          receiverId: article.authorId,
          message: article.title,
          postId: null,
          matchId: null,
          targetId: article.id,
        });
      }
      return await oneArticle(articleId, meId);
    },

    async toggleSave(meId, articleId) {
      await findArticle(articleId);
      const existing = await maybeRow(
        db.from('article_saves').select('article_id').eq('user_id', meId).eq('article_id', articleId),
        'kayıt okunamadı',
      );
      if (existing) {
        await rows(
          db.from('article_saves').delete().eq('user_id', meId).eq('article_id', articleId),
          'kayıt kaldırılamadı',
        );
      } else {
        await rows(
          db.from('article_saves').insert({ user_id: meId, article_id: articleId }),
          'kaydedilemedi',
        );
      }
      return await oneArticle(articleId, meId);
    },

    async toggleFollowWriter(meId, userId) {
      const writer = await findWriter(userId);
      if (!writer) throw new Error(`Yazar bulunamadı: ${userId}`);
      if (userId === meId) throw new Error('Kendini takip edemezsin.');
      const existing = await maybeRow(
        db
          .from('writer_follows')
          .select('writer_user_id')
          .eq('follower_id', meId)
          .eq('writer_user_id', userId),
        'takip okunamadı',
      );
      // `writer_follows_count` tetikleyicisi sayacı günceller.
      if (existing) {
        await rows(
          db.from('writer_follows').delete().eq('follower_id', meId).eq('writer_user_id', userId),
          'takipten çıkılamadı',
        );
      } else {
        await rows(
          db.from('writer_follows').insert({ follower_id: meId, writer_user_id: userId }),
          'takip edilemedi',
        );
        await notify(db, {
          type: 'follow',
          senderId: meId,
          receiverId: userId,
          message: '',
          postId: null,
          matchId: null,
        });
      }
      const fresh = await findWriter(userId);
      if (!fresh) throw new Error(`Yazar bulunamadı: ${userId}`);
      return await withUser(fresh, meId);
    },

    async comments(articleId) {
      const data = await rows(
        db
          .from('article_comments')
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`)
          .eq('article_id', articleId)
          .order('created_at', { ascending: true }),
        'yorumlar okunamadı',
      );
      return data.map((row) => ({
        ...toArticleComment(row),
        author: toUser((row.author ?? {}) as Row),
      }));
    },

    async addComment(meId, articleId, content) {
      await requireUser(db, meId);
      const article = await findArticle(articleId);
      const text = content.trim();
      if (!text) throw new Error('Yorum boş olamaz.');
      // `article_comments_count` tetikleyicisi sayacı günceller.
      const created = await oneRow(
        db
          .from('article_comments')
          .insert({ article_id: articleId, author_id: meId, content: text })
          .select(`*, author:profiles!author_id(${PROFILE_SELECT})`),
        'yorum eklenemedi',
      );
      await notify(db, {
        type: 'comment',
        senderId: meId,
        receiverId: article.authorId,
        message: text.slice(0, 120),
        postId: null,
        matchId: null,
        targetId: article.id,
      });
      return { ...toArticleComment(created), author: toUser((created.author ?? {}) as Row) };
    },

    async saved(meId) {
      const saves = await rows(
        db.from('article_saves').select('article_id').eq('user_id', meId),
        'kayıtlar okunamadı',
      );
      const ids = saves.map((row) => String(row.article_id));
      if (!ids.length) return [];
      const data = await rows(db.from('articles').select('*').in('id', ids), 'yazılar okunamadı');
      const visible = data.map(toArticle).filter((a) => visibleTo(a, meId));
      return await withAuthorMany(sortByNewest(visible), meId);
    },

    async mine(meId) {
      const data = await rows(
        db
          .from('articles')
          .select('*')
          .eq('author_id', meId)
          .order('updated_at', { ascending: false }),
        'yazılar okunamadı',
      );
      return data.map(toArticle);
    },
  };
}
