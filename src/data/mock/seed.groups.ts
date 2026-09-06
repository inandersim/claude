import {
  encodeSystemMessage,
  generateInviteCode,
  type GeoPoint,
  type Group,
  type GroupMember,
  type GroupMessage,
  type GroupMessageType,
  type PollOption,
} from '@/domain';

/**
 * Gruplar & kanallar demo verisi. Tarihler "şimdi"ye göreli üretilir (son 10 gün).
 *
 * `u_me` dört grupta üyedir (Kaçkar ekibi — yönetici, İstanbul yürüyüşleri,
 * Zirve Duyurular kanalı, Everest Base Camp). ODTÜ DAK grubuna bekleyen bir daveti
 * vardır (`joinedAt: ''`), böylece özel gruba "davetle katılma" akışı denenebilir.
 */

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const now = Date.now();
/** d gün, h saat, m dakika önce */
const ago = (d: number, h = 0, m = 0) =>
  new Date(now - (d * 24 * 60 + h * 60 + m) * 60_000).toISOString();

const NAMES: Record<string, string> = {
  u_me: 'Deniz Kaya',
  u_elif: 'Elif Doğan',
  u_can: 'Can Yıldırım',
  u_zeynep: 'Zeynep Aksoy',
  u_mert: 'Mert Öztürk',
  u_selin: 'Selin Arslan',
  u_baris: 'Barış Çelik',
  u_ayse: 'Ayşe Kurt',
  u_emre: 'Emre Şahin',
  u_lale: 'Lale Demir',
  u_kerem: 'Kerem Aydın',
  u_nil: 'Nil Erdem',
};

type Extra = Partial<
  Pick<GroupMessage, 'imageUrl' | 'coords' | 'routeId' | 'poll' | 'replyToId' | 'editedAt'>
> & { type?: GroupMessageType };

/** Grup başına artan mesaj sayacı — kimlikler `gm_<grup>_<n>` (yanıt/sabitleme referansları için). */
const counters = new Map<string, number>();
const msg = (
  groupId: string,
  senderId: string,
  text: string,
  createdAt: string,
  extra: Extra = {},
): GroupMessage => {
  const seq = (counters.get(groupId) ?? 0) + 1;
  counters.set(groupId, seq);
  const { type, ...rest } = extra;
  const inferred: GroupMessageType =
    type ??
    (rest.poll
      ? 'poll'
      : rest.imageUrl
        ? 'image'
        : rest.coords
          ? 'location'
          : rest.routeId
            ? 'route'
            : 'text');
  return {
    id: `gm_${groupId.slice(2)}_${seq}`,
    groupId,
    senderId,
    type: inferred,
    text,
    imageUrl: null,
    coords: null,
    routeId: null,
    poll: null,
    replyToId: null,
    editedAt: null,
    createdAt,
    ...rest,
  };
};

const sys = (
  groupId: string,
  actorId: string,
  kind: 'joined' | 'left' | 'pinned' | 'created',
  at: string,
) =>
  msg(groupId, actorId, encodeSystemMessage(kind, NAMES[actorId] ?? actorId), at, {
    type: 'system',
  });

const opt = (id: string, text: string, votes: number): PollOption => ({ id, text, votes });

const group = (
  g: Omit<Group, 'inviteCode' | 'pinnedMessageId' | 'lastMessageAt' | 'countryCode'> &
    Partial<Pick<Group, 'pinnedMessageId' | 'countryCode'>>,
): Group => ({
  countryCode: 'TR',
  inviteCode: generateInviteCode(g.id),
  pinnedMessageId: null,
  lastMessageAt: null,
  ...g,
});

const member = (
  groupId: string,
  userId: string,
  role: GroupMember['role'],
  joinedAt: string,
  patch: Partial<Pick<GroupMember, 'muted' | 'lastReadAt'>> = {},
): GroupMember => ({
  groupId,
  userId,
  role,
  joinedAt,
  muted: false,
  lastReadAt: null,
  ...patch,
});

const KAVRON: GeoPoint = { latitude: 40.8608, longitude: 41.1594 };
const BELGRAD: GeoPoint = { latitude: 41.1876, longitude: 28.9838 };
const GEYIK: GeoPoint = { latitude: 36.9412, longitude: 30.5041 };
const KAS: GeoPoint = { latitude: 36.2018, longitude: 29.6386 };
const OLUDENIZ: GeoPoint = { latitude: 36.55, longitude: 29.1167 };
const LUKLA: GeoPoint = { latitude: 27.6875, longitude: 86.7314 };
const GOREME: GeoPoint = { latitude: 38.6431, longitude: 34.8289 };

/* ------------------------------------------------------------------ */
/* Gruplar                                                             */
/* ------------------------------------------------------------------ */

