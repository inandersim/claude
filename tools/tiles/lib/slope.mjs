/**
 * Eğim açısı sınıfları — DEM ızgarasından.
 *
 * Kışın dağda hayat kurtaran katman budur: çığların ezici çoğunluğu **30–45°**
 * arası yamaçlarda tetiklenir. Ücretsiz uygulamalarda neredeyse hiç bulunmaz;
 * bulunduğu yerlerde (FATMAP, Gaia'nın ücretli katmanı) ana satış argümanıdır.
 *
 * Eğim, Horn (1981) yöntemiyle 3×3 komşulukta hesaplanır — ArcGIS ve GDAL'ın
 * varsayılanı; tek hücrelik gürültüye merkezi farklardan daha dayanıklıdır.
 *
 * Çıktı, hücre başına poligon **değildir**: aynı sınıftaki komşu hücreler önce
 * satır içinde, sonra satırlar arasında birleştirilir. 500×500'lük bir ızgarada
 * bu, yüz binlerce poligonu birkaç bine indirir — karo boyutu ve çizim başarımı
 * arasındaki fark budur.
 */
import { cellCoord, metersPerDegLon, sample } from './dem.mjs';

/**
 * Çığ değerlendirmesinde kullanılan standart eğim bantları.
 * Eşikler Avrupa çığ bültenlerinin (EAWS) ve İsviçre SLF'nin kullandığı sınırlar.
 */
export const SLOPE_BANDS = [
  { id: 'moderate', min: 27, max: 30, label: '27–30°' },
  { id: 'considerable', min: 30, max: 35, label: '30–35°' },
  { id: 'high', min: 35, max: 40, label: '35–40°' },
  { id: 'very_high', min: 40, max: 45, label: '40–45°' },
  { id: 'extreme', min: 45, max: 90, label: '45°+' },
];

/** Bir açı hangi banda düşer? Bandların dışındaysa `null`. */
export function bandOf(angle) {
  for (const band of SLOPE_BANDS) {
    if (angle >= band.min && angle < band.max) return band;
  }
  return null;
}

/**
 * Horn yöntemiyle eğim açısı (derece).
 *
 * @param {object} dem
 * @returns {{cols:number,rows:number,values:Float32Array}} eğim ızgarası
 */
export function slopeGrid(dem) {
  const { cols, rows } = dem;
  const values = new Float32Array(cols * rows);

  // Hücre boyutları metre cinsinden; boylam yönü enlemde daralır.
  const midLat = (dem.bbox[1] + dem.bbox[3]) / 2;
  const cellX = dem.stepLon * metersPerDegLon(midLat);
  const cellY = dem.stepLat * 111_320;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = sample(dem, col - 1, row - 1);
      const b = sample(dem, col, row - 1);
      const c = sample(dem, col + 1, row - 1);
      const d = sample(dem, col - 1, row);
      const f = sample(dem, col + 1, row);
      const g = sample(dem, col - 1, row + 1);
      const h = sample(dem, col, row + 1);
      const i = sample(dem, col + 1, row + 1);

      const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cellX);
      const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * cellY);
      values[row * cols + col] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    }
  }
  return { cols, rows, values };
}

/**
 * Aynı sınıftaki komşu hücreleri dikdörtgenlere indirger.
 *
 * Önce her satırda yatay koşular bulunur, sonra bir alt satırda **aynı sütun
 * aralığına ve aynı sınıfa** sahip koşu varsa dikdörtgen aşağı uzatılır. Basit
 * ama etkili: düz yamaçlar tek bir dikdörtgene iner.
 *
 * @param {(col:number,row:number)=>string|null} classOf
 * @returns {{band:string, col:number, row:number, width:number, height:number}[]}
 */
export function mergeCells(cols, rows, classOf) {
  /** @type {{band:string,col:number,row:number,width:number,height:number}[]} */
  const rects = [];
  /** Açık dikdörtgenler: anahtar `band:col:width` */
  let acik = new Map();

  for (let row = 0; row < rows; row += 1) {
    const satirKosulari = new Map();
    let col = 0;
    while (col < cols) {
      const band = classOf(col, row);
      if (band === null) {
        col += 1;
        continue;
      }
      let width = 1;
      while (col + width < cols && classOf(col + width, row) === band) width += 1;
      satirKosulari.set(`${band}:${col}:${width}`, { band, col, width });
      col += width;
    }

    const yeniAcik = new Map();
    for (const [k, kosu] of satirKosulari) {
      const onceki = acik.get(k);
      if (onceki) {
        onceki.height += 1;
        yeniAcik.set(k, onceki);
      } else {
        yeniAcik.set(k, { ...kosu, row, height: 1 });
      }
    }
    // Bu satırda devam etmeyen dikdörtgenler kapanır.
    for (const [k, rect] of acik) if (!yeniAcik.has(k)) rects.push(rect);
    acik = yeniAcik;
  }
  for (const rect of acik.values()) rects.push(rect);
  return rects;
}

/**
 * Eğim sınıflarını GeoJSON poligonlarına çevirir.
 *
 * @param {object} dem
 * @param {{ bands?: typeof SLOPE_BANDS }} [options]
 */
export function slopeGeoJson(dem, options = {}) {
  const { bands = SLOPE_BANDS } = options;
  const slope = slopeGrid(dem);
  const byId = new Map(bands.map((b) => [b.id, b]));

  const classOf = (col, row) => {
    const angle = slope.values[row * slope.cols + col];
    const band = bandOf(angle);
    return band && byId.has(band.id) ? band.id : null;
  };

  const rects = mergeCells(slope.cols, slope.rows, classOf);
  const features = rects.map((rect) => {
    // Hücre merkezleri ızgara noktalarıdır; poligon köşeleri yarım hücre dışarı
    // taşınır ki komşu dikdörtgenler arasında boşluk kalmasın.
    const kuzeyBati = cellCoord(dem, rect.col - 0.5, rect.row - 0.5);
    const guneyDogu = cellCoord(dem, rect.col + rect.width - 0.5, rect.row + rect.height - 0.5);
    const x1 = Number(kuzeyBati.longitude.toFixed(6));
    const y1 = Number(kuzeyBati.latitude.toFixed(6));
    const x2 = Number(guneyDogu.longitude.toFixed(6));
    const y2 = Number(guneyDogu.latitude.toFixed(6));
    const band = byId.get(rect.band);
    return {
      type: 'Feature',
      properties: { band: rect.band, minAngle: band.min, maxAngle: band.max, label: band.label },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ],
        ],
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

/** Bant başına kaç hücre — rapor ve akıl sağlığı kontrolü için. */
export function slopeStats(dem) {
  const slope = slopeGrid(dem);
  const counts = Object.fromEntries(SLOPE_BANDS.map((b) => [b.id, 0]));
  let flat = 0;
  let max = 0;
  for (const angle of slope.values) {
    if (angle > max) max = angle;
    const band = bandOf(angle);
    if (band) counts[band.id] += 1;
    else flat += 1;
  }
  return { counts, belowBands: flat, maxAngle: Number(max.toFixed(1)) };
}
