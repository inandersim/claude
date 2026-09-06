/** X (Twitter) — kısa, zincirli ve haber odaklı. Ücretsiz API katmanı yayına izin verir (aylık kota düşük). */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'x',
  label: 'X (Twitter)',
  maxChars: 280,
  recommendedChars: 240,
  maxHashtags: 2,
  foldAt: 140,
  linkPolicy: 'inline',
  /** 280 karakterde CTA ayrı cümle olarak yer kaplar; kanca + bağlantı yeter. */
  ctaInBody: false,
  /** X bağlantıları t.co ile 23 karakter sayılır — uzunluk hesabı buna göre. */
  linkCountsAs: 23,
  formats: ['text', 'thread', 'single_image', 'short', 'poll'],
  bestTimes: { tr: ['08:30', '12:30', '21:30'], en: ['13:00', '17:00'], de: ['08:00', '18:00'], ru: ['10:00', '19:00'] },
  maxPerDay: 4,
  minGapMs: 5000,
  maxReplyChars: 280,
  tone: 'Tek fikir, tek cümle. Zincir (thread) ile derinleş; ilk tweet kancayı taşır, sonuncusu bağlantıyı.',
  rules: [
    '280 karakter sert sınır — bağlantı 23 karakter sayılır, hashtag en fazla 2.',
    'Zincir: 1) kanca 2–5) veri/adımlar 6) bağlantı + davet. Bağlantıyı ilk tweete koyma (erişim düşer).',
    'Görselli tweet 2 kat etkileşim alır; alt metin (alt text) her görselde.',
    'Outdoor/harita/açık veri hesaplarının tweetlerine değer katan yanıt yaz — link yok.',
    'Ücretsiz API katmanı ayda ~1.500 gönderi ve okuma kotasız; metrik için elle dışa aktar.',
  ],
  manualSteps: [
    'Zincirin her halkasını ayrı kutuya yaz; ilk kutuda bağlantı olmasın.',
    'Görsele alt metin ekle (Alt düğmesi).',
    'Yayın sonrası ilk tweeti sabitle (lansman haftası).',
    'Bağlantıyı son tweete ve profil bio’suna koy (utm_source=x).',
  ],
  envKeys: ['X_BEARER_TOKEN'],
  canPublish: true,
  metrics: {
    fields: ['impressions', 'engagements', 'link_clicks', 'reposts', 'replies', 'profile_visits'],
    manualExport: 'X → Analytics → Export data (CSV). Ücretsiz API katmanında metrik uç noktası kapalı.',
  },
  replyNote: 'Kısa yanıt ver; iki cümleyi geçme, tartışmaya girme.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    const chunks = splitThread(formatted.text);
    return chunks.map((text, i) => ({
      method: 'POST',
      url: 'https://api.twitter.com/2/tweets',
      note: i === 0 ? 'zincirin ilk tweeti' : `zincir ${i + 1}/${chunks.length} (reply.in_reply_to_tweet_id önceki yanıttan)`,
      headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}`, 'content-type': 'application/json' },
      jsonBody: i === 0 ? { text } : { text, reply: { in_reply_to_tweet_id: '{{previous_id}}' } },
    }));
  },
});

/** Metni 280 karakterlik zincire böler; cümle sınırını korur ve "n/N" ekler. */
export function splitThread(text, limit = 268) {
  const words = String(text).split(/\s+/u);
  const parts = [];
  let current = '';
  for (const w of words) {
    if ((`${current} ${w}`).trim().length > limit) {
      parts.push(current.trim());
      current = w;
    } else current = `${current} ${w}`.trim();
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length > 1 ? parts.map((p, i) => `${p} ${i + 1}/${parts.length}`) : parts;
}
