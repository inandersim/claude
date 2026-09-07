/**
 * `agents/cto/policy.json` okuma ve sorgulama.
 *
 * Politika **veridir**, kod değildir: betikler ve yönetim paneli aynı dosyayı okur,
 * böylece "belgede yazan" ile "kodda uygulanan" ayrışamaz. Dosya bozuksa betik
 * çalışmaz — sessizce varsayılana düşmek, kapıları görünmez şekilde gevşetirdi.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  assertShape(parsed, path);
  if (path === POLICY_PATH) cached = parsed;
  return parsed;
}

/** Testlerin araya girebilmesi için önbelleği temizler. */
export function resetPolicyCache() {
  cached = null;
}

/**
 * Politikanın taşıması gereken alanlar. Eksik alan sessizce `undefined` olarak
 * dolaşırsa kapı kontrolü hiç çalışmadan "geçti" görünür; bu yüzden erken fırlatılır.
 */
function assertShape(p, path) {
  const missing = [];
  if (!p?.autonomy?.current) missing.push('autonomy.current');
  if (!Array.isArray(p?.autonomy?.levels)) missing.push('autonomy.levels');
  if (!Array.isArray(p?.pipeline?.steps)) missing.push('pipeline.steps');
  if (!Array.isArray(p?.humanApprovalRequired)) missing.push('humanApprovalRequired');
  if (!p?.risk?.escalate) missing.push('risk.escalate');
  if (!Array.isArray(p?.securityReport?.allowedStatuses)) missing.push('securityReport.allowedStatuses');
  if (missing.length) throw new Error(`Politika eksik (${path}): ${missing.join(', ')}`);
}

/** Etkin otonomi seviyesinin tanımı. */
export function currentLevel(policy = loadPolicy()) {
  const level = policy.autonomy.levels.find((l) => l.id === policy.autonomy.current);
  if (!level) throw new Error(`Bilinmeyen otonomi seviyesi: ${policy.autonomy.current}`);
  return level;
}

/**
 * Bir yetenek etkin seviyede açık mı?
 * Bilinmeyen yetenek adı `false` döner — yanlış yazılmış bir bayrak izin vermemeli.
 */
export function can(capability, policy = loadPolicy()) {
  return currentLevel(policy)[capability] === true;
}

/** Glob benzeri basit desen eşleştirme (`*` ve `**`). */
export function matchPath(pattern, path) {
  const rx = new RegExp(
    `^${pattern
      .split('**')
      .map((part) =>
        part
          .split('*')
          .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]*'),
      )
      .join('.*')}$`,
  );
  return rx.test(path);
}

/** Yol, hattın dokunamayacağı listede mi? */
export function denyReason(path, policy = loadPolicy()) {
  const hit = (policy.denyPaths ?? []).find((d) => matchPath(d.pattern, path));
  return hit ? hit.reason : null;
}
