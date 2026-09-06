import type { Post } from '../schemas.js';
import { compose, truncate } from './format.js';
import type { Channel, ChannelSpec, FormattedPost } from './types.js';

export const spec: ChannelSpec = {
  id: 'youtube',
  label: 'YouTube (Shorts + uzun format)',
  maxChars: 5000,
  recommendedChars: 1500,
  maxHashtags: 3,
  linkPolicy: 'inline',
  formats: ['short', 'long_video', 'live'],
  bestTimes: { tr: ['18:00', '20:00'], en: ['16:00', '20:00'], ru: ['17:00', '20:00'] },
  tone: 'Uzun formatta rehber tonu (SEO: "Kaçkar Dağları trekking rehberi 2026"); Shorts’ta TikTok gibi. Açıklamada bölümler (00:00), kaynaklar, uygulama bağlantısı UTM ile.',
  rules: [
    'Başlık ≤ 60 karakter, anahtar kelime başta; küçük resimde ≤ 4 kelime.',
    'Açıklama: ilk 2 satır özet + bağlantı; bölüm zaman damgaları; 3 hashtag.',
    'Uzun video 8–15 dk: rota, ulaşım, konaklama, güvenlik, maliyet; blog yazısına dönüştür (SEO landing).',
    'Shorts: dikey, ≤ 60 sn, başlıkta #Shorts.',
    'Yorumlara sabitlenmiş "Zirtan’de rota" bağlantısı.',
  ],
  canPublish: false,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec);
  out.title = truncate(post.title, 100);
  if (post.title.length > 60)
    out.warnings.push('başlık 60 karakteri aşıyor (arama sonuçlarında kesilir)');
  if (post.format === 'long_video' && post.scenes.length < 3)
    out.warnings.push('uzun video için en az 3 bölüm/sahne bekleniyor');
  return out;
}

export const channel: Channel = { spec, format };
