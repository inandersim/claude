/**
 * Yeniden kullanılan bileşenler: bölüm başlığı, kartlar, istatistik kutuları, harita bloğu,
 * filtre çubuğu, SSS, bekleme listesi formu, breadcrumb.
 */
import {
  esc,
  fmtKm,
  fmtM,
  fmtDuration,
  fmtNumber,
  countryName,
  flag,
  DIFFICULTY_COLORS,
  truncate,
} from './lib.js';
import { icon, ADVENTURE_ICON, PLACE_ICON } from './icons.js';

export function sectionHead({ kicker, title, lead, id, level = 2, cls = '' }) {
  const H = `h${level}`;
  return `<div class="section-head ${cls}" ${id ? `id="${id}"` : ''}>
  ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
  <${H}>${esc(title)}</${H}>
  ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
</div>`;
}

export function pageHero({ kicker, title, lead, extra = '', cls = '' }) {
  return `<section class="page-hero ${cls}">
  <div class="container">
    ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${extra}
  </div>
</section>`;
}

export function breadcrumbs(ctx, items) {
  const { t, url, lang, site } = ctx;
  const all = [{ label: t('common.breadcrumbHome'), href: url(lang, 'home') }, ...items];
  const html = `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${all
    .map((it, i) =>
      i === all.length - 1
        ? `<li aria-current="page">${esc(it.label)}</li>`
        : `<li><a href="${it.href}">${esc(it.label)}</a></li>`,
    )
    .join('')}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${site.baseUrl}${it.href.replace(site.basePath, '')}` } : {}),
    })),
  };
  return { html, ld };
}

export function pill(label, { cls = '', iconName, color } = {}) {
  const style = color ? ` style="--pill:${color}"` : '';
  return `<span class="pill ${cls}"${style}>${iconName ? icon(iconName, 'ico ico-xs') : ''}${esc(label)}</span>`;
}

export function difficultyPill(level, t) {
  return pill(t(`difficulty.${level}`), { cls: 'pill-diff', color: DIFFICULTY_COLORS[level] });
}

export function statTiles(items) {
  return `<dl class="stats">${items
    .filter((it) => it.value !== undefined && it.value !== null && it.value !== '')
    .map(
      (it) => `<div class="stat">
    ${it.icon ? icon(it.icon, 'ico stat-ico') : ''}
    <dt>${esc(it.label)}</dt>
    <dd>${esc(it.value)}</dd>
  </div>`,
    )
    .join('')}</dl>`;
}

export function cover(kind, alt = '', ctx) {
  return `<img class="cover" src="${ctx.site.assets}/img/covers/${kind}.svg" alt="${esc(alt)}" width="640" height="360" loading="lazy" decoding="async"/>`;
}

/* ---------------------------------------------------------------- Kartlar */

export function routeCard(ctx, r) {
  const { t, url, lang, locale } = ctx;
  const meta = [
    `${icon('ruler', 'ico ico-xs')} ${fmtKm(r.distanceKm, t, locale)}`,
    `${icon('trending-up', 'ico ico-xs')} ${fmtM(r.ascentM, t, locale)}`,
    `${icon('clock', 'ico ico-xs')} ${r.days ? `${r.days} ${t('common.days')}` : fmtDuration(r.durationMin, t)}`,
  ].join('<span aria-hidden="true">·</span>');
  return `<article class="card card-route" data-item data-name="${esc(r.name.toLowerCase())} ${esc(r.locationName.toLowerCase())}" data-type="${r.adventureType}" data-difficulty="${r.difficulty}" data-kind="${r.kind}" data-distance="${r.distanceKm}" data-ascent="${r.ascentM}" data-country="${r.countryCode}">
  <a class="card-media" href="${url(lang, 'routes', r.slug)}" tabindex="-1" aria-hidden="true">
    ${cover(r.adventureType, '', ctx)}
    <span class="card-badge">${icon(ADVENTURE_ICON[r.adventureType] ?? 'compass', 'ico ico-xs')}${esc(t(`activity.${r.activity}`) !== `activity.${r.activity}` ? t(`activity.${r.activity}`) : t(`adventure.${r.adventureType}`))}</span>
  </a>
  <div class="card-body">
    <h3><a href="${url(lang, 'routes', r.slug)}">${esc(r.name)}</a></h3>
    <p class="card-sub">${flag(r.countryCode)} ${esc(r.locationName)}</p>
    <p class="card-meta">${meta}</p>
    <div class="card-foot">${difficultyPill(r.difficulty, t)}<span class="muted small">${esc(t(`routeKind.${r.kind}`))}</span></div>
  </div>
</article>`;
}

