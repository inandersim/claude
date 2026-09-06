/**
 * Zirtan marka sesi, ürün gerçekleri, yasak ifadeler ve yasal notlar.
 * Tüm ajanlar (plan / generate / reply / analyze / post) bu dosyayı sistem
 * istemine gömer; `post` komutu yayın öncesi `checkBrandCompliance` ile denetler.
 */

export type Lang = 'tr' | 'en' | 'ru';

export const LANGS: readonly Lang[] = ['tr', 'en', 'ru'];

export const BRAND = {
  name: 'Zirtan',
  handle: '@zirtanapp',
  site: 'https://zirtan.app',
  tagline: {
    tr: 'Doğayı birlikte keşfet.',
    en: 'Explore the outdoors, together.',
    ru: 'Открывай природу вместе.',
  } satisfies Record<Lang, string>,
  oneLiner: {
    tr: 'Outdoor macera sosyal ağı: yakınındaki doğrulanmış maceraperestlerle ZMatch ile eşleş, topluluk tehlike haritasına bak, dağdan canlı yayın aç, ülkeye göre SOS ve çevrimdışı ilk yardım rehberiyle daha güvenli çık.',
    en: 'The outdoor adventure social network: match with verified adventurers nearby (ZMatch), check the community hazard map, go live from the mountain, and head out safer with country-aware SOS and offline first-aid guides.',
    ru: 'Соцсеть для outdoor-приключений: ZMatch подбирает проверенных попутчиков рядом, карта опасностей от сообщества, прямые эфиры с гор, SOS с учётом страны и офлайн-гид по первой помощи.',
  } satisfies Record<Lang, string>,
} as const;

/** Marka sesi — her istemde aynen kullanılır. */
export const VOICE = {
  principles: [
    'Samimi ama ciddi: dağda şaka yapılır, güvenlikte yapılmaz.',
    'Deneyimli arkadaş tonu; öğretmen değil, rehber. "Sen" dili.',
    'Somut ve yerel: rota adı, mevsim, irtifa, saat. Genel geçer motivasyon cümleleri yok.',
    'Topluluk önce: kullanıcı içeriğini (UGC) öne çıkar, uygulamayı ikinci planda tut.',
    'Kısa cümleler. Emoji seyrek (gönderi başına en fazla 2), asla güvenlik uyarısında emoji.',
    'Rakiplerin adını kötülemek yok; farkı özellikle anlat.',
    'Her dilde o dilin outdoor jargonunu kullan (TR: patika, zirve tırmanışı; EN: trailhead, scramble; RU: маршрут, восхождение).',
  ],
  /** Dil bazlı hitap ve ton notu. */
  toneByLang: {
    tr: 'Sen dili, rahat; İstanbul Türkçesi, argo yok. Yerel isimleri doğru yaz (Kaçkar, Aladağlar, Likya Yolu).',
    en: 'Casual, second person, no corporate speak. Spell Turkish place names with diacritics where common (Kaçkar, Ağrı).',
    ru: 'На «ты», дружелюбно, без канцелярита. Названия турецких мест — принятые в русскоязычном сообществе (Качкар, Ликийская тропа, Каппадокия).',
  } satisfies Record<Lang, string>,
} as const;

/**
 * Yasak / kaçınılacak ifadeler. Güvenlik ürününde abartı yasal ve etik risktir.
 * `pattern` büyük/küçük harf duyarsız regex kaynağıdır.
 */
