/** Reddit — reklam kokan her şey banlanır; para birimi dürüst deneyimdir. */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'reddit',
  label: 'Reddit',
  maxChars: 40_000,
  recommendedChars: 2500,
  maxHashtags: 0,
  foldAt: 300,
  linkPolicy: 'inline',
  formats: ['text', 'single_image'],
  bestTimes: { en: ['14:00', '16:00'], tr: ['15:00', '21:00'], de: ['15:00'], ru: ['16:00'] },
  maxPerDay: 1,
  minGapMs: 10_000,
  maxReplyChars: 1200,
  tone: 'Trip report tonu: rakamlar, maliyet, dürüst dezavantajlar, fotoğraf. Ürünü ancak sorulursa ya da açık şeffaflıkla an.',
  rules: [
    'Hesap 30 gün / 200 karma olmadan gönderi atma; her subreddit’in kuralını oku.',
    'r/hiking ve r/CampingandHiking: kendi ürününü tanıtma yasak / %10 kuralı → yalnızca trip report.',
    'r/SideProject, r/androidapps, r/iosapps: kendi projeni tanıtmak serbest, AMA tonu ve açık yol haritası.',
    'Başlık ≤ 300 karakter, spesifik; başlıkta CTA ve indirme çağrısı yok.',
    'Bağlantı gövdenin sonunda; eleştiriye savunma değil "haklısın, ekledik" ile dön.',
  ],
  manualSteps: [
    'Subreddit kurallarını ve son 25 gönderiyi oku, benzerini tekrarlama.',
    'Başlığı spesifik yaz (rota + gün + ne öğrendin).',
    'Gövdeye etap tablosu, maliyet ve dürüst dezavantaj ekle.',
    'Yayından sonra 24 saat her yoruma yanıt ver.',
    'Ürünü ancak "bunu ben yaptım, geri bildirim istiyorum" şeffaflığıyla an.',
  ],
  envKeys: ['REDDIT_ACCESS_TOKEN', 'REDDIT_SUBREDDIT'],
  canPublish: true,
  metrics: {
    fields: ['views', 'upvotes', 'upvote_ratio', 'comments', 'link_clicks'],
    manualExport: 'Gönderi → Insights (yeni Reddit) → ekran görüntüsü / elle CSV; API `/api/info` ile skor.',
  },
  replyNote: 'Yanıt uzun ve kaynaklı olabilir; pazarlama dili kullanma.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: 'https://oauth.reddit.com/api/submit',
        note: 'metin gönderisi (self post)',
        headers: {
          authorization: `Bearer ${env.REDDIT_ACCESS_TOKEN}`,
          'user-agent': 'zirtan-marketing/1.0 (by u/zirtanapp)',
        },
        formBody: {
          sr: item.subreddit ?? env.REDDIT_SUBREDDIT ?? 'zirtanapp',
          kind: 'self',
          title: item.title.slice(0, 300),
          text: formatted.text,
          api_type: 'json',
        },
      },
    ];
  },
});
