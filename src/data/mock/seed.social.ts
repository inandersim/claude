import type {
  AdventureType,
  Collection,
  DifficultyGrade,
  GeoPoint,
  Post,
  Reaction,
  ReactionType,
  SavedPost,
} from '@/domain';

/**
 * Sosyal paylaşım demo verisi: durum/fotoğraf gönderileri, tepkiler,
 * kayıtlar ve koleksiyonlar. Tarihler "şimdi"ye göreli üretilir.
 */

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

const ME = 'u_me';

/* ------------------------------------------------------------------ */
/* Tepkiler (40)                                                        */
/* ------------------------------------------------------------------ */

const reaction = (
  postId: string,
  userId: string,
  type: ReactionType,
  createdAt: string,
): Reaction => ({ postId, userId, type, createdAt });

export const seedReactions: Reaction[] = [
  // s1 — Elif, Kaçkar kamp ateşi (7)
  reaction('s1', 'u_can', 'fire', hoursAgo(1)),
  reaction('s1', 'u_zeynep', 'love', hoursAgo(1)),
  reaction('s1', 'u_mert', 'like', minutesAgo(50)),
  reaction('s1', 'u_selin', 'wow', minutesAgo(40)),
  reaction('s1', 'u_ayse', 'fire', minutesAgo(30)),
  reaction('s1', 'u_kerem', 'like', minutesAgo(20)),
  reaction('s1', ME, 'fire', minutesAgo(10)),
  // s2 — Zeynep, Kaş dalış karesi (6)
  reaction('s2', 'u_elif', 'wow', hoursAgo(3)),
  reaction('s2', 'u_can', 'love', hoursAgo(3)),
  reaction('s2', 'u_baris', 'wow', hoursAgo(2)),
  reaction('s2', 'u_lale', 'like', hoursAgo(2)),
  reaction('s2', 'u_nil', 'love', hoursAgo(2)),
  reaction('s2', ME, 'wow', hoursAgo(1)),
  // s3 — Can, projenin son hamlesi (5)
  reaction('s3', 'u_elif', 'strong', hoursAgo(6)),
  reaction('s3', 'u_mert', 'strong', hoursAgo(6)),
  reaction('s3', 'u_emre', 'fire', hoursAgo(5)),
  reaction('s3', 'u_kerem', 'strong', hoursAgo(5)),
  reaction('s3', ME, 'strong', hoursAgo(4)),
  // s4 — Selin, gravel molası (4)
  reaction('s4', 'u_elif', 'like', hoursAgo(10)),
  reaction('s4', 'u_lale', 'love', hoursAgo(9)),
  reaction('s4', 'u_nil', 'like', hoursAgo(9)),
  reaction('s4', 'u_ayse', 'wow', hoursAgo(8)),
  // s5 — Deniz (ben), ekipman hazırlığı (4)
  reaction('s5', 'u_elif', 'like', hoursAgo(20)),
  reaction('s5', 'u_mert', 'fire', hoursAgo(19)),
  reaction('s5', 'u_ayse', 'love', hoursAgo(18)),
  reaction('s5', 'u_kerem', 'like', hoursAgo(15)),
  // s6 — Barış, Babadağ gün batımı (5)
  reaction('s6', 'u_zeynep', 'wow', daysAgo(1)),
  reaction('s6', 'u_selin', 'love', daysAgo(1)),
  reaction('s6', 'u_emre', 'wow', daysAgo(1)),
  reaction('s6', 'u_lale', 'wow', hoursAgo(30)),
  reaction('s6', ME, 'love', hoursAgo(28)),
  // s7 — Mert, kar raporu (3)
  reaction('s7', 'u_can', 'like', daysAgo(2)),
  reaction('s7', 'u_kerem', 'strong', daysAgo(2)),
  reaction('s7', 'u_nil', 'like', daysAgo(2)),
  // s8 — Ayşe, kamp fikirleri (2)
  reaction('s8', 'u_selin', 'love', daysAgo(3)),
  reaction('s8', ME, 'like', daysAgo(3)),
  // s10 — Lale, sabah koşusu (2)
  reaction('s10', 'u_elif', 'like', daysAgo(5)),
  reaction('s10', 'u_zeynep', 'strong', daysAgo(5)),
  // s13 — Kerem'in reposts'u (1)
  reaction('s13', 'u_elif', 'like', hoursAgo(2)),
  // p1 — eski macera gönderisine de tepki türü (1)
  reaction('p1', 'u_zeynep', 'wow', hoursAgo(1)),
];

