import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isLicenseUsable, parseImageInfo } from '../lib/commons.js';
import { dedupeKey, normalizeOsmElement, normalizeWikidataRow } from '../lib/normalize.js';
import { buildQuery, detectKind, fetchTile } from '../lib/overpass.js';
import { regionTiles, tileBbox, worldTiles } from '../lib/regions.js';
import { LibraryDb } from '../lib/store.js';
import { buildSparql } from '../lib/wikidata.js';
import {
  parseCoords,
  parseGuideSections,
  stripWikitext,
  toDestinationDraft,
} from '../lib/wikivoyage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  fs.readFileSync(path.join(here, '../fixtures/overpass-sample.json'), 'utf8'),
);
const commonsSample = JSON.parse(
  fs.readFileSync(path.join(here, '../fixtures/commons-imageinfo.json'), 'utf8'),
);

test('buildQuery: kategoriler ve bbox ile geçerli Overpass QL üretir', () => {
  const q = buildQuery(['campsite', 'climbing'], [35.8, 25.6, 42.2, 44.9]);
  assert.match(q, /\[out:json\]/);
  assert.match(q, /nwr\["tourism"="camp_site"\]\(35.8,25.6,42.2,44.9\);/);
  assert.match(q, /nwr\["sport"="climbing"\]/);
  assert.match(q, /out center tags qt;/);
  assert.throws(() => buildQuery(['yok'], [0, 0, 1, 1]));
});

test('detectKind: etiketleri doğru kategoriye eşler', () => {
  assert.equal(detectKind({ tourism: 'camp_site' }), 'campsite');
  assert.equal(detectKind({ climbing: 'crag' }), 'climbing');
  assert.equal(detectKind({ amenity: 'dive_centre' }), 'dive_centre');
  assert.equal(detectKind({ route: 'hiking' }), 'hiking_route');
  assert.equal(detectKind({ whitewater: 'rapid' }), 'rafting');
  assert.equal(detectKind({ emergency: 'mountain_rescue' }), 'mountain_rescue');
  assert.equal(detectKind({ shop: 'bakery' }), null);
});

test('normalizeOsmElement: örnek yanıtı birleşik şemaya çevirir, ilgisizleri eler', () => {
  const places = sample.elements
    .map((el) => normalizeOsmElement(el, '2026-09-05T00:00:00.000Z'))
    .filter(Boolean);
  // fırın ve adsız zirve elenir
  assert.equal(places.length, 10);
  const camp = places.find((p) => p.id === 'osm:node:1001');
  assert.equal(camp.kind, 'campsite');
  assert.equal(camp.group, 'place');
  assert.deepEqual(camp.names, { en: 'Belgrade Forest Campsite' });
  assert.equal(camp.commonsFile, 'Belgrad Forest.jpg');
  assert.equal(camp.tags.capacity, '40');
  assert.equal(camp.license, 'ODbL-1.0');
  const crag = places.find((p) => p.id === 'osm:way:2002');
  assert.equal(crag.lat, 36.94);
  assert.equal(crag.elevationM, 620);
  assert.equal(crag.tags['climbing:grade:french:max'], '9a');
  const peak = places.find((p) => p.kind === 'peak');
  assert.equal(peak.wikidataId, 'Q1010215');
  assert.equal(peak.commonsFile, 'Kackar summit.jpg');
  const hospital = places.find((p) => p.kind === 'hospital');
  assert.equal(hospital.group, 'emergency');
  assert.equal(hospital.phone, '+90 216 000 0000');
});

test('dedupeKey: aynı konum ve Türkçe-duyarsız benzer ad tek anahtara düşer', () => {
  const a = normalizeOsmElement(sample.elements[0]);
  const b = normalizeOsmElement(sample.elements.find((e) => e.id === 9009));
  assert.notEqual(dedupeKey(a), dedupeKey(b)); // "Ormanı" ≠ "Ormani": farklı yazım aynı anahtara zorlanmaz
  assert.equal(dedupeKey(a), dedupeKey({ ...a, id: 'x' }));
});

test('normalizeWikidataRow: SPARQL satırını Place yapar', () => {
  const row = {
    item: { value: 'http://www.wikidata.org/entity/Q1010215' },
    coord: { value: 'Point(41.1211 40.8356)' },
    elevation: { value: '3937' },
    image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Kackar%20summit.jpg' },
    countryCode: { value: 'TR' },
    label_tr: { value: 'Kaçkar Dağı' },
    label_en: { value: 'Mount Kaçkar' },
  };
  const p = normalizeWikidataRow(row, 'peak');
  assert.equal(p.id, 'wd:Q1010215');
  assert.equal(p.lat, 40.8356);
  assert.equal(p.lng, 41.1211);
  assert.equal(p.elevationM, 3937);
  assert.equal(p.commonsFile, 'Kackar summit.jpg');
  assert.equal(p.names.en, 'Mount Kaçkar');
  assert.equal(p.license, 'CC0-1.0');
  assert.equal(normalizeWikidataRow({ item: { value: 'x/Q1' } }, 'peak'), null);
});

