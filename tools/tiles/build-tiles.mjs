#!/usr/bin/env node
/**
 * Bölge için çevrimdışı vektör harita paketi (PMTiles) üretir.
 *
 *   node tools/tiles/build-tiles.mjs --region likya
 *   node tools/tiles/build-tiles.mjs --region likya --check    # yalnızca araç kontrolü
 *   node tools/tiles/build-tiles.mjs --input dump.json --region uludag   # ağsız, yerel döküm
 *   node tools/tiles/build-tiles.mjs --region likya --js-tiler           # dış araçsız PMTiles
 *   node tools/tiles/build-tiles.mjs --region uludag --terrain           # + eşyükselti ve eğim
 *
 * Hat:
 *   0. (--terrain) DEM ızgarası → eşyükselti eğrileri + eğim açısı sınıfları → GeoJSON
 *   1. Overpass'tan bölge verisi (yollar, su, arazi, zirveler, barınaklar) → GeoJSON
 *   2. tippecanoe → MBTiles (çok zumlu vektör karolar)
 *   3. pmtiles convert → tek dosya PMTiles (HTTP range ile parça parça okunur)
 *
 * `tippecanoe` ve `pmtiles` kurulu değilse betik hattı çalıştırmaz; ne yapılacağını
 * ve GeoJSON çıktısının nerede olduğunu söyler. GeoJSON adımı her koşulda çalışır.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchWithRetry } from '../data-pipeline/lib/http.js';
import { REGIONS } from './build-graph.mjs';
import { contourGeoJson } from './lib/contour.mjs';
import { buildDem, demStats } from './lib/dem.mjs';
import { buildTiles, packPmtiles } from './lib/pmtiles-writer.mjs';
import { slopeGeoJson, slopeStats } from './lib/slope.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Karo katmanları: her biri ayrı Overpass filtresi ve ayrı vektör katmanı olur. */
export const LAYERS = {
  trails: {
    minzoom: 9,
    filters: [
      'way["highway"~"^(path|track|footway|bridleway|steps|via_ferrata)$"]',
      'way["route"="hiking"]',
    ],
  },
  roads: {
    minzoom: 7,
    filters: ['way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"]'],
  },
  water: {
    minzoom: 8,
    filters: ['way["natural"="water"]', 'way["waterway"~"^(river|stream)$"]', 'relation["natural"="water"]'],
  },
  landuse: {
    minzoom: 9,
    filters: ['way["natural"~"^(wood|scrub|grassland|bare_rock|scree|glacier)$"]', 'way["landuse"="forest"]'],
  },
  poi: {
    minzoom: 11,
    filters: [
      'node["natural"="peak"]',
      'node["natural"="spring"]',
      'node["tourism"~"^(alpine_hut|wilderness_hut|camp_site|viewpoint)$"]',
      'node["amenity"="shelter"]',
      'node["mountain_pass"="yes"]',
    ],
  },
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Bir katman için Overpass sorgusu. */
export function layerQuery(layer, [s, w, n, e], timeout = 300) {
  const filters = LAYERS[layer].filters.map((f) => `${f}(${s},${w},${n},${e});`).join('\n  ');
  return `[out:json][timeout:${timeout}][maxsize:1073741824];\n(\n  ${filters}\n);\nout geom qt;`;
}

/** Overpass öğelerini GeoJSON FeatureCollection'a çevirir. */
export function toGeoJson(elements, layer) {
  const features = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === 'node' && typeof el.lat === 'number') {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
        properties: { ...tags, layer, osm_id: el.id },
      });
    } else if (Array.isArray(el.geometry) && el.geometry.length >= 2) {
      const coords = el.geometry.map((g) => [g.lon, g.lat]);
      const closed =
        coords.length > 3 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];
      const isArea = closed && (tags.natural || tags.landuse || tags.area === 'yes');
      features.push({
        type: 'Feature',
        geometry: isArea
          ? { type: 'Polygon', coordinates: [coords] }
          : { type: 'LineString', coordinates: coords },
        properties: { ...tags, layer, osm_id: el.id },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

async function fetchLayer(layer, bbox, { fetchImpl = fetchWithRetry } = {}) {
  const query = layerQuery(layer, bbox);
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const json = await res.json();
      if (json.remark && /timed out|error/i.test(json.remark)) throw new Error(json.remark);
      return json.elements ?? [];
    } catch (error) {
      lastError = error;
      console.warn(`  ✗ ${endpoint}: ${error.message}`);
    }
  }
  throw lastError;
}

