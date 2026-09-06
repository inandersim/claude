#!/usr/bin/env node
/**
 * Web paket boyutu özeti (bağımlılıksız, Node 22).
 *
 * `npx expo export --platform web --output-dir dist` çalıştırır (--no-export ile atlanır),
 * dist/ altındaki dosyaları uzantıya göre toplar (ham + gzip), en büyük 10 dosyayı listeler ve
 * önceki rapora (docs/health/bundle-size.json) göre farkı yazar.
 *
 * Kullanım: node agents/devops/bundle-size.mjs [--no-export] [--dist dist] [--history docs/health/bundle-size.json] [--no-write] [--threshold 5]
 *   --threshold: toplam JS gzip boyutu önceki rapora göre bu yüzdeden fazla artarsa çıkış kodu 1.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};
const distDir = resolve(ROOT, opt('dist', 'dist'));
const historyPath = resolve(ROOT, opt('history', 'docs/health/bundle-size.json'));
const threshold = Number(opt('threshold', '5'));

if (!flag('no-export')) {
  process.stdout.write('▶ npx expo export --platform web\n');
  const r = spawnSync(
    'npx',
    ['expo', 'export', '--platform', 'web', '--output-dir', relative(ROOT, distDir)],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, CI: '1' },
    },
  );
  if (r.status !== 0) {
    process.stderr.write('expo export başarısız\n');
    process.exit(r.status ?? 1);
  }
}
if (!existsSync(distDir)) {
  process.stderr.write(`dist bulunamadı: ${distDir}\n`);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

const files = walk(distDir).map((p) => {
  const size = statSync(p).size;
  const ext = extname(p).toLowerCase() || '(yok)';
  const compressible = ['.js', '.css', '.html', '.json', '.map', '.svg', '.txt'].includes(ext);
  const gzip = compressible ? gzipSync(readFileSync(p)).length : size;
  return { path: relative(distDir, p), ext, size, gzip };
});

const byExt = {};
for (const f of files) {
  byExt[f.ext] ??= { count: 0, size: 0, gzip: 0 };
  byExt[f.ext].count++;
  byExt[f.ext].size += f.size;
  byExt[f.ext].gzip += f.gzip;
}
const total = files.reduce((a, f) => a + f.size, 0);
const totalGzip = files.reduce((a, f) => a + f.gzip, 0);
const jsGzip = byExt['.js']?.gzip ?? 0;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const pct = (a, b) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '—');

let previous = null;
if (existsSync(historyPath)) {
  try {
    const hist = JSON.parse(readFileSync(historyPath, 'utf8'));
    previous = hist.entries?.at(-1) ?? null;
  } catch {
    previous = null;
  }
}

const gitRef =
  spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout?.trim() ?? '';
const entry = {
  date: new Date().toISOString().slice(0, 10),
  gitRef,
  files: files.length,
  total,
  totalGzip,
  jsGzip,
  byExt,
};

const md = [];
md.push(`## Web paket boyutu — ${entry.date} (\`${gitRef || '?'}\`)`);
md.push('');
md.push(
  `Toplam: **${kb(total)}** ham / **${kb(totalGzip)}** gzip · JS gzip: **${kb(jsGzip)}** · ${files.length} dosya`,
);
if (previous) {
  md.push(
    `Önceki (${previous.date}, \`${previous.gitRef}\`): toplam ${kb(previous.total)} (${pct(total, previous.total)}), JS gzip ${kb(previous.jsGzip)} (${pct(jsGzip, previous.jsGzip)})`,
  );
}
md.push('');
md.push('| Uzantı | Dosya | Ham | Gzip |');
md.push('| --- | ---: | ---: | ---: |');
for (const [ext, v] of Object.entries(byExt).sort((a, b) => b[1].size - a[1].size)) {
  md.push(`| ${ext} | ${v.count} | ${kb(v.size)} | ${kb(v.gzip)} |`);
}
md.push('');
md.push('En büyük 10 dosya:');
md.push('');
for (const f of [...files].sort((a, b) => b.size - a.size).slice(0, 10)) {
  md.push(`- \`${f.path}\` — ${kb(f.size)} (gzip ${kb(f.gzip)})`);
}
process.stdout.write(md.join('\n') + '\n');

if (!flag('no-write')) {
  mkdirSync(dirname(historyPath), { recursive: true });
  const hist = existsSync(historyPath)
    ? JSON.parse(readFileSync(historyPath, 'utf8'))
    : { entries: [] };
  hist.entries = [...(hist.entries ?? []).filter((e) => e.date !== entry.date), entry].slice(-60);
  writeFileSync(historyPath, JSON.stringify(hist, null, 2) + '\n');
  process.stdout.write(`\nGeçmiş güncellendi: ${relative(ROOT, historyPath)}\n`);
}

if (
  previous &&
  previous.jsGzip &&
  ((jsGzip - previous.jsGzip) / previous.jsGzip) * 100 > threshold
) {
  process.stderr.write(
    `\nUYARI: JS gzip boyutu %${threshold} eşiğinden fazla arttı (${pct(jsGzip, previous.jsGzip)})\n`,
  );
  process.exitCode = 1;
}
