/**
 * Zirtan web sitesi statik üreticisi.
 *
 *   node build.mjs            → dist/ (önce `npm run export` ile veri JSON'ları üretilmiş olmalı)
 *
 * Ortam değişkenleri:
 *   SITE_URL          Kanonik adres (ör. https://zirtan.app ya da https://user.github.io/repo). Alt yol otomatik algılanır.
 *   WAITLIST_ACTION   Bekleme listesi formunun POST hedefi (Formspree/Buttondown).
 *   APP_STORE_URL / PLAY_STORE_URL   Mağaza bağlantıları.
 *   GITHUB_URL        Kaynak kod bağlantısı.
 *   APP_SCHEME / APP_UNIVERSAL_URL   Derin bağlantı şeması (app.json: zirtan) ve evrensel bağlantı kökü.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { makeT, makeUrl, LANGS, esc } from './src/templates/lib.js';
import { layout } from './src/templates/layout.js';
import { homePage } from './src/templates/home.js';
import { routesIndex, routeDetail } from './src/templates/routes.js';
import { destinationsIndex, destinationDetail } from './src/templates/destinations.js';
import { placesIndex, placeDetail } from './src/templates/places.js';
import { climbingIndex, cragDetail } from './src/templates/climbing.js';
import { coursesPage } from './src/templates/courses.js';
import { proPage } from './src/templates/pro.js';
import { communityPage } from './src/templates/community.js';
import { safetyPage } from './src/templates/safety.js';
import {
  aboutPage,
  pressPage,
  legalPage,
  downloadPage,
  notFoundPage,
} from './src/templates/misc.js';
import {
  coverSvg,
  COVER_KINDS,
  logoMarkStandalone,
  wordmarkStandalone,
  faviconSvg,
} from './src/templates/illustrations.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const DATA_DIR = path.join(HERE, 'src/data/generated');

/* ------------------------------------------------------------------ Yapılandırma */
const siteUrlRaw = (process.env.SITE_URL || 'https://zirtan.app').replace(/\/$/, '');
const siteUrl = new URL(siteUrlRaw);
const basePath = siteUrl.pathname.replace(/\/$/, '');
const site = {
  origin: siteUrl.origin,
  basePath,
  baseUrl: `${siteUrl.origin}${basePath}`,
  assets: basePath,
  // Uygulama derin bağlantıları app.json'daki şema ve evrensel bağlantı alanını izler (şu an zirtan / zirtan.app).
  scheme: process.env.APP_SCHEME || 'zirtan',
  universalBase: (process.env.APP_UNIVERSAL_URL || 'https://zirtan.app').replace(/\/$/, ''),
  waitlistAction: process.env.WAITLIST_ACTION || 'https://formspree.io/f/REPLACE_WITH_FORM_ID',
  ios: process.env.APP_STORE_URL || 'https://apps.apple.com/tr/app/zirtan/id0000000000',
  android:
    process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.zirtan.app',
  github: process.env.GITHUB_URL || 'https://github.com/inandersim/claude',
  buildId: createHash('sha1').update(String(Date.now())).digest('hex').slice(0, 8),
};

/* ------------------------------------------------------------------ Veri */
function loadJson(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) throw new Error(`Veri yok: ${file} — önce \`npm run export\` çalıştırın.`);
  return JSON.parse(readFileSync(file, 'utf8'));
}
const data = Object.fromEntries(
  [
    'destinations',
    'routes',
    'places',
    'crags',
    'clubs',
    'groups',
    'instructors',
    'courses',
    'plans',
    'maps',
    'rescue',
    'meta',
  ].map((n) => [n, loadJson(n)]),
);
// Dalış bölgeleri için "trek rotası" anlamsız; rota listesinden çıkar.
data.routes = data.routes.filter((r) => {
  if (r.kind !== 'destination') return true;
  const d = data.destinations.find((x) => x.slug === r.destinationSlug);
  return d && d.type !== 'dive_region';
});
data.meta.counts.routes = data.routes.length;

const dicts = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(path.join(HERE, 'src/i18n', `${l}.json`), 'utf8'))]),
);
const url = makeUrl(basePath);

