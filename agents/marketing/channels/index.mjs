/** Kanal kayıt defteri — tüm adaptörler aynı arayüzü uygular. */
import { channel as facebook } from './facebook.mjs';
import { channel as instagram } from './instagram.mjs';
import { channel as linkedin } from './linkedin.mjs';
import { channel as pinterest } from './pinterest.mjs';
import { channel as reddit } from './reddit.mjs';
import { channel as telegram } from './telegram.mjs';
import { channel as tiktok } from './tiktok.mjs';
import { channel as vk } from './vk.mjs';
import { channel as x } from './x.mjs';
import { channel as youtube } from './youtube.mjs';

export const CHANNELS = { instagram, facebook, vk, telegram, x, tiktok, youtube, reddit, pinterest, linkedin };

/** Kanal kimlikleri — çıktı sırası her yerde aynı. */
export const CHANNEL_IDS = Object.keys(CHANNELS);

/** Görsel/video ağırlıklı kanallar (aynı dikey videonun gittiği yerler). */
export const VIDEO_CHANNELS = ['tiktok', 'youtube', 'instagram', 'vk'];

export function getChannel(id) {
  const c = CHANNELS[id];
  if (!c) throw new Error(`Bilinmeyen kanal: ${id}. Geçerli: ${CHANNEL_IDS.join(', ')}`);
  return c;
}

/** `--channels x,reddit` → adaptör listesi; boş/`all` → hepsi. */
export function resolveChannels(list) {
  if (!list || list.length === 0) return CHANNEL_IDS.map((id) => CHANNELS[id]);
  return list.map((id) => getChannel(id));
}

/** Kanal kurallarını okunur özet olarak döker (README ve istemler için). */
export function channelBrief(ids = CHANNEL_IDS, lang = 'tr') {
  const out = ['# Kanal kuralları'];
  for (const id of ids) {
    const s = CHANNELS[id].spec;
    out.push(`## ${s.label} (${s.id})`);
    out.push(`- Biçimler: ${s.formats.join(', ')} · günlük en fazla ${s.maxPerDay}`);
    out.push(`- Karakter ≤ ${s.maxChars} (önerilen ${s.recommendedChars}) · hashtag ≤ ${s.maxHashtags} · bağlantı: ${s.linkPolicy}`);
    out.push(`- En iyi saatler (${lang}): ${(s.bestTimes[lang] ?? s.bestTimes.tr).join(', ')}`);
    out.push(`- API ile yayın: ${s.canPublish ? `evet (${s.envKeys.join(', ')})` : 'hayır — elle yükle'}`);
    for (const r of s.rules) out.push(`- ${r}`);
  }
  return out.join('\n');
}