export const seedGroups: Group[] = [
  group({
    id: 'g_kackar',
    name: 'Kaçkar 2026 Ağustos ekibi',
    kind: 'group',
    privacy: 'private',
    description:
      'Ağustos 2026 Kaçkar zirve tırmanışı için ekip sohbeti. Ulaşım, ekipman listesi, hava durumu ve kamp planı burada.',
    avatarUrl: unsplash('1464822759023-fed622ff2c3b', 400),
    adventureTypes: ['hiking', 'climbing'],
    city: 'Rize',
    ownerId: 'u_elif',
    memberCount: 6,
    clubId: null,
    createdAt: ago(9, 6),
    pinnedMessageId: 'gm_kackar_9',
  }),
  group({
    id: 'g_ist_hike',
    name: 'İstanbul Hafta Sonu Yürüyüşleri',
    kind: 'group',
    privacy: 'public',
    description:
      'Her hafta sonu Belgrad Ormanı, Polonezköy, Şile… Yeni başlayanlar hoş geldiniz; tempo rahat, sohbet bol.',
    avatarUrl: unsplash('1441974231531-c6227db76b6e', 400),
    adventureTypes: ['hiking'],
    city: 'İstanbul',
    ownerId: 'u_kerem',
    memberCount: 340,
    clubId: null,
    createdAt: ago(10, 2),
  }),
  group({
    id: 'g_antalya_climb',
    name: 'Antalya Tırmanış',
    kind: 'group',
    privacy: 'public',
    description:
      'Geyikbayırı, Çitdibi, Olimpos… Partner arama, sektör durumu ve emniyet sohbeti. Kask şart.',
    avatarUrl: unsplash('1522163182402-834f871fd851', 400),
    adventureTypes: ['climbing'],
    city: 'Antalya',
    ownerId: 'u_selin',
    memberCount: 128,
    clubId: null,
    createdAt: ago(10, 0),
  }),
  group({
    id: 'g_kas_dive',
    name: 'Kaş Dalış Buddy Bul',
    kind: 'group',
    privacy: 'public',
    description:
      'Kaş ve Kalkan çevresinde dalış partneri bul, tekne çıkışlarına katıl. Brövenizi profilinize ekleyin.',
    avatarUrl: unsplash('1544551763-46a013bb70d5', 400),
    adventureTypes: ['diving'],
    city: 'Antalya',
    ownerId: 'u_lale',
    memberCount: 96,
    clubId: null,
    createdAt: ago(9, 20),
  }),
  group({
    id: 'g_zirve_news',
    name: 'Zirve Duyurular',
    kind: 'channel',
    privacy: 'public',
    description:
      'Uygulama güncellemeleri, topluluk etkinlikleri ve güvenlik duyuruları. Yalnızca ekip yazar.',
    avatarUrl: null,
    adventureTypes: ['hiking', 'climbing', 'skiing', 'diving', 'cycling', 'paragliding'],
    city: null,
    ownerId: 'u_can',
    memberCount: 1250,
    clubId: null,
    createdAt: ago(10, 4),
    pinnedMessageId: 'gm_zirve_news_2',
  }),
  group({
    id: 'g_avalanche',
    name: 'Çığ Bülteni TR',
    kind: 'channel',
    privacy: 'public',
    description:
      'Türkiye dağları için günlük çığ tehlike seviyeleri ve kar örtüsü notları. Resmî bültenlerin özeti; karar sizindir.',
    avatarUrl: unsplash('1483728642387-6c3bdd6c93e5', 400),
    adventureTypes: ['skiing', 'climbing'],
    city: null,
    ownerId: 'u_mert',
    memberCount: 2100,
    clubId: null,
    createdAt: ago(10, 1),
  }),
  group({
    id: 'g_oludeniz',
    name: 'Yamaç Paraşütü Ölüdeniz',
    kind: 'group',
    privacy: 'public',
    description:
      'Babadağ kalkış durumu, rüzgâr raporu ve araç paylaşımı. Tandem pilotları ve solo uçucular birlikte.',
    avatarUrl: unsplash('1469474968028-56623f02e42e', 400),
    adventureTypes: ['paragliding'],
    city: 'Muğla',
    ownerId: 'u_nil',
    memberCount: 210,
    clubId: null,
    createdAt: ago(9, 12),
  }),
  group({
    id: 'g_gear_swap',
    name: 'Kamp Ekipmanı Takas',
    kind: 'group',
    privacy: 'public',
    description:
      'Fazla ekipmanını takasla, eksiğini tamamla. Fotoğraf + durum + şehir yaz; para konuşmak yasak, takas serbest.',
    avatarUrl: unsplash('1517649763962-0c623066013b', 400),
    adventureTypes: ['hiking', 'climbing', 'cycling'],
    city: 'Ankara',
    ownerId: 'u_baris',
    memberCount: 415,
    clubId: null,
    createdAt: ago(9, 0),
  }),
  group({
    id: 'g_kapadokya_bike',
    name: 'Bisiklet Turu Kapadokya',
    kind: 'group',
    privacy: 'public',
    description:
      'Göreme–Uçhisar–Çavuşin gravel turları. Haftalık buluşma cumartesi 07:00, Göreme meydan.',
    avatarUrl: unsplash('1472214103451-9374bd1c798e', 400),
    adventureTypes: ['cycling'],
    city: 'Nevşehir',
    ownerId: 'u_ayse',
    memberCount: 77,
    clubId: null,
    createdAt: ago(8, 10),
  }),
  group({
    id: 'g_metu',
    name: 'ODTÜ DAK Üyeleri',
    kind: 'group',
    privacy: 'private',
    description:
      'ODTÜ Dağcılık ve Kış Sporları Kolu üyelerine özel sohbet. Eğitim takvimi, malzeme deposu ve hafta sonu faaliyetleri.',
    avatarUrl: unsplash('1454496522488-7a8e488e8606', 400),
    adventureTypes: ['climbing', 'hiking', 'skiing'],
    city: 'Ankara',
    ownerId: 'u_emre',
    memberCount: 58,
    clubId: 'c_metu',
    createdAt: ago(10, 3),
  }),
  group({
    id: 'g_ebc',
    name: 'Everest Base Camp Ekim',
    kind: 'group',
    privacy: 'private',
    description:
      'Ekim ayı EBC trek ekibi: Lukla uçuşları, aklimatizasyon planı, sigorta ve bütçe. 9 kişi, kontenjan dolu.',
    avatarUrl: unsplash('1506905925346-21bda4d32df4', 400),
    adventureTypes: ['hiking'],
    city: 'İstanbul',
    ownerId: 'u_zeynep',
    memberCount: 9,
    clubId: null,
    createdAt: ago(7, 15),
    pinnedMessageId: 'gm_ebc_3',
  }),
  group({
    id: 'g_trail',
    name: 'Trail Running Türkiye',
    kind: 'group',
    privacy: 'public',
    description:
      'Patika koşusu yarış takvimi, antrenman paylaşımı ve ekipman tavsiyeleri. Her seviyeden koşucu.',
    avatarUrl: unsplash('1470071459604-3b5ec3a7fe05', 400),
    adventureTypes: ['hiking'],
    city: 'İzmir',
    ownerId: 'u_kerem',
    memberCount: 530,
    clubId: null,
    createdAt: ago(9, 8),
  }),
];