export function destinationCard(ctx, d) {
  const { t, url, lang, locale } = ctx;
  return `<article class="card card-dest" data-item data-name="${esc(d.name.toLowerCase())} ${esc(d.region.toLowerCase())} ${esc(countryName(d.countryCode, locale).toLowerCase())}" data-type="${d.type}" data-country="${d.countryCode}" data-months="${d.bestMonths.join(',')}" data-difficulty="${d.difficulty}">
  <a class="card-media" href="${url(lang, 'destinations', d.slug)}" tabindex="-1" aria-hidden="true">
    ${cover(d.adventureTypes[0] ?? 'default', '', ctx)}
    <span class="card-badge">${flag(d.countryCode)} ${esc(countryName(d.countryCode, locale))}</span>
  </a>
  <div class="card-body">
    <h3><a href="${url(lang, 'destinations', d.slug)}">${esc(d.name)}</a></h3>
    <p class="card-sub">${esc(d.region)} · ${esc(t(`destType.${d.type}`))}</p>
    <p class="card-meta">${icon('calendar', 'ico ico-xs')} ${d.typicalDays} ${t('common.days')}<span aria-hidden="true">·</span>${icon('mountain-snow', 'ico ico-xs')} ${fmtM(d.maxElevationM, t, locale)}<span aria-hidden="true">·</span>${icon('star', 'ico ico-xs')} ${fmtNumber(d.rating, locale, 1)}</p>
    <div class="card-foot">${difficultyPill(d.difficulty, t)}<span class="muted small">${d.stageCount} ${t('common.stages').toLowerCase()}</span></div>
  </div>
</article>`;
}

export function placeCard(ctx, p) {
  const { t, url, lang, locale } = ctx;
  return `<article class="card card-place" data-item data-name="${esc(p.name.toLowerCase())} ${esc((p.countryCode ? countryName(p.countryCode, locale) : '').toLowerCase())}" data-type="${p.kind}" data-country="${p.countryCode ?? ''}">
  <a class="card-media card-media-sm" href="${url(lang, 'places', p.slug)}" tabindex="-1" aria-hidden="true">
    ${cover(p.kind, '', ctx)}
    <span class="card-badge">${icon(PLACE_ICON[p.kind] ?? 'map-pin', 'ico ico-xs')}${esc(t(`placeKind.${p.kind}`))}</span>
  </a>
  <div class="card-body">
    <h3><a href="${url(lang, 'places', p.slug)}">${esc(p.name)}</a></h3>
    <p class="card-sub">${p.countryCode ? `${flag(p.countryCode)} ${esc(countryName(p.countryCode, locale))}` : ''}${p.elevationM != null ? ` · ${fmtM(p.elevationM, t, locale)}` : ''}</p>
    ${p.description ? `<p class="card-text">${esc(truncate(p.description, 120))}</p>` : ''}
  </div>
</article>`;
}

export function cragCard(ctx, c) {
  const { t, url, lang, locale } = ctx;
  return `<article class="card card-crag" data-item data-name="${esc(c.name.toLowerCase())} ${esc(c.locationName.toLowerCase())}" data-type="${c.climbTypes[0]}" data-country="${c.countryCode}">
  <a class="card-media card-media-sm" href="${url(lang, 'climbing', c.slug)}" tabindex="-1" aria-hidden="true">
    ${cover('climbing', '', ctx)}
    <span class="card-badge">${flag(c.countryCode)} ${esc(countryName(c.countryCode, locale))}</span>
  </a>
  <div class="card-body">
    <h3><a href="${url(lang, 'climbing', c.slug)}">${esc(c.name)}</a></h3>
    <p class="card-sub">${esc(c.locationName)} · ${esc(c.rockType)}</p>
    <p class="card-meta">${icon('route', 'ico ico-xs')} ${c.routeCount} ${t('common.routes')}<span aria-hidden="true">·</span>${icon('layers', 'ico ico-xs')} ${c.sectors.length} ${t('common.sectors')}<span aria-hidden="true">·</span>${icon('footprints', 'ico ico-xs')} ${c.approachMin} ${t('common.min')}</p>
    <div class="card-foot">${c.climbTypes.map((ct) => pill(t(`climbType.${ct}`), { cls: 'pill-soft' })).join('')}${verificationPill(c.verification, t)}</div>
  </div>
</article>`;
}

export function verificationPill(status, t) {
  const map = {
    verified: ['common.verified', 'check-circle', '#2F7D4F'],
    community: ['common.community', 'users', '#3A8DDE'],
    unverified: ['common.unverified', 'info', '#8A8F98'],
  };
  const [key, ic, color] = map[status] ?? map.unverified;
  return pill(t(key), { iconName: ic, color, cls: 'pill-diff' });
}

/* -------------------------------------------------------------- Filtreler */