export const FORBIDDEN_PHRASES: readonly { pattern: string; reason: string }[] = [
  { pattern: 'asla kaybolmaz', reason: 'Mutlak güvenlik vaadi' },
  { pattern: 'hiç(bir zaman)? kaybolmaz', reason: 'Mutlak güvenlik vaadi' },
  { pattern: '%\\s?100 güven', reason: 'Mutlak güvenlik vaadi' },
  {
    pattern: 'kurtarma garantisi',
    reason: 'SOS bir bildirim aracıdır, kurtarma garantisi değildir',
  },
  { pattern: 'hayat(ını|ınızı) kurtarır', reason: 'Tıbbi/güvenlik sonucu vaadi' },
  { pattern: 'ilk yardım(a)? gerek kalmaz', reason: 'Tıbbi tavsiye yerine geçme iddiası' },
  { pattern: 'never get lost', reason: 'Absolute safety claim' },
  { pattern: '100% safe', reason: 'Absolute safety claim' },
  { pattern: 'guaranteed rescue', reason: 'SOS is a notification tool, not a rescue guarantee' },
  { pattern: 'saves? your life', reason: 'Medical/safety outcome claim' },
  { pattern: 'replaces? (a )?(doctor|first aid training)', reason: 'Medical advice substitution' },
  { pattern: 'никогда не потеря', reason: 'Абсолютное обещание безопасности' },
  { pattern: '100% безопас', reason: 'Абсолютное обещание безопасности' },
  { pattern: 'гарантия спасения', reason: 'SOS не гарантирует спасение' },
  { pattern: 'en iyi outdoor uygulaması', reason: 'Kanıtsız üstünlük iddiası' },
  { pattern: '#1 outdoor app', reason: 'Unproven superiority claim' },
  { pattern: 'alltrails.*(çöp|kötü|berbat|sucks|trash)', reason: 'Rakip karalama' },
  { pattern: 'strava.*(çöp|kötü|berbat|sucks|trash)', reason: 'Rakip karalama' },
];

/**
 * Ürün gerçekleri — README'deki özellik listesinden. Ajanlar bu listede olmayan
 * bir özelliği tanıtamaz ("olmayan özelliği vadetme" kuralı).
 */
export const PRODUCT_FACTS: readonly string[] = [
  'ZMatch: konuma göre yakındaki doğrulanmış maceraperestler; mesafe ve tür filtresi; eşleşme isteği, kabul edilen planlar, birebir mesajlaşma.',
  'Topluluk tehlike haritası: kaya düşmesi, çığ, sel, vahşi hayvan, şiddetli hava, bozuk patika, kapalı bölge; şiddet, yarıçap, geçerlilik; radar görünümü; "Ben de gördüm" onayı; yakındakilere otomatik uyarı.',
  'Canlı yayın: canlı ve tekrar yayınlar, izleyici sayısı, sohbet, beğeni; drone yayını (DJI RTMP) ve irtifa/hız/pil telemetrisi Pro Guide/Business planında.',
  'İlk yardım & SOS: basılı tutmalı SOS (112 arama + acil kişilere konum + canlı konum), en yakın hastane/ambulans/dağ kurtarma/eczane, 12 çevrimdışı ilk yardım rehberi (CPR, kanama, kırık, hipotermi, sıcak çarpması, irtifa hastalığı, yılan ısırması, anafilaksi, boğulma, yanık, yıldırım, çığ).',
  'Ülkeye göre acil numaralar ve en yakın kurtarma merkezi (domain/emergency); uydu cihaz eşleştirme (Garmin inReach, ZOLEO, SPOT, telefon uydu, Starlink Mini) ve SOS aşama makinesi (gerçek iletim için cihaz/servis gerekir).',
  'Canlı konum paylaşımı: takipçiler / eşleşmeler / SOS modunda süreli paylaşım; pil, irtifa, hız telemetrisi.',
  'Anlar: 24 saat sonra kaybolan macera anları.',
  'Kütüphane: dünya outdoor lokasyonları (kamp, tırmanış, dalış, yürüyüş rotası, rafting, yamaç paraşütü, kayak, zirve, mağara, dağ evi); OpenStreetMap / Wikidata / Wikimedia Commons açık verisi, lisans atıflı.',
  'Çevrimdışı haritalar ve rota motoru: PMTiles paketleri, A* rota planlama (yürüyüş, patika koşusu, MTB, gravel, kayak turu), Tobler süre modeli, yükseklik profili, GPX içe/dışa aktarma. Demo graflar: Kaçkar, Likya Yolu, Kapadokya, Aladağlar.',
  'Tırmanış veritabanı: Geyikbayırı, Olympos, Ballıkayalar, Kazıklıali, Datça, Kapadokya boulder, Karakaya, Kalymnos, Fontainebleau, Yosemite; derece dönüşümü (Fransız/YDS/UIAA/Font/V); logbook ve derece piramidi; topluluk doğrulama (3 onay).',
  'Market: ekipman al / sat / kirala; kategori, durum, favoriler; güvenli alışveriş uyarısı.',
  'Konaklama & işletmeler: otel, pansiyon, kamp alanı, glamping, kiralama, tur operatörü, dalış merkezi; rezervasyon ve emanet (escrow) ödeme akışı.',
  'Eğitmenler ve rehberler: sertifikalı profiller, ders talebi/rezervasyon; Pro Guide planı ile ücretli rezervasyon ve %5 komisyon.',
  'Üniversite kulüpleri: doğa sporları kulüpleri dizini (ODTÜ, Boğaziçi, İTÜ, Hacettepe, Ege, Bilkent, KTÜ, Akdeniz, Sabancı, Ankara, Dokuz Eylül, YTÜ, ETH Zürich, Edinburgh), etkinlik & RSVP, .edu e-postayla öğrenci doğrulama, kulüp sıralaması.',
  'Oyunlaştırma: XP/seviye, 20 rozet, haftalık/aylık görevler, liderlik tablosu, günün outdoor yarışması, macera ruleti, zirve pasaportu, seri.',
  'Zirtan AI: gezi planı, yer önerisi, güvenlik özeti, paketleme listesi, ilk yardım adımları (çevrimdışı yerel bilgi tabanı + isteğe bağlı Claude API tabanlı sunucu).',
  'Planlar: Kâşif (ücretsiz), Pro ₺149/ay, Pro Guide ₺399/ay, Business ₺799/ay.',
  'Diller: Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, İtalyanca, Japonca, Portekizce, Rusça.',
  'Platform: iOS ve Android (Expo). Mevcut sürüm demo veri ile çalışır; gerçek backend v1.3 yol haritasında — "milyonlarca kullanıcı" gibi sayılar verme.',
];

