#!/usr/bin/env node
/* eslint-env node */
/**
 * Harita performans ölçümü — **gerçek uygulamayı** başsız tarayıcıda sürer.
 *
 *   npm run perf:maps
 *   node tools/maps/perf.mjs --route /maps/planner --bolge "Likya Yolu"
 *
 * Neden uygulamanın kendisi: stili elle kurmak, ölçümü gerçek ekrandan
 * koparırdı. Sürücü uygulamaya girer, harita ekranını açar ve MapLibre
 * örneğini geliştirme derlemesinin açtığı `window.__ZIRTAN_MAPS__` üzerinden
 * ele geçirir.
 *
 * Ölçülenler:
 *   · ilk çizim   — stil verilmesinden `idle` olayına kadar
 *   · kare süresi — sabit bir kamera betiği boyunca rAF aralıkları
 *   · karo/bayt   — ağdan okunan `.pmtiles` ve `.pbf`
 *   · katman maliyeti — eğim ve 3B açıkken/kapalıyken fark
 *
 * **Zamanlar kapı değildir.** Başsız Chromium yazılım GL kullanır; kare
 * süreleri gerçek telefon GPU'sunu temsil etmez. Kapı yalnızca donanımdan
 * bağımsız sayılardır (karo isteği, bayt, katman sayısı); zamanlar rapora
 * gösterge olarak yazılır ve koşumlar arasında karşılaştırılır.
 *
 * Ön koşul: karo sunucusu ve `expo start --web` çalışıyor olmalı.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  butceKarsilastir,
  gerilemeYuzdesi,
  kareOzeti,
  karoOzeti,
  katmanMaliyeti,
} from './lib/perf-stats.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Playwright CommonJS; ESM'den yüklemek için köprü.
const require = createRequire(import.meta.url);

function playwrightYukle() {
  const adaylar = [
    'playwright',
    process.env.PLAYWRIGHT_PATH,
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const aday of adaylar) {
    try {
      return require(aday);
    } catch {
      /* sıradaki */
    }
  }
  throw new Error('playwright bulunamadı: npm i --no-save playwright');
}

/**
 * Sabit kamera betiği. Değiştirilirse koşumlar karşılaştırılamaz hâle gelir —
 * bu yüzden burada, tek yerde durur.
 *
 * Kaydırma + yakınlaştırma + eğme: haritanın üç ayrı maliyeti (karo isteme,
 * yeniden etiketleme, arazi ağı) bu üç hareketle uyarılıyor.
 */
export const KAMERA_BETIGI = [
  { tur: 'pan', dx: 220, dy: 0, ms: 900 },
  { tur: 'zoom', delta: 1.6, ms: 900 },
  { tur: 'pan', dx: -180, dy: 140, ms: 900 },
  { tur: 'pitch', deger: 55, ms: 700 },
  { tur: 'zoom', delta: -1.2, ms: 700 },
];

/**
 * **Sayfa içinde** çalışır (Playwright serileştirip tarayıcıya taşır):
 * kamera betiğini sürer, requestAnimationFrame aralıklarını toplar.
 * Bu gövdede Node API'si kullanılamaz.
 */
/* eslint-env browser */
function tarayicidaOlc(betik) {
  return new Promise((bitir) => {
    // En **son** kurulan harita: bölge değiştirmek yeni bir MapLibre örneği
    // yaratıyor, dizinin başındaki örnek artık ekranda değil.
    const map = (window.__ZIRTAN_MAPS__ || []).at(-1);
    if (!map) return bitir({ hata: 'harita yok' });
    const deltalar = [];
    let onceki = performance.now();
    let calisiyor = true;
    const kare = (t) => {
      if (!calisiyor) return;
      deltalar.push(t - onceki);
      onceki = t;
      requestAnimationFrame(kare);
    };
    requestAnimationFrame(kare);

    const adim = async (a) => {
      if (a.tur === 'pan') map.panBy([a.dx, a.dy], { duration: a.ms });
      else if (a.tur === 'zoom') map.zoomTo(map.getZoom() + a.delta, { duration: a.ms });
      else if (a.tur === 'pitch') map.easeTo({ pitch: a.deger, duration: a.ms });
      await new Promise((r) => setTimeout(r, a.ms + 250));
    };

    (async () => {
      for (const a of betik) await adim(a);
      calisiyor = false;
      const stil = map.getStyle();
      bitir({
        deltalar,
        katman: stil.layers.length,
        kaynak: Object.keys(stil.sources).length,
        symbol: stil.layers.filter((l) => l.type === 'symbol').length,
        zoom: map.getZoom(),
      });
    })();
  });
}

