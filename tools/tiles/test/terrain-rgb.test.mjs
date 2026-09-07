/**
 * Terrain-RGB (terrarium) karo testleri.
 *
 *   node --test tools/tiles/test/terrain-rgb.test.mjs
 *
 * Bu hattın sessizce yanlış çalışması mümkün: karo çizilir, harita bir şey
 * gösterir ama yükseklikler kayıktır ve 3B arazi çarpık olur. Bu yüzden ölçüt
 * **gidiş-dönüş**tür: kodlanan yükseklik, çözüldüğünde aynı değeri vermeli.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';

import { chunk, crc32, encodePng, readPngHeader } from '../lib/png.mjs';
import {
  TERRARIUM_OFFSET,
  buildTerrainTiles,
  decodeElevation,
  encodeElevation,
  latToTile,
  lonToTile,
  maxZoomFor,
  renderTile,
  terrainRange,
  sampleBilinear,
  tileToLat,
  tileToLon,
} from '../lib/terrain-rgb.mjs';

/** Sahte DEM: verilen fonksiyondan ızgara üretir (ağ yok). */
function demFrom(bbox, cols, rows, fn) {
  const values = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) values.push(fn(col, row));
  }
  return {
    bbox,
    cols,
    rows,
    stepLon: (bbox[2] - bbox[0]) / (cols - 1),
    stepLat: (bbox[3] - bbox[1]) / (rows - 1),
    values,
  };
}

/* ------------------------------------------------------------------ */
/* Terrarium kodlaması                                                 */
/* ------------------------------------------------------------------ */

test('kodlama-çözme gidiş dönüşü 1/256 m içinde kalır', () => {
  for (const m of [0, 1, 100, 1234, 2543, 5642, 8848, -430, -0.5, 0.25]) {
    const [r, g, b] = encodeElevation(m);
    const geri = decodeElevation(r, g, b);
    assert.ok(
      Math.abs(geri - m) <= 1 / 256,
      `${m} m → [${r},${g},${b}] → ${geri} m (fark ${Math.abs(geri - m)})`,
    );
  }
});

test('deniz seviyesi terrarium referansına oturur', () => {
  // 0 m = (32768 * 256) → R=128, G=0, B=0
  assert.deepEqual(encodeElevation(0), [128, 0, 0]);
  assert.equal(decodeElevation(128, 0, 0), 0);
  assert.equal(TERRARIUM_OFFSET, 32768);
});

test('negatif yükseklikler doğru kodlanır (Ölü Deniz, Hazar)', () => {
  const [r, g, b] = encodeElevation(-430);
  assert.ok(Math.abs(decodeElevation(r, g, b) + 430) <= 1 / 256);
});

