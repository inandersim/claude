import type {
  ChildProfile,
  FamilyChecklistItem,
  HuntProgress,
  HuntTask,
  KidAgeBand,
  KidPlace,
} from '@/domain';

const unsplash = (id: string, w = 1000) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const ALL_AGES: KidAgeBand[] = ['0_3', '4_6', '7_10', '11_14'];
const FROM_4: KidAgeBand[] = ['4_6', '7_10', '11_14'];
const FROM_7: KidAgeBand[] = ['7_10', '11_14'];
const SUMMER = [5, 6, 7, 8, 9];
const SPRING_AUTUMN = [3, 4, 5, 6, 9, 10, 11];

type PlaceInput = Omit<
  KidPlace,
  | 'imageUrl'
  | 'strollerFriendly'
  | 'shade'
  | 'toilets'
  | 'water'
  | 'trailKm'
  | 'trailMin'
  | 'entryFeeTry'
  | 'seasonMonths'
  | 'linkedBusinessId'
  | 'linkedLibraryPlaceId'
  | 'countryCode'
> &
  Partial<
    Pick<
      KidPlace,
      | 'imageUrl'
      | 'strollerFriendly'
      | 'shade'
      | 'toilets'
      | 'water'
      | 'trailKm'
      | 'trailMin'
      | 'entryFeeTry'
      | 'seasonMonths'
      | 'linkedBusinessId'
      | 'linkedLibraryPlaceId'
      | 'countryCode'
    >
  >;

const place = (p: PlaceInput): KidPlace => ({
  imageUrl: null,
  strollerFriendly: false,
  shade: true,
  toilets: true,
  water: false,
  trailKm: null,
  trailMin: null,
  entryFeeTry: 0,
  seasonMonths: [],
  linkedBusinessId: null,
  linkedLibraryPlaceId: null,
  countryCode: 'TR',
  ...p,
});

/* ------------------------------------------------------------------ */
/* Yerler (28)                                                          */
/* ------------------------------------------------------------------ */