/** Özellikler için asla söylenmeyecekler (ürün gerçeğiyle çelişir). */
export const NOT_YET: readonly string[] = [
  'Gerçek uydu SOS iletimi (Garmin/Zoleo API köprüsü v1.4)',
  'Giyilebilir cihaz senkronu (v1.4)',
  'Resmî çığ / hava bülteni entegrasyonu (v1.4)',
  'Gerçek zamanlı video iletimi (LiveKit/Mux v1.3) — canlı yayın "ürün katmanı" hazır',
  'Uygulama içi ödeme (RevenueCat / iyzico v1.3)',
];

/** Yasal ve etik notlar; UGC paylaşımı ve fotoğraf izinleri. */
export const LEGAL_NOTES: readonly string[] = [
  'UGC yeniden paylaşımı: içerik sahibinden yazılı izin (DM ekran görüntüsü saklanır), açıklamada @etiket ile atıf, "izinle paylaşıldı" ibaresi.',
  'Fotoğraf/video izinleri: tanınabilir kişiler için sözlü/yazılı onay; çocuklar için veli onayı; korunan alanlarda (millî park, askerî bölge) çekim kurallarına uy.',
  'Drone: SHGM kuralları ve millî park yasakları; izinsiz drone görüntüsü paylaşma. Drone yayını için pilot sertifikası/izin hatırlatması ekle.',
  'Konum paylaşımı: hassas türlerin (yuva, mağara) ve özel mülkün kesin koordinatını paylaşma.',
  'Sağlık/ilk yardım: içerik eğitim amaçlıdır, profesyonel yardımın yerine geçmez; 112 / yerel acil numarayı her güvenlik gönderisinde belirt.',
  'KVKK/GDPR: kullanıcı verisi, ekran görüntüsünde isim/konum maskele; DM içeriklerini paylaşma.',
  'Reklam: sponsorlu iş birliği varsa #işbirliği / #reklam (TR mevzuatı) ve #ad (EN) etiketi; Rusça #реклама.',
  'Açık veri atfı: harita/kütüphane ekran görüntülerinde "© OpenStreetMap katkıcıları" ve Commons fotoğraflarında yazar/lisans satırı.',
];

