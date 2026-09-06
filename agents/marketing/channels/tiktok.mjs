/** TikTok — kısa dikey video. Content Posting API onay ister; varsayılan elle yükleme. */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'tiktok',
  label: 'TikTok',
  maxChars: 2200,
  recommendedChars: 150,
  maxHashtags: 5,
  foldAt: 90,
  linkPolicy: 'none',
  formats: ['short', 'live'],
  bestTimes: { tr: ['12:00', '18:00', '22:00'], en: ['15:00', '21:00'], de: ['16:00', '20:00'], ru: ['13:00', '20:00'] },
  maxPerDay: 2,
  minGapMs: 8000,
  maxReplyChars: 150,
  tone: 'Ham, telefonla çekilmiş. İlk 1 saniyede kanca ("Bunu Kaçkar’da yapma"), 15–35 sn, büyük altyazı, sessiz de anlaşılsın.',
  rules: [
    'Açıklama 1–2 cümle + 3–5 niş hashtag (#trekking #kaçkar); #fyp/#keşfet kullanma.',
    '1.000 takipçi altında bağlantı yok → "Zirtan’i ara" de, profil bio’suna koy.',
    'Seri mantığı: "3 gün / 3 bölüm", "Bunu yapma #1..#10" — izleyici sonrakini bekler.',
    'Yorumlara video ile yanıt ver (reply-with-video): en ucuz ikinci içerik.',
    'Aynı videoyu filigransız dışa aktarıp Reels ve Shorts’a yükle.',
  ],
  manualSteps: [
    'CapCut’tan 1080×1920, filigransız dışa aktar (altyazı gömülü).',
    'Yükle → açıklamayı yapıştır → 3–5 hashtag.',
    'Kapak karesi: yüz ya da manzara + 3 kelimelik başlık.',
    'Yayından sonra ilk 30 dakika yorumlara yanıt ver.',
  ],
  envKeys: ['TIKTOK_ACCESS_TOKEN'],
  canPublish: false,
  metrics: {
    fields: ['views', 'watch_full_rate', 'likes', 'shares', 'comments', 'profile_visits'],
    manualExport: 'TikTok → Studio → Analytics → Export (CSV). Content Posting API yalnızca onaylı uygulamalarda.',
  },
  replyNote: 'Yanıtı kısa tut; iyi soruya video ile cevap ver.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: 'https://open.tiktokapis.com/v2/post/publish/video/init/',
        note: 'video yükleme oturumu (uygulama onayı gerekir; onaysız hesapta 403)',
        headers: { authorization: `Bearer ${env.TIKTOK_ACCESS_TOKEN}`, 'content-type': 'application/json' },
        jsonBody: {
          post_info: { title: formatted.text.slice(0, 150), privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'FILE_UPLOAD', video_size: item.media?.[0]?.bytes ?? 0 },
        },
      },
    ];
  },
});
