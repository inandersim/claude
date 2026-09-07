/**
 * Asgari TrueType ayrıştırıcı — glyph anahatlarını okur.
 *
 * Yalnızca SDF üretimi için gerekeni okur: birim kare (`unitsPerEm`), karakter →
 * glyph eşlemesi (`cmap`), yatay ölçüler (`hmtx`) ve anahatlar (`glyf`).
 * Kerning, GPOS, renkli glyph, ipuçları (hinting) — hiçbiri gerekmiyor;
 * MapLibre metni SDF dokusundan kendi diziyor.
 *
 * Genel amaçlı bir yazı tipi kütüphanesi eklemek yerine bu ~250 satır yazıldı:
 * harita metni için ihtiyaç bu kadar ve depo bağımlılıksız kalıyor.
 *
 * Biçim: https://learn.microsoft.com/typography/opentype/spec/otff
 */

const TAG = (buf, offset) => buf.toString('ascii', offset, offset + 4);

/** Tablo dizinini okur: etiket → { offset, length }. */
export function readTables(buf) {
  const version = buf.readUInt32BE(0);
  // 0x00010000 = TrueType anahatları, 'true'/'ttcf' başka biçimler.
  if (version !== 0x00010000 && TAG(buf, 0) !== 'true') {
    throw new Error(`Desteklenmeyen yazı tipi sürümü: 0x${version.toString(16)}`);
  }
  const numTables = buf.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const p = 12 + i * 16;
    tables.set(TAG(buf, p), { offset: buf.readUInt32BE(p + 8), length: buf.readUInt32BE(p + 12) });
  }
  return tables;
}

function requireTable(tables, tag) {
  const t = tables.get(tag);
  if (!t) throw new Error(`Zorunlu tablo yok: ${tag}`);
  return t;
}

/**
 * `cmap` — Unicode kod noktası → glyph kimliği.
 *
 * Format 4 (BMP) ve format 12 (tam Unicode) okunur; ikisi de yoksa hata verilir.
 * Manrope gibi modern yazı tipleri en az birini taşır.
 */
export function readCmap(buf, tables) {
  const { offset } = requireTable(tables, 'cmap');
  const numTables = buf.readUInt16BE(offset + 2);

  let best = null;
  for (let i = 0; i < numTables; i += 1) {
    const p = offset + 4 + i * 8;
    const platformId = buf.readUInt16BE(p);
    const encodingId = buf.readUInt16BE(p + 2);
    const subOffset = offset + buf.readUInt32BE(p + 4);
    const format = buf.readUInt16BE(subOffset);
    // Tercih sırası: format 12 (tam Unicode) > format 4 (BMP)
    const score =
      format === 12 && platformId === 3 && encodingId === 10
        ? 3
        : format === 12
          ? 2
          : format === 4 && platformId === 3
            ? 1
            : 0;
    if (score > 0 && (!best || score > best.score)) best = { subOffset, format, score };
  }
  if (!best) throw new Error('cmap içinde format 4 ya da 12 alt tablosu yok');

  return best.format === 12
    ? readCmapFormat12(buf, best.subOffset)
    : readCmapFormat4(buf, best.subOffset);
}

