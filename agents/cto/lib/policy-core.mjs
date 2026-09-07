/**
 * Politika üzerinde **saf** sorgular — dosya sistemi yok, ağ yok.
 *
 * Bu dosya hem Node betikleri hem tarayıcıdaki yönetim paneli tarafından
 * içe aktarılır. Kuralların ikinci bir uygulaması olmasın diye ayrıldı:
 * `policy.json` tek kaynak, buradaki fonksiyonlar tek yorumlayıcı.
 * Dosyadan okuma `policy.mjs` içindedir (yalnızca Node).
 */

/**
 * Politikanın taşıması gereken alanlar. Eksik alan sessizce `undefined` olarak
 * dolaşırsa kapı kontrolü hiç çalışmadan "geçti" görünür; bu yüzden fırlatılır.
 */
export function assertPolicyShape(p, source = 'policy') {
  const missing = [];
  if (!p?.autonomy?.current) missing.push('autonomy.current');
  if (!Array.isArray(p?.autonomy?.levels)) missing.push('autonomy.levels');
  if (!Array.isArray(p?.pipeline?.steps)) missing.push('pipeline.steps');
  if (!Array.isArray(p?.humanApprovalRequired)) missing.push('humanApprovalRequired');
  if (!p?.risk?.escalate) missing.push('risk.escalate');
  if (!Array.isArray(p?.securityReport?.allowedStatuses)) missing.push('securityReport.allowedStatuses');
  if (missing.length) throw new Error(`Politika eksik (${source}): ${missing.join(', ')}`);
  return p;
}

/** Etkin otonomi seviyesinin tanımı. */
export function currentLevel(policy) {
  const level = policy.autonomy.levels.find((l) => l.id === policy.autonomy.current);
  if (!level) throw new Error(`Bilinmeyen otonomi seviyesi: ${policy.autonomy.current}`);
  return level;
}

/**
 * Bir yetenek etkin seviyede açık mı?
 * Bilinmeyen yetenek adı `false` döner — yanlış yazılmış bir bayrak izin vermemeli.
 */
export function can(capability, policy) {
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
export function denyReason(path, policy) {
  const hit = (policy.denyPaths ?? []).find((d) => matchPath(d.pattern, path));
  return hit ? hit.reason : null;
}
