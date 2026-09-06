import type { TranslationKey } from '@/core/i18n';

import type { PostKind, ReactionType } from './enums';
import { REACTION_TYPES } from './enums';
import type {
  FeedPost,
  Follow,
  HashtagSummary,
  ID,
  ISODate,
  Post,
  Reaction,
  SocialFilter,
  User,
} from './types';

/**
 * Sosyal paylaşım — saf iş mantığı.
 *
 * Hashtag/mention ayrıştırma, tepki özetleri, akış filtreleri ve trend
 * hesapları burada yaşar; React/RN bağımlılığı yoktur.
 */

/** Bir durum gönderisine eklenebilecek en fazla fotoğraf */
export const MAX_STATUS_PHOTOS = 5;
/** Durum metni üst sınırı */
export const MAX_STATUS_LENGTH = 1000;
/** Trend hesabında "yakın geçmiş" penceresi (gün) */
export const TRENDING_WINDOW_DAYS = 7;

/* ------------------------------------------------------------------ */
/* Tepki meta                                                          */
/* ------------------------------------------------------------------ */

export type ReactionIconName = 'heart' | 'sparkles' | 'zap' | 'flame' | 'award';

export interface ReactionMeta {
  icon: ReactionIconName;
  color: string;
  labelKey: TranslationKey;
}

export const REACTION_META: Record<ReactionType, ReactionMeta> = {
  like: { icon: 'heart', color: '#FF6B6B', labelKey: 'social.reaction.like' },
  love: { icon: 'sparkles', color: '#F06292', labelKey: 'social.reaction.love' },
  wow: { icon: 'zap', color: '#FFD54F', labelKey: 'social.reaction.wow' },
  fire: { icon: 'flame', color: '#FF8A5B', labelKey: 'social.reaction.fire' },
  strong: { icon: 'award', color: '#6CB4FF', labelKey: 'social.reaction.strong' },
};

/* ------------------------------------------------------------------ */
/* Metin ayrıştırma                                                    */
/* ------------------------------------------------------------------ */

