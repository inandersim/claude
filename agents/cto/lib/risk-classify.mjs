/**
 * Risk sınıflandırması — **deterministik**.
 *
 * Seviye, dokunulan yollar ve talep metnindeki anahtar kelimelerden çıkar; bir
 * dil modeli tarafından belirlenmez. Model seviyeyi yalnızca yükseltebilir
 * (`escalateTo`), düşüremez: `classify()` sonucu tavan değil taban kabul edilir.
 *
 * Sebep: risk sınıfı bütün kapıları belirliyor. Bunu modele bırakmak, kapının
 * anahtarını kapıdan geçecek olana vermek olurdu.
 *
 * Politika **parametre olarak** geçirilir; bu dosya dosya sistemine dokunmaz ve
 * tarayıcıdaki yönetim paneli tarafından da içe aktarılır.
 */
import { matchPath } from './policy-core.mjs';

const ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** İki seviyeden yüksek olanı. */
export function maxLevel(a, b) {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

const normalize = (s) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

/**
 * @param {{ text?: string, paths?: string[] }} input
 * @returns {{ level: string, reasons: Array<{level: string, kind: 'path'|'keyword', value: string}> }}
 */
export function classify({ text = '', paths = [] } = {}, policy) {
  const hay = normalize(text);
  const reasons = [];
  let level = null;

  // Yüksekten alçağa bakılır; ilk eşleşen seviye taban olur, sonra da eşleşmeler
  // toplanmaya devam eder (raporda hepsi görünsün diye).
  for (const candidate of ['CRITICAL', 'HIGH', 'LOW']) {
    const rule = policy.risk.escalate[candidate];
    if (!rule) continue;
    for (const pattern of rule.paths ?? []) {
      const hit = paths.find((p) => matchPath(pattern, p));
      if (hit) {
        reasons.push({ level: candidate, kind: 'path', value: hit });
        level = level ? maxLevel(level, candidate) : candidate;
      }
    }
    for (const kw of rule.keywords ?? []) {
      if (hay.includes(normalize(kw))) {
        reasons.push({ level: candidate, kind: 'keyword', value: kw });
        level = level ? maxLevel(level, candidate) : candidate;
      }
    }
  }

  // LOW yalnızca tek başına kaldığında geçerlidir: "belge güncelle" LOW'dur ama
  // "RLS belgesini ve politikasını güncelle" LOW olamaz.
  return { level: level ?? policy.risk.default, reasons };
}

/** Modelin ya da insanın seviyeyi yükseltmesi (düşürme reddedilir). */
export function escalateTo(current, proposed) {
  const next = maxLevel(current, proposed);
  return { level: next, changed: next !== current, rejected: next !== proposed };
}

/**
 * Talep, insan onayı zorunlu kategorilere giriyor mu?
 * Risk seviyesinden bağımsızdır: LOW riskli bir "hesap silme metnini değiştir"
 * talebi bile kişisel veri kategorisine girer.
 */
export function approvalsRequired({ text = '', paths = [] } = {}, policy) {
  const hay = normalize(text);
  const hits = [];
  for (const rule of policy.humanApprovalRequired) {
    const byPath = (rule.detect?.paths ?? []).find((pattern) => paths.some((p) => matchPath(pattern, p)));
    const byKeyword = (rule.detect?.keywords ?? []).find((kw) => hay.includes(normalize(kw)));
    if (byPath || byKeyword) {
      hits.push({ id: rule.id, label: rule.label, because: byPath ?? byKeyword, kind: byPath ? 'path' : 'keyword' });
    }
  }
  return hits;
}

/** Risk seviyesine göre hangi model kullanılmalı. */
export function modelFor(step, level, policy) {
  const escalated = policy.models.escalation?.byRisk?.[level];
  if (escalated) return escalated;
  for (const [model, steps] of Object.entries(policy.models)) {
    if (model === 'escalation') continue;
    if (Array.isArray(steps) && steps.includes(step)) return model;
  }
  return 'sonnet';
}
