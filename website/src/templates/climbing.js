/** Tırmanış: kayalar listesi + kaya detayı (sektörler, rota tablosu, derece histogramı) */
import { esc, fmtM, fmtNumber, countryName, flag, monthList, truncate } from './lib.js';
import { icon } from './icons.js';
import {
  pageHero,
  breadcrumbs,
  cragCard,
  filterBar,
  mapBlock,
  statTiles,
  pill,
  verificationPill,
  appLinks,
  monthStrip,
} from './components.js';

export function climbingIndex(ctx) {
  const { t, url, lang, locale, data } = ctx;
  const list = data.crags;
  const countries = [...new Set(list.map((c) => c.countryCode))].sort();
  const types = [...new Set(list.flatMap((c) => c.climbTypes))];
  const bc = breadcrumbs(ctx, [{ label: t('nav.climbing') }]);
  const points = list.map((c) => ({
    name: c.name,
    href: url(lang, 'climbing', c.slug),
    lat: c.coords.latitude,
    lng: c.coords.longitude,
    sub: `${c.routeCount} ${t('common.routes')}`,
    kind: 'climbing',
  }));
  const totalRoutes = list.reduce((a, c) => a + c.routeCount, 0);
  const body = `
${pageHero({ kicker: t('climbing.kicker'), title: t('climbing.title'), lead: t('climbing.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    ${statTiles([
      {
        icon: 'mountain',
        label: t('climbing.detailKicker'),
        value: fmtNumber(list.length, locale),
      },
      {
        icon: 'layers',
        label: t('climbing.sectors'),
        value: fmtNumber(
          list.reduce((a, c) => a + c.sectors.length, 0),
          locale,
        ),
      },
      { icon: 'route', label: t('climbing.routesTable'), value: fmtNumber(totalRoutes, locale) },
      { icon: 'globe', label: t('common.country'), value: fmtNumber(countries.length, locale) },
    ])}
    ${filterBar(ctx, {
      total: list.length,
      selects: [
        {
          label: t('common.country'),
          attr: 'country',
          options: countries.map((c) => ({
            value: c,
            label: `${flag(c)} ${countryName(c, locale)}`,
          })),
        },
        {
          label: t('climbing.climbTypes'),
          attr: 'type',
          options: types.map((v) => ({ value: v, label: t(`climbType.${v}`) })),
        },
      ],
    })}
    <div class="grid grid-3" data-filter-list>
      ${list.map((c) => cragCard(ctx, c)).join('')}
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    ${mapBlock(ctx, { id: 'crags-map', kind: 'points', data: points, center: { lat: 38, lng: 20 }, zoom: 3, height: 'lg', title: t('climbing.title') })}
    <div class="two-col mt">
      <div class="panel">
        <h2 class="h3">${icon('check-circle')} ${esc(t('climbing.verification'))}</h2>
        <p>${esc(t('climbing.verificationLead'))}</p>
        <div class="pill-row">${verificationPill('unverified', t)} → ${verificationPill('community', t)} → ${verificationPill('verified', t)}</div>
      </div>
      <div class="panel">
        <h2 class="h3">${icon('file-text')} ${esc(t('climbing.logbook'))}</h2>
        <p>${esc(t('climbing.logbookLead'))}</p>
      </div>
    </div>
  </div>
</section>`;
  return {
    title: t('climbing.title'),
    description: t('climbing.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'climbing',
  };
}

const GRADE_ORDER = [
  '3',
  '4',
  '5a',
  '5b',
  '5c',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
  '7b',
  '7b+',
  '7c',
  '7c+',
  '8a',
  '8a+',
  '8b',
  '8b+',
  '8c',
  '9a',
];

function gradeBucket(grade, system) {
  if (system === 'french') {
    const g = grade.toLowerCase().replace(/\s/g, '');
    const idx = GRADE_ORDER.findIndex((x) => g.startsWith(x));
    return idx > -1 ? GRADE_ORDER[idx].replace('+', '') : g[0];
  }
  return grade.split(/[^0-9a-zA-Z]/)[0];
}

export function cragDetail(ctx, c) {
  const { t, url, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [
    { label: t('nav.climbing'), href: url(lang, 'climbing') },
    { label: c.name },
  ]);
  const center = { lat: c.coords.latitude, lng: c.coords.longitude };
  const allRoutes = c.sectors.flatMap((s) => s.routes.map((r) => ({ ...r, sector: s.name })));
  const hist = new Map();
  for (const r of allRoutes) {
    const b = gradeBucket(r.grade, r.gradeSystem);
    hist.set(b, (hist.get(b) ?? 0) + 1);
  }
  const histEntries = [...hist.entries()].sort(
    (a, b) =>
      GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0]) ||
      String(a[0]).localeCompare(String(b[0])),
  );
  const maxCount = Math.max(1, ...histEntries.map((e) => e[1]));
  const others = data.crags.filter((x) => x.id !== c.id).slice(0, 3);
  const description = truncate(`${c.name}, ${c.locationName}: ${c.description}`, 158);
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

  const body = `
<section class="page-hero page-hero-detail">
  <div class="container">
    ${bc.html}
    <p class="kicker">${esc(t('climbing.detailKicker'))} · ${esc(c.rockType)}</p>
    <h1>${esc(c.name)}</h1>
    <p class="lead">${flag(c.countryCode)} ${esc(c.locationName)}</p>
    <div class="pill-row">
      ${c.climbTypes.map((ct) => pill(t(`climbType.${ct}`), { cls: 'pill-soft', iconName: 'carabiner' })).join('')}
      ${verificationPill(c.verification, t)}
    </div>
  </div>
</section>
<section class="section pt-0">
  <div class="container">
    <div class="detail-grid">
      <div class="detail-main">
        <p class="summary">${esc(c.description)}</p>
        ${mapBlock(ctx, { id: 'crag-map', kind: 'points', data: [{ name: c.name, lat: center.lat, lng: center.lng, kind: 'climbing' }], center, zoom: 12, height: 'md', title: c.name })}

        <h2 id="histogram">${esc(t('climbing.gradeHistogram'))}</h2>
        <ul class="hist" aria-label="${esc(t('climbing.gradeHistogram'))}">
          ${histEntries.map(([g, n]) => `<li><span class="hist-bar" style="height:${Math.round((n / maxCount) * 100)}%"><span class="hist-n">${n}</span></span><span class="hist-g">${esc(g)}</span></li>`).join('')}
        </ul>

        <h2 id="sectors">${esc(t('climbing.sectors'))}</h2>
        ${c.sectors
          .map(
            (s) => `<section class="sector" id="s-${esc(s.id)}">
          <h3>${esc(s.name)} <span class="muted small">· ${esc(t('climbing.orientation'))}: ${esc(s.orientation)} · ${s.routes.length} ${t('common.routes')}</span></h3>
          <div class="table-wrap"><table class="table table-routes">
            <thead><tr><th>${esc(t('common.routes'))}</th><th>${esc(t('common.grade'))}</th><th>${esc(t('common.type'))}</th><th>${esc(t('common.length'))}</th><th>${esc(t('common.stars'))}</th><th>${esc(t('climbing.verification'))}</th></tr></thead>
            <tbody>${s.routes
              .map(
                (r) => `<tr>
                <td><strong>${esc(r.name)}</strong>${r.description ? `<br/><span class="small muted">${esc(r.description)}</span>` : ''}${r.firstAscent ? `<br/><span class="small muted">${esc(t('common.firstAscent'))}: ${esc(r.firstAscent)}</span>` : ''}</td>
                <td><span class="grade">${esc(r.grade)}</span><br/><span class="small muted">${esc(r.gradeSystem)}</span></td>
                <td>${esc(t(`climbType.${r.type}`))}${r.pitches > 1 ? `<br/><span class="small muted">${r.pitches} ${t('common.pitches').toLowerCase()}</span>` : ''}</td>
                <td>${r.lengthM != null ? fmtM(r.lengthM, t, locale) : '—'}${r.bolts != null ? `<br/><span class="small muted">${r.bolts} bolt</span>` : ''}</td>
                <td><span class="stars" aria-label="${r.stars}/5">${stars(r.stars)}</span></td>
                <td>${verificationPill(r.verification, t)}<br/><span class="small muted">${fmtNumber(r.ascentCount, locale)} ${t('common.ascents')}</span></td>
              </tr>`,
              )
              .join('')}</tbody>
          </table></div>
        </section>`,
          )
          .join('')}
      </div>
      <aside class="detail-side">
        ${statTiles([
          {
            icon: 'route',
            label: t('climbing.routesTable'),
            value: fmtNumber(c.routeCount, locale),
          },
          {
            icon: 'layers',
            label: t('climbing.sectors'),
            value: fmtNumber(c.sectors.length, locale),
          },
          {
            icon: 'footprints',
            label: t('climbing.approach'),
            value: `${c.approachMin} ${t('common.min')}`,
          },
          { icon: 'mountain', label: t('climbing.rockType'), value: c.rockType },
        ])}
        <h2 class="h4 mt">${esc(t('climbing.seasons'))}</h2>
        ${monthStrip(c.seasons, t)}
        <p class="small muted">${esc(monthList(c.seasons, t, false))}</p>
        <nav class="toc" aria-label="${esc(t('common.onThisPage'))}">
          <h2 class="h4">${esc(t('climbing.sectors'))}</h2>
          <ol>${c.sectors.map((s) => `<li><a href="#s-${esc(s.id)}">${esc(s.name)} <span class="muted">(${s.routes.length})</span></a></li>`).join('')}</ol>
        </nav>
        ${appLinks(ctx, { appPath: `climbing/${c.id}` })}
      </aside>
    </div>
  </div>
</section>
${
  others.length
    ? `<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('climbing.otherCrags'))}</h2>
    <div class="grid grid-3">${others.map((x) => cragCard(ctx, x)).join('')}</div>
  </div>
</section>`
    : ''
}`;
  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
      name: c.name,
      description,
      touristType: c.climbTypes.map((ct) => t(`climbType.${ct}`)),
      geo: { '@type': 'GeoCoordinates', latitude: center.lat, longitude: center.lng },
      address: {
        '@type': 'PostalAddress',
        addressLocality: c.locationName,
        addressCountry: c.countryCode,
      },
      url: `${site.baseUrl}${url(lang, 'climbing', c.slug).replace(site.basePath, '')}`,
    },
  ];
  return {
    title: `${c.name} — ${t('climbing.detailKicker')}`,
    description,
    body,
    ld,
    section: 'climbing',
  };
}
