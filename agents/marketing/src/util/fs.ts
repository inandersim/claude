import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Paket kökü (agents/marketing) — ESM'de __dirname yok. */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Paket kökündeki `dist/src/util` → `templates/` gibi dizinlere erişim. */
export function packagePath(...segments: string[]): string {
  return resolve(PACKAGE_ROOT, ...segments);
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

export function readText(file: string): string {
  return readFileSync(file, 'utf8');
}

/** `content/week-01` gibi sıfır dolgulu hafta dizini adı. */
export function weekDir(week: number): string {
  return `week-${String(week).padStart(2, '0')}`;
}

/** Bugünün tarihi YYYY-MM-DD (yerel saat). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO tarihe gün ekler (UTC üzerinden, saat dilimi kaymasız). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Verilen tarihten sonraki (ya da aynı gün) Pazartesi. */
export function nextMonday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const day = date.getUTCDay(); // 0 Pazar … 6 Cumartesi
  const delta = day === 1 ? 0 : (8 - day) % 7;
  return addDays(iso, delta);
}
