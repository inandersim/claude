#!/usr/bin/env node
/**
 * ASO — App Store ve Google Play mağaza metinleri, 23 dil.
 *
 *   node aso.mjs                      # tüm diller → out/aso/
 *   node aso.mjs --locales tr,en,de   # seçili diller
 *   node aso.mjs --check              # yalnızca sınır denetimi (çıkış kodu 1 = ihlal)
 *
 * Üretir: dil başına `out/aso/<locale>.md`, birleşik `aso.json`, `keywords.csv`,
 * `competitors.md` (rakip anahtar kelime analizi) ve `README.md`.
 *
 * Sınırlar App Store Connect / Play Console kurallarıdır; ihlal varsa uyarı listelenir.
 */

import { boolFlag, listFlag, parseArgs, usage } from './lib/args.mjs';
import { BRAND, LOCALE_META, NOT_YET, STORE_LOCALES } from './lib/brand.mjs';
import { outPath, toCsv, Writer } from './lib/fsx.mjs';
import { charCount, lines, mdTable } from './lib/text.mjs';
import { STORE_COPY } from './content/store-copy.mjs';

/** Mağaza alan sınırları. */
export const LIMITS = {
  title: 30,
  subtitle: 30,
  short: 80,
  keywords: 100,
  promo: 170,
  screen: 40,
  description: 4000,
  playTitle: 30,
  releaseNotes: 500,
};

/* ------------------------------------------------------------------ */
/* Rakip analizi                                                         */
/* ------------------------------------------------------------------ */

export const COMPETITORS = [
  {
    name: 'AllTrails',
    positioning: 'Rota keşfi ve yorum kütlesi; ABD/Batı Avrupa ağırlıklı.',
    strongKeywords: ['hiking', 'trails', 'trail maps', 'hiking trails near me', 'walking'],
    weakness: 'Türkiye, Nepal ve Kafkasya rota kapsamı zayıf; topluluk tehlike bildirimi yok; arayüz Türkçe/Rusça değil.',
    gap: 'Yerel rota adı + tehlike haritası + ülkeye göre SOS.',
  },
  {
    name: 'Komoot',
    positioning: 'Rota planlama ve bisiklet; DACH pazarında güçlü.',
    strongKeywords: ['routenplaner', 'wandern', 'radfahren', 'tourenplanung', 'bike'],
    weakness: 'Sosyal eşleşme yok; güvenlik/ilk yardım katmanı yok; bölge paketleri ücretli.',
    gap: 'Partner eşleşme + ücretsiz çevrimdışı harita + acil durum katmanı.',
  },
  {
    name: 'Wikiloc',
    positioning: 'Kullanıcı izleri (GPX) arşivi; İspanya/LatAm güçlü.',
    strongKeywords: ['gpx', 'rutas', 'senderismo', 'trails', 'outdoor navigation'],
    weakness: 'Veri kalitesi değişken, doğrulama yok; güvenlik ve topluluk katmanı zayıf.',
    gap: 'Doğrulanmış profil + topluluk onaylı tehlike bildirimi.',
  },
  {
    name: 'Gaia GPS',
    positioning: 'Harita katmanları ve backcountry navigasyon; ABD merkezli, uzman kitle.',
    strongKeywords: ['topo maps', 'offline maps', 'backcountry', 'navigation', 'gps tracks'],
    weakness: 'Öğrenme eğrisi dik; sosyal yön yok; abonelik ağırlıklı.',
    gap: 'Yeni başlayana anlaşılır arayüz + ücretsiz plan + eşleşme.',
  },
  {
    name: 'iOverlander',
    positioning: 'Kamp ve karavan noktaları; topluluk katkısı esaslı.',
    strongKeywords: ['camping', 'overland', 'wild camping', 'campsites', 'water refill'],
    weakness: 'Yürüyüş/tırmanış kapsamı yok; ilk yardım ve SOS yok; tasarım eski.',
    gap: 'Kamp kütüphanesi + rota motoru + güvenlik araçları tek uygulamada.',
  },
];