/** Overpass sırası [güney, batı, kuzey, doğu] → GeoJSON sırası [minLon, minLat, maxLon, maxLat]. */
export function lonLatBbox([s, w, n, e]) {
  return [w, s, e, n];
}

/** Bir dış aracın kurulu olup olmadığını söyler. */
export function hasTool(name) {
  return spawnSync('which', [name], { encoding: 'utf8' }).status === 0;
}

function toolReport() {
  const tools = ['tippecanoe', 'pmtiles'];
  const found = tools.filter(hasTool);
  const missing = tools.filter((t) => !found.includes(t));
  return { found, missing };
}

const INSTALL_HINT = `
Eksik araçlar kurulmadan PMTiles üretilemez:

  # tippecanoe (GeoJSON → MBTiles)
  git clone https://github.com/felt/tippecanoe && cd tippecanoe && make -j && sudo make install

  # pmtiles (MBTiles → PMTiles)
  go install github.com/protomaps/go-pmtiles@latest
  # ya da: https://github.com/protomaps/go-pmtiles/releases adresinden ikili dosya

Alternatif: hazır Protomaps küresel paketinden bölge kesmek (araç kurulumu gerekmez):
  pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles out/tiles/<bölge>.pmtiles --bbox=<w,s,e,n>
`.trim();

/**
 * Yerel Overpass dökümündeki bir öğeyi hangi karo katmanına ait olduğunu söyler.
 * Ağ kapalıyken (`--input`) katman başına ayrı sorgu atılamadığı için sınıflandırma
 * burada, etiketlere bakılarak yapılır.
 */
export function classifyElement(el) {
  const tags = el.tags ?? {};
  if (el.type === 'node') {
    if (
      tags.natural === 'peak' ||
      tags.natural === 'spring' ||
      tags.amenity === 'shelter' ||
      tags.mountain_pass === 'yes' ||
      ['alpine_hut', 'wilderness_hut', 'camp_site', 'viewpoint'].includes(tags.tourism)
    )
      return 'poi';
    return null;
  }
  if (tags.natural === 'water' || ['river', 'stream'].includes(tags.waterway)) return 'water';
  if (
    tags.landuse === 'forest' ||
    ['wood', 'scrub', 'grassland', 'bare_rock', 'scree', 'glacier'].includes(tags.natural)
  )
    return 'landuse';
  if (['path', 'track', 'footway', 'bridleway', 'steps', 'via_ferrata'].includes(tags.highway))
    return 'trails';
  if (tags.route === 'hiking') return 'trails';
  if (tags.highway) return 'roads';
  return null;
}

/** Overpass öğelerini katmanlara böler; her katman ayrı GeoJSON olur. */
export function splitLayers(elements) {
  const buckets = Object.fromEntries(Object.keys(LAYERS).map((l) => [l, []]));
  for (const el of elements) {
    const layer = classifyElement(el);
    if (layer && buckets[layer]) buckets[layer].push(el);
  }
  return buckets;
}

