/**
 * Arazi hattı testleri: DEM ızgarası, eşyükselti eğrileri, eğim sınıfları.
 *
 *   node --test tools/tiles/test/terrain.test.mjs
 *
 * Yöntem: **bilinen geometriler**. Düz bir eğik düzlemin eğimi hesapla
 * bilinebilir; eşyükselti eğrileri eşit aralıklı ve düz olmalıdır. Böylece
 * "çalışıyor gibi görünüyor" yerine gerçek sayı karşılaştırması yapılır.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contourGeoJson, levelsFor, stitch } from '../lib/contour.mjs';
import { buildDem, cellCoord, demStats, gridGeometry, gridPoints, sample } from '../lib/dem.mjs';
import { bandOf, mergeCells, slopeGeoJson, slopeGrid, slopeStats, SLOPE_BANDS } from '../lib/slope.mjs';

/** Verilen fonksiyondan sahte bir DEM üretir (ağ yok). */
function demFrom(bbox, cols, rows, fn) {
  const geometry = {
    bbox,
    cols,
    rows,
    stepLon: (bbox[2] - bbox[0]) / (cols - 1),
    stepLat: (bbox[3] - bbox[1]) / (rows - 1),
    count: cols * rows,
  };
  const values = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) values.push(fn(col, row));
  }
  return { ...geometry, values };
}

/* ------------------------------------------------------------------ */
/* Izgara                                                              */
/* ------------------------------------------------------------------ */

test('ızgara hücreleri yeryüzünde yaklaşık kare kalır', () => {
  // 40. enlemde boylam derecesi ~%77'ye daralır; adım buna göre büyümeli.
  const g = gridGeometry([29.0, 40.0, 29.1, 40.1], 90);
  const enlemAdimM = g.stepLat * 111_320;
  const boylamAdimM = g.stepLon * 111_320 * Math.cos((40.05 * Math.PI) / 180);
  assert.ok(
    Math.abs(enlemAdimM - boylamAdimM) < 10,
    `hücre kare değil: ${enlemAdimM.toFixed(0)}m × ${boylamAdimM.toFixed(0)}m`,
  );
});

test('ızgara sınır kutusunu tam kaplar', () => {
  const bbox = [29.0, 40.0, 29.1, 40.1];
  const g = gridGeometry(bbox, 200);
  const ilk = cellCoord(g, 0, 0);
  const son = cellCoord(g, g.cols - 1, g.rows - 1);
  assert.equal(Number(ilk.longitude.toFixed(6)), bbox[0]);
  assert.equal(Number(ilk.latitude.toFixed(6)), bbox[3], 'satır 0 kuzey olmalı');
  assert.equal(Number(son.longitude.toFixed(6)), bbox[2]);
  assert.equal(Number(son.latitude.toFixed(6)), bbox[1]);
});

test('geçersiz sınır kutusu ve adım reddedilir', () => {
  assert.throws(() => gridGeometry([29, 40, 29, 41], 90), /sınır kutusu/);
  assert.throws(() => gridGeometry([29, 40, 30, 41], 0), /Adım/);
});

test('nokta sayısı satır × sütun kadar ve sıra kuzeyden güneye', () => {
  const g = gridGeometry([29, 40, 29.01, 40.01], 200);
  const p = gridPoints(g);
  assert.equal(p.length, g.cols * g.rows);
  assert.ok(p[0].latitude > p[p.length - 1].latitude);
});

test('örnekleme sınır dışında en yakın hücreye kenetlenir', () => {
  const dem = demFrom([0, 0, 1, 1], 3, 3, (c, r) => c * 10 + r);
  assert.equal(sample(dem, 0, 0), 0);
  assert.equal(sample(dem, -5, -5), 0);
  assert.equal(sample(dem, 99, 99), sample(dem, 2, 2));
});

test('çok büyük ızgara reddedilir (kaza freni)', async () => {
  await assert.rejects(
    () => buildDem([25, 36, 45, 42], { stepM: 30, maxPoints: 1000 }),
    /çok büyük/,
  );
});

