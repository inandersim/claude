/**
 * Performans nöbeti testleri: bütçe kontrolü.
 * Çalıştır: node --test agents/selfheal/perf.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBudgets, budgetForScreen, loadBudgets } from './perf.mjs';

const butceler = {
  bundle: { jsGzipKb: 1000, totalGzipKb: 2000 },
  screens: {
    varsayilan: { p75Ms: 1200, queries: 5 },
    ozel: { '/(app)/satellite/sos': { p75Ms: 800, queries: 2, gerekce: 'can güvenliği' } },
  },
};

test('bütçe içindeyken bulgu üretilmez', () => {
  const f = checkBudgets(
    { bundle: { jsGzipBytes: 900 * 1024, totalGzipBytes: 1500 * 1024 }, screens: [{ screen: '/(app)/explore', p75Ms: 900, queries: 3 }] },
    butceler,
  );
  assert.equal(f.length, 0);
});

test('tam bütçe sınırında bulgu üretilmez (sınır dahil)', () => {
  const f = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/x', p75Ms: 1200, queries: 5 }] }, butceler);
  assert.equal(f.length, 0, 'bütçeye eşit değer aşım değildir');
});

test('paket boyutu aşımı bulgu üretir ve aşım yüzdesini hesaplar', () => {
  const f = checkBudgets({ bundle: { jsGzipBytes: 1200 * 1024, totalGzipBytes: 1000 * 1024 }, screens: [] }, butceler);
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'perf-paket-js-gzip');
  assert.equal(f[0].metrics.budget, 1000);
  assert.equal(f[0].metrics.asimYuzde, 20);
});

test('ekran açılış süresi aşımı bulgu üretir', () => {
  const f = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/explore', p75Ms: 2400, queries: 2 }] }, butceler);
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'perf-acilis-app-explore');
  assert.equal(f[0].metrics.asimYuzde, 100);
});

test('sorgu sayısı aşımı ayrı bir bulgu üretir', () => {
  const f = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/explore', p75Ms: 500, queries: 9 }] }, butceler);
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'perf-sorgu-app-explore');
  assert.equal(f[0].metrics.fazla, 4);
});

test('bir ekran hem süre hem sorgu bütçesini aşarsa iki bulgu üretilir', () => {
  const f = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/explore', p75Ms: 3000, queries: 20 }] }, butceler);
  assert.equal(f.length, 2);
});

test('özel bütçe varsayılanın yerine geçer (SOS ekranı daha sıkı)', () => {
  const sos = budgetForScreen('/(app)/satellite/sos', butceler);
  assert.equal(sos.p75Ms, 800);
  assert.equal(sos.ozel, true);
  const digeri = budgetForScreen('/(app)/clubs', butceler);
  assert.equal(digeri.p75Ms, 1200);
  assert.equal(digeri.ozel, false);

  // Varsayılana göre geçerli olan bir süre, SOS özel bütçesini aşar:
  const f = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/satellite/sos', p75Ms: 1000, queries: 1 }] }, butceler);
  assert.equal(f.length, 1, 'SOS ekranı 1000 ms ile bütçeyi aşmalı');
});

test('bulgular ekranın özellik klasörünü işaret eder', () => {
  const [f] = checkBudgets({ bundle: {}, screens: [{ screen: '/(app)/explore', p75Ms: 5000, queries: 1 }] }, butceler);
  assert.deepEqual(f.files, ['src/features/explore/']);
});

test('depodaki gerçek bütçe dosyası okunabilir ve gerekli alanları taşır', () => {
  const b = loadBudgets();
  assert.ok(b.bundle.jsGzipKb > 0);
  assert.ok(b.screens.varsayilan.p75Ms > 0);
  assert.ok(b.screens.ozel['/(app)/satellite/sos'], 'SOS ekranının özel bütçesi tanımlı olmalı');
});

test('ölçüm yoksa çökmez', () => {
  assert.deepEqual(checkBudgets({}, butceler), []);
  assert.deepEqual(checkBudgets({ screens: [] }, butceler), []);
});