/** Öğelerin sınır kutusu [minLon, minLat, maxLon, maxLat]. */
export function boundsOf(elements) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  const visit = (lon, lat) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  };
  for (const el of elements) {
    if (typeof el.lat === 'number') visit(el.lon, el.lat);
    for (const g of el.geometry ?? []) visit(g.lon, g.lat);
  }
  if (!Number.isFinite(minLon)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Arazi katmanları OpenStreetMap'ten gelmez; DEM'den hesaplanır (`--terrain`).
 * `minzoom` değerleri veri yoğunluğuna göre seçildi: eşyükselti eğrileri z11'in
 * altında okunamaz hâle gelir, eğim bantları z10'un altında anlamsız bir renk
 * yığınına döner.
 */
export const TERRAIN_LAYERS = {
  contours: { minzoom: 11 },
  slope: { minzoom: 10 },
};

/**
 * DEM'den eşyükselti ve eğim katmanlarını üretir.
 * Ağ hatası ya da eksik veri hattın tamamını düşürmemeli: arazi katmanları
 * isteğe bağlıdır, karo paketi onlarsız da geçerlidir.
 */
async function buildTerrain(bbox, { region, geoDir, demStep, contourInterval }) {
  const cacheDir = resolve(ROOT, 'out/dem');
  console.log(`→ ${region}: DEM ızgarası (adım ${demStep} m)…`);
  const dem = await buildDem(bbox, {
    stepM: demStep,
    cacheDir,
    onProgress: (done, total) => {
      if (done % 5000 === 0 || done === total) console.log(`  yükseklik ${done}/${total}`);
    },
  });
  const stats = demStats(dem);
  console.log(
    `  ${stats.cols}×${stats.rows} hücre · ${stats.minElevationM}–${stats.maxElevationM} m` +
      `${dem.cached ? ' (önbellekten)' : ''}`,
  );

  const out = {};

  const contours = contourGeoJson(dem, { interval: contourInterval });
  writeFileSync(resolve(geoDir, 'contours.geojson'), JSON.stringify(contours));
  console.log(`  eşyükselti: ${contours.features.length} eğri (${contourInterval} m aralık)`);
  if (contours.features.length) out.contours = contours;

  const slope = slopeGeoJson(dem);
  writeFileSync(resolve(geoDir, 'slope.geojson'), JSON.stringify(slope));
  const sStats = slopeStats(dem);
  console.log(
    `  eğim: ${slope.features.length} alan · en dik ${sStats.maxAngle}° · ` +
      Object.entries(sStats.counts)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${id}=${n}`)
        .join(' '),
  );
  if (slope.features.length) out.slope = slope;

  return out;
}

function parseArgs(argv) {
  // DEM adımı 90 m: kaynak Copernicus GLO-90'ın kendi çözünürlüğü; daha sık
  // örneklemek yeni bilgi getirmez, yalnızca istek sayısını artırır.
  const args = { minzoom: 6, maxzoom: 14, demStep: 90, contourInterval: 20 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--region') args.region = argv[++i];
    else if (a === '--bbox') args.bbox = argv[++i].split(',').map(Number);
    else if (a === '--check') args.check = true;
    else if (a === '--geojson-only') args.geojsonOnly = true;
    else if (a === '--input') args.input = argv[++i];
    else if (a === '--js-tiler') args.jsTiler = true;
    else if (a === '--maxzoom') args.maxzoom = Number(argv[++i]);
    else if (a === '--minzoom') args.minzoom = Number(argv[++i]);
    else if (a === '--terrain') args.terrain = true;
    else if (a === '--dem-step') args.demStep = Number(argv[++i]);
    else if (a === '--contour-interval') args.contourInterval = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { found, missing } = toolReport();

  if (args.check) {
    console.log(`Kurulu: ${found.join(', ') || '(yok)'}`);
    console.log(`Eksik : ${missing.join(', ') || '(yok)'}`);
    if (missing.length) console.log(`\n${INSTALL_HINT}`);
    return;
  }

  const region = args.region;
  let bbox = args.bbox ?? REGIONS[region]?.bbox;
  if (!bbox && !args.input) {
    console.error('Bölge gerekli: --region <id> ya da --bbox s,w,n,e');
    console.error(`Hazır bölgeler: ${Object.keys(REGIONS).join(', ')}`);
    process.exit(1);
  }

  const geoDir = resolve(ROOT, 'out/geojson', region);
  mkdirSync(geoDir, { recursive: true });
  const layerFiles = [];
  const layerData = {};

  if (args.input) {
    // Ağ kapalıyken: tek bir Overpass dökümü etiketlere göre katmanlara bölünür.
    console.log(`→ ${region}: yerel döküm okunuyor (${args.input})…`);
    const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
    const elements = dump.elements ?? [];
    bbox = args.bbox ? lonLatBbox(args.bbox) : (boundsOf(elements) ?? [0, 0, 0, 0]);
    const buckets = splitLayers(elements);
    for (const [layer, els] of Object.entries(buckets)) {
      const geojson = toGeoJson(els, layer);
      const file = resolve(geoDir, `${layer}.geojson`);
      writeFileSync(file, JSON.stringify(geojson));
      console.log(`  ${layer}: ${geojson.features.length} nesne · ${file}`);
      if (geojson.features.length) {
        layerFiles.push({ layer, file });
        layerData[layer] = geojson;
      }
    }
  } else {
    for (const layer of Object.keys(LAYERS)) {
      console.log(`→ ${region}/${layer}: OpenStreetMap'ten çekiliyor…`);
      const elements = await fetchLayer(layer, bbox);
      const geojson = toGeoJson(elements, layer);
      const file = resolve(geoDir, `${layer}.geojson`);
      writeFileSync(file, JSON.stringify(geojson));
      const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
      console.log(`  ${geojson.features.length} nesne · ${mb} MB · ${file}`);
      if (geojson.features.length) {
        layerFiles.push({ layer, file });
        layerData[layer] = geojson;
      }
    }
    bbox = lonLatBbox(bbox);
  }

  if (args.terrain) {
    try {
      const terrain = await buildTerrain(bbox, {
        region,
        geoDir,
        demStep: args.demStep,
        contourInterval: args.contourInterval,
      });
      for (const [layer, geojson] of Object.entries(terrain)) {
        layerFiles.push({ layer, file: resolve(geoDir, `${layer}.geojson`) });
        layerData[layer] = geojson;
      }
    } catch (err) {
      // Arazi isteğe bağlıdır: yükseklik servisi ulaşılamazsa paket yine üretilir,
      // ama bu sessizce geçiştirilmez — eksik katman açıkça söylenir.
      console.warn(`⚠ Arazi katmanları üretilemedi: ${err.message}`);
      console.warn('  Karo paketi eşyükselti ve eğim olmadan üretilecek.');
    }
  }

  if (args.geojsonOnly) return;

  const tilesDir = resolve(ROOT, 'out/tiles');
  mkdirSync(tilesDir, { recursive: true });

  // Dış araçlar yoksa (ya da --js-tiler) saf JS hattı devreye girer.
  if (args.jsTiler || missing.length) {
    if (missing.length && !args.jsTiler) {
      console.log(`\n⚠ tippecanoe/pmtiles yok — saf JS hattına düşülüyor.\n${INSTALL_HINT}\n`);
    }
    const out = resolve(tilesDir, `${region}.pmtiles`);
    console.log('\n→ geojson-vt + vt-pbf: vektör karolar üretiliyor…');
    const tiles = buildTiles(layerData, {
      minzoom: args.minzoom,
      maxzoom: args.maxzoom,
      bbox,
    });
    const { buffer, stats } = packPmtiles(tiles, {
      minzoom: args.minzoom,
      maxzoom: args.maxzoom,
      bbox,
      metadata: {
        name: region,
        description: `Zirtan outdoor karoları — ${region}`,
        attribution: '© OpenStreetMap katkıcıları (ODbL)',
        type: 'baselayer',
        // Şema, veri boş olsa da tam listelenir: istemci stilinde her katman
        // tanımlıdır, aksi hâlde MapLibre "source-layer yok" uyarısı basar.
        vector_layers: Object.keys(layerData).map((id) => ({
          id,
          description: id,
          // Arazi katmanları LAYERS içinde değil; ikisinden hangisi tanımlıysa o.
          minzoom: Math.max(args.minzoom, (LAYERS[id] ?? TERRAIN_LAYERS[id]).minzoom),
          maxzoom: args.maxzoom,
          fields: {},
        })),
      },
    });
    writeFileSync(out, buffer);
    const mbJs = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(
      `\n✔ ${out} · ${mbJs} MB · ${stats.tiles} karo (${stats.unique} benzersiz gövde)`,
    );
    console.log(`  Uygulamaya eklemek için: MapPack.sizeMb = ${mbJs}, format = 'pmtiles'`);
    return;
  }
  const mbtiles = resolve(tilesDir, `${region}.mbtiles`);
  const pmtiles = resolve(tilesDir, `${region}.pmtiles`);

  console.log('\n→ tippecanoe: vektör karolar üretiliyor…');
  execFileSync(
    'tippecanoe',
    [
      '-o', mbtiles, '--force',
      '-Z', String(args.minzoom), '-z', String(args.maxzoom),
      '--drop-densest-as-needed', '--extend-zooms-if-still-dropping',
      '--simplification=4', '--no-tile-size-limit',
      ...layerFiles.flatMap(({ layer, file }) => ['-L', `${layer}:${file}`]),
    ],
    { stdio: 'inherit' },
  );

  console.log('\n→ pmtiles: tek dosyaya dönüştürülüyor…');
  execFileSync('pmtiles', ['convert', mbtiles, pmtiles], { stdio: 'inherit' });

  const mb = (statSync(pmtiles).size / 1024 / 1024).toFixed(1);
  console.log(`\n✔ ${pmtiles} · ${mb} MB`);
  console.log(`  Uygulamaya eklemek için: MapPack.sizeMb = ${mb}, format = 'pmtiles'`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('✗', error.message);
    process.exit(1);
  });
}

export { INSTALL_HINT, toolReport };
