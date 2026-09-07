/**
 * MapLibre glyph protobuf kodlayıcı.
 *
 * Şema (glyphs.proto):
 *
 *   message glyph     { uint32 id=1; bytes bitmap=2; uint32 width=3;
 *                       uint32 height=4; sint32 left=5; sint32 top=6;
 *                       uint32 advance=7; }
 *   message fontstack { string name=1; string range=2; repeated glyph glyphs=3; }
 *   message glyphs    { repeated fontstack stacks=1; }
 *
 * Kaynak: https://github.com/mapbox/glyph-pbf-composite
 *
 * Varint yazımı burada yeniden yazıldı (10 satır); karo yazıcısından içe
 * aktarmak, birbiriyle ilgisiz iki aracı birbirine bağlardı.
 */

/** Değişken uzunluklu tamsayı (LEB128). */
export function writeVarint(out, value) {
  let v = value;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
}

/** İşaretli tamsayı → zigzag (protobuf `sint32`). */
export const zigzag = (v) => (v << 1) ^ (v >> 31);

const key = (field, wireType) => (field << 3) | wireType;

function writeVarintField(out, field, value) {
  writeVarint(out, key(field, 0));
  writeVarint(out, value);
}

function writeBytesField(out, field, bytes) {
  writeVarint(out, key(field, 2));
  writeVarint(out, bytes.length);
  for (const b of bytes) out.push(b);
}

/** Tek bir glyph mesajı. */
export function encodeGlyph(glyph) {
  const out = [];
  writeVarintField(out, 1, glyph.id);
  // Boş glyph'te (boşluk karakteri) bitmap alanı hiç yazılmaz; MapLibre bunu
  // "çizimi yok, yalnızca ilerleme var" diye okur.
  if (glyph.bitmap && glyph.bitmap.length) writeBytesField(out, 2, glyph.bitmap);
  writeVarintField(out, 3, glyph.width);
  writeVarintField(out, 4, glyph.height);
  writeVarintField(out, 5, zigzag(glyph.left));
  writeVarintField(out, 6, zigzag(glyph.top));
  writeVarintField(out, 7, glyph.advance);
  return out;
}

/**
 * Bir yazı tipi yığını ve içindeki glyph'ler.
 *
 * @param {string} name  yığın adı — stildeki `text-font` ile birebir aynı olmalı
 * @param {string} range "0-255" gibi; dosya adıyla da eşleşir
 */
export function encodeFontstack(name, range, glyphs) {
  const out = [];
  writeBytesField(out, 1, Buffer.from(name, 'utf8'));
  writeBytesField(out, 2, Buffer.from(range, 'utf8'));
  for (const glyph of glyphs) writeBytesField(out, 3, encodeGlyph(glyph));
  return out;
}

/** Tam dosya: tek yığın taşıyan `glyphs` mesajı. */
export function encodeGlyphPbf(name, range, glyphs) {
  const out = [];
  writeBytesField(out, 1, encodeFontstack(name, range, glyphs));
  return Buffer.from(out);
}

/* ------------------------------------------------------------------ */
/* Çözme — yalnızca testler ve doğrulama için                          */
/* ------------------------------------------------------------------ */

function readVarint(buf, state) {
  let result = 0;
  let shift = 1;
  for (;;) {
    const b = buf[state.p];
    state.p += 1;
    result += (b & 0x7f) * shift;
    if ((b & 0x80) === 0) break;
    shift *= 128;
  }
  return result;
}

const unzigzag = (v) => (v >>> 1) ^ -(v & 1);

/** Kodlanan dosyayı geri okur; kodlamanın doğruluğu böyle sınanır. */
export function decodeGlyphPbf(buf) {
  const state = { p: 0 };
  const stacks = [];
  while (state.p < buf.length) {
    const k = readVarint(buf, state);
    const field = k >> 3;
    const len = readVarint(buf, state);
    const slice = buf.subarray(state.p, state.p + len);
    state.p += len;
    if (field === 1) stacks.push(decodeFontstack(slice));
  }
  return { stacks };
}

function decodeFontstack(buf) {
  const state = { p: 0 };
  const stack = { name: '', range: '', glyphs: [] };
  while (state.p < buf.length) {
    const k = readVarint(buf, state);
    const field = k >> 3;
    const len = readVarint(buf, state);
    const slice = buf.subarray(state.p, state.p + len);
    state.p += len;
    if (field === 1) stack.name = slice.toString('utf8');
    else if (field === 2) stack.range = slice.toString('utf8');
    else if (field === 3) stack.glyphs.push(decodeGlyph(slice));
  }
  return stack;
}

function decodeGlyph(buf) {
  const state = { p: 0 };
  const glyph = { id: 0, bitmap: null, width: 0, height: 0, left: 0, top: 0, advance: 0 };
  while (state.p < buf.length) {
    const k = readVarint(buf, state);
    const field = k >> 3;
    const wire = k & 7;
    if (wire === 2) {
      const len = readVarint(buf, state);
      if (field === 2) glyph.bitmap = buf.subarray(state.p, state.p + len);
      state.p += len;
      continue;
    }
    const value = readVarint(buf, state);
    if (field === 1) glyph.id = value;
    else if (field === 3) glyph.width = value;
    else if (field === 4) glyph.height = value;
    else if (field === 5) glyph.left = unzigzag(value);
    else if (field === 6) glyph.top = unzigzag(value);
    else if (field === 7) glyph.advance = value;
  }
  return glyph;
}