/**
 * Chip'i etiketiyle bulup tıklar; yoksa `false` döner.
 *
 * Eşleşme **tam değil**: bölge chip'leri etiketin başında bayrak emojisi
 * taşıyor ("🇹🇷 Likya Yolu"), tam eşleşme hiçbirini bulamıyor.
 */
async function chipTikla(page, etiket, bekleMs = 2500) {
  const chip = page.getByText(etiket).first();
  if (!(await chip.isVisible().catch(() => false))) return false;
  await chip.click();
  if (bekleMs) await page.waitForTimeout(bekleMs);
  return true;
}

/**
 * Bölge seçildikten sonra haritanın **tamamen çizilmesini** bekler ve geçen
 * süreyi döndürür.
 *
 * İlk sürümde bu iki adıma bölünmüştü (önce stil yüklendi mi, sonra idle) ve
 * 5 ms ölçüyordu: ilk bekleme işin çoğunu zaten yutuyordu. Ölçüm artık
 * sayfanın içinde, tek bir zaman çizgisinde yapılıyor.
 */
async function cizimiBekle(page, ms = 60000) {
  return page.evaluate(
    /* eslint-env browser */
    (limit) =>
      new Promise((bitir) => {
        const t0 = performance.now();
        const bak = () => {
          const map = (window.__ZIRTAN_MAPS__ || []).at(-1);
          if (map && map.isStyleLoaded() && map.loaded()) return bitir(performance.now() - t0);
          if (performance.now() - t0 > limit) {
            return bitir({
              hata: 'süre doldu',
              harita: Boolean(map),
              stil: Boolean(map && map.isStyleLoaded()),
              yuklu: Boolean(map && map.loaded()),
              sayi: (window.__ZIRTAN_MAPS__ || []).length,
              hatalar: (window.__ZIRTAN_MAP_ERRORS__ || []).slice(0, 5),
            });
          }
          setTimeout(bak, 50);
        };
        bak();
      }),
    ms,
  );
}

/**
 * Stilin gerçekten karo paketini taşıdığını doğrular.
 *
 * Bu kontrol olmasaydı ilk koşumdaki hata sessiz kalırdı: harita boş bir
 * yedek stille (6 katman, 0 metin) çizilmişti ve rapor "bütçe aşımı yok"
 * diyordu — hiçbir şey ölçülmediği için.
 */
async function paketiDogrula(page) {
  const bilgi = await page.evaluate(() => {
    const map = (window.__ZIRTAN_MAPS__ || []).at(-1);
    if (!map) return null;
    const stil = map.getStyle();
    return { kaynaklar: Object.keys(stil.sources), katman: stil.layers.length };
  });
  if (!bilgi) throw new Error('harita örneği yok — motor kurulamadı');
  if (!bilgi.kaynaklar.includes('zirtan-outdoor')) {
    throw new Error(
      `stilde karo paketi yok (kaynaklar: ${bilgi.kaynaklar.join(', ') || 'hiç'}) — ` +
        'karo sunucusu çalışıyor mu ve bölgenin paketi var mı?',
    );
  }
  return bilgi;
}

async function olc(page, etiket) {
  const sonuc = await page.evaluate(tarayicidaOlc, KAMERA_BETIGI);
  if (sonuc.hata) throw new Error(`${etiket}: ${sonuc.hata}`);
  return {
    ...kareOzeti(sonuc.deltalar),
    katman: sonuc.katman,
    kaynak: sonuc.kaynak,
    symbol: sonuc.symbol,
    zoom: sonuc.zoom,
  };
}

