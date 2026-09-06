/**
 * Marka gerçekleri — .mjs katmanının (kanallar, içerik motoru, takvim, lansman, ASO,
 * referans, rapor) tek kaynağı. TypeScript tarafındaki `src/brand.ts` ile aynı marka
 * sesini taşır; `brand.test.mjs` iki tarafın çelişmediğini doğrular.
 */

export const BRAND = {
  name: 'Zirtan',
  handle: '@zirtanapp',
  site: 'https://zirtan.app',
  press: 'https://zirtan.app/basin',
  support: 'destek@zirtan.app',
  appStore: 'https://apps.apple.com/app/zirtan',
  playStore: 'https://play.google.com/store/apps/details?id=app.zirtan',
  tagline: {
    tr: 'Doğayı birlikte keşfet.',
    en: 'Explore the outdoors, together.',
    de: 'Entdecke die Natur — gemeinsam.',
    ru: 'Открывай природу вместе.',
  },
  oneLiner: {
    tr: 'Outdoor macera sosyal ağı: yakınındaki doğrulanmış maceraperestlerle eşleş, topluluk tehlike haritasına bak, dağdan canlı yayın aç, ülkeye göre SOS ve çevrimdışı ilk yardım rehberiyle daha güvenli çık.',
    en: 'The outdoor adventure social network: match with verified adventurers nearby, check the community hazard map, go live from the mountain, and head out safer with country-aware SOS and offline first-aid guides.',
    de: 'Das soziale Netzwerk für Outdoor-Abenteuer: finde verifizierte Partner in deiner Nähe, prüfe die Gefahrenkarte der Community, geh vom Berg aus live und starte sicherer — mit länderspezifischem SOS und Offline-Erste-Hilfe.',
    ru: 'Соцсеть для outdoor-приключений: ZMatch подбирает проверенных попутчиков рядом, карта опасностей от сообщества, прямые эфиры с гор, SOS с учётом страны и офлайн-гид по первой помощи.',
  },
};

/** İçerik motorunun ürettiği diller (her içerik en az bu dördünde çıkar). */
export const CONTENT_LANGS = ['tr', 'en', 'de', 'ru'];

/** Mağaza yerelleştirmesi yapılan 23 dil — `src/core/i18n/languages.ts` ile aynı sıra. */
export const STORE_LOCALES = [
  'tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'hi',
  'ne', 'ar', 'ka', 'el', 'pl', 'cs', 'nl', 'sv', 'nb', 'id', 'th',
];

/** Dil → mağaza yerel kodu ve öncelik grubu (pazar odağı). */
export const LOCALE_META = {
  tr: { native: 'Türkçe', ios: 'tr', play: 'tr-TR', tier: 1, market: 'Türkiye' },
  en: { native: 'English', ios: 'en-US', play: 'en-US', tier: 1, market: 'Global' },
  de: { native: 'Deutsch', ios: 'de-DE', play: 'de-DE', tier: 1, market: 'Alpler (DE/AT/CH)' },
  ru: { native: 'Русский', ios: 'ru', play: 'ru-RU', tier: 1, market: 'Kafkasya + RU konuşanlar' },
  ne: { native: 'नेपाली', ios: 'en-US', play: 'ne-NP', tier: 1, market: 'Nepal' },
  fr: { native: 'Français', ios: 'fr-FR', play: 'fr-FR', tier: 2, market: 'Fransız Alpleri' },
  es: { native: 'Español', ios: 'es-ES', play: 'es-ES', tier: 2, market: 'İspanya + LatAm' },
  it: { native: 'Italiano', ios: 'it', play: 'it-IT', tier: 2, market: 'Dolomitler' },
  pt: { native: 'Português', ios: 'pt-BR', play: 'pt-BR', tier: 2, market: 'Brezilya + Portekiz' },
  ka: { native: 'ქართული', ios: 'en-GB', play: 'ka-GE', tier: 2, market: 'Gürcistan' },
  pl: { native: 'Polski', ios: 'pl', play: 'pl-PL', tier: 2, market: 'Tatralar' },
  cs: { native: 'Čeština', ios: 'cs', play: 'cs-CZ', tier: 3, market: 'Çekya' },
  el: { native: 'Ελληνικά', ios: 'el', play: 'el-GR', tier: 3, market: 'Yunanistan (Kalymnos)' },
  nl: { native: 'Nederlands', ios: 'nl-NL', play: 'nl-NL', tier: 3, market: 'Benelüks' },
  sv: { native: 'Svenska', ios: 'sv', play: 'sv-SE', tier: 3, market: 'İskandinavya' },
  nb: { native: 'Norsk', ios: 'no', play: 'no-NO', tier: 3, market: 'Norveç' },
  ja: { native: '日本語', ios: 'ja', play: 'ja-JP', tier: 3, market: 'Japonya' },
  zh: { native: '中文', ios: 'zh-Hans', play: 'zh-CN', tier: 3, market: 'Çin (Play yok, iOS)' },
  ko: { native: '한국어', ios: 'ko', play: 'ko-KR', tier: 3, market: 'Kore' },
  hi: { native: 'हिन्दी', ios: 'hi', play: 'hi-IN', tier: 3, market: 'Hindistan' },
  ar: { native: 'العربية', ios: 'ar-SA', play: 'ar', tier: 3, market: 'Körfez + Ürdün' },
  id: { native: 'Bahasa Indonesia', ios: 'id', play: 'id', tier: 3, market: 'Endonezya' },
  th: { native: 'ไทย', ios: 'th', play: 'th', tier: 3, market: 'Tayland' },
};