/* ------------------------------------------------------------------ */
/* Üyelikler                                                           */
/* ------------------------------------------------------------------ */

export const seedGroupMembers: GroupMember[] = [
  // Kaçkar ekibi (özel)
  member('g_kackar', 'u_elif', 'owner', ago(9, 6), { lastReadAt: ago(0, 0, 5) }),
  member('g_kackar', 'u_me', 'admin', ago(9, 5), { lastReadAt: ago(0, 3) }),
  member('g_kackar', 'u_can', 'member', ago(9, 4)),
  member('g_kackar', 'u_zeynep', 'member', ago(9, 1)),
  member('g_kackar', 'u_mert', 'member', ago(8, 20)),
  member('g_kackar', 'u_baris', 'member', ago(8, 2)),
  // İstanbul yürüyüşleri (açık)
  member('g_ist_hike', 'u_kerem', 'owner', ago(10, 2)),
  member('g_ist_hike', 'u_ayse', 'admin', ago(10, 0)),
  member('g_ist_hike', 'u_me', 'member', ago(6, 4), { lastReadAt: ago(1, 2) }),
  member('g_ist_hike', 'u_selin', 'member', ago(5, 0)),
  member('g_ist_hike', 'u_nil', 'member', ago(4, 3)),
  member('g_ist_hike', 'u_emre', 'member', ago(3, 9)),
  // Antalya tırmanış
  member('g_antalya_climb', 'u_selin', 'owner', ago(10, 0)),
  member('g_antalya_climb', 'u_baris', 'admin', ago(9, 22)),
  member('g_antalya_climb', 'u_lale', 'member', ago(8, 0)),
  member('g_antalya_climb', 'u_can', 'member', ago(6, 6)),
  // Kaş dalış
  member('g_kas_dive', 'u_lale', 'owner', ago(9, 20)),
  member('g_kas_dive', 'u_nil', 'member', ago(8, 8)),
  member('g_kas_dive', 'u_zeynep', 'member', ago(7, 4)),
  // Zirve Duyurular (kanal)
  member('g_zirve_news', 'u_can', 'owner', ago(10, 4)),
  member('g_zirve_news', 'u_elif', 'admin', ago(10, 3)),
  member('g_zirve_news', 'u_me', 'member', ago(9, 0), { lastReadAt: ago(3, 0) }),
  member('g_zirve_news', 'u_mert', 'member', ago(8, 0), { muted: true }),
  member('g_zirve_news', 'u_kerem', 'member', ago(7, 0)),
  // Çığ bülteni (kanal)
  member('g_avalanche', 'u_mert', 'owner', ago(10, 1)),
  member('g_avalanche', 'u_zeynep', 'member', ago(9, 0)),
  member('g_avalanche', 'u_emre', 'member', ago(6, 0)),
  // Ölüdeniz
  member('g_oludeniz', 'u_nil', 'owner', ago(9, 12)),
  member('g_oludeniz', 'u_lale', 'admin', ago(9, 0)),
  member('g_oludeniz', 'u_ayse', 'member', ago(5, 6)),
  // Ekipman takas
  member('g_gear_swap', 'u_baris', 'owner', ago(9, 0)),
  member('g_gear_swap', 'u_mert', 'admin', ago(8, 12)),
  member('g_gear_swap', 'u_emre', 'member', ago(7, 0)),
  member('g_gear_swap', 'u_can', 'member', ago(6, 0)),
  member('g_gear_swap', 'u_selin', 'member', ago(4, 0)),
  // Kapadokya bisiklet
  member('g_kapadokya_bike', 'u_ayse', 'owner', ago(8, 10)),
  member('g_kapadokya_bike', 'u_kerem', 'member', ago(7, 0)),
  member('g_kapadokya_bike', 'u_elif', 'member', ago(5, 0)),
  // ODTÜ DAK (özel, kulüp bağlantılı) — u_me bekleyen davet
  member('g_metu', 'u_emre', 'owner', ago(10, 3)),
  member('g_metu', 'u_ayse', 'admin', ago(10, 2)),
  member('g_metu', 'u_mert', 'member', ago(9, 0)),
  member('g_metu', 'u_me', 'member', ''),
  // Everest Base Camp (özel)
  member('g_ebc', 'u_zeynep', 'owner', ago(7, 15), { lastReadAt: ago(0, 1) }),
  member('g_ebc', 'u_can', 'admin', ago(7, 14)),
  member('g_ebc', 'u_me', 'member', ago(7, 10), { lastReadAt: ago(0, 0, 30) }),
  member('g_ebc', 'u_lale', 'member', ago(7, 0)),
  member('g_ebc', 'u_kerem', 'member', ago(6, 22)),
  // Trail running
  member('g_trail', 'u_kerem', 'owner', ago(9, 8)),
  member('g_trail', 'u_nil', 'admin', ago(9, 0)),
  member('g_trail', 'u_selin', 'member', ago(7, 0)),
  member('g_trail', 'u_baris', 'member', ago(3, 0)),
];

/* ------------------------------------------------------------------ */
/* Mesajlar                                                            */
/* ------------------------------------------------------------------ */