function readCmapFormat4(buf, offset) {
  const segCountX2 = buf.readUInt16BE(offset + 6);
  const segCount = segCountX2 / 2;
  const endBase = offset + 14;
  const startBase = endBase + segCountX2 + 2;
  const deltaBase = startBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  const map = new Map();
  for (let seg = 0; seg < segCount; seg += 1) {
    const end = buf.readUInt16BE(endBase + seg * 2);
    const start = buf.readUInt16BE(startBase + seg * 2);
    const delta = buf.readInt16BE(deltaBase + seg * 2);
    const rangeOffset = buf.readUInt16BE(rangeBase + seg * 2);
    if (start === 0xffff) continue;
    for (let code = start; code <= end && code !== 0x10000; code += 1) {
      let gid;
      if (rangeOffset === 0) {
        gid = (code + delta) & 0xffff;
      } else {
        // Belirtimdeki dolaylı adresleme: idRangeOffset kendi konumundan sayılır.
        const idx = rangeBase + seg * 2 + rangeOffset + (code - start) * 2;
        if (idx + 1 >= buf.length) continue;
        const raw = buf.readUInt16BE(idx);
        gid = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (gid) map.set(code, gid);
    }
  }
  return map;
}

function readCmapFormat12(buf, offset) {
  const numGroups = buf.readUInt32BE(offset + 12);
  const map = new Map();
  for (let i = 0; i < numGroups; i += 1) {
    const p = offset + 16 + i * 12;
    const start = buf.readUInt32BE(p);
    const end = buf.readUInt32BE(p + 4);
    const startGid = buf.readUInt32BE(p + 8);
    for (let code = start; code <= end; code += 1) map.set(code, startGid + (code - start));
  }
  return map;
}

/** Yazı tipinin ölçü bilgileri. */
export function readHead(buf, tables) {
  const { offset } = requireTable(tables, 'head');
  return {
    unitsPerEm: buf.readUInt16BE(offset + 18),
    // 0 = kısa (uint16, iki katı), 1 = uzun (uint32)
    indexToLocFormat: buf.readInt16BE(offset + 50),
  };
}

/** Yatay ilerleme genişlikleri (advance width). */
export function readHmtx(buf, tables, numGlyphs) {
  const hhea = requireTable(tables, 'hhea');
  const numHMetrics = buf.readUInt16BE(hhea.offset + 34);
  const { offset } = requireTable(tables, 'hmtx');
  const widths = new Uint16Array(numGlyphs);
  let last = 0;
  for (let i = 0; i < numGlyphs; i += 1) {
    if (i < numHMetrics) last = buf.readUInt16BE(offset + i * 4);
    widths[i] = last;
  }
  return widths;
}

/** `maxp` → glyph sayısı. */
export function readNumGlyphs(buf, tables) {
  const { offset } = requireTable(tables, 'maxp');
  return buf.readUInt16BE(offset + 4);
}

/** `loca` → her glyph'in `glyf` içindeki başlangıcı. */
export function readLoca(buf, tables, numGlyphs, indexToLocFormat) {
  const { offset } = requireTable(tables, 'loca');
  const loca = new Uint32Array(numGlyphs + 1);
  for (let i = 0; i <= numGlyphs; i += 1) {
    loca[i] =
      indexToLocFormat === 0 ? buf.readUInt16BE(offset + i * 2) * 2 : buf.readUInt32BE(offset + i * 4);
  }
  return loca;
}

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME_OR_POSITIVE = 0x10;
const Y_SAME_OR_POSITIVE = 0x20;

/**
 * Tek bir glyph'in anahatlarını okur.
 *
 * Dönüş: `{ contours: [[{x,y,onCurve}, ...], ...], bbox }` — koordinatlar yazı
 * tipi biriminde. Bileşik glyph'ler (ör. `ü` = `u` + noktalar) özyinelemeli
 * çözülür; Türkçe metin için bu şart.
 */
export function readGlyph(buf, tables, loca, index, depth = 0) {
  if (depth > 5) throw new Error('Bileşik glyph çok derin');
  const glyf = requireTable(tables, 'glyf');
  const start = glyf.offset + loca[index];
  const end = glyf.offset + loca[index + 1];
  if (end <= start) return { contours: [], bbox: [0, 0, 0, 0] }; // boşluk gibi boş glyph

  const numberOfContours = buf.readInt16BE(start);
  const bbox = [
    buf.readInt16BE(start + 2),
    buf.readInt16BE(start + 4),
    buf.readInt16BE(start + 6),
    buf.readInt16BE(start + 8),
  ];

  if (numberOfContours < 0) {
    return { contours: readComposite(buf, tables, loca, start + 10, depth), bbox };
  }

  let p = start + 10;
  const endPts = [];
  for (let i = 0; i < numberOfContours; i += 1) {
    endPts.push(buf.readUInt16BE(p));
    p += 2;
  }
  const numPoints = numberOfContours ? endPts[endPts.length - 1] + 1 : 0;

  const instructionLength = buf.readUInt16BE(p);
  p += 2 + instructionLength;

  // Bayraklar tekrar sıkıştırmalıdır (REPEAT).
  const flags = new Uint8Array(numPoints);
  for (let i = 0; i < numPoints; ) {
    const flag = buf.readUInt8(p);
    p += 1;
    flags[i] = flag;
    i += 1;
    if (flag & REPEAT) {
      let repeat = buf.readUInt8(p);
      p += 1;
      while (repeat > 0 && i < numPoints) {
        flags[i] = flag;
        i += 1;
        repeat -= 1;
      }
    }
  }

  // X ve Y ayrı ayrı, artımlı (delta) kodlanır.
  const xs = new Int16Array(numPoints);
  let x = 0;
  for (let i = 0; i < numPoints; i += 1) {
    const flag = flags[i];
    if (flag & X_SHORT) {
      const d = buf.readUInt8(p);
      p += 1;
      x += flag & X_SAME_OR_POSITIVE ? d : -d;
    } else if (!(flag & X_SAME_OR_POSITIVE)) {
      x += buf.readInt16BE(p);
      p += 2;
    }
    xs[i] = x;
  }
  const ys = new Int16Array(numPoints);
  let y = 0;
  for (let i = 0; i < numPoints; i += 1) {
    const flag = flags[i];
    if (flag & Y_SHORT) {
      const d = buf.readUInt8(p);
      p += 1;
      y += flag & Y_SAME_OR_POSITIVE ? d : -d;
    } else if (!(flag & Y_SAME_OR_POSITIVE)) {
      y += buf.readInt16BE(p);
      p += 2;
    }
    ys[i] = y;
  }

  const contours = [];
  let startPt = 0;
  for (const endPt of endPts) {
    const contour = [];
    for (let i = startPt; i <= endPt; i += 1) {
      contour.push({ x: xs[i], y: ys[i], onCurve: Boolean(flags[i] & ON_CURVE) });
    }
    if (contour.length) contours.push(contour);
    startPt = endPt + 1;
  }
  return { contours, bbox };
}

const ARG_1_AND_2_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

/** Bileşik glyph: alt glyph'leri dönüştürüp birleştirir. */
function readComposite(buf, tables, loca, offset, depth) {
  let p = offset;
  const contours = [];
  for (;;) {
    const flags = buf.readUInt16BE(p);
    const glyphIndex = buf.readUInt16BE(p + 2);
    p += 4;

    let dx = 0;
    let dy = 0;
    if (flags & ARG_1_AND_2_ARE_WORDS) {
      dx = buf.readInt16BE(p);
      dy = buf.readInt16BE(p + 2);
      p += 4;
    } else {
      dx = buf.readInt8(p);
      dy = buf.readInt8(p + 1);
      p += 2;
    }
    // Noktaya hizalama (ARGS_ARE_XY_VALUES yoksa) harita metninde kullanılmıyor.
    if (!(flags & ARGS_ARE_XY_VALUES)) {
      dx = 0;
      dy = 0;
    }

    let a = 1;
    let b = 0;
    let c = 0;
    let d = 1;
    const f2dot14 = (v) => v / 16384;
    if (flags & WE_HAVE_A_SCALE) {
      a = d = f2dot14(buf.readInt16BE(p));
      p += 2;
    } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
      a = f2dot14(buf.readInt16BE(p));
      d = f2dot14(buf.readInt16BE(p + 2));
      p += 4;
    } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
      a = f2dot14(buf.readInt16BE(p));
      b = f2dot14(buf.readInt16BE(p + 2));
      c = f2dot14(buf.readInt16BE(p + 4));
      d = f2dot14(buf.readInt16BE(p + 6));
      p += 8;
    }

    const sub = readGlyph(buf, tables, loca, glyphIndex, depth + 1);
    for (const contour of sub.contours) {
      contours.push(
        contour.map((pt) => ({
          x: a * pt.x + c * pt.y + dx,
          y: b * pt.x + d * pt.y + dy,
          onCurve: pt.onCurve,
        })),
      );
    }
    if (!(flags & MORE_COMPONENTS)) break;
  }
  return contours;
}

/** Yazı tipini tek seferde okuyup sorgulanabilir bir nesne döner. */
export function parseFont(buf) {
  const tables = readTables(buf);
  const head = readHead(buf, tables);
  const numGlyphs = readNumGlyphs(buf, tables);
  const loca = readLoca(buf, tables, numGlyphs, head.indexToLocFormat);
  const cmap = readCmap(buf, tables);
  const widths = readHmtx(buf, tables, numGlyphs);
  return {
    unitsPerEm: head.unitsPerEm,
    numGlyphs,
    cmap,
    /** Kod noktası için glyph kimliği (yoksa 0 = .notdef). */
    gidFor: (codePoint) => cmap.get(codePoint) ?? 0,
    advanceOf: (gid) => widths[gid] ?? 0,
    glyphOf: (gid) => readGlyph(buf, tables, loca, gid),
  };
}
