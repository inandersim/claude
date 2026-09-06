/**
 * Regresyon kalkanı testleri: kanıt zorunluluğu (kırmızı → yeşil) ve test yumuşatma tespiti.
 * Çalıştır: node --test agents/selfheal/guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidence, detectTestTampering, isTestFile } from './guard.mjs';

const gecerliKanit = {
  findingId: 'tel-crash-x',
  testFile: 'src/domain/__tests__/clone.test.ts',
  command: 'npm test -- --ci src/domain/__tests__/clone.test.ts',
  red: { at: '2026-09-06T10:00:00.000Z', exitCode: 1, commit: 'aaa1111' },
  green: { at: '2026-09-06T10:12:00.000Z', exitCode: 0, commit: 'bbb2222' },
};

test('isTestFile: yalnızca test dosyaları kanıt olabilir', () => {
  assert.ok(isTestFile('src/domain/__tests__/a.test.ts'));
  assert.ok(isTestFile('src/features/x/y.test.tsx'));
  assert.ok(isTestFile('agents/selfheal/guard.test.mjs'));
  assert.ok(!isTestFile('src/domain/pricing.ts'));
  assert.ok(!isTestFile('README.md'));
});

test('geçerli kırmızı → yeşil zinciri kabul edilir', () => {
  const r = validateEvidence(gecerliKanit);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('kanıt yoksa reddedilir', () => {
  assert.equal(validateEvidence(null).ok, false);
  assert.equal(validateEvidence(undefined).ok, false);
});

test('kırmızı kayıt olmadan kanıt geçersizdir', () => {
  const { red, ...kirmizisiz } = gecerliKanit;
  const r = validateEvidence(kirmizisiz);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('kırmızı kayıt yok')));
});

test('yeşil kayıt olmadan kanıt geçersizdir', () => {
  const { green, ...yesilsiz } = gecerliKanit;
  const r = validateEvidence(yesilsiz);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('yeşil kayıt yok')));
});

test('kırmızı adım aslında geçmişse kanıt reddedilir (test zaten yeşildi)', () => {
  const r = validateEvidence({ ...gecerliKanit, red: { ...gecerliKanit.red, exitCode: 0 } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('kırmızı adım başarılı')));
});

test('yeşil adım başarısızsa kanıt reddedilir', () => {
  const r = validateEvidence({ ...gecerliKanit, green: { ...gecerliKanit.green, exitCode: 1 } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('yeşil adım başarısız')));
});

test('yeşil kayıt kırmızıdan önceyse sıra bozuk sayılır', () => {
  const r = validateEvidence({
    ...gecerliKanit,
    green: { ...gecerliKanit.green, at: '2026-09-06T09:00:00.000Z' },
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('sıra bozuk')));
});

test('kanıt test dosyası olmayan bir dosyayı gösteremez', () => {
  const r = validateEvidence({ ...gecerliKanit, testFile: 'src/domain/pricing.ts' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('test dosyası değil')));
});

test('kırmızı ve yeşil farklı komutlarla alınmışsa reddedilir', () => {
  const r = validateEvidence({
    ...gecerliKanit,
    red: { ...gecerliKanit.red, command: 'npm test -- a' },
    green: { ...gecerliKanit.green, command: 'npm test -- b' },
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('farklı komutlarla')));
});

/* ---------------- test yumuşatma tespiti ---------------- */

test('temiz diff ihlal üretmez', () => {
  const diff = [
    'diff --git a/src/domain/clone.ts b/src/domain/clone.ts',
    '--- a/src/domain/clone.ts',
    '+++ b/src/domain/clone.ts',
    '-  return structuredClone(x);',
    '+  return deepClone(x);',
    'diff --git a/src/domain/__tests__/clone.test.ts b/src/domain/__tests__/clone.test.ts',
    '+++ b/src/domain/__tests__/clone.test.ts',
    '+  expect(deepClone(x)).toEqual(x);',
  ].join('\n');
  const r = detectTestTampering(diff);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

test('it.skip / xit / test.todo / .only eklemeleri yakalanır', () => {
  for (const satir of ['+  it.skip("x", () => {});', '+  xit("x", () => {});', '+  test.todo("x");', '+  it.only("x", () => {});', '+  describe.skip("x", () => {});']) {
    const r = detectTestTampering(`diff --git a/x.test.ts b/x.test.ts\n+++ b/x.test.ts\n${satir}`);
    assert.equal(r.ok, false, `yakalanmalıydı: ${satir}`);
  }
});

test('@ts-ignore, eslint-disable ve --passWithNoTests yakalanır', () => {
  for (const satir of ['+  // @ts-ignore', '+  /* eslint-disable */', '+    "test": "jest --passWithNoTests"', '+  // @ts-nocheck']) {
    const r = detectTestTampering(`diff --git a/x.ts b/x.ts\n+++ b/x.ts\n${satir}`);
    assert.equal(r.ok, false, `yakalanmalıydı: ${satir}`);
  }
});

test('silinen test dosyası ihlaldir', () => {
  const diff = ['diff --git a/src/domain/__tests__/a.test.ts b/src/domain/__tests__/a.test.ts', '--- a/src/domain/__tests__/a.test.ts', '+++ /dev/null'].join('\n');
  const r = detectTestTampering(diff);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.reason.includes('silinmiş')));
});

test('net beklenti (assertion) silinmesi ihlaldir', () => {
  const diff = [
    'diff --git a/x.test.ts b/x.test.ts',
    '+++ b/x.test.ts',
    '-  expect(a).toBe(1);',
    '-  expect(b).toBe(2);',
    '+  expect(a).toBe(1);',
  ].join('\n');
  const r = detectTestTampering(diff);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.reason.includes('beklenti')));
});

test('beklenti eklemek ihlal değildir', () => {
  const diff = ['diff --git a/x.test.ts b/x.test.ts', '+++ b/x.test.ts', '+  expect(a).toBe(1);', '+  expect(b).toBe(2);'].join('\n');
  assert.equal(detectTestTampering(diff).ok, true);
});