const kackar: GroupMessage[] = [
  sys('g_kackar', 'u_elif', 'created', ago(9, 6)),
  sys('g_kackar', 'u_me', 'joined', ago(9, 5)),
  sys('g_kackar', 'u_can', 'joined', ago(9, 4)),
  msg(
    'g_kackar',
    'u_elif',
    'Herkese merhaba! Ağustos Kaçkar planı için grubu açtım. 14–17 Ağustos arası düşünüyorum, Yukarı Kavron’dan çıkış.',
    ago(9, 3, 40),
  ),
  msg('g_kackar', 'u_can', 'Süper, ben varım. Uçakla Rize mi yoksa araba mı?', ago(9, 3, 35)),
  msg(
    'g_kackar',
    'u_me',
    'Araba daha mantıklı bence, dönüşte Ayder’e de uğrarız. 2 araba yeter.',
    ago(9, 3, 31),
  ),
  sys('g_kackar', 'u_zeynep', 'joined', ago(9, 1)),
  msg(
    'g_kackar',
    'u_zeynep',
    'Selam ekip! Geçen yıl aynı rotayı yürüdüm, sorularınız olursa yazın.',
    ago(8, 23),
  ),
  msg(
    'g_kackar',
    'u_elif',
    'Zirve rotası bu. Kavron yaylasından Dilber Düzü kampına, ertesi sabah 04:00’te zirve.',
    ago(8, 22, 10),
    { routeId: 'r_kackar' },
  ),
  msg(
    'g_kackar',
    'u_zeynep',
    'Buzul geçişinde krampon lazım olabilir, ağustosta bile kar kalıyor.',
    ago(8, 22),
  ),
  sys('g_kackar', 'u_mert', 'joined', ago(8, 20)),
  msg(
    'g_kackar',
    'u_mert',
    'Merhaba! Krampon konusunda +1. Geçen sene sabah 5’te buz gibiydi kar.',
    ago(8, 19, 30),
    { replyToId: 'gm_kackar_10' },
  ),
  msg(
    'g_kackar',
    'u_me',
    'Ekipman listesi taslağı:\n• 3 mevsim uyku tulumu (-5°C konfor)\n• Kask + krampon (hafif)\n• Kafa lambası + yedek pil\n• 2 L su + filtre\n• Yağmurluk ve polar\nEksik var mı?',
    ago(7, 10),
  ),
  msg('g_kackar', 'u_can', 'Baton! Ve güneş kremi, yaylada fena yakıyor.', ago(7, 9, 55)),
  msg('g_kackar', 'u_elif', 'Ben ocak ve tüpü alırım, ortak kullanırız.', ago(7, 9, 50)),
  sys('g_kackar', 'u_baris', 'joined', ago(8, 2)),
  msg(
    'g_kackar',
    'u_baris',
    'Geçen hafta Kavron’dan çektim, yol durumu böyle. Son 3 km stabilize ama araba çıkar.',
    ago(6, 8),
    { imageUrl: unsplash('1464822759023-fed622ff2c3b') },
  ),
  msg('g_kackar', 'u_zeynep', 'Manzaraya bak 😍', ago(6, 7, 58)),
  msg('g_kackar', 'u_elif', 'Araç konusu: hangi gün çıkalım?', ago(4, 12), {
    poll: {
      question: 'Yola çıkış günü?',
      multi: false,
      options: [
        opt('o1', '13 Ağustos Perşembe akşamı', 4),
        opt('o2', '14 Ağustos Cuma sabahı', 2),
        opt('o3', 'Fark etmez', 0),
      ],
    },
  }),
  msg(
    'g_kackar',
    'u_mert',
    'Perşembe akşamı çıkarsak cuma öğlen yaylada oluruz, bir gün kazanırız.',
    ago(4, 11, 40),
  ),
  msg(
    'g_kackar',
    'u_me',
    'Buluşma noktası: Kavron yaylası girişindeki köprü. Buradan yürüyoruz.',
    ago(2, 9),
    { coords: KAVRON },
  ),
  msg(
    'g_kackar',
    'u_can',
    'Hava durumuna baktım, cumartesi öğleden sonra sağanak var. Sabah erken çıkış şart.',
    ago(0, 5, 20),
  ),
  msg(
    'g_kackar',
    'u_elif',
    'O zaman 03:30 kalkış, 04:00 yürüyüş. Kimse itiraz etmesin 😄',
    ago(0, 2, 30),
  ),
  msg('g_kackar', 'u_zeynep', 'Kabul. Ben kahveyi hazırlarım.', ago(0, 2, 27)),
  msg(
    'g_kackar',
    'u_baris',
    '@deniz.kaya araba listesini sen mi tutuyorsun? Ben Ankara’dan çıkacağım.',
    ago(0, 0, 40),
  ),
];

const istHike: GroupMessage[] = [
  sys('g_ist_hike', 'u_kerem', 'created', ago(10, 2)),
  msg(
    'g_ist_hike',
    'u_kerem',
    'Hoş geldiniz! Bu hafta sonu Belgrad Ormanı Neşetsuyu parkuru, 12 km, rahat tempo. Cumartesi 09:00 Bahçeköy girişi.',
    ago(9, 22),
  ),
  msg(
    'g_ist_hike',
    'u_ayse',
    'Yeni başlayanlar için ideal. Bol su ve rahat ayakkabı yeterli.',
    ago(9, 21, 40),
  ),
  msg('g_ist_hike', 'u_selin', 'İlk kez katılacağım, ne kadar sürüyor?', ago(8, 10)),
  msg(
    'g_ist_hike',
    'u_kerem',
    'Molalarla 3,5 saat civarı. Sonunda çay molası klasiktir 🍵',
    ago(8, 9, 50),
    { replyToId: 'gm_ist_hike_4' },
  ),
  sys('g_ist_hike', 'u_me', 'joined', ago(6, 4)),
  msg(
    'g_ist_hike',
    'u_me',
    'Selam! Cumartesi geliyorum, arabayla gelen var mı Kadıköy tarafından?',
    ago(6, 3, 50),
  ),
  msg('g_ist_hike', 'u_nil', 'Ben Kadıköy’den çıkıyorum, 2 kişilik yer var.', ago(6, 3, 20)),
  msg(
    'g_ist_hike',
    'u_ayse',
    'Geçen haftadan bir kare. Sonbahar renkleri başlamış bile.',
    ago(5, 8),
    { imageUrl: unsplash('1441974231531-c6227db76b6e') },
  ),
  msg('g_ist_hike', 'u_emre', 'Harika görünüyor 👏', ago(5, 7, 55)),
  msg(
    'g_ist_hike',
    'u_kerem',
    'Buluşma noktası tam olarak burası, orman girişi otopark.',
    ago(2, 14),
    { coords: BELGRAD },
  ),
  msg('g_ist_hike', 'u_selin', 'Yağmur ihtimali varsa iptal olur mu?', ago(2, 13, 30)),
  msg(
    'g_ist_hike',
    'u_kerem',
    'Hafif yağmurda yürürüz, sağanaksa cuma akşamı buradan duyururum.',
    ago(2, 13, 20),
    { replyToId: 'gm_ist_hike_12' },
  ),
  msg('g_ist_hike', 'u_nil', 'Yürüyüş sonrası Bahçeköy’de kahvaltı yapan var mı? 🥐', ago(1, 6)),
  msg('g_ist_hike', 'u_emre', 'Kesinlikle varım.', ago(1, 5, 58)),
  msg(
    'g_ist_hike',
    'u_ayse',
    'Hava cumartesi 18°C, parçalı bulutlu. Mükemmel yürüyüş havası.',
    ago(0, 9),
  ),
  msg(
    'g_ist_hike',
    'u_kerem',
    'Hatırlatma: 09:00’da kalkıyoruz, geç kalan orman bekçisiyle yürür 😅',
    ago(0, 4),
  ),
  msg('g_ist_hike', 'u_selin', 'Tamamdır, 08:45’te oradayım!', ago(0, 3, 50)),
];

