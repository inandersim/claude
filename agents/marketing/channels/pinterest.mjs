/** Pinterest — arama motoru gibi çalışır; pinler aylarca trafik getirir (SEO’nun görsel hâli). */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'pinterest',
  label: 'Pinterest',
  maxChars: 800,
  recommendedChars: 400,
  maxHashtags: 5,
  foldAt: 100,
  linkPolicy: 'inline',
  formats: ['single_image', 'carousel', 'short'],
  bestTimes: { tr: ['21:00', '22:00'], en: ['20:00', '22:00'], de: ['20:00'], ru: ['21:00'] },
  maxPerDay: 5,
  minGapMs: 3000,
  maxReplyChars: 400,
  tone: 'Arama niyetine yazılır: "Likya Yolu 7 günlük rota planı" gibi. Dikey görsel + okunur başlık şart.',
  rules: [
    'Pin görseli 2:3 (1000×1500); başlık görselin üstünde büyük ve okunur olmalı.',
    'Başlık ≤ 100 karakter, açıklamada anahtar kelime doğal geçsin (Pinterest arama motorudur).',
    'Her pin bir hedefe bağlanır: rehber sayfası (zirtan.app/rehber/…), UTM ile.',
    'Pano (board) mantığı: "Türkiye trekking rotaları", "Nepal trekleri", "Kamp ekipmanı", "Dağda güvenlik".',
    'Aynı içerikten 3–5 farklı görselli pin üret; tekrar yayın Pinterest’te cezalandırılmaz.',
  ],
  manualSteps: [
    'Görseli 1000×1500 dışa aktar, başlığı görselin üst üçte birine yaz.',
    'Pin oluştur → başlık, açıklama, hedef bağlantı (UTM’li).',
    'Doğru panoya ekle; pano açıklamasında da anahtar kelime olsun.',
    'Zengin pin (rich pin) için site meta etiketlerini doğrula.',
  ],
  envKeys: ['PINTEREST_ACCESS_TOKEN', 'PINTEREST_BOARD_ID'],
  canPublish: true,
  metrics: {
    fields: ['impressions', 'saves', 'pin_clicks', 'outbound_clicks'],
    manualExport: 'Pinterest → Analytics → Export data (CSV).',
  },
  replyNote: 'Pinterest’te yorum azdır; gelen soruyu panoya yeni pin olarak çevir.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: 'https://api.pinterest.com/v5/pins',
        note: 'pin oluştur',
        headers: { authorization: `Bearer ${env.PINTEREST_ACCESS_TOKEN}`, 'content-type': 'application/json' },
        jsonBody: {
          board_id: env.PINTEREST_BOARD_ID,
          title: item.title.slice(0, 100),
          description: formatted.text.slice(0, 800),
          link: item.link ?? '',
          media_source: { source_type: 'image_url', url: item.media?.[0]?.url ?? '' },
        },
      },
    ];
  },
});
