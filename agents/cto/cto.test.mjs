/**
 * agents/cto testleri —  node --test agents/cto/*.test.mjs
 *
 * Vurgu, kapıların gerçekten kapatıyor olmasında: bir kapının yanlışlıkla
 * "geçti" sayılması, bu hattın tek ciddi başarısızlık biçimidir.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { analyzeImpact, containsTerm, listModules, listTables } from './lib/impact.mjs';
import {
  applyResult,
  BLOCKED,
  FAILED,
  initialSteps,
  isComplete,
  nextStep,
  PASSED,
  SKIPPED,
  summarize,
} from './lib/pipeline.mjs';
import { can, currentLevel, denyReason, loadPolicy, matchPath } from './lib/policy.mjs';
import { approvalsRequired, classify, escalateTo, maxLevel, modelFor } from './lib/risk-classify.mjs';
import { appendAudit, readAudit, requestId } from './lib/store.mjs';
import { intake, render } from './intake.mjs';
import { approve, recordStep } from './pipeline.mjs';
import { assertNoAbsoluteClaim, featureReport, securityReport } from './report.mjs';

const policy = loadPolicy();

/* ------------------------------------------------------------------ */
/* Politika                                                            */
/* ------------------------------------------------------------------ */

test('politika okunur ve zorunlu alanları taşır', () => {
  assert.ok(policy.autonomy.current);
  assert.ok(policy.pipeline.steps.length === 13);
  assert.ok(policy.humanApprovalRequired.length > 0);
});

test('etkin otonomi seviyesi üretime dağıtım yapamaz', () => {
  const level = currentLevel(policy);
  assert.equal(level.canDeployProduction, false);
  assert.equal(can('canDeployProduction', policy), false);
});

test('bilinmeyen yetenek adı izin vermez', () => {
  assert.equal(can('canDoAnythingItWants', policy), false);
});

test('hat kendi politikasını ve tüzüğünü değiştiremez', () => {
  assert.ok(denyReason('agents/cto/policy.json', policy));
  assert.ok(denyReason('docs/AI_CTO.md', policy));
  assert.ok(denyReason('agents/selfheal/lib/risk.mjs', policy));
  assert.equal(denyReason('src/domain/routing.ts', policy), null);
});

test('desen eşleştirme yalnızca hedefi tutar', () => {
  assert.ok(matchPath('supabase/migrations/**', 'supabase/migrations/0100_rls.sql'));
  assert.ok(matchPath('src/domain/pricing.ts', 'src/domain/pricing.ts'));
  assert.equal(matchPath('src/domain/pricing.ts', 'src/domain/pricing.test.ts'), false);
  assert.equal(matchPath('src/features/auth/**', 'src/features/authors/x.ts'), false);
});

/* ------------------------------------------------------------------ */
/* Etki analizi                                                        */
/* ------------------------------------------------------------------ */

test('modül listesi depodan okunur, uydurulmaz', () => {
  const mods = listModules();
  assert.ok(mods.includes('tracks'));
  assert.ok(mods.includes('routing'));
  assert.equal(mods.includes('uydurma-modul'), false);
});

test('tablo listesi migration dosyalarından çıkar', () => {
  const tables = listTables();
  assert.ok(tables.includes('profiles'));
  assert.ok(tables.includes('location_shares'));
});

test('Türkçe talepten doğru modüller çıkar', () => {
  const r = analyzeImpact('Karadeniz için 3 günlük trekking rotası öner, kamp alanlarını ve hava durumunu dikkate al');
  assert.ok(r.modules.includes('tracks'));
  assert.ok(r.modules.includes('stays'));
  assert.ok(r.modules.includes('weather'));
  assert.equal(r.unresolved, false);
});

test('alt dizi yanlış eşleşmesi yapmaz', () => {
  // "kamp alanlarını" içindeki "anlar" hikâye modülünü tetiklemişti.
  const r = analyzeImpact('kamp alanlarını listele');
  assert.equal(r.modules.includes('stories'), false);
  assert.ok(r.modules.includes('stays'));
  // Türkçe ekler kelimeyi uzatır; "rota" terimi "rotaları" ile eşleşmeli.
  assert.ok(containsTerm('rotaları göster', 'rota'));
  assert.equal(containsTerm('kamp alanlarını listele', 'anlar'), false);
});

test('eşleşmeyen talep çözümsüz olarak işaretlenir', () => {
  const r = analyzeImpact('zzz qqq wwq');
  assert.equal(r.unresolved, true);
  assert.deepEqual(r.modules, []);
});

/* ------------------------------------------------------------------ */
/* Risk                                                                */
/* ------------------------------------------------------------------ */

test('şema göçü CRITICAL olur', () => {
  const r = classify({ text: 'kullanıcılar tablosundan bir sütunu drop table ile kaldır' }, policy);
  assert.equal(r.level, 'CRITICAL');
  assert.ok(r.reasons.some((x) => x.kind === 'keyword'));
});

