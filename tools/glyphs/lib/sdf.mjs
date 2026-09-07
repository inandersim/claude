/**
 * Glyph anahatlarından işaretli mesafe alanı (SDF).
 *
 * MapLibre metni tek bir alfa dokusundan çizer: her piksel, glyph kenarına olan
 * **işaretli uzaklığı** taşır. Böylece aynı doku her punto ve her açıda keskin
 * kalır, kenar yumuşatma ve halka (halo) parametrik olur.
 *
 * Yöntem:
 *   1. Anahatlar piksel uzayına ölçeklenir, eğriler doğru parçalarına bölünür.
 *   2. Tarama çizgisiyle (nonzero sarım kuralı) örtü (coverage) haritası çıkar;
 *      kenar yumuşatma için satır başına 4 alt örnek alınır.
 *   3. Örtüden içeri ve dışarı iki ayrı **kesin** öklit mesafe dönüşümü
 *      (Felzenszwalb 2012, iki geçişli) hesaplanır ve fark alınır.
 *   4. Uzaklık MapLibre'nin beklediği aralığa eşlenir (TinySDF ile aynı formül).
 *
 * Sabitler MapLibre'nin glyph sözleşmesiyle aynı olmak zorunda: 24 piksel em,
 * 3 piksel çerçeve, 8 piksel yarıçap. Farklı olursa metin ya bulanık ya kesik
 * çıkar — çökme olmaz, sessizce çirkinleşir.
 */

/** Em kutusunun piksel karşılığı (MapLibre standardı). */
export const GLYPH_SIZE = 24;
/** Her glyph'in çevresindeki boşluk; halka ve kenar yumuşatma buraya taşar. */
export const GLYPH_BUFFER = 3;
/** SDF'in ölçebildiği en uzak mesafe (piksel). */
export const SDF_RADIUS = 8;
/** Kenarın alfa değeri: 255 * (1 - cutoff) = 192. */
export const SDF_CUTOFF = 0.25;

const INF = 1e20;

/**
 * Kuadratik Bézier eğrisini doğru parçalarına böler.
 * TrueType yalnızca kuadratik kullanır; kübik ayrıştırmaya gerek yok.
 */
function flattenQuadratic(out, p0, c, p1, steps) {
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    });
  }
}

/**
 * TrueType konturunu düz çokgene çevirir.
 *
 * TrueType'ta iki eğri-üstü nokta arka arkaya gelirse aralarında **örtük** bir
 * eğri-üstü nokta vardır (orta nokta). Bu kural atlanırsa harfler köşeli çıkar.
 */
export function flattenContour(contour, steps = 6) {
  if (contour.length === 0) return [];
  const pts = [];

  // Başlangıç noktası eğri üstünde olmalı; değilse örtük orta noktadan başla.
  let start = contour.findIndex((p) => p.onCurve);
  let first;
  if (start === -1) {
    first = {
      x: (contour[0].x + contour[contour.length - 1].x) / 2,
      y: (contour[0].y + contour[contour.length - 1].y) / 2,
    };
    start = 0;
  } else {
    first = { x: contour[start].x, y: contour[start].y };
    start += 1;
  }

  pts.push(first);
  let current = first;
  let control = null;
  const n = contour.length;

  for (let k = 0; k < n; k += 1) {
    const pt = contour[(start + k) % n];
    if (pt.onCurve) {
      if (control) {
        flattenQuadratic(pts, current, control, pt, steps);
        control = null;
      } else {
        pts.push({ x: pt.x, y: pt.y });
      }
      current = { x: pt.x, y: pt.y };
    } else if (control) {
      // İki denetim noktası art arda: aralarındaki orta nokta örtük eğri üstüdür.
      const mid = { x: (control.x + pt.x) / 2, y: (control.y + pt.y) / 2 };
      flattenQuadratic(pts, current, control, mid, steps);
      current = mid;
      control = { x: pt.x, y: pt.y };
    } else {
      control = { x: pt.x, y: pt.y };
    }
  }
  // Konturu kapat.
  if (control) flattenQuadratic(pts, current, control, first, steps);
  else pts.push(first);
  return pts;
}

/**
 * Çokgenleri örtü haritasına çevirir (nonzero sarım kuralı).
 *
 * Satır başına `samples` alt tarama yapılır; bir pikselin örtüsü, o pikseli
 * kesen alt taramaların oranıdır. Analitik örtü daha keskin olurdu ama bu
 * ölçekte (24 piksel em) fark görünmüyor ve kod üçte biri kadar.
 */
