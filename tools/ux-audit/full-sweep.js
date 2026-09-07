/* eslint-env node */
/**
 * Uçtan uca ekran taraması.
 *
 * `drive.js` sabit bir rota listesi gezer; bu betik **dosya sisteminden**
 * bütün rotaları çıkarır ve dinamik segmentleri ([id], [slug] …) tohum
 * verisinden gerçek kimliklerle doldurur. Amaç: hiçbir ekranın taramanın
 * dışında kalmaması.
 *
 * Her rota için toplanan:
 *   · pageerror ve konsol hatası
 *   · `[missing` — çevrilmemiş metin
 *   · boş/çok kısa gövde — ekran hiç çizilmemiş olabilir
 *   · iç içe <button> (validateDOMNesting)
 *
 * Çıktı: out/sweep.json + out/sweep.md, hatalı ekranların görüntüsü.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright']) {
    try { return require(c); } catch { /* sıradaki */ }
  }
  throw new Error('playwright bulunamadı');
}

const ROOT = path.resolve(__dirname, '..', '..');
const APP = path.join(ROOT, 'src', 'app', '(app)');
const OUT = path.resolve(process.env.OUT || path.join(__dirname, 'out'));
const BASE = process.env.BASE_URL || 'http://localhost:8081';
const SETTLE = Number(process.env.SETTLE_MS || 2600);

/** Dosya sisteminden rota yolları. */
function routesFromFs(dir = APP, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // (tabs) gibi grup klasörleri yola girmez.
      const seg = /^\(.*\)$/.test(e.name) ? prefix : `${prefix}/${e.name}`;
      out.push(...routesFromFs(p, seg));
    } else if (e.name.endsWith('.tsx') && e.name !== '_layout.tsx') {
      const base = e.name.replace(/\.tsx$/, '');
      out.push(base === 'index' ? prefix || '/' : `${prefix}/${base}`);
    }
  }
  return out;
}

const IGNORED = [/ERR_TUNNEL/, /ERR_CONNECTION_REFUSED/, /favicon\.ico/, /React DevTools/];
const NESTED_BUTTON = () =>
  Array.from(document.querySelectorAll('button')).filter((b) => b.querySelector('button')).length;