function argOku(argv) {
  const al = (ad, varsayilan) => {
    const i = argv.indexOf(`--${ad}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : varsayilan;
  };
  return {
    baseUrl: al('base-url', process.env.BASE_URL ?? 'http://localhost:8081'),
    route: al('route', '/maps/planner'),
    bolge: al('bolge', 'Likya Yolu'),
    out: al('out', resolve(ROOT, 'docs/health')),
    onceki: al('onceki', null),
  };
}

/** Rapor gövdesi — hem dosyaya yazılır hem konsola basılır. */
export function raporYaz(o) {
  const s = (n, b = 1) => (typeof n === 'number' ? n.toFixed(b) : '—');
  const satirlar = [
    `# Harita performansı — ${o.tarih}`,
    '',
    `Rota: \`${o.route}\` · bölge: **${o.bolge}** · zum ${s(o.zoom, 2)}`,
    '',
    '## Kesin metrikler (donanımdan bağımsız — bütçe kapısı)',
    '',
    '| Metrik | Ölçülen | Bütçe |',
    '| --- | ---: | ---: |',
    `| Karo isteği | ${o.karoIstek} | ${o.butce?.kesin?.karoIstek ?? '—'} |`,
    `| Karo baytı (KB) | ${s(o.karoBayt / 1024)} | ${o.butce?.kesin?.karoBaytKb ?? '—'} |`,
    `| Stil katmanı | ${o.katman} | ${o.butce?.kesin?.katman ?? '—'} |`,
    `| Kaynak | ${o.kaynak} | — |`,
    `| Metin katmanı | ${o.symbol} | — |`,
    '',
    '## Göstergeler (yazılım GL — gerçek GPU değil, koşumlar arası karşılaştırılır)',
    '',
    '| Gösterge | Değer |',
    '| --- | ---: |',
    `| İlk çizim (ms) | ${s(o.ilkCizimMs, 0)} |`,
    `| Kare p50 (ms) | ${s(o.kareP50Ms)} |`,
    `| Kare p95 (ms) | ${s(o.kareP95Ms)} |`,
    `| En uzun kare (ms) | ${s(o.kareEnUzunMs)} |`,
    `| Düşen kare (%) | ${s(o.dusenYuzde)} |`,
    `| Ortalama fps | ${s(o.fps)} |`,
    '',
    '## Katman gruplarının maliyeti',
    '',
    '| Grup | Kare p95 farkı (ms) | Düşen kare farkı (puan) |',
    '| --- | ---: | ---: |',
    `| Eğim gölgelendirme | ${s(o.egimMaliyeti?.kareP95Ms)} | ${s(o.egimMaliyeti?.dusenYuzde)} |`,
    `| 3B arazi | ${s(o.terrainMaliyeti?.kareP95Ms)} | ${s(o.terrainMaliyeti?.dusenYuzde)} |`,
    '',
  ];
  if (o.bulgular?.length) {
    satirlar.push('## Bütçe aşımları', '');
    for (const b of o.bulgular) satirlar.push(`- **${b.mesaj}**`);
    satirlar.push('');
  } else {
    satirlar.push('Bütçe aşımı yok.', '');
  }
  if (o.gerilemeler?.length) {
    satirlar.push('## Önceki koşuma göre', '', '| Gösterge | Değişim |', '| --- | ---: |');
    for (const g of o.gerilemeler) satirlar.push(`| ${g.anahtar} | ${g.yuzde > 0 ? '+' : ''}${s(g.yuzde)}% |`);
    satirlar.push('');
  }
  satirlar.push(
    '> Zamanlar başsız Chromium\'da yazılım GL ile ölçülür; mutlak değerleri',
    '> gerçek cihazı temsil etmez. Kapı yalnızca kesin metriklerdir.',
    '',
  );
  return satirlar.join('\n');
}

async function main() {
  const args = argOku(process.argv.slice(2));
  const { chromium } = playwrightYukle();
  const butce = JSON.parse(readFileSync(resolve(ROOT, 'agents/selfheal/budgets.json'), 'utf8')).maps;

  const browser = await chromium.launch({ args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'tr-TR',
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  const yanitlar = [];
  page.on('response', (r) => {
    const uzunluk = Number(r.headers()['content-length'] ?? 0);
    yanitlar.push({ url: r.url(), bayt: uzunluk });
  });

  try {
    // Giriş
    await page.goto(`${args.baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(6000);
    const eposta = page.getByText('E-posta ile devam et').first();
    if (await eposta.isVisible().catch(() => false)) {
      await eposta.click();
      await page.waitForTimeout(1500);
    }
    const alan = page.getByPlaceholder('sen@ornek.com').first();
    if (await alan.isVisible().catch(() => false)) {
      await alan.fill('perf@zirtan.app');
      await page.getByPlaceholder('••••••••').first().fill('perf12345');
      await page.getByRole('button', { name: 'Giriş yap' }).first().click();
      await page.waitForTimeout(8000);
    }

    await page.goto(`${args.baseUrl}${args.route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(14000);
    // Bekleme **yok**: ilk çizim süresi tıklamadan itibaren ölçülüyor.
    // (İlk sürümde tıklamadan sonra 2,5 sn bekleniyordu ve ölçüm 0 ms çıkıyordu.)
    if (!(await chipTikla(page, args.bolge, 0))) {
      // Hata ayıklamayı kolaylaştır: ekranda ne olduğunu göster.
      const gorunen = await page.locator('body').innerText().catch(() => '');
      const kare = resolve(tmpdir(), 'zirtan-maps-perf-hata.png');
      await page.screenshot({ path: kare }).catch(() => {});
      console.error(`ekran görüntüsü: ${kare}`);
      throw new Error(
        `bölge bulunamadı: ${args.bolge}\nEkrandaki metin:\n${gorunen.slice(0, 400)}`,
      );
    }

    const ilkCizimMs = await cizimiBekle(page);
    if (typeof ilkCizimMs !== 'number') {
      throw new Error(`harita süre içinde çizilmedi: ${JSON.stringify(ilkCizimMs)}`);
    }
    await paketiDogrula(page);
    yanitlar.length = 0; // ölçüm kamera betiğiyle başlar

    const temel = await olc(page, 'temel');
    const karo = karoOzeti(yanitlar);

    const egimAcildi = await chipTikla(page, 'Eğim açısı');
    const egim = egimAcildi ? await olc(page, 'eğim') : null;
    if (egimAcildi) await chipTikla(page, 'Eğim açısı');

    const terrainAcildi = await chipTikla(page, '3B arazi');
    const terrain = terrainAcildi ? await olc(page, '3B') : null;
    if (terrainAcildi) await chipTikla(page, '3B arazi');

    const olcum = {
      tarih: new Date().toISOString().slice(0, 10),
      route: args.route,
      bolge: args.bolge,
      zoom: temel.zoom,
      ilkCizimMs,
      kareP50Ms: temel.p50,
      kareP95Ms: temel.p95,
      kareEnUzunMs: temel.enUzun,
      dusenYuzde: temel.dusenYuzde,
      fps: temel.fps,
      katman: temel.katman,
      kaynak: temel.kaynak,
      symbol: temel.symbol,
      karoIstek: karo.istek,
      karoBayt: karo.bayt,
      karoBaytKb: karo.bayt / 1024,
      egimMaliyeti: egim ? katmanMaliyeti(temel, egim) : null,
      terrainMaliyeti: terrain ? katmanMaliyeti(temel, terrain) : null,
      butce,
    };

    const { bulgular } = butceKarsilastir(olcum, butce);
    olcum.bulgular = bulgular;

    if (args.onceki) {
      const eski = JSON.parse(readFileSync(args.onceki, 'utf8'));
      olcum.gerilemeler = ['ilkCizimMs', 'kareP95Ms', 'karoIstek', 'karoBaytKb']
        .map((a) => ({ anahtar: a, yuzde: gerilemeYuzdesi(eski[a], olcum[a]) }))
        .filter((g) => g.yuzde !== null);
    }

    mkdirSync(args.out, { recursive: true });
    const temelAd = `maps-perf-${olcum.tarih}`;
    writeFileSync(resolve(args.out, `${temelAd}.json`), JSON.stringify(olcum, null, 2));
    const rapor = raporYaz(olcum);
    writeFileSync(resolve(args.out, `${temelAd}.md`), rapor);
    console.log(rapor);
    console.log(`→ ${resolve(args.out, `${temelAd}.md`)}`);
    process.exitCode = bulgular.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