const antalya: GroupMessage[] = [
  sys('g_antalya_climb', 'u_selin', 'created', ago(10, 0)),
  msg(
    'g_antalya_climb',
    'u_selin',
    'Geyikbayırı sezonu açılıyor! Bu hafta sonu Trebenna sektöründeyiz, partner arayanlar yazsın.',
    ago(9, 8),
  ),
  msg(
    'g_antalya_climb',
    'u_baris',
    'Cumartesi 6b–6c civarı tırmanan partner arıyorum, ip bende.',
    ago(9, 7, 30),
  ),
  msg('g_antalya_climb', 'u_lale', 'Ben olabilirim, 6b rahat gidiyorum. Sabah kaçta?', ago(9, 7)),
  msg('g_antalya_climb', 'u_baris', 'Gölge için 08:00 iyi olur.', ago(9, 6, 50), {
    replyToId: 'gm_antalya_climb_4',
  }),
  msg('g_antalya_climb', 'u_selin', 'Trebenna yaklaşımı ve sektör bilgisi burada.', ago(8, 12), {
    routeId: 'r_geyik',
  }),
  msg(
    'g_antalya_climb',
    'u_can',
    'Dün Sarkıt sektöründe düşen taş vardı, kask takmayan girmesin lütfen.',
    ago(5, 10),
  ),
  msg('g_antalya_climb', 'u_selin', 'Teşekkürler uyarı için, sabitliyorum.', ago(5, 9, 50)),
  msg(
    'g_antalya_climb',
    'u_lale',
    'Cumartesiden 📸 6c+ "Kral Yolu" ilk denemede çıktı 🎉',
    ago(3, 16),
    { imageUrl: unsplash('1522163182402-834f871fd851') },
  ),
  msg('g_antalya_climb', 'u_baris', 'Tebrikler!! Sıradaki 7a 💪', ago(3, 15, 50)),
  msg('g_antalya_climb', 'u_selin', 'Kamp alanı konumu, yeni gelenler için:', ago(1, 11), {
    coords: GEYIK,
  }),
  msg(
    'g_antalya_climb',
    'u_can',
    'Bu hafta sonu hava 31°C, öğlen tırmanmayın; sabah ve akşam.',
    ago(0, 6),
  ),
];

const kas: GroupMessage[] = [
  sys('g_kas_dive', 'u_lale', 'created', ago(9, 20)),
  msg(
    'g_kas_dive',
    'u_lale',
    'Kaş’ta buddy arayanlar için grup. Bröve seviyenizi ve tarihlerinizi yazın, eşleşelim.',
    ago(9, 18),
  ),
  msg(
    'g_kas_dive',
    'u_nil',
    'AOWD, 40 dalış. 20–22 Eylül Kaş’tayım, Flying Fish batığı istiyorum.',
    ago(8, 8),
  ),
  msg(
    'g_kas_dive',
    'u_zeynep',
    'Aynı tarihlerde oradayım, OWD ama 30 m’e inebiliyorum. Eşleşelim mi?',
    ago(7, 4),
  ),
  msg('g_kas_dive', 'u_nil', 'Olur! Tekne çıkışını Lale ayarlıyor sanırım?', ago(7, 3, 50), {
    replyToId: 'gm_kas_dive_4',
  }),
  msg(
    'g_kas_dive',
    'u_lale',
    'Evet, 21 Eylül sabah 2 dalış: Flying Fish + Neptün. 6 kişi kontenjan.',
    ago(7, 2),
  ),
  msg('g_kas_dive', 'u_lale', 'Geçen haftadan, görüş 30 m 🤿', ago(4, 9), {
    imageUrl: unsplash('1544551763-46a013bb70d5'),
  }),
  msg('g_kas_dive', 'u_zeynep', 'Muhteşem. Su sıcaklığı kaç?', ago(4, 8, 40)),
  msg('g_kas_dive', 'u_lale', 'Yüzeyde 27, 25 m’de 22. 5 mm yeterli.', ago(4, 8, 30)),
  msg('g_kas_dive', 'u_lale', 'Tekne buradan kalkıyor, liman girişi:', ago(0, 20), { coords: KAS }),
];

