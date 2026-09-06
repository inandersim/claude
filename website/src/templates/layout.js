/**
 * Sayfa iskeleti: <head> (SEO, hreflang, Open Graph, JSON-LD), üst gezinme ve altbilgi.
 */
import { esc, jsonLd, LANGS, SECTIONS } from './lib.js';
import { icon } from './icons.js';
import { logoMark } from './illustrations.js';

const NAV_MAIN = [
  'routes',
  'destinations',
  'places',
  'climbing',
  'courses',
  'community',
  'safety',
  'pro',
];
const FOOTER_GROUPS = {
  explore: ['routes', 'destinations', 'places', 'climbing'],
  product: ['courses', 'pro', 'community', 'safety', 'download'],
  company: ['about', 'press'],
  legal: ['privacy', 'kvkk'],
};

export function layout(ctx, page) {
  const { lang, t, url, site, locale } = ctx;
  const {
    path,
    altPaths = {},
    title,
    description,
    body,
    ld = [],
    ogImage,
    bodyClass = '',
    noindex = false,
    section = 'home',
    extraHead = '',
  } = page;
  const canonical = `${site.baseUrl}${path}`;
  const og = ogImage ?? `${site.baseUrl}${site.assets}/img/og-default.png`;
  const fullTitle = title.includes('Zirtan') ? title : `${title} · Zirtan`;
  const hreflangs = LANGS.filter((l) => altPaths[l])
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}${altPaths[l]}"/>`)
    .join('\n    ');
  const xDefault = altPaths.tr
    ? `<link rel="alternate" hreflang="x-default" href="${site.baseUrl}${altPaths.tr}"/>`
    : '';

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Zirtan',
    url: site.baseUrl,
    logo: `${site.baseUrl}${site.assets}/img/logo-mark.svg`,
    sameAs: [site.github],
  };

  return `<!doctype html>
<html lang="${lang}" data-theme="light">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(description)}"/>
    ${noindex ? '<meta name="robots" content="noindex"/>' : ''}
    <link rel="canonical" href="${canonical}"/>
    ${hreflangs}
    ${xDefault}
    <meta name="color-scheme" content="light dark"/>
    <meta name="theme-color" content="#F5F1E8" media="(prefers-color-scheme: light)"/>
    <meta name="theme-color" content="#10201B" media="(prefers-color-scheme: dark)"/>
    <meta property="og:type" content="website"/>
    <meta property="og:site_name" content="Zirtan"/>
    <meta property="og:locale" content="${locale.replace('-', '_')}"/>
    <meta property="og:title" content="${esc(fullTitle)}"/>
    <meta property="og:description" content="${esc(description)}"/>
    <meta property="og:url" content="${canonical}"/>
    <meta property="og:image" content="${og}"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="${esc(fullTitle)}"/>
    <meta name="twitter:description" content="${esc(description)}"/>
    <meta name="twitter:image" content="${og}"/>
    <link rel="icon" href="${site.assets}/favicon.svg" type="image/svg+xml"/>
    <link rel="apple-touch-icon" href="${site.assets}/img/logo-mark.svg"/>
    <link rel="manifest" href="${site.assets}/manifest.webmanifest"/>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"/>
    <link rel="stylesheet" href="${site.assets}/assets/styles.css?v=${site.buildId}"/>
    <script>
      try {
        var th = localStorage.getItem('zirtan-theme');
        if (th === 'dark' || (th !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
      } catch (e) {}
    </script>
    ${jsonLd(orgLd)}
    ${ld.map(jsonLd).join('\n    ')}
    ${extraHead}
  </head>
  <body class="${esc(bodyClass)}">
    <a class="skip" href="#main">${esc(t('nav.skip'))}</a>
    ${header(ctx, section, altPaths)}
    <main id="main">
${body}
    </main>
    ${footer(ctx, altPaths)}
    <script src="${site.assets}/assets/site.js?v=${site.buildId}" defer></script>
  </body>
</html>
`;
}

function header(ctx, section, altPaths) {
  const { lang, t, url } = ctx;
  const items = NAV_MAIN.map(
    (s) =>
      `<li><a href="${url(lang, s)}" ${s === section ? 'aria-current="page"' : ''}>${esc(t(`nav.${s}`))}</a></li>`,
  ).join('');
  return `<header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="${url(lang, 'home')}" aria-label="Zirtan — ${esc(t('nav.home'))}">
          ${logoMark(34)}
          <span class="brand-name">Zirtan</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
          ${icon('menu', 'ico ico-menu')}${icon('x', 'ico ico-close')}
          <span class="sr-only">${esc(t('nav.menu'))}</span>
        </button>
        <nav id="site-nav" class="site-nav" aria-label="${esc(t('nav.menu'))}">
          <ul>${items}</ul>
          <div class="nav-actions">
            ${langSwitch(ctx, altPaths, 'nav-lang')}
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="${esc(t('nav.theme'))}" title="${esc(t('nav.theme'))}">
              ${icon('sun', 'ico ico-sun')}${icon('moon', 'ico ico-moon')}
            </button>
            <a class="btn btn-primary btn-sm" href="${url(lang, 'download')}">${esc(t('nav.download'))}</a>
          </div>
        </nav>
      </div>
    </header>`;
}

function langSwitch(ctx, altPaths, cls) {
  const { lang, site } = ctx;
  return `<div class="lang-switch ${cls}" role="group" aria-label="${esc(ctx.t('nav.language'))}">
      ${LANGS.map((l) => {
        const href = altPaths[l]
          ? `${site.basePath}${altPaths[l]}`.replace(/\/\/+/g, '/')
          : ctx.url(l, 'home');
        return `<a href="${href}" hreflang="${l}" lang="${l}" ${l === lang ? 'aria-current="true"' : ''}>${l.toUpperCase()}</a>`;
      }).join('')}
    </div>`;
}

function footer(ctx, altPaths) {
  const { lang, t, url, site } = ctx;
  const groups = Object.entries(FOOTER_GROUPS)
    .map(
      ([g, keys]) => `<div class="footer-col">
          <h2>${esc(t(`nav.${g}`))}</h2>
          <ul>${keys.map((k) => `<li><a href="${url(lang, k)}">${esc(t(`nav.${k}`))}</a></li>`).join('')}</ul>
        </div>`,
    )
    .join('');
  return `<footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="brand" href="${url(lang, 'home')}">${logoMark(36)}<span class="brand-name">Zirtan</span></a>
            <p>${esc(t('footer.tagline'))}</p>
            <div class="social">
              <a href="${esc(site.github)}" rel="noopener" aria-label="${esc(t('footer.github'))}">${icon('github')}</a>
              <a href="https://instagram.com/zirtanapp" rel="noopener" aria-label="${esc(t('footer.instagram'))}">${icon('instagram')}</a>
              <a href="https://x.com/zirtanapp" rel="noopener" aria-label="${esc(t('footer.x'))}">${icon('x-social')}</a>
              <a href="https://youtube.com/@zirtanapp" rel="noopener" aria-label="${esc(t('footer.youtube'))}">${icon('youtube')}</a>
            </div>
            ${langSwitch(ctx, altPaths, 'footer-lang')}
          </div>
          ${groups}
        </div>
        <div class="footer-bottom">
          <p>${esc(t('footer.rights', { year: new Date().getFullYear() }))} ${esc(t('footer.madeIn'))}</p>
          <p>${esc(t('footer.osm'))}</p>
        </div>
      </div>
    </footer>`;
}

export { SECTIONS };