/** Hedef kitleler — plan/generate istemlerine girer. */
export const AUDIENCES: readonly { id: string; label: string; painPoint: string; hook: string }[] =
  [
    {
      id: 'uni-clubs',
      label: 'Üniversite doğa sporları kulüpleri',
      painPoint:
        'Etkinlik duyurusu WhatsApp/Instagram dağınık; yeni üye bulma ve deneyim eşleştirme zor.',
      hook: 'Kulüp etkinliği + RSVP + öğrenci doğrulama + kulüp liderlik tablosu.',
    },
    {
      id: 'camping',
      label: 'Kamp toplulukları',
      painPoint:
        'Kamp alanı bilgisi Facebook gruplarında kaybolur; güvenli alan/hava/tehlike bilgisi yok.',
      hook: 'Açık veriyle beslenen kütüphane + topluluk tehlike haritası + canlı konum.',
    },
    {
      id: 'diving',
      label: 'Dalış okulları ve dalgıçlar',
      painPoint: 'Buddy bulmak ve dalış merkezi rezervasyonu ayrı ayrı uygulamalarda.',
      hook: 'ZMatch ile buddy, dalış merkezi profili ve rezervasyon, dalış noktası kütüphanesi.',
    },
    {
      id: 'guides',
      label: 'Rehberler ve eğitmenler',
      painPoint: 'Müşteri bulmak için Instagram DM; ödeme ve takvim elle.',
      hook: 'Pro Guide: rezervasyon, %5 komisyon, öne çıkan profil, drone yayını.',
    },
    {
      id: 'ru-speakers',
      label: 'Rusça konuşan gezginler (Kafkasya, Kırgızistan, Türkiye tatilcileri)',
      painPoint: 'Türkiye rotaları için Rusça güvenilir bilgi az; yerel partner bulmak zor.',
      hook: 'Rusça arayüz, Likya Yolu / Kapadokya / Kaçkar rehberleri, ülkeye göre SOS.',
    },
    {
      id: 'solo-hikers',
      label: 'Tek başına yürüyen / güvenlik odaklı kullanıcılar',
      painPoint: 'Yalnız çıkmak korkutucu; kime haber vereceğini bilmiyor.',
      hook: 'Canlı konum + SOS + ilk yardım rehberi + tehlike haritası.',
    },
  ];

/** Kanal-bağımsız hashtag setleri. Kanal biçimlendiricileri sayı sınırını uygular. */
export const HASHTAGS: Record<Lang, { core: string[]; niche: string[]; local: string[] }> = {
  tr: {
    core: ['#zirve', '#zirtanapp', '#doğa', '#outdoor', '#kamp', '#trekking', '#dağcılık'],
    niche: [
      '#tırmanış',
      '#dalış',
      '#yamaçparaşütü',
      '#bisiklet',
      '#kayak',
      '#patikakoşusu',
      '#doğayürüyüşü',
      '#kampçılık',
      '#solotrekking',
    ],
    local: [
      '#kaçkar',
      '#likyayolu',
      '#kapadokya',
      '#aladağlar',
      '#ağrıdağı',
      '#geyikbayırı',
      '#olimpos',
      '#karadeniz',
      '#uludağ',
      '#erciyes',
    ],
  },
  en: {
    core: ['#zirtanapp', '#hiking', '#outdoors', '#camping', '#trekking', '#adventure'],
    niche: [
      '#climbing',
      '#scubadiving',
      '#paragliding',
      '#trailrunning',
      '#backpacking',
      '#solohiking',
      '#mountaineering',
      '#bikepacking',
    ],
    local: [
      '#turkey',
      '#lycianway',
      '#cappadocia',
      '#kackar',
      '#mountararat',
      '#geyikbayiri',
      '#kalymnos',
      '#caucasus',
    ],
  },
  ru: {
    core: ['#zirtanapp', '#поход', '#горы', '#треккинг', '#кемпинг', '#туризм'],
    niche: ['#скалолазание', '#дайвинг', '#параплан', '#трейлраннинг', '#соловпоход', '#альпинизм'],
    local: [
      '#турция',
      '#ликийскаятропа',
      '#каппадокия',
      '#качкар',
      '#арарат',
      '#кавказ',
      '#кыргызстан',
      '#алтай',
    ],
  },
};