test('konum paylaşımı HIGH olur', () => {
  const r = classify({ text: 'canlı konum paylaşımını arkadaşlara açalım' }, policy);
  assert.equal(r.level, 'HIGH');
});

test('belge güncellemesi LOW olur', () => {
  const r = classify({ text: 'belge içindeki yazım hatalarını düzelt' }, policy);
  assert.equal(r.level, 'LOW');
});

test('yol da seviyeyi yükseltir', () => {
  const r = classify({ text: 'küçük düzeltme', paths: ['supabase/migrations/0201_x.sql'] }, policy);
  assert.equal(r.level, 'CRITICAL');
});

test('birden çok sinyalde en yüksek seviye kazanır', () => {
  const r = classify({ text: 'belge güncelle ve rls politikasını değiştir' }, policy);
  assert.equal(r.level, 'CRITICAL');
});

test('seviye yükseltilebilir ama düşürülemez', () => {
  assert.equal(maxLevel('LOW', 'HIGH'), 'HIGH');
  const up = escalateTo('MEDIUM', 'CRITICAL');
  assert.equal(up.level, 'CRITICAL');
  assert.equal(up.changed, true);
  const down = escalateTo('HIGH', 'LOW');
  assert.equal(down.level, 'HIGH', 'düşürme kabul edilmemeli');
  assert.equal(down.rejected, true);
});

test('insan onayı kategorileri risk seviyesinden bağımsız yakalanır', () => {
  const hits = approvalsRequired({ text: 'hesap silme akışındaki metni düzelt' }, policy);
  assert.ok(hits.some((h) => h.id === 'personal-data'));
});

test('ödeme dosyası dokunulunca onay gerekir', () => {
  const hits = approvalsRequired({ text: 'küçük düzeltme', paths: ['src/domain/pricing.ts'] }, policy);
  assert.ok(hits.some((h) => h.id === 'payments'));
});

test('yüksek risk her zaman en güçlü modele yükselir', () => {
  assert.equal(modelFor('implement', 'CRITICAL', policy), 'opus');
  assert.equal(modelFor('implement', 'HIGH', policy), 'opus');
  assert.equal(modelFor('implement', 'LOW', policy), 'sonnet');
  assert.equal(modelFor('architecture', 'LOW', policy), 'opus');
});

/* ------------------------------------------------------------------ */
/* Boru hattı kapıları                                                 */
/* ------------------------------------------------------------------ */

test('LOW riskte hızlı yol adımları atlanır, kritikler atlanmaz', () => {
  const steps = initialSteps('LOW', policy);
  const byId = Object.fromEntries(steps.map((s) => [s.id, s.status]));
  assert.equal(byId.research, SKIPPED);
  assert.equal(byId.staging, SKIPPED);
  assert.equal(byId.test, 'pending');
  assert.equal(byId.security, 'pending');
  assert.equal(byId.deploy, 'pending');
});

test('HIGH riskte hiçbir adım atlanmaz', () => {
  const steps = initialSteps('HIGH', policy);
  assert.equal(steps.some((s) => s.status === SKIPPED), false);
});

test('adım kanıtsız geçemez', () => {
  const steps = initialSteps('HIGH', policy);
  assert.throws(() => applyResult(steps, 'understand', { status: PASSED }, policy), /kanıtsız/);
});

test('sıra atlanamaz', () => {
  const steps = initialSteps('HIGH', policy);
  assert.throws(
    () => applyResult(steps, 'test', { status: PASSED, evidence: '904 test' }, policy),
    /önce "understand" tamamlanmalı/,
  );
});

test('test ve güvenlik adımları atlanamaz', () => {
  let steps = initialSteps('LOW', policy);
  for (const id of ['understand', 'impact', 'architecture', 'risk', 'plan', 'implement']) {
    steps = applyResult(steps, id, { status: PASSED, evidence: 'kanıt' }, policy);
  }
  assert.throws(() => applyResult(steps, 'test', { status: SKIPPED }, policy), /atlanamaz/);
});

test('geçen adımlar tamamlanınca hat biter', () => {
  let steps = initialSteps('LOW', policy);
  for (const step of steps) {
    if (step.status === SKIPPED) continue;
    steps = applyResult(steps, step.id, { status: PASSED, evidence: 'kanıt' }, policy);
  }
  assert.equal(isComplete(steps), true);
  assert.equal(nextStep(steps), null);
  assert.equal(summarize(steps).complete, true);
});

test('başarısız adım hattı durdurur', () => {
  let steps = initialSteps('LOW', policy);
  steps = applyResult(steps, 'understand', { status: PASSED, evidence: 'k' }, policy);
  steps = applyResult(steps, 'impact', { status: FAILED, note: 'modül bulunamadı' }, policy);
  assert.equal(summarize(steps).stuck, true);
});

