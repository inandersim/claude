import {
  BLENDER_CREDITS,
  type NewsItem,
  type TvChannel,
  type TvProgram,
  type TvSchedule,
  type WatchProgress,
} from '@/domain';

const CURRENT_USER_ID = 'u_me';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const hoursAgo = (h: number) => new Date(NOW - h * HOUR).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();
const hoursFromNow = (h: number) => new Date(NOW + h * HOUR).toISOString();
const minutesFromNow = (m: number) => new Date(NOW + m * 60_000).toISOString();

/** Yerel günde sabit saat (dayOffset: 0 bugün, 1 yarın). */
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const GTV = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
const VIDEO = {
  bunny: `${GTV}/BigBuckBunny.mp4`,
  elephants: `${GTV}/ElephantsDream.mp4`,
  blazes: `${GTV}/ForBiggerBlazes.mp4`,
  sintel: `${GTV}/Sintel.mp4`,
  tears: `${GTV}/TearsOfSteel.mp4`,
};

/* ------------------------------------------------------------------ */
/* Kanallar                                                            */
/* ------------------------------------------------------------------ */

export const seedTvChannels: TvChannel[] = [
  {
    id: 'ch_belgesel',
    name: 'Zirtan Belgesel',
    kind: 'documentary',
    description:
      'Türkiye ve dünyanın dağlarından, denizlerinden, vadilerinden uzun soluklu belgeseller.',
    logoUrl: unsplash('1464822759023-fed622ff2c3b', 300),
    color: '#0D9488',
    followerCount: 18_420,
    ownerId: null,
    isOfficial: true,
  },
  {
    id: 'ch_haber',
    name: 'Zirtan Haber',
    kind: 'news',
    description:
      'Haftalık Outdoor Gündem bülteni, hava ve park uyarıları, kurtarma haberleri ve etkinlik takvimi.',
    logoUrl: unsplash('1470071459604-3b5ec3a7fe05', 300),
    color: '#DC2626',
    followerCount: 12_960,
    ownerId: null,
    isOfficial: true,
  },
  {
    id: 'ch_canli',
    name: 'Canlı',
    kind: 'live',
    description: 'Topluluğun şu an süren canlı yayınları ve öne çıkan yayın tekrarları.',
    logoUrl: unsplash('1501785888041-af3ef285b470', 300),
    color: '#E11D48',
    followerCount: 9_870,
    ownerId: null,
    isOfficial: true,
  },
  {
    id: 'ch_akademi',
    name: 'Zirtan Akademi',
    kind: 'education',
    description:
      'Düğümler, harita okuma, çığ güvenliği, ilk yardım: sahada işe yarayan kısa eğitim videoları.',
    logoUrl: unsplash('1522163182402-834f871fd851', 300),
    color: '#2563EB',
    followerCount: 7_310,
    ownerId: null,
    isOfficial: true,
  },
  {
    id: 'ch_topluluk',
    name: 'Topluluk',
    kind: 'community',
    description: 'Kullanıcıların gönderdiği videolar. Sen de çekimini paylaş.',
    logoUrl: unsplash('1517649763962-0c623066013b', 300),
    color: '#16A34A',
    followerCount: 4_180,
    ownerId: null,
    isOfficial: false,
  },
  {
    id: 'ch_doga',
    name: 'Doğa Bilimi',
    kind: 'documentary',
    description:
      'Ekosistemler, jeoloji ve iklim: doğayı anlamak için bilim insanlarıyla çekilmiş belgeseller.',
    logoUrl: unsplash('1441974231531-c6227db76b6e', 300),
    color: '#7C3AED',
    followerCount: 5_640,
    ownerId: 'u_nil',
    isOfficial: false,
  },
];

/* ------------------------------------------------------------------ */
/* Programlar                                                          */
/* ------------------------------------------------------------------ */

type ProgramSeed = Omit<
  TvProgram,
  | 'languages'
  | 'subtitles'
  | 'creditsNote'
  | 'destinationId'
  | 'countryCode'
  | 'seriesTitle'
  | 'episode'
> &
  Partial<
    Pick<
      TvProgram,
      | 'languages'
      | 'subtitles'
      | 'creditsNote'
      | 'destinationId'
      | 'countryCode'
      | 'seriesTitle'
      | 'episode'
    >
  >;

const program = (p: ProgramSeed): TvProgram => ({
  languages: ['tr'],
  subtitles: ['tr', 'en'],
  creditsNote: BLENDER_CREDITS,
  destinationId: null,
  countryCode: 'TR',
  seriesTitle: null,
  episode: null,
  ...p,
});