test('DEM önbellekten okunduğunda ağa çıkılmaz', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'dem-'));
  try {
    let cagri = 0;
    const sahteFetch = async (url) => {
      cagri += 1;
      const n = new URL(url).searchParams.get('latitude').split(',').length;
      return { ok: true, json: async () => ({ elevation: Array.from({ length: n }, () => 1200) }) };
    };
    const bbox = [29.0, 40.0, 29.02, 40.02];
    const ilk = await buildDem(bbox, { stepM: 900, cacheDir: dir, fetchImpl: sahteFetch });
    assert.equal(ilk.cached, false);
    assert.ok(cagri > 0);

    const oncekiCagri = cagri;
    const ikinci = await buildDem(bbox, { stepM: 900, cacheDir: dir, fetchImpl: sahteFetch });
    assert.equal(ikinci.cached, true);
    assert.equal(cagri, oncekiCagri, 'önbellek varken yeniden çekilmemeli');
    assert.deepEqual(ikinci.values, ilk.values);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('istatistikler gerçek değerleri verir', () => {
  const dem = demFrom([0, 0, 1, 1], 3, 3, (c, r) => 100 * (c + r));
  const s = demStats(dem);
  assert.equal(s.minElevationM, 0);
  assert.equal(s.maxElevationM, 400);
});

/* ------------------------------------------------------------------ */
/* Eşyükselti                                                          */
/* ------------------------------------------------------------------ */

test('seviyeler aralığın içinde ve düzgün adımlı', () => {
  const l = levelsFor({ minElevationM: 812, maxElevationM: 1904 }, 100);
  assert.equal(l[0], 900);
  assert.equal(l[l.length - 1], 1900);
  assert.deepEqual(
    l.map((v, i) => (i ? v - l[i - 1] : 100)),
    l.map(() => 100),
  );
});

test('düz eğik düzlemde eşyükselti eğrileri düz ve doğru sayıda', () => {
  // Batıdan doğuya doğrusal yükselen yamaç: 0 m → 1000 m
  const dem = demFrom([29.0, 40.0, 29.1, 40.1], 21, 21, (col) => col * 50);
  const gj = contourGeoJson(dem, { interval: 100, minPoints: 2 });

  // 100, 200, ... 900 → 9 seviye (0 ve 1000 kenarda, eğri üretmez ya da tek kenar)
  const seviyeler = [...new Set(gj.features.map((f) => f.properties.ele))].sort((a, b) => a - b);
  assert.ok(seviyeler.includes(500), `500 m eğrisi yok: ${seviyeler}`);
  assert.ok(seviyeler.every((v) => v % 100 === 0));

  // Doğu-batı yönünde yükselen düzlemde eşyükseltiler kuzey-güney doğrultusunda
  // düz çizgi olmalı: tüm noktaların boylamı aynı.
  const besYuz = gj.features.find((f) => f.properties.ele === 500);
  const boylamlar = besYuz.geometry.coordinates.map((c) => c[0]);
  const fark = Math.max(...boylamlar) - Math.min(...boylamlar);
  assert.ok(fark < 1e-6, `500 m eğrisi düz değil (boylam farkı ${fark})`);
});

test('index bayrağı her 5. eğride açılır', () => {
  const dem = demFrom([29.0, 40.0, 29.1, 40.1], 21, 21, (col) => col * 50);
  const gj = contourGeoJson(dem, { interval: 20, indexEvery: 5 });
  for (const f of gj.features) {
    const beklenen = f.properties.ele % 100 === 0 ? 1 : 0;
    assert.equal(f.properties.index, beklenen, `${f.properties.ele} m için index yanlış`);
  }
});

test('düz arazi eşyükselti üretmez', () => {
  const dem = demFrom([29.0, 40.0, 29.1, 40.1], 10, 10, () => 500);
  const gj = contourGeoJson(dem, { interval: 20 });
  assert.equal(gj.features.length, 0);
});

test('tepe çevresinde kapalı halka oluşur', () => {
  // Merkezi tepe: kenarlarda 0, ortada ~1000
  const dem = demFrom([29.0, 40.0, 29.2, 40.2], 21, 21, (c, r) => {
    const dx = (c - 10) / 10;
    const dy = (r - 10) / 10;
    return Math.max(0, 1000 * (1 - Math.hypot(dx, dy)));
  });
  const gj = contourGeoJson(dem, { interval: 200 });
  const halka = gj.features.find((f) => {
    const c = f.geometry.coordinates;
    return c.length > 4 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
  });
  assert.ok(halka, 'tepe çevresinde kapalı eğri bulunamadı');
});

test('parça birleştirme kopuk parçaları tek çizgiye çevirir', () => {
  const lines = stitch([
    [
      [0, 0],
      [1, 0],
    ],
    [
      [2, 0],
      [3, 0],
    ],
    [
      [1, 0],
      [2, 0],
    ],
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].length, 4);
});

/* ------------------------------------------------------------------ */
/* Eğim                                                                */
/* ------------------------------------------------------------------ */

test('bilinen eğimli düzlemde açı doğru hesaplanır', () => {
  // 1000 m boyunca 1000 m yükselen yamaç = 45°.
  // Bir derece enlem ≈ 111.320 m; 0.01° ≈ 1113 m.
  const bbox = [29.0, 40.0, 29.0 + 0.01 / Math.cos((40 * Math.PI) / 180), 40.01];
  const cols = 11;
  const yatayM = 0.01 * 111_320; // boylam yönü enlem düzeltmesiyle aynı mesafeye getirildi
  const dem = demFrom(bbox, cols, 11, (col) => (col / (cols - 1)) * yatayM);
  const s = slopeGrid(dem);
  // Kenar etkilerinden uzak, ortadaki hücre
  const merkez = s.values[5 * s.cols + 5];
  assert.ok(Math.abs(merkez - 45) < 1.5, `45° bekleniyordu, ${merkez.toFixed(1)}° çıktı`);
});

test('düz arazide eğim sıfır', () => {
  const dem = demFrom([29, 40, 29.1, 40.1], 10, 10, () => 800);
  const s = slopeGrid(dem);
  assert.ok(Math.max(...s.values) < 0.01);
});

test('bant sınırları çığ ölçütleriyle uyumlu ve bitişik', () => {
  assert.equal(bandOf(29.9).id, 'moderate');
  assert.equal(bandOf(30).id, 'considerable');
  assert.equal(bandOf(34.9).id, 'considerable');
  assert.equal(bandOf(35).id, 'high');
  assert.equal(bandOf(44.9).id, 'very_high');
  assert.equal(bandOf(45).id, 'extreme');
  assert.equal(bandOf(26.9), null, '27° altı bant dışı olmalı');
  // Bantlar arasında boşluk olmamalı: her bandın sonu bir sonrakinin başı.
  for (let i = 1; i < SLOPE_BANDS.length; i += 1) {
    assert.equal(SLOPE_BANDS[i].min, SLOPE_BANDS[i - 1].max);
  }
});

test('hücre birleştirme dikdörtgen sayısını gerçekten düşürür', () => {
  // 10×10 tek sınıf → tek dikdörtgen (100 yerine 1)
  const rects = mergeCells(10, 10, () => 'high');
  assert.equal(rects.length, 1);
  assert.deepEqual(rects[0], { band: 'high', col: 0, row: 0, width: 10, height: 10 });
});

test('hücre birleştirme farklı sınıfları karıştırmaz', () => {
  const rects = mergeCells(4, 2, (col) => (col < 2 ? 'high' : 'extreme'));
  assert.equal(rects.length, 2);
  const yuksek = rects.find((r) => r.band === 'high');
  assert.deepEqual(
    { col: yuksek.col, width: yuksek.width, height: yuksek.height },
    { col: 0, width: 2, height: 2 },
  );
});

test('birleştirme boşluk bırakmaz: tüm hücreler kapsanır', () => {
  const cols = 7;
  const rows = 5;
  const sinif = (col, row) => ((col + row) % 3 === 0 ? 'high' : 'extreme');
  const rects = mergeCells(cols, rows, sinif);
  const kapsanan = new Set();
  for (const r of rects) {
    for (let y = r.row; y < r.row + r.height; y += 1) {
      for (let x = r.col; x < r.col + r.width; x += 1) {
        const k = `${x},${y}`;
        assert.ok(!kapsanan.has(k), `hücre iki kez kapsandı: ${k}`);
        kapsanan.add(k);
        assert.equal(sinif(x, y), r.band, `hücre yanlış banda atandı: ${k}`);
      }
    }
  }
  assert.equal(kapsanan.size, cols * rows, 'kapsanmayan hücre kaldı');
});

test('eğim poligonları bant özelliklerini taşır', () => {
  const cols = 11;
  const yatayM = 0.01 * 111_320;
  const bbox = [29.0, 40.0, 29.0 + 0.01 / Math.cos((40 * Math.PI) / 180), 40.01];
  const dem = demFrom(bbox, cols, 11, (col) => (col / (cols - 1)) * yatayM);
  const gj = slopeGeoJson(dem);
  assert.ok(gj.features.length > 0);
  for (const f of gj.features) {
    assert.ok(SLOPE_BANDS.some((b) => b.id === f.properties.band));
    assert.equal(f.geometry.type, 'Polygon');
    assert.equal(f.geometry.coordinates[0].length, 5, 'dikdörtgen 5 nokta (kapalı) olmalı');
  }
  // 45°'lik düzlem "extreme" banda düşmeli.
  assert.ok(gj.features.some((f) => f.properties.band === 'extreme'));
});

test('eğim istatistikleri düz arazide bant üretmez', () => {
  const dem = demFrom([29, 40, 29.1, 40.1], 8, 8, () => 300);
  const s = slopeStats(dem);
  assert.equal(s.belowBands, 64);
  assert.ok(s.maxAngle < 0.1);
});