const reactionsFor = (postId: string) => seedReactions.filter((r) => r.postId === postId).length;

/* ------------------------------------------------------------------ */
/* Kayıtlar & koleksiyonlar                                             */
/* ------------------------------------------------------------------ */

export const seedSavedPosts: SavedPost[] = [
  { userId: ME, postId: 's1', collectionId: 'col_me_kamp', createdAt: minutesAgo(15) },
  { userId: ME, postId: 's8', collectionId: 'col_me_kamp', createdAt: daysAgo(3) },
  { userId: ME, postId: 's6', collectionId: 'col_me_go', createdAt: hoursAgo(27) },
  { userId: ME, postId: 'p1', collectionId: 'col_me_go', createdAt: hoursAgo(1) },
  { userId: ME, postId: 's2', collectionId: null, createdAt: hoursAgo(1) },
  { userId: 'u_elif', postId: 's3', collectionId: null, createdAt: hoursAgo(5) },
];

const savedCount = (collectionId: string) =>
  seedSavedPosts.filter((s) => s.collectionId === collectionId).length;
const savesOf = (postId: string) => seedSavedPosts.filter((s) => s.postId === postId).length;

export const seedCollections: Collection[] = [
  {
    id: 'col_me_go',
    userId: ME,
    name: 'Gitmek istediklerim',
    coverUrl: unsplash('1470071459604-3b5ec3a7fe05', 600),
    count: savedCount('col_me_go'),
    createdAt: daysAgo(20),
  },
  {
    id: 'col_me_kamp',
    userId: ME,
    name: 'Kamp fikirleri',
    coverUrl: unsplash('1504280390367-361c6d9f38f4', 600),
    count: savedCount('col_me_kamp'),
    createdAt: daysAgo(12),
  },
];

/* ------------------------------------------------------------------ */
/* Durum / fotoğraf gönderileri                                          */
/* ------------------------------------------------------------------ */

interface StatusSeed {
  id: string;
  authorId: string;
  caption: string;
  images?: string[];
  hashtags: string[];
  mentions?: string[];
  adventureType: AdventureType;
  locationName: string;
  coords: GeoPoint;
  createdAt: string;
  repostOfId?: string;
  commentsCount?: number;
  difficulty?: DifficultyGrade;
}

const repostCount = (postId: string) => statusSeeds.filter((s) => s.repostOfId === postId).length;

