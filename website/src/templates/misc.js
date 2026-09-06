/** Hakkımızda, Basın, Gizlilik, KVKK, İndir, 404 */
import { esc } from './lib.js';
import { icon } from './icons.js';
import { pageHero, breadcrumbs, waitlist } from './components.js';
import { storeBadges, qrPlaceholder, logoMark, phone } from './illustrations.js';

export function aboutPage(ctx) {
  const { t, site } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.about') }]);
  const body = `
${pageHero({ kicker: t('about.kicker'), title: t('about.title'), lead: t('about.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container narrow prose">
    <h2>${esc(t('about.missionTitle'))}</h2>
    <p>${esc(t('about.mission'))}</p>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('about.valuesTitle'))}</h2>
    <ul class="feature-grid feature-grid-4">
      ${t('about.values')
        .map(
          (v, i) =>
            `<li class="feature"><span class="feature-ico">${icon(['shield', 'globe', 'users', 'languages'][i])}</span><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></li>`,
        )
        .join('')}
    </ul>
  </div>
</section>
<section class="section">
  <div class="container narrow">
    <h2 class="h3">${esc(t('about.roadmapTitle'))}</h2>
    <ol class="timeline">
      ${t('about.roadmap')
        .map(
          (r, i) =>
            `<li class="${i < 2 ? 'done' : ''}"><strong>${esc(r.v)}</strong><p>${esc(r.text)}</p></li>`,
        )
        .join('')}
    </ol>
    <h2 class="h3 mt">${esc(t('about.techTitle'))}</h2>
    <p>${esc(t('about.tech'))}</p>
    <p><a class="btn btn-secondary" href="${esc(site.github)}" rel="noopener">${icon('github')}${esc(t('about.openSource'))}</a></p>
    <h2 class="h3 mt">${esc(t('about.contactTitle'))}</h2>
    <p>${esc(t('about.contact'))}</p>
  </div>
</section>`;
  return {
    title: t('about.title'),
    description: t('about.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'about',
  };
}

export function pressPage(ctx) {
  const { t, site } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.press') }]);
  const screens = [
    '01-home',
    '02-explore',
    '03-maps',
    '04-planner',
    '05-climbing',
    '06-sos',
    '07-assistant',
    '08-clubs',
  ];
  const labels = t('home.screens');
  const body = `
${pageHero({ kicker: t('press.kicker'), title: t('press.title'), lead: t('press.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    <div class="two-col">
      <div class="panel">
        <h2 class="h3">${esc(t('press.boilerplateTitle'))}</h2>
        <p>${esc(t('press.boilerplate'))}</p>
      </div>
      <div class="panel">
        <h2 class="h3">${esc(t('press.factsTitle'))}</h2>
        <dl class="kv">${t('press.facts')
          .map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`)
          .join('')}</dl>
        <h2 class="h3 mt">${esc(t('press.contactTitle'))}</h2>
        <p>${esc(t('press.contact'))}</p>
      </div>
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('press.logosTitle'))}</h2>
    <p class="muted">${esc(t('press.logosLead'))}</p>
    <ul class="logo-grid">
      <li><div class="logo-box">${logoMark(96, 'logo-big')}</div><span>${esc(t('press.logoMark'))}</span><a class="btn btn-ghost btn-sm" href="${site.assets}/img/logo-mark.svg" download>${icon('download', 'ico ico-xs')}SVG</a></li>
      <li><div class="logo-box"><img src="${site.assets}/img/logo-wordmark.svg" alt="Zirtan wordmark" width="240" height="64"/></div><span>${esc(t('press.logoWordmark'))}</span><a class="btn btn-ghost btn-sm" href="${site.assets}/img/logo-wordmark.svg" download>${icon('download', 'ico ico-xs')}SVG</a></li>
      <li><div class="logo-box logo-box-dark"><img src="${site.assets}/img/logo-wordmark-dark.svg" alt="Zirtan wordmark (dark)" width="240" height="64"/></div><span>${esc(t('press.logoDark'))}</span><a class="btn btn-ghost btn-sm" href="${site.assets}/img/logo-wordmark-dark.svg" download>${icon('download', 'ico ico-xs')}SVG</a></li>
    </ul>
    <h2 class="h3 mt">${esc(t('press.colorsTitle'))}</h2>
    <ul class="swatches">${t('press.colors')
      .map(
        (c) =>
          `<li><span class="swatch" style="background:${esc(c.hex)}"></span><strong>${esc(c.name)}</strong><code>${esc(c.hex)}</code></li>`,
      )
      .join('')}</ul>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2 class="h3">${esc(t('press.screensTitle'))}</h2>
    <p class="muted">${esc(t('press.screensLead'))}</p>
    <div class="phone-strip phone-strip-wrap">
      ${screens.map((s, i) => `<a href="${site.assets}/img/screens/${s}.png" download>${phone(`${site.assets}/img/screens/${s}.png`, labels[i])}</a>`).join('')}
    </div>
  </div>