const zirveNews: GroupMessage[] = [
  sys('g_zirve_news', 'u_can', 'created', ago(10, 4)),
  msg(
    'g_zirve_news',
    'u_can',
    '📣 Zirve Duyurular kanalına hoş geldiniz! Burada uygulama güncellemelerini, topluluk etkinliklerini ve güvenlik uyarılarını paylaşacağız.',
    ago(10, 3),
  ),
  msg(
    'g_zirve_news',
    'u_elif',
    '🆕 Gruplar & kanallar yayında! Artık ekibinle rota, konum ve anket paylaşabilirsin. Geri bildirimlerinizi bekliyoruz.',
    ago(8, 9),
  ),
  msg(
    'g_zirve_news',
    'u_can',
    '⚠️ Güvenlik: Aladağlar bölgesinde bu hafta yoğun sağanak bekleniyor. Kanyon rotalarını erteleyin.',
    ago(6, 7),
  ),
  msg(
    'g_zirve_news',
    'u_elif',
    'Topluluk buluşması 📍 İstanbul, 28 Eylül. Kayıt bağlantısı yakında.',
    ago(5, 11),
    { imageUrl: unsplash('1519681393784-d120267933ba') },
  ),
  msg('g_zirve_news', 'u_can', 'Bir sonraki topluluk yürüyüşü nerede olsun?', ago(3, 10), {
    poll: {
      question: 'Ekim topluluk yürüyüşü nerede olsun?',
      multi: true,
      options: [
        opt('o1', 'Likya Yolu (Fethiye)', 312),
        opt('o2', 'Kaçkarlar (Rize)', 198),
        opt('o3', 'Aladağlar (Niğde)', 146),
        opt('o4', 'Bolu Yedigöller', 221),
      ],
    },
  }),
  msg(
    'g_zirve_news',
    'u_elif',
    '🛰 Uydu mesajlaşma eklentisi artık Pro Guide planında. Kapsama dışı bölgelerde SOS ve konum paylaşımı.',
    ago(2, 8),
  ),
  msg(
    'g_zirve_news',
    'u_can',
    '📊 Bu hafta 1.240 yeni rota paylaşıldı, 86 tehlike bildirimi doğrulandı. Teşekkürler topluluk!',
    ago(1, 9),
  ),
  msg(
    'g_zirve_news',
    'u_can',
    '🔧 Sürüm 1.3: sohbetlerde yanıtlama ve sabitleme, kanal bildirimleri, karanlık mod iyileştirmeleri.',
    ago(0, 7),
  ),
  msg(
    'g_zirve_news',
    'u_elif',
    'Hafta sonu hava: Marmara güneşli, Karadeniz sağanak, Akdeniz 33°C. Suyunuzu alın 💧',
    ago(0, 1, 15),
  ),
];

const avalanche: GroupMessage[] = [
  sys('g_avalanche', 'u_mert', 'created', ago(10, 1)),
  msg(
    'g_avalanche',
    'u_mert',
    'Çığ Bülteni TR: Erciyes, Palandöken, Kaçkar ve Aladağlar için günlük tehlike seviyeleri. Ölçek 1 (düşük) – 5 (çok yüksek).',
    ago(9, 23),
  ),
  msg(
    'g_avalanche',
    'u_mert',
    '❄️ Erciyes — Seviye 2 (orta). Kuzey yamaçlarda rüzgâr plakası. 2.800 m üzeri dikkat.',
    ago(6, 8),
  ),
  msg(
    'g_avalanche',
    'u_mert',
    '❄️ Palandöken — Seviye 1 (düşük). Kar örtüsü stabil, taban 40 cm.',
    ago(5, 8),
  ),
  msg(
    'g_avalanche',
    'u_mert',
    '⚠️ Kaçkar — Seviye 3 (belirgin). Son 24 saatte 35 cm taze kar + güneybatı rüzgârı. Kuzeydoğu yamaçlardan uzak durun.',
    ago(3, 8),
  ),
  msg(
    'g_avalanche',
    'u_mert',
    'Kar profili, Kavron üstü 3.000 m. 50 cm derinlikte zayıf tabaka.',
    ago(3, 7, 50),
    { imageUrl: unsplash('1483728642387-6c3bdd6c93e5') },
  ),
  msg(
    'g_avalanche',
    'u_mert',
    '❄️ Aladağlar — Seviye 2 (orta). Kanyon tabanlarında ıslak çığ riski öğleden sonra artar.',
    ago(1, 8),
  ),
  msg(
    'g_avalanche',
    'u_mert',
    'Hafta sonu özeti: Erciyes 2, Palandöken 1, Kaçkar 3→2 (düşüş), Aladağlar 2. Güvenli kayışlar!',
    ago(0, 8),
  ),
];

const oludeniz: GroupMessage[] = [
  sys('g_oludeniz', 'u_nil', 'created', ago(9, 12)),
  msg(
    'g_oludeniz',
    'u_nil',
    'Babadağ 1.700 m kalkış açıldı, rüzgâr 12 km/s batı. Bugün uçuş var!',
    ago(9, 8),
  ),
  msg(
    'g_oludeniz',
    'u_lale',
    'Kalkıştan sonra yürüyüş yapmak isteyenler için Likya parkuru başlangıcı:',
    ago(8, 9),
    {
      routeId: 'r_likya',
    },
  ),
  msg('g_oludeniz', 'u_ayse', 'Tandem için ilk kez geleceğim, hangi saat en sakin?', ago(5, 6)),
  msg('g_oludeniz', 'u_nil', 'Sabah 08:00–10:00 arası termik az, en yumuşak uçuş.', ago(5, 5, 50), {
    replyToId: 'gm_oludeniz_4',
  }),
  msg('g_oludeniz', 'u_lale', 'Bugünden, 1.900 m kalkış 🪂', ago(4, 13), {
    imageUrl: unsplash('1469474968028-56623f02e42e'),
  }),
  msg('g_oludeniz', 'u_ayse', 'Nefes kesici 😍', ago(4, 12, 55)),
  msg(
    'g_oludeniz',
    'u_nil',
    'Yarın 14:00 sonrası rüzgâr 25 km/s’ye çıkıyor, öğleden sonra uçuş yok.',
    ago(1, 16),
  ),
  msg('g_oludeniz', 'u_nil', 'İniş alanı, plaj kuzey ucu:', ago(0, 10), { coords: OLUDENIZ }),
  msg(
    'g_oludeniz',
    'u_lale',
    'Fethiye’den 07:00 servisinde 3 boş yer var, isteyen yazsın.',
    ago(0, 3),
  ),
];

