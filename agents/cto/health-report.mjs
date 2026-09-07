#!/usr/bin/env node
/**
 * Mühendislik sağlık raporu — tüzük §16.
 *
 *   node agents/cto/health-report.mjs
 *   node agents/cto/health-report.mjs --json
 *
 * **Puan uydurulmaz.** Her eksen sayılabilir bir kaynaktan gelir ve kaynağı
 * raporda yazılıdır. Kaynağı olmayan eksen `—` döner; "veri yok" ile "sorun
 * yok" birbirine karıştırılmaz — bu, raporu güvenilmez kılan tek şeydir.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ROOT } from './lib/policy.mjs';

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/** Bulgu ağırlıkları: kritik bir bulgu, üç düşük bulgudan daha ağırdır. */
const WEIGHT = { kritik: 25, yuksek: 10, orta: 4, dusuk: 1 };

/** 0–100 arası puan; ağırlıklı ceza toplamı 100'den düşülür. */
function scoreFromFindings(bySeverity) {
  const penalty = Object.entries(bySeverity ?? {}).reduce(
    (sum, [sev, n]) => sum + (WEIGHT[sev] ?? 2) * n,
    0,
  );
  return Math.max(0, 100 - penalty);
}

/** selfheal analizi → mimari ve güvenlik ekseni. */
function fromSelfheal(root) {
  const path = resolve(root, 'docs', 'health', 'self', 'latest.json');
  const data = readJson(path);
  if (!data?.summary) return null;
  const security = (data.findings ?? []).filter((f) => f.category === 'guvenlik' || f.kind === 'security');
  return {
    source: 'docs/health/self/latest.json',
    date: data.date ?? null,
    // `live: false` → analiz örnek (fixture) veriyle koştu. Puanı gerçek üretim
    // sinyali gibi sunmak, raporun tamamını güvenilmez yapar.
    live: data.live === true,
    architecture: scoreFromFindings(data.summary.bySeverity),
    security: security.length
      ? scoreFromFindings(
          security.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {}),
        )
      : null,
    critical: data.summary.bySeverity?.kritik ?? 0,
    total: data.summary.total ?? 0,
  };
}

/** Performans bütçeleri → performans ekseni. */
function fromBudgets(root) {
  const path = resolve(root, 'agents', 'selfheal', 'budgets.json');
  const data = readJson(path);
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object' && 'budget' in v);
  if (!entries.length) return { source: 'agents/selfheal/budgets.json', score: null, note: 'ölçüm yok' };
  const over = entries.filter(([, v]) => typeof v.current === 'number' && v.current > v.budget);
  return {
    source: 'agents/selfheal/budgets.json',
    score: Math.round((1 - over.length / entries.length) * 100),
    over: over.map(([k]) => k),
  };
}

/** Test sayısı → test ekseni (kapsam yüzdesi değil; ölçülmeyen şey uydurulmaz). */
function fromTests(root) {
  const dirs = ['src'];
  let files = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.test\.tsx?$/.test(e.name)) files += 1;
    }
  };
  for (const d of dirs) {
    const abs = resolve(root, d);
    if (existsSync(abs)) walk(abs);
  }
  return { source: 'src/**/*.test.ts(x)', files };
}

/** Bağımlılık güvenliği → `npm audit` (ağ yoksa null). */
function fromAudit(root) {
  try {
    const out = execFileSync('npm', ['audit', '--json', '--audit-level=low'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    });
    const data = JSON.parse(out);
    const v = data.metadata?.vulnerabilities ?? {};
    return { source: 'npm audit', critical: v.critical ?? 0, high: v.high ?? 0, total: v.total ?? 0 };
  } catch (err) {
    // `npm audit` açık varsa çıkış kodu 1 döndürür; çıktısı yine JSON'dur.
    try {
      const data = JSON.parse(err.stdout ?? '');
      const v = data.metadata?.vulnerabilities ?? {};
      return { source: 'npm audit', critical: v.critical ?? 0, high: v.high ?? 0, total: v.total ?? 0 };
    } catch {
      return null;
    }
  }
}

export function collect({ root = ROOT, withAudit = true } = {}) {
  return {
    at: new Date().toISOString(),
    selfheal: fromSelfheal(root),
    budgets: fromBudgets(root),
    tests: fromTests(root),
    audit: withAudit ? fromAudit(root) : null,
  };
}

const show = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

export function render(data) {
  const lines = [];
  lines.push('# Mühendislik sağlık raporu');
  lines.push('');
  lines.push(`Üretim: ${data.at}`);
  lines.push('');
  lines.push('| Eksen           | Değer         | Kaynak                              |');
  lines.push('| --------------- | ------------- | ----------------------------------- |');
  lines.push(
    `| Mimari sağlığı  | ${show(data.selfheal?.architecture, '/100').padEnd(13)} | ${show(data.selfheal?.source)} |`,
  );
  lines.push(
    `| Güvenlik        | ${show(data.selfheal?.security, '/100').padEnd(13)} | ${show(data.selfheal?.source)} |`,
  );
  lines.push(`| Performans      | ${show(data.budgets?.score, '/100').padEnd(13)} | ${show(data.budgets?.source)} |`);
  lines.push(`| Test dosyası    | ${show(data.tests?.files).padEnd(13)} | ${show(data.tests?.source)} |`);
  lines.push(
    `| Bağımlılık açığı| ${show(data.audit ? `${data.audit.critical} kritik / ${data.audit.total}` : null).padEnd(13)} | ${show(data.audit?.source)} |`,
  );
  lines.push(`| Kritik sorun    | ${show(data.selfheal?.critical).padEnd(13)} | ${show(data.selfheal?.source)} |`);
  lines.push('');
  if (data.budgets?.over?.length) lines.push(`Bütçe aşan: ${data.budgets.over.join(', ')}`);
  if (!data.selfheal) lines.push('Not: selfheal analizi yok — `node agents/selfheal/analyze.mjs` çalıştır.');
  else if (!data.selfheal.live) {
    lines.push(
      '⚠ selfheal analizi **örnek (fixture) veriyle** koştu; puanlar gerçek üretim sinyali değildir.',
    );
    lines.push('  Gerçek veri: `node agents/selfheal/analyze.mjs --live`');
  }
  lines.push('');
  lines.push('Kaynağı olmayan eksen `—` gösterilir; bu "sorun yok" demek değildir.');
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const json = process.argv.includes('--json');
  const data = collect({ withAudit: !process.argv.includes('--no-audit') });
  console.log(json ? JSON.stringify(data, null, 2) : render(data));
}
