/**
 * Terrain-RGB (terrarium) raster karoları — DEM ızgarasından.
 *
 * Tek bir DEM karo kümesi **iki** özelliği birden açar:
 *   · kabartma gölgelendirme (hillshade) — arazi kabartması, tek renkli haritada
 *     bile hangi yamacın dik olduğunu görünür kılar,
 *   · 3B arazi (MapLibre `terrain`) — kamera eğildiğinde gerçek yükseklik.
 *
 * Kodlama **terrarium**'dur (Mapzen/AWS Terrain Tiles biçimi):
 *
 *     yükseklik = (R * 256 + G + B / 256) - 32768
 *
 * MapLibre bunu `raster-dem` kaynağında `encoding: "terrarium"` ile okur.
 * Mapbox'ın kendi terrain-rgb biçimi yerine terrarium seçildi: açık biçim,
 * 1/256 m çözünürlük ve negatif yükseklikleri (Ölü Deniz, Hazar) doğal olarak
 * taşıyor.
 */
import { metersPerDegLon, sample } from './dem.mjs';
import { encodePng } from './png.mjs';

/** Terrarium referans noktası: 0 metre bu tamsayıya karşılık gelir. */
export const TERRARIUM_OFFSET = 32768;

/** Metreyi terrarium RGB üçlüsüne çevirir. */
export function encodeElevation(meters) {
  // 1/256 m adımına yuvarla, sonra tamsayıya kenetle.
  const v = Math.round((meters + TERRARIUM_OFFSET) * 256);
  const clamped = Math.min(0xffffff, Math.max(0, v));
  return [(clamped >> 16) & 0xff, (clamped >> 8) & 0xff, clamped & 0xff];
}

/** RGB üçlüsünü metreye geri çevirir (kodlamanın tersi — testler bunu doğrular). */
export function decodeElevation(r, g, b) {
  return r * 256 + g + b / 256 - TERRARIUM_OFFSET;
}

/* ------------------------------------------------------------------ */
/* Karo geometrisi (Web Mercator)                                      */
/* ------------------------------------------------------------------ */

export const tileToLon = (x, z) => (x / 2 ** z) * 360 - 180;
export const tileToLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
export const lonToTile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
export const latToTile = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  const n = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return Math.floor(((1 - n / Math.PI) / 2) * 2 ** z);
};

/**
 * DEM ızgarasından bir noktanın yüksekliğini **çift doğrusal** ara değerle okur.
 *
 * En yakın komşu yerine ara değer kullanılır: en yakın komşu, karo çözünürlüğü
 * ızgaradan yüksek olduğunda basamaklı bir yüzey üretir ve kabartma
 * gölgelendirmede satranç tahtası deseni olarak görünür.
 */
export function sampleBilinear(dem, longitude, latitude) {
  const [minLon, , , maxLat] = dem.bbox;
  const fx = (longitude - minLon) / dem.stepLon;
  const fy = (maxLat - latitude) / dem.stepLat;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = sample(dem, x0, y0);
  const v10 = sample(dem, x0 + 1, y0);
  const v01 = sample(dem, x0, y0 + 1);
  const v11 = sample(dem, x0 + 1, y0 + 1);
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

/**
 * Tek bir karonun piksellerini üretir.
 *
 * @param {object} dem
 * @param {number} z @param {number} x @param {number} y
 * @param {number} size karo kenarı (piksel)
 * @returns {Uint8Array} `size * size * 3`
 */
export function renderTile(dem, z, x, y, size = 256) {
  const rgb = new Uint8Array(size * size * 3);
  const lon0 = tileToLon(x, z);
  const lon1 = tileToLon(x + 1, z);
  const lat0 = tileToLat(y, z);
  const lat1 = tileToLat(y + 1, z);

  for (let py = 0; py < size; py += 1) {
    // Piksel merkezleri: yarım piksel içeri kaydırılır ki komşu karolar
    // sınırda aynı yüksekliği versin.
    const latitude = lat0 + ((py + 0.5) / size) * (lat1 - lat0);
    for (let px = 0; px < size; px += 1) {
      const longitude = lon0 + ((px + 0.5) / size) * (lon1 - lon0);
      const [r, g, b] = encodeElevation(sampleBilinear(dem, longitude, latitude));
      const i = (py * size + px) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return rgb;
}

/**
 * DEM'in kapsadığı alan için zum aralığındaki tüm karoları üretir.
 *
 * Üst sınır DEM çözünürlüğüne göre kendiliğinden belirlenir: ızgara adımından
 * daha ince karo üretmek yeni bilgi taşımaz, yalnızca dosyayı büyütür.
 *
 * @returns {Map<string, Buffer>} `"z/x/y"` → PNG
 */
export function buildTerrainTiles(dem, options = {}) {
  const { minzoom = 8, maxzoom = null, size = 256, onProgress } = options;
  const [minLon, minLat, maxLon, maxLat] = dem.bbox;

  // Izgara kaba olduğunda çözünürlük sınırı `minzoom`un altına düşebilir. O
  // durumda döngü hiç dönmez ve **sessizce boş** bir karo kümesi üretilirdi —
  // harita da sessizce düz görünürdü. Kenetlenir; üretilen karolar ara değerden
  // ibarettir ama en azından vardır ve `terrainRange` bunu açıkça söyler.
  const top = Math.max(minzoom, maxzoom ?? maxZoomFor(dem, size));
  const tiles = new Map();
  for (let z = minzoom; z <= top; z += 1) {
    const x0 = lonToTile(minLon, z);
    const x1 = lonToTile(maxLon, z);
    const y0 = latToTile(maxLat, z);
    const y1 = latToTile(minLat, z);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        tiles.set(`${z}/${x}/${y}`, encodePng(renderTile(dem, z, x, y, size), size, size));
        onProgress?.(tiles.size, z);
      }
    }
  }
  return tiles;
}

/**
 * Üretilecek zum aralığı ve DEM'in gerçekten bilgi taşıdığı üst sınır.
 * CLI bunu raporlar: "z12'ye kadar üretildi, veri z10'a kadar gerçek".
 */
export function terrainRange(dem, options = {}) {
  const { minzoom = 8, maxzoom = null, size = 256 } = options;
  const resolutionLimit = maxZoomFor(dem, size);
  const top = Math.max(minzoom, maxzoom ?? resolutionLimit);
  return {
    minzoom,
    maxzoom: top,
    resolutionLimit,
    // Üst zum, DEM'in taşıdığı bilginin ötesindeyse pikseller ara değerdir.
    interpolatedAbove: top > resolutionLimit ? resolutionLimit : null,
  };
}

/**
 * DEM çözünürlüğünün desteklediği en yüksek zum.
 *
 * Bir karo `size` piksel geniştir; o zumda bir pikselin yer üzerindeki karşılığı
 * ızgara adımının altına indiğinde artık ara değerden başka bir şey üretmiyoruz.
 */
export function maxZoomFor(dem, size = 256) {
  const midLat = (dem.bbox[1] + dem.bbox[3]) / 2;
  const stepM = dem.stepLon * metersPerDegLon(midLat);
  // z zumunda bir pikselin metre karşılığı: dünya çevresi / (2^z * size)
  const worldM = 40_075_016.686 * Math.cos((midLat * Math.PI) / 180);
  let z = 0;
  while (z < 16 && worldM / (2 ** (z + 1) * size) > stepM) z += 1;
  return z;
}