/** Türkçe karakterleri de kapsayan etiket gövdesi: harf, rakam, alt çizgi */
const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
/** Kullanıcı adı: harf/rakam/alt çizgi, içte nokta olabilir ama sonda olamaz */
const MENTION_RE = /@([\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*)/gu;
/** Her iki işaretçiyi tek geçişte yakalar (renderSegments için) */
const TOKEN_RE = /#([\p{L}\p{N}_]+)|@([\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*)/gu;

/** Etiketi normalize eder: küçük harf (Türkçe kurallı), başındaki # atılır. */
export function normalizeHashtag(tag: string): string {
  return tag.replace(/^#/, '').toLocaleLowerCase('tr-TR');
}

/** Metindeki #etiketleri küçük harfe çevirip tekilleştirir (sıra korunur). */
export function parseHashtags(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(HASHTAG_RE)) {
    const tag = normalizeHashtag(match[1] ?? '');
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** Metindeki @kullanıcı adlarını kullanıcı kimliklerine çevirir (bulunamayanlar atlanır). */
export function parseMentions(text: string, users: Pick<User, 'id' | 'username'>[]): ID[] {
  const byUsername = new Map(users.map((u) => [u.username.toLocaleLowerCase('tr-TR'), u.id]));
  const out: ID[] = [];
  for (const match of text.matchAll(MENTION_RE)) {
    const id = byUsername.get((match[1] ?? '').toLocaleLowerCase('tr-TR'));
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'hashtag'; text: string; tag: string }
  | { kind: 'mention'; text: string; username: string };

/** Metni düz / etiket / bahsetme parçalarına böler; bileşen bunları tıklanabilir yapar. */
export function renderSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, index) });
    const token = match[0];
    if (match[1] !== undefined) {
      segments.push({ kind: 'hashtag', text: token, tag: normalizeHashtag(match[1]) });
    } else {
      segments.push({ kind: 'mention', text: token, username: match[2] ?? '' });
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/** Yazarken imlecin bulunduğu kelime `#`/`@` ile başlıyorsa öneri için döner. */
export function activeToken(
  text: string,
  cursor: number,
): { kind: 'hashtag' | 'mention'; query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|\s)([#@])([\p{L}\p{N}_.]*)$/u.exec(before);
  if (!match) return null;
  const marker = match[2];
  const query = match[3] ?? '';
  const start = before.length - query.length - 1;
  return { kind: marker === '#' ? 'hashtag' : 'mention', query, start };
}

/** Aktif kelimeyi seçilen öneriyle değiştirir; yeni metin ve imleç konumunu döner. */
export function replaceActiveToken(
  text: string,
  cursor: number,
  replacement: string,
): { text: string; cursor: number } {
  const token = activeToken(text, cursor);
  if (!token) return { text, cursor };
  const head = text.slice(0, token.start);
  const tail = text.slice(cursor);
  const inserted = `${replacement} `;
  return { text: head + inserted + tail, cursor: head.length + inserted.length };
}

/* ------------------------------------------------------------------ */
/* Tepkiler                                                            */
/* ------------------------------------------------------------------ */

export interface ReactionSummaryResult {
  counts: Record<ReactionType, number>;
  total: number;
  /** En çok kullanılan en fazla 3 tür (çoktan aza) */
  top: ReactionType[];
}

export function emptyReactionCounts(): Record<ReactionType, number> {
  return { like: 0, love: 0, wow: 0, fire: 0, strong: 0 };
}

/** Tepki listesinden ya da sayım tablosundan özet üretir. */
export function reactionSummary(
  input: Pick<Reaction, 'type'>[] | Partial<Record<ReactionType, number>> | null | undefined,
): ReactionSummaryResult {
  const counts = emptyReactionCounts();
  if (Array.isArray(input)) {
    for (const r of input) counts[r.type] += 1;
  } else if (input) {
    for (const type of REACTION_TYPES) counts[type] = Math.max(0, input[type] ?? 0);
  }
  const total = REACTION_TYPES.reduce((sum, type) => sum + counts[type], 0);
  const top = [...REACTION_TYPES]
    .filter((type) => counts[type] > 0)
    .sort((a, b) => counts[b] - counts[a] || REACTION_TYPES.indexOf(a) - REACTION_TYPES.indexOf(b))
    .slice(0, 3);
  return { counts, total, top };
}

/**
 * Bir tepki değişikliğini sayım tablosuna uygular (iyimser güncelleme için).
 * `likesCount` toplam tepki sayısı olarak tutulur; 'like' türü artık geri kalanıdır.
 */
export function applyReactionChange<
  T extends Pick<FeedPost, 'myReaction' | 'reactionCounts' | 'likesCount' | 'likedByMe'>,
>(post: T, next: ReactionType | null): T {
  const prev = post.myReaction ?? null;
  if (prev === next) return post;
  const counts = { ...reactionSummary(post.reactionCounts).counts };
  let likesCount = post.likesCount;
  if (prev) {
    counts[prev] = Math.max(0, counts[prev] - 1);
    likesCount = Math.max(0, likesCount - 1);
  }
  if (next) {
    counts[next] += 1;
    likesCount += 1;
  }
  return {
    ...post,
    myReaction: next,
    reactionCounts: counts,
    likesCount,
    likedByMe: next !== null,
  };
}

/* ------------------------------------------------------------------ */
/* Gönderi türü ve yardımcılar                                          */
/* ------------------------------------------------------------------ */

/** Eski kayıtlarda `kind` yoktur; bunlar macera gönderisidir. */
export function postKindOf(post: Pick<Post, 'kind'>): PostKind {
  return post.kind ?? 'adventure';
}

/** Durum/fotoğraf gönderisi mi (teknik metrikler gizlenir)? */
export function isSocialPost(post: Pick<Post, 'kind'>): boolean {
  return postKindOf(post) !== 'adventure';
}

/** Fotoğraf sayısına göre gönderi türü */
export function statusKindFor(imageCount: number): PostKind {
  return imageCount > 0 ? 'photo' : 'status';
}

/** Gönderinin tüm görselleri (`images` yoksa `imageUrl`) */
export function postImages(post: Pick<Post, 'imageUrl' | 'images'>): string[] {
  if (post.images && post.images.length > 0) return post.images;
  return post.imageUrl ? [post.imageUrl] : [];
}

/** Yalnızca yazar silebilir. */
export function canDelete(post: Pick<Post, 'authorId'>, meId: ID): boolean {
  return post.authorId === meId;
}

/** Durum gönderisi giriş doğrulaması; hata anahtarı ya da null döner. */
export function validateStatusInput(input: {
  caption: string;
  imageUris: string[];
}): 'captionRequired' | 'photosLimit' | 'tooLong' | null {
  const caption = input.caption.trim();
  if (!caption && input.imageUris.length === 0) return 'captionRequired';
  if (input.imageUris.length > MAX_STATUS_PHOTOS) return 'photosLimit';
  if (caption.length > MAX_STATUS_LENGTH) return 'tooLong';
  return null;
}

/* ------------------------------------------------------------------ */
/* Akış filtreleri                                                     */
/* ------------------------------------------------------------------ */

/** Takip edilen kullanıcı kimlikleri (kendisi dahil). */
export function followingSet(follows: Pick<Follow, 'followerId' | 'followingId'>[], meId: ID) {
  const set = new Set<ID>([meId]);
  for (const f of follows) if (f.followerId === meId) set.add(f.followingId);
  return set;
}

/** Sekme + etiket filtresi; sonuç tarihe göre azalan sıralıdır. */
export function applyFeedFilter<T extends Post>(
  posts: T[],
  filter: SocialFilter,
  follows: Pick<Follow, 'followerId' | 'followingId'>[],
  meId: ID,
): T[] {
  const following = filter.tab === 'following' ? followingSet(follows, meId) : null;
  const tag = filter.hashtag ? normalizeHashtag(filter.hashtag) : null;
  return posts
    .filter((post) => {
      const kind = postKindOf(post);
      if (filter.tab === 'adventures' && kind !== 'adventure') return false;
      if (filter.tab === 'status' && kind === 'adventure') return false;
      if (following && !following.has(post.authorId)) return false;
      if (tag && !(post.hashtags ?? []).includes(tag)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------------------------------ */
/* Trend & keşif                                                       */
/* ------------------------------------------------------------------ */

function toMillis(now: number | ISODate | Date): number {
  if (typeof now === 'number') return now;
  if (now instanceof Date) return now.getTime();
  return new Date(now).getTime();
}

/**
 * Son 7 gün ağırlıklı trend etiketler. Yakın geçmişteki kullanımlar 2 puan,
 * eskiler 1 puan; `trending`, kullanımın en az yarısı son 7 günde ise true.
 */
export function trendingHashtags(
  posts: Pick<Post, 'hashtags' | 'createdAt'>[],
  now: number | ISODate | Date,
  limit = 10,
): HashtagSummary[] {
  const nowMs = toMillis(now);
  const windowMs = TRENDING_WINDOW_DAYS * 86_400_000;
  const stats = new Map<string, { count: number; recent: number }>();
  for (const post of posts) {
    const tags = post.hashtags ?? [];
    if (tags.length === 0) continue;
    const isRecent = nowMs - new Date(post.createdAt).getTime() <= windowMs;
    for (const raw of new Set(tags.map(normalizeHashtag))) {
      const entry = stats.get(raw) ?? { count: 0, recent: 0 };
      entry.count += 1;
      if (isRecent) entry.recent += 1;
      stats.set(raw, entry);
    }
  }
  return [...stats.entries()]
    .map(([tag, s]) => ({
      tag,
      count: s.count,
      trending: s.recent > 0 && s.recent * 2 >= s.count,
      score: s.recent * 2 + (s.count - s.recent),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.tag.localeCompare(b.tag, 'tr'))
    .slice(0, limit)
    .map(({ tag, count, trending }) => ({ tag, count, trending }));
}

/** Toplam etkileşime (tepki + yorum) göre popüler gönderiler. */
export function popularPosts<
  T extends Pick<FeedPost, 'likesCount' | 'commentsCount' | 'reactionCounts' | 'repostsCount'>,
>(posts: T[], limit = 5): T[] {
  const score = (p: T) =>
    Math.max(p.likesCount, reactionSummary(p.reactionCounts).total) +
    p.commentsCount * 2 +
    (p.repostsCount ?? 0) * 3;
  return [...posts].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** Takip edilmeyen, en çok gönderisi olan kullanıcılar. */
export function suggestedUsers<U extends Pick<User, 'id' | 'followersCount'>>(
  users: U[],
  posts: Pick<Post, 'authorId'>[],
  follows: Pick<Follow, 'followerId' | 'followingId'>[],
  meId: ID,
  limit = 5,
): U[] {
  const following = followingSet(follows, meId);
  const postCount = new Map<ID, number>();
  for (const p of posts) postCount.set(p.authorId, (postCount.get(p.authorId) ?? 0) + 1);
  return users
    .filter((u) => !following.has(u.id))
    .sort(
      (a, b) =>
        (postCount.get(b.id) ?? 0) - (postCount.get(a.id) ?? 0) ||
        b.followersCount - a.followersCount,
    )
    .slice(0, limit);
}

/** Kullanıcı arama (mention önerisi): kullanıcı adı ya da görünen ad ile başlar/içerir. */
export function matchUsers<U extends Pick<User, 'username' | 'displayName' | 'followersCount'>>(
  users: U[],
  query: string,
  limit = 8,
): U[] {
  const q = query.replace(/^@/, '').trim().toLocaleLowerCase('tr-TR');
  const scored = users
    .map((u) => {
      const username = u.username.toLocaleLowerCase('tr-TR');
      const name = u.displayName.toLocaleLowerCase('tr-TR');
      let score = 0;
      if (!q) score = 1;
      else if (username.startsWith(q)) score = 4;
      else if (name.startsWith(q)) score = 3;
      else if (username.includes(q)) score = 2;
      else if (name.includes(q)) score = 1;
      return { u, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.u.followersCount - a.u.followersCount);
  return scored.slice(0, limit).map((x) => x.u);
}
