#!/usr/bin/env node
/**
 * Self-heal analizcisi (bağımlılıksız, Node 22).
 *
 * Altı sinyali tek bir önceliklendirilmiş bulgu listesinde birleştirir:
 *   telemetri · CI geçmişi · test kapsamı · paket boyutu/performans · i18n denetimi · güvenlik taraması
 *
 * Öncelik = etki x sıklık x düzeltme kolaylığı (bkz. lib/findings.mjs; önem derecesi
 * kolaylıktan bağımsızdır — zor bir çökme hâlâ kritiktir, sadece sıraya sonra girer).
 *
 * Kaynak seçimi her sinyal için aynı sırayı izler:
 *   1. Gerçek yerel artefakt (coverage/coverage-summary.json, docs/health/bundle-size.json, i18n-check)
 *   2. `--live` verildiyse ağ/gh gerektiren canlı kaynak (gh run list, npm audit, ZIRTAN_TELEMETRY_URL)
 *   3. agents/selfheal/fixtures/ altındaki örnek veri
 * Kullanılan kaynak raporda **her zaman** yazılır; uydurma veri sessizce kullanılmaz.
 *
 * Kullanım:
 *   node agents/selfheal/analyze.mjs [--live] [--out docs/health/self] [--json] [--top 10] [--date YYYY-MM-DD]
 * Çıktılar:
 *   <out>/<YYYY-MM-DD>.json   — makine okunur (propose-fix.mjs ve workflow'lar okur)
 *   <out>/<YYYY-MM-DD>.md     — okunabilir rapor
 *   <out>/latest.json         — son analizin kopyası
 * Çıkış kodu: kritik bulgu varsa 1, aksi halde 0.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseArgs, readJsonSafe, writeJson, writeText, today, ROOT, OUT_DIR, SELFHEAL_DIR, cell, round,
} from './lib/util.mjs';
import { loadTelemetry, groupBySignature } from './lib/telemetry.mjs';
import { fromTelemetry, fromCi, fromCoverage, fromSecurity, fromI18n, prioritize } from './lib/findings.mjs';
import { checkBudgets, collectMeasurements, loadBudgets } from './perf.mjs';

const FIXTURES = join(SELFHEAL_DIR, 'fixtures');

/** Bir komutu çalıştırıp JSON çıktısını okur; başarısızsa null (asla fırlatmaz). */
function runJson(cmd, { timeoutSec = 180 } = {}) {
  const r = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutSec * 1000,
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = r.stdout ?? '';
  const start = out.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(out.slice(start));
  } catch {
    return null;
  }
}

/** Her sinyali toplar ve hangi kaynaktan geldiğini kaydeder. */
async function collectSignals({ live }) {
  const sources = {};

  // 1. Telemetri
  const telemetry = await loadTelemetry();
  sources.telemetri = telemetry.source;
  const groups = groupBySignature(telemetry.events);

  // 2. CI geçmişi
  let ci = null;
  if (live) {
    const runs = runJson(
      'gh run list --workflow=ci.yml --limit 30 --json databaseId,headBranch,conclusion,createdAt 2>/dev/null | ' +
        'node -e \'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d||"[]");process.stdout.write(JSON.stringify({runs:a.map(r=>({id:r.databaseId,branch:r.headBranch,conclusion:r.conclusion,createdAt:r.createdAt,failedStep:null}))}))})\'',
    );
    if (runs?.runs?.length) {
      ci = runs;
      sources.ci = 'gh run list (canlı)';
    }
  }
  if (!ci) {
    ci = readJsonSafe(join(FIXTURES, 'ci-history.json'));
    sources.ci = `fixture:${relative(ROOT, join(FIXTURES, 'ci-history.json'))}`;
  }

  // 3. Test kapsamı
  const realCoverage = join(ROOT, 'coverage', 'coverage-summary.json');
  let coverage = readJsonSafe(realCoverage);
  if (coverage) sources.kapsam = 'coverage/coverage-summary.json';
  else {
    coverage = readJsonSafe(join(FIXTURES, 'coverage-summary.json'));
    sources.kapsam = `fixture:${relative(ROOT, join(FIXTURES, 'coverage-summary.json'))}`;
  }

  // 4. Performans / paket boyutu
  const measurements = await collectMeasurements({});
  sources.performans = measurements.kaynak;

  // 5. i18n denetimi (yerel, ağ gerektirmez → her zaman canlı çalıştırılır)
  let i18n = runJson('node agents/devops/i18n-check.mjs --json', { timeoutSec: 240 });
  if (i18n) sources.i18n = 'agents/devops/i18n-check.mjs (canlı)';
  else sources.i18n = 'atlandı (i18n-check çalıştırılamadı)';

  // 6. Güvenlik taraması (ağ gerektirir)
  let security = null;
  if (live) {
    security = runJson('npm audit --json --omit=dev', { timeoutSec: 240 });
    if (security) sources.guvenlik = 'npm audit --omit=dev (canlı)';
  }
  if (!security) {
    security = readJsonSafe(join(FIXTURES, 'security-audit.json'));
    sources.guvenlik = `fixture:${relative(ROOT, join(FIXTURES, 'security-audit.json'))}`;
  }

  return { telemetry, groups, ci, coverage, measurements, i18n, security, sources };
}

