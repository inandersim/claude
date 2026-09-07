/**
 * Eşyükselti eğrileri — DEM ızgarasından marching squares ile.
 *
 * Topografik haritayı topografik yapan şey budur: stil dosyasında `contour-line`
 * katmanı vardı ama hat hiç eşyükselti üretmiyordu, yani katman boştu.
 *
 * Yöntem: her ızgara hücresinin dört köşesi eşik değerinin altında mı üstünde mi
 * diye işaretlenir (16 durum), kenarlerdeki geçiş noktaları doğrusal
 * interpolasyonla bulunur ve kısa parçalar uç uca eklenerek çizgiye dönüştürülür.
 *
 * Belirsiz durumlar (5 ve 10 — köşegen ikilik) hücre ortalamasına göre çözülür;
 * aksi hâlde sırtlar ve vadiler yanlış bağlanır ve eğriler birbirini keser.
 */
import { cellCoord, sample } from './dem.mjs';

/** Eşiğe göre iki köşe arasındaki geçiş noktasının oranı (0..1). */
function lerp(a, b, level) {
  const d = b - a;
  if (Math.abs(d) < 1e-9) return 0.5;
  return (level - a) / d;
}

/**
 * Tek bir eşik için hücre parçalarını üretir.
 * Dönen her parça `[[x1,y1],[x2,y2]]` biçiminde ızgara koordinatındadır
 * (col/row kesirli); coğrafi dönüşüm sonra yapılır.
 */
function cellSegments(tl, tr, br, bl, level, col, row) {
  // Köşe sırası: sol-üst(8) · sağ-üst(4) · sağ-alt(2) · sol-alt(1)
  let idx = 0;
  if (tl >= level) idx |= 8;
  if (tr >= level) idx |= 4;
  if (br >= level) idx |= 2;
  if (bl >= level) idx |= 1;
  if (idx === 0 || idx === 15) return [];

  // Kenar üzerindeki geçiş noktaları (ızgara koordinatı)
  const top = [col + lerp(tl, tr, level), row];
  const right = [col + 1, row + lerp(tr, br, level)];
  const bottom = [col + lerp(bl, br, level), row + 1];
  const left = [col, row + lerp(tl, bl, level)];

  switch (idx) {
    case 1:
    case 14:
      return [[left, bottom]];
    case 2:
    case 13:
      return [[bottom, right]];
    case 3:
    case 12:
      return [[left, right]];
    case 4:
    case 11:
      return [[top, right]];
    case 6:
    case 9:
      return [[top, bottom]];
    case 7:
    case 8:
      return [[left, top]];
    case 5:
    case 10: {
      // Köşegen belirsizlik: hücre ortalaması eşiğin üstündeyse köşeler bağlıdır.
      const center = (tl + tr + br + bl) / 4;
      const connected = center >= level;
      if (idx === 5) {
        return connected
          ? [
              [left, top],
              [bottom, right],
            ]
          : [
              [left, bottom],
              [top, right],
            ];
      }
      return connected
        ? [
            [top, right],
            [left, bottom],
          ]
        : [
            [left, top],
            [bottom, right],
          ];
    }
    default:
      return [];
  }
}

const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;

/**
 * Kopuk parçaları uç uca ekleyerek çizgilere dönüştürür.
 * Kapalı halkalar da (tepe çevresi) doğal olarak oluşur.
 */
export function stitch(segments) {
  const uc = new Map();
  const push = (k, seg) => {
    const list = uc.get(k);
    if (list) list.push(seg);
    else uc.set(k, [seg]);
  };
  for (const seg of segments) {
    push(key(seg[0]), seg);
    push(key(seg[1]), seg);
  }

  const kullanildi = new Set();
  const lines = [];

  const komsu = (nokta, hariç) => {
    for (const seg of uc.get(key(nokta)) ?? []) {
      if (kullanildi.has(seg) || seg === hariç) continue;
      return seg;
    }
    return null;
  };

  for (const seg of segments) {
    if (kullanildi.has(seg)) continue;
    kullanildi.add(seg);
    const line = [seg[0], seg[1]];

    // İleri doğru büyüt
    let ucNokta = seg[1];
    for (;;) {
      const next = komsu(ucNokta, null);
      if (!next) break;
      kullanildi.add(next);
      const other = key(next[0]) === key(ucNokta) ? next[1] : next[0];
      line.push(other);
      ucNokta = other;
      if (key(ucNokta) === key(line[0])) break; // halka kapandı
    }

    // Geriye doğru büyüt (halka kapanmadıysa)
    if (key(line[0]) !== key(line[line.length - 1])) {
      let basNokta = seg[0];
      for (;;) {
        const prev = komsu(basNokta, null);
        if (!prev) break;
        kullanildi.add(prev);
        const other = key(prev[0]) === key(basNokta) ? prev[1] : prev[0];
        line.unshift(other);
        basNokta = other;
        if (key(basNokta) === key(line[line.length - 1])) break;
      }
    }

    if (line.length >= 2) lines.push(line);
  }
  return lines;
}

/**
 * Eşyükselti seviyelerini üretir.
 *
 * @param {{minElevationM:number,maxElevationM:number}} range
 * @param {number} interval eşyükselti aralığı (metre)
 */
export function levelsFor(range, interval) {
  const first = Math.ceil(range.minElevationM / interval) * interval;
  const levels = [];
  for (let v = first; v <= range.maxElevationM; v += interval) levels.push(v);
  return levels;
}

/**
 * DEM'den eşyükselti eğrisi GeoJSON'u üretir.
 *
 * @param {{cols:number,rows:number,values:number[],bbox:number[],stepLon:number,stepLat:number}} dem
 * @param {{ interval?: number, indexEvery?: number, minPoints?: number }} [options]
 * @returns {{type:'FeatureCollection', features: object[]}}
 */
export function contourGeoJson(dem, options = {}) {
  const {
    // 20 m, 1:25.000 topografik haritaların yaygın aralığı; Türkiye'nin dağlık
    // bölgelerinde okunabilir kalıyor.
    interval = 20,
    // Her 5. eğri kalın çizilir ve etiketlenir (100 m'de bir).
    indexEvery = 5,
    // İki noktalı kırıntılar haritada gürültü; atılır.
    minPoints = 3,
  } = options;

  let min = Infinity;
  let max = -Infinity;
  for (const v of dem.values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return { type: 'FeatureCollection', features: [] };

  const levels = levelsFor({ minElevationM: min, maxElevationM: max }, interval);
  const features = [];

  for (const level of levels) {
    const segments = [];
    for (let row = 0; row < dem.rows - 1; row += 1) {
      for (let col = 0; col < dem.cols - 1; col += 1) {
        const tl = sample(dem, col, row);
        const tr = sample(dem, col + 1, row);
        const br = sample(dem, col + 1, row + 1);
        const bl = sample(dem, col, row + 1);
        segments.push(...cellSegments(tl, tr, br, bl, level, col, row));
      }
    }
    for (const line of stitch(segments)) {
      if (line.length < minPoints) continue;
      const coordinates = line.map(([c, r]) => {
        const p = cellCoord(dem, c, r);
        return [Number(p.longitude.toFixed(6)), Number(p.latitude.toFixed(6))];
      });
      features.push({
        type: 'Feature',
        properties: {
          ele: level,
          // Stil bu alana bakarak kalın/ince ve etiketli/etiketsiz ayrımı yapar.
          index: level % (interval * indexEvery) === 0 ? 1 : 0,
        },
        geometry: { type: 'LineString', coordinates },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}
