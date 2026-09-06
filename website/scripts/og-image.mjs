/**
 * Open Graph görselini (1200×630 PNG) Playwright ile üretir → public/img/og-default.png
 * Playwright global kurulumdan (PLAYWRIGHT_PATH) ya da node_modules'tan yüklenir; CI'da gerekmez,
 * üretilen PNG depoya eklenir.
 *
 *   node scripts/og-image.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../public/img/og-default.png');
const require = createRequire(import.meta.url);
const pwPath = process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright';
let chromium;
try {
  ({ chromium } = require(pwPath));
} catch {
  ({ chromium } = require('playwright'));
}

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{margin:0;width:1200px;height:630px;font-family:Manrope,Inter,system-ui,sans-serif;overflow:hidden;background:#F5F1E8}
  .wrap{position:relative;width:1200px;height:630px}
  svg.bg{position:absolute;inset:0}
  .copy{position:absolute;left:72px;top:72px;right:72px;color:#16241f}
  .brand{display:flex;align-items:center;gap:18px;font-size:44px;font-weight:800;letter-spacing:-1px}
  .mark{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#3A8DDE,#2F7D4F);position:relative}
  .mark:after{content:"";position:absolute;left:10px;top:22px;border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:28px solid #F5F1E8}
  h1{font-size:64px;line-height:1.05;letter-spacing:-2px;margin:36px 0 18px;max-width:900px}
  p{font-size:28px;color:#4d5a55;margin:0;max-width:820px;line-height:1.35}
  .tags{position:absolute;left:72px;bottom:64px;display:flex;gap:12px}
  .tag{padding:10px 18px;border-radius:999px;background:#fff;border:1px solid #ddd6c7;font-size:22px;font-weight:700;color:#2F7D4F}
</style></head><body><div class="wrap">
<svg class="bg" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMax slice">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#f7e6d3"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#s)"/>
  <circle cx="980" cy="200" r="70" fill="#E8722A" opacity=".85"/>
  <path fill="#5f9bd6" d="M0 470 120 380 210 430 330 310 440 400 520 350 620 440 700 380 800 470 900 350 1000 430 1100 370 1200 450V630H0Z"/>
  <path fill="#3f7f5a" d="M0 520 90 460 180 500 300 430 420 500 500 460 620 520 740 450 840 510 960 430 1060 500 1180 450 1200 520V630H0Z"/>
  <path fill="#2f6a48" d="M0 570 110 530 220 560 340 520 460 560 580 530 700 570 820 520 930 560 1050 530 1200 570V630H0Z"/>
</svg>
<div class="copy">
  <div class="brand"><span class="mark"></span>Zirtan</div>
  <h1>Maceranı planla, paylaş, güvende kal</h1>
  <p>Rota planlayıcı · tehlike haritası · ZMatch · canlı yayın · uydu SOS · destinasyon arşivi</p>
</div>
<div class="tags"><span class="tag">Yürüyüş</span><span class="tag">Tırmanış</span><span class="tag">Dalış</span><span class="tag">Kayak</span><span class="tag">Bisiklet</span></div>
</div></body></html>`;

mkdirSync(path.dirname(OUT), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();
console.log(`✔ ${OUT}`);