function ctxFor(lang) {
  const dict = dicts[lang];
  return { lang, t: makeT(dict), url, locale: dict.locale, site, data };
}

/* ------------------------------------------------------------------ Sayfa kaydı */
/** Her kayıt: { section, slug?, render(ctx) } — iki dilde de üretilir. */
const registry = [
  { section: 'home', render: (ctx) => homePage(ctx) },
  { section: 'routes', render: (ctx) => routesIndex(ctx) },
  ...data.routes.map((r) => ({
    section: 'routes',
    slug: r.slug,
    render: (ctx) => routeDetail(ctx, r),
  })),
  { section: 'destinations', render: (ctx) => destinationsIndex(ctx) },
  ...data.destinations.map((d) => ({
    section: 'destinations',
    slug: d.slug,
    render: (ctx) => destinationDetail(ctx, d),
  })),
  { section: 'places', render: (ctx) => placesIndex(ctx) },
  ...data.places.map((p) => ({
    section: 'places',
    slug: p.slug,
    render: (ctx) => placeDetail(ctx, p),
  })),
  { section: 'climbing', render: (ctx) => climbingIndex(ctx) },
  ...data.crags.map((c) => ({
    section: 'climbing',
    slug: c.slug,
    render: (ctx) => cragDetail(ctx, c),
  })),
  { section: 'courses', render: (ctx) => coursesPage(ctx) },
  { section: 'pro', render: (ctx) => proPage(ctx) },
  { section: 'community', render: (ctx) => communityPage(ctx) },
  { section: 'safety', render: (ctx) => safetyPage(ctx) },
  { section: 'about', render: (ctx) => aboutPage(ctx) },
  { section: 'press', render: (ctx) => pressPage(ctx) },
  { section: 'privacy', render: (ctx) => legalPage(ctx, 'privacy') },
  { section: 'kvkk', render: (ctx) => legalPage(ctx, 'kvkk') },
  { section: 'download', render: (ctx) => downloadPage(ctx) },
];

