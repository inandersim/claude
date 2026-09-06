/** Eğitimler: kurslar + eğitmenler */
import { esc, fmtTry, fmtNumber, fmtDuration } from './lib.js';
import { icon, ADVENTURE_ICON } from './icons.js';
import { pageHero, breadcrumbs, filterBar, pill, cover, appLinks } from './components.js';

export function coursesPage(ctx) {
  const { t, url, lang, locale, data, site } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.courses') }]);
  const courses = data.courses;
  const categories = [...new Set(courses.map((c) => c.category))];
  const levels = [...new Set(courses.map((c) => c.level))];
  const formats = [...new Set(courses.map((c) => c.format))];
  const body = `
${pageHero({ kicker: t('courses.kicker'), title: t('courses.title'), lead: t('courses.lead'), extra: bc.html })}
<section class="section pt-0" id="courses">
  <div class="container">
    <h2 class="h3">${esc(t('courses.coursesTitle'))}</h2>
    ${filterBar(ctx, {
      total: courses.length,
      selects: [
        {
          label: t('common.type'),
          attr: 'type',
          options: categories.map((c) => ({ value: c, label: t(`courses.category.${c}`) })),
        },
        {
          label: t('common.difficulty'),
          attr: 'level',
          options: levels.map((l) => ({ value: l, label: t(`courses.level.${l}`) })),
        },
        {
          label: t('routes.filterKind'),
          attr: 'format',
          options: formats.map((f) => ({ value: f, label: t(`courses.format.${f}`) })),
        },
      ],
    })}
    <div class="grid grid-3" data-filter-list>
      ${courses
        .map(
          (
            c,
          ) => `<article class="card card-course" data-item data-name="${esc(c.title.toLowerCase())} ${esc(c.provider.toLowerCase())}" data-type="${c.category}" data-level="${c.level}" data-format="${c.format}">
        <div class="card-media card-media-sm">${cover(c.adventureTypes[0] ?? 'default', '', ctx)}<span class="card-badge">${esc(t(`courses.category.${c.category}`))}</span></div>
        <div class="card-body">
          <h3>${esc(c.title)}</h3>
          <p class="card-sub">${esc(c.provider)}</p>
          <p class="card-text">${esc(c.summary)}</p>
          <p class="card-meta">${icon('clock', 'ico ico-xs')} ${c.durationHours} ${t('courses.hours')}${c.lessonCount ? `<span aria-hidden="true">·</span>${icon('file-text', 'ico ico-xs')} ${c.lessonCount} ${t('courses.lessons')}` : ''}<span aria-hidden="true">·</span>${icon('star', 'ico ico-xs')} ${fmtNumber(c.rating, locale, 1)} (${fmtNumber(c.reviewCount, locale)})</p>
          <div class="pill-row">${pill(t(`courses.level.${c.level}`), { cls: 'pill-soft' })}${pill(t(`courses.format.${c.format}`), { cls: 'pill-soft' })}${c.certificateName ? pill(t('courses.certificate'), { cls: 'pill-soft', iconName: 'award' }) : ''}</div>
          <details class="card-more"><summary>${esc(t('courses.outcomes'))}</summary><ul class="checklist">${c.outcomes.map((o) => `<li>${icon('check', 'ico ico-xs')}${esc(o)}</li>`).join('')}</ul></details>
          <div class="card-foot"><strong class="price">${c.priceTry ? fmtTry(c.priceTry, locale) : t('common.free')}</strong><a class="btn btn-secondary btn-sm" href="${esc(site.scheme)}://courses/${esc(c.slug)}">${esc(t('courses.enrollInApp'))}</a></div>
        </div>
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>
<section class="section section-alt" id="instructors">
  <div class="container">
    <h2 class="h3">${esc(t('courses.instructorsTitle'))}</h2>
    <p class="muted">${esc(t('courses.instructorsLead'))}</p>
    <div class="grid grid-3">
      ${data.instructors
        .map(
          (i) => `<article class="card card-instructor">
        <div class="card-body">
          <div class="instructor-head">
            <span class="avatar" aria-hidden="true">${esc(
              i.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2),
            )}</span>
            <div><h3>${esc(i.name)}</h3><p class="card-sub">${esc(i.headline)}</p></div>
          </div>
          <p class="card-text">${esc(i.bio)}</p>
          <p class="card-meta">${icon('star', 'ico ico-xs')} ${fmtNumber(i.rating, locale, 1)} (${fmtNumber(i.reviewCount, locale)})<span aria-hidden="true">·</span>${i.yearsExperience} ${t('courses.years')}<span aria-hidden="true">·</span>${fmtNumber(i.studentsCount, locale)} ${t('courses.students')}</p>
          <p class="card-sub">${icon('map-pin', 'ico ico-xs')} ${esc(i.locationName)} · ${esc(i.languages.join(', '))}</p>
          <div class="pill-row">${i.specialties.map((s) => pill(t(`adventure.${s}`), { cls: 'pill-soft', iconName: ADVENTURE_ICON[s] })).join('')}</div>
          <p class="small muted">${esc(t('courses.certifications'))}: ${esc(i.certifications.join(' · '))}</p>
          <div class="card-foot"><strong class="price">${fmtTry(i.pricePerSessionTry, locale)} <span class="small muted">/ ${fmtDuration(i.sessionDurationMin, t)} ${t('common.perSession')}</span></strong><a class="btn btn-secondary btn-sm" href="${esc(site.scheme)}://instructors/${esc(i.id)}">${esc(t('courses.bookInApp'))}</a></div>
        </div>
      </article>`,
        )
        .join('')}
    </div>
    ${appLinks(ctx, { appPath: 'instructors', lead: '' })}
  </div>
</section>`;
  const ld = [
    bc.ld,
    ...courses.slice(0, 20).map((c) => ({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: c.title,
      description: c.summary,
      provider: { '@type': 'Organization', name: c.provider },
      offers: { '@type': 'Offer', price: c.priceTry, priceCurrency: 'TRY' },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: c.format === 'in_person' ? 'onsite' : c.format,
        courseWorkload: `PT${c.durationHours}H`,
      },
      url: `${site.baseUrl}${url(lang, 'courses').replace(site.basePath, '')}#courses`,
    })),
  ];
  return {
    title: t('courses.title'),
    description: t('courses.metaDescription'),
    body,
    ld,
    section: 'courses',
  };
}
