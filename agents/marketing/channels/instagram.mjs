/** Instagram — ana vitrin. Graph API (iş/creator hesabı + bağlı Facebook sayfası) ile yayın. */
import { defineChannel } from './base.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';

export const spec = {
  id: 'instagram',
  label: 'Instagram',
  maxChars: 2200,
  recommendedChars: 900,
  maxHashtags: 12,
  foldAt: 125,
  linkPolicy: 'bio',
  formats: ['reel', 'carousel', 'single_image', 'story', 'collab'],
  bestTimes: {
    tr: ['08:00', '13:00', '20:30'],
    en: ['09:00', '18:00'],
    de: ['07:30', '19:00'],
    ru: ['10:00', '20:00'],
  },
  maxPerDay: 2,
  minGapMs: 3000,
  maxReplyChars: 500,
  tone: 'İlk 125 karakter kanca; kaydırılası karusel; Reel’de ilk 1 saniye. Emoji seyrek, güvenlik uyarısında hiç.',
  rules: [
    'Bağlantı açıklamada tıklanmaz → bio bağlantısını gönderiyle eşle (zirtan.app/ig, UTM’li).',
    'Hashtag 8–12: 3 çekirdek + 4 niş + 3 yerel; #keşfet/#fyp kullanma.',
    'Karusel ilk kare manzara, son kare CTA; her karede tek cümle.',
    'Kulüp/rehber ile Collab gönderisi iki kitleye birden düşer — ayda 1 ortak/hesap.',
    'İlk 60 dakikada her yoruma yanıt; UGC paylaşımı yalnızca yazılı izinle ve @atıfla.',
  ],
  manualSteps: [
    'Görseli/videoyu 4:5 (1080×1350) ya da 9:16 (1080×1920) dışa aktar.',
    'Metni açıklamaya yapıştır, ilk satırın kancayı taşıdığını doğrula.',
    'Alt metni (accessibility) gelişmiş ayarlardan gir.',
    'Konum etiketi + varsa Collab hesabını ekle.',
    'Bio bağlantısını bu gönderiye güncelle; gönderiyi en iyi saatte yayınla.',
  ],
  envKeys: ['META_ACCESS_TOKEN', 'IG_USER_ID'],
  canPublish: true,
  metrics: {
    fields: ['reach', 'impressions', 'saved', 'shares', 'comments', 'profile_visits'],
    manualExport: 'Instagram → Profesyonel panel → İçerik → dışa aktar (CSV) ya da Meta Business Suite → Insights → Export.',
  },
  replyNote: 'Yanıtı yorumda ver, DM’e ancak kişi isterse geç.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    const token = env.META_ACCESS_TOKEN;
    const user = env.IG_USER_ID;
    const media = item.media?.[0];
    const create = {
      method: 'POST',
      url: `${GRAPH}/${user}/media`,
      note: 'medya konteyneri oluştur',
      formBody: {
        access_token: token,
        caption: formatted.text,
        ...(media?.type === 'video' ? { media_type: 'REELS', video_url: media.url } : { image_url: media?.url ?? '' }),
      },
    };
    const publish = {
      method: 'POST',
      url: `${GRAPH}/${user}/media_publish`,
      note: 'konteyneri yayınla (creation_id önceki yanıttan)',
      formBody: { access_token: token, creation_id: '{{creation_id}}' },
    };
    return [create, publish];
  },
  metricsRequest(range, env) {
    return {
      method: 'GET',
      url: `${GRAPH}/${env.IG_USER_ID}/insights?metric=reach,impressions,profile_views&period=day&since=${range.since ?? ''}&until=${range.until ?? ''}&access_token=${env.META_ACCESS_TOKEN}`,
      note: 'hesap içgörüleri',
    };
  },
});
