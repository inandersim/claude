/**
 * SDF glyph hattı testleri: TTF ayrıştırma → SDF → protobuf.
 *
 *   node --test tools/glyphs/test/glyphs.test.mjs
 *
 * Bu hattın başarısızlığı sessizdir: harita çökmez, yalnızca **metin hiç
 * çizilmez**. Bu yüzden testler biçimin her katmanını ayrı ayrı, mümkün olan
 * yerde bilinen geometriyle doğrular.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_RANGES, buildRange, parseRange } from '../build-glyphs.mjs';
import { decodeGlyphPbf, encodeGlyphPbf, writeVarint, zigzag } from '../lib/glyph-pbf.mjs';
import { GLYPH_BUFFER, flattenContour, glyphToSdf, rasterize } from '../lib/sdf.mjs';
import { parseFont } from '../lib/ttf.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FONT_PATH = resolve(ROOT, 'admin/public/fonts/Manrope_600SemiBold.ttf');
const font = parseFont(readFileSync(FONT_PATH));

const cp = (ch) => ch.codePointAt(0);

/* ------------------------------------------------------------------ */
/* TrueType ayrıştırma                                                 */
/* ------------------------------------------------------------------ */

test('yazı tipi başlığı okunur', () => {
  assert.equal(font.unitsPerEm, 2000);
  assert.ok(font.numGlyphs > 100);
  assert.ok(font.cmap.size > 200);
});

test('Türkçe karakterler cmap üzerinden bulunur', () => {
  // Bunların hiçbiri Latin-1'de değil (ı ğ ş İ Ğ Ş) ya da özel kabuk gerektirir.
  for (const ch of ['ı', 'ğ', 'ş', 'İ', 'Ğ', 'Ş', 'ö', 'ü', 'ç', 'Ö', 'Ü', 'Ç']) {
    const gid = font.gidFor(cp(ch));
    assert.notEqual(gid, 0, `'${ch}' yazı tipinde yok`);
    assert.ok(font.glyphOf(gid).contours.length > 0, `'${ch}' boş çizildi`);
  }
});

test('bileşik glyph alt parçalarıyla birleştirilir', () => {
  // 'ğ' = 'g' + breve; bileşik çözülmezse yalnızca gövde çıkar.
  const g = font.glyphOf(font.gidFor(cp('ğ')));
  const gBase = font.glyphOf(font.gidFor(cp('g')));
  assert.ok(
    g.contours.length > gBase.contours.length,
    `bileşik çözülmemiş: ğ=${g.contours.length} kontur, g=${gBase.contours.length}`,
  );
});

test('boşluk karakterinin çizimi yok ama ilerlemesi var', () => {
  const gid = font.gidFor(cp(' '));
  assert.deepEqual(font.glyphOf(gid).contours, []);
  assert.ok(font.advanceOf(gid) > 0);
});

test('rakamların hepsi çizilebilir ve makul genişlikte', () => {
  // Manrope orantılı bir yazı tipi: '1' diğerlerinden dar. Bu bir kusur değil;
  // harita etiketleri sütun hâlinde dizilmediği için hizalama sorunu olmuyor.
  // Önemli olan her rakamın gerçekten çizilebilmesi.
  for (const d of '0123456789') {
    const gid = font.gidFor(cp(d));
    assert.notEqual(gid, 0, `'${d}' yok`);
    assert.ok(font.glyphOf(gid).contours.length > 0, `'${d}' boş`);
    assert.ok(font.advanceOf(gid) > 0);
  }
});

test('bilinmeyen kod noktası .notdef verir', () => {
  assert.equal(font.gidFor(0x1f600), 0); // emoji yok
});

/* ------------------------------------------------------------------ */
/* Anahat düzleştirme                                                  */
/* ------------------------------------------------------------------ */

test('örtük eğri-üstü nokta kuralı uygulanır', () => {
  // İki denetim noktası art arda: aralarında örtük bir eğri-üstü nokta vardır.
  // Kural atlanırsa harfler köşeli çıkar.
  const contour = [
    { x: 0, y: 0, onCurve: true },
    { x: 10, y: 0, onCurve: false },
    { x: 10, y: 10, onCurve: false },
    { x: 0, y: 10, onCurve: true },
  ];
  const pts = flattenContour(contour, 4);
  assert.ok(pts.length > 6, 'eğri bölünmemiş');
  // Örtük orta nokta (10,5) civarından geçmeli.
  assert.ok(
    pts.some((p) => Math.abs(p.x - 10) < 1.5 && Math.abs(p.y - 5) < 1.5),
    'örtük orta noktadan geçilmiyor',
  );
});

test('tamamı eğri-dışı noktalardan oluşan kontur de kapanır', () => {
  const contour = [
    { x: 0, y: 0, onCurve: false },
    { x: 10, y: 0, onCurve: false },
    { x: 5, y: 10, onCurve: false },
  ];
  const pts = flattenContour(contour, 3);
  assert.ok(pts.length > 3);
  const ilk = pts[0];
  const son = pts[pts.length - 1];
  assert.ok(Math.hypot(ilk.x - son.x, ilk.y - son.y) < 0.001, 'kontur kapanmamış');
});

