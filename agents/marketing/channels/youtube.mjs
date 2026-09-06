/** YouTube — Shorts (dikey) + uzun rehber videoları (arama trafiği). */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'youtube',
  label: 'YouTube (Shorts + uzun)',
  maxChars: 5000,
  recommendedChars: 900,
  maxHashtags: 3,
  foldAt: 100,
  linkPolicy: 'inline',
  formats: ['short', 'long_video', 'live'],
  bestTimes: { tr: ['18:00', '20:00'], en: ['16:00', '19:00'], de: ['17:00'], ru: ['18:00'] },
  maxPerDay: 1,
  minGapMs: 8000,
  maxReplyChars: 600,
  tone: 'Başlıkta arama kelimesi başta; açıklama iki satır özet + zaman damgaları. Shorts’ta kanca ilk 2 saniye.',
  rules: [
    'Başlık ≤ 60 karakter, anahtar kelime başta ("Kaçkar trekking rehberi 2026: rota, ulaşım, maliyet").',
    'Shorts: dikey 9:16, ≤ 60 sn, başlıkta #Shorts; uzun videoya "bölüm" olarak bağla.',
    'Açıklama: 2 satır özet + UTM bağlantı + zaman damgaları + 3 hashtag.',
    'Her uzun videodan 3 Short + 1 blog yazısı + 1 Reddit trip report çıkar.',
    'Sabitlenmiş yorumda bağlantı ve "hangi rotayı anlatalım?" sorusu.',
  ],
  manualSteps: [
    'Studio → Yükle: dosya, başlık (≤60), açıklama, etiketler.',
    'Küçük resim: 1280×720, en fazla 4 kelime, yüz ya da zirve.',
    'Bölüm zaman damgalarını açıklamaya ekle (00:00 Giriş …).',
    'Shorts için ayrı yükleme; başlığa #Shorts.',
    'Yayın sonrası sabitlenmiş yorum + son ekran kartı.',
  ],
  envKeys: ['YOUTUBE_ACCESS_TOKEN'],
  canPublish: false,
  metrics: {
    fields: ['views', 'watch_time_min', 'avg_view_duration', 'ctr', 'subscribers_delta', 'link_clicks'],
    manualExport: 'YouTube Studio → Analytics → Advanced mode → Export (CSV).',
  },
  replyNote: 'Yorumlara ilk 24 saatte yanıt ver; teknik soruya zaman damgası ile dön.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        note: 'sürdürülebilir yükleme oturumu (dosya ayrı PUT ile gider)',
        headers: { authorization: `Bearer ${env.YOUTUBE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
        jsonBody: {
          snippet: { title: item.title.slice(0, 100), description: formatted.text, categoryId: '19' },
          status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
        },
      },
    ];
  },
});
