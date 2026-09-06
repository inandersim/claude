#!/usr/bin/env node
/**
 * i18n tutarlılık denetimi (bağımlılıksız, Node 22).
 *
 * Her `src/core/i18n/modules/<mod>.ts` için:
 *  - `tr` kaynağının anahtar/yer tutucu haritasını çıkarır,
 *  - `en` ve `locales/<loc>/<mod>.ts` (22 dil) dosyalarını karşılaştırır:
 *      eksik dosya, eksik/fazla anahtar, `{{name}}` yer tutucu kümesi uyuşmazlığı,
 *  - `%{name}` (i18n-js eski biçimi) kullanımını yakalar (`%{{x}}` = yüzde işareti + yer tutucu, sorun değil),
 *  - modül dosyasının dil dosyasını `localeSet(...)` ile bağlayıp bağlamadığını kontrol eder.
 *
 * Kullanım: node agents/devops/i18n-check.mjs [--json] [--strict] [--modules=ai,maps]
 *   --json    : rapor yerine JSON basar
 *   --strict  : eksik dil dosyası da hata sayılır (varsayılan: uyarı)
 * Çıkış kodu: 1 = hata var (anahtar/yer tutucu uyuşmazlığı, %{ kullanımı, strict modda eksik dosya).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULES_DIR = join(ROOT, 'src', 'core', 'i18n', 'modules');
const LOCALES = [
  'de',
  'fr',
  'es',
  'it',
  'ja',
  'pt',
  'ru',
  'zh',
  'ko',
  'hi',
  'ne',
  'ar',
  'ka',
  'el',
  'pl',
  'cs',
  'nl',
  'sv',
  'nb',
  'id',
  'th',
];
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const LEGACY_PLACEHOLDER = /%\{(?!\{)/;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/**
 * Bir TS nesne literalini (`{ ... }`) sığ bir tarayıcıyla okur ve
 * `yol.alt.anahtar -> string değeri` haritası döner. Diziler `yol.0` biçiminde indekslenir.
 * Yorumlar ve şablon/tek/çift tırnaklı stringler doğru atlanır; i18n dosyaları yalnızca
 * nesne, dizi ve string içerdiğinden tam bir TS ayrıştırıcı gerekmez.
 */
export function parseObjectLiteral(src, start) {
  const out = new Map();
  const stack = []; // { key, isArray, index }
  let i = start;
  let pendingKey = null;
  const path = () =>
    stack
      .map((s) => s.key)
      .filter((k) => k !== null && k !== undefined)
      .join('.');

  const readString = (quote) => {
    let s = '';
    i++; // açılış tırnağı
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        s += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === quote) {
        i++;
        return s;
      }
      s += c;
      i++;
    }
    return s;
  };

  const skipComment = () => {
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++;
      return true;
    }
    if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      return true;
    }
    return false;
  };

  const currentKey = () => {
    const top = stack[stack.length - 1];
    if (!top) return null;
    if (top.isArray) return String(top.index);
    return pendingKey;
  };

  const commitValue = (value) => {
    const top = stack[stack.length - 1];
    const key = currentKey();
    const full = [path(), key].filter((k) => k !== null && k !== '').join('.');
    if (typeof value === 'string') out.set(full, value);
    if (top?.isArray) top.index++;
    pendingKey = null;
  };

  while (i < src.length) {
    const c = src[i];
    if (skipComment()) continue;
    if (c === '{' || c === '[') {
      const key = stack.length === 0 ? null : currentKey();
      stack.push({ key, isArray: c === '[', index: 0 });
      pendingKey = null;
      i++;
      continue;
    }
    if (c === '}' || c === ']') {
      stack.pop();
      i++;
      if (stack.length === 0) return { map: out, end: i };
      const top = stack[stack.length - 1];
      if (top.isArray) top.index++;
      pendingKey = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const value = readString(c);
      // string bir anahtar mı ('quoted key': ...) yoksa değer mi?
      let j = i;
      while (j < src.length && /\s/.test(src[j])) j++;
      const top = stack[stack.length - 1];
      if (src[j] === ':' && top && !top.isArray) {
        pendingKey = value;
        i = j + 1;
      } else {
        commitValue(value);
      }
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      const top = stack[stack.length - 1];
      if (src[k] === ':' && top && !top.isArray) {
        pendingKey = word;
        i = k + 1;
      } else {
        // tanımlayıcı değer (ör. başka bir sabite referans) — string değil, sadece ilerle
        commitValue({ ref: word });
        i = j;
      }
      continue;
    }
    i++;
  }
  return { map: out, end: i };
}

