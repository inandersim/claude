#!/usr/bin/env node
/**
 * Lansman dizisi — tek komutla "uygulama canlıya alındı" günü.
 *
 *   node launch.mjs                          # kuru çalışma: tüm paketler out/launch altına
 *   node launch.mjs --date 2026-11-03 --langs tr,en,de,ru
 *   node launch.mjs --live                   # anahtarı olan kanallarda gerçek yayın
 *
 * Üretir:
 * - 10 kanal için duyuru gönderisi (kanal biçimlendiricisinden geçmiş, elle yayına hazır)
 * - Product Hunt sayfası metinleri (tagline, açıklama, ilk yorum, galeri altyazıları)
 * - Reddit gönderileri (subreddit kuralına göre ayrı metin) ve Hacker News "Show HN"
 * - Basın bülteni (tr/en), e-posta duyurusu (tr/en), mağaza sürüm notu
 * - Saat saat lansman günü akışı ve kontrol listesi
 */

import { boolFlag, listFlag, parseArgs, usage } from './lib/args.mjs';
import { BRAND, CONTENT_LANGS, FEATURES, NOT_YET, SAFETY_NOTE, utmLink } from './lib/brand.mjs';
import { humanDate, isoDate, nextMonday, parseDate } from './lib/dates.mjs';
import { outPath, Writer } from './lib/fsx.mjs';
import { lines, mdTable } from './lib/text.mjs';
import { makeContext } from './channels/base.mjs';
import { CHANNEL_IDS, resolveChannels } from './channels/index.mjs';

const CAMPAIGN = 'launch';

/* ------------------------------------------------------------------ */
/* Duyuru metinleri                                                      */
/* ------------------------------------------------------------------ */

