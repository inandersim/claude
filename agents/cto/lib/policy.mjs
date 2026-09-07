/**
 * `agents/cto/policy.json` okuma (yalnızca Node).
 *
 * Politika **veridir**, kod değildir: betikler ve yönetim paneli aynı dosyayı
 * okur, böylece "belgede yazan" ile "kodda uygulanan" ayrışamaz. Dosya bozuksa
 * betik çalışmaz — sessizce varsayılana düşmek, kapıları görünmez şekilde
 * gevşetirdi.
 *
 * Saf sorgular `policy-core.mjs` içindedir ve buradan yeniden dışa verilir;
 * tarayıcı tarafı doğrudan çekirdeği içe aktarır.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertPolicyShape } from './policy-core.mjs';

export { assertPolicyShape, can, currentLevel, denyReason, matchPath } from './policy-core.mjs';

/** `agents/cto` klasörü (lib → ..). */
export const CTO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Depo kökü. */
export const ROOT = resolve(CTO_DIR, '..', '..');

/** Betiklerin ürettiği kayıtların yeri. */
export const OUT_DIR = resolve(CTO_DIR, 'out');

export const POLICY_PATH = resolve(CTO_DIR, 'policy.json');

let cached = null;

/** Politikayı okur (süreç ömrü boyunca bir kez). Bozuksa fırlatır. */
export function loadPolicy(path = POLICY_PATH) {
  if (cached && path === POLICY_PATH) return cached;
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Politika okunamadı (${path}): ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Politika bozuk JSON (${path}): ${err.message}`);
  }
  assertPolicyShape(parsed, path);
  if (path === POLICY_PATH) cached = parsed;
  return parsed;
}

/** Testlerin araya girebilmesi için önbelleği temizler. */
export function resetPolicyCache() {
  cached = null;
}
