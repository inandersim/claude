/**
 * Talep kayıtları ve denetim izi.
 *
 * Kayıtlar `agents/cto/out/requests/<id>.json`, denetim izi
 * `agents/cto/out/audit.jsonl` altındadır. Denetim izi **yalnızca eklenir**:
 * `appendAudit` dosyayı asla okuyup yeniden yazmaz, yalnızca `appendFileSync`
 * kullanır — bir kaydı geri almak için "geri alındı" kaydı yazılır.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { OUT_DIR } from './policy.mjs';

export const REQUESTS_DIR = join(OUT_DIR, 'requests');
export const AUDIT_PATH = join(OUT_DIR, 'audit.jsonl');

const ensureDir = (path) => mkdirSync(dirname(path), { recursive: true });

/** Zaman + kısa özetten okunabilir, çakışmayan kimlik üretir. */
export function requestId(text, at = new Date()) {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const slug = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${stamp}-${slug || 'talep'}`;
}

export function saveRequest(record, { dir = REQUESTS_DIR } = {}) {
  const path = join(dir, `${record.id}.json`);
  ensureDir(path);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return path;
}

export function loadRequest(id, { dir = REQUESTS_DIR } = {}) {
  const path = join(dir, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listRequests({ dir = REQUESTS_DIR } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * Denetim kaydı ekler. Alanlar tüzük §11 ile birebir aynıdır.
 * Dönen satır testlerde doğrulanabilsin diye string olarak da verilir.
 */
export function appendAudit(entry, { path = AUDIT_PATH } = {}) {
  const row = {
    at: entry.at ?? new Date().toISOString(),
    agent: entry.agent ?? 'ai-cto',
    requestId: entry.requestId ?? null,
    action: entry.action,
    step: entry.step ?? null,
    filesChanged: entry.filesChanged ?? [],
    databaseChanges: entry.databaseChanges ?? [],
    tests: entry.tests ?? null,
    security: entry.security ?? null,
    approval: entry.approval ?? null,
    deployment: entry.deployment ?? null,
    evidence: entry.evidence ?? null,
  };
  if (!row.action) throw new Error('Denetim kaydı `action` alanı olmadan yazılamaz');
  const line = `${JSON.stringify(row)}\n`;
  ensureDir(path);
  appendFileSync(path, line, 'utf8');
  return { row, line };
}

export function readAudit({ path = AUDIT_PATH } = {}) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