function extractBlock(src, pattern) {
  const m = pattern.exec(src);
  if (!m) return null;
  const braceAt = src.indexOf('{', m.index + m[0].length - 1);
  if (braceAt === -1) return null;
  return parseObjectLiteral(src, braceAt).map;
}

function placeholdersOf(value) {
  const set = new Set();
  for (const m of value.matchAll(PLACEHOLDER)) set.add(m[1]);
  return set;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function legacyUses(src, file) {
  const hits = [];
  src.split('\n').forEach((line, idx) => {
    if (LEGACY_PLACEHOLDER.test(line)) hits.push(`${file}:${idx + 1}`);
  });
  return hits;
}

function compare(source, target) {
  const missing = [];
  const extra = [];
  const placeholderMismatch = [];
  for (const [key, value] of source) {
    if (!target.has(key)) {
      missing.push(key);
      continue;
    }
    const a = placeholdersOf(value);
    const b = placeholdersOf(target.get(key));
    if (!sameSet(a, b)) {
      placeholderMismatch.push({ key, expected: [...a], actual: [...b] });
    }
  }
  for (const key of target.keys()) if (!source.has(key)) extra.push(key);
  return { missing, extra, placeholderMismatch };
}

const hasDiff = (d) => d.missing.length || d.extra.length || d.placeholderMismatch.length;
const diffText = (d) =>
  `${d.missing.length} eksik, ${d.extra.length} fazla, ${d.placeholderMismatch.length} yer tutucu uyuşmazlığı`;

export function checkModules({ modules } = {}) {
  const files = readdirSync(MODULES_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'shared.ts')
    .map((f) => f.replace(/\.ts$/, ''))
    .filter((m) => !modules || modules.includes(m));

  const results = [];
  for (const mod of files) {
    const file = join(MODULES_DIR, `${mod}.ts`);
    const rel = `src/core/i18n/modules/${mod}.ts`;
    const src = readFileSync(file, 'utf8');
    const tr = extractBlock(src, /\bconst\s+tr\s*(?::[^=]+)?=\s*\{/);
    const en = extractBlock(src, /\bconst\s+en\s*(?::[^=]+)?=\s*\{/);
    const entry = {
      module: mod,
      keys: tr ? tr.size : 0,
      legacy: legacyUses(src, rel),
      locales: {},
      errors: [],
      warnings: [],
    };
    if (!tr) {
      entry.errors.push('`const tr = {…}` bulunamadı');
      results.push(entry);
      continue;
    }
    if (!en) entry.errors.push('`const en = {…}` bulunamadı');
    else {
      const diff = compare(tr, en);
      entry.locales.en = { file: rel, exists: true, wired: true, ...diff };
      if (hasDiff(diff)) entry.errors.push(`en: ${diffText(diff)}`);
    }
    for (const loc of LOCALES) {
      const locRel = `src/core/i18n/modules/locales/${loc}/${mod}.ts`;
      const locFile = join(ROOT, locRel);
      if (!existsSync(locFile)) {
        entry.locales[loc] = { file: locRel, exists: false };
        entry.warnings.push(`${loc}: dil dosyası yok (İngilizceye düşer)`);
        continue;
      }
      const locSrc = readFileSync(locFile, 'utf8');
      const block = extractBlock(
        locSrc,
        new RegExp(`export\\s+const\\s+${mod}_${loc}\\s*(?::[^=]+)?=\\s*\\{`),
      );
      entry.legacy.push(...legacyUses(locSrc, locRel));
      if (!block) {
        entry.locales[loc] = {
          file: locRel,
          exists: true,
          missing: [],
          extra: [],
          placeholderMismatch: [],
        };
        entry.errors.push(`${loc}: \`export const ${mod}_${loc}\` bulunamadı`);
        continue;
      }
      const diff = compare(tr, block);
      const wired = new RegExp(`['"]\\./locales/${loc}/${mod}['"]`).test(src);
      entry.locales[loc] = { file: locRel, exists: true, wired, ...diff };
      if (!wired)
        entry.errors.push(`${loc}: dosya var ama ${rel} içinde localeSet(...) ile bağlanmamış`);
      if (hasDiff(diff)) entry.errors.push(`${loc}: ${diffText(diff)}`);
    }
    if (entry.legacy.length)
      entry.errors.push(`%{ eski yer tutucu biçimi: ${entry.legacy.join(', ')}`);
    results.push(entry);
  }
  return results;
}

export function renderMarkdown(results, { strict = false } = {}) {
  const lines = [];
  lines.push('| Modül | Anahtar | en | ' + LOCALES.join(' | ') + ' | Durum |');
  lines.push('| --- | ---: | :-: | ' + LOCALES.map(() => ':-:').join(' | ') + ' | --- |');
  const cell = (l) => {
    if (!l) return '—';
    if (!l.exists) return '✗';
    const bad =
      l.missing?.length || l.extra?.length || l.placeholderMismatch?.length || l.wired === false;
    return bad ? '⚠' : '✓';
  };
  for (const r of results) {
    const status = r.errors.length
      ? 'HATA'
      : r.warnings.length
        ? strict
          ? 'HATA'
          : 'uyarı'
        : 'ok';
    lines.push(
      `| ${r.module} | ${r.keys} | ${cell(r.locales.en)} | ${LOCALES.map((l) => cell(r.locales[l])).join(' | ')} | ${status} |`,
    );
  }
  const details = [];
  for (const r of results) {
    const items = [...r.errors, ...(strict ? r.warnings : [])];
    if (!items.length) continue;
    details.push(`\n**${r.module}**`);
    for (const e of items) details.push(`- ${e}`);
    for (const [loc, l] of Object.entries(r.locales)) {
      if (!l?.exists) continue;
      for (const k of (l.missing ?? []).slice(0, 10))
        details.push(`  - ${loc} eksik anahtar: \`${k}\``);
      for (const k of (l.extra ?? []).slice(0, 10))
        details.push(`  - ${loc} fazla anahtar: \`${k}\``);
      for (const p of (l.placeholderMismatch ?? []).slice(0, 10)) {
        details.push(
          `  - ${loc} \`${p.key}\`: beklenen {${p.expected.join(', ')}} bulunan {${p.actual.join(', ')}}`,
        );
      }
    }
  }
  const warn = results.filter((r) => r.warnings.length && !r.errors.length);
  if (!strict && warn.length) {
    details.push('\nEksik dil dosyaları (İngilizceye düşer; `/translate <modül>` ile tamamla):');
    for (const r of warn)
      details.push(`- ${r.module}: ${r.warnings.map((w) => w.split(':')[0]).join(', ')}`);
  }
  return lines.join('\n') + (details.length ? '\n' + details.join('\n') : '') + '\n';
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = flag('strict');
  const modules = opt('modules')?.split(',').filter(Boolean);
  const results = checkModules({ modules });
  const errorCount = results.reduce(
    (n, r) => n + r.errors.length + (strict ? r.warnings.length : 0),
    0,
  );
  const warningCount = results.reduce((n, r) => n + r.warnings.length, 0);
  if (flag('json')) {
    process.stdout.write(
      JSON.stringify({ ok: errorCount === 0, errorCount, warningCount, results }, null, 2) + '\n',
    );
  } else {
    process.stdout.write(
      `# i18n denetimi — ${results.length} modül, ${errorCount} hata, ${warningCount} uyarı\n\n`,
    );
    process.stdout.write(renderMarkdown(results, { strict }));
  }
  process.exitCode = errorCount ? 1 : 0;
}
