#!/usr/bin/env node
/**
 * FEATURE / BUG / SECURITY raporları — tüzük §10.
 *
 *   node agents/cto/report.mjs feature --request <id>
 *   node agents/cto/report.mjs bug     --request <id>
 *   node agents/cto/report.mjs security --request <id>
 *
 * Biçim sabittir: raporlar hem insan hem makine tarafından okunur. Eksik bir
 * bölüm "—" ile işaretlenir; sessizce atlanmaz, çünkü eksik bilgi ile
 * "kontrol edildi ve temiz" birbirine karışmamalıdır.
 */
import { loadPolicy } from './lib/policy.mjs';
import { summarize } from './lib/pipeline.mjs';
import { loadRequest } from './lib/store.mjs';

const dash = (v) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '—' : v);
const list = (arr) => (arr?.length ? arr.map((x) => `- ${x}`).join('\n') : '—');

const stepBy = (record, id) => record.steps.find((s) => s.id === id) ?? null;
const stepLine = (step) => (step ? `${step.status}${step.evidence ? ` — ${step.evidence}` : ''}` : '—');

export function featureReport(record) {
  const s = summarize(record.steps);
  return `# FEATURE — ${record.id}

**Talep:** ${record.request}

| Alan             | Değer                                            |
| ---------------- | ------------------------------------------------ |
| Durum            | ${s.complete ? 'tamamlandı' : s.stuck ? 'durdu' : `devam ediyor (${s.passed}/${s.total})`} |
| Risk             | ${record.risk.level}                              |
| Otonomi          | ${record.autonomy}                                |
| Dağıtım durumu   | ${stepLine(stepBy(record, 'deploy'))}             |

## Değişen dosyalar
${list(record.filesChanged)}

## Veritabanı değişiklikleri
${list(record.databaseChanges)}

## API değişiklikleri
${list(record.apiChanges)}

## Testler
${stepLine(stepBy(record, 'test'))}

## Güvenlik
${stepLine(stepBy(record, 'security'))}

## Performans
${stepLine(stepBy(record, 'performance'))}

## Bilinen sınırlar
${list(record.knownLimitations)}

## Geri alma planı
${dash(record.rollbackPlan)}
`;
}

export function bugReport(record) {
  return `# BUG — ${record.id}

**Belirti:** ${record.request}

## Kök neden
${dash(record.rootCause)}

## Etki
${dash(record.impactSummary)}

## Düzeltme
${dash(record.fix)}

## Değişen dosyalar
${list(record.filesChanged)}

## Regresyon testi
${stepLine(stepBy(record, 'test'))}

## Güvenlik etkisi
${stepLine(stepBy(record, 'security'))}

## Performans etkisi
${stepLine(stepBy(record, 'performance'))}

## Dağıtım durumu
${stepLine(stepBy(record, 'deploy'))}
`;
}

/**
 * Güvenlik raporu. "Kod güvenlidir" gibi mutlak ifadeler politika tarafından
 * yasaklıdır; `assertNoAbsoluteClaim` bunu raporun kendisinde kontrol eder.
 */
export function securityReport(record, policy = loadPolicy()) {
  const f = record.securityFindings ?? {};
  const counts = ['Critical', 'High', 'Medium', 'Low']
    .map((k) => `${k}: ${f[k.toLowerCase()]?.length ?? 0}`)
    .join(' · ');
  const findings = ['critical', 'high', 'medium', 'low']
    .flatMap((sev) => (f[sev] ?? []).map((x) => `- **${sev.toUpperCase()}** ${x.title} — ${x.component ?? '—'}\n  kanıt: ${x.evidence ?? '—'}\n  öneri: ${x.fix ?? '—'}`))
    .join('\n');
  const status = record.securityStatus ?? 'Not Tested';
  if (!policy.securityReport.allowedStatuses.includes(status)) {
    throw new Error(
      `Geçersiz güvenlik durumu "${status}". İzinli: ${policy.securityReport.allowedStatuses.join(', ')}`,
    );
  }
  const text = `# SECURITY — ${record.id}

**Durum:** ${status}

${counts}

## Bulgular
${findings || '—'}

## Etkilenen bileşenler
${list(record.impact?.modules)}
`;
  assertNoAbsoluteClaim(text, policy);
  return text;
}

/** Mutlak güvenlik iddiası içeren metni reddeder (tüzük §10). */
export function assertNoAbsoluteClaim(text, policy = loadPolicy()) {
  const hay = text.toLocaleLowerCase('tr-TR');
  const hit = policy.securityReport.forbiddenPhrases.find((p) => hay.includes(p.toLocaleLowerCase('tr-TR')));
  if (hit) throw new Error(`Güvenlik raporunda yasak ifade: "${hit}" — izinli durumları kullan`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const kind = argv.find((a) => !a.startsWith('--'));
  const i = argv.indexOf('--request');
  const id = i !== -1 ? argv[i + 1] : null;
  if (!kind || !id) {
    console.error('Kullanım: node agents/cto/report.mjs feature|bug|security --request <id>');
    process.exit(2);
  }
  const record = loadRequest(id);
  if (!record) {
    console.error(`Talep bulunamadı: ${id}`);
    process.exit(1);
  }
  const render = { feature: featureReport, bug: bugReport, security: securityReport }[kind];
  if (!render) {
    console.error('Rapor tipi: feature | bug | security');
    process.exit(2);
  }
  console.log(render(record));
}
