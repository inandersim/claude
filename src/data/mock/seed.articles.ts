import {
  readMinutes,
  slugifyTitle,
  type AdventureType,
  type Article,
  type ArticleCategory,
  type ArticleComment,
  type ArticleStatus,
  type WriterProfile,
} from '@/domain';

import { CURRENT_USER_ID } from './seed';

/**
 * Yazarlar & blog demo verisi. Yazılar gerçek uzunlukta (2.500–5.000 karakter) ve
 * basit markdown ile yazılmıştır; kural/ücret bilgileri 2026 itibarıyla
 * yaklaşıktır, güncel kaynaklara bakın.
 */

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

/* ------------------------------------------------------------------ */
/* Yazarlar                                                            */
/* ------------------------------------------------------------------ */

export const seedWriters: WriterProfile[] = [
  {
    userId: 'u_elif',
    penName: 'Elif Doğan — Himalaya günlükleri',
    bio: 'On yıldır yüksek irtifa trekking yapıyorum; Nepal, Ladakh ve Patagonya notlarımı gün gün yazıyorum. Yalnız seyahat eden kadınlar için pratik bilgiler öncelikli.',
    languages: ['tr', 'en'],
    topics: ['trip_report', 'culture', 'guide'],
    website: 'https://himalayagunlukleri.com',
    isVerified: true,
    followerCount: 4820,
    articleCount: 3,
    appliedAt: daysAgo(420),
    approvedAt: daysAgo(415),
  },
  {
    userId: 'u_baris',
    penName: 'Barış Çelik · Dağ fotoğrafçısı',
    bio: 'Drone ve dağ fotoğrafı üzerine çalışıyorum. SHGM kuralları, pozlama ve altın saat üstüne tekniği herkesin anlayacağı dille anlatmaya çalışıyorum.',
    languages: ['tr'],
    topics: ['photography', 'guide'],
    website: 'https://bariscelik.photo',
    isVerified: true,
    followerCount: 2210,
    articleCount: 3,
    appliedAt: daysAgo(300),
    approvedAt: daysAgo(296),
  },
  {
    userId: 'u_zeynep',
    penName: 'Zeynep Aksoy — Mavi derinlik',
    bio: 'PADI Divemaster. Kaş ve Akdeniz dalış noktaları, ekipman bakımı ve dalış güvenliği üzerine yazıyorum.',
    languages: ['tr', 'en'],
    topics: ['guide', 'safety'],
    website: null,
    isVerified: false,
    followerCount: 1340,
    articleCount: 1,
    appliedAt: daysAgo(210),
    approvedAt: daysAgo(205),
  },
  {
    userId: 'u_kerem',
    penName: 'Kerem Aydın · Kaya günlüğü',
    bio: 'Geyikbayırı ve Datça kayalarında beş yıl. Sportif tırmanışta seviye atlama, antrenman planı ve zihinsel hazırlık üstüne yazacağım.',
    languages: ['tr'],
    topics: ['trip_report', 'guide'],
    website: null,
    isVerified: false,
    followerCount: 0,
    articleCount: 0,
    appliedAt: daysAgo(3),
    approvedAt: null,
  },
  {
    userId: 'u_lale',
    penName: 'Lale Demir — Hafif sırt çantası',
    bio: 'Ultralight kamp ve uzun yürüyüşler. Ekipman listeleri gramıyla, rotalar gün gün. Likya Yolu, Kapadokya ve Karadeniz yaylaları ana saham.',
    languages: ['tr', 'en'],
    topics: ['gear', 'trip_report'],
    website: 'https://hafifsirtcantasi.com',
    isVerified: true,
    followerCount: 3675,
    articleCount: 3,
    appliedAt: daysAgo(380),
    approvedAt: daysAgo(376),
  },
  {
    userId: 'u_can',
    penName: 'Can Yıldırım · Dağ rehberi',
    bio: 'IFMGA aday rehber, TDF eğitmeni. Çığ, kış geçişleri, yüksek irtifa güvenliği ve porter hakları üzerine yazıyorum. Amaç: dağdan herkes dönsün.',
    languages: ['tr', 'en', 'de'],
    topics: ['safety', 'opinion', 'gear'],
    website: null,
    isVerified: true,
    followerCount: 6120,
    articleCount: 4,
    appliedAt: daysAgo(500),
    approvedAt: daysAgo(498),
  },
];

export const seedWriterFollows: { followerId: string; writerUserId: string }[] = [
  { followerId: CURRENT_USER_ID, writerUserId: 'u_elif' },
  { followerId: CURRENT_USER_ID, writerUserId: 'u_can' },
  { followerId: 'u_mert', writerUserId: 'u_elif' },
  { followerId: 'u_selin', writerUserId: 'u_elif' },
  { followerId: 'u_ayse', writerUserId: 'u_lale' },
  { followerId: 'u_emre', writerUserId: 'u_can' },
  { followerId: 'u_nil', writerUserId: 'u_baris' },
  { followerId: 'u_zeynep', writerUserId: 'u_can' },
  { followerId: 'u_kerem', writerUserId: 'u_baris' },
  { followerId: 'u_lale', writerUserId: 'u_elif' },
];

/* ------------------------------------------------------------------ */
/* Yazılar                                                             */
/* ------------------------------------------------------------------ */

interface ArticleInput {
  id: string;
  authorId: string;
  title: string;
  subtitle: string;
  cover: string | null;
  category: ArticleCategory;
  body: string;
  tags: string[];
  destinationId?: string | null;
  countryCode?: string | null;
  adventureTypes: AdventureType[];
  status?: ArticleStatus;
  likes: number;
  comments: number;
  views: number;
  /** Kaç gün önce yayınlandı */
  daysAgo: number;
}

function article(i: ArticleInput): Article {
  const published = i.status !== 'draft';
  const publishedAt = daysAgo(i.daysAgo);
  return {
    id: i.id,
    authorId: i.authorId,
    slug: slugifyTitle(i.title),
    title: i.title,
    subtitle: i.subtitle,
    coverUrl: i.cover,
    category: i.category,
    body: i.body.trim(),
    tags: i.tags,
    destinationId: i.destinationId ?? null,
    countryCode: i.countryCode ?? null,
    adventureTypes: i.adventureTypes,
    readMinutes: readMinutes(i.body),
    status: i.status ?? 'published',
    likesCount: i.likes,
    commentsCount: i.comments,
    viewsCount: i.views,
    locale: 'tr',
    publishedAt: published ? publishedAt : null,
    createdAt: daysAgo(i.daysAgo + 2),
    updatedAt: published ? publishedAt : daysAgo(i.daysAgo),
  };
}

