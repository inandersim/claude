/** Güvenlik: SOS, bağlantı katmanı, ülke dizini, ilk yardım, dönüş planı */
import { esc, countryName, flag } from './lib.js';
import { icon } from './icons.js';
import { pageHero, breadcrumbs, filterBar, pill } from './components.js';

const FIRST_AID_ICONS = [
  'activity',
  'droplets',
  'ruler',
  'snowflake',
  'sun',
  'mountain-snow',
  'alert-triangle',
  'zap',
  'waves',
  'flame',
  'zap',
  'mountain',
];

export function safetyPage(ctx) {
  const { t, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.safety') }]);
  const countries = [...data.rescue].sort((a, b) =>
    countryName(a.countryCode, locale).localeCompare(countryName(b.countryCode, locale), locale),
  );
  const body = `
${pageHero({ kicker: t('safety.kicker'), title: t('safety.title'), lead: t('safety.lead'), extra: bc.html })}
<section class="section pt-0" id="sos">
  <div class="container">
    <div class="sos-grid">
      <div>
        <h2 class="h3">${esc(t('safety.sosTitle'))}</h2>
        <ol class="steps steps-vertical">
          ${t('safety.sos')
            .map(
              (s, i) =>
                `<li class="step"><span class="step-num">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`,
            )
            .join('')}
        </ol>
        <h3 class="h4">${esc(t('safety.layersTitle'))}</h3>
        <p class="muted">${esc(t('safety.layersLead'))}</p>
        <div class="pill-row">${pill('Cellular', { iconName: 'phone', cls: 'pill-soft' })} → ${pill('Wi-Fi', { iconName: 'wifi', cls: 'pill-soft' })} → ${pill('Satellite', { iconName: 'satellite', cls: 'pill-soft' })} → ${pill('—', { iconName: 'wifi-off', cls: 'pill-soft' })}</div>
      </div>
      <figure class="phone phone-static">
        <div class="phone-frame"><span class="phone-notch"></span><img src="${site.assets}/img/screens/06-sos.png" alt="${esc(t('home.screens')[5])}" width="390" height="844" loading="lazy" decoding="async"/></div>
      </figure>
    </div>
  </div>
</section>
<section class="section section-alt" id="hazards">
  <div class="container two-col">
    <div class="panel"><h2 class="h3">${icon('radar')} ${esc(t('safety.hazardsTitle'))}</h2><p>${esc(t('safety.hazardsLead'))}</p></div>
    <div class="panel"><h2 class="h3">${icon('clock')} ${esc(t('safety.returnTitle'))}</h2><p>${esc(t('safety.returnLead'))}</p></div>
  </div>
</section>
<section class="section" id="countries">
  <div class="container">
    <h2 class="h3">${esc(t('safety.countriesTitle'))} <span class="muted">(${countries.length})</span></h2>
    <p class="muted">${esc(t('safety.countriesLead'))}</p>
    ${filterBar(ctx, { total: countries.length, selects: [] })}
    <div class="table-wrap"><table class="table table-countries">
      <thead><tr><th>${esc(t('common.country'))}</th><th>${esc(t('safety.general'))}</th><th>${esc(t('safety.police'))}</th><th>${esc(t('safety.ambulance'))}</th><th>${esc(t('safety.fire'))}</th><th>${esc(t('safety.mountain'))} / ${esc(t('safety.sea'))}</th><th>${esc(t('safety.organizations'))}</th></tr></thead>
      <tbody data-filter-list>
        ${countries
          .map(
            (
              c,
            ) => `<tr data-item data-name="${esc(countryName(c.countryCode, locale).toLowerCase())} ${c.countryCode.toLowerCase()}">
          <th scope="row">${flag(c.countryCode)} ${esc(countryName(c.countryCode, locale))}</th>
          <td><strong>${esc(c.emergency.general)}</strong></td>
          <td>${esc(c.emergency.police ?? '—')}</td>
          <td>${esc(c.emergency.ambulance ?? '—')}</td>
          <td>${esc(c.emergency.fire ?? '—')}</td>
          <td>${esc(c.emergency.mountain ?? '—')} / ${esc(c.emergency.sea ?? '—')}</td>
          <td class="small">${c.organizations.map((o) => (o.url ? `<a href="${esc(o.url)}" rel="noopener nofollow">${esc(o.name)}</a>` : esc(o.name)) + (o.phone ? ` <span class="muted">${esc(o.phone)}</span>` : '')).join('<br/>')}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table></div>
  </div>
</section>
<section class="section section-alt" id="first-aid">
  <div class="container">
    <h2 class="h3">${esc(t('safety.firstAidTitle'))}</h2>
    <p class="muted">${esc(t('safety.firstAidLead'))}</p>
    <ul class="tile-grid">
      ${t('safety.firstAid')
        .map(
          (g, i) =>
            `<li class="tile">${icon(FIRST_AID_ICONS[i] ?? 'life-buoy')}<span>${esc(g)}</span></li>`,
        )
        .join('')}
    </ul>
    <p class="notice notice-warn mt">${icon('alert-triangle', 'ico ico-xs')} ${esc(t('safety.disclaimer'))}</p>
  </div>
</section>`;
  return {
    title: t('safety.title'),
    description: t('safety.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'safety',
    lang,
  };
}