/** Kanal-bağımsız duyuru gövdesi (kanal biçimlendiricisi kısaltır/uzatır). */
export function announcement(lang, date) {
  const day = humanDate(date, lang);
  const table = {
    tr: {
      title: 'Zirtan yayında',
      tiny: 'Zirtan bugün yayında: eşleşme, tehlike haritası, çevrimdışı ilk yardım. 23 dil, ücretsiz plan.',
      short: `Zirtan bugün App Store ve Google Play’de.\nDoğrulanmış maceraperestlerle eşleşme, topluluk tehlike haritası, ülkeye göre SOS ve 12 çevrimdışı ilk yardım rehberi — 23 dilde.`,
      medium: lines(
        'İki yıldır aynı üç soru geliyor.',
        '',
        'Kiminle çıkacağım? Patikada şu an ne var? Bir şey olursa kimi arayacağım?',
        '',
        `Zirtan bugün yayında (${day}). İçinde:`,
        '',
        '- ZMatch: yakındaki doğrulanmış maceraperestlerle eşleşme, plan ve mesajlaşma',
        '- Topluluk tehlike haritası: kaya düşmesi, çığ, sel, vahşi hayvan, kapalı patika — yakındakilere uyarı',
        '- Basılı tut SOS: ülkeye göre acil numara, en yakın dağ kurtarma, acil kişilere konum',
        '- 12 çevrimdışı ilk yardım rehberi ve çevrimdışı harita + rota planlama (GPX)',
        '- Açık veriyle beslenen kütüphane: kamp, tırmanış, dalış, zirve, mağara, dağ evi',
        '',
        'Kâşif planı ücretsiz. Kulüpler ve rehberler için paketler de açık.',
        '',
        'Bu bir 1.0 sürümü: eksikleri var, yol haritası açık. Ne eksik olduğunu yazarsanız sıraya alırız.',
      ),
      cta: 'İndir, ilk rotanı aç, tehlike haritasına bir işaret bırak.',
    },
    en: {
      title: 'Zirtan is live',
      tiny: 'Zirtan is live: partner matching, hazard map, offline first aid. 23 languages, free plan.',
      short: `Zirtan is out today on the App Store and Google Play.\nVerified partner matching, a community hazard map, country-aware SOS and 12 offline first-aid guides — in 23 languages.`,
      medium: lines(
        'Two years, the same three questions.',
        '',
        'Who do I go with? What is on the trail right now? Who do I call if something happens?',
        '',
        `Zirtan is live today (${day}). What is in it:`,
        '',
        '- ZMatch: match with verified adventurers nearby, plan together, message',
        '- Community hazard map: rockfall, avalanche, flood, wildlife, closed trail — nearby users get alerted',
        '- Press-and-hold SOS: country-aware emergency numbers, nearest mountain rescue, location to your contacts',
        '- 12 offline first-aid guides plus offline maps and route planning with GPX',
        '- An open-data library: campsites, crags, dive sites, summits, caves and huts',
        '',
        'The Explorer plan is free. Club and guide packs are open too.',
        '',
        'This is a 1.0: rough edges included, roadmap public. Tell us what is missing and it goes on the list.',
      ),
      cta: 'Download it, open your first route, and leave one hazard marker behind you.',
    },
    de: {
      title: 'Zirtan ist live',
      tiny: 'Zirtan ist live: Partnersuche, Gefahrenkarte, Offline-Erste-Hilfe. 23 Sprachen, Gratis-Plan.',
      short: `Zirtan ist ab heute im App Store und bei Google Play.\nVerifizierte Partnersuche, Gefahrenkarte der Community, länderspezifisches SOS und 12 Offline-Erste-Hilfe-Leitfäden — in 23 Sprachen.`,
      medium: lines(
        'Zwei Jahre, immer dieselben drei Fragen.',
        '',
        'Mit wem gehe ich? Was ist gerade am Weg? Wen rufe ich an, wenn etwas passiert?',
        '',
        `Zirtan ist seit heute live (${day}). Drin ist:`,
        '',
        '- ZMatch: verifizierte Partner in der Nähe finden, gemeinsam planen, schreiben',
        '- Gefahrenkarte der Community: Steinschlag, Lawine, Hochwasser, Wildtiere, Sperrungen — mit Warnung für alle in der Nähe',
        '- Halte-SOS: Notrufnummer je Land, nächste Bergrettung, Standort an deine Kontakte',
        '- 12 Offline-Erste-Hilfe-Leitfäden, Offline-Karten und Routenplanung mit GPX',
        '- Eine Bibliothek aus offenen Daten: Zeltplätze, Klettergebiete, Tauchplätze, Gipfel, Höhlen, Hütten',
        '',
        'Der Explorer-Plan ist kostenlos. Pakete für Vereine und Guides sind ebenfalls offen.',
        '',
        'Das ist eine 1.0: mit Kanten, mit öffentlicher Roadmap. Schreib uns, was fehlt.',
      ),
      cta: 'Lade sie, öffne deine erste Route und hinterlasse eine Gefahrenmeldung.',
    },
    ru: {
      title: 'Zirtan вышел',
      tiny: 'Zirtan вышел: попутчики, карта опасностей, офлайн-первая помощь. 23 языка, бесплатный план.',
      short: `Zirtan сегодня в App Store и Google Play.\nПодбор проверенных попутчиков, карта опасностей от сообщества, SOS с учётом страны и 12 офлайн-инструкций первой помощи — на 23 языках.`,
      medium: lines(
        'Два года — одни и те же три вопроса.',
        '',
        'С кем идти? Что сейчас на тропе? Кому звонить, если что-то случится?',
        '',
        `Zirtan вышел сегодня (${day}). Что внутри:`,
        '',
        '- ZMatch: проверенные попутчики рядом, совместные планы и переписка',
        '- Карта опасностей от сообщества: камнепад, лавина, паводок, звери, закрытая тропа — уведомление тем, кто рядом',
        '- SOS удержанием: номер по стране, ближайшие горноспасатели, координаты экстренным контактам',
        '- 12 офлайн-инструкций первой помощи, офлайн-карты и планировщик маршрутов с GPX',
        '- Библиотека на открытых данных: кемпинги, скалы, дайв-сайты, вершины, пещеры, приюты',
        '',
        'План «Кашиф» бесплатный. Пакеты для клубов и гидов тоже открыты.',
        '',
        'Это версия 1.0: с шероховатостями и открытой дорожной картой. Напишите, чего не хватает.',
      ),
      cta: 'Скачай, открой первый маршрут и оставь одну отметку об опасности.',
    },
  };
  return table[lang] ?? table.en;
}

