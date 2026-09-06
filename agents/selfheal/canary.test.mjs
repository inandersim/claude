/**
 * Kanarya testleri: eşik aşımında geri alma, örneklem/bekleme kapıları, riskli alan kuralları.
 * Çalıştır: node --test agents/selfheal/canary.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCanary, commandFor, stageById, nextStage, STAGES, POLICY } from './canary.mjs';

const temel = { crashFreeSessionsPct: 99.6, errorRatePct: 1.4, flowCompletionPct: 73.5, p75ScreenMs: 1240 };
const saglikli = { sessions: 900, crashFreeSessionsPct: 99.65, errorRatePct: 1.3, flowCompletionPct: 74.0, p75ScreenMs: 1200 };

test('sağlıklı ölçümler ve dolmuş bekleme → ilerlet', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: saglikli, baseline: temel });
  assert.equal(d.decision, 'ilerlet');
  assert.equal(d.next.id, 'yuzde25');
});

test('çökme oranı temelin altına düşerse geri al', () => {
  const d = evaluateCanary({
    stage: 'yuzde5',
    observedMinutes: 90,
    canary: { ...saglikli, crashFreeSessionsPct: 99.1 },
    baseline: temel,
  });
  assert.equal(d.decision, 'geri-al');
  assert.ok(d.breaches.some((b) => b.metrik === 'crashFreeSessionsPct'));
});

test('mutlak çökme eşiği tek başına geri alma sebebidir', () => {
  const d = evaluateCanary({
    stage: 'yuzde5',
    observedMinutes: 90,
    canary: { ...saglikli, crashFreeSessionsPct: 98.5 },
    baseline: { ...temel, crashFreeSessionsPct: 98.6 },
  });
  assert.equal(d.decision, 'geri-al', 'temele yakın olsa bile mutlak sınır altındaysa geri alınır');
});

test('hata oranı temelin 1.25 katını aşarsa geri al', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { ...saglikli, errorRatePct: 1.9 }, baseline: temel });
  assert.equal(d.decision, 'geri-al');
  assert.ok(d.breaches.some((b) => b.metrik === 'errorRatePct'));
});

test('akış tamamlama temelin %95inin altına inerse geri al', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { ...saglikli, flowCompletionPct: 68 }, baseline: temel });
  assert.equal(d.decision, 'geri-al');
  assert.ok(d.breaches.some((b) => b.metrik === 'flowCompletionPct'));
});

test('açılış süresi temelin 1.2 katını aşarsa geri al', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { ...saglikli, p75ScreenMs: 1600 }, baseline: temel });
  assert.equal(d.decision, 'geri-al');
});

test('eşik tam sınırdayken geri alınmaz', () => {
  const d = evaluateCanary({
    stage: 'yuzde5',
    observedMinutes: 90,
    canary: { ...saglikli, errorRatePct: 1.4 * 1.25 },
    baseline: temel,
  });
  assert.equal(d.decision, 'ilerlet', 'sınıra eşit değer aşım değildir');
});

test('örneklem yetersizse ilerlemez, bekler', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { ...saglikli, sessions: 100 }, baseline: temel });
  assert.equal(d.decision, 'bekle');
  assert.ok(d.reasons.some((r) => r.includes('örneklem yetersiz')));
});

test('bekleme süresi dolmadan ilerlemez', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 10, canary: saglikli, baseline: temel });
  assert.equal(d.decision, 'bekle');
  assert.ok(d.reasons.some((r) => r.includes('bekleme süresi')));
});

test('eşik aşımı örneklem/bekleme kapılarından önce gelir', () => {
  const d = evaluateCanary({
    stage: 'yuzde5',
    observedMinutes: 1,
    canary: { ...saglikli, sessions: 10, crashFreeSessionsPct: 90 },
    baseline: temel,
  });
  assert.equal(d.decision, 'geri-al', 'felaket varsa örneklem beklenmez');
});

test('riskli alanda bekleme süresi iki katına çıkar', () => {
  const normal = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: saglikli, baseline: temel });
  const riskli = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: saglikli, baseline: temel, risky: true });
  assert.equal(normal.decision, 'ilerlet');
  assert.equal(riskli.decision, 'bekle', '60 dk x 2 = 120 dk dolmadı');
});

test('riskli alanda %50 üstüne çıkmak insan kararıdır', () => {
  const d = evaluateCanary({
    stage: 'yuzde50',
    observedMinutes: 5000,
    canary: { ...saglikli, sessions: 20000 },
    baseline: temel,
    risky: true,
  });
  assert.equal(d.decision, 'bekle');
  assert.equal(d.needsHuman, true);
});

test('riskli alanda ilerletme kararı bile insan onayı ister', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 200, canary: saglikli, baseline: temel, risky: true });
  assert.equal(d.decision, 'ilerlet');
  assert.equal(d.needsHuman, true);
});

test('son aşamada ilerletme sonraki aşama üretmez', () => {
  const d = evaluateCanary({ stage: 'tam', observedMinutes: 10, canary: saglikli, baseline: temel });
  assert.equal(d.decision, 'ilerlet');
  assert.equal(d.next, null);
});

test('merdiven artan yüzde ve azalmayan bekleme ile tanımlı', () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i].percent > STAGES[i - 1].percent, 'yüzde artmalı');
  }
  assert.equal(STAGES.at(-1).percent, 100);
  assert.equal(nextStage('tam'), null);
  assert.equal(stageById('bilinmeyen').id, 'yuzde5', 'bilinmeyen aşama en temkinlisine düşer');
});

test('her politika metriğinin bir yönü tanımlı', () => {
  for (const [m, k] of Object.entries(POLICY)) {
    assert.ok(['yuksek-iyi', 'dusuk-iyi'].includes(k.yon), `${m} için yön tanımsız`);
  }
});

test('karara uygun komut üretilir', () => {
  const geriAl = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { ...saglikli, crashFreeSessionsPct: 90 }, baseline: temel });
  assert.ok(commandFor(geriAl).includes('rollback'));
  const ilerlet = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: saglikli, baseline: temel });
  assert.ok(commandFor(ilerlet).includes('25'));
});

test('eksik metrik değerlendirmeyi çökertmez', () => {
  const d = evaluateCanary({ stage: 'yuzde5', observedMinutes: 90, canary: { sessions: 600 }, baseline: {} });
  assert.ok(['ilerlet', 'bekle'].includes(d.decision));
});
