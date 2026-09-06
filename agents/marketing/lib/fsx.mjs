/** Dosya sistemi yardımcıları: çıktı klasörü çözümü, yazma günlüğü, JSON okuma. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `agents/marketing` kökü. */
export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Depo kökü (`agents/marketing/../..`). */
export const REPO_ROOT = resolve(PKG_ROOT, '..', '..');

/** `OUT_DIR` ortam değişkeni testlerde çıktıyı geçici klasöre yönlendirir. */
export function outRoot() {
  const custom = process.env.ZIRTAN_OUT_DIR;
  return custom ? resolve(custom) : join(PKG_ROOT, 'out');
}

/** `out/` altında yol üretir (klasörü oluşturmaz). */
export function outPath(...parts) {
  return join(outRoot(), ...parts);
}

/** Yazılan dosyaları biriktirir; betikler sonunda özet basar. */
export class Writer {
  constructor() {
    /** @type {{ path: string, bytes: number }[]} */
    this.written = [];
  }

  /** Metin dosyası yazar (klasörü oluşturur). */
  text(path, content) {
    const body = content.endsWith('\n') ? content : `${content}\n`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, 'utf8');
    this.written.push({ path, bytes: Buffer.byteLength(body) });
    return path;
  }

  /** JSON dosyası yazar (2 boşluk girinti, deterministik). */
  json(path, value) {
    return this.text(path, JSON.stringify(value, null, 2));
  }

  /** Depo köküne göre kısa yollarla özet satırları. */
  summary() {
    return this.written.map((w) => `${relative(REPO_ROOT, w.path)} (${formatBytes(w.bytes)})`);
  }

  get count() {
    return this.written.length;
  }
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** JSON okur; dosya yoksa `fallback` döner. */
export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`JSON okunamadı: ${path} — ${error instanceof Error ? error.message : error}`);
  }
}

/** Basit CSV ayrıştırıcı (tırnak ve gömülü virgül destekli). */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/gu, '_'));
  return rows.slice(1).map((r) => {
    /** @type {Record<string, string>} */
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = r[i] ?? '';
    });
    return obj;
  });
}

/** Satır dizisini CSV'ye çevirir. */
export function toCsv(header, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/u.test(s) ? `"${s.replace(/"/gu, '""')}"` : s;
  };
  return [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}
