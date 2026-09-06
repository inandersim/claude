/**
 * Önceliklendirme testleri: sıralama, önem derecesi, riskli alan tabanı, birleştirme.
 * Çalıştır: node --test agents/selfheal/findings.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreFinding, prioritize, dedupe, severityOf, severityFloor, worstSeverity,
  fromTelemetry, fromCoverage, fromCi, fromSecurity,
} from './lib/findings.mjs';

const ctx = { totalSessions: 40000 };
const bulgu = (over = {}) => ({
  id: 'x',
  kind: 'crash',
  files: ['src/features/tracks/a.ts'],
  metrics: { sessions: 400 },
  ...over,
});

test('puan = etki x sıklık x kolaylık ve 0..100 aralığında kalır', () => {
  const s = scoreFinding(bulgu(), ctx);
  assert.ok(s.score > 0 && s.score <= 100);
  assert.equal(s.score, Math.round(100 * s.impact * s.frequency * s.ease * 10) / 10);
});

test('aynı türde daha çok kullanıcıyı etkileyen bulgu daha yüksek puan alır', () => {
  const az = scoreFinding(bulgu({ id: 'az', metrics: { sessions: 50 } }), ctx);
  const cok = scoreFinding(bulgu({ id: 'cok', metrics: { sessions: 5000 } }), ctx);
  assert.ok(cok.score > az.score, `${cok.score} > ${az.score} olmalı`);
});

test('aynı sıklıkta çökme, yavaş ekrandan önce gelir (etki ağırlığı)', () => {
  const m = { sessions: 1000 };
  const cokme = scoreFinding(bulgu({ id: 'cokme', kind: 'crash', metrics: m }), ctx);
  const yavas = scoreFinding(bulgu({ id: 'yavas', kind: 'slow_screen', metrics: m }), ctx);
  assert.ok(cokme.score > yavas.score);
});

test('kolay düzeltme eşit aciliyette öne geçer', () => {
  const m = { sessions: 1000 };
  const kolay = scoreFinding(bulgu({ id: 'kolay', kind: 'i18n_missing', metrics: m }), ctx);
  const zor = scoreFinding(bulgu({ id: 'zor', kind: 'flow_abandon', metrics: m }), ctx);
  assert.ok(kolay.ease > zor.ease);
  assert.ok(kolay.score > zor.score);
});

test('sıralama kararlıdır: aynı girdi her zaman aynı sırayı verir', () => {
  const girdi = [
    bulgu({ id: 'b', metrics: { sessions: 100 } }),
    bulgu({ id: 'a', metrics: { sessions: 100 } }),
    bulgu({ id: 'c', metrics: { sessions: 9000 } }),
  ];
  const bir = prioritize(girdi, ctx).map((f) => f.id);
  const iki = prioritize([...girdi].reverse(), ctx).map((f) => f.id);
  assert.deepEqual(bir, iki);
  assert.equal(bir[0], 'c', 'en yüksek puanlı önce gelmeli');
  assert.deepEqual(bir.slice(1), ['a', 'b'], 'eşitlikte kimlik sırası');
});

test('prioritize puanı azalan sırada döner', () => {
  const liste = prioritize(
    [
      bulgu({ id: '1', metrics: { sessions: 10 } }),
      bulgu({ id: '2', metrics: { sessions: 8000 } }),
      bulgu({ id: '3', metrics: { sessions: 800 } }),
    ],
    ctx,
  );
  for (let i = 1; i < liste.length; i++) {
    assert.ok(liste[i - 1].score >= liste[i].score, 'puan azalan sırada olmalı');
  }
});

test('önem derecesi kolaylıktan bağımsızdır (zor bir çökme hâlâ ciddidir)', () => {
  const a = scoreFinding(bulgu({ id: 'a', kind: 'crash', metrics: { sessions: 3000 } }), ctx);
  const b = scoreFinding(bulgu({ id: 'b', kind: 'crash', metrics: { sessions: 3000 }, easeOverride: 0.05 }), ctx);
  assert.equal(a.severity, b.severity, 'kolaylık önem derecesini değiştirmemeli');
  assert.ok(b.score < a.score, 'kolaylık yalnızca sırayı değiştirir');
});

test('severityOf eşikleri', () => {
  assert.equal(severityOf(0.9), 'kritik');
  assert.equal(severityOf(0.35), 'kritik');
  assert.equal(severityOf(0.25), 'yuksek');
  assert.equal(severityOf(0.1), 'orta');
  assert.equal(severityOf(0.01), 'dusuk');
});

test('riskli alan önem tabanı: nadir bir SOS çökmesi listenin dibine düşemez', () => {
  const sos = scoreFinding(
    bulgu({ id: 'sos', kind: 'crash', files: ['src/features/satellite/HoldSosButton.tsx'], metrics: { sessions: 20 } }),
    ctx,
  );
  assert.equal(sos.risky, true);
  assert.equal(sos.severity, 'yuksek', 'SOS çökmesi en az yüksek sayılmalı');
  assert.equal(sos.autoFixable, false, 'riskli alan otomatik düzeltilmez');
});

test('severityFloor yalnızca riskli alanlarda uygulanır', () => {
  assert.equal(severityFloor({ kind: 'crash' }, { risky: false, categories: [] }), null);
  assert.equal(severityFloor({ kind: 'crash' }, { risky: true, categories: ['sos'] }), 'yuksek');
  assert.equal(severityFloor({ kind: 'crash' }, { risky: true, categories: ['odeme'] }), 'orta');
  assert.equal(worstSeverity('orta', 'kritik'), 'kritik');
  assert.equal(worstSeverity('kritik', 'dusuk'), 'kritik');
});

test('riskli alan etkiyi artırır ama kolaylığı düşürür', () => {
  const normal = scoreFinding(bulgu({ id: 'n', kind: 'error', files: ['src/features/tracks/a.ts'] }), ctx);
  const riskli = scoreFinding(bulgu({ id: 'r', kind: 'error', files: ['src/domain/emergency.ts'] }), ctx);
  assert.ok(riskli.impact > normal.impact, 'riskli alan etkiyi artırmalı');
  assert.ok(riskli.ease < normal.ease, 'riskli alan insan kapısı yüzünden daha yavaş düzelir');
});

test('etki 1.0 üstüne çıkamaz: çökme zaten en yüksek etkidir', () => {
  const riskliCokme = scoreFinding(bulgu({ id: 'r', kind: 'crash', files: ['src/domain/emergency.ts'] }), ctx);
  assert.equal(riskliCokme.impact, 1, 'etki 0..1 aralığında kırpılmalı');
});

test('dosyası bilinmeyen bulgu daha zor sayılır', () => {
  const bilinen = scoreFinding(bulgu({ id: 'b', files: ['src/features/tracks/a.ts'] }), ctx);
  const bilinmeyen = scoreFinding(bulgu({ id: 'x', files: [] }), ctx);
  assert.ok(bilinmeyen.ease < bilinen.ease);
});

test('dedupe: aynı konuyu anlatan iki kaynak tek satırda birleşir', () => {
  const liste = [
    { id: 'perf-explore', subject: 'ekran-acilis:/(app)/explore', source: 'performans', score: 20, severity: 'kritik', title: 'bütçe' },
    { id: 'tel-explore', subject: 'ekran-acilis:/(app)/explore', source: 'telemetri', score: 14, severity: 'kritik', title: 'yavaş' },
    { id: 'baska', score: 5, severity: 'orta', title: 'başka' },
  ];
  const sonuc = dedupe(liste);
  assert.equal(sonuc.length, 2);
  assert.equal(sonuc[0].id, 'perf-explore', 'en yüksek puanlı temsilci kalmalı');
  assert.equal(sonuc[0].corroboratedBy.length, 1);
  assert.equal(sonuc[0].corroboratedBy[0].id, 'tel-explore');
});

test('fromTelemetry: çökme grubundan dosya ve düzeltme önerisi çıkarır', () => {
  const grup = {
    signature: 'crash:src/features/zmatch/a.ts:10',
    kind: 'crash',
    count: 100,
    sessions: 80,
    routes: ['/(app)/zmatch'],
    platforms: ['android'],
    sample: {
      id: 'e1',
      kind: 'crash',
      detail: { message: 'TypeError: structuredClone is not a function', stack: 'at f (src/features/zmatch/a.ts:10:5)' },
    },
    events: [{ detail: { stack: 'at f (src/features/zmatch/a.ts:10:5)' } }],
  };
  const [f] = fromTelemetry([grup], { totalSessions: 1000 });
  assert.deepEqual(f.files, ['src/features/zmatch/a.ts']);
  assert.equal(f.kind, 'crash');
  assert.ok(f.title.includes('structuredClone'));
});

test('fromCoverage: eşik üstü kapsam bulgu üretmez', () => {
  const yuksek = fromCoverage({ 'src/domain/a.ts': { lines: { total: 200, covered: 190, pct: 95 } } });
  assert.equal(yuksek.length, 0);
  const dusuk = fromCoverage({ 'src/domain/a.ts': { lines: { total: 200, covered: 40, pct: 20 } } });
  assert.equal(dusuk.length, 1);
});

test('fromCoverage: küçük dosyalar gürültü yapmaz', () => {
  assert.equal(fromCoverage({ 'src/domain/kucuk.ts': { lines: { total: 10, covered: 1, pct: 10 } } }).length, 0);
});

test('fromCi: düşük başarısızlık oranı bulgu üretmez', () => {
  const runs = Array.from({ length: 20 }, (_, i) => ({ conclusion: i === 0 ? 'failure' : 'success', failedStep: 'test' }));
  assert.equal(fromCi({ runs }).length, 0);
  const kotu = Array.from({ length: 10 }, (_, i) => ({ conclusion: i < 5 ? 'failure' : 'success', failedStep: 'test' }));
  assert.equal(fromCi({ runs: kotu }).length, 1);
});

test('fromSecurity: yalnızca yüksek ve kritik açıklar bulguya dönüşür', () => {
  const f = fromSecurity({
    vulnerabilities: {
      a: { name: 'a', severity: 'low', via: [] },
      b: { name: 'b', severity: 'high', via: [{ title: 't' }], fixAvailable: true },
      c: { name: 'c', severity: 'critical', via: [{ title: 't' }], fixAvailable: { name: 'c', version: '2.0.0', isSemVerMajor: true } },
    },
  });
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.autoFixable === false), 'bağımlılık yaması kilit dosyası gerektirir → insan');
});