/** Markdown raporu üretir. */
export function renderReport(report) {
  const icon = { kritik: '🔴', yuksek: '🟠', orta: '🟡', dusuk: '⚪' };
  const md = [];
  md.push(`# Kendini iyileştirme analizi — ${report.date}`);
  md.push('');
  md.push(
    `Durum: **${report.summary.overall}** · ${report.summary.total} bulgu ` +
      `(${report.summary.bySeverity.kritik ?? 0} kritik, ${report.summary.bySeverity.yuksek ?? 0} yüksek, ` +
      `${report.summary.bySeverity.orta ?? 0} orta, ${report.summary.bySeverity.dusuk ?? 0} düşük) · ` +
      `commit \`${report.gitRef ?? '?'}\` · üretildi ${report.generatedAt}`,
  );
  md.push('');
  md.push(
    `Telemetri penceresi: ${report.telemetry.window.from} → ${report.telemetry.window.to}, ` +
      `${report.telemetry.window.totalSessions} oturum · ${report.telemetry.valid} geçerli / ` +
      `${report.telemetry.invalid} sözleşme dışı olay`,
  );
  md.push('');

  md.push('## Veri kaynakları');
  md.push('');
  md.push('| Sinyal | Kaynak |');
  md.push('| --- | --- |');
  for (const [k, v] of Object.entries(report.sources)) md.push(`| ${k} | \`${cell(v)}\` |`);
  md.push('');
  md.push(
    '_Fixture kaynakları gerçek sunucu bağlanana kadar geçicidir; `ZIRTAN_TELEMETRY_URL` ve `--live` ile canlıya geçilir._',
  );
  md.push('');

  md.push('## Öncelikli bulgular');
  md.push('');
  md.push('| # | Önem | Puan | Bulgu | Kaynak | Etki | Sıklık | Kolaylık | Otomatik |');
  md.push('| ---: | :-: | ---: | --- | --- | ---: | ---: | ---: | :-: |');
  report.findings.forEach((f, i) => {
    md.push(
      `| ${i + 1} | ${icon[f.severity]} ${f.severity} | ${f.score} | ${cell(f.title)} | ${f.source} | ` +
        `${f.impact} | ${f.frequency} | ${f.ease} | ${f.autoFixable ? 'evet' : f.risky ? 'insan' : 'hayır'} |`,
    );
  });
  md.push('');

  md.push('## Ayrıntılar');
  md.push('');
  for (const [i, f] of report.findings.entries()) {
    md.push(`### ${i + 1}. ${f.title}`);
    md.push('');
    md.push(
      `- **kimlik:** \`${f.id}\` · **önem:** ${f.severity} · **puan:** ${f.score} ` +
        `(etki ${f.impact} x sıklık ${f.frequency} x kolaylık ${f.ease})`,
    );
    md.push(`- **kaynak:** ${f.source} · **tür:** \`${f.kind}\``);
    if (f.detail) md.push(`- **ölçüm:** ${f.detail}`);
    if (f.files?.length) md.push(`- **dosyalar:** ${f.files.map((p) => `\`${p}\``).join(', ')}`);
    if (f.risky) md.push(`- **RİSKLİ ALAN:** ${f.riskCategories.join(', ')} → PR \`needs-human\` etiketiyle açılır, otomatik birleştirilmez`);
    md.push(`- **önerilen düzeltme:** ${f.suggestedFix || '—'}`);
    md.push(
      `- **otomatik düzeltilebilir:** ${f.autoFixable ? 'evet (kırmızı → yeşil kanıtı zorunlu)' : 'hayır — insan kararı ya da ürün kararı'}`,
    );
    md.push('');
  }

  md.push('## Sonraki adım');
  md.push('');
  const auto = report.findings.filter((f) => f.autoFixable);
  if (auto.length) {
    md.push(`${auto.length} bulgu otomatik düzeltme hattına uygun. Sıradaki:`);
    md.push('');
    md.push('```bash');
    md.push(`node agents/selfheal/propose-fix.mjs plan --finding ${auto[0].id}`);
    md.push('```');
  } else {
    md.push('Otomatik düzeltmeye uygun bulgu yok; listedekiler insan ya da ürün kararı gerektiriyor.');
  }
  md.push('');
  md.push(
    '_Her otomatik değişiklik `docs/health/self/CHANGELOG.md` içine kim/ne/neden/kanıt olarak yazılır._',
  );
  return md.join('\n') + '\n';
}

