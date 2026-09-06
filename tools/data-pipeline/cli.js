#!/usr/bin/env node
// Zirve veri hattı komut satırı. Kullanım: node tools/data-pipeline/cli.js <komut> [--seçenek değer]
import fs from 'node:fs';
import path from 'node:path';

import { fetchCommonsImage, isLicenseUsable } from './lib/commons.js';
import { DEFAULT_KINDS, KINDS } from './lib/config.js';
import { normalizeOsmElement } from './lib/normalize.js';
import { fetchTile } from './lib/overpass.js';
import { regionTiles } from './lib/regions.js';
import { appendNdjson, LibraryDb, readNdjson } from './lib/store.js';
import { fetchWikidata, WIKIDATA_CLASSES } from './lib/wikidata.js';
import { fetchWikivoyagePage, listCategoryPages, toDestinationDraft } from './lib/wikivoyage.js';

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

const commands = {
  async 'import-osm'() {
    const region = args.region ?? 'TR';
    const kinds = (args.kinds ? String(args.kinds).split(',') : DEFAULT_KINDS).map((k) => k.trim());
    for (const k of kinds) if (!KINDS[k]) throw new Error(`Bilinmeyen kategori: ${k}`);
    const out = args.out ?? 'data/library';
    const stateFile = path.join(out, `state-${region}.json`);
    const state = fs.existsSync(stateFile)
      ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      : { done: [] };
    const tiles = regionTiles(region, args.step ? Number(args.step) : undefined);
    console.log(`▶ ${region}: ${tiles.length} karo, kategoriler: ${kinds.join(', ')}`);
    let total = 0;
    for (const [i, tile] of tiles.entries()) {
      const key = tile.join(',');
      if (state.done.includes(key)) continue;
      console.log(`[${i + 1}/${tiles.length}] ${key}`);
      const elements = await fetchTile(kinds, tile);
      const places = elements.map((el) => normalizeOsmElement(el)).filter(Boolean);
      appendNdjson(path.join(out, `osm-${region}.ndjson`), places);
      total += places.length;
      state.done.push(key);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(state));
      console.log(`  ✓ ${places.length} yer (toplam ${total})`);
      await new Promise((r) => setTimeout(r, Number(args.delay ?? 3000)));
    }
    console.log(`✔ Bitti: ${total} yer → ${out}/osm-${region}.ndjson`);
  },

  async 'import-wikivoyage'() {
    // Wikivoyage seyahat rehberlerini destinasyon taslağı olarak içe aktarır (CC BY-SA 3.0 atıf zorunlu).
    const lang = args.lang ?? 'en';
    const out = args.out ?? 'data/destinations';
    let titles = args.titles
      ? String(args.titles)
          .split(',')
          .map((t) => t.trim())
      : [];
    if (args.category) titles = titles.concat(await listCategoryPages(String(args.category), lang));
    if (titles.length === 0) throw new Error('--titles "A,B" ya da --category gerekli');
    fs.mkdirSync(out, { recursive: true });
    const drafts = [];
    for (const [i, title] of titles.entries()) {
      console.log(`[${i + 1}/${titles.length}] ${title}`);
      try {
        const page = await fetchWikivoyagePage(title, lang);
        const draft = toDestinationDraft(page);
        drafts.push(draft);
        console.log(
          `  ✓ ${Object.keys(draft.sections).length} bölüm, ${draft.guide.length} karakter`,
        );
      } catch (error) {
        console.warn(`  ✗ ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, Number(args.delay ?? 1000)));
    }
    const file = path.join(out, `wikivoyage-${lang}.ndjson`);
    appendNdjson(file, drafts);
    console.log(`✔ ${drafts.length} taslak → ${file} (editör onayından sonra uygulamaya alınır)`);
  },

  async 'import-osm-geojson'() {
    // osmium export ile üretilmiş GeoJSON (FeatureCollection) dosyasını içe aktarır.
    const file = args.file;
    if (!file) throw new Error('--file gerekli');
    const out = args.out ?? 'data/library';
    const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
    const places = [];
    for (const f of geo.features ?? []) {
      const [lng, lat] =
        f.geometry?.type === 'Point' ? f.geometry.coordinates : centroid(f.geometry);
      const id = f.id ?? f.properties?.['@id'] ?? `${places.length}`;
      const [type, num] = String(id).includes('/') ? String(id).split('/') : ['way', id];
      const place = normalizeOsmElement({
        type: type === 'n' ? 'node' : type === 'w' ? 'way' : type === 'r' ? 'relation' : type,
        id: num,
        lat,
        lon: lng,
        tags: f.properties,
      });
      if (place) places.push(place);
    }
    appendNdjson(path.join(out, `osm-file-${path.basename(file)}.ndjson`), places);
    console.log(`✔ ${places.length} yer içe aktarıldı`);
  },

  async 'import-wikidata'() {
    const country = args.country ?? 'TR';
    const kinds = (args.kinds ? String(args.kinds).split(',') : Object.keys(WIKIDATA_CLASSES)).map(
      (k) => k.trim(),
    );
    const out = args.out ?? 'data/library';
    for (const kind of kinds) {
      console.log(`▶ Wikidata ${kind} (${country})`);
      const places = await fetchWikidata(kind, country);
      appendNdjson(path.join(out, `wikidata-${country}.ndjson`), places);
      console.log(`  ✓ ${places.length}`);
    }
  },

  async 'build-sqlite'() {
    const dir = args.in ?? 'data/library';
    const dbFile = args.db ?? path.join(dir, 'zirve-library.sqlite');
    const db = new LibraryDb(dbFile);
    let total = 0;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ndjson'))) {
      const batch = [];
      for (const place of readNdjson(path.join(dir, file))) {
        batch.push(place);
        if (batch.length >= 2000) {
          db.upsertMany(batch);
          total += batch.length;
          batch.length = 0;
        }
      }
      if (batch.length) {
        db.upsertMany(batch);
        total += batch.length;
      }
      console.log(`  ✓ ${file}`);
    }
    console.log(`✔ ${total} satır işlendi; veritabanında ${db.count()} tekil yer`);
    console.table(db.countsByKind());
    db.close();
  },

  async 'enrich-images'() {
    const dbFile = args.db ?? path.join(args.in ?? 'data/library', 'zirve-library.sqlite');
    const db = new LibraryDb(dbFile);
    const rows = db.needingImages(Number(args.limit ?? 200));
    console.log(`▶ ${rows.length} kayıt için Commons görseli`);
    let ok = 0;
    for (const p of rows) {
      try {
        const image = await fetchCommonsImage(p.commonsFile);
        if (image && isLicenseUsable(image.license)) {
          db.setImage(p.id, image);
          ok++;
        } else {
          console.log(`  ⤫ ${p.name}: lisans uygun değil (${image?.license ?? 'yok'})`);
        }
      } catch (e) {
        console.warn(`  ✗ ${p.name}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    console.log(`✔ ${ok} görsel eklendi`);
    db.close();
  },

  async 'export-app-seed'() {
    const dbFile = args.db ?? 'data/library/zirve-library.sqlite';
    const outFile = args.out ?? 'src/data/library/seed.generated.json';
    const db = new LibraryDb(dbFile);
    const places = db.all({ limit: Number(args.limit ?? 300) });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(places, null, 0));
    console.log(`✔ ${places.length} yer → ${outFile}`);
    db.close();
  },

  async 'export-csv'() {
    const db = new LibraryDb(args.db ?? 'data/library/zirve-library.sqlite');
    const rows = db.db.prepare('SELECT * FROM places').all();
    const cols = Object.keys(rows[0] ?? {});
    const esc = (v) => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join(
      '\n',
    );
    fs.writeFileSync(args.out ?? 'data/library/places.csv', csv);
    console.log(`✔ ${rows.length} satır CSV`);
    db.close();
  },

  async search() {
    const db = new LibraryDb(args.db ?? 'data/library/zirve-library.sqlite');
    const q = args._[1];
    const results = q
      ? db.search(q, { kind: args.kind, limit: 20 })
      : db.nearby(Number(args.lat), Number(args.lng), Number(args.radius ?? 50), {
          kind: args.kind,
          limit: 20,
        });
    console.table(
      results.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        lat: p.lat.toFixed(4),
        lng: p.lng.toFixed(4),
        km: p.distanceKm?.toFixed(1) ?? '',
      })),
    );
    db.close();
  },
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function centroid(geometry) {
  const coords =
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.type === 'LineString'
        ? geometry.coordinates
        : geometry.coordinates.flat(2);
  const pts = coords.filter((c) => Array.isArray(c) && c.length >= 2);
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

if (!command || !commands[command]) {
  console.log(`Komutlar: ${Object.keys(commands).join(', ')}`);
  process.exit(command ? 1 : 0);
}
commands[command]().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
