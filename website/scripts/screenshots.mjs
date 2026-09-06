/**
 * dist/ sitesini geçici olarak sunar ve Playwright ile masaüstü (1280×800) + mobil (390×844)
 * ekran görüntülerini alır.
 *
 *   node scripts/screenshots.mjs [outDir] [port]
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, '../.cache/shots'));
const PORT = Number(process.argv[3] || 8140);
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(
    process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright',
  ));
} catch {
  ({ chromium } = require('playwright'));
}

const PAGES = [
  ['home', '/'],
  ['home-en', '/en/'],
  ['routes', '/rotalar/'],
  ['route-detail', '/rotalar/olgunlar-kackar-zirvesi/'],
  ['destinations', '/destinasyonlar/'],
  ['destination-detail', '/destinasyonlar/likya-yolu/'],
  ['places', '/yerler/'],
  ['climbing-detail', '/tirmanis/geyikbayiri/'],
  ['pro', '/pro/'],
  ['safety', '/guvenlik/'],
];
const VIEWPORTS = [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }],
];

mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, '../serve.mjs'), String(PORT)], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch();
try {
  for (const [vpName, vp] of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const [name, p] of PAGES) {
      await page
        .goto(`http://localhost:${PORT}${p}`, { waitUntil: 'load', timeout: 30000 })
        .catch(() => {});
      await page.waitForTimeout(600);
      const file = path.join(OUT, `${name}-${vpName}.png`);
      await page.screenshot({
        path: file,
        fullPage: name !== 'home' || vpName === 'mobile' ? false : false,
      });
      console.log(`✔ ${file}`);
    }
    if (errors.length) console.warn('⚠ JS hataları:', errors.slice(0, 5));
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