/* ------------------------------ CLI ------------------------------ */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { flag, opt } = parseArgs();
  const live = flag('live');
  const outDir = opt('out', OUT_DIR);
  const date = opt('date', today());
  const top = Number(opt('top', '0'));

  process.stderr.write(`Sinyaller toplanıyor${live ? ' (canlı kaynaklar açık)' : ''}...\n`);
  const signals = await collectSignals({ live });
  const totalSessions = signals.telemetry.window.totalSessions;

  const budgets = loadBudgets();
  const raw = [
    ...fromTelemetry(signals.groups, signals.telemetry.window),
    ...fromCi(signals.ci),
    ...fromCoverage(signals.coverage),
    ...checkBudgets(signals.measurements, budgets),
    ...fromI18n(signals.i18n),
    ...fromSecurity(signals.security),
  ];
  let findings = prioritize(raw, { totalSessions });
  if (top > 0) findings = findings.slice(0, top);

  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  const overall = bySeverity.kritik ? 'kırmızı' : bySeverity.yuksek ? 'sarı' : 'yeşil';

  const gitRef =
    spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() || null;

  const report = {
    schema: 'zirtan.selfheal.analysis/1',
    date,
    generatedAt: new Date().toISOString(),
    gitRef,
    node: process.version,
    live,
    sources: signals.sources,
    telemetry: {
      window: signals.telemetry.window,
      valid: signals.telemetry.events.length,
      invalid: signals.telemetry.invalid.length,
      invalidDetail: signals.telemetry.invalid,
      signatures: signals.groups.length,
    },
    summary: {
      total: findings.length,
      bySeverity,
      overall,
      autoFixable: findings.filter((f) => f.autoFixable).length,
      needsHuman: findings.filter((f) => f.risky).length,
      topScore: findings[0]?.score ?? 0,
    },
    findings,
  };

  const jsonPath = writeJson(join(outDir, `${date}.json`), report);
  writeJson(join(outDir, 'latest.json'), report);
  const mdPath = writeText(join(outDir, `${date}.md`), renderReport(report));
  if (existsSync(join(ROOT, 'node_modules', '.bin', 'prettier'))) {
    spawnSync('npx', ['prettier', '--write', mdPath], { cwd: ROOT, stdio: 'ignore' });
  }

  if (flag('json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(renderReport(report));
  }
  process.stderr.write(
    `\nRapor: ${relative(ROOT, jsonPath)} · ${relative(ROOT, mdPath)}\n` +
      `Durum: ${overall} — ${report.summary.total} bulgu, ${report.summary.autoFixable} otomatik, ${report.summary.needsHuman} insan onayı\n`,
  );
  process.exitCode = bySeverity.kritik ? 1 : 0;
}
