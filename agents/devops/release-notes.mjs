#!/usr/bin/env node
/**
 * git log → Türkçe sürüm notu taslağı (bağımlılıksız, Node 22).
 *
 * Conventional commit önekleri bölümlere eşlenir:
 *   feat → Yeni özellikler · fix → Düzeltmeler · perf → Performans · refactor → İyileştirmeler
 *   docs → Belgeler · test → Testler · chore/build/ci/style → Bakım · diğer → Diğer
 * `!` ya da "BREAKING CHANGE" içerenler ayrıca "Kırıcı değişiklikler" bölümüne gider.
 *
 * Kullanım: node agents/devops/release-notes.mjs [--from <ref>] [--to <ref>] [--version 1.4.0] [--out dosya.md] [--json]
 *   --from verilmezse son git etiketi (yoksa tüm geçmiş) kullanılır.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIELD = '\x1f';
const RECORD = '\x1e';
const SECTIONS = [
  ['feat', 'Yeni özellikler'],
  ['fix', 'Düzeltmeler'],
  ['perf', 'Performans'],
  ['refactor', 'İyileştirmeler'],
  ['docs', 'Belgeler'],
  ['test', 'Testler'],
  ['chore', 'Bakım'],
  ['other', 'Diğer'],
];
const TYPE_ALIAS = { build: 'chore', ci: 'chore', style: 'chore', revert: 'fix' };
const HEADER_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*(?<subject>.+)$/;

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function argValue(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

export function parseCommit(raw) {
  const [hash, subject, body = '', author = '', date = ''] = raw.split(FIELD);
  const m = HEADER_RE.exec(subject.trim());
  const type = m ? (TYPE_ALIAS[m.groups.type] ?? m.groups.type) : 'other';
  const known = SECTIONS.some(([t]) => t === type) ? type : 'other';
  const breaking = Boolean(m?.groups.bang) || /BREAKING CHANGE/i.test(body);
  return {
    hash: hash.slice(0, 7),
    type: known,
    scope: m?.groups.scope ?? null,
    subject: m ? m.groups.subject.trim() : subject.trim(),
    breaking,
    author,
    date: date.slice(0, 10),
  };
}

export function collectCommits({ from, to = 'HEAD' } = {}) {
  const range = from ? `${from}..${to}` : to;
  let out = '';
  try {
    out = git(['log', range, '--no-merges', `--format=%H%x1f%s%x1f%b%x1f%an%x1f%aI%x1e`]);
  } catch {
    return [];
  }
  return out
    .split(RECORD)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseCommit);
}

/** Commit konusunu kullanıcıya dönük cümleye yaklaştırır: ilk harf büyük, sondaki nokta yok. */
function humanize(subject) {
  const s = subject.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

const item = (c) => `- ${c.scope ? `**${c.scope}:** ` : ''}${humanize(c.subject)} (${c.hash})`;

export function renderNotes(commits, { version, date, from, to }) {
  const lines = [];
  lines.push(`## Zirtan v${version} — ${date}`);
  lines.push('');
  const rangeText = from ? `\`${from}..${to}\`` : `\`${to}\` (tüm geçmiş)`;
  lines.push(
    `> Taslak: ${commits.length} commit, aralık ${rangeText}. Satırları kullanıcıya dönük fayda cümlelerine çevirip tekrarları birleştirin.`,
  );
  lines.push('');
  const breaking = commits.filter((c) => c.breaking);
  if (breaking.length) {
    lines.push('### Kırıcı değişiklikler', '', ...breaking.map(item), '');
  }
  for (const [type, title] of SECTIONS) {
    const items = commits.filter((c) => c.type === type);
    if (!items.length) continue;
    lines.push(`### ${title}`, '', ...items.map(item), '');
  }
  const authors = [...new Set(commits.map((c) => c.author).filter(Boolean))];
  if (authors.length) {
    lines.push('### Katkıda bulunanlar', '', ...authors.map((a) => `- ${a}`), '');
  }
  return lines.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let from = argValue('from');
  const to = argValue('to') ?? 'HEAD';
  if (!from) {
    try {
      from = git(['describe', '--tags', '--abbrev=0']);
    } catch {
      from = undefined;
    }
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const version = argValue('version') ?? pkg.version;
  const date = new Date().toISOString().slice(0, 10);
  const commits = collectCommits({ from, to });
  if (process.argv.includes('--json')) {
    process.stdout.write(
      JSON.stringify({ version, date, from: from ?? null, to, commits }, null, 2) + '\n',
    );
  } else {
    const md = renderNotes(commits, { version, date, from, to });
    const out = argValue('out');
    if (out) {
      const target = resolve(ROOT, out);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, md + '\n');
      process.stdout.write(`Sürüm notu yazıldı: ${target} (${commits.length} commit)\n`);
    } else {
      process.stdout.write(md + '\n');
    }
  }
}
