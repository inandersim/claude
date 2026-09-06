/**
 * Bağımlılıksız argüman ayrıştırıcı — tüm .mjs betikleri aynı sözdizimini konuşur.
 *
 *   node calendar.mjs --start 2026-10-05 --weeks 12 --lang tr,en --json
 *
 * `--anahtar deger`, `--anahtar=deger`, `--bayrak` (boolean) ve `--no-bayrak` desteklenir.
 */

/** @typedef {Record<string, string | boolean>} Flags */

/**
 * @param {readonly string[]} argv `process.argv.slice(2)`
 * @returns {{ flags: Flags, positionals: string[] }}
 */
export function parseArgs(argv) {
  /** @type {Flags} */
  const flags = {};
  /** @type {string[]} */
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const raw = token.slice(2);
    if (raw === '') continue;
    const eq = raw.indexOf('=');
    if (eq !== -1) {
      flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    if (raw.startsWith('no-')) {
      flags[raw.slice(3)] = false;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[raw] = next;
      i += 1;
    } else {
      flags[raw] = true;
    }
  }
  return { flags, positionals };
}

/** `--lang tr,en` → `['tr','en']`; boş/eksikse `fallback`. */
export function listFlag(value, fallback) {
  if (typeof value !== 'string' || value.trim() === '' || value === 'all') return [...fallback];
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Sayısal bayrak; geçersizse `fallback`. */
export function numberFlag(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Boolean bayrak (varsayılan false); `--live` gibi. */
export function boolFlag(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return !['0', 'false', 'hayir', 'hayır', 'no'].includes(value.toLowerCase());
}

/** `--help` yazdırma yardımcısı: başlık + satırlar. */
export function usage(title, lines) {
  return [title, '', ...lines.map((l) => `  ${l}`), ''].join('\n');
}