/* ------------------------------------------------------------------ */
/* Tarama ve SDF                                                       */
/* ------------------------------------------------------------------ */

test('kare tam olarak doldurulur, dışı boş kalır', () => {
  const kare = [
    [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
      { x: 2, y: 2 },
    ],
  ];
  const cov = rasterize(kare, 10, 10);
  assert.equal(cov[5 * 10 + 5], 1, 'iç piksel dolu değil');
  assert.equal(cov[0], 0, 'dış piksel dolu');
  const toplam = cov.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(toplam - 36) < 0.5, `alan 36 olmalı, ${toplam.toFixed(2)} çıktı`);
});

test('iç içe kontur delik açar (nonzero sarım)', () => {
  const dis = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 12 },
    { x: 0, y: 12 },
    { x: 0, y: 0 },
  ];
  // Ters yönde iç kontur = delik
  const ic = [
    { x: 4, y: 4 },
    { x: 4, y: 8 },
    { x: 8, y: 8 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
  ];
  const cov = rasterize([dis, ic], 12, 12);
  assert.equal(cov[6 * 12 + 6], 0, 'delik dolmuş');
  assert.equal(cov[1 * 12 + 1], 1, 'gövde boş');
});

test('SDF kenarı 192 alfa değerine oturur', () => {
  // MapLibre kenarı 192'de arar (255 * (1 - cutoff)); kayarsa metin ya şişer
  // ya incelir.
  const kare = {
    contours: [
      [
        { x: 0, y: 0, onCurve: true },
        { x: 1000, y: 0, onCurve: true },
        { x: 1000, y: 1000, onCurve: true },
        { x: 0, y: 1000, onCurve: true },
      ],
    ],
  };
  const g = glyphToSdf(kare, { unitsPerEm: 2000, advance: 1000 });
  const w = g.width + 2 * GLYPH_BUFFER;
  const oku = (x, y) => g.bitmap[y * w + x];

  const merkez = oku(Math.floor(w / 2), Math.floor((g.height + 2 * GLYPH_BUFFER) / 2));
  assert.ok(merkez > 220, `iç değer düşük: ${merkez}`);
  assert.ok(oku(0, 0) < 130, `köşe (dış) değer yüksek: ${oku(0, 0)}`);

  // Kenar tam piksel sınırındaysa hiçbir piksel merkezi 192'ye oturmaz: dıştaki
  // yarım piksel ve içteki yarım piksel kenarı **kuşatır**. Doğru ölçüt, ikisinin
  // 192'yi ortalamasıdır — MapLibre de aradeğerle bu noktayı bulur.
  const satir = Math.floor((g.height + 2 * GLYPH_BUFFER) / 2);
  const dis = oku(GLYPH_BUFFER - 1, satir);
  const ic = oku(GLYPH_BUFFER, satir);
  assert.ok(dis < 192, `kenarın dışı içeride görünüyor: ${dis}`);
  assert.ok(ic > 192, `kenarın içi dışarıda görünüyor: ${ic}`);
  assert.ok(Math.abs((dis + ic) / 2 - 192) <= 4, `kenar 192'de değil: (${dis}+${ic})/2`);
});

test('SDF ölçüleri ve bitmap boyutu tutarlı', () => {
  const gid = font.gidFor(cp('A'));
  const g = glyphToSdf(font.glyphOf(gid), {
    unitsPerEm: font.unitsPerEm,
    advance: font.advanceOf(gid),
  });
  assert.equal(g.bitmap.length, (g.width + 2 * GLYPH_BUFFER) * (g.height + 2 * GLYPH_BUFFER));
  assert.ok(g.width > 0 && g.height > 0);
  assert.ok(g.top > 0, 'taban çizgisinin üstünde olmalı');
  assert.ok(g.advance > 0);
});

test('çizimi olmayan glyph boş bitmap ve ölçü verir', () => {
  const gid = font.gidFor(cp(' '));
  const g = glyphToSdf(font.glyphOf(gid), {
    unitsPerEm: font.unitsPerEm,
    advance: font.advanceOf(gid),
  });
  assert.equal(g.bitmap.length, 0);
  assert.equal(g.width, 0);
  assert.ok(g.advance > 0, 'boşluğun ilerlemesi olmalı');
});

test('taban çizgisi altına inen harflerde top küçülür', () => {
  // 'g' kuyruğu taban çizgisinin altına iner; 'o' inmez.
  const g = (ch) => {
    const gid = font.gidFor(cp(ch));
    return glyphToSdf(font.glyphOf(gid), {
      unitsPerEm: font.unitsPerEm,
      advance: font.advanceOf(gid),
    });
  };
  const inen = g('g');
  const duz = g('o');
  assert.ok(inen.height > duz.height, 'kuyruk yüksekliğe eklenmemiş');
  assert.ok(Math.abs(inen.top - duz.top) <= 1, 'üst hizası kaymış');
});

