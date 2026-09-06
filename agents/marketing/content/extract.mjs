#!/usr/bin/env node
/**
 * İçerik motorunun veri kaynağını üretir.
 *
 *   node content/extract.mjs            # anlık görüntüleri content/data/ altına yazar
 *   node content/extract.mjs --check    # yazmaz, mevcut anlık görüntüyü doğrular
 *
 * Kaynaklar
 * - `website/src/data/generated/*.json` — destinasyon, rota, kaya alanı, yer, kulüp
 *   (bunlar `website/build.mjs` tarafından `src/data/mock/seed.*.ts` verisinden üretilir)
 * - `src/data/mock/seed.heritage.ts` ve `seed.wildlife.ts` — Node’un tip soyma özelliğiyle
 *   doğrudan içe aktarılır (yalnızca `import type` kullandıkları için çalışır)
 *
 * Çıktı `content/data/*.json` depoya girer; motor çalışırken `src/` ve `website/`
 * olmasa da (ör. yalnızca agents/marketing kopyalanmışsa) içerik üretilebilir.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { parseArgs } from '../lib/args.mjs';
import { PKG_ROOT, readJson, REPO_ROOT, Writer } from '../lib/fsx.mjs';

export const DATA_DIR = join(PKG_ROOT, 'content', 'data');
const WEB_DIR = join(REPO_ROOT, 'website', 'src', 'data', 'generated');
const SEED_DIR = join(REPO_ROOT, 'src', 'data', 'mock');

const pickFields = (obj, fields) => Object.fromEntries(fields.filter((f) => obj[f] !== undefined).map((f) => [f, obj[f]]));

/** Destinasyon arşivi — etaplar, izinler, riskler, ekipman, bütçe, kaynak. */
function extractDestinations(rows) {
  return rows.map((d) => ({
    ...pickFields(d, [
      'id', 'slug', 'name', 'region', 'countryCode', 'type', 'adventureTypes', 'summary',
      'maxElevationM', 'typicalDays', 'totalDistanceKm', 'difficulty', 'bestMonths',
      'budgetTry', 'risks', 'gear', 'rescueNote', 'insuranceRequired', 'sources',
    ]),
    permits: (d.permits ?? []).map((p) => pickFields(p, ['name', 'costTry', 'where', 'note'])),
    transports: (d.transports ?? []).map((t) => pickFields(t, ['mode', 'from', 'to', 'durationMin', 'costTry', 'note'])),
    stages: (d.stages ?? []).map((s) =>
      pickFields(s, ['order', 'name', 'kind', 'elevationM', 'distanceKm', 'durationMin', 'sleeping', 'waterAvailable', 'connectivity', 'note', 'restDayRecommended']),
    ),
  }));
}

function extractRoutes(rows) {
  return rows.map((r) =>
    pickFields(r, [
      'id', 'slug', 'name', 'activity', 'adventureType', 'difficulty', 'locationName', 'countryCode',
      'distanceKm', 'ascentM', 'descentM', 'durationMin', 'maxElevationM', 'minElevationM', 'loop', 'days', 'destinationSlug', 'surfaces',
    ]),
  );
}

function extractCrags(rows) {
  return rows.map((c) => ({
    ...pickFields(c, ['id', 'slug', 'name', 'locationName', 'countryCode', 'rockType', 'description', 'climbTypes', 'routeCount', 'seasons', 'approachMin']),
    sectors: (c.sectors ?? []).map((s) => ({
      name: s.name,
      orientation: s.orientation,
      routes: (s.routes ?? []).map((r) => pickFields(r, ['name', 'type', 'grade', 'gradeSystem', 'lengthM', 'pitches', 'stars'])),
    })),
  }));
}

const extractPlaces = (rows) =>
  rows.map((p) => pickFields(p, ['id', 'slug', 'kind', 'name', 'adventureTypes', 'elevationM', 'description', 'countryCode', 'tags', 'license', 'attribution', 'source']));

const extractClubs = (rows) =>
  rows.map((c) => pickFields(c, ['id', 'name', 'university', 'city', 'countryCode', 'description', 'adventureTypes', 'memberCount', 'foundedYear', 'instagram']));