test('buildSparql: ülke filtresi ve çok dilli etiketler içerir', () => {
  const q = buildSparql('peak', 'Q43', 100, 200);
  assert.match(q, /wd:Q8502/);
  assert.match(q, /wdt:P17 wd:Q43/);
  assert.match(q, /label_ja/);
  assert.match(q, /LIMIT 100 OFFSET 200/);
});

test('parseImageInfo + isLicenseUsable: lisans ve atıf çıkarır', () => {
  const info = Object.values(commonsSample.query.pages)[0].imageinfo[0];
  const image = parseImageInfo(info);
  assert.equal(image.license, 'CC BY-SA 4.0');
  assert.equal(image.author, 'Example User');
  assert.match(image.attribution, /Example User — CC BY-SA 4.0, Wikimedia Commons/);
  assert.equal(isLicenseUsable('CC BY-SA 4.0'), true);
  assert.equal(isLicenseUsable('CC BY-NC 2.0'), false);
  assert.equal(isLicenseUsable('Public domain'), true);
});

test('regions: karolama ve dünya ızgarası', () => {
  assert.equal(tileBbox([0, 0, 4, 4], 2).length, 4);
  assert.ok(worldTiles(10).length > 500);
  assert.ok(regionTiles('TR').length > 10);
  assert.throws(() => regionTiles('XX'));
});

test('fetchTile: uç noktalar arasında geçiş yapar', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.includes('first')) throw new Error('429');
    return { json: async () => sample };
  };
  const elements = await fetchTile(['campsite'], [0, 0, 1, 1], {
    endpoints: ['https://first', 'https://second'],
    fetchImpl,
  });
  assert.equal(calls, 2);
  assert.equal(elements.length, sample.elements.length);
});

test('LibraryDb: upsert, tekilleştirme, FTS arama, yakınlık ve görsel güncelleme', () => {
  const db = new LibraryDb(':memory:');
  const places = sample.elements
    .map((el) => normalizeOsmElement(el, '2026-09-05T00:00:00.000Z'))
    .filter(Boolean);
  db.upsertMany(places);
  db.upsertMany(places); // ikinci kez → değişmez
  assert.equal(db.count(), 10);
  assert.equal(db.count('campsite'), 2);

  const hits = db.search('Kaçkar');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'peak');

  const near = db.nearby(36.2, 29.64, 5);
  assert.deepEqual(near.map((p) => p.kind).sort(), ['dive_centre', 'diving']);
  assert.ok(near[0].distanceKm < near[1].distanceKm);

  const needing = db.needingImages(10);
  assert.equal(needing.length, 2);
  db.setImage('osm:node:5005', {
    url: 'u',
    thumbUrl: 't',
    license: 'CC BY 4.0',
    author: 'A',
    attribution: 'A — CC BY 4.0',
  });
  assert.equal(db.needingImages(10).length, 1);
  assert.equal(db.all({ kind: 'peak' })[0].image.license, 'CC BY 4.0');
  assert.equal(db.countsByKind()[0].kind, 'campsite');
  assert.equal(db.countsByKind()[0].c, 2);
  db.close();
});

test('wikivoyage: bölümler destinasyon alanlarına eşlenir', () => {
  const wikitext = fs.readFileSync(path.join(here, '../fixtures/wikivoyage-sample.txt'), 'utf8');
  const sections = parseGuideSections(wikitext);
  assert.ok(sections.summary.includes('Dudh Kosi'));
  assert.ok(sections.summary.includes('History'), 'alt bölüm üst bölüme katılır');
  assert.ok(sections.transport.includes('Lukla'));
  assert.ok(sections.permits.includes('Sagarmatha National Park permit · NPR 3000'));
  assert.ok(sections.sleep.includes('Gorak Shep · 5164 m'));
  assert.ok(sections.safety.includes('Helicopter'));
  assert.ok(sections.nearby.includes('Gokyo Lakes'));
  assert.ok(!sections.summary.includes('<ref>'), 'ref etiketleri temizlenir');
  assert.deepEqual(parseCoords(wikitext), { latitude: 27.98, longitude: 86.83 });
});

test('wikivoyage: taslak lisans ve kaynak taşır', () => {
  const wikitext = fs.readFileSync(path.join(here, '../fixtures/wikivoyage-sample.txt'), 'utf8');
  const draft = toDestinationDraft({
    title: 'Everest Base Camp trek',
    lang: 'en',
    wikitext,
    revision: 42,
  });
  assert.equal(draft.slug, 'everest-base-camp-trek');
  assert.equal(draft.license, 'CC BY-SA 3.0');
  assert.equal(draft.status, 'draft');
  assert.ok(draft.sourceUrl.endsWith('Everest_Base_Camp_trek'));
  assert.ok(draft.guide.startsWith('Nasıl gidilir'));
  assert.equal(
    stripWikitext("'''bold''' [[Nepal|Nepal ülkesi]] [https://x.y site]"),
    'bold Nepal ülkesi site',
  );
});
