/**
 * Saf JavaScript PMTiles v3 yazıcısı.
 *
 * `tippecanoe` + `go-pmtiles` ikilileri kurulamadığında (kapalı ağ, CI kabuğu)
 * aynı çıktıyı Node içinde üretir: GeoJSON → MVT karo (geojson-vt + vt-pbf) →
 * tek dosya PMTiles arşivi. Üretim hattında yine dış araçlar tercih edilir;
 * bu yazıcı küçük/orta bölgeler ve geliştirme için vardır.
 *
 * Biçim: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 *   127 baytlık başlık · kök dizin · JSON künye · yaprak dizinler · karo verisi
 */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

export const HEADER_BYTES = 127;
/** Kök dizin, arşivin ilk 16 KiB'ı içinde kalmalıdır (istemci tek istekte okur). */
export const ROOT_DIR_LIMIT = 16384;

const COMPRESSION_NONE = 1;
const COMPRESSION_GZIP = 2;
const TILE_TYPE_MVT = 1;
const TILE_TYPE_PNG = 2;

/**
 * Karo türleri. PNG zaten sıkıştırılmıştır; üstüne gzip uygulamak dosyayı
 * küçültmez ama her karo okumasına bir açma adımı ekler — bu yüzden raster
 * karolarda iç sıkıştırma kapalıdır (biçim belirtiminin de önerisi).
 */
export const TILE_TYPES = {
  mvt: { id: TILE_TYPE_MVT, compression: COMPRESSION_GZIP },
  png: { id: TILE_TYPE_PNG, compression: COMPRESSION_NONE },
};

/* ------------------------------------------------------------------ */
/* Varint + dizin serileştirme                                         */
/* ------------------------------------------------------------------ */

/** Değişken uzunluklu tamsayı (LEB128) ekler. */
export function writeVarint(out, value) {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
  return out;
}

/**
 * Hilbert eğrisi karo kimliği (z/x/y → tek sayı). PMTiles dizinleri bu sıraya
 * göre tutulur; komşu karolar dosyada da komşu olur, böylece Range istekleri azalır.
 */
export function zxyToTileId(z, x, y) {
  if (z > 26) throw new Error('Zum 26 üstü desteklenmiyor');
  if (x >= 2 ** z || y >= 2 ** z) throw new Error('x/y zum sınırının dışında');
  let acc = (2 ** z * 2 ** z - 1) / 3;
  let n = z - 1;
  let rx = x;
  let ry = y;
  for (let s = 1 << n; s > 0; s >>= 1) {
    const a = rx & s;
    const b = ry & s;
    acc += ((3 * a) ^ b) * (1 << n);
    [rx, ry] = rotate(s, rx, ry, a, b);
    n -= 1;
  }
  return acc;
}

/** Hilbert eğrisinde çeyrek döndürme (PMTiles v3 referans uygulaması). */
function rotate(n, x, y, rx, ry) {
  if (ry === 0) {
    if (rx !== 0) return [n - 1 - y, n - 1 - x];
    return [y, x];
  }
  return [x, y];
}

/**
 * Dizin girdilerini PMTiles v3 biçiminde serileştirir:
 * sayı · delta kodlu tileId · runLength · uzunluk · (bitişikse 0, değilse offset+1).
 */
export function serializeDirectory(entries) {
  const out = [];
  writeVarint(out, entries.length);
  let last = 0;
  for (const e of entries) {
    writeVarint(out, e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) writeVarint(out, e.runLength);
  for (const e of entries) writeVarint(out, e.length);
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const prev = entries[i - 1];
    if (i > 0 && prev && e.offset === prev.offset + prev.length) writeVarint(out, 0);
    else writeVarint(out, e.offset + 1);
  }
  return Uint8Array.from(out);
}

const e7 = (v) => Math.round(v * 1e7);

/** 127 baytlık PMTiles başlığı. */
export function serializeHeader(h) {
  const buf = Buffer.alloc(HEADER_BYTES);
  buf.write('PMTiles', 0, 'ascii');
  buf.writeUInt8(3, 7);
  buf.writeBigUInt64LE(BigInt(h.rootDirectoryOffset), 8);
  buf.writeBigUInt64LE(BigInt(h.rootDirectoryLength), 16);
  buf.writeBigUInt64LE(BigInt(h.jsonMetadataOffset), 24);
  buf.writeBigUInt64LE(BigInt(h.jsonMetadataLength), 32);
  buf.writeBigUInt64LE(BigInt(h.leafDirectoryOffset), 40);
  buf.writeBigUInt64LE(BigInt(h.leafDirectoryLength), 48);
  buf.writeBigUInt64LE(BigInt(h.tileDataOffset), 56);
  buf.writeBigUInt64LE(BigInt(h.tileDataLength), 64);
  buf.writeBigUInt64LE(BigInt(h.numAddressedTiles), 72);
  buf.writeBigUInt64LE(BigInt(h.numTileEntries), 80);
  buf.writeBigUInt64LE(BigInt(h.numTileContents), 88);
  buf.writeUInt8(1, 96); // clustered
  buf.writeUInt8(COMPRESSION_GZIP, 97); // dizin/künye sıkıştırması
  buf.writeUInt8(h.tileCompression ?? COMPRESSION_GZIP, 98); // karo sıkıştırması
  buf.writeUInt8(h.tileType ?? TILE_TYPE_MVT, 99);
  buf.writeUInt8(h.minZoom, 100);
  buf.writeUInt8(h.maxZoom, 101);
  buf.writeInt32LE(e7(h.minLon), 102);
  buf.writeInt32LE(e7(h.minLat), 106);
  buf.writeInt32LE(e7(h.maxLon), 110);
  buf.writeInt32LE(e7(h.maxLat), 114);
  buf.writeUInt8(h.centerZoom, 118);
  buf.writeInt32LE(e7(h.centerLon), 119);
  buf.writeInt32LE(e7(h.centerLat), 123);
  return buf;
}