export const seedTvPrograms: TvProgram[] = [
  /* --- Belgeseller ------------------------------------------------- */
  program({
    id: 'p_kackar_1',
    channelId: 'ch_belgesel',
    title: 'Kaçkar’ın Dört Mevsimi — Bahar: Yaylalar Uyanıyor',
    kind: 'series',
    description:
      'Kar erirken Ayder ve Pokut yaylalarına çıkan ilk yaylacılarla birlikte Kaçkar’ın baharını izliyoruz. Kardelenler, boran ve ilk sürü.',
    thumbnailUrl: unsplash('1464822759023-fed622ff2c3b'),
    videoUrl: VIDEO.bunny,
    durationMin: 42,
    adventureTypes: ['hiking'],
    destinationId: 'dest_kackar',
    seriesTitle: 'Kaçkar’ın Dört Mevsimi',
    episode: 1,
    publishedAt: daysAgo(21),
    viewsCount: 48_200,
    likesCount: 3_120,
    kidsFriendly: true,
  }),
  program({
    id: 'p_kackar_2',
    channelId: 'ch_belgesel',
    title: 'Kaçkar’ın Dört Mevsimi — Yaz: Buzul Gölleri',
    kind: 'series',
    description:
      'Deniz Gölü’nden Kavron’a, 3.937 m zirveye uzanan yaz rotası. Rehber Kerem ile buzul gölleri ve kaya ceylanları.',
    thumbnailUrl: unsplash('1506905925346-21bda4d32df4'),
    videoUrl: VIDEO.elephants,
    durationMin: 45,
    adventureTypes: ['hiking', 'climbing'],
    destinationId: 'dest_kackar',
    seriesTitle: 'Kaçkar’ın Dört Mevsimi',
    episode: 2,
    publishedAt: daysAgo(14),
    viewsCount: 36_900,
    likesCount: 2_480,
    kidsFriendly: true,
  }),
  program({
    id: 'p_kackar_3',
    channelId: 'ch_belgesel',
    title: 'Kaçkar’ın Dört Mevsimi — Kış: Sessizlik ve Çığ',
    kind: 'series',
    description:
      'Heliski ekipleri, boran altında yaylada kalan son aile ve çığ gözlem istasyonu. Kaçkar kışta bambaşka bir dağ.',
    thumbnailUrl: unsplash('1483728642387-6c3bdd6c93e5'),
    videoUrl: VIDEO.sintel,
    durationMin: 47,
    adventureTypes: ['skiing', 'hiking'],
    destinationId: 'dest_kackar',
    seriesTitle: 'Kaçkar’ın Dört Mevsimi',
    episode: 3,
    publishedAt: daysAgo(7),
    viewsCount: 22_400,
    likesCount: 1_910,
    kidsFriendly: false,
  }),
  program({
    id: 'p_himalaya',
    channelId: 'ch_belgesel',
    title: 'Himalaya’da 14 Gün',
    kind: 'documentary',
    description:
      'Lukla’dan Everest Ana Kampı’na 14 günlük yürüyüş: aklimatizasyon, Şerpa köyleri, Kala Patthar sabahı ve irtifa hastalığıyla mücadele.',
    thumbnailUrl: unsplash('1544551763-46a013bb70d5'),
    videoUrl: VIDEO.tears,
    durationMin: 68,
    adventureTypes: ['hiking'],
    destinationId: 'dest_ebc',
    countryCode: 'NP',
    subtitles: ['tr', 'en', 'de'],
    publishedAt: daysAgo(35),
    viewsCount: 91_300,
    likesCount: 7_850,
    kidsFriendly: true,
  }),
  program({
    id: 'p_kas_sualti',
    channelId: 'ch_belgesel',
    title: 'Kaş Sualtı: Mavi Duvarın Ötesi',
    kind: 'documentary',
    description:
      'Kanyon, Uçak Batığı ve Kaş’ın posidonia çayırları. Dalış rehberi Zeynep ile 30 metrede caretta caretta’lar.',
    thumbnailUrl: unsplash('1469474968028-56623f02e42e'),
    videoUrl: VIDEO.blazes,
    durationMin: 38,
    adventureTypes: ['diving'],
    destinationId: 'dest_kas',
    publishedAt: daysAgo(10),
    viewsCount: 27_600,
    likesCount: 2_130,
    kidsFriendly: true,
  }),
  program({
    id: 'p_cig',
    channelId: 'ch_belgesel',
    title: 'Çığ: Görünmez Tehlike',
    kind: 'documentary',
    description:
      'Tabaka kar, rüzgâr yükü ve insan faktörü. AKUT çığ ekibi, meteorologlar ve bir çığdan sağ kurtulan kayakçının anlatımıyla.',
    thumbnailUrl: unsplash('1519681393784-d120267933ba'),
    videoUrl: VIDEO.sintel,
    durationMin: 52,
    adventureTypes: ['skiing', 'climbing'],
    publishedAt: daysAgo(48),
    viewsCount: 64_100,
    likesCount: 5_240,
    kidsFriendly: false,
  }),
  program({
    id: 'p_likya',
    channelId: 'ch_belgesel',
    title: 'Likya Yolu’nun Antik Kentleri',
    kind: 'documentary',
    description:
      'Patara’dan Olympos’a, Likya Yolu boyunca antik kentler: Xanthos, Sidyma, Phaselis. Arkeologlarla yürüyerek tarih.',
    thumbnailUrl: unsplash('1472214103451-9374bd1c798e'),
    videoUrl: VIDEO.elephants,
    durationMin: 56,
    adventureTypes: ['hiking'],
    destinationId: 'dest_likya',
    subtitles: ['tr', 'en', 'fr'],
    publishedAt: daysAgo(3),
    viewsCount: 15_800,
    likesCount: 1_460,
    kidsFriendly: true,
  }),
  program({
    id: 'p_kelebek',
    channelId: 'ch_doga',
    title: 'Kelebekler Vadisi: Bir Ekosistemin Yılı',
    kind: 'documentary',
    description:
      'Fethiye’nin sarp vadisinde Jersey kaplanı kelebeğinin yılı; biyologlar, şelale ve mikroklima.',
    thumbnailUrl: unsplash('1433086966358-54859d0ed716'),
    videoUrl: VIDEO.bunny,
    durationMin: 34,
    adventureTypes: ['hiking'],
    publishedAt: daysAgo(18),
    viewsCount: 19_700,
    likesCount: 1_720,
    kidsFriendly: true,
  }),
  program({
    id: 'p_kapadokya',
    channelId: 'ch_doga',
    title: 'Kapadokya: Peribacalarının Jeolojisi',
    kind: 'documentary',
    description:
      'Erciyes ve Hasan Dağı’nın küllerinden şekillenen vadiler. Jeologlarla tüf, bazalt ve balonların sabah rüzgârı.',
    thumbnailUrl: unsplash('1454496522488-7a8e488e8606'),
    videoUrl: VIDEO.tears,
    durationMin: 41,
    adventureTypes: ['paragliding', 'hiking'],
    destinationId: 'dest_kapadokya',
    publishedAt: daysAgo(26),
    viewsCount: 31_200,
    likesCount: 2_690,
    kidsFriendly: true,
  }),

  /* --- Haber bültenleri -------------------------------------------- */
  program({
    id: 'p_gundem_36',
    channelId: 'ch_haber',
    title: 'Outdoor Gündem — 36. Hafta',
    kind: 'news',
    description:
      'Bu hafta: Kaçkar’da erken kar uyarısı, Olimpos Milli Parkı yangın kapanışı, Kaş dalış festivali ve yeni çığ transceiver testleri.',
    thumbnailUrl: unsplash('1470071459604-3b5ec3a7fe05'),
    videoUrl: VIDEO.blazes,
    durationMin: 12,
    adventureTypes: ['hiking', 'climbing', 'diving'],
    seriesTitle: 'Outdoor Gündem',
    episode: 36,
    subtitles: ['tr'],
    publishedAt: hoursAgo(20),
    viewsCount: 8_400,
    likesCount: 510,
    kidsFriendly: true,
  }),
  program({
    id: 'p_gundem_35',
    channelId: 'ch_haber',
    title: 'Outdoor Gündem — 35. Hafta',
    kind: 'news',
    description:
      'Ağrı Dağı’nda yeni tırmanış izinleri, Çoruh’ta su seviyesi ve Babadağ’da uçuş yasağı süresi.',
    thumbnailUrl: unsplash('1501785888041-af3ef285b470'),
    videoUrl: VIDEO.bunny,
    durationMin: 11,
    adventureTypes: ['climbing', 'rafting', 'paragliding'],
    seriesTitle: 'Outdoor Gündem',
    episode: 35,
    subtitles: ['tr'],
    publishedAt: daysAgo(8),
    viewsCount: 11_900,
    likesCount: 640,
    kidsFriendly: true,
  }),
  program({
    id: 'p_gundem_34',
    channelId: 'ch_haber',
    title: 'Outdoor Gündem — 34. Hafta',
    kind: 'news',
    description:
      'Aladağlar kurtarma tatbikatı, Likya Yolu işaretleme yenilemesi ve dalış sezonunda medüz uyarısı.',
    thumbnailUrl: unsplash('1522163182402-834f871fd851'),
    videoUrl: VIDEO.elephants,
    durationMin: 13,
    adventureTypes: ['climbing', 'hiking', 'diving'],
    seriesTitle: 'Outdoor Gündem',
    episode: 34,
    subtitles: ['tr'],
    publishedAt: daysAgo(15),
    viewsCount: 10_300,
    likesCount: 590,
    kidsFriendly: true,
  }),

  /* --- Kısalar (drone) --------------------------------------------- */
  program({
    id: 'p_drone_kackar',
    channelId: 'ch_belgesel',
    title: 'Drone: Kaçkar Sırtlarında Gün Doğumu',
    kind: 'short',
    description:
      'Kavron Yaylası’ndan 3.000 metreye tırmanan drone çekimi. Sadece manzara, sadece rüzgâr.',
    thumbnailUrl: unsplash('1506905925346-21bda4d32df4'),
    videoUrl: VIDEO.blazes,
    durationMin: 3,
    adventureTypes: ['hiking'],
    destinationId: 'dest_kackar',
    languages: [],
    subtitles: [],
    publishedAt: daysAgo(2),
    viewsCount: 42_800,
    likesCount: 5_310,
    kidsFriendly: true,
  }),
  program({
    id: 'p_drone_kas',
    channelId: 'ch_belgesel',
    title: 'Drone: Kaş Kıyıları ve Kekova',
    kind: 'short',
    description: 'Turkuaz koylar, batık şehir ve Kaş yarımadası. 4K drone.',
    thumbnailUrl: unsplash('1469474968028-56623f02e42e'),
    videoUrl: VIDEO.bunny,
    durationMin: 4,
    adventureTypes: ['diving', 'canoe'],
    destinationId: 'dest_kas',
    languages: [],
    subtitles: [],
    publishedAt: daysAgo(5),
    viewsCount: 33_100,
    likesCount: 4_020,
    kidsFriendly: true,
  }),
  program({
    id: 'p_drone_olimpos',
    channelId: 'ch_belgesel',
    title: 'Drone: Olimpos’tan Tahtalı Zirvesine',
    kind: 'short',
    description: 'Deniz seviyesinden 2.365 metreye tek plan drone yükselişi.',
    thumbnailUrl: unsplash('1472214103451-9374bd1c798e'),
    videoUrl: VIDEO.tears,
    durationMin: 2,
    adventureTypes: ['hiking', 'paragliding'],
    destinationId: 'dest_likya',
    languages: [],
    subtitles: [],
    publishedAt: daysAgo(12),
    viewsCount: 27_400,
    likesCount: 3_180,
    kidsFriendly: true,
  }),
  program({
    id: 'p_short_coruh',
    channelId: 'ch_belgesel',
    title: 'Çoruh’ta 60 Saniye',
    kind: 'short',
    description: 'Yusufeli parkurunda 4. derece rapid: kask kamerası ve drone birlikte.',
    thumbnailUrl: unsplash('1433086966358-54859d0ed716'),
    videoUrl: VIDEO.sintel,
    durationMin: 1,
    adventureTypes: ['rafting'],
    languages: [],
    subtitles: [],
    publishedAt: daysAgo(1),
    viewsCount: 18_900,
    likesCount: 2_760,
    kidsFriendly: false,
  }),

  /* --- Canlı tekrarları -------------------------------------------- */
  program({
    id: 'p_replay_agri',
    channelId: 'ch_canli',
    title: 'Ağrı Dağı Zirve Gecesi — Yayın Tekrarı',
    kind: 'live_replay',
    description:
      'Kerem’in 4.200 m kampından başlayıp zirvede biten 6 saatlik canlı yayının 55 dakikalık özeti.',
    thumbnailUrl: unsplash('1501785888041-af3ef285b470'),
    videoUrl: VIDEO.elephants,
    durationMin: 55,
    adventureTypes: ['climbing'],
    destinationId: 'dest_agri',
    subtitles: [],
    publishedAt: daysAgo(4),
    viewsCount: 24_600,
    likesCount: 3_940,
    kidsFriendly: false,
  }),
  program({
    id: 'p_replay_kas',
    channelId: 'ch_canli',
    title: 'Kaş Kanyon Dalışı — Yayın Tekrarı',
    kind: 'live_replay',
    description: 'Zeynep’in sualtı canlı yayını: kanyon girişi, 28 m ve kaplumbağa karşılaşması.',
    thumbnailUrl: unsplash('1469474968028-56623f02e42e'),
    videoUrl: VIDEO.blazes,
    durationMin: 32,
    adventureTypes: ['diving'],
    destinationId: 'dest_kas',
    subtitles: [],
    publishedAt: daysAgo(6),
    viewsCount: 13_200,
    likesCount: 1_870,
    kidsFriendly: true,
  }),

  /* --- Eğitim ------------------------------------------------------ */
  program({
    id: 'p_tut_dugum',
    channelId: 'ch_akademi',
    title: 'Temel Düğümler: Sekizli, Kazık, Prusik',
    kind: 'tutorial',
    description:
      'Her outdoor sporcunun bilmesi gereken üç düğüm; adım adım, yavaş çekim ve sık yapılan hatalar.',
    thumbnailUrl: unsplash('1522163182402-834f871fd851'),
    videoUrl: VIDEO.bunny,
    durationMin: 16,
    adventureTypes: ['climbing', 'hiking'],
    subtitles: ['tr', 'en'],
    publishedAt: daysAgo(40),
    viewsCount: 58_700,
    likesCount: 6_120,
    kidsFriendly: true,
  }),
  program({
    id: 'p_tut_harita',
    channelId: 'ch_akademi',
    title: 'Harita Okuma ve Pusula ile Yön Bulma',
    kind: 'tutorial',
    description:
      'Eş yükselti eğrileri, kerteriz alma ve harita-pusula-arazi üçgeni. Çocuklarla birlikte izlenebilir.',
    thumbnailUrl: unsplash('1454496522488-7a8e488e8606'),
    videoUrl: VIDEO.tears,
    durationMin: 22,
    adventureTypes: ['hiking'],
    subtitles: ['tr', 'en'],
    publishedAt: daysAgo(30),
    viewsCount: 41_500,
    likesCount: 4_380,
    kidsFriendly: true,
  }),
  program({
    id: 'p_tut_cig',
    channelId: 'ch_akademi',
    title: 'Çığ Kurtarma: Transceiver Araması',
    kind: 'tutorial',
    description:
      'Sinyal arama, kaba arama, ince arama ve sondalama. 15 dakika kuralı ve ekip koordinasyonu.',
    thumbnailUrl: unsplash('1519681393784-d120267933ba'),
    videoUrl: VIDEO.sintel,
    durationMin: 19,
    adventureTypes: ['skiing', 'climbing'],
    publishedAt: daysAgo(22),
    viewsCount: 17_300,
    likesCount: 1_940,
    kidsFriendly: false,
  }),
  program({
    id: 'p_tut_ilkyardim',
    channelId: 'ch_akademi',
    title: 'Dağda İlk Yardım: Hipotermi ve Burkulma',
    kind: 'tutorial',
    description:
      'Uzak alanda ilk 60 dakika: hipotermi sarmalı, bilek burkulmasında bandaj ve tahliye kararı.',
    thumbnailUrl: unsplash('1483728642387-6c3bdd6c93e5'),
    videoUrl: VIDEO.elephants,
    durationMin: 24,
    adventureTypes: ['hiking', 'climbing', 'skiing'],
    publishedAt: daysAgo(9),
    viewsCount: 12_900,
    likesCount: 1_330,
    kidsFriendly: true,
  }),

  /* --- Topluluk ---------------------------------------------------- */
  program({
    id: 'p_comm_bisiklet',
    channelId: 'ch_topluluk',
    title: 'Fethiye’den Kaş’a Bisikletle: 3 Gün, 210 km',
    kind: 'documentary',
    description:
      'Can’ın gravel bisikletiyle Likya kıyısı: kamp yerleri, tırmanışlar ve Patara sahilinde final.',
    thumbnailUrl: unsplash('1517649763962-0c623066013b'),
    videoUrl: VIDEO.tears,
    durationMin: 28,
    adventureTypes: ['cycling'],
    destinationId: 'dest_likya',
    subtitles: [],
    creditsNote: 'Çekim ve kurgu: Can (Topluluk). Müzik: telifsiz. Lisans: CC BY-NC.',
    publishedAt: daysAgo(3),
    viewsCount: 6_200,
    likesCount: 740,
    kidsFriendly: true,
  }),
  program({
    id: 'p_comm_kano',
    channelId: 'ch_topluluk',
    title: 'Beyşehir Gölü’nde Aile Kano Günü',
    kind: 'short',
    description: 'Lale ve çocukları Beyşehir’de sazlıklar arasında kano. Sakin su, çok kuş.',
    thumbnailUrl: unsplash('1441974231531-c6227db76b6e'),
    videoUrl: VIDEO.bunny,
    durationMin: 6,
    adventureTypes: ['canoe'],
    subtitles: [],
    creditsNote: 'Çekim: Lale (Topluluk). Lisans: CC BY.',
    publishedAt: daysAgo(11),
    viewsCount: 3_900,
    likesCount: 460,
    kidsFriendly: true,
  }),
];

