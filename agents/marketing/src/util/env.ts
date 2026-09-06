import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.env` dosyasını (varsa) process.env'e yükler — bağımlılık yok, Node 22 `process.loadEnvFile`.
 * Var olan ortam değişkenleri ezilmez.
 */
export function loadEnv(cwd: string = process.cwd()): string | null {
  const candidates = [resolve(cwd, '.env'), resolve(cwd, 'agents/marketing/.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      return file;
    } catch {
      return null;
    }
  }
  return null;
}

/** Zorunlu ortam değişkeni; yoksa açıklayıcı hata. */
export function requireEnv(
  env: Record<string, string | undefined>,
  name: string,
  hint: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} tanımlı değil. ${hint}`);
  return value;
}