/**
 * Ürün özellikleri — mağaza metni, lansman duyurusu ve içerik motoru bu listeden konuşur.
 * Listede olmayan özellik tanıtılmaz (README özellik listesiyle birebir).
 */
export const FEATURES = [
  {
    id: 'zmatch',
    tr: 'ZMatch: yakındaki doğrulanmış maceraperestlerle eşleş',
    en: 'ZMatch: match with verified adventurers nearby',
    de: 'ZMatch: verifizierte Partner in deiner Nähe finden',
    ru: 'ZMatch: подбор проверенных попутчиков рядом',
  },
  {
    id: 'hazard',
    tr: 'Topluluk tehlike haritası: kaya düşmesi, çığ, sel, vahşi hayvan, kapalı patika',
    en: 'Community hazard map: rockfall, avalanche, flood, wildlife, closed trail',
    de: 'Gefahrenkarte der Community: Steinschlag, Lawine, Hochwasser, Wildtiere, Sperrungen',
    ru: 'Карта опасностей от сообщества: камнепад, лавина, паводок, звери, закрытая тропа',
  },
  {
    id: 'sos',
    tr: 'Basılı tut SOS + ülkeye göre acil numara ve en yakın dağ kurtarma',
    en: 'Press-and-hold SOS with country-aware emergency numbers and nearest mountain rescue',
    de: 'Halte-SOS mit länderspezifischen Notrufnummern und nächster Bergrettung',
    ru: 'SOS удержанием + местные экстренные номера и ближайший горноспасательный отряд',
  },
  {
    id: 'firstaid',
    tr: '12 çevrimdışı ilk yardım rehberi (CPR, kanama, hipotermi, irtifa, yılan ısırığı…)',
    en: '12 offline first-aid guides (CPR, bleeding, hypothermia, altitude, snakebite…)',
    de: '12 Offline-Erste-Hilfe-Leitfäden (HLW, Blutung, Unterkühlung, Höhe, Schlangenbiss…)',
    ru: '12 офлайн-инструкций первой помощи (СЛР, кровотечение, гипотермия, высота, укус змеи…)',
  },
  {
    id: 'offline',
    tr: 'Çevrimdışı haritalar, A* rota planlama, yükseklik profili, GPX içe/dışa aktarma',
    en: 'Offline maps, A* route planning, elevation profile, GPX import/export',
    de: 'Offline-Karten, A*-Routenplanung, Höhenprofil, GPX-Import/Export',
    ru: 'Офлайн-карты, планировщик маршрутов A*, профиль высот, импорт/экспорт GPX',
  },
  {
    id: 'library',
    tr: 'Açık veriyle beslenen kütüphane: kamp, tırmanış, dalış, zirve, mağara, dağ evi',
    en: 'Open-data library: camping, climbing, diving, summits, caves, mountain huts',
    de: 'Open-Data-Bibliothek: Camping, Klettern, Tauchen, Gipfel, Höhlen, Hütten',
    ru: 'Библиотека на открытых данных: кемпинг, скалолазание, дайвинг, вершины, пещеры, приюты',
  },
  {
    id: 'live',
    tr: 'Dağdan canlı yayın, canlı konum paylaşımı ve telemetri',
    en: 'Live streaming from the mountain, live location sharing and telemetry',
    de: 'Livestream vom Berg, Live-Standort und Telemetrie',
    ru: 'Прямые эфиры с гор, трансляция местоположения и телеметрия',
  },
  {
    id: 'clubs',
    tr: 'Üniversite kulüpleri: etkinlik, RSVP, .edu doğrulama, kulüp ligi',
    en: 'University clubs: events, RSVP, .edu verification, club league',
    de: 'Hochschulgruppen: Touren, RSVP, .edu-Verifizierung, Vereinsliga',
    ru: 'Студенческие клубы: события, RSVP, .edu-подтверждение, лига клубов',
  },
  {
    id: 'climbing',
    tr: 'Tırmanış veritabanı: sektör, rota, derece dönüşümü, logbook, derece piramidi',
    en: 'Climbing database: sectors, routes, grade conversion, logbook, grade pyramid',
    de: 'Kletterdatenbank: Sektoren, Routen, Grad-Umrechnung, Logbuch, Gradpyramide',
    ru: 'База скалолазания: сектора, маршруты, конвертер категорий, логбук, пирамида',
  },
  {
    id: 'guides',
    tr: 'Rehberler ve eğitmenler: sertifikalı profil, ders ve tur rezervasyonu',
    en: 'Guides and instructors: certified profiles, lesson and tour booking',
    de: 'Guides und Ausbilder: zertifizierte Profile, Kurs- und Tourbuchung',
    ru: 'Гиды и инструкторы: подтверждённые профили, запись на курсы и туры',
  },
];