/* ------------------------------------------------------------------ */
/* Protobuf                                                            */
/* ------------------------------------------------------------------ */

test('varint bilinen değerleri doğru kodlar', () => {
  const enc = (v) => {
    const out = [];
    writeVarint(out, v);
    return out;
  };
  assert.deepEqual(enc(0), [0]);
  assert.deepEqual(enc(1), [1]);
  assert.deepEqual(enc(127), [127]);
  assert.deepEqual(enc(128), [0x80, 0x01]);
  assert.deepEqual(enc(300), [0xac, 0x02]);
});

test('zigzag negatif değerleri korur', () => {
  assert.equal(zigzag(0), 0);
  assert.equal(zigzag(-1), 1);
  assert.equal(zigzag(1), 2);
  assert.equal(zigzag(-2), 3);
});

test('glyph paketi gidiş dönüşte aynı kalır', () => {
  const glyphs = ['A', '0', 'ğ', ' '].map((ch) => {
    const id = cp(ch);
    const gid = font.gidFor(id);
    return {
      id,
      ...glyphToSdf(font.glyphOf(gid), {
        unitsPerEm: font.unitsPerEm,
        advance: font.advanceOf(gid),
      }),
    };
  });
  const pbf = encodeGlyphPbf('Test Stack', '0-255', glyphs);
  const { stacks } = decodeGlyphPbf(pbf);
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].name, 'Test Stack');
  assert.equal(stacks[0].range, '0-255');
  assert.equal(stacks[0].glyphs.length, glyphs.length);

  for (const beklenen of glyphs) {
    const okunan = stacks[0].glyphs.find((g) => g.id === beklenen.id);
    assert.ok(okunan, `U+${beklenen.id.toString(16)} kayıp`);
    assert.equal(okunan.width, beklenen.width);
    assert.equal(okunan.height, beklenen.height);
    assert.equal(okunan.left, beklenen.left);
    assert.equal(okunan.top, beklenen.top);
    assert.equal(okunan.advance, beklenen.advance);
    assert.equal(okunan.bitmap?.length ?? 0, beklenen.bitmap.length);
    if (beklenen.bitmap.length) {
      assert.deepEqual([...okunan.bitmap], [...beklenen.bitmap], 'bitmap bozulmuş');
    }
  }
});

test('negatif sol kenar (left) doğru geri okunur', () => {
  const glyphs = [{ id: 65, width: 2, height: 2, left: -3, top: -4, advance: 5, bitmap: new Uint8Array(64) }];
  const { stacks } = decodeGlyphPbf(encodeGlyphPbf('S', '0-255', glyphs));
  assert.equal(stacks[0].glyphs[0].left, -3);
  assert.equal(stacks[0].glyphs[0].top, -4);
});

/* ------------------------------------------------------------------ */
/* Aralık sözleşmesi                                                   */
/* ------------------------------------------------------------------ */

test('aralık 256lık bloğa hizalı olmak zorunda', () => {
  // Gerçek hata buydu: 256-383 geçerli bir dosya üretti ama MapLibre onu hiç
  // istemedi (o hep 256-511 ister) ve Türkçe harfler sessizce çizilmedi.
  assert.deepEqual(parseRange('0-255'), { start: 0, end: 255 });
  assert.deepEqual(parseRange('256-511'), { start: 256, end: 511 });
  assert.throws(() => parseRange('256-383'), /hizalı/);
  assert.throws(() => parseRange('10-265'), /hizalı/);
  assert.throws(() => parseRange('abc'), /Geçersiz/);
});

test('varsayılan aralıklar Türkçe için yeterli', () => {
  const kapsam = DEFAULT_RANGES.map(parseRange);
  const kapsar = (ch) => kapsam.some((r) => cp(ch) >= r.start && cp(ch) <= r.end);
  for (const ch of ['ı', 'ğ', 'ş', 'İ', 'Ğ', 'Ş', 'ö', 'ü', 'ç', '°']) {
    assert.ok(kapsar(ch), `'${ch}' varsayılan aralıkların dışında`);
  }
});

test('aralık üretimi yazı tipinde olmayan kodları atlar', () => {
  const glyphs = buildRange(font, { start: 0, end: 255 });
  // Yazı tipi bazı kontrol kodlarını (ör. CR) boş glyph'e eşler — bu bir yazı
  // tipi alışkanlığı, hata değil. Ölçüt: eklenen her glyph ya çizilebilir ya da
  // en azından bir ilerleme taşır; anlamsız kayıt olmamalı.
  for (const g of glyphs) {
    assert.ok(g.advance > 0 || g.bitmap.length > 0, `U+${g.id.toString(16)} anlamsız`);
  }
  assert.ok(glyphs.some((g) => g.id === cp('A')));
  assert.ok(glyphs.some((g) => g.id === cp('ö')));
  assert.ok(glyphs.length > 150 && glyphs.length <= 256);
});