</section>`;
  return {
    title: t('press.title'),
    description: t('press.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'press',
  };
}

export function legalPage(ctx, key) {
  const { t } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t(`nav.${key}`) }]);
  const body = `
${pageHero({ kicker: t(`${key}.kicker`), title: t(`${key}.title`), lead: t(`${key}.updated`), extra: bc.html })}
<section class="section pt-0">
  <div class="container narrow">
    <p class="notice">${icon('info', 'ico ico-xs')} ${esc(t('site.draft'))}</p>
    <article class="prose">
      ${t(`${key}.sections`)
        .map((s) => `<h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>`)
        .join('')}
    </article>
  </div>
</section>`;
  return {
    title: t(`${key}.title`),
    description: t(`${key}.metaDescription`),
    body,
    ld: [bc.ld],
    section: key,
  };
}

export function downloadPage(ctx) {
  const { t, site } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.download') }]);
  const body = `
${pageHero({ kicker: t('download.kicker'), title: t('download.title'), lead: t('download.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    <div class="download-grid">
      <div>
        ${storeBadges({ t, ios: site.ios, android: site.android })}
        <p class="small muted">${esc(t('home.storeSoon'))}</p>
        <h2 class="h4 mt">${esc(t('download.requirements'))}</h2>
        <ul class="checklist">${t('download.reqList')
          .map((r) => `<li>${icon('check', 'ico ico-xs')}${esc(r)}</li>`)
          .join('')}</ul>
        <h2 class="h4 mt">${esc(t('download.deepLink'))}</h2>
        <p class="small">${esc(t('download.deepLinkLead'))}</p>
        <p><code>${esc(site.scheme)}://maps/route/sr_kackar_zirve</code> · <code>${esc(site.scheme)}://destinations/likya-yolu</code> · <code>${esc(site.scheme)}://first-aid</code></p>
        <div class="mt">${waitlist(ctx, { compact: true })}</div>
      </div>
      <div class="qr-box">
        ${qrPlaceholder(t('download.qrPlaceholder'))}
        <h2 class="h4">${esc(t('download.qrTitle'))}</h2>
        <p class="small muted">${esc(t('download.qrLead'))} ${esc(t('download.qrPlaceholder'))}.</p>
      </div>
      <figure class="phone phone-static"><div class="phone-frame"><span class="phone-notch"></span><img src="${site.assets}/img/screens/01-home.png" alt="${esc(t('home.screens')[0])}" width="390" height="844" loading="lazy" decoding="async"/></div></figure>
    </div>
  </div>
</section>`;
  return {
    title: t('download.title'),
    description: t('download.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'download',
  };
}

export function notFoundPage(ctx) {
  const { t, url, lang } = ctx;
  const body = `
<section class="section notfound">
  <div class="container narrow center">
    <p class="kicker">404</p>
    <h1>${esc(t('notFound.title'))}</h1>
    <p class="lead">${esc(t('notFound.lead'))}</p>
    <div class="btn-row center">
      <a class="btn btn-primary" href="${url(lang, 'home')}">${esc(t('notFound.cta'))}</a>
      <a class="btn btn-secondary" href="${url(lang, 'routes')}">${esc(t('nav.routes'))}</a>
    </div>
  </div>
</section>`;
  return {
    title: t('notFound.title'),
    description: t('notFound.lead'),
    body,
    ld: [],
    section: 'home',
    noindex: true,
  };
}
