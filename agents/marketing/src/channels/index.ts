import type { Lang } from '../brand.js';
import { CHANNEL_IDS, type ChannelId, type Post } from '../schemas.js';
import { channel as facebook } from './facebook.js';
import { channel as instagram } from './instagram.js';
import { channel as reddit } from './reddit.js';
import { channel as telegram } from './telegram.js';
import { channel as tiktok } from './tiktok.js';
import type { Channel, FormattedPost } from './types.js';
import { channel as vk } from './vk.js';
import { channel as youtube } from './youtube.js';

export const CHANNELS: Record<ChannelId, Channel> = {
  instagram,
  facebook,
  vk,
  tiktok,
  youtube,
  telegram,
  reddit,
};

export function getChannel(id: string): Channel {
  if (!(CHANNEL_IDS as readonly string[]).includes(id))
    throw new Error(`Bilinmeyen kanal: ${id}. Geçerli: ${CHANNEL_IDS.join(', ')}`);
  return CHANNELS[id as ChannelId];
}

export function parseChannelList(raw: string | undefined): ChannelId[] {
  if (!raw || raw.trim() === '' || raw === 'all') return [...CHANNEL_IDS];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((id) => getChannel(id).spec.id);
}

export function formatPost(post: Post): FormattedPost {
  return getChannel(post.channel).format(post);
}

/** Kanal kurallarını istem metnine dönüştürür (deterministik sıra → önbellek dostu). */
export function channelBrief(ids: readonly ChannelId[], lang: Lang = 'tr'): string {
  const lines: string[] = ['# Kanal kuralları'];
  for (const id of ids) {
    const s = CHANNELS[id].spec;
    lines.push(`## ${s.label} (${s.id})`);
    lines.push(`- Biçimler: ${s.formats.join(', ')}`);
    lines.push(
      `- Karakter: platform ${s.maxChars}, önerilen ≤ ${s.recommendedChars}; hashtag ≤ ${s.maxHashtags}; bağlantı: ${s.linkPolicy}`,
    );
    lines.push(`- En iyi saatler (${lang}): ${s.bestTimes[lang].join(', ')}`);
    lines.push(`- Ton: ${s.tone}`);
    for (const r of s.rules) lines.push(`- ${r}`);
    lines.push(`- API ile yayın: ${s.canPublish ? 'evet' : 'hayır (elle yükle)'}`);
  }
  return lines.join('\n');
}

export type { Channel, FormattedPost, PublishContext, PublishResult } from './types.js';
