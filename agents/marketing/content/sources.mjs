/**
 * İçerik motorunun veri erişim katmanı: `content/data/*.json` anlık görüntülerini okur,
 * sorgu yardımcıları sunar. Veri `content/extract.mjs` ile tazelenir.
 */

import { join } from 'node:path';

import { PKG_ROOT, readJson } from '../lib/fsx.mjs';

const DATA_DIR = join(PKG_ROOT, 'content', 'data');

let cache = null;

/** Tüm veri kümelerini (tembel) yükler. */
export function loadData() {
  if (cache) return cache;
  const read = (name) => readJson(join(DATA_DIR, `${name}.json`), []);
  cache = {
    destinations: read('destinations'),
    routes: read('routes'),
    crags: read('crags'),
    places: read('places'),
    clubs: read('clubs'),
    heritage: read('heritage'),
    species: read('species'),
    meta: readJson(join(DATA_DIR, 'meta.json'), { counts: {}, sources: [], licenses: {} }),
  };
  return cache;
}

/** Testler için önbelleği sıfırlar. */
export function resetCache() {
  cache = null;
}

/** Veri kümesi sayıları (rapor ve testler için). */
export function counts() {
  const d = loadData();
  return {
    destinations: d.destinations.length,
    routes: d.routes.length,
    crags: d.crags.length,
    places: d.places.length,
    clubs: d.clubs.length,
    heritage: d.heritage.length,
    species: d.species.length,
  };
}

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

/** Belirli ayda (1–12) sezonu açık destinasyonlar. */
export function destinationsInMonth(month) {
  return loadData().destinations.filter((d) => has(d.bestMonths, month));
}

/** Ülkeye göre destinasyonlar (TR, NP, GE, FR…). */
export function destinationsByCountry(code) {
  return loadData().destinations.filter((d) => d.countryCode === code);
}

export function destinationBySlug(slug) {
  return loadData().destinations.find((d) => d.slug === slug) ?? null;
}

/** Tehlike sınıfına göre türler: deadly | dangerous | caution | harmless. */
export function speciesByDanger(...levels) {
  return loadData().species.filter((s) => levels.includes(s.danger));
}

/** Ülkede görülen türler. */
export function speciesInCountry(code) {
  return loadData().species.filter((s) => has(s.countryCodes, code));
}

/** Ayda aktif ve tehlikeli türler — mevsimlik güvenlik içeriği için. */
export function riskySpeciesInMonth(month, code = 'TR') {
  return speciesInCountry(code).filter(
    (s) => ['deadly', 'dangerous'].includes(s.danger) && has(s.activeMonths, month),
  );
}

/** Sezonu ayda açık kaya tırmanış alanları. */
export function cragsInMonth(month) {
  return loadData().crags.filter((c) => has(c.seasons, month));
}

/** Bir destinasyona coğrafi olarak bağlanan tarihi alanlar (bölge/ülke eşleşmesi). */
export function heritageNear(destination) {
  const d = loadData();
  return d.heritage.filter(
    (h) =>
      h.countryCode === destination.countryCode &&
      (h.adventureTypes ?? []).some((t) => (destination.adventureTypes ?? []).includes(t)),
  );
}

/** UNESCO listesindeki alanlar. */
export function unescoSites() {
  return loadData().heritage.filter((h) => h.isUnesco);
}

/** Yer türüne göre (campsite, hut, spring, viewpoint…). */
export function placesOfKind(kind) {
  return loadData().places.filter((p) => p.kind === kind);
}

/** Rota listesi; etkinliğe göre süzülebilir. */
export function routesOfActivity(activity) {
  return loadData().routes.filter((r) => r.activity === activity || r.adventureType === activity);
}

/** Ülke koduna göre kulüpler. */
export function clubsByCountry(code = 'TR') {
  return loadData().clubs.filter((c) => c.countryCode === code);
}

/** Kaynak + lisans satırları — her içeriğe eklenir. */
export function attributionFor(kind) {
  const licenses = loadData().meta.licenses ?? {};
  const base = ['Zirtan kütüphanesi (demo veri; kayıt içindeki `sources` bağlantıları)'];
  if (['place', 'route', 'map'].includes(kind)) {
    base.unshift(licenses.osm ?? '© OpenStreetMap katkıcıları — ODbL 1.0');
    base.push(licenses.wikidata ?? 'Wikidata — CC0 1.0');
  }
  if (kind === 'photo') base.push(licenses.commons ?? 'Wikimedia Commons — yazar + lisans');
  return base;
}
