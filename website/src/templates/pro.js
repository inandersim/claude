/** Zirtan Pro: plan kartları (ana sayfada da kullanılır) + tam sayfa karşılaştırma */
import { esc, fmtTry, fmtNumber } from './lib.js';
import { icon } from './icons.js';
import { pageHero, breadcrumbs, faq } from './components.js';

export function planCards(ctx, { compact = false } = {}) {
  const { t, url, lang, locale, data } = ctx;
  return `<div class="plans ${compact ? 'plans-compact' : ''}">
  ${data.plans
    .map((p) => {
      const popular = p.id === 'pro';
      return `<article class="plan ${popular ? 'plan-popular' : ''} ${p.forProviders ? 'plan-provider' : ''}">
    ${popular ? `<span class="plan-flag">${esc(t('pro.popular'))}</span>` : ''}
    <h3>${esc(t(`pro.plan.${p.id}.name`))}</h3>
    <p class="plan-desc">${esc(t(`pro.plan.${p.id}.description`))}</p>
    <p class="plan-price">${p.monthlyTry === 0 ? `<strong>${esc(t('common.free'))}</strong>` : `<strong>${fmtTry(p.monthlyTry, locale)}</strong><span>${esc(t('common.tryMonth'))}</span>`}</p>
    ${p.yearlyTry ? `<p class="plan-year">${fmtTry(p.yearlyTry, locale)} ${esc(t('common.tryYear'))} · ${esc(t('pro.save', { percent: Math.round(p.yearlySavings * 100) }))}</p>` : '<p class="plan-year">&nbsp;</p>'}
    <ul class="plan-features">
      ${p.features
        .slice(0, compact ? 4 : 99)
        .map((f) => `<li>${icon('check', 'ico ico-xs')}${esc(t(`pro.features.${f}`))}</li>`)
        .join('')}
    </ul>
    <p class="small muted">${esc(t('pro.commission'))}: %${Math.round(p.commissionRate * 100)}</p>
    <a class="btn ${popular ? 'btn-primary' : 'btn-secondary'} btn-block" href="${url(lang, 'download')}">${esc(t('pro.choose'))}</a>
  </article>`;
    })
    .join('')}
</div>`;
}

export function proPage(ctx) {
  const { t, data, locale } = ctx;
  const bc = breadcrumbs(ctx, [{ label: t('nav.pro') }]);
  const allFeatures = [...new Set(data.plans.flatMap((p) => p.features))];
  const has = (plan, f) =>
    plan.features.includes(f) ||
    (plan.features.includes('allPro') &&
      data.plans.find((x) => x.id === 'pro').features.includes(f));
  const faqBlock = faq(t('pro.faq'));
  const body = `
${pageHero({ kicker: t('pro.kicker'), title: t('pro.title'), lead: t('pro.lead'), extra: bc.html })}
<section class="section pt-0">
  <div class="container">
    ${planCards(ctx)}
    <p class="small muted center mt">${esc(t('pro.legal'))}</p>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2 class="h3">${esc(t('pro.compareTitle'))}</h2>
    <div class="table-wrap"><table class="table table-compare">
      <thead><tr><th></th>${data.plans.map((p) => `<th>${esc(t(`pro.plan.${p.id}.name`))}<br/><span class="small muted">${p.monthlyTry ? `${fmtTry(p.monthlyTry, locale)}${t('common.tryMonth')}` : t('common.free')}</span></th>`).join('')}</tr></thead>
      <tbody>
        ${allFeatures
          .filter((f) => f !== 'allPro')
          .map(
            (f) =>
              `<tr><th scope="row">${esc(t(`pro.features.${f}`))}</th>${data.plans.map((p) => `<td class="center">${has(p, f) ? icon('check-circle', 'ico ok', t('common.yes')) : '<span class="muted">—</span>'}</td>`).join('')}</tr>`,
          )
          .join('')}
        <tr><th scope="row">${esc(t('pro.commission'))}</th>${data.plans.map((p) => `<td class="center">%${Math.round(p.commissionRate * 100)}</td>`).join('')}</tr>
        <tr><th scope="row">${esc(t('pro.yearly'))}</th>${data.plans.map((p) => `<td class="center">${p.yearlyTry ? `${fmtTry(p.yearlyTry, locale)} <span class="small muted">(−${fmtNumber(Math.round(p.yearlySavings * 100), locale)}%)</span>` : '—'}</td>`).join('')}</tr>
      </tbody>
    </table></div>
  </div>
</section>
<section class="section">
  <div class="container narrow">
    <h2 class="h3">${esc(t('pro.faqTitle'))}</h2>
    ${faqBlock.html}
  </div>
</section>`;
  return {
    title: t('pro.title'),
    description: t('pro.metaDescription'),
    body,
    ld: [bc.ld, faqBlock.ld],
    section: 'pro',
  };
}
