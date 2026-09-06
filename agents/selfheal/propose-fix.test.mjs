/**
 * Düzeltme hattı testleri: kapı bütünlüğü, görev tarifi, denetim kaydı.
 * Çalıştır: node --test agents/selfheal/propose-fix.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_COMMANDS, renderPlan, findFinding } from './propose-fix.mjs';
import { formatAuditEntry } from './lib/audit.mjs';

test('doğrulama kapıları lint, typecheck ve test içerir', () => {
  const ids = GATE_COMMANDS.map((g) => g.id);
  assert.deepEqual(ids, ['lint', 'typecheck', 'test']);
});

test('kapı komutları test atlama bayrağı içermez', () => {
  for (const g of GATE_COMMANDS) {
    assert.ok(!/passWithNoTests|--bail|\.only/.test(g.cmd), `${g.id} komutu testi zayıflatmamalı`);
  }
  assert.ok(GATE_COMMANDS.find((g) => g.id === 'lint').cmd.includes('--max-warnings=0'), 'lint uyarıya izin vermemeli');
});

test('görev tarifi yasakları ve zorunlu kırmızı → yeşil sırasını içerir', () => {
  const plan = renderPlan(
    {
      id: 'tel-x',
      title: 'Çökme: X',
      severity: 'kritik',
      score: 30,
      source: 'telemetri',
      detail: '10 çökme',
      files: ['src/features/tracks/a.ts'],
      suggestedFix: 'düzelt',
    },
    { date: '2026-09-06' },
  );
  assert.ok(plan.includes('it.skip'), 'test atlama yasağı yazılmalı');
  assert.ok(plan.includes('@ts-ignore'));
  assert.ok(plan.includes('--phase red'), 'önce kırmızı adım');
  assert.ok(plan.includes('--phase green'), 'sonra yeşil adım');
  assert.ok(plan.indexOf('--phase red') < plan.indexOf('--phase green'), 'sıra kırmızı → yeşil olmalı');
  assert.ok(plan.includes('src/features/tracks/a.ts'));
});

test('riskli bulgunun tarifinde insan onayı uyarısı bulunur', () => {
  const plan = renderPlan(
    { id: 'x', title: 'SOS çökmesi', severity: 'yuksek', score: 5, source: 'telemetri', files: ['src/domain/emergency.ts'], risky: true, riskCategories: ['sos'], suggestedFix: 'düzelt' },
    { date: '2026-09-06' },
  );
  assert.ok(plan.includes('needs-human'));
  assert.ok(plan.includes('RİSKLİ ALAN'));
});

test('bilinmeyen bulgu kimliği hata verir', () => {
  assert.throws(() => findFinding('yok-boyle-bir-bulgu'), /Bulgu yok/);
});

test('okunamayan rapor açık hata verir', () => {
  assert.throws(() => findFinding('x', '/olmayan/rapor.json'), /okunamadı/);
});

/* ---------------- denetim kaydı ---------------- */

test('denetim kaydı kim/ne/neden/kanıt alanlarını taşır', () => {
  const md = formatAuditEntry({
    who: 'propose-fix.mjs',
    what: 'PR açıldı',
    why: 'bulgu tel-x',
    evidence: 'kırmızı→yeşil a.test.ts',
    findingId: 'tel-x',
    at: '2026-09-06T12:00:00.000Z',
  });
  for (const alan of ['**kim:**', '**ne:**', '**neden:**', '**kanıt:**']) {
    assert.ok(md.includes(alan), `${alan} eksik`);
  }
  assert.ok(md.includes('tel-x'));
  assert.ok(md.startsWith('## 2026-09-06T12:00:00.000Z'));
});

test('eksik alanlı denetim kaydı reddedilir (sessiz değişiklik olamaz)', () => {
  assert.throws(() => formatAuditEntry({ who: 'x', what: 'y' }), /zorunludur/);
  assert.throws(() => formatAuditEntry({ what: 'y', why: 'z' }), /zorunludur/);
});

test('kanıtsız kayıt açıkça işaretlenir', () => {
  const md = formatAuditEntry({ who: 'a', what: 'b', why: 'c', evidence: '' });
  assert.ok(md.includes('_kanıt yok_'));
});