const gearSwap: GroupMessage[] = [
  sys('g_gear_swap', 'u_baris', 'created', ago(9, 0)),
  msg(
    'g_gear_swap',
    'u_baris',
    'Kurallar: fotoğraf + durum + şehir. Para yok, takas var. Kargo masrafı alıcıya.',
    ago(8, 22),
  ),
  msg(
    'g_gear_swap',
    'u_mert',
    'TAKAS: MSR Hubba 2 kişilik çadır, 2 sezon kullanıldı, Ankara. Karşılığında -10°C tulum arıyorum.',
    ago(8, 10),
    { imageUrl: unsplash('1517649763962-0c623066013b') },
  ),
  msg(
    'g_gear_swap',
    'u_emre',
    'Deuter Aircontact 65+10, çok temiz. Kaya ayakkabısı 42 numara ile takas olur.',
    ago(7, 6),
  ),
  msg('g_gear_swap', 'u_can', '@emre.sahin La Sportiva 42 var bende, DM atıyorum.', ago(7, 5, 30), {
    replyToId: 'gm_gear_swap_4',
  }),
  msg(
    'g_gear_swap',
    'u_selin',
    'Kask arıyorum (Petzl/BD), karşılığında kramponum var.',
    ago(5, 12),
  ),
  msg(
    'g_gear_swap',
    'u_baris',
    'Trekking batonu çifti (Leki), az kullanıldı. Kafa lambası ile takas.',
    ago(4, 3),
    { imageUrl: unsplash('1433086966358-54859d0ed716') },
  ),
  msg('g_gear_swap', 'u_mert', 'Çadır takası tamamlandı, teşekkürler @nil.erdem 🙌', ago(3, 9)),
  msg('g_gear_swap', 'u_emre', 'Kaya ayakkabısı geldi, tam oldu. Grup çalışıyor 👏', ago(2, 15)),
  msg('g_gear_swap', 'u_selin', 'Kask hâlâ arıyorum, Antalya’ya kargo olur.', ago(1, 10)),
  msg(
    'g_gear_swap',
    'u_can',
    'Sıfır Jetboil Flash var, karşılığında 30 L günlük çanta.',
    ago(0, 8),
  ),
  msg(
    'g_gear_swap',
    'u_baris',
    'Hatırlatma: ilan 7 gün sonra silinir, tamamlananı yazın.',
    ago(0, 2),
  ),
];

const kapadokya: GroupMessage[] = [
  sys('g_kapadokya_bike', 'u_ayse', 'created', ago(8, 10)),
  msg(
    'g_kapadokya_bike',
    'u_ayse',
    'Cumartesi 07:00 Göreme meydan, 62 km gravel. Ortalama 18 km/s, 2 mola.',
    ago(8, 8),
  ),
  msg('g_kapadokya_bike', 'u_ayse', 'Rota burada, GPX indirip yükleyebilirsiniz.', ago(8, 7, 50), {
    routeId: 'r_kapadokya',
  }),
  msg('g_kapadokya_bike', 'u_kerem', 'Lastik önerisi? 40 mm yeterli mi?', ago(7, 5)),
  msg(
    'g_kapadokya_bike',
    'u_ayse',
    '40 mm ideal, tüf toprak kuru olunca kayıyor; basıncı düşük tutun.',
    ago(7, 4, 45),
    {
      replyToId: 'gm_kapadokya_bike_4',
    },
  ),
  msg(
    'g_kapadokya_bike',
    'u_elif',
    'Ben de katılıyorum, bisiklet kiralayabileceğim yer var mı?',
    ago(5, 9),
  ),
  msg('g_kapadokya_bike', 'u_kerem', 'Meydandaki dükkânda gravel var, 600 TL/gün.', ago(5, 8, 50)),
  msg('g_kapadokya_bike', 'u_ayse', 'Geçen hafta Kızılçukur inişi 🚵', ago(3, 12), {
    imageUrl: unsplash('1472214103451-9374bd1c798e'),
  }),
  msg('g_kapadokya_bike', 'u_ayse', 'Buluşma noktası:', ago(1, 7), { coords: GOREME }),
  msg('g_kapadokya_bike', 'u_elif', 'Cumartesi hava 24°C, rüzgâr hafif. Görüşürüz!', ago(0, 11)),
];

const metu: GroupMessage[] = [
  sys('g_metu', 'u_emre', 'created', ago(10, 3)),
  msg(
    'g_metu',
    'u_emre',
    'Güz dönemi temel kaya eğitimi 5 Ekim’de başlıyor. Kayıt için yönetime yazın.',
    ago(9, 5),
  ),
  msg(
    'g_metu',
    'u_ayse',
    'Malzeme deposu envanteri güncellendi: 12 kask, 8 emniyet kemeri, 4 ip (60 m).',
    ago(8, 6),
  ),
  msg(
    'g_metu',
    'u_mert',
    'Hafta sonu Karagöl kampı için 6 kişi yazıldı, 4 yer daha var.',
    ago(6, 9),
  ),
  msg(
    'g_metu',
    'u_emre',
    'Karagöl: cumartesi 07:00 Devrim otoparkı. Kulüp minibüsü ayarlandı.',
    ago(5, 8),
  ),
  msg(
    'g_metu',
    'u_ayse',
    'Kamp için ödünç alınan malzemeler pazartesi 17:00’ye kadar depoya dönmeli.',
    ago(3, 10),
  ),
  msg('g_metu', 'u_mert', 'Karagöl’den kare 🏕', ago(2, 18), {
    imageUrl: unsplash('1454496522488-7a8e488e8606'),
  }),
  msg(
    'g_metu',
    'u_emre',
    'Bu hafta genel kurul: perşembe 18:00, Kültür Kongre Merkezi B salonu.',
    ago(0, 12),
  ),
];