/* ------------------------------------------------------------------ */
/* Yayın akışı (bugün + yarın)                                        */
/* ------------------------------------------------------------------ */

const slot = (
  id: string,
  channelId: string,
  programId: string | null,
  startsAt: string,
  endsAt: string,
  streamId: string | null = null,
  title?: string,
): TvSchedule => ({
  id,
  channelId,
  programId,
  streamId,
  title:
    title ??
    seedTvPrograms.find((p) => p.id === programId)?.title ??
    (streamId ? 'Canlı yayın' : 'Yayın'),
  startsAt,
  endsAt,
});

export const seedTvSchedule: TvSchedule[] = [
  // Bugün
  slot('sch_1', 'ch_haber', 'p_gundem_36', at(0, 8, 0), at(0, 8, 15)),
  slot('sch_2', 'ch_akademi', 'p_tut_harita', at(0, 9, 0), at(0, 9, 25)),
  slot('sch_3', 'ch_belgesel', 'p_kackar_1', minutesFromNow(-15), minutesFromNow(30)),
  slot(
    'sch_4',
    'ch_canli',
    null,
    minutesFromNow(-47),
    hoursFromNow(3),
    's1',
    'Ağrı Dağı 4200 m kampından canlı',
  ),
  slot('sch_5', 'ch_doga', 'p_kelebek', at(0, 15, 0), at(0, 15, 35)),
  slot('sch_6', 'ch_belgesel', 'p_himalaya', at(0, 21, 0), at(0, 22, 10)),
  // Yarın
  slot('sch_7', 'ch_haber', 'p_gundem_36', at(1, 8, 0), at(1, 8, 15)),
  slot('sch_8', 'ch_akademi', 'p_tut_dugum', at(1, 9, 0), at(1, 9, 20)),
  slot('sch_9', 'ch_belgesel', 'p_kackar_2', at(1, 12, 0), at(1, 12, 45)),
  slot('sch_10', 'ch_doga', 'p_kapadokya', at(1, 15, 0), at(1, 15, 45)),
  slot('sch_11', 'ch_canli', 'p_replay_agri', at(1, 18, 0), at(1, 18, 55)),
  slot('sch_12', 'ch_belgesel', 'p_cig', at(1, 21, 0), at(1, 21, 55)),
];

