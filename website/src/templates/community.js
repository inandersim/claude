/** Topluluk: kulüpler, gruplar, katılım adımları, kurallar */
import { esc, fmtNumber, countryName, flag } from './lib.js';
import { icon, ADVENTURE_ICON } from './icons.js';
import { pageHero, breadcrumbs, filterBar, pill, appLinks } from './components.js';

export function communityPage(ctx) {
  const { t, locale, data } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.community') }]);
  const clubs = [...data.clubs].sort((a, b) => b.seasonXp - a.seasonXp);
  const countries = [...new Set(clubs.map((c) => c.countryCode))].sort();
  const body = `
${pageHero({ kicker: t('community.kicker'), title: t('community.title'), lead: t('community.lead'), extra: bc.html })}
<section class="section pt-0" id="join">
  <div class="container">
    <h2 class="h3">${esc(t('community.joinTitle'))}</h2>
    <ol class="steps steps-4">
      ${t('community.join')
        .map(
          (s, i) =>
            `<li class="step"><span class="step-num">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`,
        )
        .join('')}
    </ol>
  </div>
</section>
<section class="section section-alt" id="clubs">
  <div class="container">
    <h2 class="h3">${esc(t('community.clubsTitle'))}</h2>
    <p class="muted">${esc(t('community.clubsLead'))}</p>
    ${filterBar(ctx, {
      total: clubs.length,
      selects: [
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
    <ol class="grid grid-2" data-filter-list>
      ${clubs
        .map(
          (
            c,
            i,
          ) => `<li class="card card-club" data-item data-name="${esc(c.name.toLowerCase())} ${esc(c.university.toLowerCase())} ${esc(c.city.toLowerCase())}" data-country="${c.countryCode}">
        <div class="card-body">
          <div class="club-head">
            <span class="rank">#${i + 1}</span>
            <div>
              <h3>${esc(c.name)} ${c.isVerified ? icon('check-circle', 'ico ico-xs ok', t('community.verifiedClub')) : ''}</h3>
              <p class="card-sub">${esc(c.university)} · ${esc(c.city)} ${flag(c.countryCode)}</p>
            </div>
          </div>
          <p class="card-text">${esc(c.description)}</p>
          <p class="card-meta">${icon('users', 'ico ico-xs')} ${fmtNumber(c.memberCount, locale)} ${t('common.members')}<span aria-hidden="true">·</span>${icon('zap', 'ico ico-xs')} ${fmtNumber(c.seasonXp, locale)} ${t('community.seasonXp')}${c.foundedYear ? `<span aria-hidden="true">·</span>${icon('calendar', 'ico ico-xs')} ${c.foundedYear}` : ''}</p>
          <div class="pill-row">${c.adventureTypes.map((a) => pill(t(`adventure.${a}`), { cls: 'pill-soft', iconName: ADVENTURE_ICON[a] })).join('')}</div>
          ${c.instagram ? `<p class="small"><a href="https://instagram.com/${esc(c.instagram)}" rel="noopener nofollow">${icon('instagram', 'ico ico-xs')} @${esc(c.instagram)}</a></p>` : ''}
        </div>
      </li>`,
        )
        .join('')}
    </ol>
  </div>
</section>
<section class="section" id="groups">
  <div class="container">
    <h2 class="h3">${esc(t('community.groupsTitle'))}</h2>
    <p class="muted">${esc(t('community.groupsLead'))}</p>
    <ul class="grid grid-3">
      ${data.groups
        .map(
          (g) => `<li class="card card-group">
        <div class="card-body">
          <h3>${esc(g.name)}</h3>
          <p class="card-sub">${g.city ? `${icon('map-pin', 'ico ico-xs')} ${esc(g.city)} · ` : ''}${fmtNumber(g.memberCount, locale)} ${t('common.members')} · ${esc(t('community.public'))}</p>
          <p class="card-text">${esc(g.description)}</p>
          <div class="pill-row">${g.adventureTypes.map((a) => pill(t(`adventure.${a}`), { cls: 'pill-soft' })).join('')}</div>
        </div>
      </li>`,
        )
        .join('')}
    </ul>
    ${appLinks(ctx, { appPath: 'groups' })}
  </div>
</section>
<section class="section section-alt" id="guidelines">
  <div class="container narrow">
    <h2 class="h3">${esc(t('community.guidelinesTitle'))}</h2>
    <ul class="checklist">${t('community.guidelines')
      .map((g) => `<li>${icon('shield', 'ico ico-xs')}${esc(g)}</li>`)
      .join('')}</ul>
  </div>
</section>`;
  return {
    title: t('community.title'),
    description: t('community.metaDescription'),
    body,
    ld: [bc.ld],
    section: 'community',
  };
}
