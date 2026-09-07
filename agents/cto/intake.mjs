#!/usr/bin/env node
/**
 * Talep alımı — tüzük §9 adım 1–6.
 *
 *   node agents/cto/intake.mjs "Karadeniz'de 3 günlük trekking rotası önerisi ekle"
 *   node agents/cto/intake.mjs --json "..."      → yalnızca JSON (panel/CI için)
 *   node agents/cto/intake.mjs --dry "..."       → kayıt yazma, sadece göster
 *
 * Bu betik **kod yazmaz ve kod yazdırmaz**. Talebi okur, hangi sistemleri
 * etkileyeceğini çıkarır, risk seviyesini belirler, insan onayı gerekip
 * gerekmediğini söyler ve boru hattını başlatır. Kodu yazan ajanlar bu kaydı
 * girdi olarak alır.
 */
import { analyzeImpact, likelyPaths } from './lib/impact.mjs';
import { initialSteps, summarize } from './lib/pipeline.mjs';
import { currentLevel, loadPolicy } from './lib/policy.mjs';
import { approvalsRequired, classify, modelFor } from './lib/risk-classify.mjs';
import { appendAudit, requestId, saveRequest } from './lib/store.mjs';

/** Talepten yapılandırılmış kayıt üretir (saf — dosya yazmaz). */
export function intake(text, { policy = loadPolicy(), at = new Date(), root } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Boş talep');

  const impact = analyzeImpact(trimmed, root ? { root } : {});
  const paths = likelyPaths(impact.modules, root ? { root } : {});
  const risk = classify({ text: trimmed, paths }, policy);
  const approvals = approvalsRequired({ text: trimmed, paths }, policy);
  const level = currentLevel(policy);

  const questions = [];
  if (impact.unresolved) {
    questions.push(
      'Talep hiçbir mevcut modülle eşleşmedi — yeni bir modül mü açılacak, yoksa hangi modülü kastediyorsun?',
    );
  }
  if (approvals.length) {
    questions.push(`İnsan onayı gerektiren alan(lar): ${approvals.map((a) => a.label).join(', ')}`);
  }

  return {
    id: requestId(trimmed, at),
    createdAt: at.toISOString(),
    request: trimmed,
    autonomy: level.id,
    understanding: {
      // Ne anladığımızın kanıtı, eşleşen kelimelerin kendisidir; yorum değil veri.
      matched: impact.matched,
      questions,
    },
    impact: {
      modules: impact.modules,
      tables: impact.tables,
      paths,
      unresolved: impact.unresolved,
    },
    risk: { level: risk.level, reasons: risk.reasons },
    approvals,
    models: {
      architecture: modelFor('architecture', risk.level, policy),
      implement: modelFor('implement', risk.level, policy),
      review: modelFor('review', risk.level, policy),
    },
    steps: initialSteps(risk.level, policy),
    status: 'open',
  };
}

/** İnsan gözü için kısa özet. */
export function render(record) {
  const lines = [];
  const s = summarize(record.steps);
  lines.push(`# ${record.id}`);
  lines.push('');
  lines.push(`**Talep:** ${record.request}`);
  lines.push('');
  lines.push(`**Risk:** ${record.risk.level}  ·  **Otonomi:** ${record.autonomy}`);
  if (record.risk.reasons.length) {
    lines.push(
      `  gerekçe: ${record.risk.reasons.map((r) => `${r.level}←${r.kind}:${r.value}`).join(', ')}`,
    );
  }
  lines.push('');
  lines.push(
    `**Etkilenen modüller:** ${record.impact.modules.length ? record.impact.modules.join(', ') : '— (eşleşme yok)'}`,
  );
  if (record.impact.tables.length) lines.push(`**Tablolar:** ${record.impact.tables.join(', ')}`);
  if (record.impact.paths.length) lines.push(`**Olası yollar:** ${record.impact.paths.join(', ')}`);
  lines.push('');
  if (record.approvals.length) {
    lines.push('**İnsan onayı zorunlu:**');
    for (const a of record.approvals) lines.push(`  - ${a.label} (${a.kind}: ${a.because})`);
    lines.push('');
  }
  if (record.understanding.questions.length) {
    lines.push('**Sorular:**');
    for (const q of record.understanding.questions) lines.push(`  - ${q}`);
    lines.push('');
  }
  lines.push('**Adımlar:**');
  for (const step of record.steps) {
    const mark = { pending: '·', skipped: '↷', passed: '✓', failed: '✗', blocked: '⏸', running: '…' }[step.status];
    lines.push(`  ${mark} ${step.label}${step.note ? ` — ${step.note}` : ''}`);
  }
  lines.push('');
  lines.push(`Sıradaki adım: ${s.current ?? '—'}`);
  lines.push(`Model: mimari=${record.models.architecture} · uygulama=${record.models.implement} · inceleme=${record.models.review}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const dry = argv.includes('--dry');
  const text = argv.filter((a) => !a.startsWith('--')).join(' ');
  if (!text) {
    console.error('Kullanım: node agents/cto/intake.mjs "talep metni" [--json] [--dry]');
    process.exit(2);
  }
  const record = intake(text);
  if (!dry) {
    saveRequest(record);
    appendAudit({
      requestId: record.id,
      action: 'intake',
      step: 'understand',
      evidence: `risk=${record.risk.level} modüller=${record.impact.modules.join('|') || 'yok'}`,
    });
  }
  console.log(json ? JSON.stringify(record, null, 2) : render(record));
}
