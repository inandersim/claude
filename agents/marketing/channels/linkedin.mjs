/** LinkedIn — kurumsal ortaklıklar, basın, yatırımcı ve rehber/işletme tarafı. */
import { defineChannel } from './base.mjs';

export const spec = {
  id: 'linkedin',
  label: 'LinkedIn',
  maxChars: 3000,
  recommendedChars: 1300,
  maxHashtags: 3,
  foldAt: 210,
  linkPolicy: 'inline',
  formats: ['text', 'single_image', 'carousel', 'long_video'],
  bestTimes: { tr: ['08:30', '12:00'], en: ['09:00', '15:00'], de: ['08:00', '12:00'], ru: ['10:00'] },
  maxPerDay: 1,
  minGapMs: 5000,
  maxReplyChars: 700,
  tone: 'Kurucu günlüğü tonu: ne yaptık, ne öğrendik, rakam. Kurumsal klişe yok; abartı yok.',
  rules: [
    'İlk 210 karakter "daha fazla"dan önce görünür — kancayı oraya koy.',
    'Bağlantıyı gövdeye koymak erişimi düşürür; ilk yoruma bağlantı bırak.',
    'Hashtag en fazla 3, sektörel (#outdoor #opendata #startup).',
    'Haftada 1 gönderi yeter; kulüp/işletme/basın hedefli.',
    'Doküman (carousel PDF) biçimi LinkedIn’de en yüksek erişimi alır.',
  ],
  manualSteps: [
    'Şirket sayfasında yayınla; kurucu hesabından da paylaş (erişim iki katına çıkar).',
    'Bağlantıyı ilk yoruma yaz (utm_source=linkedin).',
    'Doküman gönderisi için PDF’i 1080×1350 sayfalarla dışa aktar.',
    'Etkinlik/lansman gönderisini ortak kulüp ve rehber sayfalarını etiketleyerek yay.',
  ],
  envKeys: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_URN'],
  canPublish: true,
  metrics: {
    fields: ['impressions', 'reactions', 'comments', 'reposts', 'link_clicks', 'follower_delta'],
    manualExport: 'LinkedIn sayfa → Analytics → Export (XLSX/CSV).',
  },
  replyNote: 'Profesyonel ama insan; ortaklık talebini DM’e taşı.',
};

export const channel = defineChannel({
  spec,
  buildRequests(item, formatted, env) {
    return [
      {
        method: 'POST',
        url: 'https://api.linkedin.com/v2/ugcPosts',
        note: 'organik sayfa gönderisi',
        headers: {
          authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
          'x-restli-protocol-version': '2.0.0',
          'content-type': 'application/json',
        },
        jsonBody: {
          author: env.LINKEDIN_ORG_URN,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: formatted.text },
              shareMediaCategory: item.media?.[0] ? 'IMAGE' : 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        },
      },
    ];
  },
});