/** Yasak ifadeler (TR/EN/RU `src/brand.ts` ile aynı + DE karşılıkları). */
export const FORBIDDEN_PHRASES = [
  { pattern: 'asla kaybolmaz', reason: 'Mutlak güvenlik vaadi' },
  { pattern: 'hiç(bir zaman)? kaybolmaz', reason: 'Mutlak güvenlik vaadi' },
  { pattern: '%\\s?100 güven', reason: 'Mutlak güvenlik vaadi' },
  // Olumsuzlanmış kullanım ("kurtarma garantisi değildir") yasal uyarının kendisidir; yakalanmaz.
  { pattern: 'kurtarma garantisi(?!\\s*(değildir|değil|vermez|sunmaz))', reason: 'SOS bir bildirim aracıdır, kurtarma garantisi değildir' },
  { pattern: 'hayat(ını|ınızı) kurtarır', reason: 'Tıbbi/güvenlik sonucu vaadi' },
  { pattern: 'ilk yardım(a)? gerek kalmaz', reason: 'Tıbbi tavsiye yerine geçme iddiası' },
  { pattern: 'never get lost', reason: 'Absolute safety claim' },
  { pattern: '100% safe', reason: 'Absolute safety claim' },
  { pattern: 'guaranteed rescue', reason: 'SOS is a notification tool, not a rescue guarantee' },
  { pattern: 'saves? your life', reason: 'Medical/safety outcome claim' },
  { pattern: 'replaces? (a )?(doctor|first aid training)', reason: 'Medical advice substitution' },
  { pattern: 'никогда не потеря', reason: 'Абсолютное обещание безопасности' },
  { pattern: '100% безопас', reason: 'Абсолютное обещание безопасности' },
  { pattern: '(?<!не )гарантия спасения', reason: 'SOS не гарантирует спасение' },
  { pattern: 'nie verirren', reason: 'Absolutes Sicherheitsversprechen' },
  { pattern: '100 ?% sicher', reason: 'Absolutes Sicherheitsversprechen' },
  { pattern: 'rettung garantiert|garantierte rettung', reason: 'SOS ist keine Rettungsgarantie' },
  { pattern: 'rettet (dein|ihr) leben', reason: 'Versprechen eines medizinischen Ergebnisses' },
  { pattern: 'en iyi outdoor uygulaması', reason: 'Kanıtsız üstünlük iddiası' },
  { pattern: '#1 outdoor app', reason: 'Unproven superiority claim' },
  { pattern: '(alltrails|komoot|wikiloc|strava|gaia ?gps)[^.\\n]{0,40}(çöp|kötü|berbat|sucks|trash|garbage)', reason: 'Rakip karalama' },
];

/** Henüz olmayan ve vadedilmeyecek özellikler. */
export const NOT_YET = [
  'Gerçek uydu SOS iletimi (Garmin/ZOLEO köprüsü v1.4)',
  'Giyilebilir cihaz senkronu (v1.4)',
  'Resmî çığ / hava bülteni entegrasyonu (v1.4)',
  'Gerçek zamanlı video iletimi (LiveKit/Mux v1.3)',
  'Uygulama içi ödeme (RevenueCat / iyzico v1.3)',
];

