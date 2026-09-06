import type { IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/core/i18n';

import type { ArticleCategory } from './enums';
import type { Article, ArticleFilter, CreateArticleInput, ID, WriterProfile } from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Başlık için en az karakter sayısı. */
export const MIN_TITLE_LENGTH = 8;
/** Gövde için en az karakter sayısı. */
export const MIN_BODY_LENGTH = 300;
/** Okuma hızı varsayımı (kelime/dakika). */
export const WORDS_PER_MINUTE = 200;
/** Bir yazıya eklenebilecek en fazla etiket. */
export const MAX_ARTICLE_TAGS = 8;
/** Popüler yazar rozeti için takipçi eşiği. */
export const TOP_WRITER_FOLLOWERS = 1000;

/* ------------------------------------------------------------------ */
/* Slug ve metin yardımcıları                                          */
/* ------------------------------------------------------------------ */

const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  I: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};

/** Türkçe karakterleri sadeleştirip URL dostu slug üretir ("Kaçkar'da kış" → "kackar-da-kis"). */
export function slugifyTitle(title: string): string {
  return title
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Aynı slug varsa `-2`, `-3` … ekleyerek tekilleştirir. */
export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Etiketleri normalize eder: küçük harf, `#` ve boşluk temizliği, tekilleştirme, sınır. */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLocaleLowerCase('tr-TR');
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_ARTICLE_TAGS) break;
  }
  return out;
}

/** Virgülle ayrılmış etiket metnini diziye çevirir. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(/[,\n]/));
}

/** Gövdedeki kelime sayısı (markdown işaretleri sayılmaz). */
export function wordCount(body: string): number {
  const text = plainText(body).trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

/** Okuma süresi (dakika); 200 kelime/dk, en az 1. */
export function readMinutes(body: string): number {
  return Math.max(1, Math.round(wordCount(body) / WORDS_PER_MINUTE));
}

/* ------------------------------------------------------------------ */
/* Basit markdown ayrıştırma                                           */
/* ------------------------------------------------------------------ */

export type ArticleBlockType = 'h1' | 'h2' | 'p' | 'li' | 'quote' | 'img';

export interface ArticleBlock {
  type: ArticleBlockType;
  text: string;
  /** Yalnızca `img` bloklarında */
  url?: string;
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;

/**
 * Basit markdown'ı bloklara ayırır:
 * `# ` başlık, `## ` alt başlık, `- ` / `* ` liste, `> ` alıntı,
 * `![alt](url)` görsel; boş satır paragraf sonu, ardışık satırlar tek paragraf.
 */
export function parseArticleBody(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push({ type: 'quote', text: quote.join(' ') });
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
  };

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }
    const img = IMG_RE.exec(trimmed);
    if (img) {
      flushAll();
      blocks.push({ type: 'img', text: img[1] ?? '', url: img[2] ?? '' });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushAll();
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushAll();
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushAll();
      blocks.push({ type: 'li', text: trimmed.slice(2).trim() });
      continue;
    }
    if (trimmed.startsWith('> ') || trimmed === '>') {
      flushParagraph();
      const text = trimmed.slice(1).trim();
      if (text) quote.push(text);
      continue;
    }
    flushQuote();
    paragraph.push(trimmed);
  }
  flushAll();
  return blocks;
}

/** Markdown işaretlerinden arındırılmış düz metin (görseller atılır). */
export function plainText(body: string): string {
  return parseArticleBody(body)
    .filter((b) => b.type !== 'img')
    .map((b) => b.text)
    .join('\n');
}