test('aşırı değerler kenetlenir, taşma üretmez', () => {
  for (const m of [-40000, 100000, Number.MAX_SAFE_INTEGER]) {
    const rgb = encodeElevation(m);
    for (const v of rgb) {
      assert.ok(Number.isInteger(v) && v >= 0 && v <= 255, `bayt aralık dışı: ${v} (${m} m)`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Karo geometrisi                                                     */
/* ------------------------------------------------------------------ */

test('karo koordinat dönüşümleri birbirinin tersi', () => {
  for (const z of [8, 10, 13]) {
    for (const [lon, lat] of [
      [29.06, 40.07],
      [-122.4, 37.8],
      [0, 0],
    ]) {
      const x = lonToTile(lon, z);
      const y = latToTile(lat, z);
      // Nokta, bulduğumuz karonun sınırları içinde kalmalı. Üst kenar dahildir:
      // enlem tam karo sınırına düştüğünde (ekvatorda z8 gibi) o karo doğrudur.
      assert.ok(tileToLon(x, z) <= lon && lon < tileToLon(x + 1, z), `boylam ${lon} z${z}`);
      assert.ok(tileToLat(y + 1, z) <= lat && lat <= tileToLat(y, z), `enlem ${lat} z${z}`);
    }
  }
});

test('çift doğrusal ara değer köşelerde tam, ortada ortalama verir', () => {
  // 2×2 ızgara: sol üst 0, sağ üst 100, sol alt 200, sağ alt 300
  const dem = demFrom([0, 0, 1, 1], 2, 2, (c, r) => c * 100 + r * 200);
  assert.equal(Math.round(sampleBilinear(dem, 0, 1)), 0); // kuzeybatı köşe
  assert.equal(Math.round(sampleBilinear(dem, 1, 1)), 100); // kuzeydoğu
  assert.equal(Math.round(sampleBilinear(dem, 0, 0)), 200); // güneybatı
  assert.equal(Math.round(sampleBilinear(dem, 1, 0)), 300); // güneydoğu
  assert.equal(Math.round(sampleBilinear(dem, 0.5, 0.5)), 150); // merkez = ortalama
});

test('ara değer basamak üretmez: komşu pikseller yumuşak değişir', () => {
  const dem = demFrom([29.0, 40.0, 29.1, 40.1], 5, 5, (c) => c * 500);
  let enBuyukSicrama = 0;
  let onceki = null;
  for (let i = 0; i <= 100; i += 1) {
    const lon = 29.0 + (i / 100) * 0.1;
    const v = sampleBilinear(dem, lon, 40.05);
    if (onceki !== null) enBuyukSicrama = Math.max(enBuyukSicrama, Math.abs(v - onceki));
    onceki = v;
  }
  // Toplam 2000 m'lik yükseliş 100 adımda; en yakın komşu olsaydı tek adımda
  // 500 m'lik basamaklar görülürdü.
  assert.ok(enBuyukSicrama < 60, `basamak var: ${enBuyukSicrama.toFixed(1)} m`);
});

/* ------------------------------------------------------------------ */
/* PNG kodlayıcı                                                       */
/* ------------------------------------------------------------------ */

test('PNG başlığı doğru boyut ve renk tipini taşır', () => {
  const png = encodePng(new Uint8Array(4 * 4 * 3), 4, 4);
  const h = readPngHeader(png);
  assert.deepEqual(h, { width: 4, height: 4, bitDepth: 8, colorType: 2 });
});

test('yanlış boyutta piksel dizisi reddedilir', () => {
  assert.throws(() => encodePng(new Uint8Array(10), 4, 4), /olmalı/);
});

test('CRC32 bilinen değeri üretir', () => {
  // "IEND" yığınının CRC'si PNG belirtiminde sabittir.
  assert.equal(crc32(Buffer.from('IEND', 'ascii')), 0xae426082);
});

test('yığın uzunluk ve CRC alanlarını doğru yazar', () => {
  const c = chunk('IHDR', Buffer.from([1, 2, 3]));
  assert.equal(c.readUInt32BE(0), 3);
  assert.equal(c.toString('ascii', 4, 8), 'IHDR');
  assert.equal(c.readUInt32BE(11), crc32(c.subarray(4, 11)));
});

test('PNG pikselleri kayıpsız geri okunur (filtre çözümü)', () => {
  const width = 8;
  const height = 3;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i * 37) % 256;

  const png = encodePng(rgb, width, height);
  // IDAT'ı bul ve aç, `Sub` filtresini geri al.
  let offset = 8;
  let idat = null;
  while (offset < png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat = png.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
  }
  assert.ok(idat, 'IDAT bulunamadı');

  const raw = inflateSync(idat);
  const stride = width * 3;
  const cozulen = new Uint8Array(rgb.length);
  for (let y = 0; y < height; y += 1) {
    const src = y * (stride + 1);
    assert.equal(raw[src], 1, 'filtre baytı Sub olmalı');
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 3 ? cozulen[y * stride + x - 3] : 0;
      cozulen[y * stride + x] = (raw[src + 1 + x] + left) & 0xff;
    }
  }
  assert.deepEqual([...cozulen], [...rgb]);
});

/* ------------------------------------------------------------------ */
/* Karo üretimi                                                        */
/* ------------------------------------------------------------------ */

test('karo pikselleri DEM yüksekliğini taşır', () => {
  const dem = demFrom([29.0, 40.0, 29.5, 40.5], 21, 21, () => 1500);
  const z = 10;
  const x = lonToTile(29.25, z);
  const y = latToTile(40.25, z);
  const rgb = renderTile(dem, z, x, y, 16);
  // Sabit yükseklikli DEM'de her piksel aynı ve doğru değeri vermeli.
  for (let i = 0; i < rgb.length; i += 3) {
    const m = decodeElevation(rgb[i], rgb[i + 1], rgb[i + 2]);
    assert.ok(Math.abs(m - 1500) < 1, `piksel ${i / 3}: ${m} m`);
  }
});

test('eğimli arazide karo içinde gerçek yükseklik değişimi görünür', () => {
  const dem = demFrom([29.0, 40.0, 29.5, 40.5], 21, 21, (col) => col * 100);
  const z = 9;
  const x = lonToTile(29.25, z);
  const y = latToTile(40.25, z);
  const size = 32;
  const rgb = renderTile(dem, z, x, y, size);
  const oku = (px, py) => {
    const i = (py * size + px) * 3;
    return decodeElevation(rgb[i], rgb[i + 1], rgb[i + 2]);
  };
  // Batıdan doğuya yükselen arazi: sağdaki piksel soldakinden yüksek olmalı.
  assert.ok(oku(size - 1, size / 2) > oku(0, size / 2));
});

test('karo kümesi zum aralığını ve alanı kapsar', () => {
  const dem = demFrom([29.0, 40.0, 29.2, 40.2], 11, 11, () => 800);
  const tiles = buildTerrainTiles(dem, { minzoom: 8, maxzoom: 10, size: 32 });
  const zumlar = new Set([...tiles.keys()].map((k) => Number(k.split('/')[0])));
  assert.deepEqual([...zumlar].sort((a, b) => a - b), [8, 9, 10]);
  // Bölgenin merkezini içeren karo her zumda bulunmalı.
  for (const z of [8, 9, 10]) {
    assert.ok(tiles.has(`${z}/${lonToTile(29.1, z)}/${latToTile(40.1, z)}`), `z${z} merkez karosu yok`);
  }
  for (const png of tiles.values()) assert.equal(readPngHeader(png).width, 32);
});

test('üst zum DEM çözünürlüğüne göre sınırlanır', () => {
  // Kaba ızgara (yaklaşık 2 km adım) yüksek zumda yeni bilgi taşımaz.
  const kaba = demFrom([29.0, 40.0, 29.2, 40.2], 11, 11, () => 800);
  const ince = demFrom([29.0, 40.0, 29.2, 40.2], 201, 201, () => 800);
  assert.ok(
    maxZoomFor(ince) > maxZoomFor(kaba),
    `ince ızgara daha yüksek zum desteklemeli (${maxZoomFor(ince)} vs ${maxZoomFor(kaba)})`,
  );
  assert.ok(maxZoomFor(ince) <= 16, 'üst sınır makul kalmalı');
});

test('kaba ızgarada bile karo üretilir (sessiz boş çıktı yok)', () => {
  // ~1,7 km adımlı ızgara z6'ya kadar bilgi taşır; minzoom 8 istendiğinde
  // döngü hiç dönmeyip sessizce boş küme üretiyordu.
  const kaba = demFrom([29.0, 40.0, 29.2, 40.2], 11, 11, () => 800);
  const aralik = terrainRange(kaba, { minzoom: 8 });
  assert.ok(aralik.resolutionLimit < 8, 'bu ızgara gerçekten kaba olmalı');
  assert.equal(aralik.maxzoom, 8, 'aralık minzoom değerine kenetlenmeli');
  assert.equal(aralik.interpolatedAbove, aralik.resolutionLimit);

  const tiles = buildTerrainTiles(kaba, { minzoom: 8, size: 32 });
  assert.ok(tiles.size > 0, 'karo üretilmedi — sessiz boş çıktı');
});