/** Çağrı (CTA) kalıpları — kanala göre ajan seçer. */
export const CTAS: Record<Lang, string[]> = {
  tr: [
    'Zirtan’yi indir, yakınındaki maceraperestlerle eşleş.',
    'Rotanı Zirtan’de planla, tehlike haritasına bak, sonra çık.',
    'Sen de tehlike bildir: bir işaret bir hayat kurtarabilir mi bilmiyoruz ama işini kolaylaştırır.',
    'Kulübünü Zirtan’ye ekle, etkinliğini duyur.',
    'Davet kodunla arkadaşını getir, ikiniz de Pro günü kazanın.',
  ],
  en: [
    'Get Zirtan and match with verified adventurers near you.',
    'Plan the route in Zirtan, check the hazard map, then go.',
    'Add your club to Zirtan and post your next trip.',
    'Invite a friend with your code — you both get Pro days.',
  ],
  ru: [
    'Скачай Zirtan и найди проверенных попутчиков рядом.',
    'Спланируй маршрут в Zirtan, посмотри карту опасностей — и в путь.',
    'Пригласи друга по коду — оба получите дни Pro.',
  ],
};

export interface ComplianceIssue {
  phrase: string;
  reason: string;
}

/** Metni yasak ifadeler listesine karşı denetler; ihlal listesi döner (boş = temiz). */
export function checkBrandCompliance(text: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  for (const rule of FORBIDDEN_PHRASES) {
    const match = new RegExp(rule.pattern, 'iu').exec(text);
    if (match) issues.push({ phrase: match[0], reason: rule.reason });
  }
  return issues;
}

/** Sistem istemine gömülecek marka özeti (önbelleğe alınır; deterministik olmalı). */
export function brandBrief(): string {
  const lines: string[] = [];
  lines.push(`# ${BRAND.name} marka özeti`);
  lines.push(`Hesap: ${BRAND.handle} · Site: ${BRAND.site}`);
  lines.push(`Slogan (TR/EN/RU): ${BRAND.tagline.tr} / ${BRAND.tagline.en} / ${BRAND.tagline.ru}`);
  lines.push('');
  lines.push('## Konumlandırma');
  lines.push(BRAND.oneLiner.tr);
  lines.push('');
  lines.push('## Marka sesi');
  for (const p of VOICE.principles) lines.push(`- ${p}`);
  for (const lang of LANGS) lines.push(`- Ton (${lang}): ${VOICE.toneByLang[lang]}`);
  lines.push('');
  lines.push('## Ürün gerçekleri (yalnızca bunları tanıt)');
  for (const f of PRODUCT_FACTS) lines.push(`- ${f}`);
  lines.push('');
  lines.push('## Henüz yok — vadetme');
  for (const n of NOT_YET) lines.push(`- ${n}`);
  lines.push('');
  lines.push('## Yasak ifadeler (hiçbir dilde kullanma)');
  for (const r of FORBIDDEN_PHRASES) lines.push(`- /${r.pattern}/ — ${r.reason}`);
  lines.push('');
  lines.push('## Yasal notlar');
  for (const n of LEGAL_NOTES) lines.push(`- ${n}`);
  lines.push('');
  lines.push('## Hedef kitleler');
  for (const a of AUDIENCES)
    lines.push(`- ${a.label} (${a.id}): sorun — ${a.painPoint} Kanca — ${a.hook}`);
  return lines.join('\n');
}
