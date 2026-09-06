/**
 * dist/ içindeki HTML dosyalarını tarar; iç bağlantı (href/src/action, `/` ile başlayan ya da göreli)
 * hedeflerinin var olup olmadığını doğrular. Ayrıca hreflang/canonical ve sitemap girdilerini kontrol eder.
 *
 *   node scripts/check-links.mjs [dist]  → sıfır dışı çıkış kodu = kırık bağlantı var
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(process.argv[2] || path.join(HERE, '../dist'));
const siteUrl = (process.env.SITE_URL || 'https://zirtan.app').replace(/\/$/, '');
const basePath = new URL(siteUrl).pathname.replace(/\/$/, '');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (f.endsWith('.html')) out.push(f);
  }
  return out;
}

function resolveTarget(fromFile, target) {
  let t = target.split('#')[0].split('?')[0];
  if (!t) return null; // yalnızca fragment
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:/i.test(t)) return null; // mailto:, tel:, zirve:// vb.
  if (t.startsWith('//')) return null;
  let abs;
  if (t.startsWith('/')) {
    if (basePath && t.startsWith(basePath + '/')) t = t.slice(basePath.length);
    abs = path.join(DIST, decodeURIComponent(t));
  } else {
    abs = path.resolve(path.dirname(fromFile), decodeURIComponent(t));
  }
  return abs;
}

function exists(abs) {
  if (!existsSync(abs)) return false;
  if (statSync(abs).isDirectory()) return existsSync(path.join(abs, 'index.html'));
  return true;
}

const files = walk(DIST);
const broken = [];
let checked = 0;
const attrRe = /\s(?:href|src|action)=["']([^"']+)["']/g;
const metaRe = /<meta[^>]+content=["'](https?:[^"']+)["']/g;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  let m;
  while ((m = attrRe.exec(html))) {
    const target = m[1];
    if (/^https?:/i.test(target)) {
      // Kendi sitemize mutlak bağlantıysa yerelde doğrula
      if (target.startsWith(siteUrl + '/')) {
        const abs = path.join(
          DIST,
          decodeURIComponent(new URL(target).pathname.slice(basePath.length).split('#')[0]),
        );
        checked += 1;
        if (!exists(abs)) broken.push({ file, target });
      }
      continue;
    }
    const abs = resolveTarget(file, target);
    if (!abs) continue;
    checked += 1;
    if (!exists(abs)) broken.push({ file, target });
  }
  // Meta etiketlerindeki (og:image vb.) kendi sitemize ait mutlak adresler
  for (const mm of html.matchAll(metaRe)) {
    if (!mm[1].startsWith(siteUrl + '/')) continue;
    checked += 1;
    const abs = path.join(DIST, decodeURIComponent(new URL(mm[1]).pathname.slice(basePath.length)));
    if (!exists(abs)) broken.push({ file, target: mm[1] });
  }
  // Fragment hedefleri (aynı sayfa)
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((x) => x[1]));
  for (const frag of html.matchAll(/\shref=["']#([^"']+)["']/g)) {
    checked += 1;
    if (!ids.has(frag[1])) broken.push({ file, target: `#${frag[1]}` });
  }
}

// Sitemap girdileri
const sitemapFile = path.join(DIST, 'sitemap.xml');
if (existsSync(sitemapFile)) {
  const xml = readFileSync(sitemapFile, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    checked += 1;
    const p = new URL(m[1]).pathname.slice(basePath.length);
    if (!exists(path.join(DIST, decodeURIComponent(p))))
      broken.push({ file: 'sitemap.xml', target: m[1] });
  }
}

const rel = (f) => path.relative(DIST, f);
if (broken.length) {
  console.error(`✖ ${broken.length} kırık bağlantı (${checked} kontrol, ${files.length} HTML):`);
  for (const b of broken.slice(0, 80)) console.error(`  ${rel(b.file)} → ${b.target}`);
  process.exit(1);
} else {
  console.log(`✔ kırık bağlantı yok (${checked} kontrol, ${files.length} HTML)`);
}