/** Kanal-özel duyuru gövdesi (Reddit ve LinkedIn farklı ton ister). */
function channelOverride(channelId, lang, base) {
  if (channelId === 'reddit') {
    return {
      title:
        lang === 'tr'
          ? 'Türkiye ve Nepal rotaları için topluluk tehlike haritası + çevrimdışı ilk yardım olan bir outdoor uygulaması yaptım — geri bildirim arıyorum'
          : 'I built an outdoor app with a community hazard map and offline first aid for Türkiye, Nepal and the Caucasus — looking for feedback',
      body:
        lang === 'tr'
          ? lines(
              'İki yıldır üzerinde çalıştığım şeyi bugün yayınladım. Kısaca ne olduğu, neyin işe yaradığı ve neyin henüz olmadığı:',
              '',
              'Ne var: yakındaki doğrulanmış kişilerle eşleşme, topluluk tehlike haritası (kaya düşmesi/çığ/sel/kapalı patika), ülkeye göre acil numara ve en yakın dağ kurtarma, 12 çevrimdışı ilk yardım rehberi, çevrimdışı harita + A* rota planlama, GPX içe/dışa aktarma, açık veriden (OSM/Wikidata) kütüphane.',
              '',
              'Ne yok: gerçek uydu SOS iletimi (cihaz köprüsü yol haritasında), giyilebilir senkron, resmî çığ bülteni entegrasyonu. Bunları vadetmiyorum.',
              '',
              'Neden yaptım: Kaçkar ve Likya Yolu’nda tehlike bilgisi WhatsApp gruplarında kalıyor, kimse haritada göremiyor. Açık veriyi topluluk bildirimiyle birleştirmek en ucuz çözüm gibi göründü.',
              '',
              'Eleştiriye açığım, özellikle çevrimdışı harita boyutları ve pil tüketimi konusunda.',
            )
          : lines(
              'I published the thing I have been building for two years. Here is what it is, what works and what does not yet:',
              '',
              'What is in it: matching with verified people nearby, a community hazard map (rockfall / avalanche / flood / closed trail), country-aware emergency numbers and nearest mountain rescue, 12 offline first-aid guides, offline maps with A* routing, GPX import/export, and a library built from open data (OSM/Wikidata).',
              '',
              'What is not: real satellite SOS transmission (the device bridge is on the roadmap), wearable sync, official avalanche bulletin integration. I am not claiming any of those.',
              '',
              'Why: hazard information on the Lycian Way and in the Kaçkars lives in WhatsApp groups where nobody can see it on a map. Combining open data with community reports looked like the cheapest fix.',
              '',
              'Happy to take criticism, especially on offline map size and battery use.',
            ),
    };
  }
  if (channelId === 'linkedin') {
    return {
      title: base.title,
      body: lines(
        lang === 'tr'
          ? 'Bugün Zirtan’ı yayınladık. Sıfır reklam bütçesiyle, açık veri ve topluluk bildirimleri üzerine kurulu bir outdoor güvenlik ve eşleşme uygulaması.'
          : 'We launched Zirtan today: an outdoor safety and partner-matching app built on open data and community reports, with zero ad budget.',
        '',
        base.medium,
      ),
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Product Hunt                                                          */
/* ------------------------------------------------------------------ */

export function productHunt(date) {
  return lines(
    '# Product Hunt — lansman sayfası',
    '',
    `Tarih: ${humanDate(date)} · Yayın saati: 00:01 PT (TRT 10:01). Salı–Perşembe tercih edilir.`,
    '',
    '## Ad ve tagline',
    '',
    '- **Name:** Zirtan',
    '- **Tagline (60 karakter):** Find outdoor partners, see trail hazards, go out safer',
    '- **Topics:** Outdoors, Travel, Maps, Safety, Android, iOS',
    '',
    '## Açıklama (260 karakter)',
    '',
    '```text',
    'Zirtan matches you with verified adventurers nearby, shows a community hazard map for the trail ahead, and gives you country-aware SOS with 12 offline first-aid guides. Open-data library of camps, crags, dive sites and huts. 23 languages, free plan.',
    '```',
    '',
    '## İlk yorum (maker story)',
    '',
    '```text',
    'Hi PH 👋',
    '',
    'I am the maker. Zirtan started on the Lycian Way, when a landslide had taken out a section and the only place that information existed was a WhatsApp group of eleven people.',
    '',
    'So the app does three things:',
    '1. ZMatch — find verified people going the same way this weekend.',
    '2. A community hazard map — rockfall, avalanche, flood, closed trail. Report it once, everyone nearby sees it.',
    '3. Safety that works without signal — press-and-hold SOS with the right emergency number for the country you are in, and 12 offline first-aid guides.',
    '',
    'The location library is built from OpenStreetMap and Wikidata, with attribution kept in the app.',
    '',
    'What is NOT here yet, so nobody is surprised: satellite SOS transmission through Garmin/ZOLEO, wearable sync, and official avalanche bulletins. They are on the roadmap, not in the build.',
    '',
    'I would love feedback on two things: offline map size, and whether the hazard map is understandable in the first 30 seconds.',
    '```',
    '',
    '## Galeri altyazıları (6 görsel)',
    '',
    mdTable(
      ['#', 'Ekran', 'Altyazı (EN)'],
      [
        ['1', 'ZMatch', 'Match with verified adventurers going your way'],
        ['2', 'Tehlike haritası', 'Rockfall, avalanche, closed trail — reported by the people ahead of you'],
        ['3', 'SOS', 'Press and hold: the right emergency number for the country you are in'],
        ['4', 'İlk yardım', '12 first-aid guides that work with no signal'],
        ['5', 'Rota + GPX', 'Offline maps, elevation profile, GPX in and out'],
        ['6', 'Kütüphane', 'Camps, crags, dive sites and huts from open data'],
      ],
    ),
    '',
    '## Lansman günü kuralları',
    '',
    '- Oy isteme; "geri bildirim bırakın" de. Oy dilenmek PH kurallarını çiğner.',
    '- Her yoruma 10 dakika içinde yanıt ver; eleştiriye savunma değil, sıraya alma ile dön.',
    '- Telegram/kulüp topluluğuna bağlantıyı sabah paylaş, ne yapmalarını istediğini yazma.',
    '- Gün sonunda sonucu (sıra, oy, kurulum) şeffaf paylaş — Indie Hackers gönderisi olur.',
  );
}

/* ------------------------------------------------------------------ */
/* Reddit ve Hacker News                                                 */
/* ------------------------------------------------------------------ */

export const REDDIT_TARGETS = [
  {
    sub: 'r/SideProject',
    rule: 'Kendi projeni tanıtmak serbest; şeffaflık ve yol haritası beklenir.',
    angle: 'Ne yaptım, ne çalışmıyor, ne öğrendim.',
    when: 'Lansman günü 16:00 TRT',
  },
  {
    sub: 'r/androidapps',
    rule: 'Haftalık self-promo başlığı var; uygulama bağlantısı ve ücretsiz/ücretli ayrımı net olmalı.',
    angle: 'Özellik listesi + ücretsiz planın sınırı + izin listesi açıklaması.',
    when: 'Lansman günü + 1',
  },
  {
    sub: 'r/iosapps',
    rule: 'Bağlantı ve ekran görüntüsü zorunlu; pazarlama dili yasak.',
    angle: 'TestFlight sürecinden çıkanlar ve iOS’a özel notlar.',
    when: 'Lansman günü + 1',
  },
  {
    sub: 'r/hiking · r/CampingandHiking',
    rule: 'Kendi ürününü tanıtmak yasak / %10 kuralı. **Duyuru gönderme.**',
    angle: 'Trip report yaz (Kaçkar, Likya). Uygulama yalnızca soru gelirse yorumda.',
    when: 'Lansman haftasından sonra, doğal ritimde',
  },
  {
    sub: 'r/Turkey · r/TurkeyTravel',
    rule: 'Seyahat sorularına cevap; reklam yasak.',
    angle: '"Türkiye’de trekking nereden başlanır" sorusuna kapsamlı yanıt.',
    when: 'Sürekli, haftada 2 yorum',
  },
  {
    sub: 'r/zirtanapp',
    rule: 'Kendi topluluğun.',
    angle: 'Sürüm notu, yol haritası oylaması, hata bildirimi.',
    when: 'Lansman günü sabah',
  },
];

export function hackerNews() {
  return lines(
    '# Hacker News — Show HN',
    '',
    '**Başlık (80 karakter sınırı):**',
    '',
    '```text',
    'Show HN: Open-data outdoor library and hazard map for Türkiye and Nepal',
    '```',
    '',
    '**Metin:**',
    '',
    '```text',
    'I built an outdoor app around two things HN might find interesting.',
    '',
    'First, the location library: campsites, crags, dive sites, huts, caves and summits are pulled from OpenStreetMap and Wikidata through a small pipeline, normalised into one schema, and shipped with attribution intact. Offline map packs are PMTiles; routing is A* over a trail graph with a Tobler-based time model, so estimates degrade gracefully on steep terrain.',
    '',
    'Second, the hazard layer: users report rockfall, avalanche, flood, closed trail or wildlife with a severity and a radius and an expiry; nearby users get it on the map. Confirmations ("I saw it too") raise confidence. It is the part I am least sure about — bad data on a safety map is worse than no map.',
    '',
    'The app is React Native (Expo), TypeScript, offline-first. Emergency numbers and the nearest rescue base are resolved per country. Satellite SOS transmission is NOT implemented — only device pairing and the state machine around it; I did not want to imply a rescue guarantee.',
    '',
    'Happy to answer anything about the data pipeline, PMTiles packaging, or how the routing graph is built.',
    '```',
    '',
    '**Zamanlama:** hafta içi 08:00–10:00 ET (TRT 16:00–18:00). Başlıkta ürün övgüsü yok, teknik çekirdek var.',
    '',
    '**Yorumlarda:** savunma yapma; "bu doğru, şu an şöyle çözüyoruz, şurası zayıf" tonu.',
  );
}

/* ------------------------------------------------------------------ */
/* Basın bülteni ve e-posta                                              */
/* ------------------------------------------------------------------ */

export function pressRelease(lang, date) {
  const day = humanDate(date, lang);
  if (lang === 'en') {
    return lines(
      '# Press release (EN)',
      '',
      `**FOR IMMEDIATE RELEASE — ${day}**`,
      '',
      '## Zirtan launches: an outdoor social network built around trail safety and open data',
      '',
      `**Istanbul —** Zirtan, an outdoor adventure app that matches people for trips and maps trail hazards reported by the community, is available today on iOS and Android in 23 languages.`,
      '',
      'The app combines three things that usually live in separate places: finding a partner for a trip, knowing what is on the trail right now, and having usable safety information without a signal. Hazard reports — rockfall, avalanche, flood, wildlife, closed trails — are submitted by users with a severity, a radius and an expiry, and are pushed to people nearby.',
      '',
      'The location library (campsites, crags, dive sites, summits, caves and mountain huts) is built from OpenStreetMap and Wikidata, with licence attribution preserved in the app. Offline maps, A* route planning, elevation profiles and GPX import/export work without connectivity, as do 12 first-aid guides.',
      '',
      'Emergency features are country-aware: the SOS screen resolves the local emergency number and the nearest mountain rescue base. Satellite messenger pairing (Garmin inReach, ZOLEO, SPOT) is supported at the device level; actual satellite transmission requires the device and its service.',
      '',
      '**Availability.** Free Explorer plan; Pro ₺149/month; Pro Guide ₺399/month for certified guides; Business ₺799/month. iOS and Android.',
      '',
      `**Media kit.** ${BRAND.press} — logo, screenshots, founder photo, fact sheet.`,
      `**Contact.** ${BRAND.support}`,
      '',
      '### Notes to editors',
      '',
      '- The current release ships with a demo dataset for parts of the catalogue; this is stated in the app.',
      `- Not implemented yet: ${NOT_YET.join('; ')}.`,
      '- No user numbers are claimed at launch.',
    );
  }
  return lines(
    '# Basın bülteni (TR)',
    '',
    `**YAYIN İÇİN — ${day}**`,
    '',
    '## Zirtan yayında: patika güvenliği ve açık veri üzerine kurulu outdoor sosyal ağı',
    '',
    '**İstanbul —** Maceraperestleri gezi için eşleştiren ve topluluğun bildirdiği patika tehlikelerini haritalayan Zirtan, bugün iOS ve Android’de 23 dilde yayına girdi.',
    '',
    'Uygulama, genelde ayrı yerlerde duran üç şeyi birleştiriyor: geziye birlikte çıkacak kişiyi bulmak, patikada şu an ne olduğunu bilmek ve şebeke yokken işe yarayan güvenlik bilgisine ulaşmak. Kaya düşmesi, çığ, sel, vahşi hayvan ve kapalı patika bildirimleri kullanıcılar tarafından şiddet, yarıçap ve geçerlilik süresiyle giriliyor; yakındaki kullanıcılara bildirim olarak düşüyor.',
    '',
    'Kamp alanı, tırmanış sektörü, dalış noktası, zirve, mağara ve dağ evlerinden oluşan kütüphane OpenStreetMap ve Wikidata verisinden üretiliyor; lisans atıfları uygulama içinde korunuyor. Çevrimdışı haritalar, A* rota planlama, yükseklik profili ve GPX içe/dışa aktarma bağlantı olmadan çalışıyor; 12 ilk yardım rehberi de çevrimdışı.',
    '',
    'Acil durum özellikleri ülkeye göre değişiyor: SOS ekranı bulunulan ülkenin acil numarasını ve en yakın dağ kurtarma merkezini gösteriyor. Uydu haberleşme cihazlarıyla (Garmin inReach, ZOLEO, SPOT) eşleştirme cihaz düzeyinde destekleniyor; gerçek uydu iletimi cihazın kendi servisini gerektiriyor.',
    '',
    '**Erişim.** Kâşif planı ücretsiz; Pro ₺149/ay; sertifikalı rehberler için Pro Guide ₺399/ay; Business ₺799/ay. iOS ve Android.',
    '',
    `**Basın kiti.** ${BRAND.press} — logo, ekran görüntüleri, kurucu fotoğrafı, künye.`,
    `**İletişim.** ${BRAND.support}`,
    '',
    '### Editöre notlar',
    '',
    '- Mevcut sürümde kataloğun bir bölümü demo veriyle geliyor; bu durum uygulama içinde belirtiliyor.',
    `- Henüz yok: ${NOT_YET.join('; ')}.`,
    '- Lansmanda kullanıcı sayısı iddiası yapılmıyor.',
  );
}

export function launchEmail(lang, date) {
  const link = utmLink({ source: 'email', medium: 'email', campaign: CAMPAIGN, content: 'launch-announce' });
  if (lang === 'en') {
    return lines(
      '# Launch email (EN)',
      '',
      '**Subject:** It is live — Zirtan is out today',
      '**Preheader:** Partner matching, hazard map, offline first aid. Free plan.',
      '',
      '```text',
      'Hi,',
      '',
      'You asked to hear when it was ready. Zirtan is live on the App Store and Google Play today.',
      '',
      'What you can do in the first five minutes:',
      '1. Open a route near you and download the offline map.',
      '2. Check the hazard map for what people reported this week.',
      '3. Set your emergency contacts, so press-and-hold SOS actually reaches someone.',
      '',
      `Get it: ${link}`,
      '',
      'If something is broken or missing, reply to this email — it comes straight to me.',
      '',
      'See you out there,',
      'The Zirtan team',
      '```',
      '',
      '_Liste kaynağı: bekleme listesi ve kulüp/rehber ortakları. Tek tıkla abonelikten çıkma bağlantısı zorunlu (KVKK/GDPR)._',
    );
  }
  return lines(
    '# Lansman e-postası (TR)',
    '',
    '**Konu:** Yayında — Zirtan bugün çıktı',
    '**Ön izleme:** Eşleşme, tehlike haritası, çevrimdışı ilk yardım. Ücretsiz plan var.',
    '',
    '```text',
    'Merhaba,',
    '',
    'Hazır olunca haber vermemizi istemiştin. Zirtan bugün App Store ve Google Play’de.',
    '',
    'İlk beş dakikada yapabileceklerin:',
    '1. Yakınındaki bir rotayı aç, çevrimdışı haritasını indir.',
    '2. Tehlike haritasında bu hafta bildirilenlere bak.',
    '3. Acil kişilerini ekle — SOS’a basılı tuttuğunda konumun birine gitsin.',
    '',
    `Bağlantı: ${link}`,
    '',
    'Bozuk ya da eksik bir şey görürsen bu e-postayı yanıtla; doğrudan bize geliyor.',
    '',
    'Dağda görüşürüz,',
    'Zirtan ekibi',
    '```',
    '',
    '_Liste kaynağı: bekleme listesi ve kulüp/rehber ortakları. Tek tıkla abonelikten çıkma bağlantısı zorunlu (KVKK/GDPR)._',
  );
}

export function storeNotes() {
  return lines(
    '# Mağaza sürüm notu (1.0)',
    '',
    '## App Store — "What’s New" (TR)',
    '',
    '```text',
    'Zirtan’ın ilk sürümü yayında.',
    '',
    '· ZMatch: yakındaki doğrulanmış maceraperestlerle eşleş',
    '· Topluluk tehlike haritası: kaya düşmesi, çığ, sel, kapalı patika',
    '· Basılı tut SOS: ülkeye göre acil numara ve en yakın dağ kurtarma',
    '· 12 çevrimdışı ilk yardım rehberi',
    '· Çevrimdışı harita, rota planlama, GPX içe/dışa aktarma',
    '· Kütüphane: kamp, tırmanış, dalış, zirve, mağara, dağ evi',
    '',
    'Eksik gördüğün şeyi yaz: destek@zirtan.app',
    '```',
    '',
    '## App Store — "What’s New" (EN)',
    '',
    '```text',
    'First release of Zirtan.',
    '',
    '· ZMatch: match with verified adventurers nearby',
    '· Community hazard map: rockfall, avalanche, flood, closed trails',
    '· Press-and-hold SOS with country-aware emergency numbers',
    '· 12 offline first-aid guides',
    '· Offline maps, route planning, GPX import/export',
    '· Library of camps, crags, dive sites, summits, caves and huts',
    '',
    'Tell us what is missing: destek@zirtan.app',
    '```',
    '',
    '## Google Play — sürüm notu (500 karakter sınırı)',
    '',
    '```text',
    'İlk sürüm: ZMatch eşleşme, topluluk tehlike haritası, ülkeye göre SOS, 12 çevrimdışı ilk yardım rehberi, çevrimdışı harita ve GPX. Kâşif planı ücretsiz.',
    '```',
    '',
    '## Kontrol',
    '',
    '- Ekran görüntüleri ve metinler `aso.mjs` çıktısındaki dil dosyalarıyla aynı olmalı.',
    '- Yaş sınırı, veri güvenliği formu ve konum izni açıklaması güncel mi?',
    '- SOS için kesin sonuç ya da garanti ima eden hiçbir cümle yok (mağaza reddi sebebi).',
  );
}

/* ------------------------------------------------------------------ */
/* Akış ve kontrol listesi                                               */
/* ------------------------------------------------------------------ */

function timeline(date) {
  return lines(
    '# Lansman günü akışı (Europe/Istanbul)',
    '',
    `Tarih: **${humanDate(date)}** — Salı tercih edilir (PH ve HN trafiği yüksek, hafta sonuna kadar yayılma süresi var).`,
    '',
    mdTable(
      ['Saat', 'İş', 'Kanal / araç'],
      [
        ['07:30', 'Son kontrol: mağaza sürümü canlı mı, bağlantılar ve UTM çalışıyor mu', 'App Store, Play, zirtan.app'],
        ['09:00', 'Duyuru gönderileri (hazır paketlerden)', 'Instagram, Telegram, Facebook, VK'],
        ['09:30', 'Ortak tetikleme mesajı (kulüp, rehber, grup yöneticileri)', 'DM / WhatsApp'],
        ['10:01', 'Product Hunt canlı (00:01 PT) + ilk yorum (maker story)', 'Product Hunt, X'],
        ['11:00', 'Kurucu günlüğü gönderisi', 'LinkedIn'],
        ['12:00', 'Tanıtım videosu', 'TikTok, Reels, Shorts'],
        ['13:00', 'Basın e-postaları (20 kişi, kişiselleştirilmiş)', 'E-posta'],
        ['14:00', 'Bekleme listesi e-postası', 'E-posta'],
        ['16:00', 'Show HN + r/SideProject', 'Hacker News, Reddit'],
        ['17:00', 'Pinterest rehber pinleri', 'Pinterest'],
        ['Gün boyu', 'Her yoruma 10 dakika içinde yanıt', 'reply taslakları'],
        ['22:00', 'Gün sonu sayıları: kurulum, PH sırası, trafik kaynakları', 'report.mjs'],
      ],
    ),
    '',
    '## Ertesi gün',
    '',
    '- r/androidapps ve r/iosapps gönderileri.',
    '- Indie Hackers "lansman günü sayıları" gönderisi (şeffaf rakamlar).',
    '- Yanıtsız kalan yorum ve DM taraması.',
    '- İlk kurulum kohortunun aktivasyon oranı (7 gün içinde eşleşme ya da rota).',
  );
}

function checklist() {
  return lines(
    '# Lansman kontrol listesi',
    '',
    '## Lansmandan 2 hafta önce',
    '',
    '- [ ] Mağaza metinleri 23 dilde yüklendi (`node aso.mjs`)',
    '- [ ] Ekran görüntüleri 6 ekran × 5 dil hazır',
    '- [ ] 30 saniyelik tanıtım videosu (dikey + yatay kurgu)',
    '- [ ] Basın kiti sayfası yayında (logo, ekran görüntüsü, künye, kurucu fotoğrafı)',
    '- [ ] Product Hunt hunter’ı ve ilk 20 yorumcu belirlendi',
    '- [ ] Reddit hesabı yaş/karma eşiğini geçti',
    '- [ ] Ortak listesi: kulüp, rehber, grup yöneticisi (hedef 20)',
    '',
    '## Lansmandan 3 gün önce',
    '',
    '- [ ] Tüm duyuru paketleri üretildi (`node launch.mjs`)',
    '- [ ] UTM bağlantıları ve yönlendirmeler test edildi',
    '- [ ] Uygulama içi olaylar (kurulum → kayıt → ilk eşleşme) doğrulandı',
    '- [ ] Yanıt taslakları hazır (`node dispatch.mjs reply`)',
    '- [ ] Destek e-postası ve SSS güncel',
    '',
    '## Lansman günü',
    '',
    '- [ ] 09:00 duyuru gönderileri yayında',
    '- [ ] 10:01 Product Hunt + ilk yorum',
    '- [ ] 16:00 Show HN + r/SideProject',
    '- [ ] Yorumlara 10 dakika içinde yanıt',
    '- [ ] 22:00 gün sonu raporu',
    '',
    '## Yapılmayacaklar',
    '',
    '- [ ] Oy dilenmek (PH kural ihlali)',
    '- [ ] Aynı metni birden çok Facebook grubuna yapıştırmak',
    '- [ ] r/hiking ve r/CampingandHiking’e duyuru atmak',
    '- [ ] Kullanıcı sayısı uydurmak',
    '- [ ] "Kurtarma garantisi" / "asla kaybolmazsın" gibi ifadeler',
  );
}

/* ------------------------------------------------------------------ */
/* Ana akış                                                              */
/* ------------------------------------------------------------------ */

export async function runLaunch(options = {}) {
  const date = options.date ?? isoDate(nextMonday(new Date()));
  parseDate(date);
  const langs = options.langs ?? CONTENT_LANGS;
  const live = options.live ?? false;
  const writer = options.writer ?? new Writer();
  const dir = options.out ?? outPath('launch');
  const channels = resolveChannels(options.channels ?? CHANNEL_IDS);
  const ctx = makeContext({ live, writer, outDir: `${dir}/packets`, log: options.log ?? (() => {}) });

  const results = [];
  for (const channel of channels) {
    for (const lang of langs) {
      if (['reddit', 'linkedin', 'x'].includes(channel.id) && lang !== 'en' && lang !== 'tr') continue;
      const base = announcement(lang, date);
      const override = channelOverride(channel.id, lang, base);
      const item = {
        id: `launch-${channel.id}-${lang}`,
        lang,
        date,
        title: override?.title ?? base.title,
        body:
          override?.body ??
          (channel.spec.recommendedChars <= 200 ? base.tiny : channel.spec.recommendedChars < 400 ? base.short : base.medium),
        cta: base.cta,
        link: utmLink({ source: channel.id, medium: 'organic', campaign: CAMPAIGN, content: `launch-${lang}` }),
        hashtags: [],
        format: channel.spec.formats[0],
        bestTime: (channel.spec.bestTimes[lang] ?? channel.spec.bestTimes.tr)[0],
        safety: false,
        visual: {
          aspect: channel.id === 'pinterest' ? '2:3' : '4:5',
          brief:
            'Lansman görseli: uygulama ekranları (ZMatch · tehlike haritası · SOS) üç panel; üstte tek cümle, altta mağaza rozetleri. Ekran görüntülerinde isim ve konum maskeli.',
          shots: ['Zirveden geniş açı (kapak)', 'Telefon ekranı: tehlike haritası radar', 'Telefon ekranı: SOS'],
          alt: 'Zirtan uygulamasının eşleşme, tehlike haritası ve SOS ekranları',
        },
        sources: [`${BRAND.site} · basın kiti: ${BRAND.press}`],
        subreddit: channel.id === 'reddit' ? 'SideProject' : undefined,
      };
      results.push(await channel.publish(item, ctx));
    }
  }

  writer.text(`${dir}/product-hunt.md`, productHunt(date));
  writer.text(`${dir}/hacker-news.md`, hackerNews());
  writer.text(
    `${dir}/reddit-plan.md`,
    lines(
      '# Reddit lansman planı',
      '',
      'Her subreddit farklı kural işletir. Aynı metni her yere yapıştırmak ban sebebidir.',
      '',
      mdTable(['Subreddit', 'Kural', 'Açı', 'Ne zaman'], REDDIT_TARGETS.map((r) => [r.sub, r.rule, r.angle, r.when])),
      '',
      '## Hazır gövde (r/SideProject)',
      '',
      '```text',
      channelOverride('reddit', 'en', announcement('en', date)).body,
      '```',
      '',
      '## Başlık',
      '',
      `\`${channelOverride('reddit', 'en', announcement('en', date)).title}\``,
    ),
  );
  for (const lang of ['tr', 'en']) {
    writer.text(`${dir}/press-release-${lang}.md`, pressRelease(lang, date));
    writer.text(`${dir}/email-${lang}.md`, launchEmail(lang, date));
  }
  writer.text(`${dir}/store-release-notes.md`, storeNotes());
  writer.text(`${dir}/timeline.md`, timeline(date));
  writer.text(`${dir}/checklist.md`, checklist());
  writer.json(`${dir}/launch-log.json`, { date, live, langs, results });
  writer.text(
    `${dir}/README.md`,
    lines(
      `# Lansman paketi — ${humanDate(date)}`,
      '',
      `${results.length} kanal gönderisi · mod: ${live ? 'canlı denendi' : 'kuru çalışma'}`,
      '',
      mdTable(
        ['Kanal', 'Dil', 'Mod', 'Saat', 'Uyarı'],
        results.map((r) => [r.channel, r.postId.split('-').pop(), r.mode, r.bestTime, r.warnings.length]),
      ),
      '',
      '## Dosyalar',
      '',
      '- `packets/<kanal>/<id>.md` — kopyala-yapıştır hazır gönderi paketi',
      '- `product-hunt.md` · `hacker-news.md` · `reddit-plan.md`',
      '- `press-release-tr.md` · `press-release-en.md`',
      '- `email-tr.md` · `email-en.md` · `store-release-notes.md`',
      '- `timeline.md` (saat saat akış) · `checklist.md`',
      '',
      '## Özellik listesi (metinlerde bunun dışına çıkma)',
      '',
      ...FEATURES.map((f) => `- ${f.tr}`),
      '',
      '## Vadedilmeyecekler',
      '',
      ...NOT_YET.map((n) => `- ${n}`),
      '',
      `> ${SAFETY_NOTE.tr}`,
    ),
  );

  return { date, results, writer };
}

export async function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('launch.mjs — lansman dizisini çalıştırır (kuru çalışma varsayılan)', [
        '--date 2026-11-03    lansman günü',
        '--langs tr,en,de,ru  duyuru dilleri',
        '--channels a,b       kanal süzgeci',
        '--live               anahtarı olan kanallarda gerçek yayın',
        '--out <klasör>       çıktı klasörü (varsayılan out/launch)',
      ]),
    );
    return 0;
  }
  const { date, results, writer } = await runLaunch({
    date: typeof flags.date === 'string' ? flags.date : undefined,
    langs: listFlag(flags.langs ?? flags.lang, CONTENT_LANGS),
    channels: listFlag(flags.channels, CHANNEL_IDS),
    live: boolFlag(flags.live, false),
    out: typeof flags.out === 'string' ? flags.out : undefined,
    log: (l) => console.log(`  ${l}`),
  });
  const blocked = results.filter((r) => !r.ok);
  console.log(`\nLansman ${date}: ${results.length} gönderi paketi, ${writer.count} dosya.`);
  console.log(writer.summary().slice(0, 5).join('\n'));
  if (blocked.length > 0) {
    console.error(`Marka denetiminden geçmeyen ${blocked.length} gönderi.`);
    return 2;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main());