/* ------------------------------------------------------------------ */
/* Karo üretimi                                                        */
/* ------------------------------------------------------------------ */

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  const n = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return Math.floor(((1 - n / Math.PI) / 2) * 2 ** z);
};

/**
 * Katman adı → GeoJSON eşlemesinden MVT karoları üretir.
 * `bbox` [minLon, minLat, maxLon, maxLat]; her zum için yalnızca bbox'a
 * düşen karolar denenir.
 */
export function buildTiles(layers, { minzoom = 6, maxzoom = 14, bbox, extent = 4096 } = {}) {
  const indexes = new Map();
  for (const [name, geojson] of Object.entries(layers)) {
    if (!geojson?.features?.length) continue;
    indexes.set(
      name,
      geojsonvt(geojson, { maxZoom: maxzoom, indexMaxZoom: maxzoom, extent, buffer: 64, tolerance: 3 }),
    );
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const tiles = new Map(); // "z/x/y" → Uint8Array (sıkıştırılmamış MVT)
  for (let z = minzoom; z <= maxzoom; z += 1) {
    const x0 = Math.max(0, lonToX(minLon, z));
    const x1 = Math.min(2 ** z - 1, lonToX(maxLon, z));
    const y0 = Math.max(0, latToY(maxLat, z));
    const y1 = Math.min(2 ** z - 1, latToY(minLat, z));
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const parts = {};
        let any = false;
        for (const [name, index] of indexes) {
          const tile = index.getTile(z, x, y);
          if (tile && tile.features.length) {
            parts[name] = tile;
            any = true;
          }
        }
        if (!any) continue;
        tiles.set(`${z}/${x}/${y}`, vtpbf.fromGeojsonVt(parts, { version: 2, extent }));
      }
    }
  }
  return tiles;
}

/* ------------------------------------------------------------------ */
/* Arşiv                                                               */
/* ------------------------------------------------------------------ */

/**
 * Karo eşlemesini tek dosyalık PMTiles arşivine çevirir.
 * Aynı içerikli karolar tek kopya tutulur (`numTileContents`).
 */
export function packPmtiles(
  tiles,
  { metadata = {}, minzoom, maxzoom, bbox, center, tileType = 'mvt' },
) {
  const kind = TILE_TYPES[tileType];
  if (!kind) throw new Error(`Bilinmeyen karo türü: ${tileType}`);
  const rows = [];
  for (const [key, data] of tiles) {
    const [z, x, y] = key.split('/').map(Number);
    const raw = Buffer.from(data);
    rows.push({
      tileId: zxyToTileId(z, x, y),
      data: kind.compression === COMPRESSION_GZIP ? gzipSync(raw) : raw,
    });
  }
  rows.sort((a, b) => a.tileId - b.tileId);

  const seen = new Map(); // içerik özeti → { offset, length }
  const chunks = [];
  const entries = [];
  let offset = 0;
  for (const row of rows) {
    const digest = createHash('sha256').update(row.data).digest('hex');
    const hit = seen.get(digest);
    if (hit) {
      entries.push({ tileId: row.tileId, offset: hit.offset, length: hit.length, runLength: 1 });
      continue;
    }
    const placed = { offset, length: row.data.length };
    seen.set(digest, placed);
    chunks.push(row.data);
    entries.push({ tileId: row.tileId, ...placed, runLength: 1 });
    offset += row.data.length;
  }

  const tileData = Buffer.concat(chunks);
  const rootDir = gzipSync(Buffer.from(serializeDirectory(entries)));
  if (HEADER_BYTES + rootDir.length > ROOT_DIR_LIMIT) {
    throw new Error(
      `Kök dizin ${rootDir.length} bayt — 16 KiB sınırını aşıyor; yaprak dizin gerekir (daha küçük bölge ya da daha düşük maxzoom deneyin).`,
    );
  }
  const meta = gzipSync(Buffer.from(JSON.stringify(metadata), 'utf8'));

  const rootDirectoryOffset = HEADER_BYTES;
  const jsonMetadataOffset = rootDirectoryOffset + rootDir.length;
  const leafDirectoryOffset = jsonMetadataOffset + meta.length;
  const tileDataOffset = leafDirectoryOffset;

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const header = serializeHeader({
    rootDirectoryOffset,
    rootDirectoryLength: rootDir.length,
    jsonMetadataOffset,
    jsonMetadataLength: meta.length,
    leafDirectoryOffset,
    leafDirectoryLength: 0,
    tileDataOffset,
    tileDataLength: tileData.length,
    numAddressedTiles: entries.length,
    numTileEntries: entries.length,
    numTileContents: seen.size,
    minZoom: minzoom,
    maxZoom: maxzoom,
    minLon,
    minLat,
    maxLon,
    maxLat,
    centerZoom: center?.zoom ?? Math.min(maxzoom, minzoom + 6),
    centerLon: center?.lon ?? (minLon + maxLon) / 2,
    centerLat: center?.lat ?? (minLat + maxLat) / 2,
    tileType: kind.id,
    tileCompression: kind.compression,
  });

  return {
    buffer: Buffer.concat([header, rootDir, meta, tileData]),
    stats: { tiles: entries.length, unique: seen.size, tileBytes: tileData.length },
  };
}

/** Kullanılmayan sabit; dış araç yolunda sıkıştırma kapalı arşiv üretmek istenirse. */
export const COMPRESSION = { NONE: COMPRESSION_NONE, GZIP: COMPRESSION_GZIP };
