/**
 * Sayısal yükseklik modeli (DEM) ızgarası.
 *
 * Bir sınır kutusu için düzenli bir yükseklik ızgarası üretir; eşyükselti
 * eğrileri (`contour.mjs`) ve eğim sınıfları (`slope.mjs`) bunun üzerine kurulur.
 *
 * Kaynak `elevation.mjs` üzerinden Open-Meteo (Copernicus DEM GLO-90) — yani
 * uygulamadaki yüksekliklerle **aynı** kaynak; iki ayrı DEM kullanmak, rota
 * profili ile haritadaki eşyükseltilerin çelişmesi demekti.
 *
 * Izgara diske önbelleklenir: aynı bölge yeniden derlendiğinde binlerce API
 * çağrısı tekrarlanmaz. Önbellek anahtarı sınır kutusu + adım açıklığıdır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { fetchElevations } from './elevation.mjs';

/** Enlem derecesi başına yaklaşık metre (küresel yaklaşım — ızgara adımı için yeterli). */
const METERS_PER_DEG_LAT = 111_320;

/** Boylam derecesi başına metre, enleme bağlı olarak daralır. */
export function metersPerDegLon(latitude) {
  return METERS_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
}

/**
 * Sınır kutusu için ızgara geometrisi (veri çekmeden).
 *
 * @param {[number,number,number,number]} bbox [minLon, minLat, maxLon, maxLat]
 * @param {number} stepM hedef hücre boyu (metre)
 */
export function gridGeometry(bbox, stepM) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (!(maxLon > minLon && maxLat > minLat)) throw new Error('Geçersiz sınır kutusu');
  if (!(stepM > 0)) throw new Error('Adım pozitif olmalı');

  const midLat = (minLat + maxLat) / 2;
  const stepLat = stepM / METERS_PER_DEG_LAT;
  // Boylam adımı enlemde daralır; hücreler yeryüzünde yaklaşık kare kalsın diye
  // enleme göre düzeltilir. Düzeltmesiz ızgara kuzeyde çok sık örneklenir.
  const stepLon = stepM / Math.max(1, metersPerDegLon(midLat));

  const cols = Math.max(2, Math.round((maxLon - minLon) / stepLon) + 1);
  const rows = Math.max(2, Math.round((maxLat - minLat) / stepLat) + 1);
  return {
    bbox,
    cols,
    rows,
    // Gerçek adım, hücre sayısına yuvarlandıktan sonra yeniden hesaplanır ki
    // ızgara kutuyu tam kaplasın.
    stepLon: (maxLon - minLon) / (cols - 1),
    stepLat: (maxLat - minLat) / (rows - 1),
    count: cols * rows,
  };
}

/** Izgara hücresinin coğrafi koordinatı. Satır 0 = **kuzey** (üst). */
export function cellCoord(geometry, col, row) {
  const [minLon, , , maxLat] = geometry.bbox;
  return {
    longitude: minLon + col * geometry.stepLon,
    latitude: maxLat - row * geometry.stepLat,
  };
}

/** Izgaranın tüm noktaları, satır satır (kuzeyden güneye). */
export function gridPoints(geometry) {
  const points = [];
  for (let row = 0; row < geometry.rows; row += 1) {
    for (let col = 0; col < geometry.cols; col += 1) {
      points.push(cellCoord(geometry, col, row));
    }
  }
  return points;
}

/** `values[row * cols + col]` erişimi; sınır dışında en yakın hücreye kenetlenir. */
export function sample(dem, col, row) {
  const c = Math.min(dem.cols - 1, Math.max(0, col));
  const r = Math.min(dem.rows - 1, Math.max(0, row));
  return dem.values[r * dem.cols + c];
}

const cacheKey = (bbox, stepM) =>
  `dem-${bbox.map((v) => v.toFixed(4)).join('_')}-${Math.round(stepM)}m.json`;

/**
 * Izgarayı çeker (ya da önbellekten okur).
 *
 * @param {[number,number,number,number]} bbox
 * @param {{ stepM?: number, cacheDir?: string|null, fetchImpl?: typeof fetch,
 *           onProgress?: (done:number,total:number)=>void, maxPoints?: number }} [options]
 */
export async function buildDem(bbox, options = {}) {
  const {
    stepM = 90,
    cacheDir = null,
    fetchImpl = fetch,
    onProgress,
    // Kaza freni: yanlış bir sınır kutusu yüz binlerce istek üretebilir.
    maxPoints = 250_000,
  } = options;

  const geometry = gridGeometry(bbox, stepM);
  if (geometry.count > maxPoints) {
    throw new Error(
      `Izgara çok büyük: ${geometry.count} nokta (üst sınır ${maxPoints}). ` +
        `Daha büyük --dem-step ya da daha küçük bölge kullan.`,
    );
  }

  const cachePath = cacheDir ? join(cacheDir, cacheKey(bbox, stepM)) : null;
  if (cachePath && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (cached.cols === geometry.cols && cached.rows === geometry.rows) {
      return { ...geometry, values: cached.values, cached: true };
    }
  }

  const values = await fetchElevations(gridPoints(geometry), { fetchImpl, onProgress });

  if (cachePath) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ bbox, stepM, cols: geometry.cols, rows: geometry.rows, values }),
      'utf8',
    );
  }
  return { ...geometry, values, cached: false };
}

/** Izgara istatistikleri — raporlama ve akıl sağlığı kontrolü için. */
export function demStats(dem) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of dem.values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const n = dem.values.length;
  return {
    cols: dem.cols,
    rows: dem.rows,
    minElevationM: Number.isFinite(min) ? min : 0,
    maxElevationM: Number.isFinite(max) ? max : 0,
    meanElevationM: n ? Math.round(sum / n) : 0,
  };
}