/** Rakiplerin güçlü olmadığı, bizim doğal olarak sahiplenebileceğimiz anahtar kelimeler. */
export const OPPORTUNITY_KEYWORDS = [
  { keyword: 'yürüyüş arkadaşı', market: 'TR', why: 'Hiçbir rakip eşleşme sunmuyor; niyet yüksek, rekabet düşük.' },
  { keyword: 'tehlike haritası', market: 'TR', why: 'Kategoride karşılığı yok; haber/arama trafiği sezonluk yükseliyor.' },
  { keyword: 'çevrimdışı ilk yardım', market: 'TR', why: 'Sağlık uygulamaları outdoor bağlamında görünmüyor.' },
  { keyword: 'likya yolu', market: 'TR', why: 'Marka gücü yüksek rota adı; rakiplerin Türkçe içeriği zayıf.' },
  { keyword: 'kaçkar trekking', market: 'TR', why: 'Mevsimlik zirve; içerik + landing sayfası ile desteklenir.' },
  { keyword: 'hiking partner', market: 'EN', why: 'AllTrails/Komoot bu niyeti karşılamıyor.' },
  { keyword: 'trail hazard', market: 'EN', why: 'Yeni kategori tanımı; düşük hacim, yüksek dönüşüm.' },
  { keyword: 'offline first aid', market: 'EN', why: 'Outdoor + sağlık kesişimi boş.' },
  { keyword: 'wanderpartner', market: 'DE', why: 'Komoot rota planlıyor, partner bulmuyor.' },
  { keyword: 'gefahrenkarte wandern', market: 'DE', why: 'Alp bölgesinde arama niyeti var, uygulama yok.' },
  { keyword: 'попутчик в горы', market: 'RU', why: 'VK/Telegram gruplarında çözülen ihtiyaç; uygulama karşılığı yok.' },
  { keyword: 'ликийская тропа', market: 'RU', why: 'Rusça içerik az, arama var.' },
  { keyword: 'पदयात्रा नक्सा', market: 'NE', why: 'Nepal pazarında yerel dilde uygulama neredeyse yok.' },
];

/* ------------------------------------------------------------------ */
/* Listeleme kurma                                                       */
/* ------------------------------------------------------------------ */

/** Açıklama metnini kurar (mağaza uzun açıklaması). */
export function buildDescription(copy) {
  return lines(
    copy.intro,
    '',
    ...copy.features.map((f) => `• ${f}`),
    '',
    copy.safety,
    '',
    copy.closing,
    '',
    `${BRAND.site}`,
  );
}

/** Tek dil için mağaza listeleme paketi + sınır denetimi. */
export function buildListing(locale) {
  const copy = STORE_COPY[locale];
  if (!copy) throw new Error(`Mağaza metni yok: ${locale}`);
  const meta = LOCALE_META[locale] ?? { native: locale, ios: locale, play: locale, tier: 3, market: '—' };
  const description = buildDescription(copy);
  const warnings = [];

  const check = (field, value, limit) => {
    const n = charCount(value);
    if (n > limit) warnings.push(`${field}: ${n} karakter > ${limit} sınırı`);
    return n;
  };

  const sizes = {
    title: check('title', copy.title, LIMITS.title),
    subtitle: check('subtitle', copy.subtitle, LIMITS.subtitle),
    short: check('short', copy.short, LIMITS.short),
    keywords: check('keywords', copy.keywords, LIMITS.keywords),
    promo: check('promo', copy.promo, LIMITS.promo),
    description: check('description', description, LIMITS.description),
  };
  copy.screens.forEach((s, i) => check(`screens[${i + 1}]`, s, LIMITS.screen));
  if (copy.screens.length !== 6) warnings.push(`screens: ${copy.screens.length} metin var, 6 ekran bekleniyor`);
  if (/\s/u.test(copy.keywords.replace(/, /gu, ',')) && copy.keywords.includes(', ')) {
    warnings.push('keywords: virgülden sonra boşluk karakter yakar — "a,b,c" biçimini kullan');
  }
  if (!copy.title.includes(BRAND.name)) warnings.push('title: marka adı Zirtan geçmiyor');

  return {
    locale,
    native: meta.native,
    market: meta.market,
    tier: meta.tier,
    ios: { locale: meta.ios, title: copy.title, subtitle: copy.subtitle, keywords: copy.keywords, promo: copy.promo, description },
    play: { locale: meta.play, title: copy.title, shortDescription: copy.short, fullDescription: description },
    screens: copy.screens,
    sizes,
    warnings,
  };
}