export function filterBar(ctx, { selects = [], searchId = 'q', total }) {
  const { t } = ctx;
  return `<div class="filters" data-filter-root>
  <label class="search">
    ${icon('search')}
    <span class="sr-only">${esc(t('common.search'))}</span>
    <input type="search" id="${searchId}" data-filter-search placeholder="${esc(t('common.searchPlaceholder'))}" autocomplete="off"/>
  </label>
  ${selects
    .map(
      (s) => `<label class="select">
    <span>${esc(s.label)}</span>
    <select data-filter-attr="${s.attr}" ${s.mode ? `data-filter-mode="${s.mode}"` : ''}>
      <option value="">${esc(t('common.all'))}</option>
      ${s.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
    </select>
  </label>`,
    )
    .join('')}
  <p class="filter-count" data-filter-count data-template="${esc(t('common.results', { n: '{n}' }))}">${esc(t('common.results', { n: total }))}</p>
  <p class="filter-empty" data-filter-empty hidden>${esc(t('common.noResults'))}</p>
</div>`;
}

/* ------------------------------------------------------------------ Harita */

/**
 * Leaflet haritası; JS yoksa OSM bağlantısı gösterir.
 * kind: 'routes' | 'route' | 'points' | 'graph'; data satır içi JSON olarak gömülür.
 */
export function mapBlock(ctx, { id, kind, data, center, zoom = 7, height = 'md', title }) {
  const { t } = ctx;
  const c = center ?? { lat: 39, lng: 35 };
  const osm = `https://www.openstreetmap.org/?mlat=${c.lat.toFixed(5)}&mlon=${c.lng.toFixed(5)}#map=${zoom}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`;
  return `<div class="map map-${height}" id="${id}" data-map="${kind}" data-center="${c.lat},${c.lng}" data-zoom="${zoom}" ${title ? `role="region" aria-label="${esc(title)}"` : ''}>
  <script type="application/json" data-map-data>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  <div class="map-fallback">
    ${icon('map', 'ico ico-lg')}
    <p>${esc(t('common.mapNoJs'))}</p>
    <a class="btn btn-ghost btn-sm" href="${osm}" rel="noopener">${esc(t('common.openOsm'))}</a>
    <p class="muted small">${esc(t('common.mapAttribution'))}</p>
  </div>
</div>`;
}

/* --------------------------------------------------------------------- SSS */

export function faq(items, { ld = true } = {}) {
  const html = `<div class="faq">${items
    .map(
      (it) => `<details class="faq-item">
    <summary>${esc(it.q)}${icon('chevron-down', 'ico faq-ico')}</summary>
    <div class="faq-body"><p>${esc(it.a)}</p></div>
  </details>`,
    )
    .join('')}</div>`;
  const json = ld
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((it) => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: it.a },
        })),
      }
    : null;
  return { html, ld: json };
}

/* ----------------------------------------------------------- Bekleme listesi */

export function waitlist(ctx, { compact = false } = {}) {
  const { t, url, lang, site } = ctx;
  return `<form class="waitlist ${compact ? 'waitlist-compact' : ''}" action="${esc(site.waitlistAction)}" method="post" data-waitlist data-thanks="${esc(t('home.waitlistThanks'))}" data-error="${esc(t('home.waitlistError'))}">
  <label class="sr-only" for="wl-email-${compact ? 'c' : 'f'}">${esc(t('common.email'))}</label>
  <div class="waitlist-row">
    <input id="wl-email-${compact ? 'c' : 'f'}" type="email" name="email" required placeholder="${esc(t('home.waitlistPlaceholder'))}" autocomplete="email"/>
    <input type="hidden" name="lang" value="${lang}"/>
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true"/>
    <button class="btn btn-primary" type="submit">${esc(t('home.waitlistButton'))}</button>
  </div>
  <p class="small muted">${esc(t('home.waitlistPrivacy'))} <a href="${url(lang, 'privacy')}">${esc(t('nav.privacy'))}</a></p>
  <p class="waitlist-msg" role="status" aria-live="polite"></p>
</form>`;
}

/* --------------------------------------------------------- Uygulamada aç */

export function appLinks(ctx, { appPath, gpxHref, lead }) {
  const { t, url, lang, site } = ctx;
  return `<div class="app-links">
  ${lead ? `<p>${esc(lead)}</p>` : ''}
  <div class="btn-row">
    <a class="btn btn-primary" href="${esc(site.scheme)}://${esc(appPath)}" data-deeplink="${esc(appPath)}">${icon('zap')}${esc(t('common.openInApp'))}</a>
    ${gpxHref ? `<a class="btn btn-secondary" href="${esc(gpxHref)}" download>${icon('download')}${esc(t('common.downloadGpx'))}</a>` : ''}
    <a class="btn btn-ghost" href="${url(lang, 'download')}">${esc(t('routes.noApp'))} ${icon('arrow-right', 'ico ico-xs')}</a>
  </div>
  <p class="small muted"><code>${esc(site.scheme)}://${esc(appPath)}</code> · <code>${esc(site.universalBase)}/${esc(appPath)}</code></p>
</div>`;
}

export function monthStrip(months, t) {
  const short = t('monthsShort');
  return `<ol class="months" aria-label="${esc(t('common.bestMonths'))}">${short
    .map(
      (m, i) =>
        `<li class="${months.includes(i + 1) ? 'on' : ''}"><abbr title="${esc(t('months')[i])}">${esc(m)}</abbr></li>`,
    )
    .join('')}</ol>`;
}

export function chips(items) {
  return `<ul class="chips">${items.map((c) => `<li>${c}</li>`).join('')}</ul>`;
}
