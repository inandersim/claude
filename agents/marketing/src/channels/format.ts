import type { Post } from '../schemas.js';
import type { ChannelSpec, FormattedPost } from './types.js';

export function normalizeHashtag(tag: string): string {
  const t = tag.trim().replace(/^#+/u, '').replace(/\s+/gu, '');
  return t ? `#${t}` : '';
}

export function dedupeHashtags(tags: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeHashtag(raw);
    const key = tag.toLocaleLowerCase('tr');
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/** Metni kelime sınırında keser, sona "…" ekler. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface ComposeOptions {
  /** Hashtag'ler metnin sonunda ayrı paragrafta mı (true) yoksa hiç mi yok (false). */
  hashtags?: boolean;
  /** CTA'yı gövdeye ekle. */
  cta?: boolean;
  /** "link in bio" notu (Instagram/TikTok gibi tıklanmayan link politikası). */
  linkNote?: string;
}

/** Ortak kompozisyon: gövde → CTA → link → hashtag; kanal sınırlarını uygular. */
export function compose(
  post: Post,
  spec: ChannelSpec,
  options: ComposeOptions = {},
): FormattedPost {
  const warnings: string[] = [];
  const hashtags =
    options.hashtags === false ? [] : dedupeHashtags(post.hashtags, spec.maxHashtags);
  if (post.hashtags.length > spec.maxHashtags)
    warnings.push(`hashtag sayısı ${post.hashtags.length} → ${spec.maxHashtags}'e düşürüldü`);

  const parts: string[] = [post.body.trim()];
  if (options.cta !== false && post.cta.trim()) parts.push(post.cta.trim());

  let link = '';
  if (spec.linkPolicy === 'inline' && post.link.trim()) {
    link = post.link.trim();
    parts.push(link);
  } else if (spec.linkPolicy === 'bio' && post.link.trim()) {
    link = post.link.trim();
    if (options.linkNote) parts.push(options.linkNote);
    warnings.push('bağlantı metinde tıklanmaz; bio bağlantısını güncelle');
  }

  if (hashtags.length > 0) parts.push(hashtags.join(' '));

  let text = parts.join('\n\n');
  if (text.length > spec.maxChars) {
    warnings.push(`metin ${text.length} karakter, sınır ${spec.maxChars} — gövde kısaltıldı`);
    const tail = parts.slice(1).join('\n\n');
    const room = spec.maxChars - tail.length - 2;
    text = [truncate(post.body.trim(), Math.max(40, room)), tail].filter(Boolean).join('\n\n');
  } else if (text.length > spec.recommendedChars) {
    warnings.push(`metin ${text.length} karakter; önerilen ≤ ${spec.recommendedChars}`);
  }

  return { text, title: post.title.trim(), hashtags, link, warnings };
}

/** Hook (ilk satır) çok uzunsa uyar — Instagram 125, Facebook ~80 karakterde "daha fazla" keser. */
export function hookWarning(body: string, foldAt: number): string | null {
  const firstLine = body.split('\n')[0] ?? '';
  return firstLine.length > foldAt
    ? `ilk satır ${firstLine.length} karakter; ${foldAt} karakterden önce kanca ver`
    : null;
}
