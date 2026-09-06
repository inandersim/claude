import type { AiMessage, AiThread } from '@/domain';

import { CURRENT_USER_ID } from './seed';

/** Demo sohbetleri — çevrimdışı asistanın ürettiği biçimde düz metin + bağlantılar. */
export const seedAiThreads: AiThread[] = [
  {
    id: 'ait_kackar',
    userId: CURRENT_USER_ID,
    title: 'Kaçkar için 3 günlük yürüyüş planla',
    createdAt: '2026-08-28T18:05:00.000Z',
    updatedAt: '2026-08-28T18:06:10.000Z',
  },
  {
    id: 'ait_kas',
    userId: CURRENT_USER_ID,
    title: 'Kaş’ta dalış noktası öner',
    createdAt: '2026-08-21T09:40:00.000Z',
    updatedAt: '2026-08-21T09:41:30.000Z',
  },
];

export const seedAiMessages: AiMessage[] = [
  {
    id: 'aim_kackar_1',
    threadId: 'ait_kackar',
    role: 'user',
    content: 'Kaçkar için 3 günlük yürüyüş planla, orta seviye.',
    intent: 'plan_trip',
    actions: [],
    createdAt: '2026-08-28T18:05:00.000Z',
  },
  {
    id: 'aim_kackar_2',
    threadId: 'ait_kackar',
    role: 'assistant',
    content: [
      'Kaçkar Zirtan Rotası — 3 günlük yürüyüş planı',
      '',
      'Gün 1: Kaçkar Zirtan Rotası — yaklaşım ve kamp — 11 km / +600 m',
      'Gün 2: Dilberdüzü Kamp Yeri — ana etap — 15 km / +830 m',
      'Gün 3: Kaçkar Dağı — zirve denemesi ve dönüş — 13 km / +680 m',
      '',
      'Paketleme listesi ve güvenlik notları için "Gezi planla" kartını aç.',
    ].join('\n'),
    intent: 'plan_trip',
    actions: [
      { label: 'Kaçkar Zirtan Rotası', href: '/library/cur:hike:kackar', icon: 'map-pin' },
      { label: 'Rota planlayıcı', href: '/maps/planner', icon: 'route' },
      { label: 'Tehlike bölgeleri', href: '/hazards', icon: 'triangle-alert' },
    ],
    createdAt: '2026-08-28T18:05:04.000Z',
  },
  {
    id: 'aim_kackar_3',
    threadId: 'ait_kackar',
    role: 'user',
    content: 'Çantama ne koymalıyım?',
    intent: 'packing_list',
    actions: [],
    createdAt: '2026-08-28T18:06:05.000Z',
  },
  {
    id: 'aim_kackar_4',
    threadId: 'ait_kackar',
    role: 'assistant',
    content: [
      'Kaçkar Zirtan Rotası — 3 günlük yürüyüş planı için paketleme listesi:',
      '',
      '• Su (en az 2 L) ve filtre/tablet',
      '• Yüksek enerjili atıştırmalık',
      '• Kat kat giyim (baz + ara + kabuk)',
      '• Kafa lambası + yedek pil',
      '• İlk yardım kiti',
      '• Telefon + powerbank, çevrimdışı harita',
      '• Bilek destekli bot',
      '• Baton',
      '• Yağmurluk',
      '• Çadır / tarp',
      '• Uyku tulumu (mevsime uygun) + mat',
      '• Ocak, gaz, çakmak',
      '• 3 günlük yemek',
      '• Kalın eldiven + bere',
    ].join('\n'),
    intent: 'packing_list',
    actions: [
      { label: 'Kaçkar Zirtan Rotası', href: '/library/cur:hike:kackar', icon: 'map-pin' },
      { label: 'Pazar yeri', href: '/market', icon: 'shopping-bag' },
    ],
    createdAt: '2026-08-28T18:06:10.000Z',
  },
  {
    id: 'aim_kas_1',
    threadId: 'ait_kas',
    role: 'user',
    content: 'Kaş’ta dalış noktası öner',
    intent: 'find_place',
    actions: [],
    createdAt: '2026-08-21T09:40:00.000Z',
  },
  {
    id: 'aim_kas_2',
    threadId: 'ait_kas',
    role: 'assistant',
    content: [
      'dalış için kütüphaneden önerilerim:',
      '',
      '1. Kaş — Kanyon (dalış noktası · 2,1 km)',
      '   Türkiye’nin en iyi dalış noktalarından; duvar ve kanyon dalışı, 18–32 m.',
      '2. Kaş Dalış Merkezleri (Liman) (dalış merkezi · 0,8 km · 3 m)',
      '',
      'Dalış öncesi Sahil Güvenlik uyarılarını ve akıntı durumunu kontrol et.',
    ].join('\n'),
    intent: 'find_place',
    actions: [
      { label: 'Kaş — Kanyon', href: '/library/cur:dive:kas', icon: 'map-pin' },
      { label: 'Kaş Dalış Merkezleri', href: '/library/cur:divecentre:kas', icon: 'map-pin' },
      { label: 'Kütüphanede ara', href: '/library', icon: 'search' },
    ],
    createdAt: '2026-08-21T09:41:30.000Z',
  },
];
