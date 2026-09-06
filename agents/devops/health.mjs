#!/usr/bin/env node
/**
 * Altyapı sağlık taraması (bağımlılıksız, Node 22).
 *
 * Adımlar (sırayla): lint, typecheck, test, pipeline, i18n, doctor (expo-doctor), audit (npm audit --omit=dev).
 * İlk beşi "zorunlu" (başarısızlık → çıkış kodu 1), doctor ve audit "danışma" (uyarı; ağ gerektirir).
 *
 * Kullanım:
 *   node agents/devops/health.mjs [--dry-run] [--only=lint,test] [--skip=doctor,audit] [--out docs/health] [--json] [--timeout 900]
 * Çıktılar:
 *   <out>/<YYYY-MM-DD>.md   — Markdown rapor (aynı gün tekrar çalışırsa üzerine yazar)
 *   <out>/latest.json       — makine okunur özet (nightly-health.yml ve infra-doctor ajanı okur)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const eq = args.find((a) => a.startsWith(`--${n}=`));
  if (eq) return eq.slice(n.length + 3);
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const STEPS = [
  { id: 'lint', title: 'ESLint', cmd: 'npm run lint -- --max-warnings=0', required: true },
  { id: 'typecheck', title: 'TypeScript', cmd: 'npm run typecheck', required: true },
  { id: 'test', title: 'Jest', cmd: 'npm test -- --ci --silent', required: true },
  { id: 'pipeline', title: 'Veri hattı testleri', cmd: 'npm run test:pipeline', required: true },
  {
    id: 'i18n',
    title: 'i18n tutarlılığı',
    cmd: 'node agents/devops/i18n-check.mjs',
    required: true,
  },
  { id: 'doctor', title: 'expo-doctor', cmd: 'npx expo-doctor', required: false, network: true },
  {
    id: 'deps',
    title: 'expo install --check',
    cmd: 'npx expo install --check',
    required: false,
    network: true,
  },
  {
    id: 'audit',
    title: 'npm audit (üretim)',
    cmd: 'npm audit --omit=dev --audit-level=high',
    required: false,
    network: true,
  },
];

const only = opt('only')?.split(',').filter(Boolean);
const skip = opt('skip')?.split(',').filter(Boolean) ?? [];
const timeoutSec = Number(opt('timeout', '900'));
const outDir = resolve(ROOT, opt('out', 'docs/health'));
const selected = STEPS.filter((s) => (!only || only.includes(s.id)) && !skip.includes(s.id));

if (flag('dry-run')) {
  process.stdout.write(`Sağlık taraması — ${selected.length} adım (kök: ${ROOT})\n`);
  for (const s of selected) {
    process.stdout.write(
      `  [${s.required ? 'zorunlu' : 'danışma'}${s.network ? ', ağ' : ''}] ${s.id.padEnd(10)} ${s.cmd}\n`,
    );
  }
  process.stdout.write(`Rapor: ${outDir}/<YYYY-MM-DD>.md ve ${outDir}/latest.json\n`);
  process.exit(0);
}

function tail(text, n = 40) {
  const lines = text.trimEnd().split('\n');
  return lines.slice(-n).join('\n');
}

function summarize(step, output) {
  const lines = output.split('\n');
  const pick = (re) => lines.find((l) => re.test(l))?.trim();
  switch (step.id) {
    case 'lint':
      return pick(/problems?\s*\(/) ?? pick(/✖/) ?? 'temiz';
    case 'typecheck':
      return pick(/error TS/)
        ? `${lines.filter((l) => /error TS/.test(l)).length} tip hatası`
        : 'temiz';
    case 'test':
      return pick(/^Tests:/) ?? pick(/Test Suites:/) ?? 'çalıştı';
    case 'pipeline':
      return pick(/^# (pass|fail)/) ?? pick(/# tests/) ?? 'çalıştı';
    case 'i18n':
      return pick(/^# i18n denetimi/)?.replace(/^# /, '') ?? 'çalıştı';
    case 'doctor':
      return pick(/checks? (passed|failed)/i) ?? pick(/\d+\/\d+/) ?? 'çalıştı';
    case 'deps':
      return pick(/should be updated|Dependencies are up to date/i) ?? 'çalıştı';
    case 'audit':
      return pick(/found \d+ vulnerabilit/) ?? pick(/vulnerabilities/) ?? 'çalıştı';
    default:
      return 'çalıştı';
  }
}

const results = [];
for (const step of selected) {
  const started = Date.now();
  process.stdout.write(`▶ ${step.id}: ${step.cmd}\n`);
  const r = spawnSync(step.cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutSec * 1000,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const timedOut = r.error?.code === 'ETIMEDOUT';
  const code = timedOut ? 124 : (r.status ?? 1);
  const status = code === 0 ? 'ok' : step.required ? 'fail' : 'warn';
  const durationMs = Date.now() - started;
  results.push({
    id: step.id,
    title: step.title,
    cmd: step.cmd,
    required: step.required,
    network: Boolean(step.network),
    status,
    code,
    timedOut,
    durationMs,
    summary: timedOut ? `zaman aşımı (${timeoutSec}s)` : summarize(step, output),
    tail: tail(output),
  });
  process.stdout.write(
    `  ${status === 'ok' ? '✓' : status === 'warn' ? '△' : '✗'} ${step.id} (${(durationMs / 1000).toFixed(1)}s) — ${results.at(-1).summary}\n`,
  );
}

const failed = results.filter((r) => r.status === 'fail');
const warned = results.filter((r) => r.status === 'warn');
const overall = failed.length ? 'kırmızı' : warned.length ? 'sarı' : 'yeşil';
const date = new Date().toISOString().slice(0, 10);
let gitRef = '';
try {
  const g = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  gitRef = (g.stdout ?? '').trim();
} catch {
  gitRef = '';
}

const report = {
  date,
  generatedAt: new Date().toISOString(),
  gitRef,
  node: process.version,
  overall,
  ok: failed.length === 0,
  steps: results,
};

const icon = { ok: '✅', warn: '⚠️', fail: '❌' };
const md = [];
md.push(`# Sağlık raporu — ${date}`);
md.push('');
md.push(
  `Durum: **${overall}** · commit \`${gitRef || '?'}\` · Node ${process.version} · üretildi ${report.generatedAt}`,
);
md.push('');
md.push('## Adımlar');
md.push('');
md.push('| Adım | Durum | Süre | Özet |');
md.push('| --- | :-: | ---: | --- |');
for (const r of results) {
  md.push(
    `| ${r.title} (\`${r.id}\`) | ${icon[r.status]} | ${(r.durationMs / 1000).toFixed(1)}s | ${r.summary.replace(/\|/g, '\\|')} |`,
  );
}
md.push('');
const problems = results.filter((r) => r.status !== 'ok');
if (problems.length) {
  md.push('## Sorunlu adımların çıktısı (son 40 satır)');
  md.push('');
  for (const r of problems) {
    md.push(
      `### ${r.title} — ${r.status === 'fail' ? 'HATA' : 'uyarı'}${r.network ? ' (ağ gerektirir)' : ''}`,
    );
    md.push('');
    md.push('```text');
    md.push(r.tail || '(çıktı yok)');
    md.push('```');
    md.push('');
  }
}
md.push('## Bulgular');
md.push('');
md.push(
  problems.length
    ? '_infra-doctor ajanı bu bölümü kök neden ve önerilerle doldurur._'
    : 'Tüm adımlar temiz.',
);
md.push('');

mkdirSync(outDir, { recursive: true });
const mdPath = join(outDir, `${date}.md`);
writeFileSync(mdPath, md.join('\n'));
writeFileSync(join(outDir, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
if (existsSync(join(ROOT, 'node_modules', '.bin', 'prettier'))) {
  spawnSync('npx', ['prettier', '--write', mdPath], { cwd: ROOT, stdio: 'ignore' });
}
if (flag('json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.stdout.write(
  `\nRapor: ${mdPath}\nDurum: ${overall} (${failed.length} hata, ${warned.length} uyarı)\n`,
);
process.exitCode = failed.length ? 1 : 0;