export function rasterize(polygons, width, height, samples = 4) {
  const coverage = new Float32Array(width * height);
  if (width <= 0 || height <= 0) return coverage;

  const kenarlar = [];
  for (const poly of polygons) {
    for (let i = 0; i < poly.length - 1; i += 1) {
      const a = poly[i];
      const b = poly[i + 1];
      if (a.y !== b.y) kenarlar.push({ a, b });
    }
  }
  if (!kenarlar.length) return coverage;

  const kesisimler = [];
  for (let py = 0; py < height; py += 1) {
    for (let s = 0; s < samples; s += 1) {
      const y = py + (s + 0.5) / samples;
      kesisimler.length = 0;
      for (const { a, b } of kenarlar) {
        const alt = Math.min(a.y, b.y);
        const ust = Math.max(a.y, b.y);
        if (y < alt || y >= ust) continue;
        const t = (y - a.y) / (b.y - a.y);
        kesisimler.push({ x: a.x + t * (b.x - a.x), yon: b.y > a.y ? 1 : -1 });
      }
      if (kesisimler.length < 2) continue;
      kesisimler.sort((p, q) => p.x - q.x);

      let sarim = 0;
      for (let i = 0; i < kesisimler.length - 1; i += 1) {
        sarim += kesisimler[i].yon;
        if (sarim === 0) continue;
        // Bu aralık dolgu içinde: kesişen piksellere kısmi örtü ekle.
        const x0 = kesisimler[i].x;
        const x1 = kesisimler[i + 1].x;
        const ilk = Math.max(0, Math.floor(x0));
        const son = Math.min(width - 1, Math.ceil(x1) - 1);
        for (let px = ilk; px <= son; px += 1) {
          const kesisim = Math.min(px + 1, x1) - Math.max(px, x0);
          if (kesisim > 0) coverage[py * width + px] += kesisim / samples;
        }
      }
    }
  }
  for (let i = 0; i < coverage.length; i += 1) coverage[i] = Math.min(1, coverage[i]);
  return coverage;
}

/**
 * Tek boyutta kesin öklit mesafe dönüşümü (Felzenszwalb & Huttenlocher, 2012).
 * `f` karesel mesafeleri taşır; yerinde güncellenir.
 */
function edt1d(f, d, v, z, n) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  let k = 0;
  for (let q = 1; q < n; q += 1) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const dist = q - v[k];
    d[q] = dist * dist + f[v[k]];
  }
}

/** İki boyutlu karesel mesafe dönüşümü (satır sonra sütun). */
export function edt(data, width, height) {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = data[y * width + x];
    edt1d(f, d, v, z, height);
    for (let y = 0; y < height; y += 1) data[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) f[x] = data[y * width + x];
    edt1d(f, d, v, z, width);
    for (let x = 0; x < width; x += 1) data[y * width + x] = d[x];
  }
  return data;
}

/**
 * Bir glyph'i SDF bitmap'ine ve MapLibre ölçülerine çevirir.
 *
 * @param {{contours: {x:number,y:number,onCurve:boolean}[][]}} glyph
 * @param {{ unitsPerEm:number, advance:number, size?:number, buffer?:number, radius?:number }} options
 * @returns {{ width:number, height:number, left:number, top:number, advance:number, bitmap:Uint8Array }}
 */
export function glyphToSdf(glyph, options) {
  const {
    unitsPerEm,
    advance,
    size = GLYPH_SIZE,
    buffer = GLYPH_BUFFER,
    radius = SDF_RADIUS,
    cutoff = SDF_CUTOFF,
  } = options;
  const scale = size / unitsPerEm;
  const advancePx = Math.round(advance * scale);

  const polygons = glyph.contours
    .map((c) => flattenContour(c))
    .filter((p) => p.length > 2)
    .map((p) => p.map((pt) => ({ x: pt.x * scale, y: pt.y * scale })));

  if (!polygons.length) {
    // Boşluk gibi çizimi olmayan glyph: ölçü var, bitmap yok.
    return { width: 0, height: 0, left: 0, top: 0, advance: advancePx, bitmap: new Uint8Array(0) };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const left = Math.floor(minX);
  const top = Math.ceil(maxY);
  const glyphWidth = Math.ceil(maxX) - left;
  const glyphHeight = top - Math.floor(minY);

  const w = glyphWidth + 2 * buffer;
  const h = glyphHeight + 2 * buffer;

  // Piksel uzayına taşı ve y'yi ters çevir (bitmap'te satır 0 üsttedir).
  const yerlesik = polygons.map((poly) =>
    poly.map((p) => ({ x: p.x - left + buffer, y: top - p.y + buffer })),
  );

  const coverage = rasterize(yerlesik, w, h);

  // TinySDF ile aynı kurulum: kenar pikselinde örtü 0.5'e ne kadar yakınsa
  // mesafe o kadar küçük olur; böylece kenar alt piksel doğrulukta çıkar.
  const gridOuter = new Float64Array(w * h);
  const gridInner = new Float64Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const a = coverage[i];
    if (a === 0) {
      gridOuter[i] = INF;
      gridInner[i] = 0;
    } else if (a === 1) {
      gridOuter[i] = 0;
      gridInner[i] = INF;
    } else {
      const d = 0.5 - a;
      gridOuter[i] = d > 0 ? d * d : 0;
      gridInner[i] = d < 0 ? d * d : 0;
    }
  }
  edt(gridOuter, w, h);
  edt(gridInner, w, h);

  const bitmap = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
    bitmap[i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / radius + cutoff))));
  }

  return { width: glyphWidth, height: glyphHeight, left, top, advance: advancePx, bitmap };
}