(async () => {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: process.env.LOCALE || 'tr-TR',
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  let hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (IGNORED.some((r) => r.test(t))) return;
    if (m.type() === 'error') hatalar.push(t);
    else if (/validateDOMNesting|unique "key"|Maximum update depth|Cannot update a component/i.test(t)) {
      hatalar.push(`warn: ${t}`);
    }
  });

  // ---- giriş ----
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(6000);
  const kapi = page.getByText(/E-posta ile devam et/i).first();
  if (await kapi.count()) {
    await kapi.click();
    await page.waitForTimeout(3500);
    const g = page.locator('input');
    await g.nth(0).fill('deniz@zirtan.app');
    await g.nth(1).fill('123456');
    await page.getByText(/^Giriş yap$/).first().click();
    await page.waitForTimeout(8000);
  }

  // ---- tohumdan gerçek kimlikler ----
  const tohum = await page.evaluate(() => {
    const raw = localStorage.getItem('zirtan.mockdb.v9');
    if (!raw) return {};
    const t = JSON.parse(raw);
    const ilk = (k, alan = 'id') => (t[k]?.[0]?.[alan] != null ? String(t[k][0][alan]) : null);
    return {
      post: ilk('posts'), user: ilk('users'), track: ilk('tracks'),
      trail: ilk('communityTrails'), crag: ilk('crags'), climbRoute: ilk('climbingRoutes'),
      club: ilk('clubs'), clubEvent: ilk('clubEvents'), course: ilk('courses'),
      lesson: ilk('lessons'), cert: ilk('certificates'), destination: ilk('destinations'),
      group: ilk('groups'), hazard: ilk('hazards'), heritage: ilk('heritageSites'),
      tour: ilk('heritageTours'), instructor: ilk('instructors'), place: ilk('library'),
      listing: ilk('listings'), match: ilk('matches'), stay: ilk('businesses'),
      booking: ilk('stayBookings'), species: ilk('species'), question: ilk('wildlifeQuestions'),
      article: ilk('articles', 'slug'), writer: ilk('writers', 'userId'),
      country: ilk('countryGuides', 'countryCode'), thread: ilk('aiThreads'),
      consult: ilk('consultations'), doctor: ilk('doctors'), tv: ilk('tvPrograms'),
      channel: ilk('tvChannels'), news: ilk('news'), kidPlace: ilk('kidPlaces'),
      chat: ilk('messages', 'conversationId'), stream: ilk('streams'),
      guide: ilk('library', 'id'), tag: 'zirtan', mapRoute: ilk('savedRoutes'),
    };
  });

  /** Dinamik segmenti tohumdaki kimlikle doldur; eşleşme yoksa rota atlanır. */
  const ESLEME = {
    '/post/[id]': ['post'], '/user/[id]': ['user'], '/tracks/[id]': ['track'],
    '/tracks/community/[id]': ['trail'], '/climbing/[cragId]': ['crag'],
    '/climbing/route/[id]': ['climbRoute'], '/clubs/[id]': ['club'],
    '/clubs/event/[id]': ['clubEvent'], '/courses/[id]': ['course'],
    '/courses/lesson/[id]': ['lesson'], '/courses/certificate/[id]': ['cert'],
    '/destinations/[id]': ['destination'], '/groups/[id]': ['group'],
    '/groups/info/[id]': ['group'], '/hazards/[id]': ['hazard'],
    '/heritage/[id]': ['heritage'], '/heritage/guide/[id]': ['tour'],
    '/instructors/[id]': ['instructor'], '/library/[id]': ['place'],
    '/location/[id]': ['place'], '/market/[id]': ['listing'],
    '/match/[id]': ['match'], '/stays/[id]': ['stay'],
    '/stays/booking/[id]': ['booking'], '/stays/host/[businessId]': ['stay'],
    '/wildlife/species/[id]': ['species'], '/wildlife/question/[id]': ['question'],
    '/articles/[slug]': ['article'], '/articles/writer/[userId]': ['writer'],
    '/countries/[code]': ['country'], '/countries/checklist/[code]': ['country'],
    '/assistant/[threadId]': ['thread'], '/telemed/consult/[id]': ['consult'],
    '/telemed/doctor/[id]': ['doctor'], '/tv/watch/[id]': ['tv'],
    '/tv/channel/[id]': ['channel'], '/tv/news/[id]': ['news'],
    '/kids/place/[id]': ['kidPlace'], '/chat/[id]': ['chat'],
    '/live/[id]': ['stream'], '/stories/[authorId]': ['user'],
    '/social/tag/[tag]': ['tag'], '/first-aid/[slug]': ['guide'],
    '/maps/route/[id]': ['mapRoute'], '/navigate/[id]': ['trail'],
  };

  const hamRotalar = Array.from(new Set(routesFromFs())).sort();
  const gezilecek = [];
  const atlanan = [];
  for (const r of hamRotalar) {
    if (!r.includes('[')) { gezilecek.push({ rota: r, url: r }); continue; }
    const anahtarlar = ESLEME[r];
    if (!anahtarlar) { atlanan.push({ rota: r, sebep: 'eşleme tanımlı değil' }); continue; }
    const deger = tohum[anahtarlar[0]];
    if (!deger) { atlanan.push({ rota: r, sebep: `tohumda ${anahtarlar[0]} yok` }); continue; }
    gezilecek.push({ rota: r, url: r.replace(/\[[^\]]+\]/, encodeURIComponent(deger)) });
  }

  const sonuclar = [];
  for (const { rota, url } of gezilecek) {
    hatalar = [];
    let govde = '';
    let nested = 0;
    let durum = 'ok';
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(SETTLE);
      govde = await page.evaluate(() => document.body.innerText || '');
      nested = await page.evaluate(NESTED_BUTTON);
    } catch (e) {
      durum = 'gezinilemedi';
      hatalar.push(`goto: ${e.message}`);
    }

    const eksikCeviri = Array.from(govde.matchAll(/\[missing [^\]]*\]/g)).map((m) => m[0]);
    // Uygulamanın kendi "Sayfa bulunamadı" ekranı. Rota dosyası varken bu
    // metnin görünmesi ya rota kaydı eksik ya da veri durumu için yanlış
    // ekran gösteriliyor demektir — ilk taramada bunu kaçırmıştım.
    const rotaYok = /Sayfa bulunamadı|haritada yok gibi/i.test(govde);
    // 200 karakterin altı: başlık + bir cümleden ibaret ekran. Gerçek bir
    // boş durum olabilir, ama incelenmeden geçilmemeli.
    const bos = govde.trim().length < 200;
    const sorunlu =
      hatalar.length || eksikCeviri.length || nested > 0 || bos || rotaYok || durum !== 'ok';
    if (sorunlu) {
      const ad = (rota === '/' ? 'home' : rota).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
      try { await page.screenshot({ path: path.join(OUT, `${ad}.png`) }); } catch { /* yoksay */ }
    }
    sonuclar.push({
      rota, url, durum,
      hatalar: Array.from(new Set(hatalar)).slice(0, 6),
      eksikCeviri: Array.from(new Set(eksikCeviri)).slice(0, 6),
      icIceButon: nested,
      bos,
      rotaYok,
      govdeUzunluk: govde.trim().length,
      baslik: govde.trim().split('\n').slice(0, 2).join(' · ').slice(0, 90),
    });
    process.stdout.write(sorunlu ? 'X' : '.');
  }
  process.stdout.write('\n');

  const sorunlular = sonuclar.filter(
    (s) =>
      s.hatalar.length || s.eksikCeviri.length || s.icIceButon || s.bos || s.rotaYok ||
      s.durum !== 'ok',
  );
  fs.writeFileSync(
    path.join(OUT, 'sweep.json'),
    JSON.stringify({ tarih: new Date().toISOString(), tohum, atlanan, sonuclar }, null, 2),
  );

  const md = [
    `# Uçtan uca ekran taraması`, '',
    `- Gezilen: **${sonuclar.length}** rota`,
    `- Sorunlu: **${sorunlular.length}**`,
    `- Atlanan (kimlik yok): **${atlanan.length}**`, '',
    '## Sorunlu ekranlar', '',
  ];
  for (const s of sorunlular) {
    md.push(`### \`${s.rota}\``);
    if (s.durum !== 'ok') md.push(`- durum: **${s.durum}**`);
    if (s.rotaYok) md.push('- **uygulamanın 404 ekranı** çıktı (rota kaydı ya da veri durumu)');
    if (s.bos) md.push(`- ince içerik (gövde ${s.govdeUzunluk} karakter) — \`${s.baslik}\``);
    if (s.icIceButon) md.push(`- iç içe <button>: ${s.icIceButon}`);
    for (const c of s.eksikCeviri) md.push(`- eksik çeviri: \`${c}\``);
    for (const h of s.hatalar) md.push(`- hata: \`${h.slice(0, 200)}\``);
    md.push('');
  }
  if (atlanan.length) {
    md.push('## Atlananlar', '');
    for (const a of atlanan) md.push(`- \`${a.rota}\` — ${a.sebep}`);
  }
  fs.writeFileSync(path.join(OUT, 'sweep.md'), md.join('\n'));

  console.log(`\ngezilen=${sonuclar.length} sorunlu=${sorunlular.length} atlanan=${atlanan.length}`);
  console.log(`rapor: ${path.join(OUT, 'sweep.md')}`);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('SWEEP FAIL:', e.message); process.exit(1); });
