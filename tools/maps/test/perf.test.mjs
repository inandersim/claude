/**
 * Harita performans ölçümünün saf kısmının testleri.
 *
 *   node --test tools/maps/test/perf.test.mjs
 *
 * Ölçümün kendisi (tarayıcı) test edilemez; karar mantığının tamamı burada.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DUSEN_KARE_CARPANI,
  KARE_BUTCESI_MS,
  butceKarsilastir,
  gerilemeYuzdesi,
  kareOzeti,
  karoOzeti,
  katmanMaliyeti,
  yuzdelik,
} from '../lib/perf-stats.mjs';

test('yüzdelik bilinen diziyle doğrulanır', () => {
  const d = [1, 2, 3, 4, 5];
  assert.equal(yuzdelik(d, 0), 1);
  assert.equal(yuzdelik(d, 0.5), 3);
  assert.equal(yuzdelik(d, 1), 5);
  // Aradeğerleme: 0.95 * 4 = 3.8 → 4 ile 5 arası
  assert.ok(Math.abs(yuzdelik(d, 0.95) - 4.8) < 1e-9);
  assert.equal(yuzdelik([], 0.5), 0);
  assert.equal(yuzdelik([7], 0.9), 7);
});

test('ilk kare atılır — rAF yeniden başlarken şişer', () => {
  // İlk aralık 500 ms (boşta geçen süre), kalanlar 16 ms.
  const ozet = kareOzeti([500, 16, 16, 16, 16]);
  assert.equal(ozet.kare, 4);
  assert.equal(ozet.enUzun, 16);
  assert.equal(ozet.dusen, 0);
});

test('düşen kare eşiği kare bütçesinin 1,5 katı', () => {
  // 25 ms eşiği: 20 ms hâlâ akıcı sayılır, 40 ms bir kare atlamıştır.
  const ozet = kareOzeti([0, 10, 12, 20, 40, 15]);
  assert.equal(ozet.kare, 5);
  assert.equal(ozet.dusen, 1);
  assert.ok(Math.abs(ozet.dusenYuzde - 20) < 1e-9);
  assert.ok(ozet.p95 > ozet.p50);
  assert.ok(KARE_BUTCESI_MS > 16 && KARE_BUTCESI_MS < 17);
  assert.equal(DUSEN_KARE_CARPANI, 1.5);
});

test('kusursuz 60 fps hiç düşen kare göstermez', () => {
  // İlk ölçümde çıkan gerçek kusur: eşik tam 16,67 olduğu için 60 fps'te
  // salınan aralıkların yarısı "düşmüş" sayılıyordu.
  const salinim = [0, 16.6, 16.8, 16.7, 16.6, 16.9, 16.5, 16.7];
  const ozet = kareOzeti(salinim);
  assert.equal(ozet.dusen, 0);
  assert.ok(Math.abs(ozet.fps - 60) < 1);
});

test('fps toplam süreden hesaplanır, kare sayısından değil', () => {
  // 4 kare, toplam 100 ms → 40 fps
  const ozet = kareOzeti([0, 25, 25, 25, 25]);
  assert.ok(Math.abs(ozet.fps - 40) < 1e-9);
});

test('boş ya da geçersiz ölçüm çökmez', () => {
  for (const giris of [[], [16], [0, NaN, -1]]) {
    const ozet = kareOzeti(giris);
    assert.equal(ozet.kare, 0);
    assert.equal(ozet.fps, 0);
  }
});

test('karo özeti yalnızca harita kaynaklarını sayar', () => {
  const ozet = karoOzeti([
    { url: 'http://x/tiles/likya.pmtiles', bayt: 100 },
    { url: 'http://x/tiles/likya-dem.pmtiles', bayt: 50 },
    { url: 'http://x/glyphs/Zirtan-SemiBold/0-255.pbf', bayt: 10 },
    { url: 'http://x/bundle.js', bayt: 999999 },
  ]);
  assert.equal(ozet.istek, 3);
  assert.equal(ozet.bayt, 160);
  assert.equal(ozet.pmtiles, 1);
  assert.equal(ozet.dem, 1);
  assert.equal(ozet.glyph, 1);
});

test('katman maliyeti fark olarak verilir, negatif fark saklanmaz', () => {
  const temel = { p95: 10, dusenYuzde: 2 };
  const maliyet = katmanMaliyeti(temel, { p95: 14, dusenYuzde: 5 });
  assert.equal(maliyet.kareP95Ms, 4);
  assert.equal(maliyet.dusenYuzde, 3);

  // Gürültü: açıkken daha hızlı ölçülmüş. Sıfıra çekmek, ölçümün gürültülü
  // olduğunu gizlerdi — olduğu gibi raporlanır.
  const gurultu = katmanMaliyeti(temel, { p95: 9, dusenYuzde: 1 });
  assert.equal(gurultu.kareP95Ms, -1);
});

test('yalnızca kesin metrikler bütçe kapısı üretir', () => {
  const butce = { kesin: { karoIstek: 40, karoBayt: 500000 }, gosterge: ['ilkCizimMs', 'kareP95Ms'] };
  const { bulgular, gostergeler } = butceKarsilastir(
    { karoIstek: 41, karoBayt: 100, ilkCizimMs: 9999, kareP95Ms: 500 },
    butce,
  );
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].anahtar, 'karoIstek');
  assert.match(bulgular[0].mesaj, /bütçe aşıldı/);
  // Zamanlar çok kötü olsa bile kapı değil — başsız GL gerçek GPU'yu temsil etmiyor.
  assert.equal(gostergeler.length, 2);
});

test('bütçede olmayan ya da sayı olmayan metrik yoksayılır', () => {
  const { bulgular } = butceKarsilastir(
    { karoIstek: '41', bilinmeyen: 999 },
    { kesin: { karoIstek: 40 } },
  );
  assert.equal(bulgular.length, 0);
});

test('gerileme yüzdesi önceki koşum yoksa null', () => {
  assert.equal(gerilemeYuzdesi(undefined, 10), null);
  assert.equal(gerilemeYuzdesi(0, 10), null);
  assert.ok(Math.abs(gerilemeYuzdesi(100, 130) - 30) < 1e-9);
  assert.ok(Math.abs(gerilemeYuzdesi(100, 80) + 20) < 1e-9);
});