/* ------------------------------------------------------------------ Yardımcılar */
function writeFile(rel, content) {
  const file = path.join(DIST, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function sitePath(lang, section, slug) {
  return url(lang, section, slug).slice(basePath.length);
}

/* ------------------------------------------------------------------ GPX */
function cumulativeKm(points) {
  const out = [0];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    out.push(out[i - 1] + 2 * 6371 * Math.asin(Math.sqrt(s)));
  }
  return out;
}

function elevationAt(profile, km) {
  if (!profile?.length) return null;
  let prev = profile[0];
  for (const p of profile) {
    if (p[0] >= km) {
      const span = p[0] - prev[0];
      if (span <= 0) return p[1];
      const f = (km - prev[0]) / span;
      return Math.round(prev[1] + (p[1] - prev[1]) * f);
    }
    prev = p;
  }
  return profile[profile.length - 1][1];
}

function gpxFor(route) {
  const cum = cumulativeKm(route.points);
  const total = cum[cum.length - 1] || 1;
  const profileMax = route.profile?.length ? route.profile[route.profile.length - 1][0] : total;
  const pts = route.points
    .map((p, i) => {
      const km = (cum[i] / total) * profileMax;
      const ele = route.stages?.[i]?.elevationM ?? elevationAt(route.profile, km);
      return `      <trkpt lat="${p.latitude}" lon="${p.longitude}">${ele != null ? `<ele>${ele}</ele>` : ''}${route.stages?.[i] ? `<name>${esc(route.stages[i].name)}</name>` : ''}</trkpt>`;
    })
    .join('\n');
  const wpts = (route.stages ?? [])
    .map(
      (s, i) =>
        `  <wpt lat="${route.points[i].latitude}" lon="${route.points[i].longitude}"><ele>${s.elevationM}</ele><name>${esc(s.name)}</name><type>${esc(s.kind)}</type></wpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Zirtan — ${site.baseUrl}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${esc(route.name)}</name>
    <desc>${esc(route.locationName)} · ${route.distanceKm} km · +${route.ascentM} m</desc>
    <link href="${site.baseUrl}${sitePath('tr', 'routes', route.slug)}"><text>Zirtan</text></link>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
  <trk>
    <name>${esc(route.name)}</name>
    <type>${esc(route.activity)}</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/* ------------------------------------------------------------------ Üretim */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Statik dosyalar
const PUBLIC = path.join(HERE, 'public');
if (existsSync(PUBLIC)) cpSync(PUBLIC, DIST, { recursive: true });
cpSync(path.join(HERE, 'src/styles.css'), path.join(DIST, 'assets/styles.css'));
cpSync(path.join(HERE, 'src/client/site.js'), path.join(DIST, 'assets/site.js'));

// Üretilen SVG'ler
for (const kind of COVER_KINDS) writeFile(`img/covers/${kind}.svg`, coverSvg(kind));
writeFile('img/logo-mark.svg', logoMarkStandalone());
writeFile('img/logo-wordmark.svg', wordmarkStandalone(false));
writeFile('img/logo-wordmark-dark.svg', wordmarkStandalone(true));
writeFile('favicon.svg', faviconSvg());

// GPX
for (const r of data.routes) writeFile(`gpx/${r.slug}.gpx`, gpxFor(r));

// Sayfalar
const sitemap = [];
let pageCount = 0;
for (const entry of registry) {
  const altPaths = Object.fromEntries(
    LANGS.map((l) => [l, sitePath(l, entry.section, entry.slug)]),
  );
  for (const lang of LANGS) {
    const ctx = ctxFor(lang);
    const page = entry.render(ctx);
    const p = altPaths[lang];
    const html = layout(ctx, { ...page, path: p, altPaths });
    writeFile(`${p}index.html`.replace(/^\//, ''), html);
    pageCount += 1;
  }
  sitemap.push({ altPaths, priority: entry.slug ? 0.7 : entry.section === 'home' ? 1 : 0.8 });
}

// 404 (kök; GitHub Pages ve Cloudflare Pages kökteki 404.html'i kullanır)
{
  const ctx = ctxFor('tr');
  const page = notFoundPage(ctx);
  writeFile(
    '404.html',
    layout(ctx, { ...page, path: '/404.html', altPaths: { tr: '/', en: '/en/' } }),
  );
  const ctxEn = ctxFor('en');
  const pageEn = notFoundPage(ctxEn);
  writeFile(
    'en/404.html',
    layout(ctxEn, { ...pageEn, path: '/en/404.html', altPaths: { tr: '/', en: '/en/' } }),
  );
  pageCount += 2;
}

// sitemap.xml + robots.txt + manifest
const lastmod = new Date().toISOString().slice(0, 10);
writeFile(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap
  .flatMap((s) =>
    LANGS.map(
      (l) => `  <url>
    <loc>${site.baseUrl}${s.altPaths[l]}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${s.priority}</priority>
${LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${site.baseUrl}${s.altPaths[a]}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.baseUrl}${s.altPaths.tr}"/>
  </url>`,
    ),
  )
  .join('\n')}
</urlset>
`,
);
writeFile('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
writeFile(
  'manifest.webmanifest',
  JSON.stringify(
    {
      name: 'Zirtan',
      short_name: 'Zirtan',
      description: dicts.tr.site.description,
      start_url: `${basePath}/`,
      display: 'browser',
      background_color: '#F5F1E8',
      theme_color: '#2F7D4F',
      lang: 'tr',
      icons: [{ src: `${basePath}/img/logo-mark.svg`, sizes: 'any', type: 'image/svg+xml' }],
    },
    null,
    2,
  ),
);
// Cloudflare Pages / Netlify: temiz URL'ler zaten dizin/index.html; ek başlıklar.
writeFile(
  '_headers',
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=604800\n`,
);
writeFile('.nojekyll', '');

function countFiles(dir, ext) {
  let n = 0;
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) n += countFiles(f, ext);
    else if (f.endsWith(ext)) n += 1;
  }
  return n;
}
console.log(
  `✔ build: ${pageCount} HTML sayfa (${countFiles(DIST, '.html')} dosya), ${data.routes.length} GPX, base=${site.baseUrl}`,
);