/** İlk paragraftan kısa özet; `max` karakteri aşarsa kelime sınırında kesip "…" ekler. */
export function excerpt(body: string, max = 160): string {
  const first =
    parseArticleBody(body).find((b) => b.type === 'p')?.text ?? plainText(body).split('\n')[0] ?? '';
  const text = first.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '')}…`;
}

/* ------------------------------------------------------------------ */
/* Listeleme, sıralama, ilişkilendirme                                 */
/* ------------------------------------------------------------------ */

const lower = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Yayınlanmış (draft olmayan) mı? */
export function isPublished(article: Pick<Article, 'status'>): boolean {
  return article.status !== 'draft';
}

/** Filtre uygular: arama (başlık/alt başlık/etiket), kategori, yazar, ülke, etiket, öne çıkan. */
export function filterArticles<T extends Article>(list: T[], filter: ArticleFilter): T[] {
  const q = filter.query ? lower(filter.query.trim()) : '';
  const tag = filter.tag ? lower(filter.tag.replace(/^#/, '')) : '';
  return list.filter((a) => {
    if (filter.category && a.category !== filter.category) return false;
    if (filter.authorId && a.authorId !== filter.authorId) return false;
    if (filter.countryCode && a.countryCode !== filter.countryCode) return false;
    if (filter.featuredOnly && a.status !== 'featured') return false;
    if (tag && !a.tags.some((x) => lower(x) === tag)) return false;
    if (q) {
      const hay = [a.title, a.subtitle, ...a.tags].map(lower);
      if (!hay.some((h) => h.includes(q))) return false;
    }
    return true;
  });
}

/** Etkileşim puanı: beğeni ağırlıklı, görüntülenme destekli. */
export function engagementScore(a: Pick<Article, 'likesCount' | 'viewsCount'>): number {
  return a.likesCount * 5 + a.viewsCount;
}

/** Öne çıkanlar önce, ardından beğeni+görüntülenme puanına, eşitlikte yayın tarihine göre. */
export function rankFeatured<T extends Article>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const fa = a.status === 'featured' ? 1 : 0;
    const fb = b.status === 'featured' ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const diff = engagementScore(b) - engagementScore(a);
    if (diff !== 0) return diff;
    return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
  });
}

/** Yayın tarihine göre yeniden eskiye. */
export function sortByNewest<T extends Article>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
  );
}

/**
 * İlgili yazılar: aynı destinasyon (3), aynı ülke (2), ortak etiket (1/etiket),
 * aynı kategori (1). Puanı 0 olanlar ve taslaklar elenir.
 */
export function relatedArticles<T extends Article>(article: Article, all: T[], limit = 3): T[] {
  const tags = new Set(article.tags.map(lower));
  return all
    .filter((a) => a.id !== article.id && isPublished(a))
    .map((a) => {
      let score = 0;
      if (article.destinationId && a.destinationId === article.destinationId) score += 3;
      if (article.countryCode && a.countryCode === article.countryCode) score += 2;
      score += a.tags.filter((tg) => tags.has(lower(tg))).length;
      if (a.category === article.category) score += 1;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || engagementScore(y.a) - engagementScore(x.a))
    .slice(0, limit)
    .map((x) => x.a);
}

/** Yazıyı yalnızca sahibi düzenleyebilir. */
export function canEdit(article: Pick<Article, 'authorId'>, meId: ID): boolean {
  return article.authorId === meId;
}

/* ------------------------------------------------------------------ */
/* Doğrulama                                                           */
/* ------------------------------------------------------------------ */

export type ArticleValidationError = 'titleShort' | 'bodyShort';

export interface ArticleValidation {
  title?: ArticleValidationError;
  body?: ArticleValidationError;
}

/** Başlık ≥ 8, gövde ≥ 300 karakter. Boş nesne = geçerli. */
export function validateArticle(input: Pick<CreateArticleInput, 'title' | 'body'>): ArticleValidation {
  const errors: ArticleValidation = {};
  if (input.title.trim().length < MIN_TITLE_LENGTH) errors.title = 'titleShort';
  if (input.body.trim().length < MIN_BODY_LENGTH) errors.body = 'bodyShort';
  return errors;
}

/** Doğrulama hatası var mı? */
export function isArticleValid(v: ArticleValidation): boolean {
  return !v.title && !v.body;
}

export interface WriterApplicationValidation {
  penName?: boolean;
  bio?: boolean;
  topics?: boolean;
}

/** Yazar başvurusu: mahlas ≥ 3, bio ≥ 40, en az bir konu. */
export function validateWriterApplication(input: {
  penName: string;
  bio: string;
  topics: ArticleCategory[];
}): WriterApplicationValidation {
  const errors: WriterApplicationValidation = {};
  if (input.penName.trim().length < 3) errors.penName = true;
  if (input.bio.trim().length < 40) errors.bio = true;
  if (input.topics.length === 0) errors.topics = true;
  return errors;
}

/* ------------------------------------------------------------------ */
/* Yazar rozeti ve kategori meta                                       */
/* ------------------------------------------------------------------ */

export type WriterBadgeKind = 'pending' | 'verified' | 'top' | 'writer';

/** Onay bekliyorsa `pending`; doğrulanmışsa `verified`; çok takipçili ise `top`; aksi `writer`. */
export function writerBadge(
  writer: Pick<WriterProfile, 'approvedAt' | 'isVerified' | 'followerCount'>,
): WriterBadgeKind {
  if (!writer.approvedAt) return 'pending';
  if (writer.isVerified) return 'verified';
  if (writer.followerCount >= TOP_WRITER_FOLLOWERS) return 'top';
  return 'writer';
}

/** Yazar yazı yayınlayabilir mi? (onaylanmış profil) */
export function canPublish(writer: Pick<WriterProfile, 'approvedAt'> | null | undefined): boolean {
  return Boolean(writer?.approvedAt);
}

export interface TopicMeta {
  labelKey: TranslationKey;
  icon: IconName;
  color: string;
}

/** Kategori → ikon, renk ve çeviri anahtarı. */
export const topicMeta: Record<ArticleCategory, TopicMeta> = {
  trip_report: { labelKey: 'articles.categories.trip_report', icon: 'map-pinned', color: '#5EE39B' },
  guide: { labelKey: 'articles.categories.guide', icon: 'book-open', color: '#4FB3FF' },
  gear: { labelKey: 'articles.categories.gear', icon: 'backpack', color: '#F5B301' },
  safety: { labelKey: 'articles.categories.safety', icon: 'shield-alert', color: '#F97316' },
  culture: { labelKey: 'articles.categories.culture', icon: 'landmark', color: '#C084FC' },
  photography: { labelKey: 'articles.categories.photography', icon: 'camera', color: '#F472B6' },
  opinion: { labelKey: 'articles.categories.opinion', icon: 'lightbulb', color: '#22D3EE' },
};

/** Yazar profillerini mahlas, ad ve konuya göre arar. */
export function matchWriters<
  W extends Pick<WriterProfile, 'penName' | 'bio' | 'topics'> & {
    user: { displayName: string; username: string };
  },
>(writers: W[], query: string): W[] {
  const q = lower(query.trim());
  if (!q) return writers;
  return writers.filter((w) =>
    [w.penName, w.bio, w.user.displayName, w.user.username, ...w.topics].some((s) =>
      lower(s).includes(q),
    ),
  );
}

/** Yazarları doğrulanmış ve takipçi sayısına göre sıralar. */
export function rankWriters<W extends Pick<WriterProfile, 'isVerified' | 'followerCount'>>(
  writers: W[],
): W[] {
  return [...writers].sort(
    (a, b) => Number(b.isVerified) - Number(a.isVerified) || b.followerCount - a.followerCount,
  );
}