export const seedArticles: Article[] = [
  article({
    id: 'art_ebc_12',
    authorId: 'u_elif',
    title: "Everest Base Camp'te 12 gün: gün gün notlarım",
    subtitle:
      'Lukla uçuşundan Kala Patthar sabahına; aklimatizasyon, konaklama ve bütçe gerçekleri.',
    cover: unsplash('1544735716-392fe2489ffa'),
    category: 'trip_report',
    tags: ['everest', 'nepal', 'trekking', 'yüksek-irtifa', 'ebc'],
    destinationId: 'dest_ebc',
    countryCode: 'NP',
    adventureTypes: ['hiking'],
    status: 'featured',
    likes: 412,
    comments: 5,
    views: 9830,
    daysAgo: 21,
    body: `
Bu yazı bir "nasıl gidilir" rehberi değil; 12 günün her sabahı defterime yazdıklarımın temize çekilmiş hali. Yine de her günün sonuna irtifa, yürüyüş süresi ve o gün ne kadar harcadığımı ekledim, çünkü planlarken en çok bu bilgileri aramıştım.

# Hazırlık: Kathmandu'da iki gün

Thamel'de bir gün ekipman eksiklerini tamamlamaya yetiyor. Trekking izinleri (Sagarmatha Milli Parkı + Khumbu Pasang Lhamu belediye izni) toplam yaklaşık 5.000 NPR. TIMS kartı bu bölgede istenmiyor. Lukla uçuşları sabah 06:00–09:00 arasında kalkıyor; öğleden sonra bulut kapatınca iptal olma ihtimali yüksek. Ramechhap'tan kalkış olursa gece 02:00'de Kathmandu'dan minibüse binmeniz gerekiyor — buna hazırlıklı olun.

## 1. gün — Lukla (2.860 m) → Phakding (2.610 m)

Kısa ve rahat bir gün; 3 saat. Dudh Koshi nehri boyunca asma köprüler. İlk günü kısa tutmak bilinçli: uçuş yorgunluğu ve irtifa şoku birleşmesin. Konaklama 500 NPR, akşam yemeği dal bhat 650 NPR.

## 2. gün — Namche Bazaar (3.440 m)

Günün tamamı tırmanış, özellikle Hillary köprüsünden sonraki iki saat. Namche'ye vardığımda nabzım 100'ün üzerindeydi ve hafif baş ağrısı vardı. Bol su ve ılık çorba; ağrı kesiciye ihtiyaç duymadım.

## 3. gün — Aklimatizasyon: Everest View Hotel (3.880 m)

"Yüksekte yürü, alçakta uyu" kuralının ilk uygulaması. Everest'i ilk kez buradan gördüm; Lhotse ve Ama Dablam'ın yanında ufacık görünüyor, ama biliyorsunuz işte.

## 4–5. gün — Tengboche (3.860 m) ve Dingboche (4.410 m)

Tengboche manastırının sabah ayinine 06:00'da katıldım; fotoğraf çekmek yasak, sadece oturup dinlemek serbest. Dingboche'de hava belirgin biçimde soğuyor; gece sıcaklığı -8 °C ölçtüm. Odalarda ısıtma yok, yemek salonundaki yak tezeği sobası akşam 19:00'da yakılıyor.

## 6. gün — Aklimatizasyon: Nangkartshang tepesi (5.083 m)

Bu günü atlamayın. Grubumuzdaki iki kişi "iyiyim" diyerek doğrudan Lobuche'ye devam etti; ikisi de Gorak Shep'ten helikopterle indi. AMS belirtilerini gizlemenin kimseye faydası yok.

## 7. gün — Lobuche (4.940 m)

Thukla geçidindeki anıtlar — Scott Fischer, Babu Chiri Sherpa — insanı susturuyor. Buradan sonra bitki örtüsü tamamen bitiyor.

## 8. gün — Gorak Shep (5.164 m) ve Base Camp (5.364 m)

Sabah Gorak Shep'e 3 saat, öğleden sonra Base Camp'e gidiş-dönüş 4 saat. Khumbu buzulunun kenarında yürümek şaşırtıcı: buz üstünde kaya ve kum, ara sıra çatırtı. Sezon dışıydı, kamp boştu.

## 9. gün — Kala Patthar (5.545 m) sabahı

04:30'da çıkış, -18 °C. Everest'in gün doğumunda turuncuya dönmesini izlemek için 90 dakika tırmanış. Parmaklarımı hissetmediğim tek gün buydu; el ısıtıcı paketleri buraya saklayın.

## 10–12. gün — İniş

Pheriche (HRA kliniğine uğrayın, ücretsiz irtifa bilgilendirmesi var), Namche ve Lukla. İniş üç günde bitiyor ama dizler sonraki bir hafta bunu hatırlatıyor.

> Toplam harcama, Kathmandu–Lukla uçuşu hariç 12 gün için yaklaşık 58.000 NPR (konaklama + yemek + içecek). Su için filtre götürdüm; şişe su Gorak Shep'te 500 NPR.

# Keşke bilseydim dediklerim

- Diamox'u doktorunuzla önceden konuşun; ben 125 mg ile başladım ve karıncalanma dışında sorun yaşamadım.
- Güneş kremi SPF 50 ve dudak koruyucu: 4.000 m üstünde bir günde yanıyorsunuz.
- Nakit: Namche'den sonra ATM yok, kartla ödeme yok.
- Şarj ücretli (saat başı 300–500 NPR); güneş paneli küçük ama işe yaradı.
- Lodge'larda Wi-Fi Everest Link kartı ile: 10 GB 3.000 NPR, Gorak Shep'te bile çalıştı.

Sorularınız varsa yorumlara yazın; sonraki yazı Annapurna Devresi'ni EBC ile karşılaştıracak.
`,
  }),

  article({
    id: 'art_kackar_kis',
    authorId: 'u_can',
    title: "Kaçkar'da kış geçişi: ekipman listesi ve hatalarım",
    subtitle:
      'Yukarı Kavron–Ayder hattında dört günlük kış geçişi; işe yarayanlar, işe yaramayanlar.',
    cover: unsplash('1464822759023-fed622ff2c3b'),
    category: 'gear',
    tags: ['kaçkar', 'kış', 'ekipman', 'kar-ayakkabısı', 'çığ'],
    destinationId: 'dest_kackar',
    countryCode: 'TR',
    adventureTypes: ['hiking', 'skiing'],
    likes: 238,
    comments: 3,
    views: 4210,
    daysAgo: 34,
    body: `
Kaçkarlar kışın tamamen başka bir dağ. Yazın çay bahçelerinden geçtiğiniz patikalar üç metre karın altında, yaylalar terk edilmiş, hava bir saatte açıktan kapalıya dönebiliyor. Bu yazıda Şubat ayında Yukarı Kavron'dan Ayder'e dört günde yaptığımız geçişin ekipman listesini ve yaptığım üç ciddi hatayı paylaşıyorum.

# Rota ve koşullar

Yukarı Kavron (2.300 m) – Dilberdüzü – Deniz Gölü altı – Çaymakçur – Ayder. Gündüz -4 ile -12 °C arası, gece -20 °C'ye kadar. Kar derinliği düzlüklerde 2 m, rüzgar tarafı yamaçlarda taşıma kar. Çığ bülteni (Meteoroloji + kendi gözlemimiz) 3. gün "kayda değer (3)" seviyesindeydi; rotayı o gün gölge yamaçlardan uzak tuttuk.

# Ekipman listesi (gramıyla)

## Giyim

- Merino içlik 200 g/m², üst ve alt (360 g)
- Polar orta katman (Polartec 200) (410 g)
- Sentetik dolgulu ceket — kampta ve molalarda (620 g)
- Hardshell 3 katmanlı, koltuk altı havalandırmalı (480 g)
- Softshell pantolon + hardshell tozluk (yağış varsa) (910 g)
- İki çift eldiven: ince yün astar + su geçirmez dış (240 g)
- Balaclava, gözlük (kategori 4) ve kar gözlüğü (ikisi de şart)

## Hareket

- Kar ayakkabısı 25 inç, ısıtma çubuklu (1.980 g çift)
- Teleskopik baton, geniş kar tablasıyla (520 g)
- Tırmanma kazması 60 cm — dik yamaçlarda güvenlik için (450 g)
- Çığ üçlüsü: transceiver, sonda 240 cm, kürek (1.020 g). Bunlar olmadan kışın Kaçkar'a çıkılmaz.

## Kamp

- 4 mevsim çadır, kar etekli (2.900 g / 2 kişi)
- -25 °C konfor uyku tulumu, kaz tüyü 850 fp (1.480 g)
- İki mat: kapalı hücreli köpük + şişme R 5,5 (1.050 g)
- Benzinli ocak — kartuşlu ocaklar -15 °C'de verim düşürüyor (620 g + yakıt 900 ml)

Toplam sırt çantası ağırlığım yiyecek ve su ile 21 kg oldu. Kar ayakkabısıyla bu ağırlık taşınıyor ama 25 kg üstü günlük mesafeyi ciddi düşürür.

# Yaptığım hatalar

## 1. Kar ayakkabısını kışın ilk defa o gün taktım

Hazırlık yürüyüşü yapmadım. İlk gün iki kez düşüp bilekten zorlanınca anladım: kar ayakkabısı yürüyüş, yürüyüş değildir. En azından bir gün alçakta pratik yapın.

## 2. Su planlaması

"Karı eritirim" dedim; benzinli ocakla 1 litre su için 12–15 dakika ve ciddi yakıt. Termosu sabah doldurup gün boyu ılık içmek çok daha verimli. İkinci günden sonra sabah 1,5 L eritip termoslara paylaştırdık.

## 3. Elektronik

Telefon -15 °C'de yüzde 60'tan sıfıra beş dakikada indi. GPS saat ve telefon iç cebe, powerbank uyku tulumuna. Kâğıt harita ve pusula her zaman.

> Kış geçişlerinde en önemli ekipman, geri dönmeye karar verebilen kafadır. 3. gün öğleden sonra kar yağışı başladığında planı kısaltıp Çaymakçur'da beklemek en doğru karardı; "az kaldı" hissine kapılmayın.

# Son notlar

Bölgede kış operasyonu yapan yerel rehberler var; ilk kış geçişinizi rehberle yapın. Ayder'de jandarma karakoluna rota bildirimi yapmanız istenmese de yapın. Ve lütfen çığ eğitimi almadan kış dağına çıkmayın — bir sonraki yazımda çığ tehlikesini nasıl okuyacağınızı anlatacağım.
`,
  }),

  article({
    id: 'art_kas_dalis',
    authorId: 'u_zeynep',
    title: "Kaş'ta ilk 10 dalış noktası",
    subtitle:
      'Yeni sertifikalı dalgıçlar için derinlik, akıntı ve görünürlük notlarıyla nokta rehberi.',
    cover: unsplash('1544551763-46a013bb70d5'),
    category: 'guide',
    tags: ['kaş', 'dalış', 'akdeniz', 'batık', 'scuba'],
    destinationId: 'dest_kas',
    countryCode: 'TR',
    adventureTypes: ['diving'],
    status: 'featured',
    likes: 356,
    comments: 3,
    views: 7120,
    daysAgo: 12,
    body: `
Kaş, Türkiye'de en çok dalış merkezi olan kasaba ve haklı olarak. Görünürlük 25–40 m, su Mayıs–Kasım arası 20 °C üstünde, batıklar, resifler, duvarlar ve mağaralar bir yarım günlük tekne mesafesinde. Bu listeyi yeni Open Water almış birine "hangi sırayla dalayım?" diye sorsa verirdim; kolaydan zora doğru gidiyor.

# Başlamadan önce

Kaş'ta dalışlar tekne ile yapılır; çoğu merkez sabah 09:00 çıkış, iki dalış, 15:00 dönüş şeklinde çalışır. Ekipman kirası genellikle fiyata dahil. Fiyatlar 2026 itibarıyla iki dalış + ekipman için 2.400–3.200 TL arasında. Mevsim: Eylül–Ekim su hâlâ sıcak ve kalabalık az; en iyi zaman.

# Noktalar

## 1. Güvercin Adası (8–18 m)

İlk dalış için ideal: korunaklı, akıntısız, kumluk tabanla kayalık geçişi. Kum üzerinde vatoz görme ihtimali yüksek.

## 2. Flying Fish Resifi (12–20 m)

Kayalık bir sırt boyunca ilerlersiniz; orfoz, papağan balığı ve müren. Yüzerlik kontrolü pratik etmek için mükemmel.

## 3. Uçak Batığı (14–22 m)

Dalış için özellikle batırılmış bir eğitim uçağı (Dakota). Deniz tabanına oturmuş, penetrasyon eğitim gerektirmiyor; kabin boş. Görünürlük burada genellikle 30 m üstü.

## 4. Neptün Resifi (12–28 m)

Kaş'ın en canlı resifi. Süngerler, akya sürüleri, ara sıra deniz kaplumbağası. Derinliği 18 m'de tutup uzun dip zamanı yapabilirsiniz.

## 5. Dimitri Batığı (10–24 m)

Toplam 40 m uzunluğunda yük gemisi. Advanced sertifikalı olmasanız da üstünden ve yanından dalış yapabilirsiniz; içine girmek için batık uzmanlığı şart.

## 6. Kanyon (18–30 m)

İki kaya duvarı arasından geçen dar bir kanyon, ışık oyunları harika. Hafif akıntı olabilir; Advanced önerilir.

## 7. Şehit Alanı / Kaş Duvarı (20–40 m)

Dikey duvar, aşağısı mavi boşluk. Derinlik kontrolü konusunda disiplinli olmayan dalgıç için tehlikeli. Nitrox burada işe yarar.

## 8. Mavi Mağara (14–20 m)

Girişi geniş bir mağara, içeride yüzeye çıkılabilen hava cebi. Fener şart; toz kaldırmamak için yüzerlik önemli.

## 9. Sarı Mağara (18–26 m)

Sarı süngerlerle kaplı tavan, dışarıdan gelen ışıkla görsel şölen. Sadece tecrübeli rehberle.

## 10. Pınarbaşı / Tank Batığı (12–30 m)

Hem sığda bir tank hem derinde teknelerin yanaştığı bir duvar; iki dalışa değer.

# Güvenlik hatırlatmaları

- Kaş'ın en yakın basınç odası Antalya'da; ~3 saat. Emniyet duruşunu asla atlamayın.
- Sabah ikinci dalışta çoğu kişi hesaplamayı gevşetiyor; dalış bilgisayarınıza güvenin, arkadaşınızınkine değil.
- Kulak eşitlemede zorlanıyorsanız Neptün ve Kanyon'u sonraya bırakın; iniş ipiyle yavaş inebileceğiniz noktalar önce.

> Kaş'ta dalış merkezi seçerken küçük grup (rehber başına 4 dalgıç) ve kaptanın oksijen kiti taşıyıp taşımadığını sorun. İkisini de "evet" diyen yerlere gidin.

Kaş bittiğinde Kalkan, Kekova ve Fethiye sizi bekliyor; bir sonraki yazıda Kekova'daki batık şehir sınırlarını ve nerede dalınabileceğini yazacağım.
`,
  }),

  article({
    id: 'art_geyik_7a',
    authorId: 'u_kerem',
    title: "Geyikbayırı'nda 6a'dan 7a'ya: bir kış sezonunun antrenman notları",
    subtitle: 'On iki haftada iki derece atlamak için neyi değiştirdim, neyi değiştirmedim.',
    cover: unsplash('1522163182402-834f871fd851'),
    category: 'trip_report',
    tags: ['geyikbayırı', 'sportif-tırmanış', 'antrenman', 'antalya'],
    countryCode: 'TR',
    adventureTypes: ['climbing'],
    status: 'draft',
    likes: 0,
    comments: 0,
    views: 0,
    daysAgo: 1,
    body: `
Bu yazı henüz taslak; sezon bittiğinde son halini yayınlayacağım. Şimdilik ana iskeleti paylaşıyorum.

# Başlangıç noktası

Kasım başında Geyikbayırı'na geldiğimde en iyi onsight derecem 6a, redpoint 6b+ idi. Hedef: Mart sonuna kadar bir 7a redpoint. Rutin: haftada 4 tırmanış günü, 2 dinlenme, 1 hafif koşu.

# Neyi değiştirdim

## Isınma

Eskiden iki 5+ tırmanıp projeye giriyordum. Şimdi 20 dakika mobilite, üç kolay rota (5+, 6a, 6a+) ve parmaklar için progresif yükleme. Sakatlık sıfır.

## Proje seçimi

Sektör Trebenna'da uzun, dayanıklılık isteyen 6c'ler; Sarkıt'ta kısa güç rotaları. İki tip proje aynı hafta içinde; birini bırakmak diğerini besledi.

## Zihinsel kısım

Düşme korkusu 6b+'ın üstündeki en büyük engelimdi. Her seansta bilinçli 3 düşüş yaptım. Üç hafta sonra "tırmanmak için" değil "düşmemek için" tırmanmayı bıraktım.

# Neyi değiştirmedim

- Ayakkabı: aynı çift, yeniden tabanlandı. Ekipman değişimi dereceyi taşımıyor.
- Uyku: 8 saat. Kampta erken yatmak kolay.
- Kahvaltı: JoSiTo'da simit ve zeytin; değişmesin.

# Haftalık kilometre taşları

- 1–3. hafta: hacim, 6a–6b arası her gün 8–10 rota.
- 4–6. hafta: 6c proje, iki tanesi redpoint.
- 7–9. hafta: ilk 7a denemeleri; boulder problemi çözülmüyor.
- 10–12. hafta: (yazılacak)

> Not: bu bölüm daha yazılmadı. Nisan başında güncelleyeceğim; kilit bölümü çözüp çözmediğimi merak edenler beklesin.

Ayrıca sezonun sonunda Geyikbayırı için başlangıç seviyesi sektör rehberi de eklemeyi planlıyorum: hangi sektör sabah gölgede, hangisi rüzgara kapalı, kamp alanlarının kış fiyatları gibi pratik bilgilerle. Şimdilik özet: Alabalık ve Trebenna sabah güneş alır, Sarkıt öğleden sonra; kış aylarında (Aralık–Şubat) öğle saatlerinde güneş alan sektörleri tercih edin, sabah çiy nedeniyle tutamaklar kaygan olabiliyor.

# Parmak sağlığı (taslak)

Sezon başında A2 makarasında hafif ağrı vardı; kinesyo bant ve iki hafta yalnızca açık tutuşla tırmanış sorunu çözdü. Kural olarak: kramp tutuşu yalnızca projede, ısınmada asla. Haftada iki gün 10 dakikalık parmak askısı (yüzde 70 yükle, 7 saniye asıl / 3 saniye dinlen) ekledim; üçüncü haftadan sonra 20 mm kenarda belirgin fark hissettim. Bu bölümü fizyoterapistle konuşup genişleteceğim.

# Kamp ve lojistik (taslak)

Geyikbayırı'nda kış kampı gece 2–5 °C; çadır yerine bungalov tutmak seansları daha verimli yapıyor çünkü ıslak ekipmanı kurutabiliyorsunuz. Antalya'dan Geyikbayırı dolmuşu günde üç sefer; araba kiralamak grup için daha ucuz. Market yok, Çakırlar'dan alışveriş. Dinlenme günlerinde Konyaaltı'nda yüzmek Şubat'ta bile mümkün (deniz 16 °C) ve toparlanmaya iyi geliyor.

- Yayınlamadan önce: 10–12. hafta özeti, sektör güneş tablosu, ısınma rotaları listesi.
`,
  }),

  article({
    id: 'art_ultralight',
    authorId: 'u_lale',
    title: "Ultralight kampçılık: 6 kg'ın altına inmek",
    subtitle: "Temel ağırlığı 11 kg'dan 5,8 kg'a indirdiğim üç yıl; her kalemin gerekçesi.",
    cover: unsplash('1478827387698-1527781a4887'),
    category: 'gear',
    tags: ['ultralight', 'kamp', 'ekipman', 'sırt-çantası', 'trekking'],
    adventureTypes: ['hiking'],
    likes: 298,
    comments: 2,
    views: 5640,
    daysAgo: 45,
    body: `
"Temel ağırlık" (base weight) yiyecek, su ve yakıt hariç sırtınızdaki her şeyin toplamıdır. Üç yıl önce Likya Yolu'nda 11 kg ile başladım; bugün üç mevsim listem 5,8 kg. Bu yazıda her kalemi neden değiştirdiğimi, nerede para harcamaya değdiğini ve nerede değmediğini anlatıyorum.

# Önce zihniyet

Ultralight bir alışveriş listesi değil, bir soru: "Bunu geçen yürüyüşte kaç kez kullandım?" Sıfır ise gitmez. Çoğu insan çantasını hafifletmek için pahalı ekipman alır; oysa ilk 3 kg, hiçbir şey satın almadan, sadece çıkararak gider.

# Büyük üçlü: çadır, tulum, çanta

## Barınak: 1.900 g → 620 g

Çift katlı serbest çadırdan batonla kurulan tek katlı DCF tarpa geçtim. Yoğuşma daha fazla, ama havalandırmayı öğrenince sorun olmuyor. Rüzgarlı yaylalarda etek kazıklarını iyi çakın.

## Uyku: 1.400 g → 720 g

Tulum yerine quilt (üstü açık yorgan tipi). Mat: R 4,2 şişme, 380 g. Kışa girmiyorum, bu yüzden -5 °C konfor yeterli. Soğukta ceketi bacaklara sarıyorum.

## Çanta: 2.100 g → 780 g

Çerçevesiz çanta ancak toplam 10 kg'ın altındaysa rahat; önce yükü düşürün, çantayı en son değiştirin. Aksi takdirde omuzlarınız sizi hafiflemekten soğutur.

# Mutfak: 900 g → 280 g

Titanyum kap 550 ml, küçük kartuşlu ocak (25 g), çakmak, uzun kaşık. Yemekler suyu kaynatıp beklemeye dayalı: bulgur, kuskus, hazır çorba, zeytinyağı küçük şişede. Kahveyi filtre poşetle demliyorum.

# Giyim: yedek almayın, katman alın

- Üstümde: merino tişört, yürüyüş şortu, çorap.
- Çantada: rüzgarlık (65 g), yağmurluk (180 g), ince puffy (240 g), ikinci çorap, uyku için ince içlik.
- Fazladan tişört, pantolon ya da "temiz kıyafet" yok. Akşam yıkayıp sabah giyiyorum.

# Küçük ama toplamda ağır kalemler

- Kafa lambası: 200 lümen, 45 g. Yedek pil yerine USB şarj.
- İlk yardım: kişisel ilaç, bandaj, sargı bezi, ağrı kesici, kene kaşığı; 90 g.
- Su: 1 L yumuşak şişe + squeeze filtre; 110 g. Şişe su taşımayı bıraktığım gün 1 kg gitti.
- Elektronik: telefon + 10.000 mAh powerbank + kablo. Kamera yok, telefon yetiyor.
- Hijyen: diş fırçası (kesilmiş), küçük sabun, mikrofiber havlu; 60 g.

> Ultralight'ın altın kuralı: her gram bir karar. Kararı verirken "ya lazım olursa" değil "ya lazım olmazsa" diye sorun.

# Nerede durdum

5 kg'ın altına inmek mümkün, ama bundan sonrası konfordan ve güvenlikten yiyor: matı inceltmek, ilk yardımı küçültmek, yağmurluğu poncho yapmak. Ben 5,8'de mutluyum. Kışın liste tamamen değişiyor; kar için ayrı bir yazı gelecek.

Listemin tam halini (gramıyla) web sitemde bulabilirsiniz. Sorularınızı yorumlara bırakın; en çok merak edileni sonraki yazıda ayrı ele alacağım.
`,
  }),

  article({
    id: 'art_nepal_kadin',
    authorId: 'u_elif',
    title: 'Yalnız kadın gezgin olarak Nepal',
    subtitle: "Kathmandu sokaklarından Langtang lodge'larına: güvenlik, kültür ve beklentiler.",
    cover: unsplash('1506905925346-21bda4d32df4'),
    category: 'culture',
    tags: ['nepal', 'yalnız-seyahat', 'kadın-gezgin', 'kültür', 'langtang'],
    destinationId: 'dest_langtang',
    countryCode: 'NP',
    adventureTypes: ['hiking'],
    likes: 384,
    comments: 2,
    views: 6410,
    daysAgo: 60,
    body: `
"Yalnız mı gidiyorsun?" Nepal'e her gidişimde havalimanından lodge'a kadar en az yirmi kez duyduğum soru. Cevabım evet, ve beş seyahat sonra hâlâ evet. Bu yazı korkutmak ya da "her şey güllük gülistanlık" demek için değil; nelerin gerçekten sorun olduğunu, nelerin abartıldığını anlatmak için.

# Kathmandu

Thamel gece 22:00'den sonra sessizleşir ama tehlikeli değildir. Taksi pazarlığını başlamadan yapın; havalimanı ön ödemeli taksi gişesi en güvenli seçenek. Kadınların tek başına yemek yediği lokantalar bol; kimse tuhaf bakmıyor. Omuzları ve dizleri kapatan giysiler tapınaklarda beklenir, sokakta kimse karışmaz ama kendinizi daha rahat hissedersiniz.

# Trekking'de yalnızlık

2023'ten beri Nepal Turizm Kurulu milli parklarda rehbersiz trekking'i yasakladı; uygulama bölgeye göre gevşek olsa da yalnız kadınlara rehber tutmalarını öneriyorum — güvenlik için değil, sohbet ve yerel bağlantı için. Kadın rehber isterseniz "3 Sisters Adventure Trekking" gibi kadın rehber yetiştiren kuruluşlar var; Pokhara merkezli.

## Lodge'larda

Odalar kilitli, çoğunda içeriden sürgü var. Ortak banyolar; başlık lambası şart. Akşam yemek salonunda tek başınıza oturursanız beş dakika içinde birileri masanıza katılır — bu kültürün en güzel yanı.

## Yolda

Langtang Vadisi'nde üç gün boyunca sadece Tamang köylüleri ve birkaç trekker gördüm. Kimse rahatsız etmedi; tam tersine, tek başıma olduğumu görünce çay ikram eden ninelerin sayısını unuttum. Namaste ve gülümseme yeterli.

# Gerçek riskler

- Yüksek irtifa hastalığı: tek başınaysanız belirtileri sizin için fark edecek biri yok. Her sabah kendinize dört soru sorun: baş ağrısı, iştah, uyku, nefes.
- Yaralanma: yalnız kaldığınız yerlerde telefon çekmez. Uydu mesajlaşma cihazı kiralayabilirsiniz (Thamel'de günlük ~500 NPR).
- Köpekler: köylerde bol; taş alır gibi yapmak işe yarıyor ama ısırık olursa kuduz aşısı için Kathmandu'ya inmek gerekiyor. Gitmeden önce ön aşı yaptırdım.

# Abartılanlar

Taciz, hırsızlık, kaçırılma korkusu — beş seyahatte bir kez cüzdanımın çalındığı bir otobüs yolculuğu dışında hiçbir şey yaşamadım, o da benim dikkatsizliğimdi. Nepal Güney Asya'nın yalnız kadınlar için en rahat ülkelerinden biri.

# Kültürel notlar

- Sol el kirli sayılır: yemek ve para sağ elle.
- Ayakkabılar eve ve tapınağa girerken çıkar.
- Dini yapıların etrafında saat yönünde dolaşılır.
- Regl döneminde bazı tapınaklara girmemeniz beklenir; sorarsanız nazikçe söylenir, tartışmayın.
- Pazarlık kısa ve gülümseyerek yapılır; 10–15 dakika süren pazarlıklar iki tarafı da yorar.

> Yalnız seyahat etmek "kimseyle olmamak" değil, kiminle ne kadar olacağınıza siz karar vermek demek. Nepal bu kararı vermenize izin veren nadir yerlerden.

Bir sonraki yazıda EBC ile Annapurna Devresi'ni karşılaştırıyorum; yalnız gidecek olanlar için hangisi daha uygun sorusuna da orada cevap vereceğim.
`,
  }),

  article({
    id: 'art_drone_shgm',
    authorId: 'u_baris',
    title: 'Drone ile dağ çekimi: SHGM kuralları ve etik',
    subtitle:
      'Kayıt, uçuş izinleri, milli parklar ve kimsenin hakkında konuşmadığı yaban hayatı sorunu.',
    cover: unsplash('1519681393784-d120267933ba'),
    category: 'photography',
    tags: ['drone', 'shgm', 'fotoğraf', 'video', 'milli-park'],
    countryCode: 'TR',
    adventureTypes: ['hiking', 'paragliding'],
    likes: 176,
    comments: 2,
    views: 3350,
    daysAgo: 28,
    body: `
Dağdan çekilmiş drone görüntüleri sosyal medyayı dolduruyor ve büyük kısmı kurallara aykırı çekilmiş. Bu yazıda Türkiye'de drone uçurmanın yasal çerçevesini (SHGM), milli park özel durumlarını ve yasalar kadar önemli olan etik tarafını özetliyorum. Yasal bilgiler 2026 başı itibarıyla; SHGM mevzuatı sık değişiyor, uçmadan önce iha.shgm.gov.tr'yi kontrol edin.

# Kayıt ve sınıflar

SHGM İHA Talimatı'na göre 500 g ve üzeri her drone İHA Kayıt Sistemi'ne kaydedilmeli. Sınıflar:

- İHA0: 500 g – 4 kg (çoğu tüketici drone'u)
- İHA1: 4 – 25 kg
- İHA2 / İHA3: 25 kg üstü, ticari

500 g altı cihazlar (örn. mini serisi) kayıt gerektirmiyor ama uçuş kuralları aynen geçerli. İHA0 için pilot ehliyeti zorunlu değil; İHA1'den itibaren ehliyet ve sigorta şart.

# Uçuş kuralları

- Azami yükseklik 120 m (yerden, dağda zirveden değil).
- Görüş hattı içinde kalın (VLOS).
- Havalimanlarına 9 km, helikopter pistlerine 3 km yaklaşmayın. Dağda helikopter pisti nadir ama kayak merkezlerinde var.
- Kalabalık üzerinde uçmayın; yaylada şenlik varsa uçmayın.
- Gece uçuşu özel izin ister.
- Askeri bölgeler, sınır hattı (Ağrı, Hakkâri, Kaçkar'ın doğusu) kırmızı bölge. Uygulamadaki haritada kırmızı görüyorsanız orası tartışma götürmez.

# Milli parklar ve korunan alanlar

Bu kısım en çok karıştırılan yer. SHGM izni ile milli park izni ayrı şeyler. Milli parklarda (Kaçkar, Aladağlar, Köprülü Kanyon, Nemrut vb.) drone kullanımı Doğa Koruma ve Milli Parklar Genel Müdürlüğü iznine bağlı; ticari çekimler için ücretli, kişisel çekim için de yazılı izin gerekiyor. Kapadokya'da Göreme Milli Parkı içinde uçuş, balon saatlerinde (gün doğumu ± 2 saat) kesinlikle yasak; ihlali cezai.

# Etik: yasal olması yeterli değil

## Yaban hayatı

Drone sesi vaşak, çengel boynuzlu dağ keçisi ve kartal yuvaları için ciddi stres. Yuva mevsimi (Nisan–Temmuz) kayalık duvarlardan uzak durun. Bir dağ keçisi sürüsünün drone'dan kaçarken uçuruma düştüğünü gördüm; o görüntü hiçbir kareye değmez.

## İnsanlar

Zirvedeki diğer insanlar drone sesi duymak için tırmanmadı. Kısa uçun, yüksekten uçun, gruplar geçince uçun. Yayla evlerinin üstünden geçmeyin; bahçe, avlu özel alan.

## Kendiniz

Rüzgar 3.000 m üstünde bir anda 50 km/s'ye çıkar. Drone'u geri alamamak sık; batarya soğukta %30 daha hızlı biter. Dönüş eşiğini %40'a çekin.

# Çekim için pratik notlar

- Gün doğumundan sonraki ilk saat: yumuşak ışık, sakin rüzgar.
- ND filtre şart; parlak karda 1/50 s için ND32.
- Log profil çekin, sonra renklendirin; kar tonlarını korur.
- Kalkış noktasına küçük bir pist bezi koyun; çakıl motoru bitirir.

> Kural basit: uçmadan önce üç soru — Yasal mı? Kimseyi rahatsız ediyor mu? Bir hayvanı ürkütüyor mu? Herhangi birine "evet"se drone çantada kalır.

Bir sonraki yazı drone dışına çıkıyor: dağda altın saat ve pozlama; drone kullanmayanlar için de işe yarayacak.
`,
  }),

  article({
    id: 'art_cig_okumak',
    authorId: 'u_can',
    title: 'Çığ tehlikesini okumak: bülten, arazi ve kar profili',
    subtitle: 'Kış dağcılığında karar verirken kullandığım üç katmanlı kontrol listesi.',
    cover: unsplash('1508739773434-c26b3d09e071'),
    category: 'safety',
    tags: ['çığ', 'kış', 'güvenlik', 'kar-profili', 'dağcılık'],
    countryCode: 'TR',
    adventureTypes: ['skiing', 'hiking'],
    likes: 402,
    comments: 2,
    views: 6980,
    daysAgo: 8,
    body: `
Türkiye'de her kış çığda ortalama 20–30 kişi hayatını kaybediyor; büyük kısmı köylerde, ama dağcı ve kayakçı sayısı da artıyor. Bu yazı çığ eğitimi yerine geçmez. Amacı, temel eğitim almış birinin kış dağında sabah kahvesini içerken hangi soruları sorması gerektiğini hatırlatmak.

# 1. katman: bülten ve hava

Meteoroloji Genel Müdürlüğü çığ bültenlerini Doğu Anadolu ve Doğu Karadeniz için yayınlıyor; beş kademeli Avrupa ölçeği kullanılıyor:

- 1 Düşük
- 2 Orta
- 3 Kayda değer
- 4 Yüksek
- 5 Çok yüksek

Kaza istatistiklerinin çoğu 3. kademede oluyor; çünkü "orta" sanılıyor. 3, "birçok dik yamaçta insan tetiklemesi olası" demek. Bülten yoksa kendi bülteninizi yazın: son 72 saatin yağışı, rüzgar yönü ve hızı, sıcaklık değişimi.

Kırmızı bayraklar:

- Son 24 saatte 30 cm üstü yeni kar
- Kuvvetli rüzgar (rüzgar tarafı yamaçlarda taşıma kar birikimi)
- Ani ısınma ya da yağmur
- Son 48 saatte gözlemlenen çığ
- Kar örtüsünde "vump" sesi, çatlaklar

Bu beşten biri bile varsa 30° üstü yamaçlar gündemden düşer.

# 2. katman: arazi

Çığlar 30–45° eğimli yamaçlarda başlar; 38° civarı en tehlikeli. Eğimölçer 1.200 gramlık ekipmandan daha fazla hayat kurtarır. Arazi okuma:

- Yamacın altında ne var? Ağaçlar, kaya, uçurum, dere yatağı (kapan alanı).
- Konveks kırılma noktaları (yamacın "dizi") gerilimin toplandığı yer.
- Sırtlar güvenli, kanallar değil.
- Gölge (kuzey) yamaçlar zayıf tabakayı uzun süre saklar; güneş yamaçları ısınma çığı üretir.

Rota planlarken grup mesafesi: tehlikeli yamaçlarda tek tek geçin, diğerleri güvenli noktadan izlesin.

# 3. katman: kar profili ve testler

Kolon testi (Compression Test), genişletilmiş kolon testi (ECT) ve el kürek testi; her biri 10–15 dakika. Sonuçlar tek başına karar vermez, ama bülten ve arazi ile birleşince resim netleşir. ECT'de 30 vuruş altında yayılan kırılma gördüyseniz o yamaç o gün kapalı.

Zayıf tabakalar: derinlik kırağısı (kar tabanında şeker gibi kristaller), yüzey kırağısı (parlak plakalar, üstüne yağan kar tehlike), kabuk-kar geçişleri.

# Karar verme

İnsan faktörü kazaların yüzde 90'ının nedeni. Aşina olduğunuz yamaç, "geçen hafta güvenliydi", "grup ileride geçti", "bu kadar geldik" — hepsi klasik tuzak. Basit bir kural: kararı en ihtiyatlı üye verir, sorgulanmaz.

> Çığ üçlüsü (transceiver, sonda, kürek) sizi kurtarmaz; arkadaşınızı kurtarır. Kurtulmak için ilk 15 dakika kritik; bu yüzden herkes taşır, herkes kullanmayı bilir, her sezon başı pratik yapılır.

# Ekipman notu

- Transceiver: 3 antenli, sezon başı pil değişimi.
- Sonda: 240 cm ve üstü.
- Kürek: metal, plastik kürek buz gibi kar bloklarında kırılır.
- Hava yastıklı çanta: yardımcı, ama davranışı değiştirmemeli.

# Eğitim

TDF ve özel kuruluşlar 2 günlük "çığ farkındalık" ve 4 günlük "çığ 1" eğitimleri veriyor. Kışın dağa çıkan herkes için asgari: farkındalık eğitimi ve her sezon bir arama pratiği. Bu yazıyı okuyup dağa çıkmak eğitim sayılmaz; lütfen kayıt olun.
`,
  }),

  article({
    id: 'art_likya_9',
    authorId: 'u_lale',
    title: "Likya Yolu'nu 9 günde yürümek: Fethiye–Kaş batı bölümü",
    subtitle: 'Gün gün etaplar, su noktaları, kamp yerleri ve toplam maliyet.',
    cover: unsplash('1519046904884-53103b34b206'),
    category: 'trip_report',
    tags: ['likya-yolu', 'trekking', 'kamp', 'fethiye', 'kaş'],
    destinationId: 'dest_likya',
    countryCode: 'TR',
    adventureTypes: ['hiking'],
    likes: 267,
    comments: 0,
    views: 4870,
    daysAgo: 75,
    body: `
Likya Yolu'nun tamamı 500 km üstünde ve bir ayı bulur. Batı bölümü (Fethiye/Ovacık – Kaş) yaklaşık 180 km; Ekim'de 9 günde yürüdüm. Bu yazı etap etap notlar, su ve kamp bilgisi. Kış öncesi ya da Nisan–Mayıs için de aynı plan işler; yazın yürümeyin.

# Genel bilgiler

- İşaretleme: kırmızı-beyaz. Bazı bölümlerde işaret sık, bazı yerde 300 m arayla. GPX dosyası telefonda mutlaka olsun.
- Su: köylerde çeşme, patikada nadir. Ekim'de yanımda 2,5 L taşıdım.
- Kamp: yasak alan yok ama köy içlerinde izin isteyin; plajlarda gece kamp jandarma tarafından bazen uyarılıyor.
- Ulaşım: Fethiye'den Ovacık'a dolmuş 15 dk; Kaş'tan Fethiye'ye otobüs 2,5 saat.

# Etaplar

## 1. gün — Ovacık → Faralya (14 km, 5 s)

Babadağ'ın eteğinden Kelebekler Vadisi'nin üstüne. Manzaralı, kolay. Faralya'da pansiyon ya da Kabak'a inip kamp.

## 2. gün — Faralya → Kabak → Alınca (12 km, 5,5 s)

Kabak'tan Alınca'ya sert tırmanış (450 m). Alınca'da Bayram Amca'nın yerinde çay ve gözleme; kamp alanı var.

## 3. gün — Alınca → Gey → Bel (16 km, 6 s)

Sarp ve bakır rengi kayalıklar. Gey köyünde çeşme. Bel'de kamp alanı ve küçük market.

## 4. gün — Bel → Pydnai → Letoon (20 km, 6,5 s)

Uzun ve düz; Gavurağılı'ndan inip Patara sulak alanının kenarından. Pydnai kalesi kısa mola. Letoon antik kentini akşam ışığında görün.

## 5. gün — Letoon → Xanthos → Patara (17 km, 5 s)

Asfalt fazlaca; sabah erken çıkın. Patara plajında gün batımı, plaj yakınındaki kamp alanı.

## 6. gün — Patara → Delikkemer → Kalkan (14 km, 5 s)

Delikkemer su kemeri Roma mühendisliğinin bu rotadaki en etkileyici eseri. Kalkan'da pansiyon gecesi ve dinlenme.

## 7. gün — Kalkan → Bezirgan (13 km, 5 s)

Kalkan'dan 800 m tırmanış; Bezirgan yaylasının kış evleri (tahıl ambarları) görülmeye değer. Köyde kamp için bahçesini açan aileler var.

## 8. gün — Bezirgan → Sarıbelen → Gökçeören (16 km, 6 s)

Ormanlık, gölgeli, en sakin gün. Gökçeören'de çeşme ve kamp.

## 9. gün — Gökçeören → Phellos → Kaş (18 km, 6,5 s)

Phellos antik kentinden Kaş'a 700 m iniş; dizler için batonlar. Kaş'ta bir tabak balıkla bitirin.

# Maliyet

9 gün toplamı yaklaşık 6.200 TL: iki pansiyon gecesi 2.400, marketler ve köy kahvaltıları 2.800, ulaşım 1.000. Kampta bedava; ev sahiplerine küçük teşekkürler (bahşiş, şeker) her zaman iyi.

# Ekipman kısa notu

Ekim'de gündüz 24 °C, gece 10 °C. Yağmurluk şart (bir gece sağanak). Ultralight listem yeterli oldu; ayakkabı olarak koşu ayakkabısı — botla yürüyenlerin ayağı kavruluyor.

> Likya Yolu'nun en iyi tarafı zorluğu değil, her günün bir köy kahvesinde bitmesi. Etap uzunluklarını buna göre ayarlayın; erken bitirip çay içmek rotanın parçası.

Doğu bölümü (Kaş–Antalya) için ayrı bir yazı planlıyorum; Olympos–Çıralı hattını yürüyenler notlarını yorumlara bırakırsa sevinirim.
`,
  }),

  article({
    id: 'art_kili_porter',
    authorId: 'u_can',
    title: "Kilimanjaro: porter'lara adil ücret",
    subtitle:
      'Ucuz tur seçtiğinizde o farkı kim ödüyor? KPAP standartları, gerçek maaşlar ve ne yapabilirsiniz.',
    cover: unsplash('1589553416260-f586c8f1514f'),
    category: 'opinion',
    tags: ['kilimanjaro', 'porter', 'etik', 'tanzanya', 'adil-seyahat'],
    destinationId: 'dest_kilimanjaro',
    countryCode: 'TZ',
    adventureTypes: ['hiking'],
    likes: 221,
    comments: 1,
    views: 3120,
    daysAgo: 40,
    body: `
Kilimanjaro'da bir tırmanıcı için ortalama üç porter çalışır. 2024'te resmi tahminlere göre yaklaşık 50.000 porter dağda çalıştı; 2025'te en az 12 porter dağda hayatını kaybetti — çoğu hipotermi ve yetersiz ekipman nedeniyle. Bu yazı Machame rotasında rehber olarak çalıştığım iki sezonun ardından yazıldı; rakamlar Kilimanjaro Porters Assistance Project (KPAP) ve kendi gözlemlerimden.

# Sorun ne?

Tanzanya milli park otoritesi (TANAPA) porter günlük ücreti için asgari sınır belirledi: 2026 itibarıyla günde yaklaşık 20.000 TZS (yaklaşık 8 USD). Kâğıt üzerinde. Gerçekte:

- Bazı düşük bütçeli operatörler günlük 5–6 USD ödüyor, geri kalanı "bahşişten" bekleniyor.
- Porter yük sınırı 20 kg (TANAPA) — tartılıyor, ama kapıdan sonra yeniden yükleniyor.
- Ekipman: KPAP'ın 2025 raporunda porterların yüzde 40'ının su geçirmez ceketi yoktu. Barafu Kampı'nda (4.673 m) -10 °C.
- Yemek: rehber ve müşteri üç öğün yerken porterlara günde bir-iki öğün ugali.

# Ucuz tur neden ucuz?

Kilimanjaro 7 günlük Machame turu için park ücretleri kişi başı yaklaşık 1.000 USD. Bunun üstüne yemek, ulaşım, ekipman, rehber ve porter ücretleri. 1.400 USD'ye sunulan tur, matematiksel olarak porterlardan kesiyor. Adil ödeme yapan operatörler 2.400 USD'nin altına inemiyor; fark budur.

# KPAP ve Partner for Responsible Travel

KPAP (International Mountain Explorers Connection'ın programı) operatörleri gönüllü denetliyor; "Partner" listesindeki şirketler:

- Asgari ücretin üstünde, düzenli ödeme (son gün nakit, kesinti yok)
- 20 kg yük sınırına gerçek uyum
- Üç öğün yemek, çadır ve mat
- Ekipman kiralama imkânı

Listeyi kpap.org'da bulabilirsiniz. Tur alırken "KPAP partner mısınız?" sorusunun cevabı "evet" olmalı; "biz de aynı şeyi yapıyoruz" cevabı "hayır" demektir.

# Bahşiş nasıl olmalı?

KPAP önerisi (grup başına, gün başına):

- Baş rehber: 20–25 USD
- Yardımcı rehber: 15–20 USD
- Aşçı: 12–15 USD
- Porter: 8–10 USD

7 günlük tırmanışta, 2 kişilik grup ve 8 kişilik ekip için toplam 600–800 USD bahşiş. Son gün, herkesin önünde, her kişiye ayrı ayrı elden verin; toplu vermek rehberin dağıtımına kalıyor.

# Siz ne yapabilirsiniz?

- Fiyatı karşılaştırırken "kim ödüyor?" diye sorun.
- Porterların ekipmanına bakın; yetersizse rehbere söyleyin, operatöre yazın.
- Kendi fazla ekipmanınızı (eldiven, polar) son gün hediye edin; kullanılmış ceket bir porter için sezonluk ekipman.
- Yükünüzü hafif tutun. 15 kg yerine 10 kg — bir kişi az taşınır.
- Tırmanış sonrası KPAP anketini doldurun; denetim buna dayanıyor.

> Zirve fotoğrafı, sizi oraya taşıyan on kişinin sırtından çekilmiş bir kare. O on kişinin adını bilmiyorsanız fotoğraf eksiktir.

Bu yazı sadece Kilimanjaro'yu anlatıyor ama aynı sorun Nepal'de, Peru'da, Fas'ta var. Sorumlu tur seçmek pahalı değil; ucuzun bedelini başkasına ödetmemek.
`,
  }),

  article({
    id: 'art_termik',
    authorId: 'u_baris',
    title: 'Yamaç paraşütünde termik okuma: bulut, kuş ve arazi ipuçları',
    subtitle: "Ölüdeniz ve Pamukkale'de sürede iki katına çıkmamı sağlayan gözlem alışkanlıkları.",
    cover: unsplash('1502920917128-1aa500764cbd'),
    category: 'guide',
    tags: ['yamaç-paraşütü', 'termik', 'ölüdeniz', 'hava', 'xc'],
    countryCode: 'TR',
    adventureTypes: ['paragliding'],
    likes: 143,
    comments: 0,
    views: 2560,
    daysAgo: 55,
    body: `
P3 aldıktan sonraki ilk sezonumda ortalama uçuş sürem 25 dakikaydı; termik yakalamak şans gibi geliyordu. Bir sonraki sezonda ortalama 70 dakikaya çıktı ve değişen tek şey uçuş becerim değil, havada ve yerde neye baktığımdı. Bu yazı termik "avlamak" için kullandığım gözlem listesi.

# Termik nedir, ne değildir?

Güneşin ısıttığı yüzeyden yükselen sıcak hava sütunu. Sürekli bir sütun değil, çoğunlukla balonlar halinde kopar. Bu yüzden aynı yerde iki dakika sonra bulamamak normal; tetikleyici noktayı bulmak, sütunu bulmaktan önemli.

# Yerde: kalkıştan önce 15 dakika

- Sıcaklık farkı: gece-gündüz farkı 12 °C üstündeyse günün termikleri kuvvetli olur.
- Rüzgar: vadi rüzgarı başlamadan, saat 11 civarı ilk termikler.
- Kümülüs bulutları: gelişen kümülüsler termiğin tavan olduğunu söyler; tabanı düz ve koyu olanlar aktif.
- Kalkışta rüzgar 20 saniye kesilip sonra kuvvetlenirse önünüzden termik kopmuş demektir; hemen arkasından kalkmayın, bir sonrakini bekleyin (yaklaşık 3–6 dakika periyot).

# Havada: tetikleyiciler

## Arazi

- Güney ve güneybatı bakan kaya yamaçları (öğleden sonra), doğu bakan yamaçlar (sabah).
- Koyu tarla, sürülmüş toprak, asfalt yol, çatı topluluğu — hepsi ısınan yüzey.
- Yamaç kırılmaları ve sırt uçları: hava buradan kopar.
- Vadinin rüzgar tarafında kalın; rüzgar altı kanatlar rotor.

## Kuşlar

Akbabalar ve kartallar en iyi variometre. Dönen kuşun altına değil, bulunduğu yüksekliğe girin; kuş sizden daha sıkı döner, dış çemberde kalın. Kırlangıçlar alçak termiğin işareti: böcekler yükseldiğinde kırlangıç onların peşine düşer.

## Diğer pilotlar

Kimin yükseldiğini izlemek utanç değil, teknik. Ama başkasının termiğine girerken dönüş yönü onun yönüdür; ilk giren belirler.

# Merkezleme

Variometre öttüğünde hemen dönmeyin; 2–3 saniye düz gidip en kuvvetli yükselişi hissedin, sonra dönüşü o tarafa açın. Yükseliş azalınca dönüşü daraltın, artınca genişletin. 360'ta bir tarafta düşüş varsa çemberin merkezi kayık demek — düşüşün tersine doğru düz bir çizgi ekleyip yeniden kapatın.

# Ölüdeniz özelinde

Babadağ 1.700 m kalkışında öğleden sonra termikler deniz meltemiyle karışır; termikler kuzey yamaçlarda ve Kirme'ye doğru daha düzenli. Kelebekler Vadisi üstünde yükseliş güzel ama vadi rüzgarı 14:00'ten sonra sertleşir. Pamukkale'de traverten sıcak yüzeydir; sabah 10:30'dan itibaren düzenli termik verir, öğleden sonra kuvvetli ve dar.

# Güvenlik notu

Kuvvetli termik = kuvvetli çökme. Kanadın yüzde 50 kapanışına hazır olun ve alçakta dönerken kanatta kapanma ihtimalinin yer ile mesafesini hesaplayın: 100 m altında termik aramayın, inişe odaklanın.

> Termik bulmak variometreyle değil gözle başlar; alet sadece bulduğunuzu doğrular.

Sorularınız için yorumlar açık; bir sonraki yazı Kapadokya'da sabah uçuşları ve balon trafiğiyle paylaşım kuralları üzerine.
`,
  }),

  article({
    id: 'art_altin_saat',
    authorId: 'u_baris',
    title: 'Dağda fotoğraf: altın saat ve pozlama',
    subtitle:
      'Kar, gölge ve keskin ışıkla mücadele: histogram, filtre ve kompozisyon üzerine pratik rehber.',
    cover: unsplash('1547234935-80c7145ec969'),
    category: 'photography',
    tags: ['fotoğraf', 'altın-saat', 'pozlama', 'dağ', 'manzara'],
    adventureTypes: ['hiking', 'climbing'],
    likes: 189,
    comments: 0,
    views: 3480,
    daysAgo: 18,
    body: `
Dağ, fotoğrafçı için en zor ışık ortamlarından biri: kar aşırı parlak, kuzey yamaçlar zifiri, hava ince olduğundan kontrast keskin. Bu yazıda dağda çektiğim her karede uyguladığım pozlama ve zamanlama alışkanlıklarını anlatıyorum. Ekipman marka bağımsız; telefonla da uygulanır.

# Altın saat ve mavi saat

Altın saat gün doğumundan sonraki ve batımından önceki ~60 dakika; dağda daha kısa, çünkü güneş sırtın arkasından geç doğar, erken batar. Zirvelerde "alpenglow" (zirvelerin pembeleşmesi) altın saatten önce başlar: gün doğumundan 15–20 dakika önce doğu yüzleri pembe-turuncu. Mavi saat gün batımından sonraki 30 dakika; kar mavi tonlarını alır ve pozlama süresi uzar, tripod gerekir.

Zamanlama için PhotoPills gibi bir uygulamayla güneşin hangi sırttan doğacağını bir gün önce kontrol edin; dağda "10 dakika geç kaldım" telafi edilemez.

# Pozlama: histogramı sağa yaslayın

Kameranın otomatik ölçümü karı gri yapar; kar fotoğrafları bu yüzden donuk çıkar. Çözüm:

- Pozlama telafisi +1 ile +1,7 EV (karlı sahnelerde).
- Histogramın sağ kenarına yaslanın ama kırpmayın ("expose to the right"). RAW çekiyorsanız gölgeleri sonradan açmak kolay, patlamış karı kurtarmak imkânsız.
- Aşırı kontrastlı sahnede (güneşli zirve, gölgeli vadi) iki kare: biri zirve için, biri vadi için; sonra birleştirin. HDR modu telefonda bunu otomatik yapar.

# Filtreler

- Polarize (CPL): gökyüzünü koyulaştırır, kar parlamasını azaltır. Ama 3.000 m üstünde gökyüzü zaten koyu; tam polarizasyonda gök siyaha döner. Yarı çevirin.
- ND kademeli (GND): ufuk düzse işe yarar; dağ silüetinde yumuşak geçiş (soft) kullanın.
- UV: gereksiz; lensi korumak için isterseniz.

# Kompozisyon: ölçek verin

Dağ fotoğraflarının en sık hatası ölçek yokluğu. Ön plana bir çadır, bir kişi, bir kaya koyun; zirve ancak o zaman büyür. Kurallar:

- Ön plan – orta plan – arka plan: üçünü de doldurun.
- Sırtları diyagonal olarak yerleştirin.
- Gökyüzü ilginç değilse ufku üst üçte bire koyun.
- Kişileri sağa ya da sola bakar, boşluğa doğru yerleştirin.

# Soğuk ve ekipman

- Pil -10 °C'de yüzde 40 kapasite kaybeder; yedek pil iç cepte.
- Sıcak çadıra soğuk kamerayı sokmayın, buğu lensin içine yerleşir; çantasında kapalı ısınsın.
- Kar üstünde tripod ayakları batar; kar tabakları ya da baton rondelası.
- Lens bezi ve üfleyici: kar taneleri lensin önünde eriyince leke.

# Basit sabah rutini

- Gün doğumundan 45 dakika önce çadırdan çık.
- Kompozisyonu mavi saatte kur, tripodu dengele.
- Alpenglow geldiğinde bracket (3 kare, ±1 EV).
- Güneş sırttan çıktığında polarizeyi tak, +1 EV telafi.
- Işık sertleşince (doğumdan 60 dk sonra) kamerayı kapat, kahvaltı.

> Dağda en iyi kamera, soğuktan cebinde tuttuğun kameradır. Ekipmanı basit tutun, alarmı erken kurun.

Bu yazıya eşlik eden drone kurallarını önceki yazımda bulabilirsiniz; bir sonraki konu gece çekimi ve Samanyolu için pozlama.
`,
  }),

  article({
    id: 'art_kapadokya_bisiklet',
    authorId: 'u_lale',
    title: 'İlk uzun bisiklet turum: Kapadokya',
    subtitle: 'Dört gün, 210 km, iki patlak, bir kum fırtınası: gravel ile vadiler arasında.',
    cover: unsplash('1641128324972-af3212f0f6bd'),
    category: 'trip_report',
    tags: ['bisiklet', 'kapadokya', 'gravel', 'bikepacking', 'ürgüp'],
    destinationId: 'dest_kapadokya',
    countryCode: 'TR',
    adventureTypes: ['cycling'],
    likes: 154,
    comments: 0,
    views: 2890,
    daysAgo: 95,
    body: `
Uzun yürüyüşlerden bisiklete geçmek istiyordum ve Kapadokya bunun için mükemmel bir "ilk": mesafeler kısa, yollar çeşitli, her 15 km'de köy ve su, konaklama seçeneği bol. Dört günde Ürgüp merkezli bir döngü yaptım; gravel bisiklet, çantalar kadroya bağlı, çadır yok.

# Neden Kapadokya?

- Vadi tabanları toprak, sırtlar asfalt; gravel için ideal karışım.
- Günlük tırmanış 600–900 m; zorlu ama bitmiyor.
- Kasım başında turist az, gündüz 15 °C, gece 2 °C.
- Balonlar sabah 06:30'da; pedalı gün doğumunda çevirmek için başka gerekçe gerekmiyor.

# Ekipman

Bisiklet: alüminyum gravel, 40 mm lastik, tüplü (tubeless). Çantalar: sele çantası 11 L, kadro çantası 4 L, gidon rulosu 8 L. Toplam yük 7 kg. Kamp yoksa bu kadar yetiyor. Yedek iç lastik iki adet (tubeless bile olsa), mini pompa, zincir yağı, multitool. Kask, eldiven, gözlük (toz!), rüzgarlık.

# Rota

## 1. gün — Ürgüp → Ortahisar → Göreme → Çavuşin → Ürgüp (48 km, 780 m)

Kızılçukur ve Güllüdere vadileri sabah; toprak yol ve dar patikalar, yer yer yürüyerek. Göreme'de kahvaltı. Çavuşin'den Ürgüp'e dönüş asfaltta, öğleden sonra rüzgar karşıdan.

## 2. gün — Ürgüp → Mustafapaşa → Soğanlı → Ürgüp (62 km, 920 m)

Günün uzun etabı. Mustafapaşa'dan Soğanlı'ya kadar trafik yok denecek kadar az. Soğanlı vadisi kaya kiliseleri için 1 saat ayırın. Dönüşte Taşkınpaşa üstünden.

## 3. gün — Ürgüp → Avanos → Paşabağı → Zelve → Ürgüp (46 km, 610 m)

Kızılırmak kıyısı düz ve hızlı. Zelve'de öğle. Paşabağı toprak yolları öğleden sonra tozlu; gözlük şart. Bu gün kum fırtınasına yakalandım — 20 dakika bir kaya oyuğunda bekledim, zincir kum doldu, akşam temizledim.

## 4. gün — Ürgüp → Uçhisar → Güvercinlik Vadisi → Ürgüp (54 km, 840 m)

Uçhisar kalesine tırmanış (yüzde 9–11) sabah serinliğinde. Güvercinlik Vadisi toprak yolu kısmen taşlı, 40 mm lastik sınırda. Öğleden sonra Ürgüp'te dinlenme ve bisiklet yıkama.

# İki patlak, bir ders

Tubeless olmasına rağmen ikinci gün Soğanlı'da bir diken sızdırmazlığı yenince iç lastik taktım; dördüncü gün Güvercinlik'te taşa çarpıp yan duvarı kestim. Ders: gravel için 40 mm az; 45–47 mm daha rahat ve daha güvenli.

# Maliyet ve konaklama

Ürgüp'te dört gece pansiyon 5.600 TL, yemek 2.400 TL, bisiklet kargo ve ulaşım 1.800 TL. Toplam yaklaşık 10.000 TL. Kamp yapan biri yarı fiyata halleder; Kasım gecesi 2 °C ile sıfır arası, dört mevsim tulum ister.

# İlk tur için tavsiyeler

- Günlük 50 km ile başlayın; oturma ağrısı üçüncü gün geçiyor.
- Rüzgar öğleden sonra kuzeybatıdan; sabah rüzgara karşı gidin, öğleden sonra rüzgarı arkanıza alın.
- Vadi tabanlarında yaya öncelikli; yürüyenler için yavaşlayın ve zil çalın.
- Toz için zincir kuru yağ (wax), ıslak yağ kumu toplar.

> Bisiklet, yürüyüşün üç katı mesafe, üçte biri yorgunluk; ama yolun arkasında kalan köy kahveleri aynı. Kapadokya ilk tur için affedici bir yer.

Sonraki hedef Likya kıyısında bikepacking; o yazıda çadırlı kurulumu ve ağırlık listesini paylaşacağım.
`,
  }),

  article({
    id: 'art_torres_rez',
    authorId: 'u_elif',
    title: 'Torres del Paine W: rezervasyon savaşı',
    subtitle:
      'CONAF ve iki özel işletmeci arasında kamp/refugio rezervasyonu nasıl yapılır; hangi tarihte ne bulunur.',
    cover: unsplash('1478827387698-1527781a4887'),
    category: 'guide',
    tags: ['torres-del-paine', 'patagonya', 'şili', 'rezervasyon', 'trekking'],
    destinationId: 'dest_torres',
    countryCode: 'CL',
    adventureTypes: ['hiking'],
    likes: 132,
    comments: 0,
    views: 2210,
    daysAgo: 110,
    body: `
Torres del Paine'nin W rotasına gitmek istiyorsanız zor kısım yürüyüş değil; rezervasyon. Park içinde kamp ya da refugio rezervasyonu olmadan yürüyüşe başlamanıza izin verilmiyor, ve Aralık–Şubat için yerler Temmuz–Ağustos'ta doluyor. Bu yazı 2026 sezonunda sistemin nasıl çalıştığını ve bir haftalık "savaşı" adım adım anlatıyor.

# Üç ayrı sistem

W rotasında konaklama üç işletmeciye bölünmüş durumda ve üç ayrı sitede rezervasyon yapılıyor:

- CONAF (devlet): Paso ve Italiano kampları (ücretsiz ama rezervasyonlu; W için Italiano önemli, ama son yıllarda kapalıydı — açılma durumunu kontrol edin).
- Vértice Patagonia: Grey ve Paine Grande kampları/refugio'ları.
- Las Torres (eski Fantástico Sur): Francés, Cuernos, Chileno ve Central kampları.

Dört-beş gecelik W için genellikle: Central (ya da Chileno) → Francés/Cuernos → Paine Grande → Grey. Her gece farklı işletmeci olabilir; hepsini ayrı ayrı yapmanız gerekiyor ve tarihler zincir gibi tutmalı.

# Ne zaman açılıyor?

- Las Torres: Genellikle Mayıs–Haziran, sezon bazında.
- Vértice: Haziran–Temmuz.
- CONAF: Sezon açılışına yakın, Ağustos–Eylül; kontenjan küçük.

Açılış tarihleri e-posta bültenleriyle duyuruluyor; ikisine de kaydolun. Açılış gününde site çöküyor; sabah erken (Şili saati 08:00) denemek işe yarıyor.

# Fiyatlar (2026, kişi başı, gece)

- Kamp alanı (kendi çadırınız): 12–20 USD
- Kurulu çadır + mat + tulum: 90–130 USD
- Refugio yatakhane: 110–160 USD, yemek 30–40 USD/öğün
- Park giriş ücreti (3 günden fazla): yaklaşık 49 USD, pasoparques.cl üzerinden önceden alınır.

Tam pansiyon paketler kişi başı 5 gece için 900 USD'yi geçebiliyor. Kendi çadırınız ve yiyeceğinizle 150 USD'nin altında olur.

# Adım adım plan

1. Tarih aralığı belirleyin; esnek olun (±3 gün).
2. Rotayı doğu → batı (Central'dan başla) ya da batı → doğu (katamaranla Paine Grande'den başla) diye çizin; her iki yönde de Torres'i sabah görmek için son/ilk geceyi Chileno ya da Central yapın.
3. Las Torres sitesinden Central ve Francés'i alın (en hızlı dolan).
4. Vértice'den Paine Grande ve Grey'i tamamlayın.
5. Katamaran (Pudeto–Paine Grande) ve Puerto Natales otobüsünü alın.
6. Hepsini tek PDF yapın; park girişinde ve her kampta gösteriliyor.

# Yer bulamazsanız

- Refugio yerine kamp; kamp yerine platform kamp.
- Gündüz kalkışı Torres bakış noktası için (Central'dan gidiş-dönüş 8 saat) ve Grey buzulu tekne turu ile "W-lite".
- İptal takibi: haftalık kontrol, özellikle gidişten 2–3 hafta önce iptaller düşüyor.
- Tur operatörü kontenjanı: pahalı ama garanti.

> Rezervasyonu olmayan girmiyor; bu yıl kapıda geri çevrilen gruplar gördüm. "Bir şekilde hallederiz" Patagonya'da çalışmıyor.

# Yürüyüşün kendisi

Beş gün, 75 km, en yüksek nokta Britanico bakış noktası 1.200 m. Rüzgar ana zorluk: 100 km/s normal. Kar mevsim dışı bile yağabilir. Rota işaretli, kayıp riski düşük; ama tek başına yürümek için de rezervasyon şart, rehber değil.

Rezervasyon savaşını kazandıysanız gerisi kolay. Sorularınız için yorumlar açık; tarih bulmakta zorlananlar bana yazsın, iptal takvimi paylaşırım.
`,
  }),
];

