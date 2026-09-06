/** Destinasyonlar: liste + detay (SEO tam metin, TouristDestination JSON-LD) */
import {
  esc,
  fmtKm,
  fmtM,
  fmtDuration,
  fmtTry,
  fmtNumber,
  countryName,
  flag,
  guideToHtml,
  guideHeadings,
  haversineKm,
  truncate,
} from './lib.js';
import { icon, TRANSPORT_ICON } from './icons.js';
import { elevationProfile } from './illustrations.js';
import {
  pageHero,
  breadcrumbs,
  destinationCard,
  placeCard,
  filterBar,
  mapBlock,
  statTiles,
  difficultyPill,
  appLinks,
  pill,
  monthStrip,
} from './components.js';

export function destinationsIndex(ctx) {
  const { t, url, lang, locale, data } = ctx;
  const list = data.destinations;
  const countries = [...new Set(list.map((d) => d.countryCode))].sort();
  const types = [...new Set(list.map((d) => d.type))];
  const bc = breadcrumbs(ctx, [{ label: t('nav.destinations') }]);
  const points = list.map((d) => ({
    name: d.name,
    href: url(lang, 'destinations', d.slug),
    lat: d.coords.latitude,
    lng: d.coords.longitude,
    sub: `${d.region} · ${d.typicalDays} ${t('common.days')}`,
  }));
  const body = `
${pageHero({ kicker: t('destinations.kicker'), title: t('destinations.title'), lead: t('destinations.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    ${filterBar(ctx, {
      total: list.length,
      selects: [
        {
          label: t('destinations.filterCountry'),
          attr: 'country',
          options: countries.map((c) => ({
            value: c,
            label: `${flag(c)} ${countryName(c, locale)}`,
          })),
        },
        {
          label: t('destinations.filterType'),
          attr: 'type',
          options: types.map((v) => ({ value: v, label: t(`destType.${v}`) })),
        },
        {
          label: t('destinations.filterMonth'),
          attr: 'months',
          mode: 'includes',
          options: t('months').map((m, i) => ({ value: String(i + 1), label: m })),
        },
      ],
    })}
    <div class="grid grid-3" data-filter-list>
      ${list.map((d) => destinationCard(ctx, d)).join('')}
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    ${mapBlock(ctx, { id: 'dest-map', kind: 'points', data: points, center: { lat: 25, lng: 30 }, zoom: 2, height: 'lg', title: t('destinations.title') })}
  </div>
</section>`;
  return {
    title: t('destinations.title'),
    description: t('destinations.metaDescription'),
    body,
    ld: [
      bc.ld,
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: t('destinations.title'),
        numberOfItems: list.length,
        itemListElement: list.map((d, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: d.name,
          url: `${ctx.site.baseUrl}${url(lang, 'destinations', d.slug).replace(ctx.site.basePath, '')}`,
        })),
      },
    ],
    section: 'destinations',
  };
}

