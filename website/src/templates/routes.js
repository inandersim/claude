/** Rotalar: liste + detay */
import { esc, fmtKm, fmtM, fmtDuration, fmtNumber, countryName, flag } from './lib.js';
import { icon, ADVENTURE_ICON } from './icons.js';
import { elevationProfile } from './illustrations.js';
import {
  pageHero,
  breadcrumbs,
  routeCard,
  destinationCard,
  filterBar,
  mapBlock,
  statTiles,
  difficultyPill,
  appLinks,
  pill,
} from './components.js';

export function routesIndex(ctx) {
  const { t, url, lang, locale, data } = ctx;
  const routes = data.routes;
  const types = [...new Set(routes.map((r) => r.adventureType))];
  const mapRoutes = routes.map((r) => ({
    name: r.name,
    href: url(lang, 'routes', r.slug),
    type: r.adventureType,
    pts: r.points.map((p) => [
      Math.round(p.latitude * 1e4) / 1e4,
      Math.round(p.longitude * 1e4) / 1e4,
    ]),
  }));
  const bc = breadcrumbs(ctx, [{ label: t('nav.routes') }]);
  const body = `
${pageHero({ kicker: t('routes.kicker'), title: t('routes.title'), lead: t('routes.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    ${filterBar(ctx, {
      total: routes.length,
      selects: [
        {
          label: t('routes.filterType'),
          attr: 'type',
          options: types.map((v) => ({ value: v, label: t(`adventure.${v}`) })),
        },
        {
          label: t('routes.filterDifficulty'),
          attr: 'difficulty',
          options: ['beginner', 'easy', 'moderate', 'hard', 'extreme'].map((v) => ({
            value: v,
            label: t(`difficulty.${v}`),
          })),
        },
        {
          label: t('routes.filterKind'),
          attr: 'kind',
          options: ['community', 'planned', 'destination'].map((v) => ({
            value: v,
            label: t(`routeKind.${v}`),
          })),
        },
      ],
    })}
    <div class="grid grid-3" data-filter-list>
      ${routes.map((r) => routeCard(ctx, r)).join('')}
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('routes.mapTitle'))}</h2>
    ${mapBlock(ctx, { id: 'routes-map', kind: 'routes', data: mapRoutes, center: { lat: 30, lng: 20 }, zoom: 2, height: 'lg', title: t('routes.mapTitle') })}
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="two-col">
      <div>
        <h2 class="h3">${esc(t('routes.regionsTitle'))}</h2>
        <p class="muted">${esc(t('routes.regionsLead'))}</p>
        <ul class="list-cards">
          ${data.maps.regions
            .map((r) => {
              const g = data.maps.graphs.find((x) => x.regionId === r.id);
              return `<li><strong>${esc(r.name)}</strong><span class="muted">${flag(r.countryCode)} ${esc(countryName(r.countryCode, locale))}</span><span>${g ? `${g.nodes.length} ${t('routes.nodes')} · ${g.edges.length} ${t('routes.edges')}` : ''}</span></li>`;
            })
            .join('')}
        </ul>
      </div>
      <div>
        <h2 class="h3">${esc(t('routes.packsTitle'))}</h2>
        <p class="muted">${esc(t('routes.packsLead'))}</p>
        <ul class="list-cards">
          ${data.maps.packs
            .map(
              (p) =>
                `<li><strong>${esc(p.name)}</strong><span class="muted">${flag(p.countryCode)} ${esc(countryName(p.countryCode, locale))}</span><span>${fmtNumber(p.sizeMb, locale)} MB · v${esc(p.version)}</span></li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('routes.title'),
      numberOfItems: routes.length,
      itemListElement: routes.slice(0, 50).map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r.name,
        url: `${ctx.site.baseUrl}${url(lang, 'routes', r.slug).replace(ctx.site.basePath, '')}`,
      })),
    },
  ];
  return {
    title: t('routes.title'),
    description: t('routes.metaDescription'),
    body,
    ld,
    section: 'routes',
  };
}