const ebc: GroupMessage[] = [
  sys('g_ebc', 'u_zeynep', 'created', ago(7, 15)),
  sys('g_ebc', 'u_me', 'joined', ago(7, 10)),
  msg(
    'g_ebc',
    'u_zeynep',
    'EBC Ekim ekibi! Program: 12 Ekim İstanbul→Katmandu, 14 Ekim Lukla, 22 Ekim Base Camp, 27 Ekim dönüş. Toplam 16 gün.',
    ago(7, 9),
  ),
  msg(
    'g_ebc',
    'u_can',
    'Sigorta: 6.000 m’ye kadar kapsayan helikopter tahliyeli poliçe şart. Öneri listesi hazırlıyorum.',
    ago(7, 8, 30),
  ),
  msg('g_ebc', 'u_me', 'Aklimatizasyon planı için Namche’de 2 gece kalıyor muyuz?', ago(6, 20)),
  msg(
    'g_ebc',
    'u_zeynep',
    'Evet, Namche 2 gece + Dingboche 2 gece. Klasik ve güvenli plan.',
    ago(6, 19, 50),
    {
      replyToId: 'gm_ebc_5',
    },
  ),
  msg('g_ebc', 'u_lale', 'Diamox kullanacak olan var mı? Doktora danışıp yazayım.', ago(5, 14)),
  msg(
    'g_ebc',
    'u_kerem',
    'Ben geçen sefer kullandım, 125 mg akşam iyi geldi. Ama doktor onayı şart.',
    ago(5, 13, 40),
  ),
  msg('g_ebc', 'u_can', 'Lukla havalimanı, dünyanın en kısa pisti 😬', ago(4, 11), {
    coords: LUKLA,
  }),
  msg(
    'g_ebc',
    'u_zeynep',
    'Bütçe taslağı: uçuş 900$, izinler 80$, lodge+yemek 25$/gün, rehber+hamal 30$/gün. Toplam ~2.100$.',
    ago(3, 10),
  ),
  msg('g_ebc', 'u_me', 'Uçuş biletlerini bu hafta alalım mı, fiyat artıyor.', ago(2, 9)),
  msg(
    'g_ebc',
    'u_zeynep',
    'Grup bileti için perşembe son gün. Herkes pasaport bilgisini bana DM atsın.',
    ago(2, 8, 45),
    { replyToId: 'gm_ebc_11' },
  ),
  msg('g_ebc', 'u_kerem', 'Geçen yıl Gorak Shep’ten Kala Patthar ☀️', ago(1, 8), {
    imageUrl: unsplash('1506905925346-21bda4d32df4'),
  }),
  msg(
    'g_ebc',
    'u_lale',
    'Ekipman listesini bu akşam paylaşıyorum, -15°C tulum şart.',
    ago(0, 1, 5),
  ),
];

const trail: GroupMessage[] = [
  sys('g_trail', 'u_kerem', 'created', ago(9, 8)),
  msg(
    'g_trail',
    'u_kerem',
    'Takvim: Kaçkar Ultra 15 Eylül, İznik Ultra 5 Ekim, Kapadokya Ultra 19 Ekim. Kim nerede?',
    ago(9, 6),
  ),
  msg(
    'g_trail',
    'u_nil',
    'Kapadokya 63K’dayım. Antrenman planı paylaşan olursa sevinirim.',
    ago(8, 7),
  ),
  msg('g_trail', 'u_selin', 'İznik 43K ilk ultra denemem 🙈', ago(7, 9)),
  msg(
    'g_trail',
    'u_kerem',
    'Süper! Haftada 3 koşu + 1 uzun tırmanışlı yürüyüş yeter.',
    ago(7, 8, 40),
    {
      replyToId: 'gm_trail_4',
    },
  ),
  msg('g_trail', 'u_baris', 'Yelek önerisi? Salomon ADV 12 mi, 5 mi?', ago(4, 10)),
  msg('g_trail', 'u_nil', 'Ultra için 12, zorunlu malzeme sığıyor.', ago(4, 9, 50)),
  msg('g_trail', 'u_selin', 'Bugün 22 km, 1.100 m tırmanış. Bacaklar bitti 😅', ago(2, 17), {
    imageUrl: unsplash('1470071459604-3b5ec3a7fe05'),
  }),
  msg('g_trail', 'u_kerem', 'Tempo değil, süre önemli. Aferin!', ago(2, 16, 50)),
  msg('g_trail', 'u_baris', 'Kaçkar Ultra kayıtları kapanıyor, son 2 gün.', ago(0, 6)),
];

export const seedGroupMessages: GroupMessage[] = [
  ...kackar,
  ...istHike,
  ...antalya,
  ...kas,
  ...zirveNews,
  ...avalanche,
  ...oludeniz,
  ...gearSwap,
  ...kapadokya,
  ...metu,
  ...ebc,
  ...trail,
];

/** Grupların `lastMessageAt` alanını mesajlardan türet. */
for (const g of seedGroups) {
  const last = seedGroupMessages
    .filter((m) => m.groupId === g.id)
    .reduce<string | null>(
      (acc, m) => (acc && new Date(acc) > new Date(m.createdAt) ? acc : m.createdAt),
      null,
    );
  g.lastMessageAt = last;
}

/* ------------------------------------------------------------------ */
/* Anket oyları                                                        */
/* ------------------------------------------------------------------ */

const kackarPoll = kackar.find((m) => m.type === 'poll')?.id ?? 'gm_kackar_19';
const newsPoll = zirveNews.find((m) => m.type === 'poll')?.id ?? 'gm_zirve_news_6';

export const seedPollVotes: { userId: string; messageId: string; optionIds: string[] }[] = [
  { userId: 'u_elif', messageId: kackarPoll, optionIds: ['o1'] },
  { userId: 'u_can', messageId: kackarPoll, optionIds: ['o1'] },
  { userId: 'u_zeynep', messageId: kackarPoll, optionIds: ['o2'] },
  { userId: 'u_mert', messageId: kackarPoll, optionIds: ['o1'] },
  { userId: 'u_baris', messageId: kackarPoll, optionIds: ['o1'] },
  { userId: 'u_me', messageId: kackarPoll, optionIds: ['o2'] },
  { userId: 'u_elif', messageId: newsPoll, optionIds: ['o1', 'o4'] },
  { userId: 'u_kerem', messageId: newsPoll, optionIds: ['o2'] },
  { userId: 'u_mert', messageId: newsPoll, optionIds: ['o1', 'o3'] },
];
