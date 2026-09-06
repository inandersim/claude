#!/usr/bin/env node
/**
 * Bölge sınır kutusundan yönlendirme grafı üretir.
 *
 *   node tools/tiles/build-graph.mjs --region likya --bbox 36.15,29.10,36.65,29.95
 *   node tools/tiles/build-graph.mjs --region kackar --bbox 40.75,40.75,41.15,41.30 --no-elevation
 *   node tools/tiles/build-graph.mjs --input dump.json --region likya   # ağsız, yerel döküm
 *   node tools/tiles/build-graph.mjs --list
 *
 * Çıktı: `out/graphs/<region>.json` — `TrailGraph` şeklinde, uygulamanın
 * A* planlayıcısı tarafından doğrudan tüketilebilir.
 *
 * Veri: OpenStreetMap (ODbL 1.0) + Open-Meteo yükseklik (Copernicus DEM).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchWithRetry } from '../data-pipeline/lib/http.js';
import { enrichGraphElevation, elevationProfile } from './lib/elevation.mjs';
import {
  WAY_FILTERS,
  buildGraph,
  componentStats,
  largestComponent,
  simplifyGraph,
} from './lib/osm-graph.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Hazır bölgeler: uygulamadaki harita paketleriyle (`seed.maps.ts`) aynı kimlikler. */
export const REGIONS = {
  likya: { name: 'Likya Yolu', bbox: [36.15, 29.1, 36.65, 29.95], countryCode: 'TR' },
  kackar: { name: 'Kaçkarlar', bbox: [40.75, 40.75, 41.15, 41.3], countryCode: 'TR' },
  kapadokya: { name: 'Kapadokya', bbox: [38.55, 34.7, 38.75, 34.95], countryCode: 'TR' },
  aladaglar: { name: 'Aladağlar', bbox: [37.75, 34.95, 38.05, 35.35], countryCode: 'TR' },
  uludag: { name: 'Uludağ', bbox: [40.05, 28.95, 40.2, 29.25], countryCode: 'TR' },
  annapurna: { name: 'Annapurna', bbox: [28.35, 83.6, 28.9, 84.35], countryCode: 'NP' },
  khumbu: { name: 'Khumbu / Everest', bbox: [27.7, 86.6, 28.1, 87.0], countryCode: 'NP' },
  dolomitler: { name: 'Dolomitler', bbox: [46.3, 11.5, 46.75, 12.2], countryCode: 'IT' },
  alpler: { name: 'Mont Blanc', bbox: [45.75, 6.75, 46.0, 7.05], countryCode: 'FR' },
  kazbegi: { name: 'Kazbegi', bbox: [42.6, 44.5, 42.8, 44.75], countryCode: 'GE' },
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

/** Yol geometrisini isteyen Overpass sorgusu (`out geom`). */
export function buildWayQuery([s, w, n, e], timeout = 300) {
  const filters = WAY_FILTERS.map((f) => `${f}(${s},${w},${n},${e});`).join('\n  ');
  return `[out:json][timeout:${timeout}][maxsize:1073741824];\n(\n  ${filters}\n);\nout geom qt;`;
}

async function fetchWays(bbox, { fetchImpl = fetchWithRetry } = {}) {
  const query = buildWayQuery(bbox);
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

function parseArgs(argv) {
  const args = { elevation: true, simplify: true, prune: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--region') args.region = argv[++i];
    else if (a === '--bbox') args.bbox = argv[++i].split(',').map(Number);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--input') args.input = argv[++i];
    else if (a === '--no-elevation') args.elevation = false;
    else if (a === '--no-simplify') args.simplify = false;
    else if (a === '--keep-islands') args.prune = false;
  }
  return args;
}

export async function buildRegionGraph(regionId, bbox, options = {}) {
  const { elevation = true, simplify = true, prune = true, input, log = console.log } = options;
  let elements;
  if (input) {
    // Yerel Overpass JSON dökümü (ağ yok ya da Geofabrik/osmium ile hazırlanmış çıkarım).
    log(`→ ${regionId}: yerel döküm okunuyor (${input})…`);
    const raw = JSON.parse(readFileSync(input, 'utf8'));
    elements = Array.isArray(raw) ? raw : (raw.elements ?? []);
  } else {
    log(`→ ${regionId}: OpenStreetMap yolları çekiliyor…`);
    elements = await fetchWays(bbox, options);
  }
  log(`  ${elements.length} yol geldi`);

  let graph = buildGraph(elements, { regionId });
  log(`  ham graf: ${graph.nodes.length} düğüm, ${graph.edges.length} kenar`);

  if (simplify) {
    const before = graph.nodes.length;
    graph = simplifyGraph(graph);
    const pct = before ? Math.round((1 - graph.nodes.length / before) * 100) : 0;
    log(`  sadeleştirme: ${graph.nodes.length} düğüm (%${pct} küçüldü)`);
  }

  const stats = componentStats(graph);
  log(`  bağlı bileşen: ${stats.components} (en büyük ${stats.largest} düğüm)`);
  if (prune && stats.components > 1) {
    graph = largestComponent(graph);
    log(`  kopuk adalar atıldı: ${graph.nodes.length} düğüm, ${graph.edges.length} kenar`);
  }

  if (elevation) {
    log(`  yükseklik zenginleştirmesi (${graph.nodes.length} düğüm)…`);
    graph = await enrichGraphElevation(graph, {
      onProgress: (done, total) => {
        if (done % 1000 === 0 || done === total) log(`    ${done}/${total}`);
      },
    });
  }

  return { graph, profile: elevationProfile(graph), stats };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list || (!args.region && !args.bbox)) {
    console.log('Hazır bölgeler:\n');
    for (const [id, r] of Object.entries(REGIONS)) {
      console.log(`  ${id.padEnd(12)} ${r.name.padEnd(18)} ${r.countryCode}  [${r.bbox.join(', ')}]`);
    }
    console.log('\nKullanım: node tools/tiles/build-graph.mjs --region likya');
    return;
  }

  const region = args.region ?? 'custom';
  const bbox = args.bbox ?? REGIONS[region]?.bbox ?? [0, 0, 0, 0];
  if (!args.input && !args.bbox && !REGIONS[region]) {
    console.error(`Bölge bulunamadı: ${region}. --bbox ile sınır kutusu verin.`);
    process.exit(1);
  }

  const started = Date.now();
  const { graph, profile, stats } = await buildRegionGraph(region, bbox, args);
  const outPath = args.out ?? resolve(ROOT, 'out/graphs', `${region}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...graph,
        meta: {
          bbox,
          builtAt: new Date().toISOString(),
          source: 'OpenStreetMap (ODbL 1.0)',
          elevationSource: args.elevation ? 'Open-Meteo / Copernicus DEM GLO-90' : null,
          attribution: '© OpenStreetMap katkıcıları',
          ...profile,
          ...stats,
        },
      },
      null,
      2,
    ),
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n✔ ${outPath}\n  ${graph.nodes.length} düğüm · ${graph.edges.length} kenar · ` +
      `${profile.minElevationM}–${profile.maxElevationM} m · ${secs}s`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('✗', error.message);
    process.exit(1);
  });
}