/* ------------------------------------------------------------------ */
/* Yorumlar, beğeniler, kayıtlar                                       */
/* ------------------------------------------------------------------ */

export const seedArticleComments: ArticleComment[] = [
  {
    id: 'ac_1',
    articleId: 'art_ebc_12',
    authorId: 'u_mert',
    content:
      "Nangkartshang uyarısı çok yerinde. Ben de aklimatizasyon gününü atlayıp Lobuche'de bir gece kâbus yaşadım, ertesi gün Dingboche'ye geri indim.",
    createdAt: daysAgo(20),
  },
  {
    id: 'ac_2',
    articleId: 'art_ebc_12',
    authorId: 'u_selin',
    content:
      'Bütçe kısmı için teşekkürler, tam da bunu arıyordum. Su filtresi olarak hangisini kullandınız?',
    createdAt: daysAgo(19),
  },
  {
    id: 'ac_3',
    articleId: 'art_ebc_12',
    authorId: 'u_elif',
    content: 'Squeeze tipi bir filtre; soğukta donmasın diye geceleri tulumun içinde uyudu :)',
    createdAt: daysAgo(19),
  },
  {
    id: 'ac_4',
    articleId: 'art_ebc_12',
    authorId: CURRENT_USER_ID,
    content:
      'Ramechhap uyarısı için ayrıca teşekkürler; gece 02:00 minibüsünü bilmeden gitseydim rezalet olurdu.',
    createdAt: daysAgo(15),
  },
  {
    id: 'ac_5',
    articleId: 'art_ebc_12',
    authorId: 'u_ayse',
    content:
      "Everest Link kartı Gorak Shep'te de çalıştı mı gerçekten? Geçen sene Lobuche'den sonra sinyal yoktu.",
    createdAt: daysAgo(10),
  },
  {
    id: 'ac_6',
    articleId: 'art_kackar_kis',
    authorId: 'u_emre',
    content:
      "Benzinli ocak notuna katılıyorum. Kartuş -12 °C'de neredeyse hiç ısıtmadı, tersine çevirerek idare ettik.",
    createdAt: daysAgo(30),
  },
  {
    id: 'ac_7',
    articleId: 'art_kackar_kis',
    authorId: 'u_nil',
    content: "Kar ayakkabısı hazırlığı için Uludağ'da bir gün yeterli mi sizce?",
    createdAt: daysAgo(29),
  },
  {
    id: 'ac_8',
    articleId: 'art_kackar_kis',
    authorId: 'u_can',
    content:
      'Yeterli; hatta iki saat çanta ile iniş-çıkış yapmak bile büyük fark yaratıyor. Bilek hareketini öğrenmek asıl mesele.',
    createdAt: daysAgo(29),
  },
  {
    id: 'ac_9',
    articleId: 'art_kas_dalis',
    authorId: 'u_mert',
    content: "Uçak batığı ilk derin dalışım olmuştu, harika seçim. Kanyon'a bir sonraki sezon.",
    createdAt: daysAgo(11),
  },
  {
    id: 'ac_10',
    articleId: 'art_kas_dalis',
    authorId: CURRENT_USER_ID,
    content: "Eylül için Kaş'ta hangi merkezi önerirsiniz? Küçük grup önemli benim için.",
    createdAt: daysAgo(9),
  },
  {
    id: 'ac_11',
    articleId: 'art_kas_dalis',
    authorId: 'u_zeynep',
    content:
      'İsim vermeyeyim ama limandaki merkezlerin çoğu 4 kişilik gruplarla çalışıyor; oksijen kiti sorusunu sormayı unutmayın.',
    createdAt: daysAgo(9),
  },
  {
    id: 'ac_12',
    articleId: 'art_ultralight',
    authorId: 'u_ayse',
    content: "Quilt'e geçiş için tereddütteydim; -5 °C konforda üşümediniz mi gerçekten?",
    createdAt: daysAgo(43),
  },
  {
    id: 'ac_13',
    articleId: 'art_ultralight',
    authorId: 'u_lale',
    content:
      'Sıfırın altında bir gece ceketle uyudum, onun dışında hiç sorun olmadı. Mat R değeri asıl belirleyici.',
    createdAt: daysAgo(42),
  },
  {
    id: 'ac_14',
    articleId: 'art_nepal_kadin',
    authorId: 'u_selin',
    content:
      "Kadın rehber kuruluşu bilgisi çok değerli, teşekkürler. Langtang'a tek başıma gitmeye karar verdim.",
    createdAt: daysAgo(58),
  },
  {
    id: 'ac_15',
    articleId: 'art_nepal_kadin',
    authorId: 'u_nil',
    content:
      'Kuduz ön aşısı konusunu kimse yazmıyor; sağlık turizmi kliniğinde 3 doz yaptırdım, iyi ki.',
    createdAt: daysAgo(50),
  },
  {
    id: 'ac_16',
    articleId: 'art_drone_shgm',
    authorId: 'u_kerem',
    content:
      'Milli park izniyle SHGM izninin ayrı olması bilgisi çok kişiyi şaşırtacak. Kaçkar için başvuru ne kadar sürdü?',
    createdAt: daysAgo(27),
  },
  {
    id: 'ac_17',
    articleId: 'art_drone_shgm',
    authorId: 'u_baris',
    content:
      'Yaklaşık üç hafta; e-posta ile başvurdum, çekim tarihini ve amacını yazmak gerekiyor.',
    createdAt: daysAgo(26),
  },
  {
    id: 'ac_18',
    articleId: 'art_cig_okumak',
    authorId: 'u_emre',
    content: '"Kararı en ihtiyatlı üye verir" cümlesini ekip kuralımız yaptık. Teşekkürler.',
    createdAt: daysAgo(7),
  },
  {
    id: 'ac_19',
    articleId: 'art_cig_okumak',
    authorId: CURRENT_USER_ID,
    content:
      "Farkındalık eğitimi için Ocak'ta yer var mı biliyor musunuz? TDF sitesinde takvim güncel değil.",
    createdAt: daysAgo(5),
  },
  {
    id: 'ac_20',
    articleId: 'art_kili_porter',
    authorId: 'u_mert',
    content:
      'Geçen yıl KPAP partner operatörle gittik; fiyat farkı vardı ama porterların ekipmanını görünce pişman olmadık.',
    createdAt: daysAgo(38),
  },
];

