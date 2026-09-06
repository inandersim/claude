import type { CountryChecklist, CountryGuide, VisaInfo } from '@/domain';

import { CURRENT_USER_ID } from './seed';

/*
 * Ülke sosyal & vize rehberi — Türk pasaportu (umuma mahsus) perspektifi.
 * Bilgiler Eylül 2026 itibarıyla derlenmiştir; vize kuralları sık değişir,
 * emin olunmayan ayrıntılarda "resmî kaynağı kontrol et" notu bırakıldı.
 */

const UPDATED = '2026-09-01T09:00:00.000Z';
const NOW_MS = Date.parse('2026-09-06T09:00:00.000Z');
const DAY_MS = 86_400_000;

type Doc = CountryGuide['documents'][number];

const doc = (key: string, label: string, required: boolean, note = ''): Doc => ({
  key,
  label,
  required,
  note,
});

/* Ortak belgeler ------------------------------------------------------- */

const passport = (months = 6, extra = ''): Doc =>
  doc(
    'passport',
    `Pasaport (girişte en az ${months} ay geçerli)`,
    true,
    `${extra || 'En az 1–2 boş sayfa bulunsun; yıpranmış pasaportla giriş reddedilebilir.'}`,
  );

const insurance = (note = ''): Doc =>
  doc(
    'insurance',
    'Seyahat + kurtarma sigortası',
    true,
    note ||
      'Helikopter tahliyesi ve yüksek irtifayı kapsayan poliçe; poliçe numarası ve 7/24 asistans hattı telefonda kayıtlı olsun.',
  );

const visaDoc = (note: string, required = true): Doc => doc('visa', 'Vize onayı', required, note);

const returnTicket = (required = false): Doc =>
  doc(
    'return_ticket',
    'Dönüş / çıkış bileti kanıtı',
    required,
    "Sınırda ya da check-in'de istenebilir; PDF çıktısını telefonda çevrimdışı tut.",
  );

const yellowFever = (required: boolean, note = ''): Doc =>
  doc(
    'yellow_fever',
    'Sarı humma aşı kartı (ICVP)',
    required,
    note ||
      "Yalnızca sarı humma bölgesinden (ör. Uganda, Etiyopya) geliyorsan zorunlu; Türkiye'den doğrudan uçuşta istenmez.",
  );

const idp = (): Doc =>
  doc(
    'idp',
    'Uluslararası ehliyet',
    false,
    "Araç kiralayacaksan Türkiye'de TURİNG'den aynı gün alınır; yerel ehliyetle birlikte taşınır.",
  );

const vaccineCard = (): Doc =>
  doc(
    'vaccine_card',
    'Aşı kartı (rutin + hepatit A/B, tetanos)',
    false,
    'Seyahat sağlığı merkezinde (Hudut ve Sahiller) en az 4–6 hafta önce görüş al.',
  );

const cashUsd = (note = ''): Doc =>
  doc(
    'cash_usd',
    'Nakit USD/EUR (yeni seri, katlanmamış)',
    false,
    note || 'Kırsalda ATM yok; vize ücreti, park girişleri ve bahşiş için küçük banknot ayır.',
  );

const photos = (): Doc =>
  doc(
    'photos',
    'Biyometrik fotoğraf (2 adet, beyaz fon)',
    false,
    'Vize/izin formları için; dijital kopyasını da telefonda sakla.',
  );

const hotelBooking = (): Doc =>
  doc(
    'hotel_booking',
    'Konaklama rezervasyonu / davet mektubu',
    true,
    'Vize dosyası ve sınır görevlisi için; iptal edilebilir rezervasyon yeterli.',
  );

const bankStatement = (): Doc =>
  doc(
    'bank_statement',
    'Son 3 ay banka dökümü + gelir belgesi',
    true,
    'Vize başvurusunda maddi yeterlilik kanıtı; ıslak imzalı/kaşeli çıktı iste.',
  );

const permit = (key: string, label: string, note: string, required = true): Doc =>
  doc(key, label, required, note);

/* Ortak vize şablonları ----------------------------------------------- */

const schengenVisa = (country: string, url: string, note = ''): VisaInfo => ({
  type: 'embassy',
  maxStayDays: 90,
  costTry: 4500,
  processingDays: 15,
  url,
  note:
    note ||
    `Schengen C tipi vize (90/180 gün). ${country} ana varış ülkesi ise başvuru o ülkenin konsolosluğuna/aracı kurumuna yapılır. Randevu yoğunluğu nedeniyle 2–3 ay önce başla; seyahat sağlık sigortası (min. 30.000 €) zorunlu. Ücret ve süreler için resmî kaynağı kontrol et.`,
});

const schengenLaws = (extra: string[] = []): string[] => [
  'Drone: EASA kuralları; 250 g üstü için kayıt ve A1/A3 sertifikası, ulusal parklarda çoğunlukla yasak.',
  'Alkol: 18 yaş (bazı ülkelerde bira/şarap 16); araçta yasal sınır 0,5‰ ve altı.',
  'Uyuşturucu: esrar dahil bulundurmak suçtur; ceza ülkeye göre para cezasından hapse.',
  'LGBTİ+: eşcinsel ilişki yasal, ayrımcılık yasaklarıyla korunur.',
  ...extra,
];

const schengenSources = (...urls: string[]): string[] => [
  'https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa',
  'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en',
  ...urls,
];

const MFA_URL = 'https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa';

const guide = (
  input: Omit<CountryGuide, 'updatedAt'> & Partial<Pick<CountryGuide, 'updatedAt'>>,
): CountryGuide => ({ ...input, updatedAt: input.updatedAt ?? UPDATED });

/* ------------------------------------------------------------------ */
/* Ülkeler                                                             */
/* ------------------------------------------------------------------ */

