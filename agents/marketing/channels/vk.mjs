/** VK — Rusça pazar (Kafkasya, Orta Asya, Türkiye’deki Rusça konuşanlar). */
import { defineChannel } from './base.mjs';

const API = 'https://api.vk.com/method';
const V = '5.199';

export const spec = {
  id: 'vk',
  label: 'VK',
  maxChars: 16_000,
  recommendedChars: 2000,
  maxHashtags: 8,
  foldAt: 350,
  linkPolicy: 'inline',
  formats: ['text', 'carousel', 'single_image', 'short', 'poll'],
  bestTimes: { ru: ['09:00', '13:00', '20:00'], tr: ['10:00', '19:00'], en: ['12:00'], de: ['12:00'] },
  maxPerDay: 3,
  minGapMs: 4000,
  maxReplyChars: 900,
  tone: 'Uzun ve bilgi dolu Rusça gönderi işe yarar: etap etap, ulaşım, fiyat (TL + RUB), sezon, su.',
  rules: [
    'Topluluk (сообщество) gönderisi: kapak + "Ссылка в приложение" düğmesi.',
    '5–8 Rusça hashtag; #ликийскаятропа #турция #поход gibi niş etiketler.',
    'Büyük походы topluluklarına haftada 1 "Предложить новость" — tam trip report, reklam değil.',
    'VK Clips: dikey videonun Rusça altyazılı sürümü.',
    'Fiyatları hem ₺ hem ₽ yaz; ulaşımı Rusya/Kafkasya çıkışlı anlat.',
  ],
  manualSteps: [
    'Topluluk → Запись: metni yapıştır, fotoğrafları yükle (ilk kare manzara).',
    'Uzun gönderide "Статья" (makale) biçimini dene — SEO ve okuma süresi daha iyi.',
    'Bağlantıyı sona koy (utm_source=vk).',
    'Clips için 9:16 videoyu ayrı yükle.',
  ],
  envKeys: ['VK_ACCESS_TOKEN', 'VK_GROUP_ID'],
  canPublish: true,
  metrics: {
    fields: ['reach', 'views', 'likes', 'reposts', 'comments', 'link_clicks'],
    manualExport: 'VK → Статистика → Экспорт (CSV) ya da API `stats.get`.',
  },
  replyNote: 'Rusça yanıt ver; «вы» değil «ты» tonu topluluk sohbetinde daha doğal.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: `${API}/wall.post`,
        note: 'topluluk duvarına gönderi',
        formBody: {
          access_token: env.VK_ACCESS_TOKEN,
          owner_id: `-${String(env.VK_GROUP_ID ?? '').replace(/^-/u, '')}`,
          from_group: '1',
          message: formatted.text,
          v: V,
        },
      },
    ];
  },
  metricsRequest(range, env) {
    return {
      method: 'GET',
      url: `${API}/stats.get?group_id=${env.VK_GROUP_ID}&interval=day&intervals_count=7&access_token=${env.VK_ACCESS_TOKEN}&v=${V}`,
      note: 'topluluk istatistiği',
    };
  },
});
