/**
 * Asgari PNG kodlayıcı — bağımlılıksız, `node:zlib` üzerine.
 *
 * Yalnızca ihtiyacımız olanı yazar: 8 bit renk derinliğinde RGB (renk tipi 2),
 * aralıksız (interlace yok), tek IDAT. Terrain-RGB karoları tam olarak budur;
 * genel amaçlı bir PNG kütüphanesi eklemek, bu iş için 40 satırlık kodu 1 MB'lık
 * bağımlılıkla değiştirmek olurdu.
 *
 * Biçim: https://www.w3.org/TR/png/
 *   8 baytlık imza · IHDR · IDAT · IEND; her yığın uzunluk+tip+veri+CRC32.
 */
import { deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG'nin CRC32 tablosu (IEEE 802.3 polinomu). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Uzunluk + tip + veri + CRC yapısındaki tek bir PNG yığını. */
export function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * RGB piksel dizisini PNG'ye çevirir.
 *
 * @param {Uint8Array} rgb `width * height * 3` uzunluğunda, satır satır
 * @param {number} width
 * @param {number} height
 * @param {{ level?: number }} [options] deflate seviyesi (varsayılan 9 — karolar
 *   bir kez üretilip çok kez indirileceği için en yüksek sıkıştırma tercih edilir)
 */
export function encodePng(rgb, width, height, options = {}) {
  const { level = 9 } = options;
  if (rgb.length !== width * height * 3) {
    throw new Error(`Piksel dizisi ${width}×${height}×3 = ${width * height * 3} olmalı, ${rgb.length} geldi`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit derinliği
  ihdr.writeUInt8(2, 9); // renk tipi: truecolor (RGB)
  ihdr.writeUInt8(0, 10); // sıkıştırma: deflate
  ihdr.writeUInt8(0, 11); // filtre yöntemi: adaptif
  ihdr.writeUInt8(0, 12); // interlace yok

  // Her satırın başına filtre baytı gelir. Terrain-RGB'de komşu pikseller
  // birbirine yakın olduğu için `Sub` (1) filtresi düz `None`dan belirgin
  // biçimde daha iyi sıkışır; satırlar arası fark ise düşey yönde de büyük
  // olabildiğinden `Up` yerine `Sub` seçildi.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dst = y * (stride + 1);
    raw[dst] = 1; // Sub
    const src = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 3 ? rgb[src + x - 3] : 0;
      raw[dst + 1 + x] = (rgb[src + x] - left) & 0xff;
    }
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Kodlanmış PNG'nin başlığını okur — testler ve akıl sağlığı kontrolü için. */
export function readPngHeader(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG imzası yok');
  const type = buf.toString('ascii', 12, 16);
  if (type !== 'IHDR') throw new Error(`İlk yığın IHDR değil: ${type}`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
  };
}