export const seedCountryGuides: CountryGuide[] = [
  guide({
    countryCode: 'NP',
    name: 'Nepal',
    region: 'Güney Asya · Himalaya',
    languages: ['ne', 'en'],
    currency: 'NPR',
    tryRate: 0.33,
    timezone: 'UTC+5:45',
    plugTypes: ['C', 'D', 'M'],
    visa: {
      type: 'on_arrival',
      maxStayDays: 90,
      costTry: 1350,
      processingDays: 0,
      url: 'https://nepaliport.immigration.gov.np',
      note: "Tribhuvan Havalimanı'nda varışta vize: 15 gün 30 $, 30 gün 50 $, 90 gün 125 $. Kiosktan form doldur ya da immigration.gov.np üzerinden 15 gün önce çevrimiçi ön başvuru yap; nakit USD hazır olsun (kart bazen çalışmaz). Kara sınırlarında (Kodari, Rasuwagadhi, Belahiya) da veriliyor.",
    },
    documents: [
      passport(6),
      visaDoc('Varışta alınır; bir yıl içinde toplam 150 gün sınırı var.', false),
      insurance(
        'Helikopter tahliyesi (Lukla/Pheriche→Kathmandu 3.000–5.000 $) ve 6.000 m irtifa kapsamı şart; sigortasız tahliye peşin ödeme ister.',
      ),
      permit(
        'tims',
        'TIMS kartı',
        "Trekkers' Information Management System — Nepal Tourism Board (Kathmandu/Pokhara) ya da acente üzerinden; 2023'ten beri çoğu bölgede rehberle trek zorunlu.",
      ),
      permit(
        'park_permit',
        'Milli park / koruma alanı izni (ACAP, Sagarmatha, Langtang)',
        'ACAP 3.000 NPR, Sagarmatha 3.000 NPR + Khumbu Pasang Lhamu kırsal belediye ücreti 2.000 NPR. Fotoğraf ve pasaport kopyası gerekir.',
      ),
      permit(
        'restricted_permit',
        'Kısıtlı bölge izni (Manaslu, Upper Mustang, Dolpo)',
        'Yalnızca kayıtlı acente aracılığıyla, en az 2 trekker; Upper Mustang 10 gün 500 $.',
        false,
      ),
      photos(),
      cashUsd("Vize ücreti için yeni seri USD; Thamel'de ATM var ama dağda yok."),
      vaccineCard(),
      returnTicket(),
    ],
    etiquette: [
      '"Namaste" ile selamlaş (avuçlar birleşik, hafif baş eğme); tokalaşma erkekler arası yaygın, kadına önce elini uzatma.',
      'Sol el kirli sayılır: yemek, para ve eşya verirken sağ eli kullan.',
      'Tapınak ve evlere ayakkabısız gir; deri kemer/cüzdan bazı Hindu tapınaklarına alınmaz.',
      'Stupa ve mani taşlarının etrafında saat yönünde dolaş (sol taraf senin).',
      'Ayakla bir şeye ya da birine işaret etme; ayaklarını insanlara doğru uzatma.',
      'Başa dokunmak (çocuklar dahil) saygısızlık sayılır.',
      'Tabaktan artmış yemeği ("jutho") başkasına ikram etme; su şişesini dudağa değdirmeden iç.',
      'Sherpa evinde ocak kutsaldır; çöp ve kâğıt atma, ateşin üstünden geçme.',
    ],
    dressCode:
      "Kathmandu'da omuz ve diz kapalı rahat giyim; tapınaklarda omuzlar örtülü. Trek'te teknik giyim normal karşılanır; köylerde tayt üzerine şort/etek iyi görülür. Pashupatinath'a kısa şortla giriş sorun çıkarabilir.",
    religionNotes:
      "Nüfusun %80'i Hindu, %9'u Budist; ikisi iç içe. Pashupatinath'ın ana tapınağına Hindu olmayanlar giremez, dışarıdan ve Bagmati kıyısından izlenir; ölü yakma törenlerini yakından fotoğraflama. Manastırlarda (gompa) rahiplere para değil \"khata\" (beyaz eşarp) sunulur. İnek kutsaldır, yolda öncelik ineğindir.",
    photographyRules:
      "İnsanları çekmeden önce izin iste; sadhu'lar (kutsal adam) poz için 100–200 NPR bekler. Askeri tesis, köprü ve havalimanı çekimi yasak. Tapınak içlerinde ve ölü yakma alanında çekim yapma. Yerel halkın ibadetini uzaktan çek.",
    tipping:
      'Trek ekibine bahşiş beklenir: rehber günde 10–15 $, porter günde 5–10 $ (grup toplamı ekibe zarfla). Lokantada %10 servis eklenmemişse yuvarla. Taksi şoförüne bahşiş şart değil.',
    bargaining:
      "Thamel ve sokak pazarlarında pazarlık normal; söylenen fiyatın %50–60'ından başla, gülümseyerek bitir. Süpermarket, lokanta ve lodge menülerinde pazarlık yok. Taksi için yola çıkmadan fiyat anlaş ya da Pathao/inDrive kullan.",
    watchOut: [
      'Sahte "lisanslı rehber": Thamel\'de yaklaşan rehberleri değil, NTB kayıtlı acente/rehberi (lisans kartı) tercih et; rehberli trek zorunluluğunu bahane eden fahiş fiyatlara dikkat.',
      'Taksi: havalimanı taksileri 3–4 kat ister; ön ödemeli taksi gişesi ya da Pathao kullan; "taksimetre bozuk" klasik.',
      '"Tapınak kapalı" oyunu: yabancı, "bugün kapalı, seni başka yere götüreyim" diyerek komisyonlu dükkâna götürür — sen kendin kontrol et.',
      'Çocuklara "süt tozu al" hilesi: dükkândan aldığın süt geri satılır; yerine kayıtlı yardım kuruluşlarına bağış yap.',
      'Sokak köpekleri: geceleri sürü halinde, kuduz riski var; ısırıkta 24 saat içinde aşı için CIWEC/Norvic hastanesi.',
      'Su ve ishal: musluk suyu içilmez, buz ve yıkanmamış salatadan kaçın; filtre/klor tableti taşı (plastik şişe azalt).',
      "Yüksek irtifa: Namche ve Manang'da aklimatizasyon günü atlama; Diamox reçete ettir, AMS belirtilerini gizleme.",
      'Yol trafiği: Prithvi Highway ve dağ yolları kaza riski yüksek; gece otobüsüne binme, mümkünse gündüz git.',
    ],
    womenTravelers:
      "Genel olarak güvenli; Kathmandu'da gece yalnız yürümek ve kalabalık otobüslerde taciz nadir ama olabilir. Kadın rehber/porter isteyebilirsin (3 Sisters, Empowering Women of Nepal). Muhafazakâr kırsalda regl döneminde tapınağa girmemek yerel beklentidir; hijyen ürünlerini şehirden al.",
    laws: [
      'Drone: her uçuş için Sivil Havacılık (CAAN) izni ve milli parklarda ayrıca park müdürlüğü izni; Everest bölgesinde izinsiz drone el konur.',
      "Alkol: 18 yaş; dağ lodge'larında satılır ama irtifada AMS riskini artırır.",
      "Uyuşturucu: esrar yasa dışıdır (Shivaratri'de sadhu'lar hariç), yakalanmada hapis.",
      'LGBTİ+: eşcinsellik yasal, üçüncü cinsiyet resmî olarak tanınıyor; kırsalda alenilik yadırganabilir.',
      'Vahşi kamp: milli parklarda belirlenmiş alan dışında yasak; ateş yakmak yasak, lodge sistemi kullan.',
      'İnek kesmek ve inciteşmek ağır suçtur; dini eserleri çıkarmak yasak.',
    ],
    droneRules:
      "CAAN izni (nepal.caan.gov.np) + Turizm Bakanlığı + park izni; süreç 2–4 hafta ve ücretli. Sagarmatha ve Annapurna'da izinsiz uçuşta cihaza el konulur.",
    alcoholRules:
      '18 yaş; her yerde satılır. Dashain/Tihar bayramlarında yerel "raksi" ikram edilebilir, kibarca az iç.',
    money:
      "Nepal Rupisi (NPR) — 1 NPR ≈ ₺0,33. ATM'ler Thamel, Pokhara ve Namche'de (Namche'de sık boşalır); günlük çekim 35.000 NPR, işlem ücreti 500 NPR. Trek boyunca nakit taşı: Everest'te günlük 4.000–6.000 NPR (lodge + yemek + şarj + Wi-Fi). Kart yalnızca büyük otel/acentelerde.",
    connectivity:
      "Havalimanında Ncell/NTC SIM 5 dk (pasaport fotokopisi + fotoğraf); 10 GB ≈ 700 NPR. Ncell Everest'te Namche'ye kadar, NTC Annapurna'da daha iyi. Everest Link kartı (600 NPR/gün) ve lodge Wi-Fi ücretli. eSIM (Airalo \"Nepal\") çalışır ama yavaş.",
    health: [
      'Musluk suyu içilmez; ishal için ORS ve gerekirse reçeteli antibiyotik taşı.',
      'Yüksek irtifa: günde 300–500 m üstü uyuma yüksekliği artışı; AMS belirtilerinde in, çıkma.',
      'Sıtma yalnızca Terai ovasında (Chitwan) mevsimsel; Kathmandu ve dağlarda yok.',
      "Hava kirliliği Kathmandu'da kışın ciddi; maske yararlı.",
      'Kuduz: sokak köpeği ve maymun ısırığında hemen hastane.',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos-difteri',
      'Hepatit B',
      'Kuduz (uzun trek)',
      'Japon ensefaliti (Terai, uzun süre)',
    ],
    bestMonths: [3, 4, 10, 11],
    dailyTips: [
      "Kathmandu'da elektrik kesintisi normal; powerbank ve baş lambası şehirde bile işe yarar.",
      'Dal bhat "24 saat güç" — lodge\'da tabak dolumu ücretsizdir, en ekonomik öğün.',
      'Lukla uçuşu hava yüzünden iptal olabilir; dönüşe 2–3 gün tampon bırak.',
      'Sıcak duş ve şarj irtifada ücretli (200–600 NPR); güneş enerjili şarj cihazı taşı.',
      "Namche'nin cumartesi pazarı ve Pokhara'nın Lakeside'ı gündüz gez; gece 22:00 sonrası sokaklar boşalır.",
    ],
    sources: [
      'https://www.immigration.gov.np',
      'https://ntb.gov.np',
      'https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa',
      'https://katmandu.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'IN',
    name: 'Hindistan',
    region: 'Güney Asya · Himalaya',
    languages: ['hi', 'en'],
    currency: 'INR',
    tryRate: 0.52,
    timezone: 'UTC+5:30',
    plugTypes: ['C', 'D', 'M'],
    visa: {
      type: 'e_visa',
      maxStayDays: 30,
      costTry: 1150,
      processingDays: 4,
      url: 'https://indianvisaonline.gov.in/evisa/',
      note: 'e-Tourist Visa: 30 gün çift giriş 25 $, 1 yıl 40 $, 5 yıl 80 $. Yalnızca resmî site (indianvisaonline.gov.in); taklit siteler 3 kat ücret alır. Onay PDF\'ini bas; belirlenen havalimanlarından giriş. Ladakh/Sikkim gibi bölgeler ek "Inner Line Permit" ister.',
    },
    documents: [
      passport(6),
      visaDoc('e-Visa onayı (ETA) çıktısı; girişte parmak izi alınır.'),
      insurance('Ladakh/Himachal irtifa ve helikopter tahliye kapsamı.'),
      permit(
        'ilp',
        'Inner Line / Protected Area Permit',
        "Ladakh Nubra-Pangong, Sikkim Kuzey, Arunachal için; Leh'te DC ofisi ya da acente üzerinden 1 gün.",
        false,
      ),
      returnTicket(true),
      cashUsd(),
      vaccineCard(),
    ],
    etiquette: [
      '"Namaste" ve baş sallama (yana-yukarı) evet/anlaşıldı anlamına gelir.',
      'Sağ elle yemek ve alışveriş; ayakkabılar tapınak ve evde çıkarılır.',
      "Sikh gurdwara'larında baş örtülür, sigara ve tütünle giriş yasak.",
      'Kadınla fiziksel temas (tokalaşma dahil) o başlatmadıkça bekleme.',
      'Sokakta öpüşme/sarılma yadırganır; büyük şehirde bile ölçülü ol.',
      'Kast ve din tartışmasına girme; siyasi konularda dinle.',
      '"Chai" ikramını kabul etmek dostluk işaretidir.',
    ],
    dressCode:
      "Dizler ve omuzlar kapalı; kadınlar için hafif şal her yerde işe yarar. Ladakh'ta dağ giyimi normal, Goa plajları rahat. Tapınaklara giriş için uzun pantolon.",
    religionNotes:
      'Hindu çoğunluk, %14 Müslüman, Sikh ve Budist bölgeler (Ladakh). Bazı tapınaklara Hindu olmayanlar giremez (Jagannath Puri). Camilere Cuma namazında turist alınmaz; deri ürünler Jain tapınaklarına giremez. İnek kutsaldır.',
    photographyRules:
      "İnsanlara izin sorulur; kadınları izinsiz çekme. Askeri bölgeler, sınır (Ladakh'ta çok), köprü, havalimanı ve bazı tapınak içleri yasak. Taj Mahal içinde çekim yok.",
    tipping:
      "Lokantada %5–10 (servis ücreti yoksa), otel taşıyıcısına 50–100 INR, şoför/rehbere günde 300–500 INR. Trek ekibine Nepal'e benzer bahşiş.",
    bargaining:
      'Pazarda ve tuk-tuk için pazarlık şart; yarıdan başla. Sabit fiyatlı "government emporium" mağazaları pazarlıksız. Ola/Uber ile taksi tartışmasından kurtul.',
    watchOut: [
      'Havalimanı/tren istasyonu "yardımcı"ları: "bilet ofisi kapandı, turizm ofisine gidelim" oyunu — resmî IRCTC gişesini kendin bul.',
      'Sahte turizm ofisleri (Delhi Connaught Place çevresi) pahalı paket satar; "Government of India Tourism" tabelasını doğrula.',
      'Tuk-tuk şoförünün "otelin yandı/kapandı" hikâyesi; otelini kendin ara.',
      'Kalabalıkta yankesicilik (Delhi metro, Varanasi ghat); para kemeri kullan.',
      'Sokak köpekleri ve maymunlar (Rishikesh, Shimla): yiyecek gösterme, ısırıkta kuduz aşısı.',
      'Trafik: karşıdan karşıya yerlilerle birlikte geç; gece şehirler arası araç yolculuğu tehlikeli.',
      'Su: yalnızca kapalı şişe; buzlu içecek ve sokak "lassi" riskli.',
      "Ladakh'ta ilk 2 gün dinlen (Leh 3.500 m), uçuşla gelenler AMS'ye açık.",
    ],
    womenTravelers:
      'Gündüz kalabalık yerler güvenli; gece yalnız dolaşma ve gece otobüsünden kaçın. Trenlerde "ladies compartment" ve metroda kadın vagonu var. Bakışlar rahatsız edebilir, kapalı giyim ve kararlı tavır yardımcı olur. Acil kadın yardım hattı 1091.',
    laws: [
      'Drone: DGCA Digital Sky kaydı zorunlu; yabancılar için pratikte izin çok zor, milli park ve sınır bölgelerinde yasak.',
      'Alkol: eyalete göre 18–25 yaş; Gujarat, Bihar ve Mizoram\'da yasak ("kuru" eyaletler), bazı günlerde ("dry day") satılmaz.',
      'Uyuşturucu: NDPS yasası çok sert, küçük miktar için bile hapis.',
      "LGBTİ+: 2018'den beri eşcinsel ilişki suç değil; evlilik tanınmıyor, sosyal kabul şehirlere göre değişir.",
      'İnek eti bulundurmak bazı eyaletlerde suç; kaçak antika çıkarmak yasak.',
      'Uydu telefonu (Thuraya/Iridium) yasak; Garmin inReach dahil el konabilir — resmî kaynağı kontrol et.',
    ],
    droneRules:
      'Yabancı turist için pratikte imkânsız; cihaz gümrükte beyan edilmeli. Ladakh ve Himachal dağlarında çekim yasağı.',
    alcoholRules:
      "Eyalete göre farklı; Ladakh ve Himachal'da satış serbest, Gujarat'ta turist izni gerekir. Sokakta içmek yasak.",
    money:
      'Hint Rupisi (INR) — 1 INR ≈ ₺0,52. ATM yaygın (SBI, HDFC); kart kırsalda az. UPI ödemesi yabancı kartla sınırlı; nakit taşı. 2.000 INR banknotları tedavülden kalktı, kabul etme.',
    connectivity:
      "Jio/Airtel SIM: pasaport + vize kopyası + fotoğraf, aktivasyon 1–24 saat; 28 gün sınırsız data ≈ 300–400 INR. Ladakh'ta yalnızca postpaid Jio/Airtel/BSNL çalışır — Leh'e varmadan al. eSIM (Airalo) şehirlerde iyi.",
    health: [
      'Su ve gıda güvenliği en büyük risk; "cook it, peel it or leave it".',
      "Sıtma: kuzeydoğu ve muson döneminde ovalar; Ladakh ve Himalaya'da yok.",
      'Dang: muson sonrası şehirlerde; sivrisinek koruması.',
      "Hava kirliliği Delhi'de kışın tehlikeli seviyede.",
      'Yüksek irtifa: Leh, Spiti, Sikkim geçitleri (Khardung La 5.359 m).',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz',
      'Japon ensefaliti (kırsal, uzun)',
    ],
    bestMonths: [10, 11, 2, 3],
    dailyTips: [
      'Tren biletini IRCTC\'den yabancı kotası ile önceden al; "tatkal" son gün açılır.',
      'Metroda güvenlik kontrolü var, çantada bıçak/çakı sorun olur.',
      'Sokak yemeği için kalabalık ve dönen tezgâhı seç; sabahın erken saatleri en temiz.',
      'Pazarlık sonrası gülümse; sert konuşmak ilişkileri kapatır.',
      'Elektrik kesintisi ve gürültü için kulak tıkacı, powerbank.',
    ],
    sources: ['https://indianvisaonline.gov.in/evisa/', MFA_URL, 'https://yenidelhi.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'PK',
    name: 'Pakistan',
    region: 'Güney Asya · Karakurum',
    languages: ['ur', 'en'],
    currency: 'PKR',
    tryRate: 0.16,
    timezone: 'UTC+5',
    plugTypes: ['C', 'D'],
    visa: {
      type: 'e_visa',
      maxStayDays: 90,
      costTry: 1600,
      processingDays: 10,
      url: 'https://visa.nadra.gov.pk',
      note: 'Pakistan Online Visa: Türk vatandaşları "Business/Tourist" için başvurabilir; Türkiye ile karşılıklı dostluk kapsamında ücret indirimi olabilir — resmî kaynağı kontrol et. Trekking (K2 Base Camp, Nanga Parbat) için ayrıca "trekking permit" ve kısıtlı bölgelerde irtibat subayı (LO) zorunlu.',
    },
    documents: [
      passport(6),
      visaDoc('e-Visa onayı; davet/otel rezervasyonu ve tur programı yüklenir.'),
      insurance(
        "Karakurum'da helikopter tahliyesi (Askari Aviation) yalnızca peşin ödeme/sigorta teyidiyle; 5.000 m üstü kapsam şart.",
      ),
      permit(
        'trekking_permit',
        'Trekking izni + irtibat subayı (LO)',
        "Açık bölge trek'leri (Fairy Meadows, Hunza) izinsiz; K2/Baltoro ve kısıtlı bölgeler için Gilgit-Baltistan Turizm + acente üzerinden 4–6 hafta.",
        false,
      ),
      hotelBooking(),
      photos(),
      cashUsd("Gilgit-Baltistan'da ATM güvenilmez; USD/EUR nakit ve PKR taşı."),
      vaccineCard(),
    ],
    etiquette: [
      '"Assalamu alaikum" ile selamlaş; erkekler tokalaşır, kadına el uzatmayı bekle.',
      'Türk olduğunu söylemek kapı açar ("Türk kardeş"); misafirperverlik çok yoğundur, çay reddetme.',
      'Sağ elle ye; ayakkabı cami ve evde çıkar.',
      "Ramazan'da gündüz açıkta yeme-içme yapma.",
      'Kadınların fotoğrafını çekme, kadınlarla sohbeti erkekler başlatmasın.',
      'Yaşlılara "ji" ekleyerek hitap et; ev sahibine küçük hediye (Türk lokumu) götür.',
    ],
    dressCode:
      "Erkekler uzun pantolon; kadınlar bol pantolon/tunik ve şal (shalwar kameez yerlilerce çok takdir edilir). Hunza'da daha rahat; Peşaver ve kırsal Pencap'ta muhafazakâr.",
    religionNotes:
      "Sünni çoğunluk, Hunza'da İsmaili (daha liberal), Baltistan'da Şii. Camilere ziyaret genelde mümkün, kadınlar başörtüsü ile. Ramazan ve Muharrem dönemlerinde saygılı ol; Aşure günlerinde Şii bölgelerde kalabalıklardan uzak dur.",
    photographyRules:
      "Askeri tesisler, köprüler, barajlar, kontrol noktaları ve havalimanları kesinlikle yasak (Karakurum Karayolu'nda çok sayıda kontrol noktası). Kadınları çekme; erkeklerden izin al, çoğu memnun olur.",
    tipping:
      'Lokantada %5–10, otel çalışanına 100–200 PKR. Trek ekibinde porter günde 3–5 $, rehber 10 $; sirdar/aşçıya ayrıca. Şoförlere uzun yolda 500–1.000 PKR.',
    bargaining:
      "Pazar, tekstil ve taksi için pazarlık; Hunza'da az pazarlık. Careem uygulaması İslamabad/Lahor/Karaçi'de taksi tartışmasını bitirir.",
    watchOut: [
      'Güvenlik: Belucistan, KP kabile bölgeleri ve Afgan sınırına gitme; Dışişleri uyarılarını takip et.',
      'Kontrol noktalarında pasaport + vize fotokopisi (10 adet) hazır tut; yabancılar bazı yollarda polis eskortuyla gider.',
      'Karakurum Karayolu heyelan/kaya düşmesi: gece yolculuğu yapma, yağmurda bekle.',
      'Fairy Meadows jeep yolu dünyanın en tehlikeli yollarından; deneyimli şoför seç.',
      '"Arkadaş" olup para/ev alma vaadiyle dolandırıcılık nadir; daha çok abartılı misafirperverlik yorar, kibarca sınır koy.',
      "Dolandırıcılık az ama İslamabad'da sahte polis para kontrolü iddiası olabilir; kimlik iste, karakola gitmeyi teklif et.",
      'Sokak köpekleri gece kırsalda saldırgan; sopa/ışık taşı.',
      'Yüksek irtifa: Khunjerab Geçidi 4.700 m, Deosai 4.100 m — hızlı araçla çıkış AMS yapar.',
    ],
    womenTravelers:
      "Yerel kadınlarla iletişim güçlü ve samimi; erkeklerin bakışı yoğun olabilir. Yalnız kadın gezgin Hunza ve Skardu'da rahat, Pencap'ta daha dikkatli. Uzun mesafede grupla ya da güvenilir şoförle seyahat et; otel seçimini incelemelere göre yap.",
    laws: [
      "Drone: yabancılar için pratikte yasak; havalimanında el konabilir, Gilgit-Baltistan'da özel izin gerekir.",
      'Alkol: Müslümanlara yasak; yabancılar bazı otel barlarında izinle alabilir. Halka açık içmek suç.',
      'Uyuşturucu: ağır cezalar, esrar dahil.',
      'LGBTİ+: eşcinsel ilişki suçtur; alenilikten kaçın, sosyal görünürlük yok.',
      'Din: İslam\'a hakaret ("blasphemy") ölüm cezası taşıyan suçtur — dini konularda espri yapma.',
      "Kamp: milli park ve kısıtlı alanlar izinli; Deosai'de belirlenmiş kamp alanları.",
    ],
    droneRules:
      'Sivil Havacılık (PCAA) izni gerekir, turist için verilmez. Beyan etmeden sokmak cihaza el konmasına yol açar.',
    alcoholRules:
      'Yalnızca izinli otel barları (Islamabad Marriott gibi) ve gayrimüslimlere izinli satış. Yanında alkolle yakalanmak ceza doğurur.',
    money:
      "Pakistan Rupisi (PKR) — 1 PKR ≈ ₺0,16. Büyük şehirlerde ATM (HBL, UBL); Gilgit'te sınırlı, Skardu'da bir-iki ATM. USD/EUR nakit bozdur; kart yalnızca büyük oteller. Günlük bütçe trek dışında 3.000–6.000 PKR.",
    connectivity:
      'Zong/Jazz SIM: pasaport ve vize ile "tourist SIM" havalimanı standlarından; 30 gün 20 GB ≈ 1.500 PKR. Gilgit-Baltistan\'da yalnızca SCOM (yerel) ve Zong çalışır; Baltoro\'da hiçbir şey — uydu cihazı için özel izin şart.',
    health: [
      'Şişe suyu; buz ve açık meyve suyu riskli.',
      "Sıtma güneyde ve muson sonrası; dağlarda yok. Dang Karaçi ve Lahor'da.",
      "Çocuk felci hâlâ endemik; Türkiye'den ek doz öner (resmî kaynağı kontrol et).",
      'Yüksek irtifa: Concordia 4.600 m, Khunjerab.',
      "Yaz ısı dalgaları Pencap ve Sind'de 45 °C üstü.",
    ],
    vaccines: ['Hepatit A', 'Tifo', 'Tetanos', 'Hepatit B', 'Kuduz', 'Çocuk felci pekiştirme'],
    bestMonths: [5, 6, 9, 10],
    dailyTips: [
      'Cuma öğle namazı saatinde dükkânlar kapanır; planını buna göre yap.',
      'Kadınlar için ayrı kuyruk ve bekleme alanları vardır, kullan.',
      'Çay (doodh patti) günde beş kez ikram edilir; reddetmek yerine az iç.',
      "İslamabad'dan Gilgit uçuşu hava yüzünden sık iptal; karayolu 14–18 saat.",
      "Hunza'da kayısı sezonu (Temmuz) yerel ürünleri destekle; plastik atığı geri getir.",
    ],
    sources: ['https://visa.nadra.gov.pk', MFA_URL, 'https://islamabad.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'GE',
    name: 'Gürcistan',
    region: 'Kafkasya',
    languages: ['ka', 'ru', 'en'],
    currency: 'GEL',
    tryRate: 16.5,
    timezone: 'UTC+4',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 365,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.geoconsul.gov.ge',
      note: 'Türk vatandaşları 1 yıla kadar vizesiz; yeni tip kimlik kartı ile de giriş yapılabilir (Sarp, Türkgözü, Aktaş kara kapıları). Araçla girişte yeşil kart/yerel trafik sigortası gerekir.',
    },
    documents: [
      doc(
        'passport',
        'Pasaport ya da yeni tip kimlik kartı',
        true,
        'Kimlikle girişte yurt dışı çıkış harcı yine ödenir; pasaport uçuşlarda daha sorunsuz.',
      ),
      insurance(
        "Kazbek (5.054 m) tırmanışı için irtifa ve helikopter kapsamı; Gürcistan'da kurtarma (112) ücretsiz ama helikopter sınırlı.",
      ),
      permit(
        'border_zone',
        'Sınır bölgesi izni (Tuşeti/Hevsureti/Kazbek sınır şeridi)',
        "Rusya sınırına 5 km'den yakın rotalarda (Shatili, Kazbek kuzey yamacı, Tuşeti geçitleri) Sınır Polisi izni; Mestia/Tbilisi'den ücretsiz, 1–3 gün.",
        false,
      ),
      idp(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      'Gürcü sofrasında (supra) "tamada" kadeh kaldırır; ilk kadehi bitirmeden içme, kadeh sırasında konuşmaya katıl.',
      'Kadeh tokuştururken göz teması; "gaumarjos!" (şerefe).',
      'Kiliseye girişte kadınlar baş örter, erkekler şapka çıkarır; şort ile girilmez (girişte etek verilir).',
      'Misafirlik ciddi iştir; eve gidiyorsan şarap ya da tatlı götür.',
      'Rusya ve Abhazya konuları hassastır; "Rusya işgali" dışında yorum yapma.',
      "Türk olduğunu söylemek çoğu yerde olumlu karşılanır; Acara'da Türkçe yaygındır.",
    ],
    dressCode:
      "Tiflis gündelik rahat; kiliselerde omuz-diz kapalı, kadınlar başörtü. Dağ köylerinde muhafazakâr ama turistlere alışık. Svaneti'de sıcak giysi yaz ortasında bile.",
    religionNotes:
      "Gürcü Ortodoks kilisesi çok saygın; ayin sırasında fotoğraf ve konuşma yok. Acara ve Kvemo Kartli'de Müslüman topluluklar. Mum satın alıp yakmak yaygın ziyaret jestidir.",
    photographyRules:
      'Serbest; kiliselerde ikonları ve ayini flaşsız ve izinle çek. Askeri alanlar, Rus sınırı kontrol noktaları ve Sınır Polisi izinli bölgelerde çekim yasak.',
    tipping:
      'Lokantada %10 çoğunlukla hesaba eklenir ("service"); eklenmemişse bırak. Taksi için yuvarla. Dağ rehberi/at sahibine günde 20–30 GEL.',
    bargaining:
      'Deserter Bazaar, Dry Bridge bit pazarı ve marşrutka özel kiralamada pazarlık; lokanta ve mağazalarda yok. Bolt uygulaması taksi pazarlığını ortadan kaldırır.',
    watchOut: [
      'Tiflis "bar dolandırıcılığı": Rustaveli\'de yabancı "kızlar" bara davet eder, hesap binlerce GEL gelir — tanımadığın kişinin seçtiği bara gitme.',
      'Havalimanı taksileri: sabit fiyat yerine Bolt çağır; gece 2–3 kat isterler.',
      'Trafik: hızlı ve kuralsız sürüş, Kazbegi askeri yolu ve Svaneti yolunda kamyon-tır; marşrutkalarda emniyet kemeri yok.',
      'Sokak köpekleri: sarı kulak etiketi = aşılı, genelde uysal; dağ köylerinde çoban köpekleri (Kafkas çoban köpeği) sürüyü korurken saldırır, geniş daireden geç.',
      'Chacha (üzüm rakısı) %50–60 alkol; sofrada temposunu ayarla.',
      "Kazbek'te hava aniden bozar, Meteo Station (3.650 m) üstünde buzul çatlakları — rehbersiz çıkma.",
      "Abhazya ve Güney Osetya'ya Rusya tarafından giriş Gürcistan'da suç; sınırı kazara geçme.",
      'Yankesicilik nadir ama metro ve Dezerter pazarı kalabalığında çanta önde.',
    ],
    womenTravelers:
      'Genel olarak çok güvenli; Tiflis gece yürüyüşleri rahat. Dağ köylerinde erkeklerin "chacha" ısrarı olabilir, nazikçe reddetmek yeterli. Ev pansiyonlarında kadın ev sahipleri ile güçlü ağ.',
    laws: [
      'Drone: 250 g üstü için Sivil Havacılık Ajansı kaydı; şehir merkezleri, havalimanı çevresi ve sınır bölgelerinde yasak, milli parklarda izin.',
      'Alkol: 18 yaş; araç kullanırken 0,3‰ üstü suç.',
      'Uyuşturucu: esrar kullanımı suç değil ama bulundurma/satış cezalı; uyuşturucu testi polis tarafından yapılabilir.',
      'LGBTİ+: yasal ama 2024 yasasıyla "propaganda" kısıtlamaları getirildi; alenilikten kaçın, Tiflis\'te LGBTİ+ dostu mekânlar var.',
      'Vahşi kamp serbest (özel mülk ve koruma alanı hariç); milli parklarda belirlenmiş alanlarda ateş.',
      'Sınır şeridinde izinsiz dolaşmak gözaltı nedeni.',
    ],
    droneRules:
      'GCAA kaydı ve 120 m sınırı; Tiflis eski şehir, Gergeti kilisesi çevresi ve askeri yol boyunca yasak alanlar var; sınır bölgelerinde uçurma.',
    alcoholRules:
      '18 yaş; marketten 24 saat. Kilise ve dini bayramlarda sarhoş dolaşmak ayıp sayılır.',
    money:
      "Lari (GEL) — 1 GEL ≈ ₺16,5. ATM her yerde (Bank of Georgia, TBC); kart yaygın, dağ köylerinde nakit. Döviz büroları Tiflis ve Batum'da iyi kur verir, TL bozulur. Günlük bütçe 80–150 GEL.",
    connectivity:
      'Magti/Geocell/Beeline SIM havalimanında pasaportla anında; 30 gün sınırsız ≈ 30 GEL. Magti dağlarda (Kazbegi, Svaneti, Tuşeti) en iyi kapsama. eSIM (Airalo) şehirde yeterli.',
    health: [
      'Musluk suyu büyük şehirlerde içilebilir, dağda kaynak suyu genelde temiz.',
      'Kene (Mayıs–Eylül) otlaklarda; KKKA riski düşük ama kontrol et.',
      "Kazbek ve Ushba'da irtifa; Stepantsminda 1.700 m'de bir gün dinlen.",
      "Çoban köpeği ısırığında kuduz aşısı Tiflis'te ücretsiz.",
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Kene ensefaliti (uzun süre orman)', 'Kuduz (isteğe bağlı)'],
    bestMonths: [5, 6, 7, 8, 9, 10],
    dailyTips: [
      'Marşrutka (minibüs) ana ulaşım; Didube garından kalkar, dolunca hareket eder.',
      'Khinkali yerken üst kısmı tutup içini yudumla; sapını tabakta bırakmak normal.',
      'Tulum şarabı (kvevri) ev yapımı; "sadece bir kadeh" diye başlar, sofrada su iste.',
      "Kazbegi'de Gergeti kilisesine yürüyerek çık (1,5 saat); 4x4 yerine tırmanış.",
      'Pazar günü kiliseler kalabalık; turistik ziyaret için hafta içi sabah.',
    ],
    sources: ['https://www.geoconsul.gov.ge', MFA_URL, 'https://tiflis.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'AM',
    name: 'Ermenistan',
    region: 'Kafkasya',
    languages: ['hy', 'ru', 'en'],
    currency: 'AMD',
    tryRate: 0.115,
    timezone: 'UTC+4',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'e_visa',
      maxStayDays: 120,
      costTry: 1400,
      processingDays: 5,
      url: 'https://evisa.mfa.am',
      note: 'Türk vatandaşları e-vize (21 gün 7 $ / 120 gün 31 $) ya da varışta vize alabilir; Türkiye–Ermenistan kara sınırı kapalı, giriş Gürcistan (Bagratashen) veya Zvartnots Havalimanı üzerinden. Kurallar normalleşme sürecine bağlı değişebilir — resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      visaDoc('e-Vize onayı çıktısı; varışta da alınabilir ama kuyruk uzun.'),
      insurance('Aragats (4.090 m) ve kırsal alan için tahliye kapsamı.'),
      returnTicket(),
      cashUsd('Erivan dışında döviz bozdurmak zor.'),
      vaccineCard(),
    ],
    etiquette: [
      '"Barev dzez" (merhaba) ve "shnorhakalutyun" (teşekkür) yeterli; Rusça yaygın, İngilizce gençlerde.',
      'Türk kimliği hassas konu; 1915 tartışmasına girme, saygılı ve dinleyen tavır al.',
      'Sofrada kadeh konuşmaları uzun; ekmek (lavaş) kutsal, yere atılmaz.',
      'Kiliselerde başörtü kadınlar için beklenir, mum yakma geleneği.',
      'Yaşlılara öncelik ve ayakta yer verme normdur.',
      'Evde ayakkabı çıkarılır; ev sahibine tatlı/konyak götür.',
    ],
    dressCode:
      'Erivan modern; kiliselerde diz-omuz kapalı. Dağ ve kırsalda rahat outdoor giyim normal.',
    religionNotes:
      "Ermeni Apostolik Kilisesi (dünyanın ilk Hristiyan devleti); Eçmiadzin ve Geghard'da ayin sırasında sessizlik. Yezidi köyleri (Aragats eteği) farklı gelenek; misafirperverliğe saygı.",
    photographyRules:
      'Serbest; askeri tesisler, Azerbaycan ve Türkiye sınırı gözlem noktaları yasak. Kiliselerde ayini çekme. Metro ve devlet binalarında sorulabilir.',
    tipping:
      'Lokantada %10 servis eklenir; eklenmemişse bırak. Taksi için yuvarla; dağ rehberine günde 10.000 AMD.',
    bargaining: 'Vernissage pazarında pazarlık normal; taksi için GG/Yandex uygulaması kullan.',
    watchOut: [
      'Azerbaycan sınırına (Tavush, Syunik) yakın yollarda nişancı ateşi riski olabilir; güncel durumu kontrol et.',
      'Taksiler taksimetre kullanmaz; uygulama ya da önceden anlaşma.',
      'Trafik agresif; gece kırsal yollar ışıksız, ineğe/atlara dikkat.',
      "Sokak köpekleri Erivan'da uysal, kırsalda çoban köpeği (gampr) sürü koruyucu.",
      "Aragats'ta gündüz fırtına ve dolu; erken çıkış, öğlen dönüş.",
      'Kimlik kontrolünde Türk pasaportuna ilgi olabilir; sakin ve kibar kal.',
      'Yankesicilik nadir; sahte döviz bürolarında düşük kur.',
    ],
    womenTravelers:
      'Erivan çok güvenli; gece yürüyüş sorunsuz. Kırsalda geleneksel roller güçlü ama misafire saygı yüksek. Yalnız kadın gezgin için homestay ağı güçlü.',
    laws: [
      'Drone: 250 g üstü kayıt; Erivan merkezi, havalimanı ve sınır şeridi yasak.',
      'Alkol: 18 yaş; sürüşte sıfır tolerans.',
      'Uyuşturucu: bulundurma suç, ağır ceza.',
      'LGBTİ+: yasal ama sosyal kabul düşük; alenilikten kaçın.',
      'Vahşi kamp genel olarak serbest, koruma alanlarında (Dilijan, Khosrov) izinli.',
    ],
    droneRules:
      'Sivil Havacılık kaydı; kilise ve tarihi alanlarda çekim için ayrı izin. Sınır bölgeleri (Türkiye sınırı Ağrı Dağı manzarası dahil) askeri alan sayılır.',
    alcoholRules: '18 yaş; konyak ve şarap kültürü güçlü, sofrada "bir kadeh daha" ısrarı olur.',
    money:
      "Dram (AMD) — 1 AMD ≈ ₺0,115. ATM yaygın, kart Erivan'da iyi; kırsalda nakit. USD/EUR/RUB bozulur, TL zor.",
    connectivity:
      'Viva-MTS/Ucom/Team SIM pasaportla 5 dk; 30 gün 20 GB ≈ 4.000 AMD. Dağlarda Viva-MTS en iyi. eSIM (Airalo) mevcut.',
    health: [
      'Musluk suyu Erivan\'da içilebilir ("pulpulak" çeşmeleri temiz).',
      "Aragats ve Azhdahak'ta irtifa; güneş yanığı yüksek.",
      'Yaz sıcakları 40 °C; kırsalda kene.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Kene ensefaliti (isteğe bağlı)'],
    bestMonths: [5, 6, 9, 10],
    dailyTips: [
      "Erivan'da her köşede içme suyu çeşmesi; şişe taşıma.",
      'Marşrutka ile Dilijan/Sevan ucuz; Kuzey Otogarı.',
      "Türkiye'ye direkt uçuş Pegasus/FlyOne ile İstanbul'dan var; sınır kapalı.",
      'Lavaş ve gata her pazarda; Vernissage hafta sonu.',
      "Pazar günü Eçmiadzin'de ayin izlenebilir, sessiz ol.",
    ],
    sources: ['https://evisa.mfa.am', MFA_URL],
  }),

  guide({
    countryCode: 'IR',
    name: 'İran',
    region: 'Orta Doğu',
    languages: ['fa', 'en'],
    currency: 'IRR',
    tryRate: 0.0001,
    timezone: 'UTC+3:30',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://evisa.mfa.ir',
      note: 'Türk vatandaşları 90 güne kadar vizesiz (180 günde 90). Kapıköy, Gürbulak, Esendere kara kapıları ve Tahran/Tebriz uçuşları. Pasaportta İsrail damgası/vizesi varsa giriş reddedilir. Bölgesel güvenlik durumu değişken — seyahat öncesi Dışişleri uyarısını kontrol et.',
    },
    documents: [
      passport(6, 'İsrail damgası olmamalı; pasaport temiz olsun.'),
      insurance(
        "İran'da yabancı sigortalar çoğunlukla geçmez; sınırda yerel sağlık sigortası (≈ 15 €) satın alınır. Damavand tahliyesi yerel dağcılık federasyonu ile.",
      ),
      permit(
        'damavand_permit',
        'Damavand tırmanış izni',
        'İran Dağcılık Federasyonu (Polur kampı) 50 $ civarı; rehber zorunlu değil ama güney rotasında kamp yeri rezervasyonu.',
        false,
      ),
      cashUsd(
        'Uluslararası kartlar ÇALIŞMAZ; tüm bütçeyi nakit EUR/USD taşı ya da "Mah Card" turist kartı yükle.',
      ),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Salam" ve sağ el kalbe; karşı cinsle tokalaşma başlatma.',
      '"Taarof": ikram/ödeme reddi ritüeli — ilk iki teklifi kibarca reddet, üçüncüde kabul et; taksici "para almam" derse yine de öde.',
      'Kadınlar için başörtüsü ve kalça altına uzun tunik yasal zorunluluk; erkekler şort giymez.',
      'Evde ayakkabı çıkar; ev sahibi ısrarla ikram eder, azar azar kabul et.',
      'Siyaset, din ve hükümet eleştirisini kamuya açık alanda yapma.',
      'Sol el ve baş parmak yukarı ("like") işareti kaba sayılabilir.',
      "Ramazan'da gündüz açıkta yeme-içme yasak.",
    ],
    dressCode:
      "Kadın: başörtü (Tahran'da gevşek de olsa taşınır), uzun tunik/manto, uzun pantolon; dağda buff/bere kabul görür. Erkek: uzun pantolon, kolsuz giymez. Damavand kamplarında uygulama gevşek ama polis kontrolü olabilir.",
    religionNotes:
      "Şii İslam devlet dini; camiler ve türbeler (Meşhed, Kum) turistlere açık, kadınlar çarşaf (girişte verilir). Ateşgede'ler (Zerdüşt) Yezd'de ziyaret edilir. Muharrem'de kırmızı/parlak giyme, taziye törenlerine saygı.",
    photographyRules:
      'Askeri, polis, nükleer, devlet binaları, köprü ve havalimanı kesinlikle yasak; "casusluk" suçlamasıyla gözaltı riski. Kadınları izinsiz çekme; protestoları çekme. Drone yok. Sokak fotoğrafçılığında insanlara sor.',
    tipping:
      'Beklenmez ama lokantada %5–10, taksi için yuvarlama, rehbere günde 10–20 $ memnun eder.',
    bargaining:
      'Bazarlarda ("bazaar-e bozorg") pazarlık şart, halı ve el işi için uzun süreç; market ve lokanta sabit. Snapp uygulaması taksi pazarlığını bitirir.',
    watchOut: [
      'Sahte polis: sivil kişiler "polis" diyerek pasaport/para kontrolü ister; kimlik iste, karakola gitmeyi teklif et, para verme.',
      'Sivil kıyafetli kişilerle siyaset konuşma; sosyal medyada paylaşım dikkatli.',
      'İkili vatandaşlık/İsrail bağlantısı olanlar için gözaltı riski; keyfi tutuklama raporları var.',
      'Trafik: yayalar için en tehlikeli ülkelerden; motorlar kaldırımda, karşıya yerlilerle geç.',
      'Döviz: karaborsa vs resmî kur farkı çok; döviz büroları ("sarrafi") kullan, sokakta bozdurma.',
      'Damavand: kükürt gazı zirve kraterinde yoğun; rüzgâr yönüne dikkat, 5.610 m irtifa.',
      'Yaz sıcakları 45 °C; çöl bölgelerinde su.',
      'İnternet kısıtlı; VPN yaygın ama yasal gri alan.',
    ],
    womenTravelers:
      'Yalnız kadın gezgin sık ve genelde güvenli; halk çok koruyucu ve misafirperver. Metro ve otobüslerde kadın vagonu. Başörtü zorunluluğu ahlak polisince denetlenebilir. Homestay ağları ("couchsurfing" fiilen yasak olsa da yaygın).',
    laws: [
      'Drone: yabancı için yasak; gümrükte el konur.',
      'Alkol: tamamen yasak; bulundurma/kullanım kırbaç ve para cezası.',
      'Uyuşturucu: ölüm cezası dahil ağır ceza.',
      'LGBTİ+: eşcinsel ilişki ağır suç, ölüm cezası mevcut; kesinlikle gizlilik.',
      'Kamp: dağ alanlarında serbest, ateş yasağı orman bölgelerinde.',
      'Kadınlar için başörtüsü yasal zorunluluk; erkekler için şort yasağı uygulanabilir.',
      'İnternet VPN kullanımı teknik olarak yasa dışı; sosyal medya çoğu engelli.',
    ],
    droneRules: 'Turistler için tam yasak; taşımak bile sorun çıkarır.',
    alcoholRules: 'Yasak. Evde ikram edilse bile kamuya açık alanda kesinlikle alma.',
    money:
      'Riyal (IRR) — 1 IRR ≈ ₺0,0001. Halk "toman" ile konuşur (1 toman = 10 riyal); fiyatı hangi birimde sor. Yabancı kart çalışmaz: EUR/USD nakit ya da turist kartı (Mah Card, Daric). Günlük 20–40 € yeter.',
    connectivity:
      "IranCell/Hamrah-e Aval turist SIM havalimanında pasaportla; 30 gün 10–20 GB ≈ 3 €. Uluslararası eSIM çoğu zaman çalışmaz. VPN'i ülkeye girmeden kur. İnternet kesintileri olabilir.",
    health: [
      'Şişe suyu; Tahran hava kirliliği kışın yüksek.',
      'Damavand irtifa; Polur→Bargah-e Sevom (4.200 m) geçişinde aklimatizasyon.',
      'Çöl bölgelerinde ısı çarpması; Hazar kıyısında nem.',
      'Sağlık hizmeti iyi ve ucuz; ilaçlar yerel isimle satılır.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Hepatit B', 'Tifo'],
    bestMonths: [4, 5, 6, 7, 9, 10],
    dailyTips: [
      'Cuma hafta sonu; perşembe öğleden sonra da yarım gün.',
      "Snapp uygulamasını Türkiye'den indir; İran numarasıyla aktif olur.",
      'Otel "vaucher" gerekebilir; belirlenen turistik otellerde kal.',
      "Damavand için Reyneh/Polur'da homestay ve muleteer bul.",
      'Taarof: "para almam" ısrarı gerçek değildir, öde.',
    ],
    sources: ['https://evisa.mfa.ir', MFA_URL, 'https://tahran.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'TZ',
    name: 'Tanzanya',
    region: 'Doğu Afrika',
    languages: ['sw', 'en'],
    currency: 'TZS',
    tryRate: 0.017,
    timezone: 'UTC+3',
    plugTypes: ['D', 'G'],
    visa: {
      type: 'e_visa',
      maxStayDays: 90,
      costTry: 2250,
      processingDays: 10,
      url: 'https://visa.immigration.go.tz',
      note: 'Ordinary e-Visa 50 $ (tek giriş, 90 gün); resmî site visa.immigration.go.tz. Varışta vize (Kilimanjaro/JRO, Dar) de veriliyor ama kuyruk uzun ve nakit USD ister. Zanzibar için ayrıca zorunlu adaya giriş sigortası (44 $) — resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      visaDoc("e-Vize onay PDF'i; varışta da alınabilir (50 $ nakit)."),
      yellowFever(
        false,
        "Türkiye'den doğrudan uçuşta istenmez; Kenya/Etiyopya/Uganda aktarmalı ya da 12 saatten uzun transitte ICVP zorunlu, aksi halde havalimanında aşı+ücret.",
      ),
      insurance(
        'Kilimanjaro helikopter tahliyesi (Kilimanjaro SAR/AMREF Flying Doctors) 6.000 m irtifa kapsamı zorunlu; operatör poliçe numarasını ister.',
      ),
      permit(
        'park_permit',
        'Kilimanjaro/Serengeti park ücretleri',
        'Operatör üzerinden ödenir: Kilimanjaro 7 gün ≈ 1.000 $ (giriş+kamp+kurtarma ücreti); bağımsız tırmanış YASAK, lisanslı rehber şart.',
      ),
      vaccineCard(),
      cashUsd('Bahşiş ve park ücretleri için 2013 sonrası basım USD; eski seriler kabul edilmez.'),
      returnTicket(true),
    ],
    etiquette: [
      '"Jambo/Habari" ile selamlaş, "asante sana" teşekkür; selamlaşmadan işe geçmek kaba.',
      'Yaşlılara "shikamoo" (saygı selamı), cevabı "marahaba".',
      'Sağ el; eşya ve para sağ elle ya da iki elle verilir.',
      "Zanzibar'da (Müslüman ada) plaj dışında omuz-diz kapalı; Ramazan'da açıkta yeme.",
      'Porter ve ekip ile son gün "bahşiş töreni" gelenek; herkese açıkça duyurulur.',
      'Sokakta öfke göstermek ("hakuna matata" kültürü) itibar kaybettirir; sabırlı ol.',
      'Masai köy ziyaretlerinde fotoğraf için önceden anlaşılır.',
    ],
    dressCode:
      "Arusha/Moshi gündelik; Zanzibar Stone Town'da kapalı giyim (kadınlar omuz/diz, erkekler tişört). Dağda katmanlı teknik giyim. Safari için nötr renkler (mavi/siyah çeçe sineğini çeker).",
    religionNotes:
      "Anakara %60 Hristiyan, Zanzibar %99 Müslüman. Camilere gayrimüslim genelde alınmaz. Pazar ayinleri uzun ve müzikli, davet edilirsen katıl. Ramazan Zanzibar'da ciddiye alınır.",
    photographyRules:
      "İnsanları izinsiz çekme (Masai özellikle ücret bekler). Askeri tesis, devlet binası, köprü ve havalimanı yasak. Drone Kilimanjaro ve milli parklarda yasak. Zanzibar'da yerel kadınları çekme.",
    tipping:
      "Kilimanjaro bahşişi: rehber günde 20–25 $, yardımcı rehber 15 $, aşçı 12–15 $, porter 8–10 $ (kişi başı değil, ekip başı hesaplanır); toplam bütçenin ~%10'u. KPAP (Kilimanjaro Porters Assistance Project) tavsiyelerine bak. Safari şoför-rehbere günde 20 $; lokantada %5–10.",
    bargaining:
      'Pazar, souvenir ve dala dala/boda boda için pazarlık; ilk fiyatın üçte biri. Süpermarket, lokanta ve park ücretleri sabittir. Operatör seçiminde çok ucuz teklif = porter sömürüsü; KPAP ortağı operatör seç.',
    watchOut: [
      'Ucuz Kilimanjaro operatörleri: porter haklarını (max 20 kg yük, 3 öğün, çadır, adil ücret) ihlal eder ve tahliye planı yoktur; KPAP listesi ve TALA lisansını sor.',
      'Havalimanı/otogar "flycatcher"ları (tur simsarları) sahte acente satar; Arusha Clock Tower çevresinde dikkat.',
      'Sahte polis ve "çevre vergisi" kesme: kimlik iste, para verme, makbuz iste.',
      'Gece yürüyüş: Arusha, Dar, Stone Town plajlarında gece yalnız dolaşma (çanta kapkaç).',
      "Taksi: taksimetre yok; Bolt/Uber Arusha-Dar'da var, gece otel taksisi güvenli.",
      'Sıtma: Moshi/Arusha 1.400 m üstünde düşük ama var; profilaksi ve cibinlik.',
      'Yüksek irtifa: Kilimanjaro\'da AMS başlıca başarısızlık nedeni; 7+ gün rota seç, "pole pole" (yavaş yavaş).',
      'Plastik poşet ülkeye sokmak yasak (2019); bagajdan çıkar.',
    ],
    womenTravelers:
      "Yalnız kadın gezgin yaygın; taciz genelde sözlü ve ısrarcı satıcılar düzeyinde. Zanzibar'da kapalı giyim rahatsızlığı azaltır. Dağda kadın rehber/porter isteyebilirsin; ay dönemi için ürünleri şehirden al. Gece plaj yürüyüşü yapma.",
    laws: [
      'Drone: TCAA izni + Savunma Bakanlığı onayı; milli parklarda (TANAPA) yasak, izinsiz uçuşta el koyma ve para cezası.',
      "Alkol: 18 yaş; Zanzibar'da yalnızca otel/turist barlarda, sokakta içmek yasak.",
      'Uyuşturucu: esrar dahil ağır ceza; plajda satıcı polis işbirlikçisi olabilir.',
      "LGBTİ+: eşcinsel ilişki suçtur (ömür boyu hapse kadar); Zanzibar'da daha sert; kesinlikle alenilikten kaçın.",
      'Plastik poşet yasağı; ihlalde para cezası.',
      'Kamp: milli parklarda yalnızca belirlenmiş kamp alanı ve rehberli; ateş yasak.',
    ],
    droneRules:
      "Turist için pratikte imkânsız; Kilimanjaro, Serengeti ve Ngorongoro'da tam yasak. Cihazı getirmemek en iyisi.",
    alcoholRules:
      "Anakarada serbest (Kilimanjaro/Safari bira). Zanzibar'da Ramazan'da kısıtlı; sokakta içmek yasak.",
    money:
      "Tanzanya Şilini (TZS) — 1 TZS ≈ ₺0,017. ATM Arusha/Moshi/Dar/Stone Town'da (CRDB, NMB); günlük 400.000 TZS. Park ücretleri ve tur USD kartla ödenir (%3–5 komisyon). Bahşiş için USD, günlük harcamalar için TZS. M-Pesa yerel ödeme sistemi.",
    connectivity:
      "Vodacom/Airtel SIM havalimanında pasaport + parmak izi; 30 gün 20 GB ≈ 25.000 TZS. Kilimanjaro'da Vodacom Barafu ve Uhuru'da bile bazen çeker. eSIM (Airalo) şehirlerde iyi.",
    health: [
      "Sıtma: ova ve Zanzibar'da yüksek risk; atovakuon-proguanil ya da doksisiklin profilaksisi (Diamox ile etkileşim için doktora sor).",
      'Sarı humma aşısı önerilir (aktarmalı uçuşta zorunlu).',
      'Su: şişe/filtre; dağda kaynatılmış su verilir, tablet ekle.',
      'Kilimanjaro AMS: Diamox 125 mg x2 profilaksi yaygın; HAPE/HACE belirtilerinde iniş.',
      'Deniz ürünlerinde ishal; güneş çarpması ekvatorda hızlı.',
    ],
    vaccines: [
      'Sarı humma',
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz (isteğe bağlı)',
      'Sıtma profilaksisi',
    ],
    bestMonths: [1, 2, 7, 8, 9, 10],
    dailyTips: [
      '"Pole pole" — yavaş yürümek Kilimanjaro\'da zirve şansını belirler.',
      'Park kapısında tartı var: porter yükü 20 kg üstü olamaz; kendi çantanı hafif tut.',
      'Powerbank 20.000 mAh + güneş paneli; dağda şarj yok.',
      "Moshi'de KPAP ofisini ziyaret ederek porter haklarını öğren.",
      'Safari araçlarında pencere kapalı çeçe sineği için; Ngorongoro kraterinde soğuk.',
    ],
    sources: [
      'https://visa.immigration.go.tz',
      'https://www.tanzaniaparks.go.tz',
      'https://kiliporters.org',
      MFA_URL,
      'https://darusselam.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'KE',
    name: 'Kenya',
    region: 'Doğu Afrika',
    languages: ['sw', 'en'],
    currency: 'KES',
    tryRate: 0.35,
    timezone: 'UTC+3',
    plugTypes: ['G'],
    visa: {
      type: 'e_visa',
      maxStayDays: 90,
      costTry: 1400,
      processingDays: 3,
      url: 'https://www.etakenya.go.ke',
      note: "Kenya 2024'ten beri vize yerine eTA (Electronic Travel Authorisation) uyguluyor: 30 $ + hizmet bedeli, en az 72 saat önce başvur; uçuş ve konaklama bilgisi yüklenir. Sarı humma aşısı Kenya'ya girişte Türkiye'den istenmez ama sonrasında Tanzanya'ya geçişte istenir.",
    },
    documents: [
      passport(6),
      visaDoc('eTA onayı (PDF/QR); pasaportla eşleşen isim.'),
      yellowFever(
        false,
        "Kenya'dan Tanzanya/Uganda'ya geçeceksen ICVP zorunlu; Nairobi'de aşı yaptırılabilir.",
      ),
      insurance(
        'Mt Kenya (5.199 m) ve safari tahliyesi; AMREF Flying Doctors üyeliği (≈ 30 $/ay) ek güvence.',
      ),
      permit(
        'park_permit',
        'KWS park ücretleri (Mt Kenya, Masai Mara)',
        "eCitizen üzerinden kartla; Mt Kenya günlük 52 $ + kamp. Rehber Mt Kenya'da zorunlu değil ama şiddetle önerilir.",
      ),
      vaccineCard(),
      cashUsd(),
      returnTicket(true),
    ],
    etiquette: [
      '"Jambo", "habari yako" ve uzun selamlaşma; işe hemen geçmek kaba.',
      'Sağ el; yaşlılara saygı; "mzee" (yaşlı erkek) hitabı saygı ifadesi.',
      'Kıyı (Mombasa, Lamu) Müslüman; kapalı giyim ve Ramazan hassasiyeti.',
      'Masai köy ziyaretlerinde köy şefine hediye ve fotoğraf için ücret; anlaşmadan çekme.',
      'Sokakta öfke göstermeme, sabır, "hakuna matata".',
      'Matatu (minibüs) kültürü gürültülü; şoförle tartışma.',
    ],
    dressCode:
      "Nairobi gündelik; safari için nötr renkler; kıyıda plaj dışında kapalı. Mt Kenya'da kar ve don için kışlık ekipman.",
    religionNotes:
      "Çoğunluk Hristiyan (Pazar ayinleri coşkulu), kıyıda Müslüman. Lamu ve Mombasa eski şehirde Ramazan'a saygı. Kiliseye davet edilmek yaygındır.",
    photographyRules:
      'Askeri, devlet binası, havalimanı, köprü yasak. İnsanları izinsiz çekme; Masai ücret ister. Devlet başkanı konvoyu ve polis çekilmez.',
    tipping:
      'Safari şoför-rehbere günde 15–25 $ (grup), kamp personeline 5–10 $. Lokantada %10 servis; otel taşıyıcısı 100 KES. Mt Kenya rehberi günde 20 $, porter 10 $.',
    bargaining:
      "Masai Market ve taksi için pazarlık; Uber/Bolt Nairobi'de standart. Safari fiyatları operatörle pazarlıklı, park ücreti sabit.",
    watchOut: [
      'Nairobi ("Nairobbery") gece yürüyüş yok; kapkaç ve araç camından hırsızlık; telefonu sokakta çıkarma.',
      'Sahte polis para kontrolü; kimlik iste, karakola gitmeyi teklif et.',
      'Sahte safari operatörleri ve "ucuz Mara turu"; KATO üyeliği kontrol et, peşin ödeme yapma.',
      'Karayolu kazaları çok; gece şehirler arası araç yok, matatu hız yapar.',
      '"Arkadaş" olup içki ısmarlayan yabancılar: içecek ilaçlı olabilir (Nairobi barları).',
      "Sıtma: Nairobi'de düşük, Mara ve kıyıda yüksek.",
      "Mt Kenya: Point Lenana 4.985 m'de AMS; 4 gün rota seç. Fil ve bufalo orman kuşağında tehlikeli.",
      'Kıyıda plaj satıcıları ("beach boys") ısrarcı; net "hapana asante".',
    ],
    womenTravelers:
      "Yalnız kadın gezgin için Nairobi'de gece taksi zorunlu; Mombasa plajında taciz olabilir. Safari kampları ve dağ güvenli. Kadın rehber/porter Naro Moru'da bulunur.",
    laws: [
      'Drone: KCAA izni zorunlu ve yabancılar için zor; milli parklarda yasak, izinsiz uçuş para cezası ve el koyma.',
      "Alkol: 18 yaş; kamuya açık yerde içmek yasak (Mombasa'da uygulanır).",
      'Uyuşturucu: esrar ve miraa/khat farklı; esrar ağır ceza.',
      "LGBTİ+: eşcinsel ilişki suçtur (14 yıla kadar); Nairobi'de görece gizli topluluk, alenilik riskli.",
      'Plastik poşet yasak (2017), para ve hapis cezası.',
      'Kamp: parklarda yalnızca KWS kamp alanları; ateş yalnızca belirli noktalarda.',
    ],
    droneRules:
      'KCAA "temporary permit" başvurusu haftalar sürer; parklarda ayrıca KWS izni. Pratikte turist için yok.',
    alcoholRules:
      "18 yaş; Tusker her yerde. Kıyıda Ramazan'da gündüz kısıtlı. Sokakta içmek yasak.",
    money:
      'Kenya Şilini (KES) — 1 KES ≈ ₺0,35. ATM yaygın; M-Pesa her yerde (turist SIM ile kayıt olabilirsin). Park ücreti kartla eCitizen; nakit USD safari bahşişi için.',
    connectivity:
      "Safaricom SIM (pasaport + fotoğraf) 100 KES; 30 gün 10 GB ≈ 1.000 KES; M-Pesa aktif et. Mt Kenya'da Safaricom Shipton'a kadar. eSIM Airalo/Safaricom var.",
    health: [
      "Sıtma profilaksisi Mara, kıyı ve Batı Kenya için; Nairobi 1.800 m'de düşük risk.",
      'Sarı humma aşısı önerilir; Tanzanya geçişinde zorunlu.',
      'Su: şişe/filtre; ishal yaygın.',
      'Mt Kenya irtifa; güneş ekvatorda yakıcı.',
      'Bilharzia: Victoria Gölü ve tatlı sularda yüzme.',
    ],
    vaccines: [
      'Sarı humma',
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz (isteğe bağlı)',
      'Sıtma profilaksisi',
    ],
    bestMonths: [1, 2, 7, 8, 9, 10],
    dailyTips: [
      'M-Pesa ile çoğu ödeme; nakit bozuk para bulmak zor.',
      "Gece Nairobi'de Uber/Bolt, sokakta durup taksi çevirme.",
      'Safari sabahları soğuk; katman ve dürbün.',
      "Mt Kenya Sirimon→Chogoria rotası en manzaralı; Naro Moru'da rehber bulunur.",
      "Matatu'da telefonu cebinde tut; pencereden çekilir.",
    ],
    sources: [
      'https://www.etakenya.go.ke',
      'https://www.kws.go.ke',
      MFA_URL,
      'https://nairobi.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'MA',
    name: 'Fas',
    region: 'Kuzey Afrika',
    languages: ['ar', 'fr', 'ber'],
    currency: 'MAD',
    tryRate: 4.6,
    timezone: 'UTC+1',
    plugTypes: ['C', 'E'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.consulat.ma',
      note: 'Türk vatandaşları 90 gün vizesiz. Pasaport en az 6 ay geçerli; girişte konaklama adresi sorulur.',
    },
    documents: [
      passport(6),
      insurance(
        "Toubkal (4.167 m) ve Atlas trek; Fas'ta dağ kurtarma (Gendarmerie) ücretsiz ama helikopter sınırlı.",
      ),
      permit(
        'guide',
        'Toubkal: rehber zorunluluğu',
        "2018'den beri Toubkal Milli Parkı'na yalnızca lisanslı rehberle giriş; Imlil'de kontrol noktası. Rehber günde ≈ 400 MAD.",
      ),
      idp(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Salam aleykum", "shukran", "la shukran" (istemiyorum) kurtarıcı; Fransızca yaygın, Türkçe merakı yüksek.',
      'Sağ elle ye; ekmek yere atılmaz; tabaktan önündeki kısmı ye (paylaşılan tajine).',
      'Camilere gayrimüslim girişi yok (Casablanca Hassan II hariç).',
      "Ramazan'da gündüz açıkta yeme, içme, sigara.",
      'Nane çayı ikramı ("Berberi viskisi") kabul et; 3 bardak gelenek.',
      'Kadınlarla fiziksel temas ve flört jesti yapma; medine sokaklarında konuşan yabancılara mesafe.',
      'Ev sahibine hediye (tatlı); ayakkabıyı kapıda çıkar.',
    ],
    dressCode:
      'Marakeş/Fes medine: omuz-diz kapalı, kadınlar hafif şal; Atlas köylerinde muhafazakâr. Dağda teknik giyim sorun değil; plajda bikini turistik alanlarda normal.',
    religionNotes:
      "Sünni Maliki İslam, Berberi gelenekleri güçlü. Cuma öğle namazında dükkânlar kapanır; ezan saatinde müzik kısılır. Ramazan'da akşam iftar sofrasına davet gelebilir.",
    photographyRules:
      'İnsanları izinsiz çekme (Jemaa el-Fna sanatçıları ücret ister, sonra tartışma çıkar). Askeri, polis, köprü ve saray yasak. Camilerin içini çekme. Drone gümrükte el konur.',
    tipping:
      'Yaygın: lokanta %10, kafe 2–5 MAD, taşıyıcı 10–20 MAD, dağ rehberi günde 100–150 MAD, katırcı 50–80 MAD; hamam görevlisi 20–30 MAD. "Yol gösteren" çocuklara bahşiş vermek isteği güçlendirir, kibarca reddet.',
    bargaining:
      'Souk\'ta pazarlık kural; ilk fiyatın %30–40\'ından başla, sakin ol, gitmeye kalk. Sabit fiyatlı "ensemble artisanal" mağazaları referans için. Taksi: petit taxi taksimetre ("compteur") iste; grand taxi fiyat önceden.',
    watchOut: [
      'Sahte rehber/"öğrenci arkadaş": medine\'de yolunu kaybettirip komisyonlu dükkâna götürür; "la shukran" de, yürümeye devam et.',
      '"Deri tabakhanesi ücretsiz gösterim": sonunda zorla nane ve satış.',
      'Jemaa el-Fna yılan oynatıcı/maymun: fotoğraf sonrası 200 MAD talebi; yaklaşma.',
      'Taksi taksimetre "bozuk"; havalimanı sabit tarife tabelasını kontrol et.',
      'Kapkaç motorlu (Casablanca, Tanca); çantayı duvar tarafında tut.',
      'Sokak köpekleri ve kediler; ısırıkta kuduz aşısı.',
      'Toubkal kışın buz ve çığ; krampon-kazma zorunlu. Yazın sıcak çarpması Imlil altında.',
      'Esrar ("kif") satıcıları Chefchaouen\'de; polis işbirlikçi olabilir, ağır ceza.',
    ],
    womenTravelers:
      'Sözlü taciz ve bakış medinelerde yaygın ama fiziksel şiddet nadir; kapalı giyim ve güneş gözlüğü azaltır. Yalnız kadın için Atlas trek rehberli çok güvenli; hamamlarda kadın-erkek saatleri ayrı. Gece medine dar sokaklarında kalabalık yollar.',
    laws: [
      'Drone: ithalat yasak; gümrükte el konur, çıkışta geri alınır (belki).',
      "Alkol: gayrimüslimlere satış serbest ama sokakta içmek yasak; Ramazan'da sınırlı.",
      'Uyuşturucu: esrar yaygın ama yasa dışı; turistler tuzak satış ve şantajla karşılaşır.',
      'LGBTİ+: eşcinsel ilişki suçtur (3 yıla kadar); alenilikten kaçın.',
      'Vahşi kamp: Toubkal parkında rehberle serbest; sahil ve şehir çevresinde yasak.',
      'Kraliyet ailesi eleştirisi ve Batı Sahra konusu suç sayılabilir.',
    ],
    droneRules: 'Yasak; taşımak bile önerilmez. Film çekimleri için CCM izni gerekir.',
    alcoholRules:
      "Turist otel/bar ve Carrefour/Acima bazı şubelerinde satılır; kamuya açık alanda içmek yasak. Ramazan'da kısıtlı.",
    money:
      'Dirhem (MAD) — 1 MAD ≈ ₺4,6; kapalı para birimi, ülkeye sokup çıkarılmaz, ülke içinde bozdur. ATM yaygın (Attijariwafa, BMCE); kart büyük yerlerde. Souk ve dağ nakit. Günlük bütçe 300–600 MAD.',
    connectivity:
      "Maroc Telecom/Orange/Inwi SIM havalimanında pasaportla ücretsiz; 10 GB ≈ 100 MAD. Atlas'ta Maroc Telecom en iyi; Toubkal zirvesinde bile çeker. eSIM Airalo çalışır.",
    health: [
      'Şişe suyu; sokak yemeği çoğunlukla güvenli (sıcak ve kalabalık tezgâh).',
      'Toubkal irtifa; Imlil 1.740 m → Refuge 3.207 m → zirve.',
      'Yaz sıcakları 45 °C Marakeş; güneş kremi ve tuz.',
      'Kuduz sokak hayvanlarında; ısırıkta Pasteur Enstitüsü.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Tifo', 'Hepatit B', 'Kuduz (isteğe bağlı)'],
    bestMonths: [3, 4, 5, 9, 10, 11],
    dailyTips: [
      'Medinede kaybolmak normal; ana caddeye "Jemaa el-Fna/Bab" diye sor, çocukların rehberliğini reddet.',
      'Toubkal için Marakeş→Imlil grand taxi 1,5 saat; Refuge du Toubkal rezervasyonu şart.',
      'Kahvaltıda "msemen" ve nane çayı; öğlen tajine yavaş pişer, 40 dk bekle.',
      'Tren (ONCF) Marakeş-Casa-Fes konforlu; 1. sınıf ucuz.',
      'Cuma günü kuskus günü; dükkânlar öğle kapanır.',
    ],
    sources: ['https://www.consulat.ma', MFA_URL, 'https://rabat.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'EG',
    name: 'Mısır',
    region: 'Kuzey Afrika',
    languages: ['ar', 'en'],
    currency: 'EGP',
    tryRate: 0.9,
    timezone: 'UTC+2',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'e_visa',
      maxStayDays: 30,
      costTry: 1150,
      processingDays: 7,
      url: 'https://visa2egypt.gov.eg',
      note: 'Türk vatandaşları için e-Vize (25 $, 30 gün) ya da varışta vize (25 $ nakit USD/EUR) mevcut; 45 yaş üstü ve 15 yaş altı için kolaylık, genç erkeklere sınırda ek soru olabilir. Sina (Şarm, Dahab) yalnızca için ücretsiz 15 günlük "Sinai only" damgası. Resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      visaDoc('e-Vize onayı ya da varışta vize pulu (25 $ nakit).'),
      insurance('Sina dağları (St. Catherine 2.629 m) ve dalış kapsamı; dalışta DAN sigortası.'),
      permit(
        'sinai_permit',
        'Sina trek izni (Bedevi rehber)',
        'St. Catherine ve Sinai Trail için Bedevi rehber zorunlu; kontrol noktalarında pasaport kaydı.',
        false,
      ),
      returnTicket(),
      cashUsd('Vize için yeni seri USD; döviz büroları resmî kur verir.'),
      vaccineCard(),
    ],
    etiquette: [
      '"Salam aleykum", "shukran", "insha\'allah"; Türk dizileri sayesinde sıcak karşılama.',
      'Sağ el; yaşlıya saygı; kadınla teması o başlatmasın.',
      'Camilere ayakkabısız ve kapalı giyimle giriş; namaz vakti bekle.',
      "Ramazan'da gündüz açıkta yeme; iftar sofrasına davet gelebilir.",
      '"Baksheesh" (bahşiş) kültürü her hizmetin parçası; küçük banknot taşı.',
      'Siyaset (Sisi, Müslüman Kardeşler) konuşma; polis devletinde hassasiyet.',
    ],
    dressCode:
      'Kahire ve Yukarı Mısır: omuz-diz kapalı; kadınlar için şal. Kızıldeniz tatil beldelerinde plaj kıyafeti normal. Sina dağında gece soğuk.',
    religionNotes:
      'Sünni çoğunluk, %10 Kıpti Hristiyan (Ortodoks). Camilere turist saatlerinde giriş; kadınlar başörtü. Kıpti kiliselerinde Pazar ayini; Mar Girgis bölgesinde saygılı ol. Cuma öğle her yer kapanır.',
    photographyRules:
      'Askeri, polis, köprü, Süveyş Kanalı, havalimanı, hükümet binaları yasak; "casusluk" gerekçesiyle gözaltı olabilir. Müzelerde fotoğraf bileti; mezar içlerinde ekstra ücret. İnsanlar için izin ve genelde bahşiş. Drone ithalatı yasak.',
    tipping:
      'Her şey için baksheesh: tuvalet 5 EGP, taşıyıcı 20 EGP, lokanta %10, rehber günde 200–300 EGP, şoför 100 EGP, dalış ekibi 100–200 EGP. Bedevi rehber ve deve sahibine trek başına 200–300 EGP.',
    bargaining:
      "Khan el-Khalili ve tüm turistik satışta pazarlık; ilk fiyatın %30'undan başla. Taksi: Uber/Careem Kahire'de; sokak taksisi taksimetre kullanmaz. Felucca ve deve turu için önceden fiyat.",
    watchOut: [
      'Piramitler "at/deve turu" ve "gerçek giriş burada" oyunları; yalnızca resmî gişe, deve fotoğrafı için önce fiyat.',
      'Sahte "tur rehberi" ve "papirüs enstitüsü" mağazaları; resmî lisanslı rehber iste.',
      'Taksi: taksimetre yok, gece 3 kat; Uber/Careem kullan.',
      '"Mısır müzesi bugün kapalı" hilesi.',
      'Gençlere/erkeklere sınırda ek sorgu; kadınlara sözlü taciz yaygın (Kahire).',
      'Yankesicilik metro ve Khan el-Khalili; parayı böl.',
      "Kızıldeniz dalış operatörleri: PADI/SSI lisansı ve ekipman kontrolü; Dahab Blue Hole'da derin dalış ölümleri.",
      'Sina iç bölge (Kuzey Sina) yasak/tehlikeli; yalnızca Güney Sina turistik bölge.',
    ],
    womenTravelers:
      "Sözlü taciz Kahire'de en yüksek; kapalı giyim, güneş gözlüğü, kararlı yürüyüş. Metroda kadın vagonu. Dahab ve Sina Bedevi rehberleriyle çok güvenli. Kadın kampanya hattı: 15115. Gece yalnız Kahire sokaklarında dolaşma.",
    laws: [
      'Drone: ithalat yasak; havalimanında el konur.',
      'Alkol: lisanslı otel/bar ve Drinkies teslimatı; sokakta içmek yasak.',
      'Uyuşturucu: ölüm cezası dahil ağır cezalar.',
      'LGBTİ+: açık yasa yok ama "ahlaksızlık" maddesiyle tutuklamalar; dating uygulamaları izlenir.',
      'Sosyal medya: hükümeti eleştiren paylaşımlar tutuklama nedeni.',
      'Kamp: Sina Bedevi kampları ve çölde rehberle; Kızıldeniz kıyısı belirlenmiş alan.',
    ],
    droneRules: 'Kesin yasak; taşımayı düşünme.',
    alcoholRules:
      "Otel, turistik bar ve Stella/Sakara markaları; Ramazan'da yabancılara yine satılır. Halka açık yerde içmek suç.",
    money:
      'Mısır Lirası (EGP) — 1 EGP ≈ ₺0,9; kur dalgalı. ATM yaygın; kart otel ve büyük lokantada. Küçük banknot baksheesh için. Piramit/müze girişleri artık kartla.',
    connectivity:
      "Vodafone/Orange/Etisalat turist SIM havalimanında pasaportla; 30 gün 20 GB ≈ 300 EGP. Sina'da Vodafone; St. Catherine zirvesinde sinyal var. eSIM Airalo mevcut.",
    health: [
      'Şişe suyu; buz ve salata ishale neden olur ("Firavun\'un intikamı").',
      "Yaz sıcakları 45 °C; Luksor'da sabah erken gez.",
      "Bilharzia: Nil'de yüzme.",
      "Sina'da gece don; dalışta dekompresyon odası Şarm ve Hurghada'da.",
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Tifo', 'Hepatit B', 'Kuduz (isteğe bağlı)'],
    bestMonths: [10, 11, 12, 2, 3, 4],
    dailyTips: [
      'Kahire trafiğinde metro en hızlı; 1. vagon kadın.',
      'Gece treni Kahire→Luksor/Asvan ("Watania") yabancılara açık ama pahalı.',
      "Koshari 30 EGP'ye doyurur; sokak lokantası kalabalıksa güvenli.",
      "St. Catherine'de gece dağa çıkıp gün doğumu izle; sabah 2'de yola çık.",
      'Bahşiş için 5-10-20 EGP bozukları ilk gün stokla.',
    ],
    sources: ['https://visa2egypt.gov.eg', MFA_URL, 'https://kahire.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'ZA',
    name: 'Güney Afrika',
    region: 'Güney Afrika',
    languages: ['en', 'af', 'zu', 'xh'],
    currency: 'ZAR',
    tryRate: 2.5,
    timezone: 'UTC+2',
    plugTypes: ['M', 'N', 'C'],
    visa: {
      type: 'embassy',
      maxStayDays: 90,
      costTry: 2000,
      processingDays: 15,
      url: 'https://www.dha.gov.za',
      note: 'Türk vatandaşları için vize gerekli; Ankara/İstanbul VFS üzerinden "visitor visa" başvurusu (ücret ≈ 1.500–2.500 ₺ + hizmet). Sarı humma yalnızca endemik bölgeden gelişte. 2025\'te başlatılan çevrimiçi "Trusted Tour Operator" ve e-vize pilotu Türkiye\'yi kapsamayabilir — resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6, 'Güney Afrika en az 2 boş sayfa ister (uygulanır).'),
      visaDoc('Vize etiketi; VFS randevusu 2–3 hafta önce.'),
      insurance(
        'Drakensberg ve Table Mountain kurtarma; Mountain Club of SA gönüllü ama helikopter (Wilderness Search & Rescue) ücretli.',
      ),
      hotelBooking(),
      bankStatement(),
      yellowFever(false),
      idp(),
      returnTicket(true),
      vaccineCard(),
    ],
    etiquette: [
      '"Howzit" (nasılsın) gündelik; 11 resmî dil, İngilizce her yerde.',
      'Irk ve apartheid konusu hassas; dinle, genelleme yapma.',
      '"Braai" (mangal) daveti önemli sosyal olaydır; et/içki götür.',
      'Toplu taşımada göz teması ve sohbet normal; "now-now" = birazdan.',
      'Kapı görevlisi/park bekçisine küçük bahşiş ("car guard") beklenir.',
      'Yerli topluluklarda (Zulu) yaşlıya iki elle selam.',
    ],
    dressCode:
      "Şehirler batılı ve rahat; kırsal Zulu/Xhosa köylerinde muhafazakâr. Drakensberg'de yazın gök gürültülü fırtına, kışın kar.",
    religionNotes:
      'Çoğunluk Hristiyan (çeşitli), Müslüman ve Hindu azınlık (Cape Malay, Durban). Zion ve Pentecostal kiliseleri etkileyici; davet edilirsen katıl.',
    photographyRules:
      'Serbest; townshiplerde insanları izinsiz çekme, yerel rehberle git. Askeri alanlar yasak. Drone parklarda (SANParks) yasak.',
    tipping:
      'Lokanta %10–15, car guard 5–10 ZAR, benzinci 5–10 ZAR, rehber günde 100–200 ZAR, safari rehber 200–300 ZAR/gün, taşıyıcı 10–20 ZAR.',
    bargaining:
      'Sanat/hediyelik pazarlarında hafif pazarlık; mağaza ve lokantada yok. Uber/Bolt standart.',
    watchOut: [
      'Şiddet suçu oranı yüksek: Johannesburg CBD, Hillbrow, Cape Town Flats ve gece yürüyüş yok; araçta kapı kilitli, cam kapalı.',
      '"Smash and grab" trafik ışığında araç camı; çantayı görünür bırakma.',
      "Table Mountain'da soygun raporları; gruplarla, gündüz, popüler rotalarda yürü; Lion's Head sabah erken.",
      'ATM dolandırıcılığı ve "yardım eden" kişi; kart takılırsa bankaya gir.',
      'Sahte polis ve trafik kontrolü (özellikle gece); işaretli araç ve kimlik iste.',
      'Yol: sağdan trafik (İngiliz sistemi), uzun mesafede hız kontrolü, hayvan geçişi.',
      'Denizde akıntılar ve köpekbalığı (Cape); bayraklı plajlarda yüz.',
      "Drakensberg'de yıldırım öğleden sonra; sabah çık, geçitlerde sis.",
    ],
    womenTravelers:
      'Cinsel şiddet istatistikleri yüksek; gece asla yalnız yürüme, Uber ile kapıdan kapıya. Turistik bölgelerde (Garden Route, Cape Winelands) gündüz rahat. Hostel ve rehberli grup önerilir.',
    laws: [
      'Drone: SACAA kaydı; milli parklar, plajlar (bazı belediyeler) ve 50 m insan kuralı; ticari değilse 120 m.',
      'Alkol: 18 yaş; sokakta içmek yasak, sürüşte 0,05%.',
      "Uyuşturucu: esrarın özel alanda kişisel kullanımı 2018'den beri suç değil; taşıma/satış cezalı.",
      'LGBTİ+: evlilik dahil tam yasal eşitlik (2006); kırsalda sosyal muhafazakârlık.',
      'Kamp: SANParks ve rezervlerde belirlenmiş alan; Drakensberg vahşi kamp mağaralarda izinle (Ezemvelo).',
      'Wild Card/park girişleri; koruma alanlarında toplama yasak.',
    ],
    droneRules:
      'SANParks ve çoğu doğa rezervinde yasak; Table Mountain milli parkı dahil. Şehirde CAA kurallarıyla serbest.',
    alcoholRules:
      '18 yaş; Pazar günü satış kısıtlı bazı eyaletlerde; şarap bölgeleri turizmi güçlü.',
    money:
      'Rand (ZAR) — 1 ZAR ≈ ₺2,5. Kart her yerde (contactless), ATM yaygın; nakit car guard ve kırsal için. Güvenlik için tek ATM kullanımı gündüz, banka içinde.',
    connectivity:
      "Vodacom/MTN SIM (RICA kaydı: pasaport + adres); 30 gün 10 GB ≈ 300 ZAR. Drakensberg ve Kruger'de kapsama kısmen. eSIM Airalo iyi.",
    health: [
      'Sıtma: yalnızca Kruger ve KwaZulu-Natal kuzeyi (Eylül–Mayıs); Cape ve Drakensberg yok.',
      'Musluk suyu şehirlerde içilebilir.',
      'Güneş UV yüksek; Drakensberg 3.000 m irtifa.',
      'HIV yaygın; standart önlemler.',
      'Bilharzia kuzeydoğu tatlı sularında.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Hepatit B', 'Tifo', 'Sıtma profilaksisi (Kruger)'],
    bestMonths: [3, 4, 5, 9, 10, 11],
    dailyTips: [
      'Yükleme kesintisi ("load shedding") programı EskomSePush uygulamasında; powerbank.',
      'Araç kiralamak en pratik; Garden Route ve Drakensberg toplu taşımasız.',
      'Braai davetinde "bring and braai" — kendi etini götür.',
      'Table Mountain teleferiği rüzgârda kapanır; sabah kontrol et.',
      "Kruger'de sabah 05:30 kapı; kendi aracınla self-drive safari ucuz.",
    ],
    sources: [
      'https://www.dha.gov.za',
      'https://www.sanparks.org',
      MFA_URL,
      'https://pretoria.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'CL',
    name: 'Şili',
    region: 'Güney Amerika · Patagonya',
    languages: ['es'],
    currency: 'CLP',
    tryRate: 0.048,
    timezone: 'UTC-4 / UTC-3 (yaz)',
    plugTypes: ['C', 'L'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.chile.gob.cl/turquia',
      note: 'Türk vatandaşları 90 gün vizesiz. Girişte verilen "Tarjeta de Turismo" (PDI kâğıdı) çıkışta istenir, kaybetme; otellerde göstererek KDV muafiyeti.',
    },
    documents: [
      passport(6),
      insurance(
        'Torres del Paine ve And tırmanışları; CONAF kurtarma sınırlı, helikopter ücretli.',
      ),
      permit(
        'park_permit',
        'Torres del Paine giriş + refugio/kamp rezervasyonu',
        'W/O devresi için CONAF + Vértice + Las Torres rezervasyonu ZORUNLU, 4–6 ay önce dolar; rezervasyonsuz giriş engellenir.',
      ),
      permit(
        'difrol',
        'DIFROL sınır bölgesi izni (Ojos del Salado, sınır zirveleri)',
        'Arjantin sınırındaki zirveler için ücretsiz çevrimiçi izin; 20 gün önce.',
        false,
      ),
      idp(),
      returnTicket(true),
      vaccineCard(),
    ],
    etiquette: [
      'Tek yanak öpücüğü (kadın-kadın, kadın-erkek) selamlaşmada; erkekler tokalaşır.',
      'Dakiklik gevşek; yemek davetine 15–30 dk geç normal.',
      '"Once" (ikindi çayı) sosyal ritüel; davet edilirsen tatlı götür.',
      'Şilililer sessiz ve kibar; yüksek sesle konuşma, kuyruk kültürü güçlü.',
      'Pinochet dönemi hassas; siyasi yorum yapma.',
      "Mapuçe kültürüne saygı; Araucanía'da toprak anlaşmazlıkları.",
    ],
    dressCode:
      "Santiago batılı; Patagonya'da her mevsim rüzgârlık ve katman; Atacama'da gece don, gündüz UV.",
    religionNotes:
      'Katolik çoğunluk, laik devlet; kiliselerde şortla giriş yadırganır. Andean And Paskalya (Semana Santa) haftasında ulaşım yoğun.',
    photographyRules:
      'Serbest; askeri ve polis (Carabineros) çekimi sorun olabilir. Mapuçe törenlerinde izin. Drone milli parklarda CONAF izni.',
    tipping:
      'Lokantada %10 "propina" hesaba öneri olarak yazılır; kabul et. Taksi yuvarla; refugio personeline gerekmez; rehber günde 10.000–20.000 CLP.',
    bargaining: "Yok; feria (pazar) dışında sabit fiyat. Uber/Cabify Santiago'da.",
    watchOut: [
      "Santiago merkez ve Valparaíso'da telefon kapkaçı; motorlu hırsızlık.",
      'Torres del Paine rüzgârı 120 km/s; çadır kazıklarını sağlam çak, geçitlerde geri dön.',
      'Ateş yasağı: parkta yalnızca belirlenmiş noktalarda; 2011 yangınından beri ihlal para/hapis cezası.',
      'Atacama ve Ojos del Salado irtifa; San Pedro 2.400 m, geyzerler 4.300 m.',
      'Protesto günleri (Plaza Italia) biber gazı; kalabalıktan uzak dur.',
      "Sokak köpekleri Santiago'da çok ve genelde uysal; Patagonya çiftliklerinde çoban köpeği.",
      'ATM skimming; banka içi ATM.',
      'Kolektivo taksiler paylaşımlı; yanlış sabit fiyata dikkat.',
    ],
    womenTravelers:
      "Güney Amerika'nın en güvenli ülkelerinden; Santiago'da gece taksi. Patagonya trek yolları yalnız kadın için çok uygun; refugio ortak yatakhaneleri.",
    laws: [
      'Drone: DGAC kaydı; milli parklarda CONAF izni olmadan yasak.',
      'Alkol: 18 yaş; sürüşte 0,3‰; sokakta içmek yasak (uygulanır).',
      'Uyuşturucu: kişisel kullanım gri, taşıma cezalı.',
      'LGBTİ+: evlilik yasal (2022), ayrımcılık yasağı var.',
      'Kamp: milli parklarda yalnızca belirlenmiş kamp; ateş yasağı katı.',
      'Meyve/tohum ithalatı SAG tarafından yasak; ceza yüksek.',
    ],
    droneRules: "CONAF milli parklarda izin çok nadir; Torres del Paine'de yasak.",
    alcoholRules: '18 yaş; şarap ve pisco kültürü; halka açık alanda içmek yasak.',
    money:
      "Şili Pesosu (CLP) — 1 CLP ≈ ₺0,048. Kart her yerde; ATM (Redbanc) komisyonlu. Patagonya'da nakit için Puerto Natales'te çek. Otelde pasaport+turist kartıyla %19 KDV muafiyeti.",
    connectivity:
      "Entel/Movistar/WOM SIM pasaportla; 30 gün 30 GB ≈ 10.000 CLP. Patagonya parkında sinyal yok; Puerto Natales'te Entel. eSIM Airalo çalışır.",
    health: [
      "Musluk suyu Santiago'da içilebilir (mineralli), kuzeyde mineral yüksek.",
      'UV ozon deliği nedeniyle çok yüksek.',
      'İrtifa Atacama/And.',
      'Hantavirüs Güney Şili kırsalında (kemirgen); çadırı temiz tut.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Hepatit B'],
    bestMonths: [11, 12, 1, 2, 3],
    dailyTips: [
      'Torres del Paine rezervasyonunu sezon açıldığında (Temmuz) yap.',
      'Otobüs ağı (Turbus, Pullman) uzun mesafede uçakla yarışır; Cama koltuk.',
      'Öğle "menú del día" 6.000–8.000 CLP; akşam yemek 21:00 sonrası.',
      'Deprem ülkesi: otelde tahliye yolunu bil, tsunami işaretleri kıyıda.',
      "Patagonya'da yaz ortasında bile 4 mevsim; yağmur pantolonu şart.",
    ],
    sources: [
      'https://www.chile.gob.cl/turquia',
      'https://www.conaf.cl',
      MFA_URL,
      'https://santiago.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'AR',
    name: 'Arjantin',
    region: 'Güney Amerika · Patagonya',
    languages: ['es'],
    currency: 'ARS',
    tryRate: 0.035,
    timezone: 'UTC-3',
    plugTypes: ['C', 'I'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.argentina.gob.ar/interior/migraciones',
      note: 'Türk vatandaşları 90 gün vizesiz. Aconcagua için ayrı izin (Mendoza) gerekir.',
    },
    documents: [
      passport(6),
      insurance(
        "Aconcagua (6.961 m) helikopter tahliyesi park ücretine dahil ama Mendoza'ya kadar; irtifa ve tıbbi kapsam.",
      ),
      permit(
        'aconcagua_permit',
        'Aconcagua tırmanış izni',
        "Mendoza'da online (aconcagua.mendoza.gov.ar) yüksek sezon ≈ 1.000 $, yalnızca park girişinde alınır; tıbbi kontrol Plaza de Mulas'ta zorunlu.",
        false,
      ),
      permit(
        'park_permit',
        'Los Glaciares / Nahuel Huapi park girişleri',
        'El Chaltén ücretsiz; Perito Moreno giriş ücreti; kamp kayıtları.',
        false,
      ),
      idp(),
      cashUsd(
        'USD nakit "dólar" hâlâ avantajlı olabilir; kartla Visa/Mastercard "MEP" kuru uygulanır — resmî kaynağı kontrol et.',
      ),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      'Tek yanak öpücüğü herkes arasında (erkek-erkek dahil).',
      'Mate paylaşımı: ikram edilirse "gracias" deme (bitirdim demek), bombilla\'yı karıştırma.',
      'Akşam yemeği 22:00; asado (mangal) daveti 4–5 saat sürer.',
      'Falkland/Malvinas konusu hassas; "Malvinas" de.',
      'Yüksek sesli ve fiziksel iletişim; kişisel alan küçük.',
      'Kuyruk ve dakiklik esnek ("hora argentina").',
    ],
    dressCode:
      'Buenos Aires şık ve batılı; Patagonya rüzgâr, Kuzey (Salta, Jujuy) muhafazakâr yerli köyleri.',
    religionNotes:
      "Katolik çoğunluk; Papa Francis etkisi; Kuzeybatı'da Pachamama (Toprak Ana) ritüelleri Ağustos'ta. Yahudi cemaati BA'da büyük.",
    photographyRules:
      "Serbest; askeri alan ve polis sınırlı. Yerli topluluklar Jujuy'da izin ister. Drone milli parklarda yasak.",
    tipping:
      'Lokanta %10 nakit (kartla eklenemez), taksi yuvarla, dağ rehberi günde 20–30 $; refugio yok.',
    bargaining: 'Feria ve San Telmo antika pazarında hafif; mağazalarda yok.',
    watchOut: [
      'Buenos Aires: "kuş pisliği/hardal" hilesi (biri kirletir, biri temizlerken çantayı alır); La Boca turistik cadde dışına çıkma.',
      'Sahte para: 1.000 ARS banknot kontrolü, taksi şoförü "sahte" deyip değiştirebilir.',
      'Kur karmaşası: resmî/blue/MEP; kartla ödeme artık avantajlı, sokakta "cambio" bağıranlara gitme.',
      "Patagonya rüzgârı ve ani hava; Fitz Roy'da Laguna de los Tres son tırmanışta buz.",
      'Aconcagua: ölüm oranı yüksek, HAPE/HACE; 3 aklimatizasyon günü zorunlu, tıbbi kontrol.',
      'Yol: uzun mesafe, benzin istasyonları arası 300 km (Ruta 40); yakıt doldur.',
      'Sokak köpekleri Patagonya kasabalarında sürüyle; uysal ama bisiklete saldırır.',
      'Protesto (piquete) yolları kapatabilir; alternatif rota.',
    ],
    womenTravelers:
      'Genel olarak güvenli; BA\'da gece Uber, yalnız kadın için Patagonya hostel ağı güçlü. Sözlü "piropo" yaygın ama zararsız.',
    laws: [
      'Drone: ANAC kaydı; milli parklarda (APN) yasak.',
      'Alkol: 18 yaş; sürüşte 0,5‰ (bazı eyaletlerde 0).',
      'Uyuşturucu: kişisel esrar dekriminalize edilmiş durumda (mahkeme kararı), taşıma gri.',
      'LGBTİ+: evlilik yasal (2010), cinsiyet kimliği yasası; BA çok açık.',
      "Kamp: milli parklarda belirlenmiş alan; vahşi kamp El Chaltén'de kayıtlı; ateş yasağı katı (2021 yangınları).",
      'Deniz ürünleri/meyve Şili sınırında el konur.',
    ],
    droneRules: "Los Glaciares, Nahuel Huapi ve Aconcagua'da yasak; şehirde ANAC kaydı.",
    alcoholRules: '18 yaş; şarap (Malbec) kültürü; sokakta içmek bazı şehirlerde yasak.',
    money:
      "Arjantin Pesosu (ARS) — kur çok dalgalı (1 ARS ≈ ₺0,035 tahmini). Kartla ödeme (Visa/MC) MEP kuruyla avantajlı; ATM çekimi düşük limit ve yüksek ücret. Western Union transferi hâlâ popüler. Patagonya'da nakit taşı.",
    connectivity:
      "Claro/Personal/Movistar SIM pasaportla; 30 gün 25 GB ≈ 10.000 ARS. El Chaltén'de sinyal zayıf, park içinde yok. eSIM Airalo.",
    health: [
      "Musluk suyu BA ve Patagonya'da içilebilir.",
      'Aconcagua irtifa ve soğuk (-30 °C).',
      "Dang Kuzey'de yazın.",
      'Hantavirüs Patagonya kırsalı (Andes virus) — kemirgen temasından kaçın.',
    ],
    vaccines: ['Hepatit A', 'Tetanos', 'Hepatit B', 'Sarı humma (Iguazú/Misiones için)'],
    bestMonths: [11, 12, 1, 2, 3],
    dailyTips: [
      "El Chaltén'e giriş serbest, kamp ücretsiz; hava penceresi için Windguru kontrol.",
      'Otobüs (Andesmar, Vía Bariloche) uzun ama konforlu; "cama suite".',
      'Kahvaltı zayıf, öğle 13:00, akşam 22:00; medialunas.',
      "Mate seti al, Patagonya'da su ısıtıcı her benzincide.",
      "Aconcagua için Mendoza'da ekipman kiralama ve katır (mula) ayarla.",
    ],
    sources: [
      'https://www.argentina.gob.ar/interior/migraciones',
      'https://www.argentina.gob.ar/parquesnacionales',
      MFA_URL,
      'https://buenosaires.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'PE',
    name: 'Peru',
    region: 'Güney Amerika · And',
    languages: ['es', 'qu', 'ay'],
    currency: 'PEN',
    tryRate: 12.2,
    timezone: 'UTC-5',
    plugTypes: ['A', 'C'],
    visa: {
      type: 'visa_free',
      maxStayDays: 183,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.gob.pe/migraciones',
      note: 'Türk vatandaşları vizesiz; girişte görevli 90 gün verir (183 güne kadar isteyebilirsin). "Tarjeta Andina" artık dijital; pasaport damgasını kontrol et.',
    },
    documents: [
      passport(6),
      insurance(
        "Cusco irtifa, Huaraz (Cordillera Blanca) tırmanış ve helikopter tahliye; Peru'da kurtarma (Casa de Guías, Policía de Alta Montaña) sınırlı.",
      ),
      permit(
        'inca_trail',
        'Inca Trail permi',
        'Yalnızca lisanslı operatör üzerinden; günlük 500 kişi (200 turist) kotası, yüksek sezon için 5–6 ay önce dolar; Şubat kapalı. Pasaport numarası perm ile eşleşmeli, aynı pasaportla gir.',
      ),
      permit(
        'machu_picchu',
        'Machu Picchu bileti (saat dilimi + devre)',
        "gob.pe/machupicchu resmî site; Huayna Picchu ayrı kota; Aguas Calientes'te de satılır ama tükenir.",
        false,
      ),
      permit(
        'huascaran',
        'Huascarán Milli Parkı giriş',
        "Huaraz'da 1 gün 30 PEN, 21 gün 150 PEN; Santa Cruz trek için kayıt.",
        false,
      ),
      returnTicket(),
      cashUsd('Kırsal ve Aguas Calientes ATM sınırlı.'),
      vaccineCard(),
    ],
    etiquette: [
      '"Buenos días" ile her karşılaşmaya başla; yanak öpücüğü kadınlarla.',
      'Quechua köylerinde "allillanchu" (nasılsın) gülümsetir; koka yaprağı ikramını kabul et.',
      'Pachamama\'ya ilk yudum içki dökme ritüeli ("ch\'alla") — katıl.',
      'Yerli kadınları ve çocukları izinsiz çekme; poz veren "lama kadınları" bahşiş bekler.',
      'Dakiklik gevşek ("hora peruana"); otobüsler dışında.',
      "Şili ile pisco tartışması espri konusu; Peru'yu tut.",
    ],
    dressCode:
      "Lima batılı; Cusco ve And köylerinde muhafazakâr; kiliselerde kapalı. Trek'te teknik giyim normal, gece 0 °C altı.",
    religionNotes:
      "Katolik + And senkretizmi (Pachamama, apu dağ ruhları). Kiliselerde ayin sırasında fotoğraf yok. Corpus Christi ve Inti Raymi (24 Haziran) Cusco'da büyük.",
    photographyRules:
      "Machu Picchu'da tripod ve drone yasak, selfie çubuğu kısıtlı. Askeri alan ve havalimanı yasak. Yerlilerin fotoğrafı için izin/ücret.",
    tipping:
      "Inca Trail porter'a kişi başı 60–100 PEN, aşçıya 100 PEN, rehbere 100–150 PEN (grup); lokantada %10, taksi yok.",
    bargaining:
      'Pazar (Pisac, San Pedro) ve taksi için pazarlık; taksimetre yoktur, önce fiyat. Alpaka ürünlerinde "baby alpaca" iddiasını kontrol et.',
    watchOut: [
      "Cusco irtifa (3.400 m): uçakla gelince ilk gün dinlen, koka çayı, Sacred Valley'de (2.800 m) uyumak daha iyi.",
      'Taksi: Lima\'da havalimanı "Taxi Green/Directo" ya da Uber; sokakta durdurma, sahte taksi soygunları.',
      'Yankesicilik: Lima Centro, Cusco San Pedro pazarı, gece otobüsleri (çantayı kucağında tut).',
      'Sahte para (100 PEN); banknot kontrolü.',
      'Sahte Inca Trail operatörleri: perm listesi (SERNANP) kontrol et, çok ucuza yok.',
      '"Ayahuasca" seremonileri: denetimsiz şamanlar, ölüm/taciz raporları; lisanslı merkez.',
      "Sokak köpekleri Cusco'da çok; kuduz Puno/Arequipa'da bildirildi.",
      "Rainbow Mountain 5.000 m; Cusco'da 3 gün aklimatizasyon olmadan gitme.",
    ],
    womenTravelers:
      "Cusco ve trek rotaları güvenli; Lima'da gece Uber. Gece otobüsünde taciz raporları için üst kat ön koltuk yerine alt kat. Kadın porter grubu (Evolution Treks) mevcut.",
    laws: [
      'Drone: DGAC kaydı; Machu Picchu, Cusco tarihi merkez ve tüm arkeolojik alanlarda yasak (el koyma).',
      'Alkol: 18 yaş; sokakta içmek yasak.',
      "Uyuşturucu: koka yaprağı yasal, kokain ağır suç; havalimanında yaprak çıkarma (Türkiye'de yasak).",
      'LGBTİ+: yasal, evlilik yok; Lima Miraflores açık, kırsalda muhafazakâr.',
      "Kamp: Inca Trail yalnızca belirlenmiş kamp; Huascarán'da serbest, ateş yasak.",
      'Arkeolojik eser çıkarmak ağır suç.',
    ],
    droneRules: 'Arkeolojik alanlar ve milli parklarda yasak; Huaraz dağlarında SERNANP izni.',
    alcoholRules: '18 yaş; pisco sour ve chicha; kutlamalarda ısrar olabilir.',
    money:
      'Sol (PEN) — 1 PEN ≈ ₺12,2. ATM (BCP, Interbank) şehirlerde; Aguas Calientes pahalı. Kart turistik yerlerde; küçük banknot taşı (bozuk yok). USD kabul edilir ama kötü kur.',
    connectivity:
      "Claro/Movistar/Entel SIM pasaportla; 30 gün 20 GB ≈ 40 PEN. Inca Trail'de sinyal yok; Huaraz vadilerinde Claro. eSIM Airalo.",
    health: [
      'İrtifa: Cusco, Puno (3.800 m), Huaraz (3.050 m); soroche (AMS) hapı yerine Diamox.',
      'Su: şişe/filtre; ishal yaygın.',
      "Sarı humma ve sıtma Amazon'da (Iquitos, Manu).",
      "Güneş UV And'da çok yüksek.",
      'Dang Amazon ve kıyı kuzeyde.',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Sarı humma (Amazon)',
      'Kuduz (isteğe bağlı)',
    ],
    bestMonths: [5, 6, 7, 8, 9],
    dailyTips: [
      'Machu Picchu biletini önce al, sonra tren (PeruRail/Inca Rail) — ikisi de tükenir.',
      'Cusco\'da "menú" öğle 10–15 PEN; ceviche yalnızca öğlen taze.',
      'Otobüs Cruz del Sur/Oltursa güvenli; ucuz firmalardan kaçın.',
      'Koka çayı irtifa için; 3 günde alışırsın.',
      "Huaraz'da Laguna 69 günübirlik 4.600 m; önce Wilcacocha ile aklimatize ol.",
    ],
    sources: [
      'https://www.gob.pe/migraciones',
      'https://www.gob.pe/machupicchu',
      'https://www.sernanp.gob.pe',
      MFA_URL,
      'https://lima.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'BO',
    name: 'Bolivya',
    region: 'Güney Amerika · And',
    languages: ['es', 'qu', 'ay'],
    currency: 'BOB',
    tryRate: 6.5,
    timezone: 'UTC-4',
    plugTypes: ['A', 'C'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.migracion.gob.bo',
      note: 'Türk vatandaşları vizesiz (Grup 1); girişte 30 gün verilir, migración ofisinde 90 güne uzatılır. Sarı humma kartı Amazon bölgesi için istenebilir. Resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      insurance(
        "Huayna Potosí (6.088 m), Sajama; Bolivya'da helikopter kurtarma yok — sigorta tahliye için özel operatör.",
      ),
      yellowFever(
        false,
        'Amazon (Rurrenabaque) ve bazı sınır kapılarında istenir; kart yanında olsun.',
      ),
      permit('park_permit', 'Sajama / Madidi park girişi', 'Kapıda nakit BOB.', false),
      cashUsd('ATM La Paz dışında güvenilmez; USD nakit bozdur.'),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Buenos días" şart; Aymara\'da "kamisaraki".',
      'Cholita (geleneksel kadın) fotoğrafı için izin; asla habersiz.',
      "Pachamama'ya ch'alla (içki dökme) ve koka ikramı; katılmak saygı.",
      'Kuyruk ve dakiklik gevşek; otobüsler saatinde kalkmaz.',
      'Siyaset (Evo Morales, lityum) tartışmalı; dinle.',
      'Yerli topluluklar kapalı olabilir; rehberle git.',
    ],
    dressCode: 'La Paz muhafazakâr ve soğuk; kiliseler kapalı giyim; Uyuni gece -15 °C.',
    religionNotes:
      'Katolik + Aymara/Quechua inançları; Alasitas (Ocak) ve Gran Poder festivali. Cadılar Pazarı (Mercado de Brujas) lama fetüsü satar — ritüel objesi, saygı.',
    photographyRules:
      "Askeri ve polis yasak; yerli pazarlarında (El Alto) fotoğraf düşmanlığı yüksek, izin şart. Salar'da drone genelde tolere ama Sajama'da izin.",
    tipping:
      'Beklenmez; lokantada %5–10 memnun eder; rehbere günde 50–100 BOB; dağ rehberi/porter 100 BOB.',
    bargaining:
      'Pazar ve taksi için; Uyuni turu için operatörler arası karşılaştırma. Sabit fiyatlı lokanta.',
    watchOut: [
      'La Paz sahte polis + sahte taksi kombinasyonu ("express kidnapping"): tanımadığın taksiye binme, radyo taksi çağır.',
      'Uyuni tur şoförleri alkol ve uykusuz; 4x4 kazaları ölümcül — güvenilir operatör (Red Planet, Quechua Connection), gece sürüş yok.',
      "El Alto'da gündüz bile hırsızlık; linç uyarı mankenleri gerçek.",
      'İrtifa: La Paz 3.650 m, El Alto havalimanı 4.060 m; ilk gün yavaş.',
      'Death Road bisikleti: fren ve rehber kontrolü; yağmurda gitme.',
      'Yol blokajları (bloqueos) günler sürebilir; esneklik.',
      'Sahte para ve ATM skimming.',
      "Sokak köpekleri La Paz'da sürü, gece saldırgan olabilir.",
    ],
    womenTravelers:
      "Genel olarak güvenli; gece La Paz'da radyo taksi. Yerli toplumlarda cinsiyet rolleri geleneksel. Yalnız kadın için Uyuni turlarında grup.",
    laws: [
      'Drone: DGAC kaydı; Salar ve şehirde genelde izin; Madidi ve Sajama izinli.',
      'Alkol: 18 yaş; sürüşte sıfır; sokakta içmek yasak.',
      'Uyuşturucu: koka yaprağı yasal, kokain ağır suç (San Pedro hapishanesi turu efsanesi gerçek değil).',
      "LGBTİ+: yasal, evlilik yok; La Paz'da küçük topluluk, kırsalda muhafazakâr.",
      "Kamp: milli parklarda izinle; Salar'da tuz oteli/kamp turla.",
      'Seçim günlerinde alkol yasağı ve trafik yasağı.',
    ],
    droneRules:
      "Kayıt gerekli; askeri bölge ve havalimanı yakınında yasak. Salar de Uyuni'de operatör izni.",
    alcoholRules: '18 yaş; Paceña bira ve singani; "ch\'alla" ritüelinde bir yudum yeter.',
    money:
      'Boliviano (BOB) — 1 BOB ≈ ₺6,5. La Paz ATM (BNB, BCP); kırsalda nakit; kart nadir. USD bozdur (paralel kur olabilir — resmî kaynağı kontrol et).',
    connectivity:
      "Entel/Tigo SIM pasaportla; 30 gün 10 GB ≈ 100 BOB. Entel dağlarda ve Uyuni'de en iyi. eSIM sınırlı.",
    health: [
      'İrtifa en büyük risk (La Paz, Potosí 4.000 m).',
      'Su: şişe; ishal yaygın.',
      'Sarı humma/sıtma Amazon.',
      'Chagas hastalığı kırsal kerpiç evlerde (cibinlik).',
      'Soğuk: Altiplano gece -20 °C.',
    ],
    vaccines: ['Hepatit A', 'Tifo', 'Tetanos', 'Hepatit B', 'Sarı humma', 'Kuduz (isteğe bağlı)'],
    bestMonths: [5, 6, 7, 8, 9, 10],
    dailyTips: [
      "Teleférico (Mi Teleférico) La Paz'ın en iyi manzarası ve ulaşımı, 3 BOB.",
      'Uyuni turunu Uyuni kasabasından al, Tupiza yönü daha az kalabalık.',
      "Almuerzo (öğle menü) 15–25 BOB; salteña sabah 10'da.",
      'Huayna Potosí 3 günlük tırmanış acenteleri Sagárnaga sokağında; ekipman kontrol.',
      'Yol kapanmaları için haberleri (Los Tiempos) izle, yedek gün bırak.',
    ],
    sources: ['https://www.migracion.gob.bo', MFA_URL, 'https://lima.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'BR',
    name: 'Brezilya',
    region: 'Güney Amerika',
    languages: ['pt'],
    currency: 'BRL',
    tryRate: 8.2,
    timezone: 'UTC-3 (BRT) / UTC-4 (Amazon)',
    plugTypes: ['C', 'N'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.gov.br/mre',
      note: 'Türk vatandaşları 90 gün vizesiz (180 günde 90). Sarı humma aşısı Amazon/Pantanal ve iç bölgeler için önerilir; sınırda istenmez ama sonraki ülkeler isteyebilir.',
    },
    documents: [
      passport(6),
      insurance('Amazon, Chapada Diamantina; şehir sağlık masrafları yüksek.'),
      yellowFever(
        false,
        'Amazon, Pantanal, Minas Gerais için WHO önerisi; Brezilya sonrası ülkeler ICVP isteyebilir.',
      ),
      idp(),
      returnTicket(true),
      vaccineCard(),
    ],
    etiquette: [
      'İki yanak öpücüğü (Rio), tek (SP); "tudo bem?" karşılığı "tudo bem".',
      'Portekizce, İspanyolca değil; "obrigado/obrigada" cinsiyete göre.',
      'Fiziksel yakınlık ve dokunma normal; kişisel alan küçük.',
      'Dakiklik gevşek; parti 2 saat geç başlar.',
      'OK işareti (baş-işaret parmağı halka) kaba; başparmak yukarı kullan.',
      'Plajda havlu-şezlong kültürü; "caipirinha" ikramı.',
      'Favela hakkında yorum yapma; yerel rehberle ziyaret.',
    ],
    dressCode:
      "Rio plaj ve rahat; kiliselerde şortsuz. Amazon'da uzun kol (sinek). Güney kışın soğuk.",
    religionNotes:
      "Katolik + Evanjelik + Candomblé/Umbanda (Afro-Brezilya); Salvador'da terreiro ziyaretleri saygıyla. Yeni yılda beyaz giyip Yemanjá'ya çiçek.",
    photographyRules:
      'Serbest; favela ve plajda insanları izinsiz çekme; askeri yasak. Telefonu sokakta çıkarmak hırsızlık daveti.',
    tipping: 'Lokanta %10 "serviço" hesapta; ek beklenmez. Taksi yuvarla; rehber günde 50–100 BRL.',
    bargaining: 'Pazar ve plaj satıcılarında hafif; mağaza yok. Uber/99 her yerde.',
    watchOut: [
      'Kapkaç ve silahlı soygun Rio/SP\'de; telefonu göstermeden yürü, plajda değerli eşya bırakma ("arrastão" kalabalık soygunları).',
      'Gece plaj ve boş sokaklar yasak bölge; Uber kapıdan kapıya.',
      '"Boa noite Cinderela": bar/uygulama tanışmasında içeceğe ilaç; içeceğini bırakma.',
      'Sahte taksi ve havalimanı "yardımcı"; resmî gişe.',
      'Sivrisinek: dang, zika, chikungunya yıl boyu; sarı humma iç bölge.',
      'Amazon: piranha/kaiman hikâyelerinden çok ishal, sıtma ve ısı çarpması.',
      "Chapada/Patagônia trek'lerinde ani sel (cânion); yağmur uyarısı.",
      'ATM skimming ve "cartão clonado"; banka içi, gündüz.',
    ],
    womenTravelers:
      'Sözlü taciz yaygın; gece Uber, plajda grupla. Karnavalda taciz raporları; "Não é não" kampanyası. Hostel ve kadın grupları güçlü.',
    laws: [
      'Drone: ANAC kaydı (250 g üstü); milli parklarda ICMBio izni; plaj ve kalabalıkta yasak.',
      'Alkol: 18 yaş; sürüşte sıfır tolerans ("Lei Seca").',
      'Uyuşturucu: kullanım dekriminalize eğilimi, taşıma suç.',
      'LGBTİ+: evlilik yasal (2013), SP Pride dünyanın en büyüğü; homofobik şiddet vakaları da yüksek.',
      'Kamp: milli parklarda belirlenmiş alan; plajda kamp yasak.',
      "Karnaval sırasında sokakta idrar cezası; Rio'da 2025'ten beri plaj müzik hoparlörü yasağı.",
    ],
    droneRules: "ANAC SISANT kaydı; Iguaçu, Lençóis, Fernando de Noronha'da yasak.",
    alcoholRules: '18 yaş; plajda ve sokakta içmek serbest (karnaval); araçta sıfır.',
    money:
      'Real (BRL) — 1 BRL ≈ ₺8,2. Kart ve Pix (yerel hesap gerekir) her yerde; ATM (Banco do Brasil, Bradesco) gündüz. Nakit az taşı.',
    connectivity:
      'Claro/Vivo/TIM SIM CPF numarası ister (turist için zor); havalimanı standı "chip turista" ya da eSIM Airalo daha kolay. Amazon\'da yalnızca Vivo.',
    health: [
      'Dang/zika/chikungunya: DEET, uzun kol.',
      'Sarı humma iç bölgeler.',
      'Sıtma yalnızca Amazon havzası.',
      'Su: şişe; büyük şehirlerde filtreli.',
      'Güneş çok güçlü.',
    ],
    vaccines: [
      'Sarı humma',
      'Hepatit A',
      'Tetanos',
      'Hepatit B',
      'Tifo',
      'Sıtma profilaksisi (Amazon)',
    ],
    bestMonths: [4, 5, 6, 7, 8, 9],
    dailyTips: [
      'Uber/99 her mesafe için; sokak taksisinde "bandeira 2" gece tarifesi.',
      'Açaí kâsesi, pão de queijo, PF (prato feito) öğle 25–35 BRL.',
      'Plajda "barraca" numarasını hatırla; şezlong kirası.',
      'Pix ödeme yerel; turist için kart yeterli.',
      'Karnaval biletleri Sambódromo için aylar önce; blocos ücretsiz.',
    ],
    sources: ['https://www.gov.br/mre', MFA_URL, 'https://brasilia.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'US',
    name: 'Amerika Birleşik Devletleri',
    region: 'Kuzey Amerika',
    languages: ['en', 'es'],
    currency: 'USD',
    tryRate: 45,
    timezone: 'UTC-5 … UTC-10',
    plugTypes: ['A', 'B'],
    visa: {
      type: 'embassy',
      maxStayDays: 180,
      costTry: 8300,
      processingDays: 90,
      url: 'https://tr.usembassy.gov/visas/',
      note: "Türk vatandaşları ESTA/Vize Muafiyet Programı'na dahil DEĞİL; B1/B2 turist vizesi (185 $) için DS-160 + görüşme. Randevu bekleme süresi aylar sürebilir (Ankara/İstanbul); onaylı vize 10 yıl çok girişli. Sınırda I-94 süresi genelde 6 ay. Elektronik cihaz aramaları ve sosyal medya kontrolü mümkün — resmî kaynağı kontrol et.",
    },
    documents: [
      passport(
        6,
        'ABD için pasaport kalış süresi boyunca geçerli olmalı (6 ay kuralı Türkiye için istisnalı) — resmî kaynağı kontrol et.',
      ),
      visaDoc('B1/B2 vize etiketi; DS-160 onay sayfası ve randevu belgesi görüşmeye götür.'),
      insurance(
        'ABD sağlık masrafları dünyanın en yükseği (ambulans 2.000 $+, gece yatış 5.000 $+); yüksek limitli poliçe şart. Milli parklarda SAR ücretsiz (NPS) ama helikopter/hastane değil.',
      ),
      permit(
        'nps_permit',
        'NPS izinleri (Half Dome, Whitney, Angels Landing, backcountry)',
        'recreation.gov çekilişleri: Half Dome (Mart), Whitney (Şubat), Angels Landing (mevsimlik), Enchantments; backcountry permit park ofisi. "America the Beautiful" yıllık pass 80 $.',
        false,
      ),
      permit(
        'bear_canister',
        'Ayı kutusu (bear canister)',
        "Sierra Nevada, Yosemite, Denali'de zorunlu; park girişinde kiralanır.",
        false,
      ),
      idp(),
      returnTicket(true),
      hotelBooking(),
      bankStatement(),
    ],
    etiquette: [
      'Küçük sohbet ("How are you?") cevap beklemez; gülümse ve "good, you?"',
      'Kişisel alan geniş; sıra kültürü katı; kapı tutmak yaygın.',
      'Bahşiş bir kültür değil ekonomi: %18–22 lokanta, 1–2 $ bardaki her içki.',
      'Trail görgüsü: yokuş yukarı çıkanın önceliği var; "on your left" geçerken.',
      'Leave No Trace: yerel halkın ciddiyeti yüksek; çöp, kaka bezi (WAG bag) taşıma.',
      'Polisle karşılaşmada ellerini görünür tut, ani hareket yapma.',
      'Sigara ve alkol kamuya açık alanda sınırlı; kamp alanı sessiz saat 22:00.',
    ],
    dressCode:
      "Rahat ve gündelik; ulusal parklarda outdoor giyim. Güneybatı çölünde şapka/UV; Alaska'da böcek ağı.",
    religionNotes:
      "Çoğulcu; Güney eyaletlerinde dindarlık yüksek (Pazar kapalı dükkânlar), Utah'ta Mormon kültürü (alkol kısıtlı). Yerli Amerikan rezervasyonlarında (Navajo, Havasupai) kendi yasaları ve izinleri.",
    photographyRules:
      'Kamusal alanda serbest; askeri üs, sınır, TSA kontrol noktası yasak. Yerli rezervasyonlarında izin ve ücret (Antelope Canyon). Drone tüm milli parklarda yasak.',
    tipping:
      'Lokanta %18–22, bar 1–2 $/içki, taksi/Uber %15, otel temizlik 2–5 $/gece, rehber günde 20–50 $, shuttle şoförü 5 $. Bahşiş vermemek ciddi ayıp.',
    bargaining:
      'Yok; garaj satışı ve bit pazarı hariç. Fiyatlar vergisiz yazılır, kasada %6–10 eklenir.',
    watchOut: [
      'Sağlık masrafı: sigortasız ER ziyareti binlerce dolar; küçük şikâyetler için "urgent care".',
      'Ayı ülkesi: yiyecekleri ayı kutusu/asma, çadırdan uzakta pişir; grizzly bölgesinde ayı spreyi (uçakla taşınmaz, yerinde al).',
      "Çöl ısısı: Grand Canyon'da yaz ölümleri; günde 4–6 L su, öğlen yürüme.",
      'Trafik: uzun mesafe uykusuzluk; kırsalda geyik çarpması; "right on red".',
      'Silah: kırsal/güney eyaletlerde yaygın; mülke izinsiz girme ("No Trespassing").',
      'Şehir merkezlerinde evsizlik/uyuşturucu kümeleri (SF Tenderloin, LA Skid Row); araç camı kırma.',
      "Kene (Lyme) Kuzeydoğu'da; kontrol et.",
      'Sınırda cihaz araması ve sosyal medya kontrolü; giriş reddi itiraz edilemez.',
    ],
    womenTravelers:
      'Genel olarak güvenli; şehir merkezlerinde gece dikkat. Ulusal park kamp alanları ve trail toplulukları kadın dostu; yalnız kadın "thru-hiker" kültürü güçlü.',
    laws: [
      'Drone: FAA kaydı (250 g üstü) ve TRUST sınavı; tüm NPS milli parklarında yasak; state park ve BLM arazilerinde çoğunlukla serbest.',
      'Alkol: 21 yaş, kimlik her zaman; sokakta açık kap yasak; sürüşte 0,08%.',
      'Uyuşturucu: esrar eyalete göre yasal (CA, CO, WA…) ama federal arazide (milli park) yasak; sınırda beyanı giriş yasağı doğurur.',
      'LGBTİ+: evlilik federal düzeyde yasal; eyalet yasaları (trans hakları) farklılaşır.',
      'Kamp: milli parklarda yalnızca izinli; BLM/National Forest "dispersed camping" 14 gün serbest; ateş yasakları yaz boyunca (Red Flag).',
      'Yaban hayatı besleme, izinsiz balıkçılık, orman ürünü toplama cezalı.',
    ],
    droneRules:
      "Milli parklarda (NPS) tam yasak; National Forest ve BLM'de FAA kurallarıyla serbest, wilderness alanlarında yasak.",
    alcoholRules: "21 yaş; Utah/Pennsylvania'da devlet mağazası; kamp alanında kapalı kapta.",
    money:
      'ABD Doları — 1 USD ≈ ₺45. Kart/contactless her yerde, nakit bahşiş için. ATM ücretleri 3–5 $. Fiyatlara satış vergisi eklenir.',
    connectivity:
      'T-Mobile/AT&T prepaid (30 gün sınırsız ≈ 50 $) ya da eSIM (Airalo/Holafly). Parklarda ve dağlarda çoğunlukla sinyal yok; Garmin inReach yaygın, parkta harita indir.',
    health: [
      "Su: musluk içilebilir; trail'de filtre (giardia).",
      'Ayı, dağ aslanı, çıngıraklı yılan; kene (Lyme).',
      "Yüksek irtifa: Colorado 14er'lar, Whitney 4.421 m.",
      'Isı çarpması güneybatı; hipotermi kuzey.',
      'İlaçlar pahalı; reçetelerini getir.',
    ],
    vaccines: [
      'Rutin aşılar',
      'Tetanos',
      'Hepatit A/B (isteğe bağlı)',
      'Kuduz (uzun backcountry, isteğe bağlı)',
    ],
    bestMonths: [5, 6, 7, 8, 9, 10],
    dailyTips: [
      'recreation.gov hesabı aç; popüler kamp alanları 6 ay önce dolar.',
      'Vize görüşmesi için seyahat planı, iş/okul bağını gösteren belgeler; kısa net cevap.',
      'Araç kiralamada sigorta (CDW/LDW) ve "one-way" ücreti; benzin galon.',
      "REI/Walmart'ta gaz kartuşu ve ayı spreyi; uçağa binmez.",
      "Park girişinde ranger'la konuş: hava, ayı uyarısı, su kaynakları.",
    ],
    sources: [
      'https://tr.usembassy.gov/visas/',
      'https://www.nps.gov',
      'https://www.recreation.gov',
      MFA_URL,
      'https://vasington.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'CA',
    name: 'Kanada',
    region: 'Kuzey Amerika',
    languages: ['en', 'fr'],
    currency: 'CAD',
    tryRate: 33,
    timezone: 'UTC-3:30 … UTC-8',
    plugTypes: ['A', 'B'],
    visa: {
      type: 'embassy',
      maxStayDays: 180,
      costTry: 6200,
      processingDays: 45,
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html',
      note: "Türk vatandaşları eTA'ya uygun değil; Visitor Visa (TRV) 100 CAD + biyometri 85 CAD; IRCC portalından çevrimiçi başvuru, VFS Ankara/İstanbul'da parmak izi. İşlem süresi 3–8 hafta, 10 yıla kadar çok giriş. Geçerli ABD vizesi olanlara kolaylık yok ama olumlu etki.",
    },
    documents: [
      passport(6),
      visaDoc('TRV vize etiketi pasaportta; "letter of introduction" değil, etiket.'),
      insurance(
        'Kanada sağlık masrafı yüksek; dağ kurtarma (Parks Canada) ücretsiz ama helikopter hastane transferi değil; heli-ski/tırmanış kapsamı.',
      ),
      permit(
        'parks_pass',
        'Parks Canada Discovery Pass + backcountry permit',
        "Yıllık Discovery Pass 75 CAD; Banff/Jasper backcountry kamp rezervasyonu Ocak'ta açılır, hızla dolar.",
        false,
      ),
      permit(
        'bear_spray',
        'Ayı spreyi (yerinde al)',
        "Grizzly ülkesi; uçakla taşınmaz, Banff/Canmore'da 40–50 CAD.",
        false,
      ),
      idp(),
      returnTicket(true),
      bankStatement(),
      hotelBooking(),
    ],
    etiquette: [
      '"Sorry" ve "thank you" kültürü; sıra ve kişisel alan.',
      'Québec\'te önce Fransızca "bonjour"; İngilizce sonra.',
      'İlk Uluslar (First Nations) topraklarına saygı; "land acknowledgement" yaygın.',
      'Trail görgüsü ve Leave No Trace; kamp alanında sessiz saat.',
      'Bahşiş ABD gibi %15–20.',
      'Hava durumu en sık sohbet konusu; hokey ikinci.',
    ],
    dressCode: 'Rahat; dağlarda yazın bile kar yağabilir; kışın -30 °C ekipmanı.',
    religionNotes: 'Laik çoğulcu; kiliseler açık; Sikh ve Müslüman cemaatler büyük şehirlerde.',
    photographyRules:
      'Serbest; yerli törenlerinde izin; askeri yasak. Drone milli parklarda yasak.',
    tipping: 'Lokanta %15–20, bar 1–2 CAD/içki, taksi %10–15, rehber günde 20–40 CAD.',
    bargaining: 'Yok.',
    watchOut: [
      'Ayılar (kara ve grizzly): grupla yürü, ses çıkar, sprey elde; kamp yiyecek dolapları zorunlu.',
      'Geyik/elk yol çarpışması ve kızgın elk (Eylül); mesafe 30 m.',
      'Mesafeler çok uzun; benzin ve sinyal boşlukları (Yukon, Kuzey BC).',
      'Kış sürüşü: kar lastiği zorunlu (BC 1 Ekim–30 Nisan), çığ kapanması (Rogers Pass).',
      'Sivrisinek ve kara sinek Haziran–Temmuz Kuzey ormanları.',
      'Şehir merkezlerinde (Vancouver DTES) uyuşturucu krizi görünür; tehlikeli değil ama çarpıcı.',
      'Soğuk su: göllerde hipotermi 15 dk.',
      "Sınırda cihaz araması mümkün; esrar taşıma yasak (Kanada'da yasal olsa da).",
    ],
    womenTravelers:
      'Çok güvenli; yalnız kadın backcountry kültürü güçlü. Otostop (Highway 16 "Tears Highway") tavsiye edilmez.',
    laws: [
      'Drone: Transport Canada kaydı ve pilot sertifikası (250 g üstü); tüm milli parklarda yasak.',
      'Alkol: 18/19 yaş (eyalete göre); devlet mağazaları (LCBO); kamuya açık alanda yasak (bazı parklar hariç).',
      "Uyuşturucu: esrar yasal (19+), sınır ötesi taşıma suç; BC'de küçük miktar sert uyuşturucu dekriminalize (pilot).",
      'LGBTİ+: evlilik yasal (2005), geniş koruma.',
      "Kamp: milli parklarda izinli alan; Crown land'de 14–21 gün serbest kamp; yaz ateş yasakları.",
      'Ayı spreyi yalnızca ayıya karşı; insana karşı silah sayılır.',
    ],
    droneRules: 'Parks Canada arazisinde yasak; dışında kayıt + Basic/Advanced sertifika.',
    alcoholRules: '19 yaş (Québec/Alberta 18); mağaza ve barlar; kamp alanında kendi yerinde.',
    money:
      'Kanada Doları — 1 CAD ≈ ₺33. Kart/tap her yerde; nakit az; satış vergisi %5–15 kasada eklenir.',
    connectivity:
      'Rogers/Bell/Telus prepaid pahalı (30 gün 20 GB ≈ 50 CAD); eSIM Airalo. Dağlarda ve kuzeyde sinyal yok; inReach.',
    health: [
      "Su: musluk içilebilir; trail'de filtre.",
      'Ayı ve hipotermi; irtifa Rockies 3.500 m.',
      'Kene (Lyme) Ontario/BC güneyinde.',
      'Sağlık masrafları yüksek; walk-in klinik.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A/B (isteğe bağlı)'],
    bestMonths: [6, 7, 8, 9],
    dailyTips: [
      "Parks Canada rezervasyonları Ocak'ta; Lake Louise/Moraine shuttle biletli.",
      'Kamp alanlarında yiyecek "bear locker"; arabada kokulu şey bırakma.',
      'Tim Hortons kahve/çorba bütçe dostu; benzin litre.',
      'Roam/Banff otobüsleri ücretsiz-ucuz; araç park sorunu.',
      'Kuzey ışıkları için Yellowknife Eylül–Mart.',
    ],
    sources: [
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html',
      'https://parks.canada.ca',
      MFA_URL,
      'https://ottava.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'MX',
    name: 'Meksika',
    region: 'Kuzey Amerika',
    languages: ['es'],
    currency: 'MXN',
    tryRate: 2.4,
    timezone: 'UTC-6 … UTC-8',
    plugTypes: ['A', 'B'],
    visa: {
      type: 'e_visa',
      maxStayDays: 180,
      costTry: 0,
      processingDays: 1,
      url: 'https://www.inm.gob.mx/sae/publico/en/solicitud.html',
      note: 'Türk vatandaşları için SAE (Sistema de Autorización Electrónica): ücretsiz, yalnızca uçakla giriş, 30 gün geçerli, tek giriş, 180 gün kalış. Geçerli ABD/Kanada/Schengen/İngiltere/Japonya vizesi olanlar SAE olmadan da girebilir. Kara sınırından girişte konsolosluk vizesi. Resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      visaDoc('SAE onayı (PDF) ya da geçerli ABD/Schengen vizesi.'),
      insurance('Pico de Orizaba (5.636 m), Copper Canyon; özel hastaneler pahalı.'),
      permit(
        'fmm',
        'FMM turist kartı (dijital)',
        'Havalimanında pasaport damgası; 180 gün; çıkışta istenmez ama fotoğrafla.',
        false,
      ),
      idp(),
      returnTicket(true),
      vaccineCard(),
    ],
    etiquette: [
      '"Buenos días/tardes" her karşılaşmada; yanak öpücüğü kadınlarla.',
      'Dakiklik gevşek; "ahorita" = belki hiç.',
      "Yemek kültürü kutsal; sokak taco'da salsa ölçülü.",
      'Ölüler Günü (1–2 Kasım) turistik değil ailevi; mezarlıklarda saygı.',
      'Yerli topluluklarda (Chiapas, Oaxaca) fotoğraf izinle; Zapatista bölgelerinde rehber.',
      'ABD ile kıyaslama ve "Amerika" kelimesini yalnızca ABD için kullanma.',
    ],
    dressCode: 'Şehir rahat; kiliselerde kapalı; Chiapas dağları soğuk, Yucatán nemli.',
    religionNotes:
      'Katolik (Guadalupe Meryemi çok önemli) + yerli senkretizm (San Juan Chamula kilisesi: fotoğraf kesinlikle yasak). Santa Muerte kültü şehirlerde.',
    photographyRules:
      'Chamula kilisesi ve yerli törenlerde yasak; askeri/polis yasak; müzelerde flaşsız. Drone arkeolojik alanlarda (INAH) yasak.',
    tipping:
      'Lokanta %10–15, bar 10–20 MXN, taşıyıcı 20–50 MXN, benzinci 10 MXN, rehber günde 200–400 MXN, dağ rehberi 500+ MXN.',
    bargaining:
      'Pazar (tianguis) ve el sanatlarında pazarlık; mağaza ve lokanta yok. Uber/DiDi büyük şehirlerde; havalimanı sabit taksi.',
    watchOut: [
      'Kartel şiddeti bölgesel: Sinaloa, Tamaulipas, Guerrero (Acapulco), Zacatecas, Michoacán kırsalına gitme; turistik bölgeler görece güvenli.',
      'Gece karayolu yolculuğu yapma; "cuota" (ücretli) otoyol daha güvenli.',
      'Taksi: yalnızca "sitio"/uygulama; sokak taksisi CDMX\'te "express kidnapping".',
      'Sahte polis para cezası (mordida); makbuz iste, karakola git.',
      'ATM skimming ve kartın kopyalanması; banka içi.',
      'Su ve gıda: ishal ("Montezuma\'nın intikamı"); buz genelde arıtılmış ama sokakta sor.',
      'Pico de Orizaba/Iztaccíhuatl irtifa ve buzul; rehber ve krampon.',
      "Sargazo (yosun) Karayip plajlarında yaz; cenote'lerde güneş kremi yasak.",
    ],
    womenTravelers:
      'Kadına yönelik şiddet oranı yüksek ama turistlere yansıması sınırlı; gece Uber, içeceğe dikkat, metroda kadın vagonu (CDMX). Oaxaca ve San Cristóbal yalnız kadın için rahat.',
    laws: [
      'Drone: AFAC kaydı; arkeolojik alanlar ve INAH sahalarında yasak; plajlarda yerel kısıt.',
      'Alkol: 18 yaş; sokakta içmek yasak (uygulanır); seçim günlerinde "ley seca".',
      'Uyuşturucu: küçük miktar dekriminalize ama polis ile pazarlık riski; kartel bölgelerinde alma.',
      'LGBTİ+: evlilik tüm eyaletlerde yasal (2022); CDMX çok açık.',
      'Kamp: milli parklarda (CONANP) izinli; plaj kampı belediyeye bağlı; ateş yasağı orman.',
      'Arkeolojik eser ve deniz kabuğu çıkarmak yasak.',
    ],
    droneRules: 'INAH sahaları ve milli parklar yasak; kayıt 250 g üstü.',
    alcoholRules: '18 yaş; mezcal/tekila kültürü; sokakta açık kap yasak.',
    money:
      'Peso (MXN) — 1 MXN ≈ ₺2,4. Kart yaygın; nakit pazar ve küçük yerler. ATM (BBVA, Banorte) gündüz banka içi. USD turistik yerlerde kabul ama kötü kur.',
    connectivity:
      "Telcel/AT&T SIM Oxxo'da pasaportsuz (Telcel Amigo); 30 gün 10 GB ≈ 200 MXN. Dağlarda Telcel. eSIM Airalo.",
    health: [
      'Su: şişe; sokak yemeği kalabalık tezgâh.',
      'Dang/zika kıyı ve Yucatán.',
      'İrtifa: CDMX 2.240 m, volkanlar 5.000 m+.',
      "Güneş ve nem Yucatán; cenote'lerde biyolojik krem.",
      'Kuduz yarasa/köpek nadir.',
    ],
    vaccines: ['Hepatit A', 'Tifo', 'Tetanos', 'Hepatit B', 'Kuduz (isteğe bağlı)'],
    bestMonths: [11, 12, 1, 2, 3, 4],
    dailyTips: [
      'SAE başvurusunu uçuştan en az 1 hafta önce yap; onay 30 gün geçerli.',
      'ADO otobüsleri güvenli ve konforlu; gece yolculuğunda ana rotalar.',
      'CDMX metro 5 MXN; yoğun saatte kadın vagonu.',
      'Taco al pastor ve tamales sabah; "comida corrida" öğle menü 80–120 MXN.',
      "Chichén Itzá/Teotihuacán'a sabah 8'de gir, öğlen kalabalık ve sıcak.",
    ],
    sources: [
      'https://www.inm.gob.mx/sae/publico/en/solicitud.html',
      MFA_URL,
      'https://meksiko.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'JP',
    name: 'Japonya',
    region: 'Doğu Asya',
    languages: ['ja'],
    currency: 'JPY',
    tryRate: 0.3,
    timezone: 'UTC+9',
    plugTypes: ['A', 'B'],
    visa: {
      type: 'visa_free',
      maxStayDays: 90,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html',
      note: 'Türk vatandaşları 90 gün vizesiz (umuma mahsus pasaport). "Visit Japan Web" ile gümrük/göçmenlik QR kodunu önceden doldur. 2028\'de JESTA elektronik izin planlanıyor — resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6, 'Kalış süresince geçerli olmak yeterli; boş sayfa şart.'),
      insurance(
        "Japon Alpleri, Fuji ve kayak; kurtarma (polis) ücretsiz ama helikopter özel ise 500.000 ¥+; Nagano/Saitama'da kurtarma ücreti var.",
      ),
      permit(
        'fuji',
        'Fuji tırmanış rezervasyonu + ücret',
        "2024'ten beri Yoshida rotası günlük 4.000 kişi, 4.000 ¥ ücret ve çevrimiçi rezervasyon; Shizuoka rotaları da benzer. Sezon 1 Temmuz–10 Eylül; dışında yasak.",
        false,
      ),
      permit(
        'jr_pass',
        'JR Pass (isteğe bağlı)',
        'Fiyat artışından beri her zaman kârlı değil; rotana göre hesapla.',
        false,
      ),
      idp(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      'Eğilerek selam; tokalaşma nadir; ayakkabı ev, ryokan, tapınak ve bazı lokantalarda çıkar (terlik sistemi).',
      'Onsen: dövme çoğu tesiste yasak (kapatma bandı ya da "tattoo friendly" onsen); girmeden tamamen yıkan, havluyu suya sokma.',
      'Trende telefonla konuşma, yemek yeme (Shinkansen hariç); sessizlik.',
      'Yemek çubuklarını pirinçe dik saplama, çubuktan çubuğa yemek verme (cenaze ritüeli).',
      'Kuyruk kültürü mutlak; yürürken yeme/içme yok; çöp kutusu az, çöpünü taşı.',
      "Tapınak: torii'den ortadan geçme, el yıkama (temizuya), Şinto'da iki eğil-iki alkış-bir eğil; Budist tapınakta alkış yok.",
      'Bahşiş yok; para tepsiye konur; iki elle kartvizit.',
      'Yüksek sesle konuşma ve burun sümkürmek ayıp; maske hasta olunca.',
    ],
    dressCode:
      'Şehir temiz ve düzenli; tapınaklarda sade. Dağ kulübelerinde (yamagoya) iç kıyafet. Onsen çıplak (cinsiyete göre ayrı).',
    religionNotes:
      'Şinto + Budizm iç içe; tapınak (jinja) ve tapınak (tera) görgüsü farklı. Fuji kutsal dağ; Yoshida rotasında tapınaklar. Cenaze ve anma ritüellerine saygı.',
    photographyRules:
      "Gion geyşa fotoğrafı için özel sokaklar 2024'te yasaklandı (ceza 10.000 ¥); tapınak içi ve bazı bahçelerde yasak; insanları izinsiz çekme. Drone şehirlerde ve milli parklarda çoğunlukla yasak.",
    tipping:
      'Yok; ısrar hakaret sayılabilir. Ryokan\'da "kokorozuke" zarfla nadir. Dağ rehberine hediye/teşekkür kartı.',
    bargaining: 'Yok; elektronik mağazalarda vergisiz alışveriş (pasaportla).',
    watchOut: [
      'Suç oranı çok düşük; en büyük risk unutulan eşya (koban/polis kulübesine gider).',
      'Kabukicho/Roppongi "bar tuzağı": Nijeryalı/Japon çığırtkanların davet ettiği barlarda fahiş hesap ve ilaçlı içki; davetleri reddet.',
      'Fuji: sezon dışı tırmanış ölümleri; "bullet climbing" (gece tek seferde) yasak; hipotermi Temmuz\'da bile.',
      'Ayı (Hokkaido kahverengi, Honshu kara ayı) saldırıları arttı; çan tak, gruplarla yürü.',
      'Deprem/tayfun: Japan Safe Travel uyarılarını takip et; tsunami işaretleri.',
      'Yaz sıcak ve nem (Tokyo 38 °C, ısı çarpması).',
      'Trende gündüz yankesicilik yok ama "chikan" (taciz) yoğun saatte; kadın vagonu.',
      'Nakit hâlâ önemli: kırsal, ramen dükkânı, tapınak; 7-Eleven ATM yabancı kart alır.',
    ],
    womenTravelers:
      'Dünyanın en güvenli ülkelerinden; gece yürüyüş rahat. Yoğun trende taciz için kadın vagonu ("josei senyo sha"). Kapsül otel ve onsen kadın katları.',
    laws: [
      "Drone: 100 g üstü kayıt (DIPS), 150 m üstü ve yerleşim (DID) alanlarında izin; milli parklar ve tapınaklarda yasak; Fuji'de yasak.",
      "Alkol: 20 yaş; sokakta içmek yasal (hanami) ama Shibuya'da kısıtlı; sürüşte sıfır (bisiklet dahil).",
      'Uyuşturucu: esrar dahil sıfır tolerans, hapis ve sınır dışı; bazı soğuk algınlığı ilaçları (psödoefedrin) yasak — resmî kaynağı kontrol et.',
      'LGBTİ+: yasal, evlilik ulusal düzeyde tanınmıyor (bazı belediyelerde partnerlik); Shinjuku Ni-chome açık.',
      'Kamp: milli parklarda belirlenmiş alan; vahşi kamp yasal gri, dağ kulübesi (yamagoya) sistemi; ateş yasak.',
      'Pasaportu her zaman taşı (kanunen zorunlu).',
    ],
    droneRules:
      'DIPS kaydı ve sıkı DID kuralları; Fuji, Kyoto tarihi alanlar, Kamikochi yasak. Turist için pratikte kısıtlı.',
    alcoholRules: '20 yaş; konbini 24 saat; izakaya kültürü; sarhoş ama sessiz.',
    money:
      "Yen (JPY) — 1 JPY ≈ ₺0,30. Kart şehirde yaygın, IC kart (Suica/Pasmo — iPhone'a yüklenir) ulaşım ve konbini. 7-Eleven/Japan Post ATM. Nakit kırsalda şart.",
    connectivity:
      'eSIM (Ubigi, Airalo) en pratik; havalimanı SIM 30 gün 20 GB ≈ 4.000 ¥. Dağlarda docomo en iyi; Fuji rotasında sinyal var. Wi-Fi konbini/istasyon.',
    health: [
      'Musluk suyu içilebilir.',
      'Yaz ısı çarpması; kış Hokkaido -20 °C.',
      'Japon ensefaliti kırsalda çok nadir.',
      'Fuji irtifa 3.776 m; 5. istasyondan bir gece dağ kulübesi.',
      'Polen alerjisi Mart–Nisan (sugi).',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Japon ensefaliti (uzun kırsal, isteğe bağlı)'],
    bestMonths: [3, 4, 5, 10, 11, 7, 8],
    dailyTips: [
      'Visit Japan Web QR kodunu uçuştan önce hazırla; göçmenlik hızlı.',
      'Konbini (7-Eleven, Lawson) her ihtiyaç: yemek, ATM, tuvalet, bagaj gönderimi (takkyubin).',
      'Suica ile tren-otobüs-market; Shinkansen bileti ayrı.',
      'Fuji için Kawaguchiko\'dan sabah otobüsü; kulübe rezervasyonu şart, "mochi" ve baş lambası.',
      'Tapınak "goshuin" mühür defteri 300–500 ¥; anı olarak topla.',
    ],
    sources: [
      'https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html',
      'https://www.fujisan-climb.jp',
      MFA_URL,
      'https://tokyo.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'KR',
    name: 'Güney Kore',
    region: 'Doğu Asya',
    languages: ['ko'],
    currency: 'KRW',
    tryRate: 0.033,
    timezone: 'UTC+9',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'e_visa',
      maxStayDays: 90,
      costTry: 350,
      processingDays: 3,
      url: 'https://www.k-eta.go.kr',
      note: 'Türk vatandaşları 90 gün vizesiz ama K-ETA (elektronik seyahat izni, ≈10.000 ₩, 3 yıl geçerli) uçuştan en az 72 saat önce alınmalı. K-ETA geçici muafiyet listeleri değişiyor — resmî kaynağı kontrol et. Jeju için K-ETA gerekmez.',
    },
    documents: [
      passport(6),
      visaDoc("K-ETA onayı (e-posta); havayolu check-in'de kontrol edilir."),
      insurance("Seoraksan, Hallasan; Kore'de kurtarma (119) ücretsiz, hastane pahalı."),
      permit(
        'park_reservation',
        'Milli park kulübe/rezervasyon (Jirisan, Seoraksan)',
        'reservation.knps.or.kr; Hallasan günlük kota QR rezervasyonu (visithalla.jeju.go.kr).',
        false,
      ),
      idp(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      'Hafif eğilme ve iki elle verme/alma (para, kartvizit, içki).',
      'Yaşça büyükle içerken kadehi yana çevirerek iç; içkiyi kendine koyma, karşılıklı doldur.',
      'Ayakkabı evde, bazı lokanta ve tapınakta çıkar.',
      'Metroda yaşlı koltuğuna oturma (boşken bile); yüksek sesle konuşma.',
      'Tapınakta (Budist) şortsuz, sessiz; Templestay programı uygun.',
      'Kore dağcılık kültürü: tam ekipman ve renkli giyim norm; "annyeonghaseyo" yolda herkese.',
      'Kuzey Kore ve Japonya konuları hassas.',
    ],
    dressCode:
      'Seul modaya düşkün; dekolte yerine mini etek normal, omuz kapalı tercih. Dağda Kore tarzı tam donanım.',
    religionNotes:
      'Budist ve Hristiyan (Protestan güçlü), Şamanizm izleri. Tapınaklarda fotoğraf sınırlı; Templestay ile geceleme.',
    photographyRules:
      'Askeri alan, DMZ belirli noktalar, havalimanı yasak; insanları izinsiz çekme (gizli kamera yasaları sert, telefon deklanşör sesi kapatılamaz).',
    tipping: 'Yok.',
    bargaining: 'Namdaemun/Dongdaemun pazarında hafif; mağaza ve lokanta yok.',
    watchOut: [
      'Çok güvenli; en büyük risk taksicinin uzun yol yapması (Kakao T uygulaması).',
      "Seoraksan/Jirisan'da sonbahar kalabalığı ve buz; krampon zorunlu (Ocak–Mart).",
      'Hallasan günlük kota; rezervasyonsuz giriş yok, son giriş saati katı.',
      'Yaz muson ve tayfun (Temmuz–Eylül) sel; dağ yolları kapanır.',
      'Sarı toz (Mart–Mayıs) ve ince toz; maske.',
      'İçki kültürü ("soju bombası") aşırıya kaçabilir; nazikçe yavaşla.',
      'Kuzey Kore sınırı DMZ turu yalnızca resmî tur.',
      'Gece Itaewon/Hongdae kalabalığı (2022 izdihamı); dar sokaklardan kaçın.',
    ],
    womenTravelers:
      'Çok güvenli; gece yürüyüş sorunsuz. Gizli kamera ("molka") endişesi için tuvaletlerde kontrol; kadın hostel katları.',
    laws: [
      'Drone: 250 g üstü kayıt; Seul merkez (P-73 yasak bölge), DMZ, havalimanları yasak; milli parklarda izin.',
      'Alkol: 19 yaş; sokakta içmek yasal (park); sürüşte 0,03%.',
      'Uyuşturucu: esrar dahil sıfır tolerans; yurt dışında kullanım bile Kore vatandaşları için suç.',
      'LGBTİ+: yasal, evlilik yok; askerde suç; Itaewon açık, toplumsal muhafazakârlık.',
      'Kamp: milli parklarda yalnızca belirlenmiş alan; vahşi kamp yasak (para cezası), ateş ve ocak yasak.',
      'Pasaport taşıma; sigara kamuya açık alanda yasak (ceza).',
    ],
    droneRules: 'Seul geniş yasak bölge; Jeju kısmen; milli parklarda KNPS izni.',
    alcoholRules: '19 yaş; convenience store; soju 2.000 ₩; sokakta ve parkta içmek yasal.',
    money:
      'Won (KRW) — 1 KRW ≈ ₺0,033. Kart her yerde; T-money kart ulaşım; nakit pazar. ATM "Global" işaretli.',
    connectivity:
      'SK/KT/LG U+ turist SIM havalimanı (30 gün sınırsız ≈ 60.000 ₩); eSIM. Dağlarda bile sinyal; ücretsiz Wi-Fi yaygın. Naver Map/Kakao Map (Google zayıf).',
    health: [
      'Musluk suyu içilebilir.',
      'Sarı toz/ince toz.',
      'Yaz nem ve sıcak; kış -15 °C.',
      'Kene (SFTS) Mayıs–Ekim otlaklarda.',
    ],
    vaccines: [
      'Rutin aşılar',
      'Tetanos',
      'Hepatit A',
      'Japon ensefaliti (uzun kırsal, isteğe bağlı)',
    ],
    bestMonths: [4, 5, 9, 10, 11],
    dailyTips: [
      "K-ETA'yı yalnızca k-eta.go.kr'den al; aracı siteler 3 kat.",
      'Naver Map ve Papago çeviri; Kakao T taksi.',
      'Kimbap ve convenience store yemeği 3.000–5.000 ₩.',
      "Seoraksan Ulsanbawi sabah 6'da; sonbahar hafta sonu kalabalık.",
      'Jjimjilbang (spa) 15.000 ₩ ile gece konaklama.',
    ],
    sources: [
      'https://www.k-eta.go.kr',
      'https://english.knps.or.kr',
      MFA_URL,
      'https://seul.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'TH',
    name: 'Tayland',
    region: 'Güneydoğu Asya',
    languages: ['th', 'en'],
    currency: 'THB',
    tryRate: 1.35,
    timezone: 'UTC+7',
    plugTypes: ['A', 'B', 'C', 'O'],
    visa: {
      type: 'visa_free',
      maxStayDays: 60,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.thaievisa.go.th',
      note: "Türk vatandaşları 2024'ten beri 60 gün vizesiz (30 gün uzatma 1.900 ฿). 2025'te dijital varış kartı (TDAC) uçuştan 72 saat önce çevrimiçi doldurulur. Vizesiz süre 30 güne düşürülmesi tartışılıyor — resmî kaynağı kontrol et.",
    },
    documents: [
      passport(6),
      permit(
        'tdac',
        'Tayland Dijital Varış Kartı (TDAC)',
        'tdac.immigration.go.th; uçuştan 3 gün önce.',
        true,
      ),
      insurance(
        'Motosiklet kazaları en büyük risk; motosiklet kapsamı (ehliyetli) ve dalış (DAN).',
      ),
      idp(),
      returnTicket(true),
      cashUsd('Göçmenlik 20.000 ฿ karşılığı nakit isteyebilir (nadir).'),
      vaccineCard(),
    ],
    etiquette: [
      '"Wai" (avuçlar birleşik) selam; büyüklere ve rahiplere; hizmet edene wai yapılmaz.',
      'Kraliyet ailesine saygı yasal zorunluluk (lèse-majesté); paraya (kralın resmi) basma, sinemada marş için ayağa kalk.',
      'Baş kutsal, ayak kirli: kimsenin başına dokunma, ayakla işaret etme.',
      'Tapınakta omuz-diz kapalı, ayakkabısız; kadınlar rahiplere dokunmaz, eşya rahibe erkek eliyle verilir.',
      'Sinirlenmek yüz kaybettirir ("jai yen" — soğuk kalp); gülümse.',
      'Buda heykeliyle selfie ve dövme saygısızlık; Buda ihracatı yasak.',
      'Ayakkabı evlerde ve bazı dükkânlarda çıkar.',
    ],
    dressCode:
      'Tapınaklar kapalı giyim (Grand Palace katı); şehir rahat; plaj kıyafeti yalnızca plajda. Kuzey dağları kışın soğuk.',
    religionNotes:
      'Theravada Budizm; sabah rahip sadaka turu (tak bat) — katılabilirsin. Güney (Yala, Pattani) Müslüman ve güvenlik sorunlu. Buda görselleri kutsal.',
    photographyRules:
      'Tapınak içi genelde serbest, Buda önünde poz vermek ayıp; askeri ve kraliyet alanları yasak. Drone kayıt olmadan 5 yıl hapis riski.',
    tipping: 'Beklenmez; lokanta yuvarla, masaj 50–100 ฿, taşıyıcı 20 ฿, rehber günde 300–500 ฿.',
    bargaining:
      'Pazar ve tuk-tuk için; nazik ve gülümseyerek. Grab uygulaması taksi/tuk-tuk pazarlığını bitirir; taksimetre iste ("meter").',
    watchOut: [
      '"Grand Palace bugün kapalı" tuk-tuk hilesi ve mücevher dolandırıcılığı; kendin git.',
      'Jet-ski/motosiklet kiralama "hasar" şantajı: fotoğraf çek, pasaportu rehin bırakma.',
      'Motosiklet kazaları: kask, ehliyet (IDP), sigorta; Pai yolu 762 viraj.',
      'Full Moon Party: ilaçlı içki, cam kırığı, boğulma; ayakkabı ve arkadaş.',
      'Tayland içeceği "yaba/esrar" gri: esrar 2022\'de serbest bırakıldı, 2025\'te yeniden tıbbi kısıt — resmî kaynağı kontrol et.',
      "Sokak köpekleri her yerde (aşılı olmayabilir); maymunlar Lopburi/Krabi'de hırsız.",
      'Deniz: kırmızı bayrak, kutu denizanası (Koh Samui), akıntı; yağmur mevsimi.',
      'Sahte polis "uyuşturucu araması"; kimlik iste, turist polisi 1155.',
    ],
    womenTravelers:
      'Genel olarak güvenli; parti adalarında dikkat. Yalnız kadın için Chiang Mai ve kuzey trek çok uygun. Gece plaj yürüyüşü yapma.',
    laws: [
      'Drone: CAAT + NBTC kaydı zorunlu (turist için de), milli parklarda yasak; kayıtsız uçuş hapis.',
      'Alkol: 20 yaş; satış saatleri 11–14 ve 17–24; Budist bayramlarında satış yok; tapınak ve parklarda yasak.',
      'Uyuşturucu: esrar yasal statüsü değişken; diğerleri ölüm cezası dahil ağır.',
      "LGBTİ+: evlilik eşitliği 2025'te yürürlüğe girdi; çok açık toplum.",
      'Kamp: milli parklarda belirlenmiş alan ve ücret; plaj kampı yasak; ateş yasak.',
      'E-sigara yasak (hapis/para cezası); Buda görseli/dövmesiyle giriş sorunu.',
      'Kraliyet hakareti 15 yıla kadar hapis; sosyal medyada dahil.',
    ],
    droneRules: 'İki ayrı kayıt (CAAT ve NBTC) + sigorta; milli parklar ve Bangkok merkez yasak.',
    alcoholRules: "20 yaş; satış saat kısıtlı; 7-Eleven; Ramazan Güney'de.",
    money:
      'Baht (THB) — 1 THB ≈ ₺1,35. ATM her yerde ama 220 ฿ işlem ücreti; kart otel/AVM; nakit pazar ve adalar. Döviz bürosu (SuperRich) iyi kur.',
    connectivity:
      'AIS/TrueMove/dtac turist SIM havalimanı (15 gün sınırsız ≈ 300 ฿); eSIM. Dağ ve adalarda AIS. Grab, Line uygulamaları.',
    health: [
      'Dang yıl boyu (DEET, uzun kol).',
      'Sıtma yalnızca sınır ormanları (Myanmar).',
      'Su: şişe; buz genelde fabrika.',
      'Isı ve nem; Chiang Mai yakma sezonu (Şubat–Nisan) hava kirliliği.',
      'Kuduz köpek ve maymun.',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz (isteğe bağlı)',
      'Japon ensefaliti (uzun kırsal)',
    ],
    bestMonths: [11, 12, 1, 2],
    dailyTips: [
      "TDAC'ı uçuştan önce doldur; ekran görüntüsü.",
      "Grab ile ulaşım; BTS/MRT Bangkok'ta.",
      'Sokak yemeği pad thai 60 ฿; 7-Eleven "toastie".',
      'Doi Inthanon (2.565 m) ve Chiang Mai trek için Kasım–Şubat.',
      'Tapınaklarda girişte sarong kiralama; Grand Palace 500 ฿.',
    ],
    sources: [
      'https://www.thaievisa.go.th',
      'https://tdac.immigration.go.th',
      MFA_URL,
      'https://bangkok.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'ID',
    name: 'Endonezya',
    region: 'Güneydoğu Asya',
    languages: ['id', 'en'],
    currency: 'IDR',
    tryRate: 0.0028,
    timezone: 'UTC+7 … UTC+9',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'on_arrival',
      maxStayDays: 30,
      costTry: 1400,
      processingDays: 0,
      url: 'https://molina.imigrasi.go.id',
      note: 'Varışta vize (VoA) 500.000 IDR, 30 gün + 30 gün uzatma; e-VoA (molina.imigrasi.go.id) önceden alınabilir. Bali için ayrıca 150.000 IDR turist vergisi (lovebali.baliprov.go.id) ve "All Indonesia" gümrük/sağlık beyanı çevrimiçi.',
    },
    documents: [
      passport(6),
      visaDoc('e-VoA QR ya da varışta ödeme (kart/nakit).', false),
      permit(
        'bali_levy',
        'Bali turist vergisi (150.000 IDR)',
        'Love Bali uygulaması; QR kontrolü.',
        false,
      ),
      insurance("Rinjani (3.726 m), Semeru, dalış; Lombok'ta helikopter yok, taşıma porterla."),
      permit(
        'rinjani',
        'Rinjani Milli Parkı izni + rehber',
        'eRinjani uygulaması ile kota ve ücret (150.000 IDR/gün); lisanslı rehber/porter zorunlu. Volkanik aktivite kapanmaları.',
        false,
      ),
      idp(),
      returnTicket(true),
      vaccineCard(),
    ],
    etiquette: [
      '"Selamat pagi" ve gülümseme; sağ el; ayakkabı evde çıkar.',
      'Bali: sokakta "canang" (çiçek sunu) üzerine basma; tapınakta sarong ve kuşak (girişte verilir).',
      'Regl dönemindeki kadınlar Bali tapınaklarına girmemeli (yerel inanç).',
      'Nyepi (Sessizlik Günü, Mart) — tüm ada kapanır, otelden çıkılmaz, havalimanı kapalı.',
      'Cava ve Lombok Müslüman; Ramazan ve cuma namazı saygısı; kapalı giyim.',
      'Sinirlenmek ve yüksek ses ayıp; "tidak apa apa" (sorun değil) kültürü.',
      'Yaşlıya "Bapak/Ibu" hitabı; başa dokunma.',
    ],
    dressCode:
      'Bali plajı rahat; tapınaklarda sarong; Cava/Lombok/Sumatra muhafazakâr (omuz-diz). Rinjani gece 0 °C.',
    religionNotes:
      "Cava/Sumatra Müslüman, Bali Hindu, Flores/Papua Hristiyan. Bali tapınaklarında törenlerde turist arka planda; Nyepi ve Galungan ritüelleri. Ramazan Cava'da ciddi.",
    photographyRules:
      "Tapınak törenlerinde rahipten yukarıda durma ve flaş yok; insanlara izin. Drone Rinjani ve Bromo'da izinli, Bali tapınaklarında yasak.",
    tipping:
      'Beklenmez; lokanta %5–10 (servis eklenmemişse), şoför günde 100.000 IDR, Rinjani porter/rehber 100.000–200.000 IDR, masaj 20.000 IDR.',
    bargaining:
      'Pazar ve sanat mağazalarında sert pazarlık (üçte bir); Gojek/Grab motor taksi ve araç için sabit.',
    watchOut: [
      "Motosiklet: Bali'de en büyük ölüm nedeni; kask, IDP (polis kontrolü ceza), sigorta.",
      'Metanol zehirlenmesi: ucuz "arak" kokteyli ölümcül; kapalı şişe ve güvenilir bar.',
      'Kapkaç ve motorlu telefon hırsızlığı Canggu/Kuta; ATM skimming.',
      'Sahte para değişim büroları (Kuta): sayarken el çabukluğu; yetkili büro.',
      'Rinjani: volkanik uyarı seviyesi, hipotermi zirve gecesi, kaya düşmesi kraterde; 2025 kazasından sonra kurallar sıkılaştı.',
      'Deniz: akıntı (rip) Bali batı, denizanası; bayrak.',
      "Sokak köpekleri Bali'de kuduz endemik; maymunlar (Ubud, Uluwatu) gözlük/telefon çalar.",
      'Uyuşturucu satıcısı = polis tuzağı; ölüm cezası.',
    ],
    womenTravelers:
      "Bali yalnız kadın için çok popüler; gece motor dönüşlerinde dikkat. Lombok/Cava muhafazakâr giyim taciz azaltır. Rinjani'de kadın porter yok, grup önerilir.",
    laws: [
      'Drone: 250 g üstü kayıt; tapınak, havalimanı ve yerleşim üstü yasak; Bromo/Rinjani park izni.',
      "Alkol: 21 yaş; Bali serbest, Aceh'te tamamen yasak (şeriat); sokakta içmek yadırganır.",
      'Uyuşturucu: ölüm cezası; küçük miktar bile uzun hapis.',
      'LGBTİ+: ulusal düzeyde suç değil (Aceh hariç), 2025 ceza yasası evlilik dışı ilişkiyi şikâyete bağlı suç saydı; alenilikten kaçın.',
      'Kamp: milli parklarda izinli; plaj ve pirinç tarlalarında sahibinden izin.',
      'Evlilik dışı birlikte kalma yeni ceza yasasında şikâyete bağlı suç (turistlere uygulanmayacağı açıklandı) — resmî kaynağı kontrol et.',
    ],
    droneRules: "Tapınaklar ve turistik alanlar yasak; Bromo'da izin; havalimanı 15 km.",
    alcoholRules: "21 yaş; Bintang her yerde; Aceh'te yasak; ithal alkol pahalı.",
    money:
      'Rupiah (IDR) — 1 IDR ≈ ₺0,0028; 100.000 IDR ≈ ₺280. ATM yaygın (BCA, Mandiri); kart turistik yerlerde; nakit kırsal. Sıfırları karıştırma.',
    connectivity:
      "Telkomsel SIM en geniş kapsama (havalimanı 100.000 IDR 20 GB); IMEI kaydı 90 gün üstü için. Rinjani'de zirvede sinyal. eSIM Airalo.",
    health: [
      'Dang yıl boyu; "Bali belly" ishal (şişe su, buzsuz).',
      'Sıtma Papua/Lombok kırsalında.',
      "Kuduz Bali'de gerçek risk.",
      'Metanol zehirlenmesi.',
      'Volkan külü ve irtifa (Rinjani, Semeru).',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz (önerilir)',
      'Japon ensefaliti (uzun)',
    ],
    bestMonths: [4, 5, 6, 7, 8, 9],
    dailyTips: [
      'e-VoA ve Bali vergisini önceden öde; kuyruk 1 saat kısalır.',
      'Gojek/Grab ile motor taksi 20.000 IDR; kask verilir.',
      'Warung (yerel lokanta) nasi campur 25.000 IDR.',
      'Rinjani için Senaru/Sembalun; 3 gün 2 gece paket, kendi uyku tulumu.',
      'Nyepi tarihini kontrol et; o gün her şey kapalı.',
    ],
    sources: [
      'https://molina.imigrasi.go.id',
      'https://lovebali.baliprov.go.id',
      MFA_URL,
      'https://cakarta.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'VN',
    name: 'Vietnam',
    region: 'Güneydoğu Asya',
    languages: ['vi', 'en'],
    currency: 'VND',
    tryRate: 0.0018,
    timezone: 'UTC+7',
    plugTypes: ['A', 'C', 'F'],
    visa: {
      type: 'e_visa',
      maxStayDays: 90,
      costTry: 1150,
      processingDays: 5,
      url: 'https://evisa.gov.vn',
      note: 'e-Visa 25 $ (tek giriş) / 50 $ (çok giriş), 90 gün; yalnızca evisa.gov.vn (aracı siteler 3 kat). Giriş noktasını doğru seç, değiştirilemez. Onay 3–5 iş günü, Tết döneminde uzar.',
    },
    documents: [
      passport(6),
      visaDoc('e-Visa PDF çıktısı; giriş kapısı ve isim pasaportla birebir.'),
      insurance('Motosiklet kazası (Ha Giang döngüsü) en büyük risk; Fansipan.'),
      idp(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Xin chào" ve hafif eğilme; iki elle verme; yaşlıya öncelik.',
      'Ayakkabı evde çıkar; masada yaşlı başlamadan yeme.',
      'Ho Chi Minh (Bác Hồ) kutsal figür; şaka yapma.',
      'Savaş konusu ("Amerikan Savaşı") dikkatli; müzeler bakış açısını gösterir.',
      'Yüksek ses ve yüz kaybı ayıp; gülümseyerek anlaş.',
      'Kaldırım motosiklet parkı; yolda düz hızda yürü, motorlar etrafından dolanır.',
      "Pagoda'da sessiz, kapalı giyim.",
    ],
    dressCode:
      "Şehir rahat; pagoda ve Hồ Chí Minh Anıtmezarı'nda diz-omuz kapalı. Sapa ve Ha Giang kışın soğuk ve sisli.",
    religionNotes:
      'Budist + ata kültü + Katolik azınlık; Cao Đài (Tây Ninh) ilginç. Tết (Ay Yeni Yılı) her şeyi kapatır, ulaşım dolar.',
    photographyRules:
      'Askeri, sınır (Çin/Laos) ve hükümet binaları yasak; azınlık köylerinde (Hmong) izin; anıtmezarda yasak. Drone çoğu yerde izinli ve pratikte zor.',
    tipping:
      'Beklenmez; lokanta yuvarla, rehber günde 200.000 VND, easy rider şoför 100.000 VND, masaj 50.000 VND.',
    bargaining:
      'Pazar ve sokak satışında pazarlık (yarı fiyat); Grab ile ulaşım; sabit fiyat "giá cố định".',
    watchOut: [
      'Motosiklet: Ha Giang döngüsünde kazalar; "easy rider" ile git, IDP ve sigorta.',
      "Hanoi Old Quarter'da motorlu kapkaç, taksi sayacı hızlı (Mai Linh/Vinasun ya da Grab).",
      'Ayakkabı boyacısı, "hindistan cevizi omuz sepeti" fotoğraf tuzağı; para ister.',
      'Sahte "Sinh Tourist" acenteleri; adres kontrol.',
      'Ha Long Bay ucuz tekne turlarında güvenlik ve fahiş içki fiyatı.',
      'Sokak köpekleri ve kuduz; köpek eti lokantalarını yargılama.',
      'Trafik: karşıdan karşıya sabit adımlarla; gece otobüsleri sürücü uykusuz.',
      'Sel ve tayfun (Eylül–Kasım orta Vietnam).',
    ],
    womenTravelers:
      "Güvenli; gece Grab. Sapa'da Hmong kadın satıcıları ısrarcı ama zararsız. Yalnız kadın gezgin ağı güçlü.",
    laws: [
      'Drone: Savunma Bakanlığı izni gerekli (turist için pratikte imkânsız); izinsiz uçuşta el koyma.',
      'Alkol: 18 yaş; sürüşte sıfır tolerans (2020), bisiklet dahil.',
      'Uyuşturucu: ölüm cezası dahil ağır.',
      'LGBTİ+: yasal, evlilik tanınmıyor; Saigon/Hanoi açık, toplumsal kabul artıyor.',
      'Kamp: milli parklarda izinli; Ha Giang azınlık köylerinde homestay tercih.',
      'Politik ifade ve protesto yasak; hükümet eleştirisi sosyal medyada bile risk.',
    ],
    droneRules: 'İzin süreci 1–2 ay ve nadiren verilir; getirme.',
    alcoholRules: '18 yaş; bia hơi (fıçı bira) 10.000 VND sokakta; sürüşte sıfır.',
    money:
      'Đồng (VND) — 1 VND ≈ ₺0,0018; 100.000 VND ≈ ₺180. ATM yaygın (2–3 milyon limit, ücret); kart şehirde; nakit kırsal. Sıfırları karıştırma (20.000 vs 200.000 benzer).',
    connectivity:
      "Viettel en geniş kapsama (30 gün 5 GB/gün ≈ 200.000 VND); havalimanı standı. Ha Giang ve Sapa'da Viettel. eSIM Airalo.",
    health: [
      'Dang yıl boyu; sıtma yalnızca orta yaylalar ve sınır.',
      'Su: şişe; sokak yemeği genelde güvenli (kaynar).',
      'Isı ve nem; kuzey kışın soğuk.',
      'Kuduz; hava kirliliği Hanoi.',
    ],
    vaccines: [
      'Hepatit A',
      'Tifo',
      'Tetanos',
      'Hepatit B',
      'Kuduz (isteğe bağlı)',
      'Japon ensefaliti (kırsal)',
    ],
    bestMonths: [10, 11, 12, 3, 4],
    dailyTips: [
      'e-Vizeyi 2 hafta önce al; giriş kapısı doğru.',
      'Grab ile motor ("GrabBike") 20.000 VND.',
      'Phở sabah 40.000 VND; bánh mì 20.000 VND.',
      "Ha Giang için Hanoi'den gece otobüsü + easy rider 3–4 gün.",
      'Tren (Reunification Express) Hanoi–Da Nang manzaralı.',
    ],
    sources: ['https://evisa.gov.vn', MFA_URL, 'https://hanoi.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'AU',
    name: 'Avustralya',
    region: 'Okyanusya',
    languages: ['en'],
    currency: 'AUD',
    tryRate: 30,
    timezone: 'UTC+8 … UTC+11',
    plugTypes: ['I'],
    visa: {
      type: 'embassy',
      maxStayDays: 90,
      costTry: 5900,
      processingDays: 30,
      url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600',
      note: "Türk vatandaşları eVisitor/ETA'ya uygun değil; Visitor visa (subclass 600) ImmiAccount üzerinden çevrimiçi başvuru, ≈ 200 AUD, biyometri VFS'te. İşlem 2–6 hafta; 3–12 ay çok giriş. Biyogüvenlik beyanı katı (yiyecek, çadır, bot).",
    },
    documents: [
      passport(6),
      visaDoc('Vize onayı e-posta (etiket yok); VEVO ile kontrol.'),
      insurance('Uzak bölge tahliyesi (Royal Flying Doctor) ve sağlık; Tazmanya Overland Track.'),
      permit(
        'overland',
        'Overland Track / Larapinta permi',
        'Tazmanya Parks: Ekim–Mayıs rezervasyonlu (≈ 250 AUD); park pass ayrıca.',
        false,
      ),
      permit(
        'biosecurity',
        'Temiz çadır, bot ve ekipman',
        'Toprak/tohum kalıntısı beyan edilmeli; kirli ekipman temizlenir/imha edilir, para cezası.',
        true,
      ),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Rahat ve dolaysız; "mate", "no worries"; unvan az.',
      'Aborjin kültürüne saygı: "Welcome to Country", kutsal alanlara (Uluru tırmanışı yasak) uyum.',
      'Sıra ("queue") ciddi; sürüşte yol vermek teşekkür beklenir.',
      'Barbekü ("barbie") daveti: kendi içkini getir (BYO).',
      'Bahşiş beklenmez ama yuvarlanır.',
      'Güneşten korunma sosyal norm ("slip slop slap").',
    ],
    dressCode: 'Çok rahat; şort ve terlik şehirde bile; iç kesimde gece soğuk. Uzun kol UV için.',
    religionNotes:
      'Laik; Aborjin manevi coğrafyası (Uluru, Kata Tjuta) fotoğraf yasak alanlar; ziyaretçiler bilgilendirilir.',
    photographyRules:
      'Serbest; Uluru bazı bölümleri yasak (işaretli); Aborjin insanlarını izinsiz çekme. Drone milli parklarda çoğunlukla yasak.',
    tipping: 'Beklenmez; iyi hizmet %5–10; taksi yuvarla.',
    bargaining: 'Yok.',
    watchOut: [
      "Güneş: UV dünyanın en yüksekleri; 15 dk'da yanık; şapka, krem, uzun kol.",
      'Deniz: kutu denizanası (Kuzey, Kasım–Mayıs), köpekbalığı, akıntı — yalnızca bayraklar arasında yüz; timsah Kuzey nehirleri.',
      'Yılan/örümcek: nadir ısırık ama antivenom hastanede; yürürken bot, çadırı kapalı tut.',
      'Outback mesafeleri: su 10 L/gün/kişi, yakıt, uydu telefonu; aracı terk etme.',
      'Yangın sezonu (Aralık–Şubat) toplu tahliye; "Fire Danger" uygulaması.',
      'Kanguru/wombat gece yol çarpması; alacakaranlıkta sürüş yapma.',
      "Tazmanya hava 4 mevsim/gün; Overland Track'te hipotermi yazın bile.",
      'Şehir güvenli; gece Kings Cross / King St alkollü kavga.',
    ],
    womenTravelers:
      "Çok güvenli; yalnız kadın backpacker kültürü. Outback'te otostop yapma. Hostel ve grup turları yaygın.",
    laws: [
      'Drone: CASA kuralları (250 g üstü kayıt), milli parklarda eyalete göre yasak/izin; plajlarda insanlardan 30 m.',
      'Alkol: 18 yaş; sokakta içmek çoğu belediyede yasak; "dry" Aborjin toplulukları.',
      "Uyuşturucu: eyalete göre; ACT'de küçük esrar dekriminalize; taşıma suç.",
      'LGBTİ+: evlilik yasal (2017), tam koruma.',
      'Kamp: milli parklarda rezervasyonlu; "free camping" alanları var; total fire ban günlerinde ateş/ocak yasak.',
      'Biyogüvenlik: yiyecek, ahşap, tohum beyan; ihlalde 5.000 AUD+ ceza ve vize iptali.',
    ],
    droneRules: 'CASA kaydı; Uluru, Kakadu ve çoğu milli parkta yasak; plaj ve şehirde kurallı.',
    alcoholRules: '18 yaş; "bottle shop" satışı; Kuzey Topraklar\'da kısıtlamalar; BYO lokantalar.',
    money: 'Avustralya Doları — 1 AUD ≈ ₺30. Kart/tap her yerde; nakit nadir; ATM ücretleri.',
    connectivity:
      "Telstra en geniş kapsama (28 gün 30 GB ≈ 40 AUD); Optus/Vodafone şehir. Outback'te sinyal yok; PLB/uydu zorunlu Tazmanya kırsalı. eSIM Airalo.",
    health: [
      'Güneş/UV.',
      'Su: musluk içilebilir.',
      'Dang Kuzey Queensland; Ross River virüsü.',
      'Isı çarpması outback.',
      'Sağlık masrafları yüksek; Medicare Türkiye anlaşması yok.',
    ],
    vaccines: [
      'Rutin aşılar',
      'Tetanos',
      'Hepatit A/B (isteğe bağlı)',
      'Japon ensefaliti (Kuzey, isteğe bağlı)',
    ],
    bestMonths: [3, 4, 5, 9, 10, 11],
    dailyTips: [
      'Vize başvurusunu 2 ay önce; VFS biyometri randevusu.',
      'Çadır ve botları temizle, gümrükte beyan et.',
      'Kamp için WikiCamps uygulaması; "free camp" alanları.',
      'Overland Track Ekim–Mayıs rezervasyon; kuzeyden güneye zorunlu.',
      'Süpermarket (Woolworths/Coles) yemek pişirmek pahalı lokantadan ucuz.',
    ],
    sources: [
      'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600',
      'https://parks.tas.gov.au',
      MFA_URL,
      'https://kanberra.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'NZ',
    name: 'Yeni Zelanda',
    region: 'Okyanusya',
    languages: ['en', 'mi'],
    currency: 'NZD',
    tryRate: 27,
    timezone: 'UTC+12',
    plugTypes: ['I'],
    visa: {
      type: 'embassy',
      maxStayDays: 90,
      costTry: 9500,
      processingDays: 30,
      url: 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/visitor-visa',
      note: 'Türk vatandaşları vize muafiyeti listesinde DEĞİL; NZeTA yalnızca muaf ülkeler içindir. Visitor Visa çevrimiçi (≈ 340 NZD + IVL turizm vergisi 100 NZD), 2–6 hafta, biyometri istenebilir. Biyogüvenlik dünyanın en katısı: çadır, bot, yürüyüş batonu temiz ve beyan edilmeli.',
    },
    documents: [
      passport(6),
      visaDoc('eVisa onayı; NZeTA gerekmez (vize ile).'),
      insurance(
        'ACC kaza sigortası yabancıları da kapsar (tedavi) ama tahliye/dönüş için özel poliçe; helikopter kurtarma ücretsiz (ACC).',
      ),
      permit(
        'great_walks',
        'Great Walks kulübe/kamp rezervasyonu',
        "DOC rezervasyon sistemi Mayıs–Haziran'da açılır; Milford Track dakikalarda dolar; yabancılar için ücret 2 kat.",
        false,
      ),
      permit(
        'biosecurity',
        'Temiz çadır, bot, baton ve ekipman',
        'Toprak/tohum/böcek beyanı; kirli ekipman yerinde temizlenir, ihlalde 400 NZD anında ceza.',
        true,
      ),
      permit(
        'plb',
        'PLB (kişisel konum vericisi) kiralama',
        "DOC ofisleri ve outdoor mağazaları 10–15 NZD/gün; backcountry'de şiddetle önerilir.",
        false,
      ),
      idp(),
      returnTicket(true),
      bankStatement(),
    ],
    etiquette: [
      '"Kia ora" selamı; Maori kültürüne saygı (marae ziyaretinde protokol, hongi burun selamı).',
      'Rahat, mütevazı ("tall poppy" — böbürlenme sevilmez).',
      'Hut kültürü: DOC kulübelerinde defter (intentions book) doldur, çıkarken temizle, odunu yenile.',
      'Track görgüsü: yokuş yukarı öncelik, "Kia ora" her yürüyüşçüye.',
      'Barbekü ve "bring a plate" (yemek getir) daveti.',
      'Ayakkabı evde çıkar (özellikle Maori/Pasifik evlerinde).',
      'Bahşiş yok.',
    ],
    dressCode:
      'Çok rahat, çıplak ayak süpermarkette bile; dağda 4 mevsim ekipmanı, rüzgârlık/yağmurluk zorunlu.',
    religionNotes:
      'Laik; Maori manevi alanlar (tapu) — bazı zirveler (Taranaki tepesi, Ngauruhoe) tırmanmamak rica edilir; Tongariro zirvelerinde durma.',
    photographyRules:
      "Serbest; marae'de izin; drone DOC arazisinde izinli (concession) — çoğunlukla yasak.",
    tipping: 'Yok; iyi hizmette yuvarla.',
    bargaining: 'Yok.',
    watchOut: [
      'Hava: saatte 4 mevsim; hipotermi en sık ölüm nedeni; MetService dağ tahmini, nehir geçişi kuralları (yağmurda geçme).',
      'Nehir geçişleri: "if in doubt, stay out"; su dizden yukarı ve hızlıysa bekle.',
      'Araç kiralama kazaları: sol trafik, dar dağ yolları, tek şeritli köprüler; uzun sürüş yapma.',
      'Sandfly (kum sineği) Fiordland; DEET.',
      'Tongariro Crossing: 19 km, hava aniden bozar; shuttle saatleri.',
      'Araç hırsızlığı park alanlarında (trailhead); değerli eşya bırakma.',
      'Deprem/volkan (Whakaari 2019); uyarı seviyeleri.',
      'Güneş UV çok yüksek; deniz soğuk.',
    ],
    womenTravelers:
      'Çok güvenli; yalnız kadın tramping yaygın; intentions/PLB ile plan bırak. Otostop görece yaygın ama önerilmez.',
    laws: [
      'Drone: CAA Part 101 — insanlar/mülk üstünde izin, 120 m, DOC arazisinde izin şart; milli parklarda fiilen yasak.',
      'Alkol: 18 yaş; belediye "liquor ban" alanlarında sokakta içmek yasak.',
      'Uyuşturucu: esrar yasa dışı (2020 referandumu ret), tıbbi kullanım yasal.',
      'LGBTİ+: evlilik yasal (2013), tam koruma.',
      'Kamp: "freedom camping" yalnızca kendi tuvaleti olan araçlarla belirlenmiş alanlarda; ihlal 400 NZD; DOC kamp alanları ucuz; ateş yasakları yaz.',
      "Biyogüvenlik ihlali 400 NZD anında ceza, kovuşturma 100.000 NZD'ye kadar.",
    ],
    droneRules:
      'DOC concession olmadan koruma alanlarında yasak; Tongariro, Fiordland, Aoraki yasak.',
    alcoholRules: '18 yaş; süpermarkette bira/şarap; barlar 4 sonrası; liquor ban bölgeleri.',
    money: 'NZ Doları — 1 NZD ≈ ₺27. Kart her yerde; DOC kulübeleri kartla önceden; nakit nadir.',
    connectivity:
      "One NZ (eski Vodafone)/Spark prepaid (30 gün 20 GB ≈ 40 NZD); eSIM. Backcountry'de sinyal yok — PLB/inReach.",
    health: [
      'Musluk suyu içilebilir; dere suyu giardia (filtre).',
      'Hipotermi ve UV.',
      'Sandfly.',
      'ACC kaza tedavisini karşılar ama hastalığı değil.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos'],
    bestMonths: [11, 12, 1, 2, 3, 4],
    dailyTips: [
      'Vize ve IVL için 2 ay önce başvur.',
      'DOC uygulaması ve hut pass; Great Walks dışı kulübeler 25 NZD.',
      'Trailhead\'de "intentions" bırak (AdventureSmart).',
      'Tongariro shuttle rezervasyonu; kış için rehber.',
      "Süpermarket (Pak'nSave) ucuz; lokanta pahalı.",
    ],
    sources: [
      'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/visitor-visa',
      'https://www.doc.govt.nz',
      'https://www.adventuresmart.nz',
      MFA_URL,
      'https://vellington.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'FR',
    name: 'Fransa',
    region: 'Batı Avrupa · Alpler',
    languages: ['fr'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'E'],
    visa: schengenVisa(
      'Fransa',
      'https://france-visas.gouv.fr',
      'Schengen C vizesi (90/180 gün), 90 € + aracı kurum (TLScontact/VFS) ücreti; Fransa ana varış ülkesi ise TLScontact Ankara/İstanbul/İzmir randevusu. Yaz için 2–3 ay önce; dağcılık için UIAA/TDF üyeliği ve sigorta dosyaya güç katar. Ücret ve süre için resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3, 'Schengen: çıkış tarihinden sonra en az 3 ay geçerli, son 10 yılda verilmiş.'),
      visaDoc('Schengen vize etiketi; ilk giriş ana varış ülkesinden.'),
      insurance(
        'Schengen zorunlu 30.000 € sağlık + Mont Blanc için dağ kurtarma (PGHM ücretsiz, helikopter hastane transferi ve İtalyan tarafı ücretli); Chamonix "Carte Neige/FFCAM" önerilir.',
      ),
      permit(
        'mont_blanc',
        'Mont Blanc Goûter refuge rezervasyonu',
        'Normal rota için Refuge du Goûter/Tête Rousse rezervasyonu ZORUNLU (belediye kararı); rezervasyonsuz tırmanış jandarma tarafından durdurulur.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Mağazaya girerken "Bonjour", çıkarken "Au revoir"; bunu atlamak kabalık.',
      'Fransızca birkaç kelime çabası takdir edilir; doğrudan İngilizceye geçme.',
      'Yemek uzun sürer; garson çağırmak için göz teması, "Monsieur/Madame".',
      'Refuge kültürü: çizmeler dışarıda, uyku tulumu astarı zorunlu, akşam yemeği 19:00, sessizlik 22:00.',
      'Yolda selamlaşma ("Bonjour") her yürüyüşçüye; yokuş yukarı öncelik.',
      'Bise (yanak öpücüğü) tanışlar arasında; iş ortamında tokalaşma.',
    ],
    dressCode: 'Paris şık, dağ kasabaları rahat. Alplerde yazın bile don; teknik giyim normal.',
    religionNotes:
      'Laik; kiliseler ve katedraller ziyarete açık (ayin sırasında sessiz). Laiklik nedeniyle dini semboller kamuda tartışmalı; başörtüsü sokakta serbest.',
    photographyRules:
      'Kamusal alan serbest; insanları izinsiz yayınlamak "image hakkı" ihlali. Askeri ve nükleer tesis yasak. Drone milli parklarda (Vanoise, Écrins) yasak, Chamonix vadisi sınırlı.',
    tipping:
      'Servis dahil ("service compris"); memnunsan 1–2 € bırak. Dağ rehberine günün sonunda içki/küçük bahşiş.',
    bargaining: 'Yok; bit pazarları (brocante) hariç.',
    watchOut: [
      'Paris: yankesicilik metroda (1, 4, 6 hatları), Eyfel çevresi "dilekçe imzalatma", "altın yüzük" ve "bilezik" tuzağı.',
      'Mont Blanc Goûter kuluvarı: taş düşmesi ölümleri; sabah erken, kask, hızla geç. Zirve günü hava penceresi.',
      'Buzul (Mer de Glace, Vallée Blanche): çatlaklar, ip ve rehber.',
      "Yaz sıcak dalgaları: 2022'den beri Mont Blanc rotası Ağustos'ta kapanabiliyor.",
      'Tren grevleri (SNCF) ve gösteriler; alternatif plan.',
      'Araç camı kırma park alanlarında (trailhead); değerli eşya bırakma.',
      'Chamonix pahalı; refuge yemeği 25 €, kabin biletleri 70 €+.',
      'Kayak dışı alan (hors-piste) çığ; DVA, kürek, sonda; bülten (Météo-France).',
    ],
    womenTravelers:
      "Güvenli; Paris'te gece metro kalabalık vagon. Dağ ortamı çok kadın dostu; kadın rehberler (Compagnie des Guides).",
    laws: schengenLaws([
      'Vahşi kamp: milli parklarda yasak, "bivouac" (gün batımı–gün doğumu) çoğu yerde tolere; Chamonix vadisinde kamp yasak, ateş yasak.',
      'Tam yüz örtme (burka) kamusal alanda yasak.',
      'Mont Blanc: refuge rezervasyonsuz tırmanış ve uygunsuz ekipmanla çıkış para cezası (Saint-Gervais kararnamesi).',
    ]),
    droneRules:
      'EASA; Vanoise/Écrins/Mercantour milli parkları yasak; Chamonix belediyesi yaz kısıtları; Paris tamamen yasak.',
    alcoholRules:
      '18 yaş; şarap kültürü; sokakta içmek çoğu şehirde serbest, bazı bölgelerde gece yasak.',
    money:
      "Euro — 1 EUR ≈ ₺50. Kart her yerde (contactless 50 €); refuge'ler nakit isteyebilir. ATM ücretsiz (banka).",
    connectivity:
      'AB eSIM/roaming; Orange/Free/SFR prepaid 10–20 €. Alplerde Orange en iyi; vadide 4G, zirvede kesik.',
    health: [
      'Musluk suyu içilebilir.',
      "İrtifa: Mont Blanc 4.808 m; Chamonix'de 2–3 gün aklimatizasyon.",
      'Kene (Lyme) alçak ormanlarda.',
      'Güneş yansıması buzulda.',
      'Avrupa Sağlık Kartı yok; sigorta.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (Alsace/Alpler, isteğe bağlı)'],
    bestMonths: [6, 7, 8, 9, 1, 2, 3],
    dailyTips: [
      "Schengen vize randevusunu TLScontact'tan sabah 8'de kontrol et; iptaller açılır.",
      'Chamonix Mont Blanc Multipass ile kabinler; Aiguille du Midi rezervasyonlu.',
      "Refuge rezervasyonu FFCAM sitesinden; Goûter Mart'ta açılır.",
      'Boulangerie sandviçi 5 €; süpermarket "Carrefour Montagne".',
      'TMB (Tour du Mont Blanc) için refuge zinciri 6 ay önce.',
    ],
    sources: schengenSources(
      'https://france-visas.gouv.fr',
      'https://www.chamoniarde.com',
      'https://paris.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'CH',
    name: 'İsviçre',
    region: 'Batı Avrupa · Alpler',
    languages: ['de', 'fr', 'it', 'rm'],
    currency: 'CHF',
    tryRate: 55,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'J'],
    visa: schengenVisa(
      'İsviçre',
      'https://www.eda.admin.ch/countries/turkey/tr/home/visa.html',
      'Schengen C vizesi; İsviçre ana varış ise TLScontact Ankara/İstanbul; ücret 90 € + hizmet. Sigorta 30.000 €; dağcılık için SAC üyeliği/Rega yararlı. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3, 'Schengen kuralı: çıkış sonrası 3 ay.'),
      visaDoc('Schengen etiketi.'),
      insurance(
        'Rega (helikopter kurtarma) üyeliği 40 CHF/yıl — üyeler için kurtarma ücretsiz; aksi halde 3.000–10.000 CHF. Sağlık masrafları çok yüksek.',
      ),
      permit(
        'hut',
        'SAC kulübe rezervasyonu',
        'SAC hütte rezervasyonu zorunlu; üye indirimi.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Dakiklik mutlak; tren dakikasında kalkar.',
      'Selam üç dilde: "Grüezi", "Bonjour", "Buongiorno"; komşu kantonu karıştırma.',
      'Sessizlik: pazar günü ve 22:00 sonrası gürültü yasak (çamaşır bile).',
      'Kulübe görgüsü: çizme dışarı, kulübe terliği, sessizlik, kahvaltı 5:00.',
      'Çöp ayrıştırma ciddiye alınır; çöp poşeti ücretli.',
      'Yolda "Grüezi" her yürüyüşçüye; inek çanlı çayırlarda kapıyı kapat.',
    ],
    dressCode: "Şehir düzenli; dağda teknik giyim; yazın 3.000 m'de kar.",
    religionNotes:
      'Katolik/Protestan kantonlar; kiliseler açık. Pazar günü mağazalar kapalı (istasyon hariç).',
    photographyRules:
      'Serbest; insanların gizliliği önemli. Drone milli park (Engadin) ve doğa koruma alanlarında yasak; birçok kanton ek kısıt.',
    tipping: 'Servis dahil; yuvarla (1–2 CHF). Rehbere memnuniyet bahşişi.',
    bargaining: 'Yok.',
    watchOut: [
      'Fiyatlar: kahve 5 CHF, menü 25 CHF, kulübe yarım pansiyon 80 CHF; bütçeyi 2 kat planla.',
      'Matterhorn/Eiger rotaları teknik; rehbersiz çıkma; Hörnli kulübe rezervasyonu.',
      'Hava: Föhn rüzgârı ve ani fırtına; MeteoSwiss uygulaması.',
      'Kayak dışı çığ: SLF bülteni, DVA zorunlu.',
      'Tren biletleri pahalı; Swiss Travel Pass/Half Fare kart hesapla.',
      'Suç düşük; istasyonda bagaj hırsızlığı.',
      'Trafik cezaları çok yüksek (hız 5 km/s üstü); otoyol vinyet 40 CHF.',
      'Buzul yürüyüşü (Aletsch, Gorner) çatlak; ip.',
    ],
    womenTravelers: 'Çok güvenli; dağ kulübelerinde karma yatakhane.',
    laws: schengenLaws([
      'Vahşi kamp: kantona göre; milli park ve av yasağı bölgelerinde yasak, ağaç sınırı üstünde bir gecelik tolere; ateş orman yakınında yasak.',
      'Otoyol vinyet zorunlu; hız cezaları gelire göre.',
      'Gürültü: pazar günü ve gece sessizlik kuralları (uygulanır).',
    ]),
    droneRules:
      'EASA + İsviçre BAZL; Engadin Milli Parkı ve federal av rezervleri yasak; 250 g üstü kayıt ve sınav.',
    alcoholRules: '16 (bira/şarap) / 18 (sert); sokakta içmek serbest.',
    money:
      'İsviçre Frangı — 1 CHF ≈ ₺55. Kart her yerde; Twint yerel; nakit kulübelerde. Euro kabul edilir ama kötü kur.',
    connectivity:
      "Swisscom prepaid 20 CHF (30 gün); AB roaming İsviçre'yi KAPSAMAZ (çoğu eSIM planında ayrı). Dağlarda Swisscom iyi.",
    health: [
      'Musluk suyu ve çeşmeler içilebilir.',
      'İrtifa: Jungfraujoch 3.454 m trenle — AMS.',
      'Kene ensefaliti (FSME) endemik; aşı önerilir.',
      'Sağlık masrafı çok yüksek.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (önerilir)'],
    bestMonths: [6, 7, 8, 9, 12, 1, 2],
    dailyTips: [
      'Rega üyeliği: ülkeye girmeden çevrimiçi al.',
      'Coop/Migros market yemekleri; lokanta pahalı; su çeşmelerden.',
      'SBB uygulaması "Supersaver" biletler %50 indirim.',
      'Kulübeler yarım pansiyon; kendi yemeğin için "Selbstversorger" bölümü.',
      'Kabin sistemleri Zermatt/Grindelwald pahalı; erken saat indirimi.',
    ],
    sources: schengenSources(
      'https://www.eda.admin.ch/countries/turkey/tr/home/visa.html',
      'https://www.rega.ch',
      'https://bern.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'IT',
    name: 'İtalya',
    region: 'Güney Avrupa · Alpler & Dolomitler',
    languages: ['it'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'F', 'L'],
    visa: schengenVisa(
      'İtalya',
      'https://vistoperitalia.esteri.it',
      'Schengen C vizesi; İtalya ana varış ise iDATA Ankara/İstanbul/İzmir; ücret 90 € + hizmet. Yaz randevuları 2–3 ay önce dolar; Dolomitler için rifugio rezervasyonları dosyaya konur. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi.'),
      insurance(
        "Dolomitler ve Gran Paradiso; İtalya'da dağ kurtarma (CNSAS) bazı bölgelerde ücretli (Trentino/Alto Adige helikopter 100 €/dk); sigorta şart.",
      ),
      permit(
        'rifugio',
        'Rifugio rezervasyonu (Alta Via, Tre Cime)',
        "Yaz için Mart'ta; CAI üyeliği indirim. Tre Cime yolu günlük araç kotası.",
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      '"Buongiorno/Buonasera"; kapuçino yalnızca sabah; ayakta bar fiyatı ile masa fiyatı farklı.',
      'Kiliselerde omuz-diz kapalı (girişte kontrol); ayin sırasında dolaşma.',
      'Rifugio: çizme dışarı, sessizlik 22:00, yemek "mezza pensione".',
      'Yolda "Buongiorno/Ciao"; Alto Adige\'de Almanca "Grüß Gott".',
      'Yemekte ekmekle sos sıyırma normal ("scarpetta"), peynir deniz ürünü makarnasına konmaz.',
      'Sıra kültürü zayıf; nazik ama kararlı.',
    ],
    dressCode: 'Şehir şık; kiliselerde kapalı. Dolomitler yazın fırtına, sonbahar don.',
    religionNotes:
      'Katolik; kiliseler turistik saatlerde açık, ayin sırasında sınırlı. Vatikan giyim kuralı katı.',
    photographyRules:
      'Serbest; müzelerde flaşsız; askeri yasak. Drone Dolomitler (UNESCO) ve milli parklarda yasak; Venedik/Roma merkez yasak.',
    tipping: 'Beklenmez ("coperto" masa ücreti zaten var); yuvarla 1–2 €.',
    bargaining: 'Pazar tezgâhlarında hafif; mağaza yok.',
    watchOut: [
      'Yankesicilik: Roma Termini, Napoli, Venedik vaporetto, Floransa; "gül veren" ve "bilezik" tuzağı.',
      "Taksi: yalnızca resmî beyaz taksi; Roma'da havalimanı sabit 50 €.",
      'ZTL (sınırlı trafik bölgesi) cezaları araç kiralayanlara aylar sonra gelir.',
      'Via ferrata: set + kask + eldiven zorunlu; fırtınada demir yollarda yıldırım.',
      'Dolomitler yaz öğleden sonra fırtına; sabah erken çık.',
      "Napoli'de scooter kapkaç; Vezüv/Etna volkanik aktivite kapanmaları.",
      'Kayak dışı çığ; DVA zorunlu (İtalyan yasası 2022).',
      'Plaj "lido" ücretli; ücretsiz "spiaggia libera" ara.',
    ],
    womenTravelers:
      'Güvenli; güney şehirlerde sözlü ilgi. Dolomitler ve rifugio ağı çok kadın dostu.',
    laws: schengenLaws([
      'Vahşi kamp: bölgesel; milli parklarda yasak, Dolomitler\'de "bivacco" gün batımı–doğumu tolere (Alto Adige katı, ceza 500 €+).',
      'Kayak dışı: DVA, kürek, sonda ve sorumluluk sigortası zorunlu (2022 yasası); kask 18 yaş altına.',
      'ZTL ve otoyol cezaları.',
      'Sahil ve müzelerde oturmak/piknik yasağı (Roma İspanyol merdivenleri, Venedik).',
    ]),
    droneRules:
      'ENAC/EASA; Dolomitler UNESCO alanları ve tüm milli parklar yasak; tarihi merkezler yasak.',
    alcoholRules:
      '18 yaş; şarap kültürü; sokakta içmek bazı belediyelerde gece yasak (Roma, Milano).',
    money:
      'Euro — 1 EUR ≈ ₺50. Kart yaygın (30 € altı bazen nakit); rifugio nakit/kart karışık; ATM "Bancomat".',
    connectivity:
      "TIM/Vodafone/Iliad prepaid 10 € (150 GB, pasaport + codice fiscale otomatik); AB eSIM. Dolomitler'de TIM/Vodafone iyi.",
    health: [
      'Musluk suyu içilebilir ("nasoni" çeşmeleri Roma).',
      'Yaz sıcak dalgaları güney.',
      'Kene (Lyme, FSME) Kuzeydoğu.',
      'İrtifa: Gran Paradiso 4.061 m.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (Trentino/Friuli, isteğe bağlı)'],
    bestMonths: [6, 7, 8, 9, 5, 10],
    dailyTips: [
      'iDATA randevuları gece yarısı açılır; erken uyan.',
      'Rifugio rezervasyonu Mart; Alta Via 1 popüler.',
      'Trenitalia/Italo erken bilet %60 indirim; bilet zımbalama (regionale).',
      'Aperitivo 18–20 arası bir içki + büfe 10 €.',
      "Tre Cime'ye Auronzo yolu ücretli (30 €) ve kotalı; otobüs alternatifi.",
    ],
    sources: schengenSources(
      'https://vistoperitalia.esteri.it',
      'https://www.cnsas.it',
      'https://roma.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'AT',
    name: 'Avusturya',
    region: 'Orta Avrupa · Alpler',
    languages: ['de'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'Avusturya',
      'https://www.bmeia.gv.at/tr/avusturya-buyukelciligi-ankara/',
      'Schengen C vizesi; Avusturya ana varış ise VFS Ankara/İstanbul/İzmir; ücret 90 € + hizmet; kış sporları için ekipman/rezervasyon belgesi. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi.'),
      insurance(
        "Avusturya'da dağ kurtarma (Bergrettung) ÜCRETLİ (helikopter 3.000–7.000 €); Alpenverein (ÖAV) üyeliği (~70 €) dünya çapında kurtarma sigortası içerir — en iyi çözüm.",
      ),
      permit(
        'hut',
        'Alpenverein hütte rezervasyonu',
        'alpsonline.org; üye indirimi ve öncelik.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      '"Grüß Gott" selamı (Servus gençler arası); yolda herkese.',
      'Dakiklik ve sessizlik (Ruhezeit); pazar günü mağaza kapalı.',
      'Hütte kuralları: Hüttenschuhe (terlik), astar zorunlu, yemek saati, sessizlik 22:00.',
      'Kahvehane kültürü: masa saatlerce senin; garson "Herr Ober".',
      'Çöp ayrıştırma; sigara kapalı alanda yasak.',
      'Tırmanışta önce gelen önce gider; bağırarak iletişim ayıp.',
    ],
    dressCode: 'Viyana şık; dağ rahat; kış -20 °C.',
    religionNotes: 'Katolik; kiliseler açık; dağ zirvelerinde haç (Gipfelkreuz) — üzerine çıkma.',
    photographyRules:
      'Serbest; drone Hohe Tauern milli parkı ve Natura 2000 alanlarında yasak; şehirde kayıt.',
    tipping: 'Yuvarla (%5–10); garsona parayı verirken toplamı söyle ("stimmt so").',
    bargaining: 'Yok.',
    watchOut: [
      'Kurtarma ücretli; ÖAV üyeliği olmadan çıkma.',
      'Kayak dışı çığ (Arlberg, Tirol); LWD bülteni; DVA.',
      'Yaz fırtınası Alplerde öğleden sonra; Großglockner rehberli.',
      'Otoyol vinyet (11 €/10 gün) ve tünel ücretleri; hız cezası.',
      'Viyana güvenli; Praterstern gece; yankesicilik U-Bahn.',
      'Kabin fiyatları yüksek; Sommercard bölgesel ücretsiz.',
      'İnek saldırıları (buzağılı sürü, köpekli yürüyüşçü): mesafe, tasma çöz.',
      'Via ferrata (Klettersteig) kalabalık; erken saat.',
    ],
    womenTravelers: 'Çok güvenli; hütte ortak yatakhane.',
    laws: schengenLaws([
      'Vahşi kamp: eyalete göre; Tirol, Salzburg, Kärnten tamamen yasak (ceza 500 €+), ağaç sınırı üstü acil bivak tolere.',
      'Otoyol vinyet zorunlu.',
      'Kayak pistlerinde kask 15 yaş altı zorunlu; "Pistenregeln" FIS kuralları yasal.',
    ]),
    droneRules: 'Austro Control kaydı; Hohe Tauern, Gesäuse yasak; hütte çevresinde uçurma.',
    alcoholRules: '16 (bira/şarap) / 18 (sert); Heuriger şarap kültürü; sokakta serbest.',
    money:
      'Euro — 1 EUR ≈ ₺50. Kart yaygın ama küçük lokantalar nakit ("Nur Bargeld"); ATM (Bankomat) ücretsiz.',
    connectivity:
      'A1/Magenta/Drei prepaid 10–15 €; AB eSIM. Dağlarda A1 en iyi; hütte Wi-Fi nadir.',
    health: [
      'Musluk suyu içilebilir (Viyana Alp suyu).',
      'Kene ensefaliti (FSME) yüksek risk; aşı önerilir.',
      'Kış soğuk; yaz fırtına.',
      'İrtifa Großglockner 3.798 m.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (önerilir)'],
    bestMonths: [6, 7, 8, 9, 12, 1, 2, 3],
    dailyTips: [
      "ÖAV üyeliği Türkiye'den çevrimiçi (Alpenverein Weltweit Service).",
      'Hütte rezervasyonu yaz için Şubat; yarım pansiyon 50–60 €.',
      'ÖBB Sparschiene erken bilet 10–20 €.',
      'Kış: Skipass fiyatları 70 €/gün; Innsbruck Nordkette şehirden kabin.',
      'Süpermarket (Hofer/Spar) pazar kapalı; istasyon marketleri açık.',
    ],
    sources: schengenSources(
      'https://www.bmeia.gv.at',
      'https://www.alpenverein.at',
      'https://viyana.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'DE',
    name: 'Almanya',
    region: 'Orta Avrupa',
    languages: ['de'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'Almanya',
      'https://tuerkei.diplo.de/tr-tr/service/visa-einreise',
      'Schengen C vizesi; Almanya ana varış ise iDATA/Visametric Ankara/İstanbul/İzmir/Antalya; ücret 90 € + hizmet; randevu bekleme uzun (aylar). Akraba daveti "Verpflichtungserklärung" dosyayı güçlendirir. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi.'),
      insurance(
        'Zugspitze/Berchtesgaden; Bergwacht kurtarma ücretsiz-kısmen ücretli (helikopter ADAC/DRF); DAV üyeliği kurtarma sigortası içerir.',
      ),
      permit(
        'hut',
        'DAV hütte rezervasyonu',
        'alpsonline.org; DAV üyeliği (~90 €) hütte indirimi + kurtarma.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Dakiklik ve kurallar; kırmızı ışıkta yaya geçmez.',
      '"Hallo/Guten Tag", Bavyera\'da "Grüß Gott"; yolda "Servus".',
      'Sessizlik (Ruhezeit) 22–06 ve pazar; cam şişe atma gürültüsü bile yasak.',
      'Bisiklet yolu yürüyerek işgal etme; zil çalar.',
      'Kasada hızlı poşetleme; nakit hâlâ yaygın.',
      'Doğrudan iletişim kabalık değildir; "Sie" resmî hitap.',
      'Pfand (depozito) şişe iade; Mülltrennung (çöp ayırma).',
    ],
    dressCode: 'Rahat ve pratik; Bavyera festivallerinde Tracht turistlerce de giyilir.',
    religionNotes:
      'Protestan/Katolik, laik; kiliseler açık; pazar kutsal (mağazalar kapalı). Türk diasporası büyük, camiler yaygın.',
    photographyRules:
      'Kişilik hakları güçlü; insanları izinsiz yayınlama. Askeri yasak. Drone Bavyera Alpleri koruma alanlarında yasak.',
    tipping: '%5–10 yuvarla; ödeme sırasında toplamı söyle.',
    bargaining: 'Flohmarkt (bit pazarı) hariç yok.',
    watchOut: [
      'Yankesicilik istasyonlar (Berlin Hbf, Frankfurt), Oktoberfest çadırları.',
      'Bisiklet yolunda yürümek kaza riski.',
      'Otoban hızsız bölümler; sol şerit disiplini; kaza durumunda "Rettungsgasse".',
      'Zugspitze: Höllental via ferrata + buzul; Reintal uzun; kabinle çıkanlar AMS.',
      'Berchtesgaden Watzmann doğu yüzü ölümcül; hava.',
      'Tren gecikmeleri (DB) ve grevleri; bağlantıya tampon.',
      'Kene (FSME) Bavyera/Baden-Württemberg yüksek risk.',
      'Frankfurt Bahnhofsviertel uyuşturucu sahnesi; tehlikeli değil ama rahatsız edici.',
    ],
    womenTravelers:
      'Güvenli; gece istasyon çevrelerinde dikkat. Hütte ve tırmanış toplulukları kadın dostu.',
    laws: schengenLaws([
      'Vahşi kamp: eyalete göre; Bavyera Alpleri\'nde yasak, ateş ormanda yasak (100 m kuralı); "Biwak" acil durum tolere.',
      "Esrar 2024'te kısmen yasal (25 g bulundurma), ama sokakta okul/çocuk alanlarında yasak; sınır ötesi taşıma suç.",
      'Nazi sembolleri ve selamı suç (turistler tutuklandı).',
      'Umweltzone (çevre bölgesi) şehir merkezlerinde araç çıkartması.',
    ]),
    droneRules:
      'EASA + LBA; Bavyera doğa koruma alanları ve milli parklar (Berchtesgaden) yasak; 250 g üstü kayıt.',
    alcoholRules:
      '16 (bira/şarap) / 18 (sert); sokakta içmek serbest (bazı istasyonlar hariç); Oktoberfest.',
    money:
      'Euro — 1 EUR ≈ ₺50. Nakit hâlâ önemli (küçük lokanta, hütte); kart artıyor (Girocard); ATM (Sparkasse) ücretli olabilir.',
    connectivity:
      'Telekom/Vodafone/O2 prepaid 10–15 € (kimlik doğrulama video); AB eSIM daha kolay. Kırsalda ölü bölgeler; Telekom en iyi.',
    health: [
      'Musluk suyu içilebilir.',
      'Kene ensefaliti güney eyaletler; aşı.',
      'Eczaneler (Apotheke) reçeteli; nöbetçi listesi.',
      'Kış soğuk; Alplerde çığ.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (Bavyera, önerilir)'],
    bestMonths: [5, 6, 7, 8, 9, 10],
    dailyTips: [
      'Deutschlandticket 58 €/ay tüm bölgesel toplu taşıma.',
      'DAV üyeliği hütte + kurtarma; alpsonline rezervasyon.',
      'Pfand şişe iade 0,25 €; süpermarket makine.',
      'Pazar günü market kapalı; istasyon/benzinci açık.',
      "Zugspitze için Garmisch'ten sabah kabin; Eibsee park dolar.",
    ],
    sources: schengenSources(
      'https://tuerkei.diplo.de/tr-tr/service/visa-einreise',
      'https://www.alpenverein.de',
      'https://berlin.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'NO',
    name: 'Norveç',
    region: 'Kuzey Avrupa · İskandinavya',
    languages: ['no', 'en'],
    currency: 'NOK',
    tryRate: 4.5,
    timezone: 'UTC+1 / UTC+2 (yaz)',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'Norveç',
      'https://www.udi.no/en/want-to-apply/visit-and-holiday/visitor-visa/',
      "Schengen C vizesi; Norveç ana varış ise VFS Ankara/İstanbul (UDI çevrimiçi başvuru + VFS teslim); ücret 90 € + hizmet. Yaz için Mart'ta başvur. Resmî kaynağı kontrol et.",
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi.'),
      insurance(
        "Norveç'te kurtarma (Røde Kors Hjelpekorps, 330 Skvadron) ÜCRETSİZ; hastane masrafı ve dönüş için sigorta.",
      ),
      permit(
        'dnt',
        'DNT üyeliği + kulübe anahtarı',
        'DNT (Turistforening) üyeliği (~800 NOK) kulübelerde indirim ve kilitli kulübe anahtarı; "ubetjent" kulübelerde kendin ödersin (güven sistemi).',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Allemannsretten (herkesin hakkı): doğada serbest dolaşım/kamp hakkıyla birlikte sorumluluk — iz bırakma, evlerden 150 m uzak, aynı yerde 2 gece.',
      'Norveçliler sessiz ve mesafeli; küçük sohbet az; sıra düzeni; "takk".',
      'Kulübe (hytte) kültürü: odun yenile, temizle, defter doldur, ücreti kutuya at.',
      'Yolda "hei" ile selam; zirve defteri imzala.',
      'Ayakkabı evde çıkar.',
      'Doğaya saygı: "ingen spor" (iz yok); tuvalet 50 m su uzağı.',
    ],
    dressCode: 'Pratik ve outdoor; şehirde bile yağmurluk. Yaz ortası dağda 5 °C ve yağmur.',
    religionNotes:
      'Laik Lutheran; Sami kültürü kuzeyde (ren geyiği alanlarına saygı, Sami\'yi "Lapon" diye anma).',
    photographyRules:
      'Serbest; Sami insanlarını izinsiz çekme; drone milli parklarda ve ren geyiği bölgelerinde kısıtlı.',
    tipping: 'Beklenmez; %5–10 iyi hizmette.',
    bargaining: 'Yok.',
    watchOut: [
      "Hava: Trolltunga/Preikestolen'da yazın bile hipotermi ve sis; ekipmansız turistler kurtarılıyor; sezon Haziran–Eylül.",
      'Fiyatlar çok yüksek (bira 100 NOK, menü 250 NOK); süpermarket ve kendi yemeğin.',
      "Fiyort kıyısında kaygan kaya, kayak-yürüyüş rotalarında derin kar Haziran'da.",
      'Trafik: tüneller, feribot saatleri, geyik çarpması; hız cezaları astronomik.',
      'Lofoten yazın kalabalık; kamp alanı bul, "wild camping" hassas noktalarda yasaklandı (Reinebringen).',
      'Kuzeyde kutup gecesi/sonsuz gündüz; uyku maskesi.',
      'Suç düşük; Oslo merkezi gece uyuşturucu satıcıları rahatsız edebilir.',
      'Svalbard: kutup ayısı, silah zorunlu; yerleşim dışı rehberli.',
    ],
    womenTravelers: 'Dünyanın en güvenli ülkelerinden; yalnız kadın kamp yaygın.',
    laws: schengenLaws([
      'Allemannsretten: ekili olmayan arazide (utmark) kamp serbest, evlerden 150 m; 2 gece üstü sahibinden izin; motorlu araç yasak.',
      'Ateş yasağı 15 Nisan–15 Eylül ormanda ve çevresinde (uygulanır); işaretli ocak yerleri hariç.',
      'Alkol: 18 (bira) / 20 (sert); Vinmonopolet devlet mağazası, cumartesi öğleden sonra kapalı; sokakta içmek yasak.',
      'Sürüşte 0,2‰; ceza gelire göre + hapis.',
    ]),
    droneRules:
      'EASA + Luftfartstilsynet; milli parklarda (Jotunheimen, Rondane) ve kuş rezervlerinde yasak; Preikestolen belediye yasağı.',
    alcoholRules: "18/20 yaş; Vinmonopolet; bira süpermarkette 20:00'ye kadar (cumartesi 18:00).",
    money:
      'Norveç Kronu — 1 NOK ≈ ₺4,5. Neredeyse tamamen nakitsiz; Vipps yerel; kart her yerde, DNT kulübelerinde kart/çevrimiçi ödeme.',
    connectivity:
      'Telia/Telenor prepaid 200–300 NOK; AB eSIM roaming geçerli (EEA). Dağlarda Telenor iyi; fiyort vadilerinde boşluk.',
    health: [
      'Musluk ve dere suyu içilebilir (çoğu yerde).',
      'Hipotermi ana risk.',
      'Kene güney kıyıda; Lyme.',
      'Kuzeyde sivrisinek yaz.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Kene ensefaliti (güney, isteğe bağlı)'],
    bestMonths: [6, 7, 8, 9],
    dailyTips: [
      'UT.no uygulaması DNT rotaları ve kulübeleri.',
      'Süpermarket (Rema 1000, Kiwi) + tur turu; su çeşmeden.',
      'Feribot ve otoyol ücretleri AutoPASS ile otomatik (kiralık araca yansır).',
      "Trolltunga 28 km; sabah 6'da çık, Eylül sonrası rehber.",
      'Kuzey ışıkları Tromsø Eylül–Mart; Lofoten yaz gece yarısı güneşi.',
    ],
    sources: schengenSources(
      'https://www.udi.no/en/want-to-apply/visit-and-holiday/visitor-visa/',
      'https://www.dnt.no',
      'https://oslo.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'IS',
    name: 'İzlanda',
    region: 'Kuzey Avrupa',
    languages: ['is', 'en'],
    currency: 'ISK',
    tryRate: 0.34,
    timezone: 'UTC+0',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'İzlanda',
      'https://island.is/en/visa-to-iceland',
      "Schengen C vizesi; İzlanda Türkiye'de Danimarka Büyükelçiliği/VFS üzerinden temsil edilir (ana varış İzlanda ise). Ücret 90 € + hizmet; yaz için Mart. Resmî kaynağı kontrol et.",
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi (Danimarka konsolosluğu adına).'),
      insurance(
        'ICE-SAR kurtarma ücretsiz (gönüllü) ama hastane/tahliye pahalı; araç sigortası (çakıl, kum, su geçişi) kiralamada ek.',
      ),
      permit(
        'highland',
        'Yayla (F-yolu) için 4x4 + safetravel.is plan',
        "F yolları yalnızca 4x4; nehir geçişi sigortası yok; SafeTravel'e seyahat planı bırak.",
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Havuz kültürü: mayo giymeden önce tamamen çıplak yıkanma zorunlu (görevli kontrol eder).',
      'Ayakkabı evde çıkar; "takk fyrir".',
      'Doğaya dokunma: yosun (moss) üstüne basma, çiğ mal yıkılır; taş yığını (cairn) yapma.',
      'Sessiz ve ölçülü; kişisel alan.',
      'İsimlerle hitap (soyadı yok); rehberi ismiyle çağır.',
      'Elf/troll inançlarıyla dalga geçme.',
    ],
    dressCode: 'Her mevsim katman + rüzgâr/yağmur kabuğu; yaz 10 °C. Reykjavík rahat.',
    religionNotes: 'Lutheran, laik; kiliseler açık; Hallgrímskirkja turistik.',
    photographyRules:
      'Serbest; drone birçok turistik alanda (Þingvellir, Jökulsárlón, Skógafoss) yasak; kuş kolonilerinde (Látrabjarg) mesafe.',
    tipping: 'Yok.',
    bargaining: 'Yok.',
    watchOut: [
      'Hava: dakikalar içinde fırtına; road.is ve vedur.is; kapalı yolda sürüş cezalı.',
      'Reynisfjara "sneaker wave" ölümleri; suya sırtını dönme, 30 m mesafe.',
      'Buzul yürüyüşü ve buz mağarası yalnızca rehberli; Sólheimajökull çatlakları.',
      'Jeotermal alanlarda kaynar çamur, işaretli yoldan çıkma.',
      'Araç: çakıl yollarda hız 80, tek şeritli köprü, kapı rüzgârla kopar; kum fırtınası sigortası.',
      'F-yolu nehir geçişi kiralık araç sigortası dışı; derinliği yürüyerek ölç.',
      'Fiyatlar çok yüksek; Bónus süpermarket.',
      'Volkanik aktivite (Reykjanes) yol ve Blue Lagoon kapanmaları.',
    ],
    womenTravelers: 'Dünyanın en güvenli ülkesi; yalnız kadın kamp ve otostop yaygın.',
    laws: schengenLaws([
      "Vahşi kamp: 2015'ten beri yerleşim çevresi ve karavanla yasak; yürüyüşçü için ekili olmayan arazide bir gece tolere (sahibinden izin tercih); milli parklarda yalnızca kamp alanları.",
      'Off-road sürüş kesinlikle yasak (ceza 500.000 ISK+, hapis).',
      'Alkol: 20 yaş; Vínbúðin devlet mağazası; sokakta içmek yasak.',
      'Drone: milli park ve popüler alanlarda yasak; 250 g üstü kayıt.',
    ]),
    droneRules:
      'Vatnajökull ve Þingvellir milli parkları yasak; Reykjavík merkez yasak; ISAVIA kaydı.',
    alcoholRules: '20 yaş; Vínbúðin saatleri kısıtlı; bar 24:00–04:00 hafta sonu.',
    money:
      "İzlanda Kronu — 1 ISK ≈ ₺0,34. Tamamen kartlı; nakit gerekmez; yakıt istasyonlarında PIN'li kart.",
    connectivity:
      'Síminn/Nova prepaid 2.000–3.000 ISK; AB eSIM (EEA) roaming. Yaylada (Highlands) sinyal yok; 112 Iceland uygulaması.',
    health: [
      'Musluk suyu dünyanın en temizi (sıcak su kükürt kokar, normal).',
      'Hipotermi ve rüzgâr.',
      'Jeotermal yanık.',
      'Sağlık pahalı; sigorta.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos'],
    bestMonths: [6, 7, 8, 9],
    dailyTips: [
      "safetravel.is'e plan bırak; 112 Iceland uygulaması.",
      'Bónus/Krónan süpermarket; kamp mutfağı.',
      'Ring Road 7–10 gün; F-yolları Temmuz–Ağustos açık.',
      'Yerel havuzlar (sundlaug) 1.000 ISK; Blue Lagoon 10.000 ISK.',
      'Kuzey ışıkları Eylül–Mart; yazın gece yarısı güneşi.',
    ],
    sources: schengenSources(
      'https://island.is/en/visa-to-iceland',
      'https://safetravel.is',
      'https://kopenhag.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'GB',
    name: 'Birleşik Krallık',
    region: 'Batı Avrupa',
    languages: ['en'],
    currency: 'GBP',
    tryRate: 58,
    timezone: 'UTC+0 / UTC+1 (yaz)',
    plugTypes: ['G'],
    visa: {
      type: 'embassy',
      maxStayDays: 180,
      costTry: 7000,
      processingDays: 15,
      url: 'https://www.gov.uk/standard-visitor',
      note: "Türk vatandaşları için Standard Visitor vize (≈ 127 £, 6 ay çok giriş); UK ETA yalnızca vizesiz ülkeler için, Türkiye'ye UYGULANMAZ. Çevrimiçi başvuru + TLScontact Ankara/İstanbul/İzmir biyometri; 3 hafta standart, öncelikli 5 gün ek ücret. İskoçya için ayrı vize yok. Resmî kaynağı kontrol et.",
    },
    documents: [
      passport(6, 'Kalış süresince geçerli olması yeterli.'),
      visaDoc("Vize vinyeti pasaportta (2025'ten itibaren eVisa geçişi — UKVI hesabı)."),
      insurance(
        'NHS acil ücretsiz ama yatış turistlere faturalanır; dağ kurtarma (MRT) gönüllü ve ücretsiz.',
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Kuyruk kutsal; "sorry", "please", "cheers" (teşekkür).',
      'Pub kültürü: barda sipariş, sırayla ısmarlama ("round"), bahşiş yok.',
      'Sol trafik; yaya geçidinde sağa bak.',
      'Kişisel alan ve dolaylı dil ("not bad" = iyi).',
      'İskoçya\'da "Scottish access rights" sorumlu erişim; kapıları kapat.',
      'Hava sohbeti; kraliyet hakkında nötr.',
    ],
    dressCode: "Rahat; İskoç Highlands'te her mevsim yağmurluk; Londra pub akıllı-gündelik.",
    religionNotes:
      "Anglikan/Presbiteryen, çok kültürlü; katedraller ücretli giriş bazen. Kuzey İrlanda'da mezhep konuları hassas.",
    photographyRules:
      'Kamusal alan serbest; askeri, Ulusal Güvenlik binaları; drone milli parklarda (Lake District arazi sahibine bağlı) ve Londra yasak.',
    tipping: 'Lokanta %10–12,5 (service charge eklenir), pub yok, taksi yuvarla, rehber 10 £/gün.',
    bargaining: 'Yok; pazarlar hariç.',
    watchOut: [
      'Londra: telefon kapkaç (elektrikli bisiklet), yankesicilik Oxford Street; telefonu yolda çıkarma.',
      'İskoç Highlands: hava 4 mevsim/gün; Ben Nevis kışın alpin, yazın sis navigasyonu; Mountain Weather Information Service.',
      'Midge (kum sineği) Haziran–Ağustos batı İskoçya; ağ ve Smidge.',
      'Sol trafik; yuvarlak kavşak; "M" otoyol.',
      'Bothy (ücretsiz kulübe) kuralları: küçük gruplar, temizlik, odun.',
      "Gelgit (Morecambe Bay, St Michael's Mount) hızlı; tablolara bak.",
      'Pub kapanış ("last orders") ve hafta sonu gece kavgaları.',
      'Bileti olmayan tren cezası; kontrol sıkı.',
    ],
    womenTravelers:
      'Güvenli; gece Londra\'da lisanslı taksi/Uber; "Ask for Angela" barlarda. Highlands yalnız kadın için rahat.',
    laws: [
      'Drone: CAA Operator ID + Flyer ID (250 g üstü); milli parklarda arazi sahibi izni; Londra yasak.',
      'Alkol: 18 yaş; sokakta içmek belediyeye göre yasak (PSPO); sürüşte İskoçya 0,5‰, İngiltere 0,8‰.',
      'Uyuşturucu: esrar dahil suç (B sınıfı), tolerans düşük.',
      'LGBTİ+: evlilik yasal, tam koruma.',
      "Vahşi kamp: İskoçya'da yasal (Land Reform Act, Loch Lomond bazı bölgeler izinli); İngiltere/Galler'de arazi sahibi izni (Dartmoor bazı alanlar); ateş yasak.",
      'Bıçak taşıma (7,5 cm üstü kilitli) suç; çakı ayarla.',
    ],
    droneRules:
      'CAA kayıt; Lake District, Snowdonia yerel kısıt; Londra ve havalimanları 5 km yasak.',
    alcoholRules: '18 yaş; pub 23:00; süpermarket lisanslı saat; İskoçya asgari birim fiyatı.',
    money:
      'Sterlin — 1 GBP ≈ ₺58. Tamamen kartlı/contactless (Oyster yerine kart); nakit nadir; ATM ücretsiz (Link).',
    connectivity:
      "giffgaff/EE/Vodafone prepaid 10–15 £ (AB roaming değil); eSIM Airalo. Highlands'te EE en iyi ama boşluklar; OS Maps çevrimdışı.",
    health: [
      'Musluk suyu içilebilir.',
      'Hipotermi Highlands.',
      'Kene (Lyme) İskoçya/Exmoor.',
      'NHS 111 danışma hattı ücretsiz.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos'],
    bestMonths: [5, 6, 7, 8, 9],
    dailyTips: [
      'Vize başvurusunu 6–8 hafta önce; TLScontact "Premium Lounge" ek ücret.',
      'Tren biletleri erken (Trainline) %70 indirim; "railcard".',
      'Meal deal (Tesco/Boots) 4 £; pub "pie" 12 £.',
      'İskoçya: Walkhighlands rota sitesi, bothy haritası (MBA).',
      'Ben Nevis Mountain Track 8 saat; CMD Arête için tecrübe.',
    ],
    sources: [
      'https://www.gov.uk/standard-visitor',
      'https://www.mwis.org.uk',
      MFA_URL,
      'https://londra.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'ES',
    name: 'İspanya',
    region: 'Güney Avrupa · Pireneler',
    languages: ['es', 'ca', 'eu', 'gl'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+1 / UTC+2 (yaz); Kanaryalar UTC+0',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'İspanya',
      'https://www.exteriores.gob.es/Consulados/estambul',
      'Schengen C vizesi; İspanya ana varış ise BLS International Ankara/İstanbul; ücret 90 € + hizmet; yaz için 3 ay önce. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3),
      visaDoc('Schengen etiketi.'),
      insurance(
        'Pireneler/Sierra Nevada; Guardia Civil GREIM kurtarma ücretsiz ama bazı özerk bölgeler (Katalonya, Aragon) fatura kesebiliyor; FEDME/FEEC federasyon kartı sigorta içerir.',
      ),
      permit(
        'refugio',
        'Refugio rezervasyonu (Ordesa, Aigüestortes, Picos)',
        'Yaz için Nisan; Ordesa Monte Perdido günlük araç kotası, Aigüestortes taksi 4x4.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      'Geç saatler: öğle 14:00, akşam 21:00; siesta 14–17 küçük şehirlerde dükkânlar kapalı.',
      'İki yanak öpücüğü; yüksek ses normal.',
      'Katalonya/Bask kimlikleri hassas; "İspanyol" demeden önce dinle.',
      'Tapas barında peçeteyi yere atmak bazı yerlerde normal.',
      "Refugio: guarda'ya saygı, çizme dışarı, yemek 19:30.",
      'Yolda "Hola/Buenos días"; Camino\'da "Buen Camino".',
    ],
    dressCode:
      'Rahat; kiliselerde omuz-diz; şehir merkezinde mayo yasak (ceza Barselona). Pireneler yazın fırtına.',
    religionNotes:
      'Katolik; Semana Santa (Paskalya) törenleri; katedrallerde giriş ücreti. Camino de Santiago hac kültürü (credencial).',
    photographyRules:
      'Serbest; polis/Guardia Civil çekmek yasal gri (Gag Law); drone milli parklarda yasak.',
    tipping: 'Beklenmez; yuvarla 1–2 €, %5–10 lokanta.',
    bargaining: 'Yok; El Rastro bit pazarı hariç.',
    watchOut: [
      "Barselona Las Ramblas/metro Avrupa'nın yankesicilik başkenti; telefon önde, sırt çantası önde.",
      'Plaj hırsızlığı ve gece tek başına Barceloneta.',
      'Pireneler öğleden sonra fırtına, yıldırım kayalık zirvelerde; Aneto buzulu kayması.',
      'Sıcak dalgası (45 °C) iç bölgeler; Sierra Nevada güneş.',
      'Kanaryalar: Teide zirve izni (ücretsiz, aylar önce dolar); volkanik hava.',
      "Kiralık araç camı kırma trailhead'lerde.",
      "Camino'da tahtakurusu (bed bug) albergue; çanta kontrolü.",
      'Boğa koşusu (Pamplona) yaralanmaları; alkolsüz katıl.',
    ],
    womenTravelers:
      'Güvenli; gece Barselona/Madrid merkez kalabalık. Camino yalnız kadın için çok uygun.',
    laws: schengenLaws([
      'Vahşi kamp: ulusal düzeyde yasak, özerk bölgelere göre; Pireneler\'de 2.000 m üstü "vivac" tolere (Aragón), Katalonya milli parkında yasak; ateş yasağı yaz.',
      'Esrar özel alanda tolere, kamuya açık alanda ceza.',
      'Şehir merkezinde mayo/üstsüz ceza (Barselona, Malaga).',
      'Teide zirve izni (Telesforo Bravo yolu) zorunlu.',
    ]),
    droneRules: 'AESA/EASA; milli parklar (Ordesa, Teide, Picos) yasak; şehir merkezi izin.',
    alcoholRules: '18 yaş; sokakta içmek (botellón) yasak, uygulanır; barlar 02:00+.',
    money:
      'Euro — 1 EUR ≈ ₺50. Kart yaygın; refugio ve küçük bar nakit; ATM ücretleri bankaya göre.',
    connectivity:
      "Movistar/Vodafone/Orange prepaid 10–15 €; AB eSIM. Pireneler'de Movistar; vadilerde boşluk.",
    health: [
      'Musluk suyu içilebilir.',
      'Yaz sıcakları; güneş.',
      'Kene ve "procesionaria" tırtılı (köpekler için).',
      'İrtifa: Teide 3.718 m, Aneto 3.404 m.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos'],
    bestMonths: [5, 6, 9, 10, 7, 8],
    dailyTips: [
      'BLS randevusu için sabah kontrol; ek "premium" hizmet.',
      'Menú del día 12–15 € öğlen; akşam tapas.',
      'Renfe AVE erken bilet; Ouigo/Iryo rekabet.',
      'Camino için credencial (hac pasaportu) 2 €; albergue 10–15 €.',
      "Ordesa Torla'dan otobüs zorunlu yaz; Picos Fuente Dé kabin.",
    ],
    sources: schengenSources(
      'https://www.exteriores.gob.es',
      'https://www.fedme.es',
      'https://madrid.be.mfa.gov.tr',
    ),
  }),

  guide({
    countryCode: 'GR',
    name: 'Yunanistan',
    region: 'Güney Avrupa · Balkanlar',
    languages: ['el', 'en'],
    currency: 'EUR',
    tryRate: 50,
    timezone: 'UTC+2 / UTC+3 (yaz)',
    plugTypes: ['C', 'F'],
    visa: schengenVisa(
      'Yunanistan',
      'https://www.mfa.gr/en/visas/',
      'Schengen C vizesi; ayrıca 12 Ege adası için "kapıda vize" (7 gün, Nisan–Ekim, ≈ 60 €): Lesvos, Chios, Samos, Kos, Rodos, Leros, Limnos, Kalymnos, Symi, Kastellorizo, Patmos ve Sakız — yalnızca Türkiye\'den feribotla, adadan anakaraya geçilemez. Resmî kaynağı kontrol et.',
    ),
    documents: [
      passport(3, 'Kapıda vize için de 6 ay geçerlilik ve boş sayfa.'),
      visaDoc(
        'Schengen etiketi ya da kapıda vize (ada) — feribot acentesi başvuruyu 1–2 gün önce alır.',
      ),
      insurance(
        'Olympos, Meteora, Kalymnos tırmanış; EKAV ambulans ücretsiz, helikopter kurtarma askeri/ücretsiz ama sınırlı.',
      ),
      permit(
        'refuge',
        'Olympos refuge rezervasyonu',
        'Spilios Agapitos (Refuge A) yaz için önceden; kışın rehber.',
        false,
      ),
      hotelBooking(),
      bankStatement(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      '"Kalimera/Yasas", Türkçe kelimeler (kefi, meze) ortak; Türk-Yunan ilişkisi genelde sıcak ama siyaset konuşma.',
      "Manastır ve kiliselerde omuz-diz kapalı; Meteora'da kadınlara etek verilir.",
      'Aynaroz (Athos) yalnızca erkek ve izinli.',
      'Yemek geç ve uzun; hesap paylaşılmaz, ev sahibi öder.',
      'Açık el ile "dur" işareti ("moutza") hakaret.',
      'Öğle dinlenmesi 15–17 sessizlik.',
    ],
    dressCode: 'Rahat; kiliselerde kapalı; adalar plaj; Olympos yazın bile zirve 5 °C.',
    religionNotes:
      "Ortodoks; Paskalya en büyük bayram; manastırlarda fotoğraf kısıtlı; Batı Trakya'da Müslüman Türk azınlık.",
    photographyRules:
      'Serbest; askeri (özellikle Ege adaları, Türk sınırı) yasak; müzelerde flaşsız; manastırda izin. Drone arkeolojik alanlarda yasak.',
    tipping: 'Yuvarla / %5–10.',
    bargaining: 'Yok; pazar hafif.',
    watchOut: [
      'Atina Monastiraki/Omonia yankesicilik; metro Havalimanı hattı.',
      'Orman yangınları yaz (Temmuz–Ağustos); ateş yasağı, tahliye SMS 112.',
      'Olympos Mytikas son tırmanış kaya düşmesi ve sis; kask.',
      'Sıcak dalgası 45 °C; Akropol öğle kapanır.',
      'Feribot iptalleri (rüzgâr "meltemi"); tampon gün.',
      'Kiralık motor/ATV kazaları adalarda; kask ve IDP (ehliyet kontrolü).',
      'Sokak köpek/kediler uysal; kırsalda çoban köpekleri.',
      'Bar hesabı tuzağı (Atina Syntagma çevresi, "Türk dostu" davetler).',
    ],
    womenTravelers: 'Güvenli; adalarda gece parti bölgeleri (Mykonos, Ios) dikkat.',
    laws: schengenLaws([
      "Vahşi kamp: yasak (uygulama gevşek, plaj ve arkeolojik alanlarda uygulanır, ceza 300 €); Olympos'ta refuge dışında yasak.",
      'Ateş yasağı 1 Mayıs–31 Ekim ormanda (ağır ceza).',
      'Arkeolojik eser/taş almak ağır suç; antik alanlarda yüksek topuk yasak.',
      'Kapıda vize adadan anakaraya geçişe izin vermez.',
    ]),
    droneRules: 'HCAA kaydı; arkeolojik alanlar, askeri bölgeler (adalar) ve Atina merkez yasak.',
    alcoholRules: '18 yaş; sokakta içmek serbest; ouzo/raki kültürü.',
    money:
      "Euro — 1 EUR ≈ ₺50. Kart yaygın (POS zorunlu); adalarda nakit; ATM ücretli (Euronet'ten kaçın).",
    connectivity: 'Cosmote en iyi kapsama (prepaid 10–15 €); AB eSIM. Olympos ve adalarda Cosmote.',
    health: [
      'Musluk suyu anakarada içilebilir, adalarda şişe.',
      'Sıcak ve güneş.',
      'Kene ve sivrisinek; Batı Nil virüsü yaz.',
      'Deniz kestanesi ve denizanası.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos'],
    bestMonths: [5, 6, 9, 10],
    dailyTips: [
      'Kapıda vize için feribot acentesine 2 gün önce pasaport kopyası.',
      'Olympos: Litochoro→Prionia→Refuge A→Mytikas; 2 gün.',
      'Gyros 4 €; taverna meze paylaşımlı.',
      'Feribot biletleri Ferryhopper; meltemi Ağustos.',
      'Meteora sabah erken; Kalymnos Ekim tırmanış festivali.',
    ],
    sources: schengenSources('https://www.mfa.gr/en/visas/', 'https://atina.be.mfa.gov.tr'),
  }),

  guide({
    countryCode: 'RU',
    name: 'Rusya',
    region: 'Doğu Avrupa · Kafkasya',
    languages: ['ru'],
    currency: 'RUB',
    tryRate: 0.5,
    timezone: 'UTC+2 … UTC+12',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 60,
      costTry: 0,
      processingDays: 0,
      url: 'https://evisa.kdmid.ru',
      note: 'Türk vatandaşları turistik amaçla 60 güne kadar vizesiz (180 günde toplam 90). Girişte göç kartı (migratsionnaya karta) verilir, kaybetme; 7 iş günü üstü konaklamada otel kaydı (registratsiya). Uçuşlar yalnızca Türk/Rus havayolları; yaptırımlar nedeniyle yabancı kartlar çalışmaz, nakit taşı. Bölgesel güvenlik durumu değişken — resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      permit(
        'migration_card',
        'Göç kartı + otel kaydı',
        'Girişte alınır, çıkışta istenir; 7 iş günü üstü kalışta kayıt.',
        true,
      ),
      insurance(
        "Elbrus (5.642 m) tırmanışı; MÇS (EMERCOM) kurtarma ücretsiz ama sigorta zorunlu; Rusya'da geçerli poliçe (yaptırım kapsamı dışı şirket).",
      ),
      permit(
        'elbrus',
        'Elbrus MÇS kaydı + sınır bölgesi izni',
        'Terskol MÇS ofisine tırmanış kaydı; Kuzey rotası ve bazı vadiler sınır izni (FSB) — acente 30–60 gün önce.',
        false,
      ),
      cashUsd(
        'Visa/Mastercard ÇALIŞMAZ; USD/EUR nakit ve ruble; Türk kartı (Troy/Mir) bazı yerlerde.',
      ),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Zdravstvuyte" (resmî), "privet"; gülümseme yabancılara az, kabalık değil.',
      'Evde ayakkabı çıkar, terlik verilir; çiçek tek sayı (çift cenaze).',
      'Votka ikramı: kadeh sonuna kadar, "za zdorovye"; reddetmek için sağlık bahanesi.',
      'Kiliselerde kadın başörtü, erkek şapkasız; el arkada bağlamak ayıp.',
      'Siyaset (Ukrayna, hükümet) konuşma; kamuya açık eleştiri suç.',
      'Banyada (hamam) veniki (huş dalı) ritüeli; çıplaklık normal.',
      "Kafkasya (Kabardey-Balkar) misafirperverliği ve muhafazakâr kuralları; Dağıstan'da kapalı giyim.",
    ],
    dressCode:
      "Moskova şık; kiliselerde kapalı; Kafkasya'da muhafazakâr (kadınlar omuz-diz); Elbrus -30 °C.",
    religionNotes:
      "Rus Ortodoks; Kafkasya'da Müslüman cumhuriyetler (Kabardey-Balkar, Dağıstan, Çeçenistan) — Ramazan, kapalı giyim, alkol azlığı. Kilise ziyareti başörtüsü.",
    photographyRules:
      "Askeri, sınır, altyapı (köprü, metro bazı yerler), havalimanı yasak; Kafkasya'da kontrol noktaları; polis çekmek sorun. Drone yasak bölgeler geniş; 2022 sonrası birçok bölgede tamamen yasak.",
    tipping:
      'Lokanta %10, taksi yok (Yandex), rehber günde 2.000–3.000 RUB, Elbrus rehberi/porter 3.000 RUB.',
    bargaining: 'Pazarda hafif; Yandex Go taksi sabit.',
    watchOut: [
      'Yaptırımlar: yabancı kart yok, Google Pay yok, uçuşlar sınırlı; nakit yönetimi.',
      'Sahte polis "pasaport kontrolü" metroda; kimlik iste, tanık.',
      'Elbrus: hava, buzul çatlakları (Kuzey), oksijen; snowcat (ratrak) ile yükseklik hızlı, AMS; Priyut 11 kalabalık.',
      'Kafkasya sınır izinleri; izinsiz vadiye girmek gözaltı.',
      'Siyasi tutuklama riski: sosyal medya paylaşımları, "yabancı ajan" yasaları; drone ve GPS cihazı beyanı.',
      'Trafik ve kış yol koşulları; taksi Yandex.',
      'Alkol zehirlenmesi (sahte votka); mağazadan al.',
      "Ukrayna sınırı bölgeleri ve Kırım'a gitme (Türkiye tanımıyor, uluslararası sonuçlar).",
    ],
    womenTravelers:
      "Şehirler güvenli; gece Yandex. Kafkasya cumhuriyetlerinde kapalı giyim ve erkek eşlik kültürü; Dağıstan'da yalnız kadın yadırganabilir.",
    laws: [
      'Drone: 150 g üstü kayıt, çoğu bölgede uçuş yasağı (2022 sonrası); Elbrus bölgesi yasak; izinsiz uçuş gözaltı.',
      'Alkol: 18 yaş; sokakta içmek yasak (uygulanır); 23:00 sonrası satış yok.',
      'Uyuşturucu: çok ağır; bazı ilaçlar (kodein, pregabalin) yasak — resmî kaynağı kontrol et.',
      'LGBTİ+: "propaganda" yasası ve 2023 "ekstremist" kararı; alenilik ve sembol (gökkuşağı) tehlikeli.',
      'Kamp: milli parklarda izinli; sınır bölgelerinde yasak; ateş yasağı yaz.',
      'Kayıt (registratsiya) 7 iş günü; ihlal para cezası ve sınır dışı.',
      'Ordu/hükümet eleştirisi suç; sosyal medya kontrolü.',
    ],
    droneRules: 'Fiilen yasak; taşımak bile riskli.',
    alcoholRules: '18 yaş; 23:00–08:00 satış yasak; Kafkasya cumhuriyetlerinde az.',
    money:
      'Ruble (RUB) — 1 RUB ≈ ₺0,5. Yabancı kart çalışmaz; nakit USD/EUR bozdur (banka), yerel Mir kartı açmak mümkün. Yandex Go/SBP yerel.',
    connectivity:
      "MTS/Beeline/Megafon SIM pasaport + biyometri (2025'ten beri yabancılar için zor: Gosuslugi kaydı gerekebilir); havalimanı standı. VPN gerekli (Instagram/Meta yasak); Elbrus vadisinde Megafon.",
    health: [
      "Musluk suyu Moskova/Petersburg'da kaynatılarak; şişe.",
      'Elbrus irtifa ve soğuk.',
      "Kene ensefaliti Sibirya/Ural; Kafkasya'da düşük.",
      'Hastane iyi; sigorta poliçesinin yaptırımdan etkilenmemesi.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A', 'Kene ensefaliti (Sibirya, isteğe bağlı)'],
    bestMonths: [6, 7, 8, 5, 9],
    dailyTips: [
      'Nakit planı: USD/EUR bozdur, günlük 3.000–5.000 RUB.',
      'Yandex Go, Yandex Maps, 2GIS; Telegram ana iletişim.',
      'Elbrus için Mineralnye Vody uçuşu → Terskol; acente izin işlerini halleder.',
      'Stolovaya (kantin) 300 RUB öğle; metro 60 RUB.',
      'Kayıt için oteli seç, hostel de yapar; "registratsiya" kâğıdını sakla.',
    ],
    sources: [
      'https://evisa.kdmid.ru',
      'https://www.mid.ru',
      MFA_URL,
      'https://moskova.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'KZ',
    name: 'Kazakistan',
    region: 'Orta Asya',
    languages: ['kk', 'ru'],
    currency: 'KZT',
    tryRate: 0.09,
    timezone: 'UTC+5',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 30,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.gov.kz/memleket/entities/mfa',
      note: 'Türk vatandaşları 30 gün vizesiz (180 günde 90); yeni tip kimlikle giriş mümkün. 30 günden uzun kalış için kayıt/uzatma. Sınır bölgesi (Çin sınırı, Khan Tengri) için izin.',
    },
    documents: [
      passport(6),
      insurance(
        'Tien Shan (Khan Tengri 7.010 m); kurtarma helikopteri ücretli (Kazakistan Dağcılık Federasyonu / acente).',
      ),
      permit(
        'border',
        'Sınır bölgesi izni (Khan Tengri, Kolsay-Kaindy Çin yakını)',
        'Acente üzerinden 30 gün; Kolsay için artık gerekmez — resmî kaynağı kontrol et.',
        false,
      ),
      permit(
        'park',
        'Milli park girişleri (Ile-Alatau, Kolsay)',
        'Kapıda nakit/QR; Kaspi yerel ödeme.',
        false,
      ),
      cashUsd(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Salemetsiz be" (Kazakça) / "Zdravstvuyte"; Türkçe ile kısmen anlaşılır, sevinç yaratır.',
      'Çay ikramı yarım bardak (saygı, sık doldurma için); reddetme.',
      'Beşbarmak sofrasında yaşlıya baş (koy başı) verilir; sağ el.',
      'Ayakkabı evde çıkar; misafire hediye.',
      'Yurt ziyaretinde eşiğe basma; sol tarafa otur.',
      'Siyaset ve Rusya konuları dikkatli.',
    ],
    dressCode: 'Almatı modern; kırsal muhafazakâr; dağda katman, yazın bile zirvede kar.',
    religionNotes:
      'Sünni Müslüman çoğunluk (ılımlı), Rus Ortodoks azınlık; camiler ve katedral ziyaretine açık; Ramazan gevşek.',
    photographyRules:
      'Askeri, sınır, hükümet binaları yasak; Baikonur izinli. Drone kayıt ve şehirde izin.',
    tipping: 'Lokanta %10 (eklenir), taksi yok, rehber 5.000–10.000 KZT/gün.',
    bargaining: "Yeşil Pazar'da hafif; Yandex Go taksi.",
    watchOut: [
      'Almatı gece güvenli; taksi Yandex; sahte polis nadir.',
      "Dağ: Ile-Alatau'da çığ (Şimbulak) ve ani hava; Tuyuk-Su buzulu.",
      'Yol: Almatı-Kolsay 5 saat, çukurlu; gece sürüş yok.',
      'İrtifa: Big Almaty Peak 3.680 m; Khan Tengri ciddi.',
      'Kene ensefaliti Mayıs–Haziran dağ eteklerinde (Ile-Alatau) — aşı önerilir.',
      'Kaspi olmadan bazı ödemeler zor; nakit taşı.',
      'Kış -30 °C Astana; yaz 40 °C güney.',
      'ATM skimming nadir; Halyk/Kaspi ATM.',
    ],
    womenTravelers: 'Güvenli; kırsalda geleneksel roller; yalnız kadın gezgin rahat.',
    laws: [
      'Drone: 250 g üstü kayıt (aviation.kz), şehir ve sınır yasak; milli parklarda izin.',
      'Alkol: 21 yaş; 23:00–08:00 satış yok; sokakta içmek yasak.',
      'Uyuşturucu: ağır ceza.',
      'LGBTİ+: yasal (1998), evlilik yok; 2025 "propaganda" yasası tartışması; alenilikten kaçın.',
      'Kamp: milli parklarda belirlenmiş alan; sınır bölgeleri izinli; ateş yasağı yaz.',
      'Kayıt: 30 gün üstü göç servisine bildirim (otel yapar).',
    ],
    droneRules: 'Kayıt ve şehir izinleri; Çin sınırı 25 km yasak.',
    alcoholRules: '21 yaş; gece satış yok; kımız (fermente kısrak sütü) hafif alkollü.',
    money:
      'Tenge (KZT) — 1 KZT ≈ ₺0,09. Kart yaygın Almatı/Astana; Kaspi QR her yerde (turist açamaz); kırsal nakit. Döviz büroları iyi kur.',
    connectivity:
      'Beeline/Kcell/Tele2 SIM pasaportla 5 dk (IMEI kaydı gerekli 30 gün üstü); 30 gün 30 GB ≈ 3.000 KZT. Dağlarda Beeline. eSIM Airalo.',
    health: [
      'Şişe suyu; Almatı musluk kaynatılarak.',
      'Kene ensefaliti (aşı önerilir).',
      'İrtifa Tien Shan.',
      'Kış aşırı soğuk.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A', 'Kene ensefaliti (önerilir)'],
    bestMonths: [5, 6, 7, 8, 9],
    dailyTips: [
      "Almatı'dan Şimbulak kabin 30 dk; Big Almaty Lake sınır bölgesi (pasaport).",
      'Yandex Go taksi; Almatı metro 100 KZT.',
      'Lagman/plov 2.000 KZT; Yeşil Pazar.',
      'Kolsay-Kaindy 2 gün; Charyn Kanyonu günübirlik.',
      'Kımız ve şubat (deve sütü) dene; mide alışkın değilse az.',
    ],
    sources: ['https://www.gov.kz/memleket/entities/mfa', MFA_URL, 'https://astana.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'KG',
    name: 'Kırgızistan',
    region: 'Orta Asya · Tien Shan',
    languages: ['ky', 'ru'],
    currency: 'KGS',
    tryRate: 0.52,
    timezone: 'UTC+6',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 30,
      costTry: 0,
      processingDays: 0,
      url: 'https://www.evisa.e-gov.kg',
      note: 'Türk vatandaşları 30 gün vizesiz (bazı kaynaklar 90 gün belirtir — resmî kaynağı kontrol et); uzun kalış için e-vize. Sınır bölgeleri (Pik Lenin tabanı, Inylchek, Khan Tengri) için sınır izni.',
    },
    documents: [
      passport(6),
      insurance(
        'Pik Lenin (7.134 m), Ala-Archa; kurtarma helikopteri yalnızca sigorta/peşin (Ak-Sai Travel); yüksek irtifa kapsamı.',
      ),
      permit(
        'border',
        'Sınır bölgesi izni (Pik Lenin, Inylchek, Ak-Suu)',
        'Acente 2–3 hafta; Osh/Bişkek; kontrol noktalarında pasaport.',
        false,
      ),
      permit('park', 'Ala-Archa park girişi', 'Kapıda nakit.', false),
      cashUsd(),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Salamatsyzby"; Türkçe ile karşılıklı anlaşma yüksek; Türk okulları bilinir.',
      'Yurt konukluğu: eşiğe basma, sağ elle çay, ev sahibi kadına saygı.',
      'Kımız ve beşbarmak ikramı; kesme şeker ve ekmek yere atılmaz.',
      'Yaşlıya "aksakal" saygısı; sofrada bata (dua) ellerle yüz sıvazlama.',
      'CBT (Community Based Tourism) ev pansiyonları; aile yaşamına saygı.',
      'At kültürü: ata sol taraftan bin, çobanın atı ödünç.',
    ],
    dressCode:
      'Bişkek rahat; kırsal muhafazakâr (omuz-diz); dağda katman; Songköl gece 0 °C yazın.',
    religionNotes:
      'Sünni Müslüman (ılımlı, şamanist izler); camiler açık; güneyde (Osh) daha dindar.',
    photographyRules:
      'Askeri, sınır, hükümet binaları yasak; yerli insanlar için izin (çoğu memnun). Drone kayıt; sınır bölgesi yasak.',
    tipping: 'Beklenmez; %5–10 lokanta; rehber/at sahibi 500–1.000 KGS/gün.',
    bargaining: 'Osh Bazaar ve taksi pazarlıklı; Yandex Go Bişkek.',
    watchOut: [
      'Bişkek gece kapkaç ve sahte polis "belge kontrolü"; kimlik iste, karakola git.',
      'Dağ: Ala-Archa çığ/kaya, Pik Lenin çatlak (2022 kazası) ve AMS; Ak-Sai kamp.',
      'Yol: Bişkek-Osh 12 saat; marşrutka/ortak taksi şoförleri hızlı; gece sürüş yok.',
      'Sınır bölgesi izinsiz girmek gözaltı; Tacikistan sınırı (Batken) çatışmalar.',
      'Çoban köpekleri yaylalarda saldırgan; at üstünde daha güvenli.',
      'Su: dere suyu hayvan otlağı yüzünden giardia; filtre.',
      'Kımız ishali; yavaş dene.',
      'Kene ensefaliti Mayıs–Haziran.',
    ],
    womenTravelers:
      'Genel olarak güvenli; kırsalda misafire saygı; "kız kaçırma" (ala kachuu) yerel sorun, turisti etkilemez ama kültürel konu. Yalnız kadın CBT ağıyla rahat.',
    laws: [
      'Drone: kayıt gerekli; sınır bölgeleri ve Bişkek merkez yasak.',
      'Alkol: 18 yaş; sokakta içmek yasak; kımız serbest.',
      'Uyuşturucu: ağır ceza; Chuy vadisinde yabani kenevir yakalanma riski.',
      'LGBTİ+: yasal ama 2023 "propaganda" yasası; alenilikten kaçın.',
      'Kamp: neredeyse her yerde serbest (yaylalar); milli parklarda ücret; sınır bölgesi izinli; ateş dikkatli.',
      'Kayıt: 60 gün üstü (otel/CBT yapar) — resmî kaynağı kontrol et.',
    ],
    droneRules: "Kayıt + sınır yasağı; Ala-Archa'da genelde tolere; Issyk-Kul kıyısı serbest.",
    alcoholRules: '18 yaş; votka kültürü kırsalda; Ramazan gevşek.',
    money:
      'Som (KGS) — 1 KGS ≈ ₺0,52. Bişkek/Osh ATM (Optima, Demir Bank — Türk bankası); kırsal nakit. USD bozdur; Kaspi/MBank yerel QR.',
    connectivity:
      'O!/Beeline/MegaCom SIM pasaportla; 30 gün 30 GB ≈ 500 KGS. MegaCom dağlarda daha iyi; yaylalarda yok. eSIM sınırlı.',
    health: [
      'Su filtre; giardia.',
      'İrtifa: Songköl 3.000 m, Pik Lenin.',
      'Kene ensefaliti aşı.',
      'Kuduz köpek.',
      'Sağlık altyapısı zayıf; Bişkek özel klinik.',
    ],
    vaccines: [
      'Rutin aşılar',
      'Tetanos',
      'Hepatit A',
      'Tifo',
      'Kene ensefaliti (önerilir)',
      'Kuduz (isteğe bağlı)',
    ],
    bestMonths: [6, 7, 8, 9],
    dailyTips: [
      'CBT Kyrgyzstan ofisleri her kasabada; at, yurt, rehber.',
      'Marşrutka Bişkek-Karakol 6 saat 500 KGS.',
      "Ala-Archa günübirlik Bişkek'ten 40 dk; Ratsek kulübesi 1 gece.",
      'Lagman/samsa 150 KGS; Osh Bazaar.',
      'Songköl yurt kampı Haziran–Eylül; gece yıldız.',
    ],
    sources: [
      'https://www.evisa.e-gov.kg',
      'https://cbtkyrgyzstan.kg',
      MFA_URL,
      'https://biskek.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'UZ',
    name: 'Özbekistan',
    region: 'Orta Asya · İpek Yolu',
    languages: ['uz', 'ru'],
    currency: 'UZS',
    tryRate: 0.0036,
    timezone: 'UTC+5',
    plugTypes: ['C', 'F'],
    visa: {
      type: 'visa_free',
      maxStayDays: 30,
      costTry: 0,
      processingDays: 0,
      url: 'https://e-visa.gov.uz',
      note: 'Türk vatandaşları 30 gün vizesiz; uzun kalış e-vize. Konaklama kaydı (otel "registration" fişleri) çıkışta istenebilir — her gece için sakla; kamp gecelerinde eksik kayıt sorun olabiliyor (uygulama gevşedi — resmî kaynağı kontrol et).',
    },
    documents: [
      passport(6),
      permit(
        'registration',
        'Otel kayıt fişleri (her gece)',
        'Emehmon sistemi; kamp/ev konaklamasında turist kendisi kayıt yaptırabilir.',
        false,
      ),
      insurance('Chimgan/Ugam-Chatkal dağları; kurtarma sınırlı.'),
      cashUsd('Döviz bozdurma bankalarda resmî kur; kara borsa gereksiz.'),
      returnTicket(),
      vaccineCard(),
    ],
    etiquette: [
      '"Assalomu alaykum" ve sağ el kalbe; Türkçe ile anlaşılır (Özbek Türkçesi).',
      'Ekmek (non) kutsal: ters çevrilmez, yere konmaz, ısırılıp bırakılmaz.',
      'Çay ikramı azar azar (saygı); "choyxona" kültürü.',
      'Evde ayakkabı; yaşlıya öncelik; kadınlarla tokalaşmayı bekle.',
      'Plov ikramı sofranın merkezi; sağ elle.',
      'Siyaset ve hükümet eleştirisi kamuda yapılmaz.',
    ],
    dressCode:
      'Taşkent modern; Buhara/Semerkant muhafazakâr (omuz-diz); camilerde başörtü; dağda pratik.',
    religionNotes:
      'Sünni Müslüman (Hanefi, laik devlet); camiler ve medreseler turistik; Ramazan gevşek; sufi türbeleri (Bahauddin Nakşibendi) saygı.',
    photographyRules:
      'Metro (artık serbest), askeri, sınır yasak; medrese içleri serbest; insanlara izin. Drone yasak (ithalat izinli, pratikte el konur).',
    tipping: 'Lokanta %10 eklenir; taksi yok; rehber 100.000–200.000 UZS/gün.',
    bargaining: 'Çarşı (Chorsu, Siyob) pazarlık; ipek/halı için uzun; Yandex Go taksi.',
    watchOut: [
      "Çok güvenli; sahte polis nadir; Chorsu'da yankesicilik.",
      'Taksi pazarlığı; Yandex Go Taşkent/Semerkant.',
      'Yaz sıcakları 45 °C; su ve şapka.',
      'Dağ: Chimgan çığ kış; yaz fırtına.',
      'Su: musluk içilmez; şişe.',
      'Kayıt fişleri; çıkışta nadiren sorulur.',
      'Drone gümrükte el konur.',
      'Tren biletleri (Afrosiyob) hızlı tükenir.',
    ],
    womenTravelers: 'Çok güvenli; muhafazakâr giyim kırsalda; yalnız kadın gezgin sık.',
    laws: [
      'Drone: ithalat ve kullanım izne bağlı (yasak seviyesinde); el koyma.',
      'Alkol: 20 yaş; sokakta içmek yasak; Ramazan gevşek.',
      'Uyuşturucu: ağır ceza; bazı ilaçlar (kodein, tramadol) yasak.',
      'LGBTİ+: erkekler arası ilişki suç (3 yıla kadar); kesinlikle gizlilik.',
      'Kamp: dağlarda serbest, kayıt eksikliği teknik sorun; ateş dikkatli.',
      'Din propagandası ve izinsiz dini toplantı suç.',
    ],
    droneRules: 'Yasak (izin pratikte yok); getirme.',
    alcoholRules: '20 yaş; votka ve şarap (Semerkant) mevcut; sokakta içmek yasak.',
    money:
      'Som (UZS) — 1 UZS ≈ ₺0,0036; 100.000 UZS ≈ ₺360. ATM yaygınlaştı (Visa/MC); kart otel/lokanta; çarşı nakit. Banka döviz.',
    connectivity:
      'Ucell/Beeline/Mobiuz SIM pasaportla (kayıt zorunlu); 30 gün 20 GB ≈ 60.000 UZS. Dağlarda kısıtlı. eSIM Airalo.',
    health: [
      'Şişe suyu.',
      'Yaz sıcakları.',
      'Hepatit A yaygın.',
      'Sağlık altyapısı orta; Taşkent özel klinik.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A', 'Tifo'],
    bestMonths: [4, 5, 9, 10],
    dailyTips: [
      'Afrosiyob treni Taşkent-Semerkant 2 saat; bilet 2 hafta önce.',
      'Plov öğlen (Besh Qozon Taşkent); akşam satılmaz.',
      'Chorsu Bazaar sabah; Semerkant Siyob.',
      "Chimgan/Beldersay Taşkent'ten 1,5 saat; kabin.",
      'Yandex Go taksi; Taşkent metro 1.700 UZS (istasyonlar fotoğraflık).',
    ],
    sources: ['https://e-visa.gov.uz', MFA_URL, 'https://taskent.be.mfa.gov.tr'],
  }),

  guide({
    countryCode: 'AE',
    name: 'Birleşik Arap Emirlikleri',
    region: 'Orta Doğu · Körfez',
    languages: ['ar', 'en'],
    currency: 'AED',
    tryRate: 12.3,
    timezone: 'UTC+4',
    plugTypes: ['G'],
    visa: {
      type: 'on_arrival',
      maxStayDays: 30,
      costTry: 0,
      processingDays: 0,
      url: 'https://u.ae/en/information-and-services/visa-and-emirates-id/do-you-need-an-entry-permit-or-a-visa-to-enter-the-uae',
      note: "Türk vatandaşları için varışta 30 gün vize (ücretsiz, uzatılabilir) uygulaması 2024'ten beri; önceki dönemde havayolu/otel üzerinden ön vize gerekiyordu. Kurallar değişebilir — resmî kaynağı (GDRFA/ICP) kontrol et. Pasaport 6 ay.",
    },
    documents: [
      passport(6),
      visaDoc(
        "Varışta damga; havayolu check-in'de kural farklı yorumlanabilir — GDRFA sayfası çıktısı.",
        false,
      ),
      insurance('Jebel Jais, Hatta; sağlık masrafları çok yüksek.'),
      hotelBooking(),
      idp(),
      returnTicket(true),
    ],
    etiquette: [
      '"Assalamu alaikum"; sağ el; karşı cinsle tokalaşmayı bekle.',
      'Kamusal alanda sevgi gösterisi (öpüşme) yasa dışı; el ele tutuşmak evlilere.',
      "Ramazan'da gündüz açıkta yeme/içme (2021'den beri gevşedi ama saygı).",
      'Küfür, el hareketi ve yüksek ses (özellikle yerlilere) suç sayılabilir.',
      'Cami ziyareti (Şeyh Zayed): kapalı giyim, abaya verilir.',
      'Fotoğrafta yerli kadınları çekme.',
    ],
    dressCode:
      'AVM ve kamuda omuz-diz kapalı (uygulama gevşek Dubai); plaj/otelde mayo; cami abaya. Dağda yazın 45 °C.',
    religionNotes:
      'İslam devlet dini, çok uluslu nüfus; Cuma öğle namazı; Ramazan saatleri; alkol lisanslı mekân.',
    photographyRules:
      'Hükümet, askeri, havalimanı, saray yasak; insanları izinsiz çekmek suç (siber yasa); drone kayıt zorunlu ve çoğu yer yasak.',
    tipping: 'Lokanta %10–15 (servis eklenir), taksi yuvarla, valet 10 AED, rehber 50–100 AED.',
    bargaining: 'Souk (altın, baharat) pazarlık; AVM yok; Careem/Uber taksi.',
    watchOut: [
      'Siber yasalar: sosyal medyada şikâyet/görsel paylaşımı suç; kavgayı kaydetme.',
      'Alkolle sokakta bulunmak, sarhoşluk suç; lisanslı mekân dışı içme.',
      'Yaz ısı 48 °C; öğlen dışarı çıkma, Jebel Jais sabah 5.',
      'Sürüş agresif; hız kameraları; kaza sonrası yerinden ayrılma.',
      'Borç/çek sorunları hapse yol açar (kart limiti aşımı bile).',
      'Çöl safarisinde araç kazaları; lisanslı operatör.',
      'İlaçlar: kodein, tramadol, bazı antidepresanlar yasak — reçete ve liste (MOHAP).',
      "Dating uygulamaları ve evlilik dışı birlikte kalma 2022'den beri suç değil ama alenilik kısıtlı.",
    ],
    womenTravelers:
      'Çok güvenli; taksi "Ladies taxi" (pembe); metro kadın vagonu. Yalnız kadın gezgin sık.',
    laws: [
      'Drone: GCAA/DCAA kaydı zorunlu; Dubai neredeyse tamamen "no-fly"; turist için uygun değil.',
      'Alkol: 21 yaş; yalnızca lisanslı otel/bar ve MMI/African+Eastern mağazaları (turist lisansı ücretsiz); Şarja tamamen yasak.',
      'Uyuşturucu: sıfır tolerans, kanda izi bile suç; ölüm cezası kanunda.',
      'LGBTİ+: eşcinsel ilişki suç; alenilik yok.',
      'Kamp: çölde ve plajlarda belirlenmiş alanlar (Fujairah, RAK); wadi kampı yağmurda sel.',
      'Küfür, orta parmak, sahte haber paylaşımı, VoIP kullanımı (WhatsApp arama engelli) yasa dışı olabilir.',
    ],
    droneRules: 'Dubai ve Abu Dabi merkez tam yasak; kayıt ve izin; getirme.',
    alcoholRules: "21 yaş; lisanslı yerler; Ramazan'da kısıtlı saatler; Şarja yasak.",
    money: 'Dirhem (AED) — 1 AED ≈ ₺12,3. Kart her yerde; nakit souk; ATM ücretleri.',
    connectivity:
      'du/Etisalat turist SIM havalimanında (ücretsiz 1 GB teklifleri); 30 gün 10 GB ≈ 100 AED. VoIP (WhatsApp arama) engelli — BOTIM lisanslı. eSIM.',
    health: [
      'Musluk suyu tuzdan arındırılmış, içilebilir ama şişe yaygın.',
      'Isı çarpması; nem.',
      'Sağlık masrafı çok yüksek.',
      'MERS nadir; deve teması.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A/B (isteğe bağlı)'],
    bestMonths: [11, 12, 1, 2, 3],
    dailyTips: [
      "GDRFA vize sayfasını uçuştan önce kontrol; havayolu check-in'de itiraz için çıktı.",
      'Nol kartı metro/otobüs; Careem taksi.',
      "Jebel Jais zipline ve Hajar dağları RAK'tan 1 saat; kış.",
      'Hatta Wadi Hub kayak/kamp; Fujairah dalış.',
      'Cuma sabahı sessiz; hafta sonu Cumartesi-Pazar (2022 değişikliği).',
    ],
    sources: [
      'https://u.ae/en/information-and-services/visa-and-emirates-id',
      'https://gdrfad.gov.ae',
      MFA_URL,
      'https://abudabi.be.mfa.gov.tr',
    ],
  }),

  guide({
    countryCode: 'OM',
    name: 'Umman',
    region: 'Orta Doğu · Körfez',
    languages: ['ar', 'en'],
    currency: 'OMR',
    tryRate: 117,
    timezone: 'UTC+4',
    plugTypes: ['G'],
    visa: {
      type: 'visa_free',
      maxStayDays: 14,
      costTry: 0,
      processingDays: 0,
      url: 'https://evisa.rop.gov.om',
      note: 'Türk vatandaşları 14 gün vizesiz (2020 kararı); daha uzun kalış için e-vize (26A turist: 10 gün 5 OMR, 26B 30 gün 20 OMR) evisa.rop.gov.om. Otel rezervasyonu, dönüş bileti ve sigorta istenebilir. Resmî kaynağı kontrol et.',
    },
    documents: [
      passport(6),
      visaDoc('14 gün üstü için e-vize onayı.', false),
      insurance(
        "Jebel Shams, Wadi kanyonları; Umman'da kurtarma (PACDA) ücretsiz ama helikopter sınırlı; sağlık pahalı.",
      ),
      idp(),
      hotelBooking(),
      returnTicket(true),
    ],
    etiquette: [
      '"Salam aleykum" ve kahve (kahwa) + hurma ikramı; fincanı sallayarak yeter de.',
      'Muhafazakâr ama çok misafirperver; Umman kültürü sakin ve nazik.',
      'Kadınlar kapalı giyim (omuz-diz, bol); erkekler şort AVM dışında.',
      'Cami ziyareti (Sultan Qaboos) sabah 8–11, abaya/başörtü.',
      'Kamusal sevgi gösterisi yok; Ramazan gündüz yeme yok.',
      'Sultan ve hükümet eleştirisi yapma.',
    ],
    dressCode:
      "Kapalı ve hafif (keten); wadi'de yüzerken tişört-şort (yerel hassasiyet); Jebel Shams kışın 0 °C.",
    religionNotes:
      'İbadi İslam (ılımlı), Sünni/Şii azınlık; camiler Cuma hariç sabah ziyaret; Ramazan saygı; alkol az.',
    photographyRules:
      'Askeri, saray, havalimanı yasak; insanları (özellikle kadın) çekme; drone izinle (PACA) — turist için zor.',
    tipping: 'Lokanta %10 eklenir; taksi yok; rehber 5–10 OMR/gün.',
    bargaining: 'Mutrah Souk pazarlık; OTaxi/Careem Muscat.',
    watchOut: [
      'Çok güvenli; suç çok düşük.',
      'Wadi (kanyon) ani sel: yağmur haberinde girme; Wadi Shab/Bani Khalid.',
      'Sürüş: deve/keçi geçişi, kum; 4x4 gerektiren yollar (Jebel Shams, Jebel Akhdar kontrol noktası yalnızca 4x4).',
      'Isı: Nisan–Ekim 45 °C; kanyon yürüyüşü sabah.',
      'Kamp: gelgit ve akrep; wadi tabanına çadır kurma.',
      'Sadece nakit çoğu küçük yerde; ATM Muscat.',
      'Müsandem (Hürmüz) sınırı ve Yemen sınırı (Dhofar) kısıtlı bölge.',
      'Dalış ve kaplumbağa (Ras al Jinz) turları lisanslı.',
    ],
    womenTravelers:
      'Çok güvenli; muhafazakâr giyim; kadın gezginlere saygı; yalnız kamp yapanlar var.',
    laws: [
      'Drone: PACA izni zorunlu, turist için verilmez; gümrükte el konur.',
      'Alkol: 21 yaş; yalnızca lisanslı otel/bar; sokakta ve arabada yasak.',
      'Uyuşturucu: ağır ceza.',
      'LGBTİ+: eşcinsel ilişki suç; alenilik yok.',
      "Kamp: neredeyse her yerde serbest (plaj, wadi, dağ) — Umman'ın en büyük avantajı; kaplumbağa plajları ve askeri alan hariç; ateş yakma dikkat.",
      'İlaç yasakları (UAE benzeri); reçete.',
    ],
    droneRules: 'Yasak seviyesinde; getirme.',
    alcoholRules: "21 yaş; otel barları; Ramazan'da kapalı; kamp alanında gizli bile riskli.",
    money:
      'Umman Riyali (OMR) — 1 OMR ≈ ₺117; 1 OMR = 1.000 baisa. ATM Muscat/Nizwa/Salalah; kart otel; nakit kırsal ve benzin.',
    connectivity:
      "Omantel en iyi kapsama (turist SIM havalimanı 5 OMR/10 GB); Ooredoo. Dağ ve wadi'de boşluk. eSIM Airalo.",
    health: [
      'Musluk suyu tuzdan arındırılmış; şişe yaygın.',
      'Isı çarpması.',
      'Akrep/yılan çölde nadir.',
      'Sağlık masrafı yüksek; Muscat hastaneleri iyi.',
    ],
    vaccines: ['Rutin aşılar', 'Tetanos', 'Hepatit A/B (isteğe bağlı)'],
    bestMonths: [11, 12, 1, 2, 3],
    dailyTips: [
      '4x4 kirala; Jebel Akhdar kontrol noktası 4x4 şart.',
      "Kamp ekipmanı Muscat'ta (Lulu/Carrefour) ucuz; plajda serbest kamp.",
      'Wadi Shab sabah 8; tekne 1 OMR; yüzme tişörtle.',
      'Nizwa Cuma keçi pazarı sabah 7.',
      'Salalah Haziran–Eylül "khareef" yeşil mevsim (muson).',
    ],
    sources: ['https://evisa.rop.gov.om', MFA_URL, 'https://maskat.be.mfa.gov.tr'],
  }),
];

/* ------------------------------------------------------------------ */
/* Kullanıcının kontrol listeleri                                      */
/* ------------------------------------------------------------------ */

export const seedCountryChecklists: CountryChecklist[] = [
  {
    userId: CURRENT_USER_ID,
    countryCode: 'NP',
    done: ['passport', 'insurance', 'photos'],
    tripDate: new Date(NOW_MS + 45 * DAY_MS).toISOString(),
    updatedAt: new Date(NOW_MS - 2 * DAY_MS).toISOString(),
  },
  {
    userId: CURRENT_USER_ID,
    countryCode: 'TZ',
    done: [],
    tripDate: null,
    updatedAt: new Date(NOW_MS - 10 * DAY_MS).toISOString(),
  },
];
