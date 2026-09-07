#!/usr/bin/env node
/**
 * TTF → MapLibre SDF glyph paketi.
 *
 *   node tools/glyphs/build-glyphs.mjs
 *   node tools/glyphs/build-glyphs.mjs --font <yol.ttf> --name "Zirtan Regular"
 *   node tools/glyphs/build-glyphs.mjs --ranges 0-255,256-511
 *
 * Çıktı: `public/glyphs/<yığın adı>/<başlangıç>-<bitiş>.pbf`
 *
 * `public/` seçildi çünkü Expo web derlemesi bu klasörü olduğu gibi çıktıya
 * kopyalar; glyph'ler `{fontstack}/{range}.pbf` şablonuyla **çalışma anında**
 * istenir, bu yüzden paketleyicinin varlık sistemine giremezler — gerçek bir
 * yol gerekiyor.
 *
 * Neden gerekli: harita stilinde `glyphs` tanımlı olmadığı sürece MapLibre
 * **hiç metin çizmez** — ne zirve adı, ne eşyükselti rakamı. Uzak bir glyph
 * sunucusuna bağlanmak çevrimdışı çalışmayı bozardı, bu yüzden glyph'ler
 * uygulamayla birlikte gelir.
 *
 * Varsayılan aralık, Türkçe ve Batı Avrupa dilleri için yeterli olan ilk iki
 * bloktur: `ö ü ç Ö Ü Ç` 0–255 içinde, `ı ğ ş İ Ğ Ş` 256–511 içinde.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeGlyphPbf, encodeGlyphPbf } from './lib/glyph-pbf.mjs';
import { GLYPH_BUFFER, GLYPH_SIZE, glyphToSdf } from './lib/sdf.mjs';
import { parseFont } from './lib/ttf.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Varsayılan yazı tipi: uygulamanın kendi markası (Manrope). */
const DEFAULT_FONT = resolve(ROOT, 'admin/public/fonts/Manrope_600SemiBold.ttf');
/** Stildeki `text-font` ile birebir aynı olmak zorunda. */
export const DEFAULT_STACK = 'Zirtan SemiBold';
export const DEFAULT_RANGES = ['0-255', '256-511'];

/**
 * `"0-255"` → `{ start: 0, end: 255 }`.
 *
 * MapLibre glyph'leri **sabit 256'lık bloklar** hâlinde ister: 0-255, 256-511,
 * 512-767… Hizasız bir aralık (ör. 256-383) geçerli bir dosya üretir ama
 * MapLibre onu hiç istemez — metin sessizce eksik çıkar. Bu yüzden hizalama
 * burada zorunlu tutuluyor.
 */
export function parseRange(text) {
  const m = /^(\d+)-(\d+)$/.exec(text.trim());
  if (!m) throw new Error(`Geçersiz aralık: ${text} (örnek: 0-255)`);
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (start % 256 !== 0 || end !== start + 255) {
    throw new Error(
      `Aralık 256'lık bloğa hizalı olmalı: ${text} (geçerli: ${start - (start % 256)}-${start - (start % 256) + 255})`,
    );
  }
  return { start, end };
}

/**
 * Bir aralıktaki glyph'leri üretir.
 *
 * Yazı tipinde bulunmayan kod noktaları **atlanır** — `.notdef` (boş kutu)
 * yazmak, eksik karakteri haritada bir kutu olarak gösterirdi; atlanınca
 * MapLibre o karakteri hiç çizmez ve eksiklik daha az rahatsız eder.
 */
export function buildRange(font, range, options = {}) {
  const { size = GLYPH_SIZE, buffer = GLYPH_BUFFER } = options;
  const glyphs = [];
  for (let code = range.start; code <= range.end; code += 1) {
    const gid = font.gidFor(code);
    if (gid === 0) continue;
    const sdf = glyphToSdf(font.glyphOf(gid), {
      unitsPerEm: font.unitsPerEm,
      advance: font.advanceOf(gid),
      size,
      buffer,
    });
    glyphs.push({ id: code, ...sdf });
  }
  return glyphs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  const fontPath = resolve(opt('font', DEFAULT_FONT));
  const stackName = opt('name', DEFAULT_STACK);
  const ranges = opt('ranges', DEFAULT_RANGES.join(',')).split(',').map(parseRange);
  const outDir = resolve(opt('out', resolve(ROOT, 'public/glyphs')), stackName);

  const font = parseFont(readFileSync(fontPath));
  console.log(`→ ${fontPath}`);
  console.log(`  em ${font.unitsPerEm} · ${font.numGlyphs} glyph · cmap ${font.cmap.size} kayıt`);

  mkdirSync(outDir, { recursive: true });
  let toplam = 0;
  for (const range of ranges) {
    const glyphs = buildRange(font, range);
    const label = `${range.start}-${range.end}`;
    const pbf = encodeGlyphPbf(stackName, label, glyphs);

    // Yazmadan önce geri oku: bozuk bir glyph paketi haritada çökme değil,
    // sessizce boş metin üretir — hatayı burada yakalamak gerekiyor.
    const geri = decodeGlyphPbf(pbf);
    const stack = geri.stacks[0];
    if (!stack || stack.name !== stackName || stack.glyphs.length !== glyphs.length) {
      throw new Error(`${label} aralığı geri okunamadı — kodlama bozuk`);
    }

    const file = resolve(outDir, `${label}.pbf`);
    writeFileSync(file, pbf);
    toplam += glyphs.length;
    console.log(`  ${label}: ${glyphs.length} glyph · ${(pbf.length / 1024).toFixed(1)} KB · ${file}`);
  }
  console.log(`✓ ${toplam} glyph · yığın "${stackName}"`);
}