const statusSeeds: StatusSeed[] = [
  {
    id: 's1',
    authorId: 'u_elif',
    caption:
      'Kaçkar eteklerinde kamp ateşi, yıldızlar ve çay. Yarın sabah zirve denemesi — @deniz.kaya bu kareyi sana borçluyum, rotayı sen önerdin 🙏 #kaçkar #kampateşi #yıldızlar',
    images: [
      unsplash('1504280390367-361c6d9f38f4'),
      unsplash('1478131143081-80f7f84ca84d'),
      unsplash('1470071459604-3b5ec3a7fe05'),
    ],
    hashtags: ['kaçkar', 'kampateşi', 'yıldızlar'],
    mentions: [ME],
    adventureType: 'hiking',
    locationName: 'Yukarı Kavron, Rize',
    coords: { latitude: 40.86, longitude: 41.12 },
    createdAt: hoursAgo(1),
    commentsCount: 2,
  },
  {
    id: 's2',
    authorId: 'u_zeynep',
    caption:
      'Sabah dalışında 24 metrede bir kaplumbağa ile göz göze geldik. Görüş 30 m, su 24°C. Sezon açıldı! #dalış #kaş #sualtı',
    images: [unsplash('1544551763-46a013bb70d5'), unsplash('1582967788606-a171c1080cb0')],
    hashtags: ['dalış', 'kaş', 'sualtı'],
    adventureType: 'diving',
    locationName: 'Kaş, Antalya',
    coords: { latitude: 36.2019, longitude: 29.6414 },
    createdAt: hoursAgo(3),
    commentsCount: 1,
  },
  {
    id: 's3',
    authorId: 'u_can',
    caption:
      'Projemin son hamlesi: crux’ta sol el tutamağı nihayet oturdu. Bu hafta sonu red-point denemesi. Nefes al, güven, git. #tırmanış #geyikbayırı #projem',
    images: [unsplash('1522163182402-834f871fd851')],
    hashtags: ['tırmanış', 'geyikbayırı', 'projem'],
    adventureType: 'climbing',
    locationName: 'Geyikbayırı, Antalya',
    coords: { latitude: 36.94, longitude: 30.52 },
    createdAt: hoursAgo(7),
    difficulty: 'hard',
  },
  {
    id: 's4',
    authorId: 'u_selin',
    caption:
      'Kapadokya etabında 92. km’de köy kahvesi molası. Gravel için toprak yollar kupkuru, harika tutuyor. #gravel #kapadokya #bisiklet',
    images: [unsplash('1472214103451-9374bd1c798e'), unsplash('1433086966358-54859d0ed716')],
    hashtags: ['gravel', 'kapadokya', 'bisiklet'],
    adventureType: 'cycling',
    locationName: 'Ürgüp, Nevşehir',
    coords: { latitude: 38.63, longitude: 34.91 },
    createdAt: hoursAgo(11),
  },
  {
    id: 's5',
    authorId: ME,
    caption:
      'Hafta sonu Kaçkar için çanta hazır: krampon, kazma, -10 tulum. @elif.dogan yarın 04:30 buluşma tamam mı? #kaçkar #ekipman #hazırlık',
    hashtags: ['kaçkar', 'ekipman', 'hazırlık'],
    mentions: ['u_elif'],
    adventureType: 'climbing',
    locationName: 'Kadıköy, İstanbul',
    coords: { latitude: 40.9903, longitude: 29.0293 },
    createdAt: hoursAgo(22),
    commentsCount: 1,
  },
  {
    id: 's6',
    authorId: 'u_baris',
    caption:
      'Babadağ 1700’den gün batımı uçuşu. Termikler akşama kadar taşıdı, 48 dakika havada. #yamaçparaşütü #babadağ #ölüdeniz #günbatımı',
    images: [
      unsplash('1470071459604-3b5ec3a7fe05'),
      unsplash('1469474968028-56623f02e42e'),
      unsplash('1483728642387-6c3bdd6c93e5'),
      unsplash('1454496522488-7a8e488e8606'),
    ],
    hashtags: ['yamaçparaşütü', 'babadağ', 'ölüdeniz', 'günbatımı'],
    adventureType: 'paragliding',
    locationName: 'Babadağ, Fethiye',
    coords: { latitude: 36.55, longitude: 29.18 },
    createdAt: daysAgo(1),
    commentsCount: 3,
  },
  {
    id: 's7',
    authorId: 'u_mert',
    caption:
      'Erciyes kar raporu: gece 35 cm taze kar, sabah rüzgar 20 km/s. Kuzey yamaçlarda çığ riski orta — tek başına girmeyin. #erciyes #kar #freeride #çığ',
    images: [unsplash('1519681393784-d120267933ba')],
    hashtags: ['erciyes', 'kar', 'freeride', 'çığ'],
    adventureType: 'skiing',
    locationName: 'Erciyes, Kayseri',
    coords: { latitude: 38.53, longitude: 35.45 },
    createdAt: daysAgo(2),
  },
  {
    id: 's8',
    authorId: 'u_ayse',
    caption:
      'Yeni başlayanlar için kamp fikirleri: Ballıkayalar, Polonezköy, Ağva. Hepsi İstanbul’a 1,5 saat. Hangisiyle başlayalım? #kamp #istanbul #haftasonu',
    images: [unsplash('1504280390367-361c6d9f38f4'), unsplash('1441974231531-c6227db76b6e')],
    hashtags: ['kamp', 'istanbul', 'haftasonu'],
    adventureType: 'hiking',
    locationName: 'Ballıkayalar, Kocaeli',
    coords: { latitude: 40.82, longitude: 29.52 },
    createdAt: daysAgo(3),
    commentsCount: 4,
  },
  {
    id: 's9',
    authorId: 'u_emre',
    caption:
      'Çoruh’ta bu yıl su seviyesi yüksek; 4. derece parkurlar çok canlı. Rafting ekibi arıyorum, @kerem.aydin var mısın? #rafting #çoruh #ekip',
    hashtags: ['rafting', 'çoruh', 'ekip'],
    mentions: ['u_kerem'],
    adventureType: 'rafting',
    locationName: 'Yusufeli, Artvin',
    coords: { latitude: 40.82, longitude: 41.54 },
    createdAt: daysAgo(4),
  },
  {
    id: 's10',
    authorId: 'u_lale',
    caption:
      'Sabah 6:00 Belgrad Ormanı. Sis, ıslak yapraklar, sessizlik. Güne böyle başlamak gibisi yok. #belgradormanı #sabah #doğa',
    images: [unsplash('1441974231531-c6227db76b6e')],
    hashtags: ['belgradormanı', 'sabah', 'doğa'],
    adventureType: 'hiking',
    locationName: 'Belgrad Ormanı, İstanbul',
    coords: { latitude: 41.18, longitude: 28.98 },
    createdAt: daysAgo(5),
  },
  {
    id: 's11',
    authorId: 'u_nil',
    caption:
      'Kano ile Köyceğiz’den Dalyan’a 14 km. Kaplumbağa plajında mola, dönüşte kaya mezarları. #kano #dalyan #köyceğiz',
    images: [unsplash('1454496522488-7a8e488e8606'), unsplash('1483728642387-6c3bdd6c93e5')],
    hashtags: ['kano', 'dalyan', 'köyceğiz'],
    adventureType: 'canoe',
    locationName: 'Dalyan, Muğla',
    coords: { latitude: 36.83, longitude: 28.64 },
    createdAt: daysAgo(6),
  },
  {
    id: 's12',
    authorId: ME,
    caption:
      'Yeni sezon hedefleri: Kaçkar kış çıkışı, Erciyes kuzey yüzü ve ilk 7a. Kim eşlik eder? #hedefler #tırmanış #kaçkar',
    hashtags: ['hedefler', 'tırmanış', 'kaçkar'],
    adventureType: 'climbing',
    locationName: 'Kadıköy, İstanbul',
    coords: { latitude: 40.9903, longitude: 29.0293 },
    createdAt: daysAgo(9),
    commentsCount: 2,
  },
  // Yeniden paylaşımlar
  {
    id: 's13',
    authorId: 'u_kerem',
    caption: 'Bu kare bir şey anlatıyor. Kaçkar ekibine katılıyorum! #kaçkar',
    hashtags: ['kaçkar'],
    adventureType: 'hiking',
    locationName: 'Yukarı Kavron, Rize',
    coords: { latitude: 40.86, longitude: 41.12 },
    createdAt: minutesAgo(35),
    repostOfId: 's1',
  },
  {
    id: 's14',
    authorId: 'u_ayse',
    caption: 'Çığ uyarısını paylaşmadan geçemedim, herkes dikkat. #erciyes #çığ',
    hashtags: ['erciyes', 'çığ'],
    adventureType: 'skiing',
    locationName: 'Erciyes, Kayseri',
    coords: { latitude: 38.53, longitude: 35.45 },
    createdAt: hoursAgo(40),
    repostOfId: 's7',
  },
];

const toPost = (s: StatusSeed): Post => ({
  id: s.id,
  authorId: s.authorId,
  imageUrl: s.images?.[0] ?? null,
  caption: s.caption,
  adventureType: s.adventureType,
  difficulty: s.difficulty ?? 'easy',
  altitudeM: 0,
  distanceKm: 0,
  temperatureC: 18,
  windKmh: 0,
  trailCondition: 'good',
  durationMin: 0,
  locationName: s.locationName,
  coords: s.coords,
  likesCount: reactionsFor(s.id),
  commentsCount: s.commentsCount ?? 0,
  isVerifiedInfo: false,
  routeId: null,
  createdAt: s.createdAt,
  kind: s.images && s.images.length > 0 ? 'photo' : 'status',
  images: s.images ?? [],
  hashtags: s.hashtags,
  mentions: s.mentions ?? [],
  repostOfId: s.repostOfId ?? null,
  savesCount: savesOf(s.id),
  repostsCount: repostCount(s.id),
});

/** Durum/fotoğraf gönderileri; posts tablosuna macera gönderilerinin önüne eklenir. */
export const seedStatusPosts: Post[] = statusSeeds.map(toPost);
