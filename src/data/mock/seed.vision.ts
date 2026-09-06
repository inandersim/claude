import type { VisionHistoryItem } from '@/domain';

const unsplash = (id: string, w = 640) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Giriş yapan kullanıcının (u_me) örnek görüntü analizi geçmişi — en yeni önce. */
export const seedVisionHistory: (VisionHistoryItem & { userId: string })[] = [
  {
    id: 'vis_seed_1',
    userId: 'u_me',
    situation: 'terrain',
    observations: [
      'Yaklaşık 35–40° kar yamacı; üst kısımda rüzgâr taşıması ile oluşmuş karniş.',
      'Yamacın dibinde taze kar birikintisi ve küçük kayma izleri.',
      'Güneş yamaca doğrudan vuruyor; kar ıslak ve ağır görünüyor.',
    ],
    risk: 'high',
    advice: [
      'Yamacı geçmek zorundaysan tek tek, en kısa hattan ve hızla geç.',
      'Karnişin altından değil, sırtın kaya çıkan kısmından ilerle.',
      'Öğleden sonra ısınma ile ıslak çığ riski artar; erken saatte geç ya da rotayı değiştir.',
      'Grupta çığ vericileri açık, kürek ve sonda çantada erişilebilir olsun.',
    ],
    avoid: ['Yamaç altında mola verme.', 'Karnişin üzerine çıkma; kenar 5–10 m geride çökebilir.'],
    actions: [
      { label: 'Tehlike bölgeleri', href: '/hazards', icon: 'triangle-alert' },
      { label: 'Çığ ilk yardımı', href: '/first-aid/avalanche', icon: 'heart-pulse' },
      { label: 'Rota planlayıcı', href: '/maps/planner', icon: 'route' },
    ],
    source: 'remote',
    confidence: 0.74,
    createdAt: '2026-09-04T09:12:00.000Z',
    thumbnailUri: unsplash('1517824806704-9040b037703b'),
    question: 'Buradan geçebilir miyim?',
  },
  {
    id: 'vis_seed_2',
    userId: 'u_me',
    situation: 'weather',
    observations: [
      'Batıda hızla yükselen kümülonimbus; tepesi örs biçimini almaya başlamış.',
      'Alçak seviyede koyu gri tabaka bulutları; görüş azalıyor.',
    ],
    risk: 'high',
    advice: [
      'Sırt ve zirveden hemen in; 30–60 dakika içinde fırtına bekle.',
      '30/30 kuralını uygula: şimşek–gök gürültüsü arası 30 sn altındaysa sığın.',
      'Metal ekipmanı çantandan uzağa koy, açık alanda çömel.',
    ],
    avoid: ['Tek ağaç altına sığınma.', 'Dere yatağında bekleme; ani taşkın olabilir.'],
    actions: [
      { label: 'Yıldırım çarpması', href: '/first-aid/lightning', icon: 'heart-pulse' },
      { label: 'Tehlike bölgeleri', href: '/hazards', icon: 'triangle-alert' },
    ],
    source: 'remote',
    confidence: 0.81,
    createdAt: '2026-08-23T13:40:00.000Z',
    thumbnailUri: unsplash('1500674425229-f692875b0ab7'),
    question: 'Fırtına yaklaşıyor mu?',
  },
  {
    id: 'vis_seed_3',
    userId: 'u_me',
    situation: 'plant',
    observations: [
      'Beyaz şapkalı, halkalı ve kadehli bir mantar; Amanita cinsine benziyor.',
      'Meşe ve kayın altında, nemli zemin.',
    ],
    risk: 'extreme',
    advice: [
      'Bu mantara dokunma ve kesinlikle yeme; Amanita türleri ölümcül olabilir.',
      'Temas ettiysen ellerini sabunla yıka.',
      'Yanlışlıkla yendiyse belirti beklemeden 112’yi ara; zehir bilgi hattı 114.',
    ],
    avoid: ['Tadına bakma.', 'Çocukların ve köpeklerin yaklaşmasına izin verme.'],
    actions: [{ label: 'Alerjik reaksiyon', href: '/first-aid/anaphylaxis', icon: 'heart-pulse' }],
    source: 'remote',
    confidence: 0.66,
    createdAt: '2026-08-10T16:05:00.000Z',
    thumbnailUri: unsplash('1508802986463-d4a7b9a3d1ad'),
    question: 'Bu mantar yenir mi?',
  },
  {
    id: 'vis_seed_4',
    userId: 'u_me',
    situation: 'water',
    observations: [
      'Görüntü analizi çevrimdışı yapılamadı; yerel kontrol listesi kullanıldı.',
      'Berrak su güvenli su demek değildir; yukarı akışta hayvan ya da yerleşim varsa kirlenmiş varsay.',
    ],
    risk: 'moderate',
    advice: [
      'Kaynat: 1 dakika fokur fokur (3000 m üstünde 3 dakika).',
      'Filtre: 0,2 mikron filtre bakteri ve parazitleri tutar; virüs için tablet ya da UV ekle.',
      'Klor/iyot tableti: bekleme süresine uy (genelde 30 dk; soğuk suda 60 dk).',
    ],
    avoid: ['Durgun, köpüklü ya da yosunlu suyu içme.'],
    actions: [{ label: 'Rota planlayıcı', href: '/maps/planner', icon: 'route' }],
    source: 'local',
    confidence: 0.45,
    createdAt: '2026-07-28T07:50:00.000Z',
    thumbnailUri: unsplash('1502082553048-f009c37129b9'),
    question: 'Bu su içilir mi?',
  },
];
