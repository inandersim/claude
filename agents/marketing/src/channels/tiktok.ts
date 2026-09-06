import type { Post } from '../schemas.js';
import { compose } from './format.js';
import type { Channel, ChannelSpec, FormattedPost } from './types.js';

export const spec: ChannelSpec = {
  id: 'tiktok',
  label: 'TikTok',
  maxChars: 2200,
  recommendedChars: 150,
  maxHashtags: 5,
  linkPolicy: 'none',
  formats: ['short', 'live'],
  bestTimes: { tr: ['12:00', '18:00', '22:00'], en: ['15:00', '21:00'], ru: ['13:00', '20:00'] },
  tone: 'Ham, telefonla çekilmiş, ilk 1 sn kanca ("Bunu Kaçkar’da yapma"), 15–35 sn, altyazı büyük; ses trendine bin ama sessiz de anlaşılsın.',
  rules: [
    'Açıklama 1–2 cümle + 3–5 hashtag; #keşfet #fyp yerine niş etiket (#trekking #kaçkar).',
    'Bağlantı yok (1000 takipçi altı) → profil bio; "profildeki link" deme, "Zirtan’yi ara" de.',
    'Seri mantığı: "3 gün / 3 bölüm", "bunu yapma #1..#10" — izleyici bir sonrakini bekler.',
    'Yorumlara video ile yanıt ver (reply-with-video) — en ucuz ikinci içerik.',
    'Aynı videoyu Reels ve Shorts’a filigransız yükle (CapCut’tan dışa aktar).',
  ],
  canPublish: false,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec, { cta: true });
  if (post.scenes.length === 0) out.warnings.push('TikTok için sahne senaryosu yok');
  return out;
}

export const channel: Channel = { spec, format };