/* ------------------------------------------------------------------ */
/* Talep alımı                                                         */
/* ------------------------------------------------------------------ */

test('talep alımı yapılandırılmış kayıt üretir', () => {
  const r = intake('Kamp alanı keşif sistemi ekle, haritada göster');
  assert.ok(r.id.length > 5);
  assert.ok(r.impact.modules.includes('stays'));
  assert.ok(r.impact.modules.includes('maps'));
  assert.equal(r.steps.length, 13);
  assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(r.risk.level));
});

test('boş talep reddedilir', () => {
  assert.throws(() => intake('   '), /Boş talep/);
});

test('onay gerektiren talep kayıtta işaretlenir ve soruya dönüşür', () => {
  const r = intake('kimlik doğrulama akışını değiştir, otp süresini uzat');
  assert.ok(r.approvals.some((a) => a.id === 'auth'));
  assert.ok(r.understanding.questions.some((q) => q.includes('İnsan onayı')));
});

test('özet metni adımları ve riski gösterir', () => {
  const out = render(intake('rota öneri ekranına filtre ekle'));
  assert.match(out, /Risk:/);
  assert.match(out, /Adımlar:/);
});

/* ------------------------------------------------------------------ */
/* Onay ve denetim                                                     */
/* ------------------------------------------------------------------ */

test('onay kimliksiz ya da kanıtsız kaydedilemez', () => {
  const record = intake('belge güncelle');
  const blocked = { ...record, steps: record.steps.map((s) => (s.id === 'deploy' ? { ...s, status: BLOCKED } : s)) };
  assert.throws(() => approve(blocked, { evidence: 'x' }), /--by/);
  assert.throws(() => approve(blocked, { by: 'inan' }), /kanıtsız/);
});

test('onay bekleyen adım yoksa onay reddedilir', () => {
  const record = intake('belge güncelle');
  assert.throws(() => approve(record, { by: 'inan', evidence: 'ok' }), /Onay bekleyen adım yok/);
});

test('onay bloklu adımı açar ve kaydı işaretler', () => {
  const record = intake('belge güncelle');
  const blocked = { ...record, steps: record.steps.map((s) => (s.id === 'deploy' ? { ...s, status: BLOCKED } : s)) };
  const approved = approve(blocked, { by: 'inan', evidence: 'PR #1 onaylandı' });
  assert.equal(approved.approval.by, 'inan');
  assert.equal(approved.steps.find((s) => s.id === 'deploy').status, 'pending');
});

test('adım kaydı kaydın kendisini bozmaz (saf güncelleme)', () => {
  const record = intake('belge güncelle');
  const before = JSON.stringify(record.steps);
  recordStep(record, { step: 'understand', status: PASSED, evidence: 'anlaşıldı' }, policy);
  assert.equal(JSON.stringify(record.steps), before);
});

test('denetim izi yalnızca eklenir ve action zorunludur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cto-audit-'));
  const path = join(dir, 'audit.jsonl');
  try {
    appendAudit({ action: 'intake', requestId: 'r1' }, { path });
    appendAudit({ action: 'step:pass', requestId: 'r1', step: 'test' }, { path });
    const rows = readAudit({ path });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].action, 'intake');
    assert.throws(() => appendAudit({ requestId: 'r1' }, { path }), /action/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('talep kimliği zamana ve metne göre üretilir', () => {
  const id = requestId('Kamp alanı ekle', new Date('2026-09-07T10:00:00Z'));
  assert.match(id, /^20260907-100000-kamp-alani-ekle$/);
});

/* ------------------------------------------------------------------ */
/* Raporlar                                                            */
/* ------------------------------------------------------------------ */

test('özellik raporu eksik alanları gizlemez', () => {
  const out = featureReport(intake('rota filtresi ekle'));
  assert.match(out, /# FEATURE/);
  assert.match(out, /## Geri alma planı\n—/);
});

test('güvenlik raporu mutlak iddiayı reddeder', () => {
  assert.throws(() => assertNoAbsoluteClaim('Sonuç: kod güvenlidir.', policy), /yasak ifade/);
  assert.ok(assertNoAbsoluteClaim('Sonuç: Checked. 0 Critical bulgu.', policy));
});

test('güvenlik raporu geçersiz durumu reddeder', () => {
  const record = { ...intake('rota filtresi ekle'), securityStatus: 'Güvenli' };
  assert.throws(() => securityReport(record, policy), /Geçersiz güvenlik durumu/);
});

test('güvenlik raporu izinli durumla üretilir', () => {
  const record = {
    ...intake('rota filtresi ekle'),
    securityStatus: 'Passed',
    securityFindings: { critical: [], high: [], medium: [{ title: 'oran sınırı yok', component: 'gateway' }], low: [] },
  };
  const out = securityReport(record, policy);
  assert.match(out, /Medium: 1/);
  assert.match(out, /oran sınırı yok/);
});