/** Her güvenlik içeriğinin sonuna eklenen yasal not. */
export const SAFETY_NOTE = {
  tr: 'Bu içerik eğitim amaçlıdır, profesyonel yardımın yerine geçmez. Acil durumda 112.',
  en: 'Educational content — not a substitute for professional help. In an emergency call your local number (112 in Türkiye and the EU).',
  de: 'Dieser Beitrag ersetzt keine professionelle Hilfe. Im Notfall 112 wählen.',
  ru: 'Материал носит образовательный характер и не заменяет профессиональную помощь. Экстренный номер — 112.',
};

/** Açık veri atfı — harita/kütüphane görseli içeren her gönderide. */
export const ATTRIBUTION = {
  osm: '© OpenStreetMap katkıcıları (ODbL 1.0)',
  wikidata: 'Wikidata (CC0 1.0)',
  commons: 'Wikimedia Commons — yazar ve lisans satırı görselde',
};

/** Hashtag havuzları (kanal biçimlendiricisi sayıyı kısar). */
export const HASHTAGS = {
  tr: {
    core: ['#zirtanapp', '#doğa', '#outdoor', '#kamp', '#trekking', '#dağcılık'],
    niche: ['#tırmanış', '#dalış', '#yamaçparaşütü', '#patikakoşusu', '#solotrekking', '#kampçılık', '#doğayürüyüşü'],
    local: ['#kaçkar', '#likyayolu', '#kapadokya', '#aladağlar', '#ağrıdağı', '#geyikbayırı', '#olimpos', '#uludağ', '#erciyes', '#karadeniz'],
  },
  en: {
    core: ['#zirtanapp', '#hiking', '#outdoors', '#camping', '#trekking', '#adventure'],
    niche: ['#climbing', '#scubadiving', '#trailrunning', '#backpacking', '#solohiking', '#mountaineering', '#bikepacking'],
    local: ['#turkey', '#lycianway', '#cappadocia', '#kackar', '#everestbasecamp', '#annapurna', '#montblanc', '#kalymnos', '#caucasus'],
  },
  de: {
    core: ['#zirtanapp', '#wandern', '#draussen', '#bergsteigen', '#trekking', '#outdoor'],
    niche: ['#klettern', '#alpen', '#hüttentour', '#trailrunning', '#bergsport', '#zelten'],
    local: ['#türkei', '#lykischerweg', '#kappadokien', '#kackar', '#montblanc', '#dolomiten', '#kaukasus'],
  },
  ru: {
    core: ['#zirtanapp', '#поход', '#горы', '#треккинг', '#кемпинг', '#туризм'],
    niche: ['#скалолазание', '#дайвинг', '#трейлраннинг', '#соловпоход', '#альпинизм'],
    local: ['#турция', '#ликийскаятропа', '#каппадокия', '#качкар', '#эльбрус', '#кавказ', '#грузия', '#непал'],
  },
};

/** Ülkeye göre yerel hashtag'ler — içerik konusunun ülkesiyle eşleşir. */
export const LOCAL_TAGS_BY_COUNTRY = {
  TR: { tr: ['#kaçkar', '#likyayolu', '#kapadokya', '#aladağlar', '#ağrıdağı', '#geyikbayırı', '#olimpos'], en: ['#turkey', '#lycianway', '#cappadocia', '#kackar', '#geyikbayiri'], de: ['#türkei', '#lykischerweg', '#kappadokien', '#kackar'], ru: ['#турция', '#ликийскаятропа', '#каппадокия', '#качкар'] },
  NP: { tr: ['#nepal', '#everest', '#annapurna', '#himalaya'], en: ['#nepal', '#everestbasecamp', '#annapurna', '#himalayas'], de: ['#nepal', '#everest', '#annapurna', '#himalaya'], ru: ['#непал', '#эверест', '#аннапурна', '#гималаи'] },
  GE: { tr: ['#gürcistan', '#kafkasya', '#svaneti'], en: ['#georgia', '#caucasus', '#svaneti'], de: ['#georgien', '#kaukasus', '#swanetien'], ru: ['#грузия', '#кавказ', '#сванетия'] },
  RU: { tr: ['#elbruz', '#kafkasya'], en: ['#elbrus', '#caucasus'], de: ['#elbrus', '#kaukasus'], ru: ['#эльбрус', '#кавказ'] },
  FR: { tr: ['#montblanc', '#alpler'], en: ['#montblanc', '#alps', '#tmb'], de: ['#montblanc', '#alpen'], ru: ['#монблан', '#альпы'] },
  CH: { tr: ['#alpler', '#zermatt'], en: ['#alps', '#hauteroute', '#zermatt'], de: ['#alpen', '#hauteroute', '#zermatt'], ru: ['#альпы', '#церматт'] },
  IT: { tr: ['#dolomitler', '#alpler'], en: ['#dolomites', '#alps'], de: ['#dolomiten', '#alpen'], ru: ['#доломиты', '#альпы'] },
  GR: { tr: ['#kalymnos', '#yunanistan'], en: ['#kalymnos', '#greece'], de: ['#kalymnos', '#griechenland'], ru: ['#калимнос', '#греция'] },
  TZ: { tr: ['#kilimanjaro', '#tanzanya'], en: ['#kilimanjaro', '#tanzania'], de: ['#kilimandscharo', '#tansania'], ru: ['#килиманджаро', '#танзания'] },
  PE: { tr: ['#peru', '#incayolu'], en: ['#peru', '#incatrail'], de: ['#peru', '#inkapfad'], ru: ['#перу', '#инкатрейл'] },
  CL: { tr: ['#patagonya', '#torresdelpaine'], en: ['#patagonia', '#torresdelpaine'], de: ['#patagonien', '#torresdelpaine'], ru: ['#патагония', '#торресдельпайне'] },
  AR: { tr: ['#patagonya', '#aconcagua'], en: ['#patagonia', '#aconcagua'], de: ['#patagonien', '#aconcagua'], ru: ['#патагония', '#аконкагуа'] },
};