const extractHeritage = (rows) =>
  rows.map((h) =>
    pickFields(h, [
      'id', 'slug', 'name', 'kind', 'eras', 'countryCode', 'region', 'elevationM', 'summary', 'history',
      'isUnesco', 'unescoYear', 'openingHours', 'entryFeeTry', 'visitDurationMin', 'accessibility',
      'nearestTrailhead', 'adventureTypes', 'rules', 'bestMonths', 'sources',
    ]),
  );

const extractSpecies = (rows) =>
  rows.map((s) =>
    pickFields(s, [
      'id', 'commonName', 'scientificName', 'group', 'danger', 'countryCodes', 'habitats', 'description',
      'identification', 'encounterDo', 'encounterDont', 'firstAidSlug', 'venomNote', 'lookalikes',
      'activeMonths', 'activeHours', 'sources',
    ]),
  );

/** Seed TypeScript modülünü Node’un tip soyma desteğiyle içe aktarır. */
async function importSeed(file) {
  const path = join(SEED_DIR, file);
  if (!existsSync(path)) return null;
  try {
    return await import(`file://${path}`);
  } catch (error) {
    return { __error: error instanceof Error ? error.message : String(error) };
  }
}

/** Tüm kaynakları toplar; erişilemeyen kaynak için mevcut anlık görüntüyü korur. */
export async function collect() {
  const notes = [];
  const out = {};

  const webFiles = {
    destinations: ['destinations.json', extractDestinations],
    routes: ['routes.json', extractRoutes],
    crags: ['crags.json', extractCrags],
    places: ['places.json', extractPlaces],
    clubs: ['clubs.json', extractClubs],
  };
  for (const [key, [file, fn]] of Object.entries(webFiles)) {
    const rows = readJson(join(WEB_DIR, file), null);
    if (rows) {
      out[key] = fn(rows);
      notes.push(`${key}: website/src/data/generated/${file} (${rows.length})`);
    } else {
      out[key] = readJson(join(DATA_DIR, `${key}.json`), []);
      notes.push(`${key}: mevcut anlık görüntü korundu (${out[key].length})`);
    }
  }

  const heritage = await importSeed('seed.heritage.ts');
  if (heritage?.seedHeritageSites) {
    out.heritage = extractHeritage(heritage.seedHeritageSites);
    notes.push(`heritage: src/data/mock/seed.heritage.ts (${out.heritage.length})`);
  } else {
    out.heritage = readJson(join(DATA_DIR, 'heritage.json'), []);
    notes.push(`heritage: anlık görüntü korundu (${out.heritage.length})${heritage?.__error ? ` — ${heritage.__error}` : ''}`);
  }

  const wildlife = await importSeed('seed.wildlife.ts');
  if (wildlife?.seedSpecies) {
    out.species = extractSpecies(wildlife.seedSpecies);
    notes.push(`species: src/data/mock/seed.wildlife.ts (${out.species.length})`);
  } else {
    out.species = readJson(join(DATA_DIR, 'species.json'), []);
    notes.push(`species: anlık görüntü korundu (${out.species.length})${wildlife?.__error ? ` — ${wildlife.__error}` : ''}`);
  }

  return { data: out, notes };
}

const LICENSES = {
  osm: '© OpenStreetMap katkıcıları — ODbL 1.0',
  wikidata: 'Wikidata — CC0 1.0',
  commons: 'Wikimedia Commons — dosya başına yazar + lisans',
  seed: 'Zirtan demo verisi — kaynak bağlantıları kayıt içinde (`sources`)',
};

export async function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  const { data, notes } = await collect();
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));

  if (flags.check) {
    const missing = Object.entries(counts).filter(([, n]) => n === 0);
    console.log(notes.map((n) => `- ${n}`).join('\n'));
    if (missing.length > 0) {
      console.error(`Boş veri kümesi: ${missing.map(([k]) => k).join(', ')}`);
      return 1;
    }
    console.log('Anlık görüntü tam.');
    return 0;
  }

  const writer = new Writer();
  for (const [key, rows] of Object.entries(data)) writer.json(join(DATA_DIR, `${key}.json`), rows);
  writer.json(join(DATA_DIR, 'meta.json'), {
    generatedAt: new Date().toISOString().slice(0, 10),
    counts,
    sources: notes,
    licenses: LICENSES,
  });
  console.log(writer.summary().map((s) => `yazıldı ${s}`).join('\n'));
  console.log(`Toplam kayıt: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main());
