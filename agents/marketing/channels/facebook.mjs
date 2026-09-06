/** Facebook sayfa + gruplar. Türkiye kamp/doğa kitlesinin büyük kısmı hâlâ gruplarda. */
import { defineChannel } from './base.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';

export const spec = {
  id: 'facebook',
  label: 'Facebook (sayfa + gruplar)',
  maxChars: 63_206,
  recommendedChars: 1200,
  maxHashtags: 3,
  foldAt: 80,
  linkPolicy: 'inline',
  formats: ['single_image', 'carousel', 'text', 'poll', 'reel'],
  bestTimes: { tr: ['09:00', '13:00', '21:00'], en: ['10:00', '19:00'], de: ['08:00', '18:30'], ru: ['11:00', '20:00'] },
  maxPerDay: 2,
  minGapMs: 3000,
  maxReplyChars: 700,
  tone: 'Uzun metin sorun değil; hikâye + rakam + fotoğraf albümü. Grup gönderisinde reklam dili yok, deneyim var.',
  rules: [
    'Grup kurallarını oku: çoğunda link yasak. İlk iki hafta yalnızca yorum yaz, sonra trip report.',
    'En iyi biçim fotoğraf albümü (3–6 kare) ve anket; ilk 80 karakter "daha fazla"dan önce.',
    'Bağlantı metnin sonunda, UTM ile (utm_source=facebook / fb_group).',
    'Grup yöneticisine kulüp/etkinlik profili öner — moderatör rozeti karşılığı.',
    'Aynı metni birden çok gruba aynı anda yapıştırma; her gruba o grubun sorusuna göre yaz.',
  ],
  manualSteps: [
    'Sayfada: Yayınla → fotoğraf albümü seç, ilk kare manzara.',
    'Metni yapıştır, bağlantıyı en sona koy (önizleme kartı çıkarsa bırak).',
    'Grup gönderisinde bağlantıyı çıkar, "isteyene DM" yaz.',
    'Anket gönderilerinde iki seçenek + "başka" seçeneği bırak.',
  ],
  envKeys: ['META_ACCESS_TOKEN', 'FB_PAGE_ID'],
  canPublish: true,
  metrics: {
    fields: ['reach', 'impressions', 'reactions', 'comments', 'shares', 'link_clicks'],
    manualExport: 'Meta Business Suite → Insights → Export → CSV (sayfa); gruplarda elle sayım.',
  },
  replyNote: 'Grup gönderilerinde yanıtı yorumda ver; DM’de satış yapma.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    const media = item.media?.[0];
    const base = { access_token: env.META_ACCESS_TOKEN, message: formatted.text };
    return media?.url
      ? [{ method: 'POST', url: `${GRAPH}/${env.FB_PAGE_ID}/photos`, note: 'fotoğraflı sayfa gönderisi', formBody: { ...base, url: media.url, caption: formatted.text } }]
      : [{ method: 'POST', url: `${GRAPH}/${env.FB_PAGE_ID}/feed`, note: 'metin gönderisi', formBody: base }];
  },
  metricsRequest(range, env) {
    return {
      method: 'GET',
      url: `${GRAPH}/${env.FB_PAGE_ID}/insights?metric=page_impressions,page_post_engagements&period=day&access_token=${env.META_ACCESS_TOKEN}`,
      note: 'sayfa içgörüleri',
    };
  },
});