/** Konu ülkesine göre yerel etiketler; ülke bilinmiyorsa genel havuz. */
export function localTags(country, lang) {
  const byCountry = LOCAL_TAGS_BY_COUNTRY[country];
  if (byCountry?.[lang]) return byCountry[lang];
  return (HASHTAGS[lang] ?? HASHTAGS.en).local;
}

/** Çağrı kalıpları — kanal ve amaca göre seçilir. */
export const CTAS = {
  tr: [
    'Zirtan’ı indir, yakınındaki maceraperestlerle eşleş.',
    'Rotanı Zirtan’da aç, tehlike haritasına bak, sonra yola çık.',
    'Gördüğün tehlikeyi işaretle — arkandan gelen bilsin.',
    'Kulübünü Zirtan’a ekle, etkinliğini duyur.',
    'Davet kodunla arkadaşını çağır, ikiniz de Pro kazanın.',
  ],
  en: [
    'Get Zirtan and match with verified adventurers near you.',
    'Open the route in Zirtan, check the hazard map, then go.',
    'Mark what you saw on the trail — the next hiker will thank you.',
    'Add your club to Zirtan and post your next trip.',
    'Invite a friend with your code — you both get Pro days.',
  ],
  de: [
    'Lade Zirtan und finde verifizierte Partner in deiner Nähe.',
    'Route in Zirtan öffnen, Gefahrenkarte prüfen, losgehen.',
    'Melde, was du auf dem Weg gesehen hast — die Nächsten danken es dir.',
    'Trag deine Hochschulgruppe in Zirtan ein und kündige die nächste Tour an.',
    'Lade eine Freundin mit deinem Code ein — ihr bekommt beide Pro-Tage.',
  ],
  ru: [
    'Скачай Zirtan и найди проверенных попутчиков рядом.',
    'Открой маршрут в Zirtan, посмотри карту опасностей — и в путь.',
    'Отметь опасность на карте: тем, кто пойдёт следом, это пригодится.',
    'Добавь свой клуб в Zirtan и объяви следующий выход.',
    'Пригласи друга по коду — оба получите дни Pro.',
  ],
};

/**
 * UTM'li bağlantı üretir. Şema `docs/GROWTH.md` §5 ile aynı:
 * `utm_source=<kanal> utm_medium=organic|collab|referral|press utm_campaign=<kampanya> utm_content=<id>`
 */
export function utmLink({ base = BRAND.site, path = '', source, medium = 'organic', campaign, content }) {
  const url = new URL(path ? `${base.replace(/\/$/u, '')}/${path.replace(/^\//u, '')}` : base);
  if (source) url.searchParams.set('utm_source', source);
  if (medium) url.searchParams.set('utm_medium', medium);
  if (campaign) url.searchParams.set('utm_campaign', campaign);
  if (content) url.searchParams.set('utm_content', content);
  return url.toString();
}

/** Metni yasak ifadelere karşı denetler; ihlal listesi döner (boş = temiz). */
export function checkCompliance(text) {
  const issues = [];
  for (const rule of FORBIDDEN_PHRASES) {
    const match = new RegExp(rule.pattern, 'iu').exec(text);
    if (match) issues.push({ phrase: match[0], reason: rule.reason });
  }
  return issues;
}

/** Belirli bir dilde özellik cümlesi (bilinmeyen dil → İngilizce). */
export function feature(id, lang = 'tr') {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`Bilinmeyen özellik: ${id}`);
  return f[lang] ?? f.en;
}