export const seedKidPlaces: KidPlace[] = [
  // --- İstanbul ---
  place({
    id: 'kp_polonezkoy',
    name: 'Polonezköy Tabiat Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 41.1108, longitude: 29.1345 },
    locationName: 'Beykoz, İstanbul',
    description:
      'Şehre en yakın orman parkı. Piknik masaları, ağaçlar arasında kısa yürüyüş döngüsü, küçük oyun alanı ve at binme. Hafta içi sakin, hafta sonu kalabalık.',
    imageUrl: unsplash('1441974231531-c6227db76b6e'),
    facilities: ['piknik masası', 'mangal alanı', 'oyun alanı', 'at binme', 'büfe', 'otopark'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Kene riski: uzun pantolon ve dönüşte kontrol', 'Hafta sonu araç trafiği'],
    trailKm: 2.5,
    trailMin: 50,
    entryFeeTry: 30,
    rating: 4.5,
    reviewCount: 412,
  }),
  place({
    id: 'kp_ataturk_kent_ormani',
    name: 'Atatürk Kent Ormanı',
    kind: 'easy_trail',
    ageBands: ALL_AGES,
    coords: { latitude: 41.1445, longitude: 28.9955 },
    locationName: 'Sarıyer, İstanbul',
    description:
      'Asfalt ve stabilize karışık, bebek arabasıyla rahat gezilen orman yolu. Çocuk oyun grupları ve geniş çim alanlar.',
    imageUrl: unsplash('1476611317561-60117649dd94'),
    facilities: ['oyun alanı', 'çim alan', 'kafe', 'bisiklet kiralama', 'otopark'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Bisiklet yolu ile yaya yolu kesişimlerinde dikkat'],
    trailKm: 3.2,
    trailMin: 60,
    rating: 4.4,
    reviewCount: 287,
  }),
  place({
    id: 'kp_belgrad_nesetsuyu',
    name: 'Belgrad Ormanı Neşetsuyu',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 41.1832, longitude: 28.9871 },
    locationName: 'Sarıyer, İstanbul',
    description:
      'Belgrad Ormanı’nın en aile dostu piknik alanı. Gölgeli masalar, dere kenarı, 6 km’lik yürüyüş parkuru ve yakınında kamp alanı.',
    imageUrl: unsplash('1448375240586-882707db888b'),
    facilities: ['piknik masası', 'dere kenarı', 'oyun alanı', 'büfe', 'otopark', 'kamp'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Kene riski yüksek: kene maşası taşıyın', 'Dere taşları kaygan'],
    trailKm: 6,
    trailMin: 110,
    entryFeeTry: 25,
    rating: 4.6,
    reviewCount: 538,
    linkedBusinessId: 'biz5',
  }),
  place({
    id: 'kp_aydos',
    name: 'Aydos Ormanı Oyun Alanı',
    kind: 'playground',
    ageBands: ['0_3', '4_6', '7_10'],
    coords: { latitude: 40.9331, longitude: 29.2338 },
    locationName: 'Kartal, İstanbul',
    description:
      'Orman içinde ahşap oyun grupları, ip parkuru ve göl manzaralı seyir terası. Yaz akşamları serin.',
    imageUrl: unsplash('1502933691298-84fc14542831'),
    facilities: ['oyun alanı', 'ip parkuru', 'seyir terası', 'kafe', 'otopark'],
    strollerFriendly: true,
    safetyNotes: ['Seyir terasında korkuluk düşük; küçük çocuklar için dikkat'],
    trailKm: 1.5,
    trailMin: 30,
    rating: 4.3,
    reviewCount: 196,
  }),
  place({
    id: 'kp_kemerburgaz',
    name: 'Kemerburgaz Kent Ormanı',
    kind: 'easy_trail',
    ageBands: ALL_AGES,
    coords: { latitude: 41.1683, longitude: 28.9095 },
    locationName: 'Eyüpsultan, İstanbul',
    description:
      'Geniş asfalt yürüyüş yolları, macera parkı ve piknik alanları. Bebek arabası ve denge bisikleti için ideal.',
    imageUrl: unsplash('1470071459604-3b5ec3a7fe05'),
    facilities: ['oyun alanı', 'macera parkı', 'piknik masası', 'kafe', 'otopark', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Kene riski'],
    trailKm: 4,
    trailMin: 70,
    rating: 4.4,
    reviewCount: 233,
  }),

  // --- Ankara ---
  place({
    id: 'kp_eymir',
    name: 'Eymir Gölü Bisiklet & Yürüyüş',
    kind: 'easy_trail',
    ageBands: FROM_4,
    coords: { latitude: 39.8225, longitude: 32.8231 },
    locationName: 'Çankaya, Ankara',
    description:
      'Göl çevresinde düz, 12 km’lik araçsız yol. Çocuk bisikleti kiralama, ördekler ve kamp ateşi kokan bir Ankara klasiği.',
    imageUrl: unsplash('1472214103451-9374bd1c798e'),
    facilities: ['bisiklet kiralama', 'kafe', 'piknik alanı', 'göl', 'otopark'],
    strollerFriendly: true,
    shade: false,
    water: true,
    safetyNotes: ['Göl kıyısı derin; su kenarında kol mesafesi', 'Güneş: gölge az'],
    trailKm: 12,
    trailMin: 180,
    rating: 4.6,
    reviewCount: 604,
  }),
  place({
    id: 'kp_soguksu',
    name: 'Soğuksu Milli Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 40.4667, longitude: 32.6333 },
    locationName: 'Kızılcahamam, Ankara',
    description:
      'Sarıçam ormanı, kara akbaba gözlem noktası ve serin mola yerleri. Kısa döngü patikalar ve piknik masaları.',
    imageUrl: unsplash('1469474968028-56623f02e42e'),
    facilities: ['piknik masası', 'kuş gözlem', 'büfe', 'otopark', 'bungalov'],
    water: true,
    safetyNotes: ['Kene riski', 'Öğle güneşi dik; şapka'],
    trailKm: 3,
    trailMin: 60,
    entryFeeTry: 40,
    rating: 4.5,
    reviewCount: 178,
  }),

  // --- İzmir ---
  place({
    id: 'kp_kulturpark',
    name: 'Kültürpark',
    kind: 'playground',
    ageBands: ALL_AGES,
    coords: { latitude: 38.4315, longitude: 27.1436 },
    locationName: 'Konak, İzmir',
    description:
      'Şehir merkezinde devasa park: oyun alanları, lunapark, gölet ve gölgeli yürüyüş yolları. Akşam serinliği için ideal.',
    imageUrl: unsplash('1500530855697-b586d89ba3ee'),
    facilities: ['oyun alanı', 'lunapark', 'gölet', 'kafe', 'müze', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Lunapark kalabalığında çocuğu gözden ayırmayın'],
    trailKm: 2,
    trailMin: 40,
    rating: 4.3,
    reviewCount: 921,
  }),
  place({
    id: 'kp_kus_cenneti',
    name: 'İzmir Kuş Cenneti',
    kind: 'nature_park',
    ageBands: FROM_4,
    coords: { latitude: 38.5175, longitude: 26.9142 },
    locationName: 'Çiğli, İzmir',
    description:
      'Flamingoların evi. Gözlem kuleleri, dürbünle kuş sayma, tuz düzlüklerinde düz yürüyüş. Bahar sabahları en iyisi.',
    imageUrl: unsplash('1452421822248-d4c2b47f0c81'),
    facilities: ['gözlem kulesi', 'ziyaretçi merkezi', 'otopark'],
    shade: false,
    safetyNotes: ['Gölge yok; güneş kremi ve bol su', 'Sivrisinek: kovucu'],
    trailKm: 4,
    trailMin: 75,
    seasonMonths: [2, 3, 4, 5, 9, 10, 11],
    rating: 4.4,
    reviewCount: 156,
  }),

  // --- Antalya ---
  place({
    id: 'kp_konyaalti',
    name: 'Konyaaltı Plajı Beach Park',
    kind: 'beach',
    ageBands: ALL_AGES,
    coords: { latitude: 36.8725, longitude: 30.6503 },
    locationName: 'Konyaaltı, Antalya',
    description:
      'Çakıl plajı, sahil parkı boyunca oyun alanları, duş ve gölgelik. Deniz hızlı derinleşir; kolluk şart.',
    imageUrl: unsplash('1507525428034-b723cf961d3e'),
    facilities: ['oyun alanı', 'duş', 'gölgelik', 'kafe', 'cankurtaran', 'wc'],
    strollerFriendly: true,
    shade: false,
    water: true,
    safetyNotes: ['Deniz hızlı derinleşir; kolluk ve yakın takip', 'Öğle güneşi'],
    seasonMonths: [4, 5, 6, 7, 8, 9, 10],
    rating: 4.5,
    reviewCount: 1340,
    linkedBusinessId: 'biz8',
  }),
  place({
    id: 'kp_kursunlu',
    name: 'Kurşunlu Şelalesi Tabiat Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 36.9797, longitude: 30.8353 },
    locationName: 'Aksu, Antalya',
    description:
      'Şelale ve göletler etrafında gölgeli, kısa ahşap yürüyüş yolu. Ördekler, kaplumbağalar ve serin bir öğle molası.',
    imageUrl: unsplash('1432405972618-c60b0225b8f9'),
    facilities: ['piknik masası', 'büfe', 'otopark', 'wc', 'seyir noktası'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Islak ahşap yol kaygan', 'Gölet kenarı korkuluksuz'],
    trailKm: 1.2,
    trailMin: 30,
    entryFeeTry: 45,
    rating: 4.4,
    reviewCount: 388,
  }),
  place({
    id: 'kp_koprulu_aile',
    name: 'Köprülü Kanyon Aile Raftingi (Sakin Bölüm)',
    kind: 'adventure_park',
    ageBands: FROM_7,
    coords: { latitude: 37.1979, longitude: 31.1897 },
    locationName: 'Manavgat, Antalya',
    description:
      'Kanyonun alt, sakin bölümünde 7+ yaş için 1–2 derece rafting. Can yeleği ve rehber dahil; öğle yemeği nehir kenarında.',
    imageUrl: unsplash('1504280390367-361c6d9f38f4'),
    facilities: ['rehber', 'can yeleği', 'restoran', 'otopark', 'soyunma kabini'],
    shade: false,
    water: true,
    safetyNotes: ['Akıntı: can yeleği çıkarılmaz', 'Su soğuk; yedek kıyafet', 'Güneş'],
    trailKm: 6,
    trailMin: 120,
    entryFeeTry: 650,
    seasonMonths: [4, 5, 6, 7, 8, 9, 10],
    rating: 4.7,
    reviewCount: 512,
    linkedBusinessId: 'biz8',
    linkedLibraryPlaceId: 'cur:raft:koprulu',
  }),

  // --- Muğla ---
  place({
    id: 'kp_kabak_aile_kampi',
    name: 'Kabak Koyu Aile Kampı',
    kind: 'family_camp',
    ageBands: FROM_4,
    coords: { latitude: 36.4839, longitude: 29.1447 },
    locationName: 'Kabak, Fethiye',
    description:
      'Koya bakan bungalov ve çadır alanı. Akşam ateşi, hamak, sabah kısa patika ile koya iniş. Araba en üstte kalır.',
    imageUrl: unsplash('1504198458649-3128b932f49e'),
    facilities: ['bungalov', 'çadır alanı', 'restoran', 'hamak', 'ateş alanı', 'duş'],
    water: true,
    safetyNotes: ['Koya inen patika dik ve taşlı', 'Akşam sivrisinek'],
    trailKm: 1.8,
    trailMin: 45,
    entryFeeTry: 900,
    seasonMonths: SUMMER,
    rating: 4.7,
    reviewCount: 243,
    linkedBusinessId: 'biz2',
    linkedLibraryPlaceId: 'cur:camp:kabak',
  }),
  place({
    id: 'kp_akyaka',
    name: 'Akyaka Kite Plajı (Sığ Kısım)',
    kind: 'beach',
    ageBands: ALL_AGES,
    coords: { latitude: 37.0466, longitude: 28.3245 },
    locationName: 'Akyaka, Muğla',
    description:
      'Yüzlerce metre boyunca diz boyu sığ, ılık deniz. Öğleden sonra rüzgâr çıkar; sabah saatleri bebekler için ideal.',
    imageUrl: unsplash('1471506480416-7c2f3c5b8b2f'),
    facilities: ['sığ deniz', 'kafe', 'şezlong', 'duş', 'wc'],
    strollerFriendly: true,
    shade: false,
    water: true,
    safetyNotes: ['Öğleden sonra rüzgâr ve dalga', 'Gölge yok'],
    seasonMonths: [5, 6, 7, 8, 9, 10],
    rating: 4.6,
    reviewCount: 477,
  }),

  // --- Bolu ---
  place({
    id: 'kp_golcuk',
    name: 'Gölcük Tabiat Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 40.6522, longitude: 31.5992 },
    locationName: 'Bolu',
    description:
      'Göl çevresinde 2 km’lik düz, ahşap korkuluklu yol. Sonbahar renkleri, ördek besleme (yem satılıyor) ve bungalovlar.',
    imageUrl: unsplash('1508739773434-c26b3d09e071'),
    facilities: ['göl yolu', 'bungalov', 'restoran', 'piknik masası', 'otopark', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Göl kıyısında korkuluğu olmayan bölümler', 'Kış aylarında buzlanma'],
    trailKm: 2,
    trailMin: 40,
    entryFeeTry: 40,
    rating: 4.6,
    reviewCount: 702,
  }),
  place({
    id: 'kp_abant',
    name: 'Abant Gölü Çevre Yolu',
    kind: 'easy_trail',
    ageBands: ALL_AGES,
    coords: { latitude: 40.6067, longitude: 31.2789 },
    locationName: 'Mudurnu, Bolu',
    description:
      'Gölü çevreleyen 7 km asfalt yol; bisiklet ve fayton. Ara ara piknik ve oyun noktaları. Yaz akşamları serin.',
    imageUrl: unsplash('1454496522488-7a8e488e8606'),
    facilities: ['bisiklet kiralama', 'fayton', 'restoran', 'piknik', 'otopark'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Fayton ve bisiklet trafiği', 'Kene riski (çimenlik alanlar)'],
    trailKm: 7,
    trailMin: 120,
    entryFeeTry: 45,
    rating: 4.5,
    reviewCount: 855,
  }),

  // --- Sakarya / Bursa ---
  place({
    id: 'kp_poyrazlar',
    name: 'Poyrazlar Gölü Tabiat Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 40.8433, longitude: 30.4361 },
    locationName: 'Adapazarı, Sakarya',
    description:
      'Küçük göl etrafında ahşap yürüyüş yolu, ip parkuru ve geniş oyun alanı. İstanbul’dan günübirlik.',
    imageUrl: unsplash('1464822759023-fed622ff2c3b'),
    facilities: ['oyun alanı', 'ip parkuru', 'kano', 'kafe', 'piknik', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Göl kenarında korkuluksuz iskele'],
    trailKm: 2.6,
    trailMin: 50,
    entryFeeTry: 20,
    rating: 4.3,
    reviewCount: 214,
  }),
  place({
    id: 'kp_sarialan',
    name: 'Uludağ Sarıalan Piknik Alanı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 40.1005, longitude: 29.1105 },
    locationName: 'Uludağ, Bursa',
    description:
      'Teleferikle çıkılan, çam ormanı içindeki yayla piknik alanı. Yazın serin, kışın kızak. Kısa patikalar ve gözleme.',
    imageUrl: unsplash('1486870591958-9b9d0d1dda99'),
    facilities: ['teleferik', 'piknik masası', 'restoran', 'kızak alanı', 'wc'],
    water: true,
    safetyNotes: ['Hava aniden değişir; kat kat giysi', 'Kışın kızak pistinde çarpışma'],
    trailKm: 2,
    trailMin: 45,
    entryFeeTry: 0,
    rating: 4.4,
    reviewCount: 633,
    linkedLibraryPlaceId: 'cur:ski:uludag',
  }),

  // --- Kapadokya ---
  place({
    id: 'kp_balon_izleme',
    name: 'Göreme Balon İzleme Noktası',
    kind: 'easy_trail',
    ageBands: ALL_AGES,
    coords: { latitude: 38.6449, longitude: 34.8321 },
    locationName: 'Göreme, Nevşehir',
    description:
      'Gün doğumunda yüzlerce balonu izlemek için kısa yürüyüşle çıkılan tepe. Termos çay ve battaniye ile unutulmaz bir sabah.',
    imageUrl: unsplash('1473968512647-3e447244af8f'),
    facilities: ['seyir noktası', 'otopark', 'kafe (sezonluk)'],
    shade: false,
    toilets: false,
    safetyNotes: ['Tepe kenarında uçurum; çocuğu elinizden bırakmayın', 'Sabah soğuk'],
    trailKm: 0.8,
    trailMin: 20,
    rating: 4.8,
    reviewCount: 1105,
    linkedBusinessId: 'biz4',
  }),
  place({
    id: 'kp_kapadokya_at_ciftligi',
    name: 'Kapadokya At Çiftliği',
    kind: 'farm',
    ageBands: FROM_4,
    coords: { latitude: 38.6613, longitude: 34.8612 },
    locationName: 'Avanos, Nevşehir',
    description:
      'Midilli binişi, at bakımı atölyesi ve peribacaları arasında 30 dakikalık yedekli tur. Kask ve eğitmen dahil.',
    imageUrl: unsplash('1500674425229-f692875b0ab7'),
    facilities: ['midilli', 'atölye', 'kafe', 'otopark', 'wc'],
    safetyNotes: ['At arkasında durulmaz; eğitmen talimatı', 'Toz: su ve şapka'],
    entryFeeTry: 350,
    rating: 4.6,
    reviewCount: 189,
    linkedBusinessId: 'biz4',
  }),

  // --- Fethiye / Kaş ---
  place({
    id: 'kp_oludeniz_kumburnu',
    name: 'Ölüdeniz Kumburnu Lagünü',
    kind: 'beach',
    ageBands: ALL_AGES,
    coords: { latitude: 36.5503, longitude: 29.1133 },
    locationName: 'Ölüdeniz, Fethiye',
    description:
      'Lagünün dalgasız, sığ ve turkuaz suyu bebekler için en güvenli deniz. Gölgelik çamlar ve pedallı deniz bisikleti.',
    imageUrl: unsplash('1506905925346-21bda4d32df4'),
    facilities: ['sığ lagün', 'gölgelik çam', 'şezlong', 'duş', 'kafe', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Kalabalık günlerde otopark dolu; sabah gidin'],
    entryFeeTry: 60,
    seasonMonths: [4, 5, 6, 7, 8, 9, 10],
    rating: 4.8,
    reviewCount: 2150,
    linkedLibraryPlaceId: 'cur:para:babadag',
  }),
  place({
    id: 'kp_kaputas',
    name: 'Kaputaş Plajı (Uyarı: Sığ Değil)',
    kind: 'beach',
    ageBands: FROM_7,
    coords: { latitude: 36.2325, longitude: 29.4483 },
    locationName: 'Kaş, Antalya',
    description:
      'Fotoğraflarda gördüğünüz kadar güzel ama deniz birkaç adımda derinleşir ve dalga olur. 187 basamak; bebek arabası imkânsız. Büyük çocuklar ve iyi yüzücüler için.',
    imageUrl: unsplash('1502082553048-f009c37129b9'),
    facilities: ['şezlong', 'büfe', 'wc'],
    shade: false,
    safetyNotes: [
      'Deniz hızla derinleşir; dalga ve akıntı',
      '187 basamak: bebek arabası ve küçük çocuk için uygun değil',
      'Gölge yok',
    ],
    seasonMonths: [5, 6, 7, 8, 9, 10],
    rating: 4.2,
    reviewCount: 1780,
    linkedLibraryPlaceId: 'cur:dive:kas',
  }),

  // --- Yurt dışı ---
  place({
    id: 'kp_zermatt_wolli',
    name: 'Zermatt Wolli Macera Patikası',
    kind: 'easy_trail',
    ageBands: FROM_4,
    coords: { latitude: 46.0075, longitude: 7.7483 },
    locationName: 'Zermatt, İsviçre',
    countryCode: 'CH',
    description:
      'Sunnegga’dan Leisee’ye inen, koyun maskotu Wolli’nin istasyonlarıyla süslü kolay patika. Göl kenarında sal ve oyun alanı; Matterhorn manzaralı.',
    imageUrl: unsplash('1508672019048-805c876b67e2'),
    facilities: ['füniküler', 'oyun alanı', 'göl', 'restoran', 'wc'],
    strollerFriendly: true,
    shade: false,
    water: true,
    safetyNotes: ['Yükseklik 2300 m: güneş kremi şart', 'Göl suyu soğuk'],
    trailKm: 2.2,
    trailMin: 45,
    entryFeeTry: 1200,
    seasonMonths: [6, 7, 8, 9],
    rating: 4.8,
    reviewCount: 356,
  }),
  place({
    id: 'kp_bavyera_waldseilgarten',
    name: 'Bavyera Waldseilgarten Ağaç Parkuru',
    kind: 'adventure_park',
    ageBands: FROM_7,
    coords: { latitude: 47.6244, longitude: 10.2814 },
    locationName: 'Pfronten, Bavyera',
    countryCode: 'DE',
    description:
      'Ağaçlar arasında kademeli ip parkurları, dev salıncak ve gece için ağaç çadırı. 1.10 m boy şartı; sürekli emniyet sistemi.',
    imageUrl: unsplash('1478131143081-80f7f84ca84d'),
    facilities: ['ip parkuru', 'zipline', 'ağaç çadırı', 'kafe', 'otopark'],
    safetyNotes: ['Kask ve emniyet kemeri çıkarılmaz', 'Yüksek platformlar'],
    trailMin: 150,
    entryFeeTry: 1100,
    seasonMonths: [4, 5, 6, 7, 8, 9, 10],
    rating: 4.7,
    reviewCount: 428,
  }),
  place({
    id: 'kp_dyrehaven',
    name: 'Kopenhag Dyrehaven Geyik Parkı',
    kind: 'nature_park',
    ageBands: ALL_AGES,
    coords: { latitude: 55.7936, longitude: 12.5747 },
    locationName: 'Klampenborg, Danimarka',
    countryCode: 'DK',
    description:
      'Serbest dolaşan 2000 geyik, asırlık meşeler ve düz çakıl yollar. Bisiklet ve bebek arabasıyla gezilir; girişte dünyanın en eski lunaparkı.',
    imageUrl: unsplash('1433086966358-54859d0ed716'),
    facilities: ['geyik gözlem', 'bisiklet', 'lunapark', 'kafe', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Geyiklere yaklaşmayın; kızışma döneminde (eylül–ekim) uzak durun'],
    trailKm: 5,
    trailMin: 90,
    rating: 4.7,
    reviewCount: 980,
  }),
  place({
    id: 'kp_chitwan',
    name: 'Chitwan Aile Safarisi',
    kind: 'zoo',
    ageBands: FROM_7,
    coords: { latitude: 27.5291, longitude: 84.345 },
    locationName: 'Sauraha, Nepal',
    countryCode: 'NP',
    description:
      'Milli parkta cip safarisi, kano ile timsah izleme ve fil bakım merkezi. Rehberli, çocuklara göre kısa turlar.',
    imageUrl: unsplash('1474511320723-9a56873867b5'),
    facilities: ['cip safari', 'kano', 'rehber', 'lodge', 'restoran'],
    shade: false,
    water: true,
    safetyNotes: [
      'Yaban hayvanlarına yaklaşılmaz; rehber talimatı',
      'Sıtma bölgesi: kovucu ve uzun giysi',
      'Nehirde timsah: kıyıya inilmez',
    ],
    trailMin: 180,
    entryFeeTry: 1500,
    seasonMonths: [10, 11, 12, 1, 2, 3],
    rating: 4.6,
    reviewCount: 312,
  }),
  place({
    id: 'kp_costa_brava',
    name: 'Costa Brava Aile Plajı (Platja de Pals)',
    kind: 'beach',
    ageBands: ALL_AGES,
    coords: { latitude: 41.9714, longitude: 3.2058 },
    locationName: 'Pals, Katalonya',
    countryCode: 'ES',
    description:
      'Uzun, geniş kumsal; sığ giriş ve kamp alanları. Sahil boyu bisiklet yolu ve akşam kıyı kasabaları.',
    imageUrl: unsplash('1499002238440-d264edd596ec'),
    facilities: ['kumsal', 'cankurtaran', 'kamp', 'bisiklet yolu', 'duş', 'wc'],
    strollerFriendly: true,
    shade: false,
    water: true,
    safetyNotes: ['Bayrak sistemine uyun; sarı bayrakta yakın takip', 'Gölge yok'],
    seasonMonths: [5, 6, 7, 8, 9],
    rating: 4.5,
    reviewCount: 640,
  }),

  // --- Ek: müze ve çiftlik ---
  place({
    id: 'kp_rahmi_koc',
    name: 'Rahmi M. Koç Müzesi',
    kind: 'museum',
    ageBands: FROM_4,
    coords: { latitude: 41.0424, longitude: 28.9491 },
    locationName: 'Hasköy, İstanbul',
    description:
      'Denizaltı, uçak, lokomotif ve etkileşimli bilim odaları. Yağmurlu gün planı; açık alanda tekne turu.',
    imageUrl: unsplash('1517824806704-9040b037703b'),
    facilities: ['etkileşimli sergi', 'denizaltı', 'restoran', 'otopark', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Denizaltı dar; klostrofobi'],
    trailMin: 150,
    entryFeeTry: 200,
    rating: 4.7,
    reviewCount: 3200,
  }),
  place({
    id: 'kp_sile_ciftlik',
    name: 'Şile Doğal Yaşam Çiftliği',
    kind: 'farm',
    ageBands: ['0_3', '4_6', '7_10'],
    coords: { latitude: 41.1512, longitude: 29.5468 },
    locationName: 'Şile, İstanbul',
    description:
      'Keçi sağma, yumurta toplama ve traktör turu. Köy kahvaltısı ve samanlıkta oyun. Bebekler için kuzu besleme köşesi.',
    imageUrl: unsplash('1500595046743-cd271d694d30'),
    facilities: ['hayvan besleme', 'traktör turu', 'kahvaltı', 'oyun alanı', 'otopark', 'wc'],
    strollerFriendly: true,
    water: true,
    safetyNotes: ['Hayvan temasından sonra el yıkama', 'Kene riski (çayır)'],
    entryFeeTry: 250,
    seasonMonths: SPRING_AUTUMN,
    rating: 4.5,
    reviewCount: 274,
  }),
];

/* ------------------------------------------------------------------ */
/* Çocuk profilleri                                                     */
/* ------------------------------------------------------------------ */

export const seedChildren: ChildProfile[] = [
  {
    id: 'child_defne',
    userId: 'u_me',
    name: 'Defne',
    ageBand: '4_6',
    avatar: '🦊',
    createdAt: '2026-03-12T09:00:00.000Z',
  },
  {
    id: 'child_ali',
    userId: 'u_me',
    name: 'Ali',
    ageBand: '7_10',
    avatar: '🦉',
    createdAt: '2026-03-12T09:01:00.000Z',
  },
  {
    id: 'child_mina',
    userId: 'u_elif',
    name: 'Mina',
    ageBand: '0_3',
    avatar: '🐻',
    createdAt: '2026-05-02T14:20:00.000Z',
  },
];

/* ------------------------------------------------------------------ */
/* Doğa avı görevleri (40)                                              */
/* ------------------------------------------------------------------ */

const task = (
  id: string,
  text: string,
  icon: string,
  category: HuntTask['category'],
  ageBands: KidAgeBand[],
  points: number,
): HuntTask => ({ id, text, icon, category, ageBands, points });

export const seedHuntTasks: HuntTask[] = [
  // Bitki
  task('ht_kozalak', 'Bir kozalak bul', 'tree-pine', 'plant', ALL_AGES, 10),
  task('ht_uc_yaprak', 'Üç farklı şekilde yaprak topla', 'trees', 'plant', ALL_AGES, 15),
  task('ht_cicek', 'Sarı bir çiçek bul (koparma!)', 'sparkles', 'plant', ALL_AGES, 10),
  task('ht_yosun', 'Dere taşında yosun bul', 'droplets', 'plant', FROM_4, 15),
  task('ht_mantar', 'Bir mantar bul, dokunmadan çiz', 'sparkles', 'plant', FROM_7, 20),
  task('ht_agac_kucakla', 'Bir ağaca sarıl ve gövdesini ölç', 'trees', 'plant', ['0_3', '4_6'], 10),
  task('ht_tohum', 'Rüzgârla uçan bir tohum bul', 'wind', 'plant', FROM_4, 15),
  task('ht_agac_kabugu', 'İki farklı ağaç kabuğuna dokun', 'tree-pine', 'plant', ALL_AGES, 10),

  // Hayvan
  task('ht_karinca', 'Bir karınca yolunu 1 dakika izle', 'bug', 'animal', ALL_AGES, 15),
  task('ht_kelebek', 'Bir kelebek gör', 'bug', 'animal', ALL_AGES, 15),
  task('ht_orumcek_agi', 'Bir örümcek ağı bul', 'bug', 'animal', FROM_4, 15),
  task('ht_ayak_izi', 'Çamurda bir hayvan ayak izi bul', 'footprints', 'animal', FROM_4, 25),
  task('ht_kus_gor', 'Üç farklı kuş gör', 'bird', 'animal', FROM_4, 20),
  task('ht_balik', 'Derede ya da gölde balık gör', 'fish', 'animal', ALL_AGES, 20),
  task(
    'ht_salyangoz',
    'Bir salyangoz ya da sümüklü böcek bul',
    'bug',
    'animal',
    ['0_3', '4_6', '7_10'],
    10,
  ),
  task('ht_kus_yuvasi', 'Bir kuş yuvası bul (dokunma)', 'bird', 'animal', FROM_7, 30),
  task('ht_tuy', 'Bir kuş tüyü bul', 'bird', 'animal', ALL_AGES, 15),

  // Taş
  task('ht_puruzsuz_tas', 'Pürüzsüz bir taş bul', 'mountain', 'rock', ALL_AGES, 10),
  task('ht_tas_kule', 'Beş taşla kule yap', 'mountain', 'rock', FROM_4, 20),
  task('ht_parlak_tas', 'Güneşte parlayan bir taş bul', 'gem', 'rock', FROM_4, 15),
  task('ht_kaya_seklî', 'Bir kayada hayvan şekli gör', 'mountain', 'rock', FROM_7, 20),

  // Su
  task('ht_dere_sesi', 'Dere sesini gözün kapalı dinle', 'droplets', 'water', ALL_AGES, 10),
  task('ht_tas_sektir', 'Suda taş sektir', 'droplets', 'water', FROM_7, 25),
  task('ht_yaprak_tekne', 'Yapraktan tekne yap ve yüzdür', 'droplets', 'water', FROM_4, 20),
  task('ht_cig', 'Sabah çiği ya da su damlası bul', 'droplets', 'water', ALL_AGES, 15),

  // Gökyüzü
  task('ht_bulut', 'Bulutta bir şekil bul', 'cloud', 'sky', ALL_AGES, 10),
  task('ht_gunes_golge', 'Gölgenin yönünü bul', 'sun', 'sky', FROM_4, 15),
  task('ht_yildiz', 'On yıldız say', 'star', 'sky', FROM_4, 20),
  task('ht_ay', 'Ayın şeklini çiz', 'moon', 'sky', FROM_4, 15),
  task('ht_ruzgar_yonu', 'Rüzgârın yönünü bir yaprakla bul', 'wind', 'sky', FROM_7, 20),
  task(
    'ht_gokkusagi',
    'Gökkuşağı ya da gökkuşağı rengi bir şey gör',
    'sparkles',
    'sky',
    ALL_AGES,
    25,
  ),

  // Ses
  task('ht_kus_sesi', 'Bir kuş sesi dinle ve taklit et', 'bird', 'sound', ALL_AGES, 15),
  task('ht_sessizlik', '30 saniye hiç konuşmadan doğayı dinle', 'wind', 'sound', FROM_4, 15),
  task('ht_cirtcirt', 'Cırcır böceği ya da ağustos böceği duy', 'bug', 'sound', FROM_4, 20),
  task('ht_yanki', 'Bir yankı bul', 'mountain', 'sound', FROM_7, 25),

  // El işi
  task('ht_dogadan_resim', 'Yaprak ve taşlarla yerde resim yap', 'sparkles', 'craft', ALL_AGES, 20),
  task(
    'ht_dal_cerceve',
    'Dallardan çerçeve yapıp manzarayı çerçevele',
    'tent',
    'craft',
    FROM_4,
    20,
  ),
  task('ht_cadir', 'Dallardan mini kulübe yap', 'tent', 'craft', FROM_7, 30),
  task('ht_yaprak_baski', 'Yaprağı kâğıda kalemle çıkart (baskı)', 'sparkles', 'craft', FROM_4, 15),
  task('ht_ates_hazirla', 'Kamp ateşi için çıra topla (yetişkinle)', 'flame', 'craft', FROM_7, 25),
];

/* ------------------------------------------------------------------ */
/* Doğa avı ilerlemesi                                                  */
/* ------------------------------------------------------------------ */

export const seedHuntProgress: HuntProgress[] = [
  {
    userId: 'u_me',
    childName: 'Defne',
    // 10 + 15 + 15 + 10 + 10 + 20 = 80 → Yaprak (50) kazanıldı; Kozalak (120) yolda
    completedTaskIds: [
      'ht_kozalak',
      'ht_uc_yaprak',
      'ht_kelebek',
      'ht_bulut',
      'ht_puruzsuz_tas',
      'ht_dogadan_resim',
    ],
    stickers: ['leaf', 'cone'],
    points: 130,
    updatedAt: '2026-08-30T15:40:00.000Z',
  },
];

/* ------------------------------------------------------------------ */
/* Aile kontrol listesi (30)                                            */
/* ------------------------------------------------------------------ */

const item = (
  key: string,
  label: string,
  category: FamilyChecklistItem['category'],
  ageBands: KidAgeBand[] = ALL_AGES,
): FamilyChecklistItem => ({ key, label, category, ageBands });

export const seedFamilyChecklist: FamilyChecklistItem[] = [
  // Güvenlik
  item('sunscreen', 'Güneş kremi (SPF 50, çocuk)', 'safety'),
  item('hat', 'Şapka ve güneş gözlüğü', 'safety'),
  item('first_aid', 'Mini ilk yardım çantası', 'safety'),
  item('tick_tool', 'Kene maşası', 'safety'),
  item('whistle', 'Düdük (her çocuğa bir tane)', 'safety', FROM_4),
  item('id_card', 'Acil durum kartı (ad, telefon, alerji)', 'safety'),
  item('life_vest', 'Kolluk / can yeleği', 'safety', ['0_3', '4_6', '7_10']),
  item('headlamp', 'Kafa lambası', 'safety', FROM_7),
  // Sağlık
  item('meds', 'Düzenli ilaçlar ve ateş düşürücü', 'health'),
  item('repellent', 'Sivrisinek kovucu (çocuk tipi)', 'health'),
  item('wipes', 'Islak mendil ve el dezenfektanı', 'health'),
  item('diapers', 'Bez ve alt açma örtüsü', 'health', ['0_3']),
  item('bandaid', 'Renkli yara bandı', 'health', ['0_3', '4_6', '7_10']),
  // Konfor
  item('spare_clothes', 'Yedek kıyafet seti (ıslanmaya karşı)', 'comfort'),
  item('carrier', 'Bebek taşıyıcı / sırt kanguru', 'comfort', ['0_3']),
  item('stroller', 'Arazi tekerlekli bebek arabası', 'comfort', ['0_3']),
  item('blanket', 'Piknik örtüsü / battaniye', 'comfort'),
  item('rain_jacket', 'Yağmurluk', 'comfort'),
  item('shoes', 'Kapalı, kaymaz ayakkabı', 'comfort', FROM_4),
  item('sun_tent', 'Gölgelik / plaj çadırı', 'comfort', ['0_3', '4_6']),
  // Yiyecek
  item('water', 'Kişi başı 1 L su (+ yedek)', 'food'),
  item('snacks', 'Atıştırmalık: kuru meyve, kraker, meyve', 'food'),
  item('bottle', 'Biberon / suluk', 'food', ['0_3', '4_6']),
  item('lunch', 'Piknik yemeği ve çöp poşeti', 'food'),
  item('trash_bag', 'Çöp poşeti (iz bırakma)', 'food'),
  // Eğlence
  item('hunt_card', 'Doğa avı kartı ve kalem', 'fun', FROM_4),
  item('binoculars', 'Çocuk dürbünü', 'fun', FROM_4),
  item('magnifier', 'Büyüteç ve böcek kavanozu', 'fun', ['4_6', '7_10']),
  item('ball', 'Top / frizbi', 'fun', FROM_4),
  item('toy', 'Sevdiği küçük oyuncak', 'fun', ['0_3', '4_6']),
];
