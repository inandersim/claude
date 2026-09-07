#!/usr/bin/env node
/**
 * Boru hattı yürütücüsü — tüzük §9.
 *
 *   node agents/cto/pipeline.mjs status  --request <id>
 *   node agents/cto/pipeline.mjs pass    --request <id> --step test --evidence "73 paket / 904 test yeşil"
 *   node agents/cto/pipeline.mjs fail    --request <id> --step security --note "1 High bulgu"
 *   node agents/cto/pipeline.mjs block   --request <id> --step deploy --note "insan onayı bekliyor"
 *   node agents/cto/pipeline.mjs approve --request <id> --by <kullanıcı> --evidence "PR #12 onaylandı"
 *   node agents/cto/pipeline.mjs list
 *
 * Kapılar kanıt ister: `pass` için `--evidence` zorunludur. Bu betik testleri
 * kendisi çalıştırmaz — kanıtı kaydeder. Testi çalıştırmak CI'nın işidir; iki
 * işi aynı yere koymak, "kendi sınavını kendi değerlendiren" bir hat üretirdi.
 */
import { applyResult, BLOCKED, FAILED, isComplete, PASSED, RUNNING, summarize } from './lib/pipeline.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { appendAudit, listRequests, loadRequest, saveRequest } from './lib/store.mjs';

const STATUS_BY_COMMAND = { pass: PASSED, fail: FAILED, block: BLOCKED, start: RUNNING };

function parse(argv) {
  const opt = (name, fallback = null) => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const i = argv.indexOf(`--${name}`);
    if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    return fallback;
  };
  return { command: argv.find((a) => !a.startsWith('--')), opt };
}

/** Adım sonucunu kayda işler ve denetim izine yazar. */
export function recordStep(record, { step, status, evidence, note, agent = 'ai-cto' }, policy = loadPolicy()) {
  const steps = applyResult(record.steps, step, { status, evidence, note }, policy);
  const updated = { ...record, steps, status: isComplete(steps) ? 'done' : record.status };
  return updated;
}

/** İnsan onayı: yalnızca `deploy` adımını açar, kapıları geçmiş saymaz. */
export function approve(record, { by, evidence }) {
  if (!by) throw new Error('Onay `--by` olmadan kaydedilemez');
  if (!evidence) throw new Error('Onay kanıtsız kaydedilemez');
  const blocked = record.steps.filter((s) => s.status === BLOCKED);
  if (!blocked.length) throw new Error('Onay bekleyen adım yok');
  const steps = record.steps.map((s) =>
    s.status === BLOCKED ? { ...s, status: 'pending', note: `onay: ${by}`, at: new Date().toISOString() } : s,
  );
  return { ...record, steps, approval: { by, at: new Date().toISOString(), evidence } };
}

function renderStatus(record) {
  const s = summarize(record.steps);
  const rows = record.steps.map((step) => {
    const mark = { pending: '·', skipped: '↷', passed: '✓', failed: '✗', blocked: '⏸', running: '…' }[step.status];
    const detail = step.evidence ?? step.note ?? '';
    return `  ${mark} ${step.label.padEnd(16)} ${detail}`;
  });
  return [
    `${record.id}  [${record.risk.level}]  ${record.status}`,
    `  ${record.request}`,
    '',
    ...rows,
    '',
    `  ${s.passed}/${s.total} geçti · ${s.skipped} atlandı · ${s.failed} başarısız · ${s.blocked} onay bekliyor`,
    s.stuck ? '  ⚠ hat durdu' : `  sıradaki: ${s.current ?? '—'}`,
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const { command, opt } = parse(argv);

  if (command === 'list') {
    const all = listRequests();
    if (!all.length) console.log('Kayıtlı talep yok.');
    for (const r of all) {
      const s = summarize(r.steps);
      console.log(`${r.id}  [${r.risk.level}]  ${s.passed}/${s.total}  ${r.request.slice(0, 60)}`);
    }
    process.exit(0);
  }

  const id = opt('request');
  if (!id) {
    console.error('--request <id> gerekli');
    process.exit(2);
  }
  const record = loadRequest(id);
  if (!record) {
    console.error(`Talep bulunamadı: ${id}`);
    process.exit(1);
  }

  try {
    if (command === 'status') {
      console.log(renderStatus(record));
      process.exit(0);
    }
    if (command === 'approve') {
      const updated = approve(record, { by: opt('by'), evidence: opt('evidence') });
      saveRequest(updated);
      appendAudit({
        requestId: id,
        agent: opt('by'),
        action: 'approve',
        approval: { by: opt('by') },
        evidence: opt('evidence'),
      });
      console.log(renderStatus(updated));
      process.exit(0);
    }
    const status = STATUS_BY_COMMAND[command];
    if (!status) {
      console.error('Komutlar: status | start | pass | fail | block | approve | list');
      process.exit(2);
    }
    const step = opt('step');
    if (!step) {
      console.error('--step <adım> gerekli');
      process.exit(2);
    }
    const updated = recordStep(record, {
      step,
      status,
      evidence: opt('evidence'),
      note: opt('note'),
      agent: opt('agent') ?? 'ai-cto',
    });
    saveRequest(updated);
    appendAudit({
      requestId: id,
      agent: opt('agent') ?? 'ai-cto',
      action: `step:${command}`,
      step,
      evidence: opt('evidence') ?? opt('note'),
    });
    console.log(renderStatus(updated));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