function listingMarkdown(l) {
  return lines(
    `# Mağaza metni — ${l.native} (${l.locale})`,
    '',
    `Pazar: ${l.market} · öncelik: tier ${l.tier} · iOS yerel kodu \`${l.ios.locale}\` · Play \`${l.play.locale}\``,
    '',
    '## App Store',
    '',
    `**Başlık (${l.sizes.title}/${LIMITS.title})**`,
    '',
    '```text',
    l.ios.title,
    '```',
    '',
    `**Alt başlık (${l.sizes.subtitle}/${LIMITS.subtitle})**`,
    '',
    '```text',
    l.ios.subtitle,
    '```',
    '',
    `**Anahtar kelimeler (${l.sizes.keywords}/${LIMITS.keywords})**`,
    '',
    '```text',
    l.ios.keywords,
    '```',
    '',
    `**Tanıtım metni (${l.sizes.promo}/${LIMITS.promo})**`,
    '',
    '```text',
    l.ios.promo,
    '```',
    '',
    '## Google Play',
    '',
    `**Kısa açıklama (${l.sizes.short}/${LIMITS.short})**`,
    '',
    '```text',
    l.play.shortDescription,
    '```',
    '',
    `## Açıklama (${l.sizes.description}/${LIMITS.description})`,
    '',
    '```text',
    l.ios.description,
    '```',
    '',
    '## Ekran görüntüsü metinleri',
    '',
    mdTable(
      ['#', 'Ekran', 'Metin', 'Karakter'],
      l.screens.map((s, i) => [
        i + 1,
        ['ZMatch', 'Tehlike haritası', 'SOS', 'İlk yardım', 'Harita/GPX', 'Kulüpler'][i] ?? '—',
        s,
        charCount(s),
      ]),
    ),
    '',
    l.warnings.length ? `## Uyarılar\n\n${l.warnings.map((w) => `- ${w}`).join('\n')}` : '## Uyarı yok',
  );
}

function competitorsMarkdown() {
  return lines(
    '# Rakip anahtar kelime analizi',
    '',
    'Amaç rakibi kötülemek değil, **arama niyetindeki boşluğu** bulmak. Mağaza metinlerinde',
    'rakip adı geçmez; bu tablo yalnızca anahtar kelime seçimini yönlendirir.',
    '',
    mdTable(
      ['Uygulama', 'Konumlanma', 'Güçlü anahtar kelimeler', 'Bizim açığımız'],
      COMPETITORS.map((c) => [c.name, c.positioning, c.strongKeywords.join(', '), c.gap]),
    ),
    '',
    '## Nerede zayıflar',
    '',
    ...COMPETITORS.map((c) => `- **${c.name}:** ${c.weakness}`),
    '',
    '## Sahiplenilecek anahtar kelimeler',
    '',
    mdTable(
      ['Anahtar kelime', 'Pazar', 'Neden'],
      OPPORTUNITY_KEYWORDS.map((k) => [k.keyword, k.market, k.why]),
    ),
    '',
    '## Yöntem',
    '',
    '1. Başlıkta 1, alt başlıkta 2, açıklamada doğal tekrar — anahtar kelime yığmak (keyword stuffing) reddedilir.',
    '2. iOS anahtar kelime alanı 100 karakter: virgülden sonra boşluk kullanma, çoğul yazma (algoritma kökten eşler).',
    '3. Play tarafında anahtar kelime alanı yok; kısa açıklama + açıklamadaki doğal tekrar sayılır.',
    '4. Ayda bir tek değişken değiştir (başlık ya da alt başlık), 14 gün ölç, geri al ya da tut.',
    '5. Ölçüm: App Store Connect → Arama kaynaklı kurulum; Play Console → mağaza listesi dönüşümü.',
    '',
    '## Vadedilmeyecekler (mağaza reddi riski)',
    '',
    ...NOT_YET.map((n) => `- ${n}`),
    '- "Kurtarma garantisi", "asla kaybolmazsın", "%100 güvenli" gibi ifadeler hiçbir dilde kullanılmaz.',
  );
}