export function routeDetail(ctx, r) {
  const { t, url, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [
    { label: t('nav.routes'), href: url(lang, 'routes') },
    { label: r.name },
  ]);
  const dest = r.destinationSlug
    ? data.destinations.find((d) => d.slug === r.destinationSlug)
    : null;
  const center = {
    lat: r.points.reduce((a, p) => a + p.latitude, 0) / r.points.length,
    lng: r.points.reduce((a, p) => a + p.longitude, 0) / r.points.length,
  };
  const similar = data.routes
    .filter((x) => x.id !== r.id && x.adventureType === r.adventureType)
    .slice(0, 3);
  const activityLabel =
    t(`activity.${r.activity}`) !== `activity.${r.activity}`
      ? t(`activity.${r.activity}`)
      : t(`adventure.${r.adventureType}`);
  const gpxHref = `${site.assets}/gpx/${r.slug}.gpx`;
  const appPath =
    r.kind === 'destination' ? `destinations/${r.destinationSlug}` : `maps/route/${r.id}`;
  const description = `${r.name}: ${fmtKm(r.distanceKm, t, locale)}, ${fmtM(r.ascentM, t, locale)} ${t('common.ascent').toLowerCase()}, ${t(`difficulty.${r.difficulty}`)}. ${r.locationName}. ${t('common.downloadGpx')}.`;

  const body = `
<section class="page-hero page-hero-detail">
  <div class="container">
    ${bc.html}
    <p class="kicker">${esc(t('routes.detailKicker'))} · ${esc(t(`routeKind.${r.kind}`))}</p>
    <h1>${esc(r.name)}</h1>
    <p class="lead">${flag(r.countryCode)} ${esc(r.locationName)}</p>
    <div class="pill-row">
      ${pill(activityLabel, { iconName: ADVENTURE_ICON[r.adventureType] ?? 'compass', cls: 'pill-soft' })}
      ${difficultyPill(r.difficulty, t)}
      ${pill(r.loop ? t('routes.loop') : t('routes.pointToPoint'), { cls: 'pill-soft', iconName: 'route' })}
    </div>
  </div>
</section>
<section class="section pt-0">
  <div class="container">
    <div class="detail-grid">
      <div class="detail-main">
        ${mapBlock(ctx, { id: 'route-map', kind: 'route', data: { name: r.name, type: r.adventureType, pts: r.points.map((p) => [p.latitude, p.longitude]) }, center, zoom: r.distanceKm > 60 ? 8 : 11, height: 'lg', title: r.name })}
        <h2 class="h3 mt">${esc(t('common.elevationProfile'))}</h2>
        ${elevationProfile(r.profile, { t, locale, id: 'ep' })}
        <p class="small muted">${esc(r.profileSynthetic ? t('common.profileSynthetic') : t('common.profileReal'))}</p>
        ${
          r.stages
            ? `<h2 class="h3 mt">${esc(t('routes.stagesTitle'))}</h2>
        <ol class="stages">
          ${r.stages
            .map(
              (s, i) => `<li class="stage">
            <span class="stage-num">${i + 1}</span>
            <div>
              <strong>${esc(s.name)}</strong>
              <span class="muted small">${esc(t(`stageKind.${s.kind}`))} · ${fmtM(s.elevationM, t, locale)}${s.distanceKm ? ` · ${fmtKm(s.distanceKm, t, locale)}` : ''}${s.durationMin ? ` · ${fmtDuration(s.durationMin, t)}` : ''}${s.sleeping ? ` · ${icon('bed', 'ico ico-xs')}` : ''}</span>
            </div>
          </li>`,
            )
            .join('')}
        </ol>`
            : ''
        }
      </div>
      <aside class="detail-side">
        <h2 class="h3">${esc(t('routes.stats'))}</h2>
        ${statTiles([
          { icon: 'ruler', label: t('common.distance'), value: fmtKm(r.distanceKm, t, locale) },
          { icon: 'trending-up', label: t('common.ascent'), value: fmtM(r.ascentM, t, locale) },
          { icon: 'trending-down', label: t('common.descent'), value: fmtM(r.descentM, t, locale) },
          {
            icon: 'clock',
            label: t('common.duration'),
            value: r.days ? `${r.days} ${t('common.days')}` : fmtDuration(r.durationMin, t),
          },
          {
            icon: 'mountain-snow',
            label: t('common.maxElevation'),
            value: fmtM(r.maxElevationM, t, locale),
          },
          {
            icon: 'activity',
            label: t('common.minElevation'),
            value: fmtM(r.minElevationM, t, locale),
          },
        ])}
        ${
          r.surfaces
            ? (() => {
                const total = Object.values(r.surfaces).reduce((a, b) => a + b, 0) || 1;
                return `<h3 class="h4 mt">${esc(t('routes.surfaces'))}</h3><ul class="bars">${Object.entries(
                  r.surfaces,
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(
                    ([k, v]) =>
                      `<li><span>${esc(k)}</span><span class="bar"><i style="width:${Math.round((v / total) * 100)}%"></i></span><span>${Math.round((v / total) * 100)}%</span></li>`,
                  )
                  .join('')}</ul>`;
              })()
            : ''
        }
        ${appLinks(ctx, { appPath, gpxHref, lead: t('routes.openInAppLead') })}
        <p class="small muted">${esc(t('routes.gpxNote'))}</p>
      </aside>
    </div>
  </div>
</section>
${
  dest
    ? `<section class="section section-alt">
  <div class="container">
    <div class="section-row">
      <div class="section-head"><p class="kicker">${esc(t('routes.relatedDestination'))}</p><h2>${esc(dest.name)}</h2><p class="lead">${esc(t('routes.relatedDestinationLead'))}</p></div>
      <a class="btn btn-secondary" href="${url(lang, 'destinations', dest.slug)}">${esc(t('destinations.guide'))}${icon('arrow-right', 'ico ico-xs')}</a>
    </div>
    <div class="grid grid-3">${destinationCard(ctx, dest)}</div>
  </div>
</section>`
    : ''
}
${
  similar.length
    ? `<section class="section">
  <div class="container">
    <h2 class="h3">${esc(t('routes.moreRoutes'))}</h2>
    <div class="grid grid-3">${similar.map((x) => routeCard(ctx, x)).join('')}</div>
  </div>
</section>`
    : ''
}`;

  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: r.name,
      description,
      touristType: activityLabel,
      itinerary: r.stages
        ? {
            '@type': 'ItemList',
            itemListElement: r.stages.map((s, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: s.name,
            })),
          }
        : undefined,
      subjectOf: {
        '@type': 'Dataset',
        name: `${r.name} GPX`,
        distribution: {
          '@type': 'DataDownload',
          encodingFormat: 'application/gpx+xml',
          contentUrl: `${site.baseUrl}${gpxHref.replace(site.basePath, '')}`,
        },
      },
      geo: { '@type': 'GeoCoordinates', latitude: center.lat, longitude: center.lng },
    },
  ];
  return { title: `${r.name} — ${activityLabel}`, description, body, ld, section: 'routes' };
}
