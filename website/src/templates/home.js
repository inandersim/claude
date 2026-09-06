/** Ana sayfa */
import { esc, fmtNumber, fmtTry } from './lib.js';
import { icon } from './icons.js';
import { heroMountains, phone, storeBadges } from './illustrations.js';
import { sectionHead, destinationCard, routeCard, mapBlock, faq, waitlist } from './components.js';
import { planCards } from './pro.js';

const FEATURES = [
  ['zmatch', 'heart-handshake'],
  ['hazards', 'radar'],
  ['live', 'video'],
  ['satellite', 'satellite'],
  ['sosCountry', 'phone'],
  ['offline', 'map'],
  ['climbing', 'carabiner'],
  ['ai', 'sparkles'],
  ['vision', 'camera'],
  ['destinations', 'compass'],
  ['routes', 'route'],
  ['courses', 'graduation'],
  ['groups', 'users'],
  ['stays', 'tent'],
];

const SCREENS = [
  '01-home',
  '02-explore',
  '03-maps',
  '04-planner',
  '05-climbing',
  '06-sos',
  '07-assistant',
  '08-clubs',
];

export function homePage(ctx) {
  const { t, url, lang, locale, data, site } = ctx;
  const counts = data.meta.counts;
  const screenLabels = t('home.screens');
  const destinations = [...data.destinations]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 6);
  const routes = data.routes.filter((r) => r.kind !== 'destination').slice(0, 3);
  const mapRoutes = data.routes.map((r) => ({
    name: r.name,
    href: url(lang, 'routes', r.slug),
    type: r.adventureType,
    pts: r.points.map((p) => [
      Math.round(p.latitude * 1e4) / 1e4,
      Math.round(p.longitude * 1e4) / 1e4,
    ]),
  }));
  const faqBlock = faq(t('home.faq'));

  const body = `
<section class="hero">
  ${heroMountains()}
  <div class="container hero-inner">
    <div class="hero-copy">
      <p class="kicker kicker-light">${esc(t('home.heroKicker'))}</p>
      <h1>${esc(t('home.heroTitle'))}</h1>
      <p class="lead">${esc(t('home.heroLead'))}</p>
      <div class="btn-row">
        <a class="btn btn-primary btn-lg" href="${url(lang, 'routes')}">${icon('compass')}${esc(t('home.heroCtaPrimary'))}</a>
        <a class="btn btn-light btn-lg" href="#how">${esc(t('home.heroCtaSecondary'))}${icon('arrow-right', 'ico ico-xs')}</a>
      </div>
      ${storeBadges({ t, ios: site.ios, android: site.android, cls: 'stores-hero' })}
    </div>
    <div class="hero-phones">
      ${phone(`${site.assets}/img/screens/02-explore.png`, screenLabels[1], 'phone-a')}
      ${phone(`${site.assets}/img/screens/04-planner.png`, screenLabels[3], 'phone-b')}
    </div>
  </div>
  <div class="container">
    <ul class="hero-stats">
      <li><strong>${fmtNumber(counts.routes, locale)}</strong><span>${esc(t('home.statsRoutes'))}</span></li>
      <li><strong>${fmtNumber(counts.destinations, locale)}</strong><span>${esc(t('home.statsDestinations'))}</span></li>
      <li><strong>${fmtNumber(counts.places, locale)}</strong><span>${esc(t('home.statsPlaces'))}</span></li>
      <li><strong>${fmtNumber(counts.rescueCountries, locale)}</strong><span>${esc(t('home.statsCountries'))}</span></li>
      <li><strong>9</strong><span>${esc(t('home.statsLanguages'))}</span></li>
    </ul>
  </div>
</section>

<section class="section" id="features">
  <div class="container">
    ${sectionHead({ kicker: t('home.featuresKicker'), title: t('home.featuresTitle'), lead: t('home.featuresLead') })}
    <ul class="feature-grid">
      ${FEATURES.map(
        ([key, ic]) => `<li class="feature">
        <span class="feature-ico">${icon(ic)}</span>
        <h3>${esc(t(`home.features.${key}.title`))}</h3>
        <p>${esc(t(`home.features.${key}.text`))}</p>
      </li>`,
      ).join('')}
    </ul>
  </div>
</section>

<section class="section section-alt" id="how">
  <div class="container">
    ${sectionHead({ kicker: t('home.howKicker'), title: t('home.howTitle') })}
    <ol class="steps">
      ${t('home.how')
        .map(
          (s, i) => `<li class="step">
        <span class="step-num">${i + 1}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </li>`,
        )
        .join('')}
    </ol>
    <div class="phone-strip" aria-label="${esc(t('home.screensTitle'))}">
      ${SCREENS.map((s, i) => phone(`${site.assets}/img/screens/${s}.png`, screenLabels[i])).join('')}
    </div>
  </div>
</section>

<section class="section" id="destinations">
  <div class="container">
    <div class="section-row">
      ${sectionHead({ kicker: t('home.destinationsKicker'), title: t('home.destinationsTitle'), lead: t('home.destinationsLead') })}
      <a class="btn btn-ghost" href="${url(lang, 'destinations')}">${esc(t('common.viewAll'))}${icon('arrow-right', 'ico ico-xs')}</a>
    </div>
    <div class="grid grid-3">
      ${destinations.map((d) => destinationCard(ctx, d)).join('')}
    </div>
  </div>
</section>

<section class="section section-alt" id="routes">
  <div class="container">
    <div class="section-row">
      ${sectionHead({ kicker: t('home.routesKicker'), title: t('home.routesTitle'), lead: t('home.routesLead') })}
      <a class="btn btn-ghost" href="${url(lang, 'routes')}">${esc(t('common.viewAll'))}${icon('arrow-right', 'ico ico-xs')}</a>
    </div>
    ${mapBlock(ctx, { id: 'home-map', kind: 'routes', data: mapRoutes, center: { lat: 38.5, lng: 33.5 }, zoom: 5, height: 'lg', title: t('routes.mapTitle') })}
    <div class="grid grid-3 mt">
      ${routes.map((r) => routeCard(ctx, r)).join('')}
    </div>
  </div>
</section>

<section class="section" id="pro">
  <div class="container">
    <div class="section-row">
      ${sectionHead({ kicker: t('home.proKicker'), title: t('home.proTitle'), lead: t('home.proLead') })}
      <a class="btn btn-ghost" href="${url(lang, 'pro')}">${esc(t('common.learnMore'))}${icon('arrow-right', 'ico ico-xs')}</a>
    </div>
    ${planCards(ctx, { compact: true })}
  </div>
</section>

<section class="section section-alt" id="clubs">
  <div class="container">
    ${sectionHead({ kicker: t('home.clubsKicker'), title: t('home.clubsTitle'), lead: t('home.clubsLead') })}
  </div>
  <div class="marquee" aria-hidden="true">
    <ul class="marquee-track">
      ${[...data.clubs, ...data.clubs].map((c) => `<li>${icon('graduation', 'ico ico-xs')}${esc(c.university)}</li>`).join('')}
    </ul>
  </div>
  <div class="container center mt">
    <a class="btn btn-secondary" href="${url(lang, 'community')}">${esc(t('nav.community'))}${icon('arrow-right', 'ico ico-xs')}</a>
  </div>
</section>

<section class="section" id="faq">
  <div class="container narrow">
    ${sectionHead({ kicker: t('home.faqKicker'), title: t('home.faqTitle') })}
    ${faqBlock.html}
  </div>
</section>

<section class="section section-cta" id="waitlist">
  <div class="container narrow center">
    ${sectionHead({ kicker: t('home.waitlistKicker'), title: t('home.waitlistTitle'), lead: t('home.waitlistLead') })}
    ${waitlist(ctx)}
  </div>
</section>`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Zirtan',
      url: site.baseUrl,
      inLanguage: lang,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${site.baseUrl}${url(lang, 'routes').replace(site.basePath, '')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Zirtan',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'SportsApplication',
      description: t('site.description'),
      offers: data.plans.map((p) => ({
        '@type': 'Offer',
        name: t(`pro.plan.${p.id}.name`),
        price: p.monthlyTry,
        priceCurrency: 'TRY',
      })),
    },
    faqBlock.ld,
  ];

  return {
    title: t('home.title'),
    description: t('home.metaDescription'),
    body,
    ld,
    section: 'home',
    bodyClass: 'is-home',
  };
}

export { fmtTry };