export function destinationDetail(ctx, d) {
  const { t, url, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [
    { label: t('nav.destinations'), href: url(lang, 'destinations') },
    { label: d.name },
  ]);
  const route = data.routes.find((r) => r.destinationSlug === d.slug);
  const center = { lat: d.coords.latitude, lng: d.coords.longitude };
  const nearby = data.places
    .map((p) => ({ p, km: haversineKm(center, { lat: p.lat, lng: p.lng }) }))
    .filter((x) => x.km < 120)
    .sort((a, b) => a.km - b.km)
    .slice(0, 3)
    .map((x) => x.p);
  const others = data.destinations
    .filter((x) => x.id !== d.id && (x.countryCode === d.countryCode || x.type === d.type))
    .slice(0, 3);
  const headings = guideHeadings(d.guide);
  const stagePoints = d.stages.map((s) => ({
    name: s.name,
    lat: s.coords.latitude,
    lng: s.coords.longitude,
    sub: `${fmtM(s.elevationM, t, locale)}`,
  }));
  const description = truncate(d.summary, 158);
  const gpxHref = route ? `${site.assets}/gpx/${route.slug}.gpx` : null;

  const body = `
<section class="page-hero page-hero-detail">
  <div class="container">
    ${bc.html}
    <p class="kicker">${esc(t('destinations.detailKicker'))} · ${esc(t(`destType.${d.type}`))}</p>
    <h1>${esc(d.name)}</h1>
    <p class="lead">${flag(d.countryCode)} ${esc(d.region)}, ${esc(countryName(d.countryCode, locale))}</p>
    <div class="pill-row">
      ${d.adventureTypes.map((a) => pill(t(`adventure.${a}`), { cls: 'pill-soft' })).join('')}
      ${difficultyPill(d.difficulty, t)}
      ${pill(`${fmtNumber(d.rating, locale, 1)} · ${fmtNumber(d.reviewCount, locale)} ${t('common.reviews')}`, { iconName: 'star', cls: 'pill-soft' })}
    </div>
  </div>
</section>
<section class="section pt-0">
  <div class="container">
    <div class="detail-grid">
      <div class="detail-main">
        <p class="summary">${esc(d.summary)}</p>
        ${statTiles([
          {
            icon: 'calendar',
            label: t('destinations.days'),
            value: `${d.typicalDays} ${t('common.days')}`,
          },
          {
            icon: 'mountain-snow',
            label: t('destinations.maxAlt'),
            value: fmtM(d.maxElevationM, t, locale),
          },
          {
            icon: 'ruler',
            label: t('destinations.distance'),
            value: fmtKm(d.totalDistanceKm, t, locale),
          },
          {
            icon: 'wallet',
            label: t('destinations.budget'),
            value: `${fmtTry(d.budgetTry.low, locale)} – ${fmtTry(d.budgetTry.high, locale)}`,
          },
          {
            icon: 'shield',
            label: t('destinations.insurance'),
            value: d.insuranceRequired
              ? t('destinations.insuranceRequired')
              : t('destinations.insuranceOptional'),
          },
          { icon: 'layers', label: t('common.stages'), value: String(d.stageCount) },
        ])}
        <h2 class="h4 mt">${esc(t('common.bestMonths'))}</h2>
        ${monthStrip(d.bestMonths, t)}

        ${mapBlock(ctx, { id: 'dest-map', kind: route ? 'route' : 'points', data: route ? { name: d.name, type: d.adventureTypes[0], pts: route.points.map((p) => [p.latitude, p.longitude]), markers: stagePoints } : stagePoints.length ? stagePoints : [{ name: d.name, lat: center.lat, lng: center.lng }], center, zoom: d.totalDistanceKm > 100 ? 8 : 10, height: 'lg', title: d.name })}

        <article class="guide" id="guide">
          <h2>${esc(t('destinations.guide'))}</h2>
          ${lang !== 'tr' ? `<p class="notice">${icon('languages', 'ico ico-xs')} ${esc(t('common.guideTrOnly'))}</p>` : ''}
          <div class="prose" lang="tr">${guideToHtml(d.guide)}</div>
        </article>

        <h2 id="transports">${esc(t('destinations.transports'))}</h2>
        <ul class="transports">
          ${d.transports
            .map(
              (tr) => `<li>
            <span class="transport-ico">${icon(TRANSPORT_ICON[tr.mode] ?? 'route')}</span>
            <div>
              <strong>${esc(t(`transport.${tr.mode}`))}: ${esc(tr.from)} → ${esc(tr.to)}</strong>
              <span class="muted small">${fmtDuration(tr.durationMin, t)}${tr.costTry != null ? ` · ${fmtTry(tr.costTry, locale)}` : ''}</span>
              ${tr.note ? `<p class="small">${esc(tr.note)}</p>` : ''}
            </div>
          </li>`,
            )
            .join('')}
        </ul>

        <h2 id="permits">${esc(t('destinations.permits'))}</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>${esc(t('common.type'))}</th><th>${esc(t('destinations.cost'))}</th><th>${esc(t('destinations.permitWhere'))}</th></tr></thead>
          <tbody>${d.permits
            .map(
              (p) =>
                `<tr><td><strong>${esc(p.name)}</strong>${p.note ? `<br/><span class="small muted">${esc(p.note)}</span>` : ''}</td><td>${p.costTry != null ? (p.costTry === 0 ? esc(t('destinations.freeOfCharge')) : fmtTry(p.costTry, locale)) : '—'}</td><td>${esc(p.where)}</td></tr>`,
            )
            .join('')}</tbody>
        </table></div>

        ${
          d.stages.length
            ? `<h2 id="stages">${esc(t('common.stages'))}</h2>
        <p class="muted">${esc(t('destinations.stagesLead'))}</p>
        <ol class="stages">
          ${d.stages
            .map(
              (s) => `<li class="stage ${s.restDayRecommended ? 'stage-rest' : ''}">
            <span class="stage-num">${s.order}</span>
            <div>
              <strong>${esc(s.name)}</strong>
              <span class="muted small">${esc(t(`stageKind.${s.kind}`))} · ${fmtM(s.elevationM, t, locale)}${s.distanceKm ? ` · ${fmtKm(s.distanceKm, t, locale)}` : ''}${s.durationMin ? ` · ${fmtDuration(s.durationMin, t)}` : ''} · ${s.sleeping ? icon('bed', 'ico ico-xs') + ' ' + esc(t('common.sleeping')) : ''} ${s.waterAvailable ? icon('droplets', 'ico ico-xs') : ''} ${s.connectivity !== 'none' ? icon('wifi', 'ico ico-xs') + ' ' + esc(s.connectivity) : icon('wifi-off', 'ico ico-xs')}</span>
              ${s.restDayRecommended ? `<span class="pill pill-soft">${icon('info', 'ico ico-xs')}${esc(t('common.restDay'))}</span>` : ''}
              ${s.note ? `<p class="small">${esc(s.note)}</p>` : ''}
              ${s.facilities.length ? `<p class="small muted">${esc(t('common.facilities'))}: ${esc(s.facilities.join(', '))}</p>` : ''}
            </div>
          </li>`,
            )
            .join('')}
        </ol>`
            : ''
        }

        ${
          route
            ? `<h2 id="route">${esc(t('destinations.route'))}</h2>
        <p class="muted">${esc(t('destinations.routeLead'))}</p>
        ${elevationProfile(route.profile, { t, locale, id: 'dp' })}`
            : ''
        }

        <h2 id="risks">${esc(t('destinations.risks'))}</h2>
        <ul class="checklist checklist-warn">${d.risks.map((r) => `<li>${icon('alert-triangle', 'ico ico-xs')}${esc(r)}</li>`).join('')}</ul>

        <h2 id="gear">${esc(t('destinations.gear'))}</h2>
        <ul class="checklist">${d.gear.map((g) => `<li>${icon('check', 'ico ico-xs')}${esc(g)}</li>`).join('')}</ul>

        <h2 id="rescue">${esc(t('destinations.rescue'))}</h2>
        <p class="notice notice-warn">${icon('life-buoy', 'ico ico-xs')} ${esc(d.rescueNote)}</p>
        <p><a class="btn btn-ghost btn-sm" href="${url(lang, 'safety')}#countries">${esc(t('safety.countriesTitle'))} ${icon('arrow-right', 'ico ico-xs')}</a></p>

        <h2 id="sources">${esc(t('common.sources'))}</h2>
        <ul class="sources">${d.sources.map((s) => `<li><a href="${esc(s)}" rel="noopener nofollow">${esc(s.replace(/^https?:\/\//, ''))}</a></li>`).join('')}</ul>
      </div>
      <aside class="detail-side">
        <nav class="toc" aria-label="${esc(t('common.onThisPage'))}">
          <h2 class="h4">${esc(t('common.onThisPage'))}</h2>
          <ol>
            <li><a href="#guide">${esc(t('destinations.guide'))}</a>
              ${headings.length ? `<ol>${headings.map((h) => `<li><a href="#${h.id}">${esc(h.label)}</a></li>`).join('')}</ol>` : ''}
            </li>
            <li><a href="#transports">${esc(t('destinations.transports'))}</a></li>
            <li><a href="#permits">${esc(t('destinations.permits'))}</a></li>
            ${d.stages.length ? `<li><a href="#stages">${esc(t('common.stages'))}</a></li>` : ''}
            <li><a href="#risks">${esc(t('destinations.risks'))}</a></li>
            <li><a href="#gear">${esc(t('destinations.gear'))}</a></li>
            <li><a href="#rescue">${esc(t('destinations.rescue'))}</a></li>
          </ol>
        </nav>
        ${appLinks(ctx, { appPath: `destinations/${d.slug}`, gpxHref, lead: t('routes.openInAppLead') })}
        ${
          nearby.length
            ? `<h2 class="h4 mt">${esc(t('destinations.nearby'))}</h2>
        <div class="stack">${nearby.map((p) => placeCard(ctx, p)).join('')}</div>`
            : ''
        }
      </aside>
    </div>
  </div>
</section>
${
  others.length
    ? `<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('destinations.otherDestinations'))}</h2>
    <div class="grid grid-3">${others.map((x) => destinationCard(ctx, x)).join('')}</div>
  </div>
</section>`
    : ''
}`;

  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: d.name,
      description,
      touristType: d.adventureTypes.map((a) => t(`adventure.${a}`)),
      geo: {
        '@type': 'GeoCoordinates',
        latitude: d.coords.latitude,
        longitude: d.coords.longitude,
      },
      address: { '@type': 'PostalAddress', addressRegion: d.region, addressCountry: d.countryCode },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: d.rating,
        reviewCount: d.reviewCount,
        bestRating: 5,
      },
      includesAttraction: d.stages.slice(0, 20).map((s) => ({
        '@type': 'TouristAttraction',
        name: s.name,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: s.coords.latitude,
          longitude: s.coords.longitude,
          elevation: s.elevationM,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${d.name} — ${t('destinations.guide')}`,
      description,
      inLanguage: 'tr',
      author: { '@type': 'Organization', name: 'Zirtan' },
      publisher: { '@type': 'Organization', name: 'Zirtan' },
      mainEntityOfPage: `${site.baseUrl}${url(lang, 'destinations', d.slug).replace(site.basePath, '')}`,
    },
  ];
  return {
    title: `${d.name} — ${t('destinations.guide')}`,
    description,
    body,
    ld,
    section: 'destinations',
  };
}