/* ------------------------------------------------------------------ */
/* Haberler                                                            */
/* ------------------------------------------------------------------ */

export const seedNews: NewsItem[] = [
  {
    id: 'n_kackar_kar',
    category: 'weather',
    title: 'Kaçkar’da erken kar: 2.500 m üstü için turuncu uyarı',
    summary: 'MGM, Rize ve Artvin yükseklerinde 48 saat boyunca yoğun kar ve fırtına bekliyor.',
    body: 'Meteoroloji Genel Müdürlüğü, Doğu Karadeniz’in yüksek kesimleri için turuncu kodlu uyarı yayımladı. 2.500 metre üstünde 40 cm’ye varan kar, 90 km/s rüzgâr ve görüş mesafesinde ciddi düşüş bekleniyor. Kaçkar zirve rotaları ve Kavron–Deniz Gölü hattı için tırmanış planlarının ertelenmesi öneriliyor. Yaylalarda kalan gruplar için jandarma bilgilendirme yaptı.',
    region: 'Kaçkar Dağları, Rize',
    countryCode: 'TR',
    coords: { latitude: 40.83, longitude: 41.16 },
    sourceName: 'MGM',
    sourceUrl: 'https://www.mgm.gov.tr',
    severity: 'critical',
    publishedAt: hoursAgo(3),
    expiresAt: hoursFromNow(45),
  },
  {
    id: 'n_olimpos_kapanis',
    category: 'closure',
    title: 'Olimpos-Beydağları Milli Parkı yangın riski nedeniyle 5 gün kapalı',
    summary: 'Tahtalı ve Çıralı arasındaki tüm patikalar geçici olarak kapatıldı.',
    body: 'Milli Parklar Genel Müdürlüğü, aşırı sıcak ve düşük nem nedeniyle Olimpos-Beydağları Milli Parkı’nda tüm yürüyüş parkurlarını ve kamp alanlarını 5 gün süreyle kapattı. Likya Yolu’nun Çıralı–Tekirova etabı bu kapsamda. İhlaller için idari para cezası uygulanacak.',
    region: 'Antalya',
    countryCode: 'TR',
    coords: { latitude: 36.42, longitude: 30.47 },
    sourceName: 'Milli Parklar',
    sourceUrl: 'https://www.tarimorman.gov.tr/DKMP',
    severity: 'critical',
    publishedAt: hoursAgo(9),
    expiresAt: hoursFromNow(4 * 24),
  },
  {
    id: 'n_aladaglar_kurtarma',
    category: 'rescue',
    title: 'AKUT, Aladağlar’da mahsur kalan iki dağcıyı kurtardı',
    summary: 'Demirkazık kuzey yüzünde gece operasyonu; dağcıların sağlık durumu iyi.',
    body: 'AKUT Niğde ekibi, Demirkazık kuzey yüzünde hava bozması nedeniyle ilerleyemeyen iki dağcıya gece 02:40’ta ulaştı. Dağcılar sabah saatlerinde Çukurbağ’a indirildi. AKUT, rota bilgisi ve dönüş saatinin mutlaka yakınlarla paylaşılmasını hatırlattı.',
    region: 'Aladağlar, Niğde',
    countryCode: 'TR',
    coords: { latitude: 37.82, longitude: 35.15 },
    sourceName: 'AKUT',
    sourceUrl: 'https://www.akut.org.tr',
    severity: 'warning',
    publishedAt: hoursAgo(14),
    expiresAt: null,
  },
  {
    id: 'n_babadag_ucus',
    category: 'weather',
    title: 'Babadağ’da uçuş yasağı: 50 km/s üstü rüzgâr',
    summary: 'DHMİ ve Fethiye Kaymakamlığı, yamaç paraşütü uçuşlarını iki gün durdurdu.',
    body: 'Babadağ 1.700 ve 1.900 m pistlerinde rüzgâr hızının 50 km/s’yi aşması nedeniyle tandem ve solo uçuşlar askıya alındı. Karar, rüzgâr ölçümlerine göre güncellenecek.',
    region: 'Babadağ, Fethiye',
    countryCode: 'TR',
    coords: { latitude: 36.54, longitude: 29.19 },
    sourceName: 'DHMİ',
    sourceUrl: 'https://www.dhmi.gov.tr',
    severity: 'warning',
    publishedAt: hoursAgo(6),
    expiresAt: hoursFromNow(40),
  },
  {
    id: 'n_kas_festival',
    category: 'event',
    title: 'Kaş Sualtı Festivali bu hafta sonu başlıyor',
    summary: 'Ücretsiz deneme dalışları, sualtı temizliği ve fotoğraf yarışması.',
    body: 'Türkiye Sualtı Sporları Federasyonu ve Kaş Belediyesi’nin düzenlediği festival cumartesi 09:00’da liman meydanında açılıyor. Program: deneme dalışları, Kanyon temizlik dalışı, gece dalışı atölyesi ve pazar günü sualtı fotoğraf yarışması ödül töreni.',
    region: 'Kaş, Antalya',
    countryCode: 'TR',
    coords: { latitude: 36.2, longitude: 29.64 },
    sourceName: 'TSSF',
    sourceUrl: 'https://www.tssf.gov.tr',
    severity: 'info',
    publishedAt: daysAgo(1),
    expiresAt: hoursFromNow(5 * 24),
  },
  {
    id: 'n_transceiver_test',
    category: 'gear',
    title: 'Yeni çığ transceiver testleri yayınlandı: 3 model öne çıktı',
    summary: 'Bağımsız test grubu 8 modeli menzil, çoklu gömü ve pil ömrüne göre karşılaştırdı.',
    body: 'Türkiye Dağcılık Federasyonu çığ komisyonunun paylaştığı testlerde üç antenli modellerin çoklu gömü senaryolarında belirgin şekilde daha hızlı olduğu görüldü. Rapor; menzil, işaretleme fonksiyonu ve -20 °C pil performansı başlıklarını içeriyor.',
    region: 'Türkiye',
    countryCode: 'TR',
    coords: null,
    sourceName: 'TDF',
    sourceUrl: 'https://tdf.gov.tr',
    severity: 'info',
    publishedAt: daysAgo(2),
    expiresAt: null,
  },
  {
    id: 'n_coruh_su',
    category: 'weather',
    title: 'Çoruh’ta su seviyesi yükseldi: rafting parkurunda 4+ derece',
    summary: 'Baraj salımı ve yağış nedeniyle Yusufeli parkurunda deneyimsiz gruplara uyarı.',
    body: 'DSİ verilerine göre Çoruh debisi 48 saatte iki katına çıktı. Rafting operatörleri sadece deneyimli gruplarla çıkış yapıyor; kano ve şişme kayak için parkur önerilmiyor.',
    region: 'Yusufeli, Artvin',
    countryCode: 'TR',
    coords: { latitude: 40.82, longitude: 41.54 },
    sourceName: 'MGM',
    sourceUrl: 'https://www.mgm.gov.tr',
    severity: 'warning',
    publishedAt: hoursAgo(30),
    expiresAt: hoursFromNow(18),
  },
  {
    id: 'n_likya_isaret',
    category: 'community',
    title: 'Likya Yolu’nda 120 km işaretleme yenilendi',
    summary:
      'Gönüllüler Fethiye–Kalkan arasında kırmızı-beyaz işaretleri ve yön tabelalarını yeniledi.',
    body: 'Kültür Rotaları Derneği gönüllüleri üç haftada Ölüdeniz’den Kalkan’a kadar olan etabı yeniden işaretledi. Zirtan’dan 34 gönüllü katıldı. Eksik gördüğünüz işaretleri uygulamadan bildirebilirsiniz.',
    region: 'Likya Yolu, Muğla',
    countryCode: 'TR',
    coords: { latitude: 36.55, longitude: 29.12 },
    sourceName: 'Kültür Rotaları Derneği',
    sourceUrl: 'https://cultureroutesinturkey.com',
    severity: 'info',
    publishedAt: daysAgo(3),
    expiresAt: null,
  },
  {
    id: 'n_buzul_bilim',
    category: 'science',
    title: 'Ağrı Dağı buzulu 40 yılda %30 küçüldü',
    summary: 'Uydu verileriyle yapılan çalışma, zirve buzulunun hızla geri çekildiğini gösteriyor.',
    body: 'İTÜ ve Iğdır Üniversitesi araştırmacılarının yayımladığı çalışmaya göre Ağrı Dağı zirve buzulu 1984’ten bu yana yaklaşık %30 alan kaybetti. Çalışma, tırmanış rotalarında çatlak ve düşen taş riskinin arttığını belirtiyor.',
    region: 'Ağrı Dağı, Iğdır',
    countryCode: 'TR',
    coords: { latitude: 39.7, longitude: 44.3 },
    sourceName: 'İTÜ',
    sourceUrl: 'https://www.itu.edu.tr',
    severity: 'info',
    publishedAt: daysAgo(4),
    expiresAt: null,
  },
  {
    id: 'n_medyuz',
    category: 'weather',
    title: 'Ege kıyılarında medüz yoğunluğu: dalış ve yüzme için uyarı',
    summary: 'Bodrum–Datça hattında yakıcı medüz gözlemleri arttı.',
    body: 'Sahil Güvenlik ve TSSF, Datça–Bodrum arasında yakıcı medüz (Pelagia noctiluca) yoğunluğunun arttığını duyurdu. Dalış gruplarına tam giysi öneriliyor.',
    region: 'Muğla',
    countryCode: 'TR',
    coords: { latitude: 36.8, longitude: 27.7 },
    sourceName: 'TSSF',
    sourceUrl: 'https://www.tssf.gov.tr',
    severity: 'warning',
    publishedAt: daysAgo(6),
    expiresAt: daysAgo(1),
  },
  {
    id: 'n_uludag_teleferik',
    category: 'closure',
    title: 'Uludağ teleferiği bakım nedeniyle 3 gün kapalıydı',
    summary: 'Bakım tamamlandı; seferler yeniden başladı.',
    body: 'Uludağ teleferiği yıllık bakım çalışması nedeniyle üç gün hizmet vermedi. Bakımın tamamlanmasıyla seferler normal tarifeye döndü.',
    region: 'Uludağ, Bursa',
    countryCode: 'TR',
    coords: { latitude: 40.1, longitude: 29.08 },
    sourceName: 'Bursa Büyükşehir',
    sourceUrl: null,
    severity: 'info',
    publishedAt: daysAgo(9),
    expiresAt: daysAgo(5),
  },
  {
    id: 'n_agri_izin',
    category: 'community',
    title: 'Ağrı Dağı tırmanış izinleri artık uygulama üzerinden',
    summary: 'Valilik, izin başvurularını dijitale taşıdı; 72 saat önceden başvuru gerekiyor.',
    body: 'Iğdır Valiliği, Ağrı Dağı tırmanış izinlerinin e-Devlet üzerinden alınacağını duyurdu. Yabancı dağcılar için rehber zorunluluğu sürüyor. Zirtan’dan izin bağlantısına Ağrı destinasyon sayfasından ulaşabilirsiniz.',
    region: 'Iğdır',
    countryCode: 'TR',
    coords: { latitude: 39.7, longitude: 44.3 },
    sourceName: 'Iğdır Valiliği',
    sourceUrl: 'https://www.igdir.gov.tr',
    severity: 'info',
    publishedAt: daysAgo(7),
    expiresAt: null,
  },
  {
    id: 'n_ebc_helikopter',
    category: 'rescue',
    title: 'Everest Ana Kampı rotasında helikopter tahliyeleri arttı',
    summary: 'Nepal turizm bakanlığı gereksiz tahliyelere karşı sigorta denetimini sıkılaştırdı.',
    body: 'Khumbu bölgesinde bu sezon 140’tan fazla helikopter tahliyesi yapıldı. Yetkililer, irtifa hastalığı belirtilerinin ciddiye alınması gerektiğini ancak sigorta suistimallerinin de denetleneceğini açıkladı.',
    region: 'Khumbu, Nepal',
    countryCode: 'NP',
    coords: { latitude: 27.98, longitude: 86.83 },
    sourceName: 'Nepal Turizm Bakanlığı',
    sourceUrl: 'https://tourism.gov.np',
    severity: 'info',
    publishedAt: daysAgo(5),
    expiresAt: null,
  },
  {
    id: 'n_kelebek_kapanis',
    category: 'closure',
    title: 'Kelebekler Vadisi’ne giriş kaya düşmesi nedeniyle kapatılmıştı',
    summary: 'Şelale patikası 2 hafta kapalı kaldı; yeniden açıldı.',
    body: 'Fethiye Kaymakamlığı, kaya düşmesi sonrası Kelebekler Vadisi şelale patikasını iki hafta süreyle kapatmıştı. Jeolojik inceleme sonrası patika yeni koruma ağlarıyla yeniden açıldı.',
    region: 'Fethiye, Muğla',
    countryCode: 'TR',
    coords: { latitude: 36.5, longitude: 29.13 },
    sourceName: 'Milli Parklar',
    sourceUrl: null,
    severity: 'warning',
    publishedAt: daysAgo(20),
    expiresAt: daysAgo(6),
  },
];

/* ------------------------------------------------------------------ */
/* İzleme ilerlemesi (u_me)                                            */
/* ------------------------------------------------------------------ */

export const seedWatchProgress: WatchProgress[] = [
  {
    userId: CURRENT_USER_ID,
    programId: 'p_kackar_1',
    positionSec: 42 * 60 * 0.4,
    durationSec: 42 * 60,
    updatedAt: hoursAgo(5),
  },
  {
    userId: CURRENT_USER_ID,
    programId: 'p_himalaya',
    positionSec: 68 * 60 * 0.72,
    durationSec: 68 * 60,
    updatedAt: daysAgo(1),
  },
  {
    userId: CURRENT_USER_ID,
    programId: 'p_tut_dugum',
    positionSec: 16 * 60 * 0.98,
    durationSec: 16 * 60,
    updatedAt: daysAgo(3),
  },
];
