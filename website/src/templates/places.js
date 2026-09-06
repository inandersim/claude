/** Kütüphane yerleri: liste + harita + detay */
import { esc, fmtM, fmtKm, countryName, flag, haversineKm, truncate } from './lib.js';
import { icon, PLACE_ICON } from './icons.js';
import {
  pageHero,
  breadcrumbs,
  placeCard,
  routeCard,
  filterBar,
  mapBlock,
  statTiles,
  pill,
  appLinks,
} from './components.js';

export function placesIndex(ctx) {
  const { t, url, lang, locale, data } = ctx;
  const list = data.places;
  const kinds = [...new Set(list.map((p) => p.kind))];
  const countries = [...new Set(list.map((p) => p.countryCode).filter(Boolean))].sort();
  const bc = breadcrumbs(ctx, [{ label: t('nav.places') }]);
  const points = list.map((p) => ({
    name: p.name,
    href: url(lang, 'places', p.slug),
    lat: p.lat,
    lng: p.lng,
    sub: t(`placeKind.${p.kind}`),
    kind: p.kind,
  }));
  const body = `
${pageHero({ kicker: t('places.kicker'), title: t('places.title'), lead: t('places.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    ${mapBlock(ctx, { id: 'places-map', kind: 'points', data: points, center: { lat: 38.8, lng: 33 }, zoom: 5, height: 'lg', title: t('places.mapTitle') })}
    <p class="small muted">${esc(t('common.attributionNote'))}</p>
    ${filterBar(ctx, {
      total: list.length,
      selects: [
        {
          label: t('places.filterKind'),
          attr: 'type',
          options: kinds.map((k) => ({ value: k, label: t(`placeKind.${k}`) })),
        },
        {
          label: t('common.country'),
          attr: 'country',
          options: countries.map((c) => ({
            value: c,
            label: `${flag(c)} ${countryName(c, locale)}`,
          })),
        },
      ],
    })}
    <div class="grid grid-4" data-filter-list>
      ${list.map((p) => placeCard(ctx, p)).join('')}
    </div>
  </div>
</section>`;
  return {
    title: t('places.title'),
    description: t('places.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'places',
  };
}

export function placeDetail(ctx, p) {
  const { t, url, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [
    { label: t('nav.places'), href: url(lang, 'places') },
    { label: p.name },
  ]);
  const center = { lat: p.lat, lng: p.lng };
  const nearbyPlaces = data.places
    .filter((x) => x.id !== p.id)
    .map((x) => ({ x, km: haversineKm(center, { lat: x.lat, lng: x.lng }) }))
    .filter((o) => o.km < 150)
    .sort((a, b) => a.km - b.km)
    .slice(0, 4)
    .map((o) => o.x);
  const nearbyRoutes = data.routes
    .map((r) => ({
      r,
      km: haversineKm(center, { lat: r.points[0].latitude, lng: r.points[0].longitude }),
    }))
    .filter((o) => o.km < 150)
    .sort((a, b) => a.km - b.km)
    .slice(0, 3)
    .map((o) => o.r);
  const kindLabel = t(`placeKind.${p.kind}`);
  const description = truncate(
    p.description ??
      `${p.name} — ${kindLabel}${p.countryCode ? `, ${countryName(p.countryCode, locale)}` : ''}.`,
    158,
  );
  const tags = Object.entries(p.tags ?? {}).filter(([k]) => !['name', 'source'].includes(k));
  const altNames = Object.entries(p.names ?? {}).filter(
    ([k, v]) => v && v !== p.name && k !== lang,
  );

  const body = `
<section class="page-hero page-hero-detail">
  <div class="container">
    ${bc.html}
    <p class="kicker">${esc(t('places.detailKicker'))}</p>
    <h1>${esc(p.name)}</h1>
    <p class="lead">${p.countryCode ? `${flag(p.countryCode)} ${esc(countryName(p.countryCode, locale))}` : ''}</p>
    <div class="pill-row">
      ${pill(kindLabel, { iconName: PLACE_ICON[p.kind] ?? 'map-pin', cls: 'pill-soft' })}
      ${p.adventureTypes.map((a) => pill(t(`adventure.${a}`), { cls: 'pill-soft' })).join('')}
    </div>
  </div>
</section>
<section class="section pt-0">
  <div class="container">
    <div class="detail-grid">
      <div class="detail-main">
        ${mapBlock(ctx, { id: 'place-map', kind: 'points', data: [{ name: p.name, lat: p.lat, lng: p.lng, kind: p.kind }], center, zoom: 12, height: 'md', title: p.name })}
        ${p.description ? `<p class="summary mt">${esc(p.description)}</p>` : ''}
        ${altNames.length ? `<p class="small muted">${altNames.map(([k, v]) => `<span lang="${esc(k)}">${esc(v)}</span>`).join(' · ')}</p>` : ''}
        ${
          tags.length
            ? `<h2 class="h4 mt">${esc(t('places.tags'))}</h2>
        <dl class="kv">${tags.map(([k, v]) => `<div><dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
            : ''
        }
        ${
          nearbyRoutes.length
            ? `<h2 class="h3 mt">${esc(t('places.nearbyRoutes'))}</h2>
        <div class="grid grid-3">${nearbyRoutes.map((r) => routeCard(ctx, r)).join('')}</div>`
            : ''
        }
      </div>
      <aside class="detail-side">
        ${statTiles([
          {
            icon: 'mountain-snow',
            label: t('places.elevation'),
            value: p.elevationM != null ? fmtM(p.elevationM, t, locale) : null,
          },
          {
            icon: 'map-pin',
            label: t('places.coordinates'),
            value: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
          },
          {
            icon: 'globe',
            label: t('places.source'),
            value:
              p.source === 'osm'
                ? 'OpenStreetMap'
                : p.source === 'wikidata'
                  ? 'Wikidata'
                  : 'Zirtan',
          },
        ])}
        ${p.website ? `<p><a class="btn btn-secondary btn-sm" href="${esc(p.website)}" rel="noopener nofollow">${icon('arrow-up-right', 'ico ico-xs')}${esc(t('places.website'))}</a></p>` : ''}
        ${appLinks(ctx, { appPath: `library/${encodeURIComponent(p.id)}` })}
        <p class="small muted">${esc(p.attribution)} · ${esc(p.license)}</p>
        ${
          nearbyPlaces.length
            ? `<h2 class="h4 mt">${esc(t('places.nearbyPlaces'))}</h2>
        <ul class="list-cards">${nearbyPlaces
          .map(
            (x) =>
              `<li><a href="${url(lang, 'places', x.slug)}">${esc(x.name)}</a><span class="muted small">${esc(t(`placeKind.${x.kind}`))} · ${fmtKm(haversineKm(center, { lat: x.lat, lng: x.lng }), t, locale)}</span></li>`,
          )
          .join('')}</ul>`
            : ''
        }
      </aside>
    </div>
  </div>
</section>`;
  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type':
        p.kind === 'campsite' ? 'Campground' : p.kind === 'ski' ? 'SkiResort' : 'TouristAttraction',
      name: p.name,
      description,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: p.lat,
        longitude: p.lng,
        ...(p.elevationM != null ? { elevation: p.elevationM } : {}),
      },
      ...(p.countryCode
        ? { address: { '@type': 'PostalAddress', addressCountry: p.countryCode } }
        : {}),
      ...(p.website ? { url: p.website } : {}),
    },
  ];
  return { title: `${p.name} — ${kindLabel}`, description, body, ld, section: 'places' };
}