const likers = ['u_mert', 'u_selin', 'u_ayse', 'u_emre', 'u_nil', 'u_kerem', 'u_zeynep', 'u_lale'];

export const seedArticleLikes: { userId: string; articleId: string }[] = [
  { userId: CURRENT_USER_ID, articleId: 'art_ebc_12' },
  { userId: CURRENT_USER_ID, articleId: 'art_cig_okumak' },
  { userId: CURRENT_USER_ID, articleId: 'art_kas_dalis' },
  ...likers.map((userId) => ({ userId, articleId: 'art_ebc_12' })),
  ...likers.slice(0, 6).map((userId) => ({ userId, articleId: 'art_cig_okumak' })),
  ...likers.slice(1, 6).map((userId) => ({ userId, articleId: 'art_kas_dalis' })),
  ...likers.slice(0, 3).map((userId) => ({ userId, articleId: 'art_ultralight' })),
  ...likers.slice(3, 6).map((userId) => ({ userId, articleId: 'art_nepal_kadin' })),
  { userId: 'u_mert', articleId: 'art_kackar_kis' },
  { userId: 'u_emre', articleId: 'art_kackar_kis' },
];

export const seedArticleSaves: { userId: string; articleId: string }[] = [
  { userId: CURRENT_USER_ID, articleId: 'art_ebc_12' },
  { userId: CURRENT_USER_ID, articleId: 'art_ultralight' },
  { userId: CURRENT_USER_ID, articleId: 'art_torres_rez' },
  { userId: 'u_selin', articleId: 'art_nepal_kadin' },
  { userId: 'u_mert', articleId: 'art_kas_dalis' },
  { userId: 'u_ayse', articleId: 'art_likya_9' },
];
