#!/usr/bin/env node
/**
 * Yerel PMTiles / graf sunucusu — geliştirme içindir.
 *
 *   node tools/tiles/serve.mjs --port 8090
 *
 * PMTiles tek dosyadır ve istemci **HTTP Range** istekleriyle yalnızca gereken
 * karo baytlarını çeker; bu sunucu o davranışı yerelde taklit eder. Üretimde
 * dosyayı bir CDN'e (Cloudflare R2, S3 + CloudFront) koymak yeterlidir —
 * ayrı bir karo sunucusu gerekmez.
 *
 * Uçlar:
 *   GET /health
 *   GET /packs                      → mevcut paketler (uygulamadaki MapPack listesiyle eşleşir)
 *   GET /tiles/<bölge>.pmtiles      → Range destekli karo dosyası
 *   GET /graphs/<bölge>.json        → yönlendirme grafı (TrailGraph)
 */

import { createReadStream, existsSync, openSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TILES_DIR = resolve(ROOT, 'out/tiles');
const GRAPHS_DIR = resolve(ROOT, 'out/graphs');
/** SDF glyph paketleri (tools/glyphs/build-glyphs.mjs üretir). */
const GLYPHS_DIR = resolve(ROOT, 'public/glyphs');

const MIME = {
  '.pmtiles': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.pbf': 'application/x-protobuf',
};

/**
 * PMTiles başlığından (ilk 127 bayt) sınır kutusu ve zum aralığını okur.
 * İstemci böylece hangi paketin hangi bölgeyi kapsadığını sunucudan öğrenir.
 * Biçim: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 */
export function readPmtilesHeader(path) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(127);
    if (readSync(fd, buf, 0, 127, 0) < 127) return null;
    if (buf.toString('ascii', 0, 7) !== 'PMTiles') return null;
    return {
      minzoom: buf.readUInt8(100),
      maxzoom: buf.readUInt8(101),
      // [minLon, minLat, maxLon, maxLat]
      bbox: [
        buf.readInt32LE(102) / 1e7,
        buf.readInt32LE(106) / 1e7,
        buf.readInt32LE(110) / 1e7,
        buf.readInt32LE(114) / 1e7,
      ],
    };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
};

/**
 * `<bölge>-dem.pmtiles` ayrı bir paket değildir: ana paketin yükseklik
 * verisidir. Listede kendi başına görünürse kullanıcı onu indirilebilir bir
 * harita paketi sanır ve iki kez indirir.
 */
export const DEM_SUFFIX = '-dem';
export const isDemFile = (name) => name.replace(/\.pmtiles$/, '').endsWith(DEM_SUFFIX);
export const parentOf = (name) => name.replace(/\.pmtiles$/, '').slice(0, -DEM_SUFFIX.length);

const listPacks = () => {
  if (!existsSync(TILES_DIR)) return [];
  const files = readdirSync(TILES_DIR).filter((f) => f.endsWith('.pmtiles'));
  const demByParent = new Map();
  for (const f of files) {
    if (isDemFile(f)) demByParent.set(parentOf(f), f);
  }
  return files
    .filter((f) => !isDemFile(f))
    .map((f) => {
      const path = resolve(TILES_DIR, f);
      const { size, mtime } = statSync(path);
      const id = f.replace(/\.pmtiles$/, '');
      const header = readPmtilesHeader(path);
      return {
        id,
        format: 'pmtiles',
        sizeMb: Number((size / 1024 / 1024).toFixed(2)),
        sizeBytes: size,
        updatedAt: mtime.toISOString(),
        // Sürüm: dosya değişince istemci farkı görsün diye değişiklik zamanından türetilir.
        version: `${mtime.getUTCFullYear()}.${String(mtime.getUTCMonth() + 1).padStart(2, '0')}`,
        bbox: header?.bbox ?? null,
        minzoom: header?.minzoom ?? null,
        maxzoom: header?.maxzoom ?? null,
        url: `/tiles/${f}`,
        graphUrl: existsSync(resolve(GRAPHS_DIR, `${id}.json`)) ? `/graphs/${id}.json` : null,
        // Kabartma ve 3B arazi için yükseklik karosu (varsa).
        demUrl: demByParent.has(id) ? `/tiles/${demByParent.get(id)}` : null,
        // İstemci indirme ilerlemesini bayta göre ağırlıklandırsın diye.
        demSizeBytes: demByParent.has(id)
          ? statSync(resolve(TILES_DIR, demByParent.get(id))).size
          : null,
      };
    });
};

/** Range başlığını çözer; geçersizse null döner. */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  let start = rawStart === '' ? null : Number(rawStart);
  let end = rawEnd === '' ? null : Number(rawEnd);
  if (start === null && end === null) return null;
  if (start === null) {
    // son N bayt
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

function sendFile(req, res, path) {
  const { size } = statSync(path);
  const type = MIME[extname(path)] ?? 'application/octet-stream';
  const range = parseRange(req.headers.range, size);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    'Cache-Control': 'public, max-age=3600',
  };
  if (range) {
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': range.end - range.start + 1,
    });
    createReadStream(path, range).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': size });
    createReadStream(path).pipe(res);
  }
}

const json = (res, code, body) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

export function createTileServer() {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      });
      return res.end();
    }
    if (path === '/health') return json(res, 200, { ok: true, packs: listPacks().length });
    if (path === '/packs') return json(res, 200, listPacks());

    // Glyph yolu iki bölümlüdür (yığın adı + aralık), bu yüzden ayrı
    // desen; yine yalnızca beklenen biçim kabul edilir.
    const g = /^\/glyphs\/([A-Za-z0-9 _-]+)\/(\d+-\d+\.pbf)$/.exec(path);
    if (g) {
      const file = resolve(GLYPHS_DIR, g[1], g[2]);
      if (!file.startsWith(GLYPHS_DIR) || !existsSync(file)) {
        return json(res, 404, { error: 'glyph yok' });
      }
      return sendFile(req, res, file);
    }

    // Yol geçişi (path traversal) engeli: yalnızca düz dosya adı kabul edilir.
    const m = /^\/(tiles|graphs)\/([A-Za-z0-9_-]+\.(?:pmtiles|json|geojson))$/.exec(path);
    if (!m) return json(res, 404, { error: 'bulunamadı' });
    const dir = m[1] === 'tiles' ? TILES_DIR : GRAPHS_DIR;
    const file = resolve(dir, m[2]);
    if (!file.startsWith(dir) || !existsSync(file)) return json(res, 404, { error: 'dosya yok' });
    return sendFile(req, res, file);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 8090;
  createTileServer().listen(port, () => {
    const packs = listPacks();
    console.log(`Karo sunucusu: http://localhost:${port}`);
    console.log(`  ${packs.length} paket · ${TILES_DIR}`);
    for (const p of packs) console.log(`  · ${p.id} (${p.sizeMb} MB)`);
    if (!packs.length) console.log('  (önce: node tools/tiles/build-tiles.mjs --region likya)');
  });
}
