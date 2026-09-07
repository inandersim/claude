/**
 * 13 adımlı boru hattının durum makinesi (saf mantık — dosya yazmaz).
 *
 * Kural: bir adım ancak **kendinden öncekiler geçtiyse** başlayabilir ve ancak
 * **kapısı kanıtla geçildiyse** tamamlanabilir. "Geçti" demek yetmez; `evidence`
 * alanı boşsa kapı geçilmiş sayılmaz — tüzük §9.
 *
 * Atlanabilir adımlar (`skippable`) yalnızca LOW riskli taleplerde ve yalnızca
 * `fastPath.skip` listesindeyse atlanır. `neverSkip` listesindekiler hiçbir
 * koşulda atlanamaz; kod bunu politikadan okur, kendi kopyasını tutmaz.
 */
export const PENDING = 'pending';
export const RUNNING = 'running';
export const PASSED = 'passed';
export const FAILED = 'failed';
export const SKIPPED = 'skipped';
export const BLOCKED = 'blocked';

/** Talep için başlangıç adım durumları. */
export function initialSteps(risk, policy) {
  const fast = policy.pipeline.fastPath;
  const canSkip = fast && risk === fast.risk;
  return policy.pipeline.steps.map((step) => ({
    id: step.id,
    label: step.label,
    gate: step.gate,
    status: canSkip && step.skippable && fast.skip.includes(step.id) ? SKIPPED : PENDING,
    evidence: null,
    note: canSkip && step.skippable && fast.skip.includes(step.id) ? 'LOW risk — hızlı yol' : null,
    at: null,
  }));
}

/** Sıradaki çalıştırılabilir adım (yoksa null). */
export function nextStep(steps) {
  return steps.find((s) => s.status === PENDING || s.status === RUNNING) ?? null;
}

/** Hat, insan onayını bekliyor mu? */
export function isBlocked(steps) {
  return steps.some((s) => s.status === BLOCKED);
}

/** Tamamlandı mı? (Her adım geçti ya da atlandı.) */
export function isComplete(steps) {
  return steps.every((s) => s.status === PASSED || s.status === SKIPPED);
}

/**
 * Bir adımın sonucunu işler ve **yeni** adım dizisi döner (girdi değişmez).
 *
 * @param {object[]} steps
 * @param {string} id
 * @param {{ status: string, evidence?: string|null, note?: string|null, at?: string }} result
 */
export function applyResult(steps, id, result, policy) {
  const index = steps.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Bilinmeyen adım: ${id}`);

  const earlier = steps.slice(0, index);
  const unfinished = earlier.find((s) => s.status !== PASSED && s.status !== SKIPPED);
  if (unfinished && result.status !== BLOCKED) {
    throw new Error(`"${id}" adımı başlayamaz: önce "${unfinished.id}" tamamlanmalı`);
  }

  const neverSkip = policy.pipeline.fastPath?.neverSkip ?? [];
  if (result.status === SKIPPED && neverSkip.includes(id)) {
    throw new Error(`"${id}" adımı atlanamaz (policy.pipeline.fastPath.neverSkip)`);
  }
  if (result.status === PASSED && !result.evidence) {
    throw new Error(`"${id}" adımı kanıtsız geçemez: evidence alanı zorunlu`);
  }

  const next = steps.map((s) => ({ ...s }));
  next[index] = {
    ...next[index],
    status: result.status,
    evidence: result.evidence ?? next[index].evidence,
    note: result.note ?? next[index].note,
    at: result.at ?? new Date().toISOString(),
  };
  return next;
}

/** Özet: kaçı geçti, kaçı bekliyor, nerede duruyor. */
export function summarize(steps) {
  const count = (status) => steps.filter((s) => s.status === status).length;
  const current = nextStep(steps);
  return {
    total: steps.length,
    passed: count(PASSED),
    skipped: count(SKIPPED),
    failed: count(FAILED),
    blocked: count(BLOCKED),
    current: current?.id ?? null,
    complete: isComplete(steps),
    stuck: isBlocked(steps) || count(FAILED) > 0,
  };
}
