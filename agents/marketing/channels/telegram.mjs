/** Telegram — kanal + şehir grupları. Bot API ile tam otomatik yayın. */
import { defineChannel } from './base.mjs';

const API = 'https://api.telegram.org';

export const spec = {
  id: 'telegram',
  label: 'Telegram',
  maxChars: 4096,
  recommendedChars: 700,
  maxHashtags: 4,
  foldAt: 200,
  linkPolicy: 'inline',
  formats: ['text', 'single_image', 'carousel', 'poll', 'short'],
  bestTimes: { tr: ['08:00', '12:30', '21:00'], en: ['09:00', '18:00'], de: ['08:00', '18:00'], ru: ['09:00', '20:00'] },
  maxPerDay: 2,
  minGapMs: 2000,
  maxReplyChars: 900,
  tone: 'Kısa haber kartı: yer, km, süre, hava, su, topluluk notu. Grup sohbetinde topluluk yöneticisi sesi.',
  rules: [
    'Fotoğraflı mesajda açıklama 1024 karakter; uzun metni ayrı mesaj olarak gönder.',
    'Düz metin gönder (parse_mode yok) — özel karakter hatası çıkmaz.',
    'Haftalık "hafta sonu nereye?" anketi katılımı 3–5 kat artırır.',
    'Şehir grupları (İstanbul / Ankara / İzmir / Antalya + Rusça Анталия) etkinlik odaklı.',
    'Bağlantıya utm_source=telegram ekle; derin bağlantı zirtan:// ile uygulamaya at.',
  ],
  manualSteps: [
    'Kanal → mesaj kutusu: metni yapıştır (biçimlendirme yok).',
    'Görsel varsa önce görseli, açıklamayı 1024 karakterin altında tut.',
    'Anket ise: ataç → Anket, 2–4 seçenek, anonim açık.',
    'Sabitleme gerekiyorsa mesajı sabitle (haftalık özet).',
  ],
  envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL'],
  canPublish: true,
  metrics: {
    fields: ['views', 'forwards', 'reactions', 'subscribers_delta', 'link_clicks'],
    manualExport: 'Kanal → Статистика / İstatistik (1000+ abone) → dışa aktar; öncesinde mesaj görüntülemesini elle say.',
  },
  replyNote: 'Grupta yanıt ver, bire bir DM’i yalnızca kişi başlatırsa kullan.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    const base = `${API}/bot${env.TELEGRAM_BOT_TOKEN}`;
    const media = item.media?.[0];
    if (media?.url) {
      const method = media.type === 'video' ? 'sendVideo' : 'sendPhoto';
      return [
        {
          method: 'POST',
          url: `${base}/${method}`,
          note: 'medyalı mesaj',
          jsonBody: {
            chat_id: env.TELEGRAM_CHANNEL,
            [media.type === 'video' ? 'video' : 'photo']: media.url,
            caption: formatted.text.slice(0, 1024),
          },
        },
      ];
    }
    return [
      {
        method: 'POST',
        url: `${base}/sendMessage`,
        note: 'metin mesajı',
        jsonBody: { chat_id: env.TELEGRAM_CHANNEL, text: formatted.text, disable_web_page_preview: false },
      },
    ];
  },
});