export function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('aso.mjs — 23 dil için mağaza metni üretir ve sınırları denetler', [
        '--locales tr,en,de   dil süzgeci (varsayılan hepsi)',
        '--check              yalnızca denetim; ihlal varsa çıkış kodu 1',
        '--out <klasör>       çıktı klasörü (varsayılan out/aso)',
      ]),
    );
    return 0;
  }
  const locales = listFlag(flags.locales ?? flags.langs, STORE_LOCALES).filter((l) => STORE_COPY[l]);
  const listings = locales.map((l) => buildListing(l));
  const violations = listings.filter((l) => l.warnings.length > 0);

  if (boolFlag(flags.check, false)) {
    for (const l of violations) console.error(`${l.locale}: ${l.warnings.join(' · ')}`);
    console.log(`${listings.length} dil denetlendi, ${violations.length} dilde uyarı.`);
    return violations.length > 0 ? 1 : 0;
  }

  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('aso');
  for (const l of listings) writer.text(`${dir}/${l.locale}.md`, listingMarkdown(l));
  writer.json(`${dir}/aso.json`, { generatedAt: new Date().toISOString().slice(0, 10), limits: LIMITS, listings });
  writer.text(`${dir}/competitors.md`, competitorsMarkdown());
  writer.text(
    `${dir}/keywords.csv`,
    toCsv(
      ['locale', 'market', 'tier', 'title', 'subtitle', 'keywords', 'short_description'],
      listings.map((l) => [l.locale, l.market, l.tier, l.ios.title, l.ios.subtitle, l.ios.keywords, l.play.shortDescription]),
    ),
  );
  writer.text(
    `${dir}/README.md`,
    lines(
      '# ASO paketi',
      '',
      `${listings.length} dil · ${violations.length} dilde sınır uyarısı`,
      '',
      mdTable(
        ['Dil', 'Pazar', 'Tier', 'Başlık', 'Alt başlık', 'Anahtar kelime', 'Uyarı'],
        listings.map((l) => [l.locale, l.market, l.tier, `${l.sizes.title}/30`, `${l.sizes.subtitle}/30`, `${l.sizes.keywords}/100`, l.warnings.length]),
      ),
      '',
      '## Yükleme sırası',
      '',
      '1. Önce tier 1 diller (tr, en, de, ru, ne) — trafiğin çoğu buradan gelir.',
      '2. Ekran görüntüsü metinleri her dilde ekranın üstünde tek satır olmalı (≤ 40 karakter).',
      '3. Play tarafında `full description` HTML kabul eder ama düz metin daha güvenli.',
      '4. iOS anahtar kelime alanına başlıkta geçen kelimeleri tekrar yazma (boşa 30 karakter).',
      '',
      '## Dosyalar',
      '',
      '- `<locale>.md` — o dilin tüm alanları, karakter sayısıyla',
      '- `keywords.csv` — tablo hâlinde başlık/alt başlık/anahtar kelime',
      '- `competitors.md` — rakip analizi ve sahiplenilecek anahtar kelimeler',
      '- `aso.json` — otomasyon için (fastlane / Play Publishing API girdisi)',
    ),
  );

  console.log(`${listings.length} dil için mağaza metni yazıldı; ${violations.length} dilde uyarı var.`);
  for (const l of violations) console.log(`  ${l.locale}: ${l.warnings.join(' · ')}`);
  console.log(writer.summary().slice(0, 4).join('\n'));
  console.log(`… toplam ${writer.count} dosya`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
