import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { dedupeKey } from './normalize.js';

/** NDJSON dosyasına ekler (satır başına bir Place). */
export function appendNdjson(file, places) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    places.map((p) => JSON.stringify(p)).join('\n') + (places.length ? '\n' : ''),
  );
}

export function* readNdjson(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

export const SCHEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  "group" TEXT NOT NULL,
  name TEXT NOT NULL,
  names TEXT NOT NULL,
  adventure_types TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  elevation_m REAL,
  description TEXT,
  website TEXT,
  phone TEXT,
  opening_hours TEXT,
  country_code TEXT,
  tags TEXT NOT NULL,
  wikidata_id TEXT,
  commons_file TEXT,
  image_url TEXT,
  image_thumb_url TEXT,
  image_license TEXT,
  image_author TEXT,
  image_attribution TEXT,
  license TEXT NOT NULL,
  attribution TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_places_kind ON places(kind);
CREATE INDEX IF NOT EXISTS idx_places_country ON places(country_code);
CREATE INDEX IF NOT EXISTS idx_places_latlng ON places(lat, lng);
CREATE UNIQUE INDEX IF NOT EXISTS idx_places_dedupe ON places(dedupe_key);
CREATE VIRTUAL TABLE IF NOT EXISTS places_fts USING fts5(name, description, content='places', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS places_ai AFTER INSERT ON places BEGIN
  INSERT INTO places_fts(rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS places_ad AFTER DELETE ON places BEGIN
  INSERT INTO places_fts(places_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS places_au AFTER UPDATE ON places BEGIN
  INSERT INTO places_fts(places_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO places_fts(rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;
`;

export class LibraryDb {
  constructor(file = ':memory:') {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA_SQLITE);
    this.insertStmt = this.db.prepare(`INSERT INTO places (
      id, source, kind, "group", name, names, adventure_types, lat, lng, elevation_m, description, website, phone,
      opening_hours, country_code, tags, wikidata_id, commons_file, image_url, image_thumb_url, image_license,
      image_author, image_attribution, license, attribution, dedupe_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dedupe_key) DO UPDATE SET
      description = COALESCE(places.description, excluded.description),
      website = COALESCE(places.website, excluded.website),
      phone = COALESCE(places.phone, excluded.phone),
      elevation_m = COALESCE(places.elevation_m, excluded.elevation_m),
      wikidata_id = COALESCE(places.wikidata_id, excluded.wikidata_id),
      commons_file = COALESCE(places.commons_file, excluded.commons_file),
      image_url = COALESCE(places.image_url, excluded.image_url),
      image_thumb_url = COALESCE(places.image_thumb_url, excluded.image_thumb_url),
      image_license = COALESCE(places.image_license, excluded.image_license),
      image_author = COALESCE(places.image_author, excluded.image_author),
      image_attribution = COALESCE(places.image_attribution, excluded.image_attribution),
      updated_at = excluded.updated_at`);
  }

  /** @param {import('./normalize.js').Place[]} places */
  upsertMany(places) {
    this.db.exec('BEGIN');
    try {
      for (const p of places) {
        this.insertStmt.run(
          p.id,
          p.source,
          p.kind,
          p.group,
          p.name,
          JSON.stringify(p.names),
          JSON.stringify(p.adventureTypes),
          p.lat,
          p.lng,
          p.elevationM,
          p.description,
          p.website,
          p.phone,
          p.openingHours,
          p.countryCode,
          JSON.stringify(p.tags),
          p.wikidataId,
          p.commonsFile,
          p.image?.url ?? null,
          p.image?.thumbUrl ?? null,
          p.image?.license ?? null,
          p.image?.author ?? null,
          p.image?.attribution ?? null,
          p.license,
          p.attribution,
          dedupeKey(p),
          p.updatedAt,
        );
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  count(kind) {
    return kind
      ? this.db.prepare('SELECT COUNT(*) c FROM places WHERE kind = ?').get(kind).c
      : this.db.prepare('SELECT COUNT(*) c FROM places').get().c;
  }

  countsByKind() {
    return this.db
      .prepare('SELECT kind, COUNT(*) c FROM places GROUP BY kind ORDER BY c DESC')
      .all();
  }

  /** Tam metin arama (FTS5). */
  search(query, { kind, limit = 50 } = {}) {
    const sql = `SELECT p.* FROM places_fts f JOIN places p ON p.rowid = f.rowid WHERE places_fts MATCH ? ${kind ? 'AND p.kind = ?' : ''} ORDER BY rank LIMIT ?`;
    const args = kind ? [`${query}*`, kind, limit] : [`${query}*`, limit];
    return this.db
      .prepare(sql)
      .all(...args)
      .map(rowToPlace);
  }

  /** Kaba kutu ile yakın yerler; mesafe hesabı JS'te. */
  nearby(lat, lng, radiusKm, { kind, limit = 100 } = {}) {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const sql = `SELECT * FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? ${kind ? 'AND kind = ?' : ''} LIMIT ?`;
    const args = kind
      ? [lat - dLat, lat + dLat, lng - dLng, lng + dLng, kind, limit * 4]
      : [lat - dLat, lat + dLat, lng - dLng, lng + dLng, limit * 4];
    return this.db
      .prepare(sql)
      .all(...args)
      .map(rowToPlace)
      .map((p) => ({ ...p, distanceKm: haversine(lat, lng, p.lat, p.lng) }))
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }

  all({ kind, limit = 1000, offset = 0 } = {}) {
    const sql = `SELECT * FROM places ${kind ? 'WHERE kind = ?' : ''} ORDER BY (image_url IS NULL), (description IS NULL), name LIMIT ? OFFSET ?`;
    const args = kind ? [kind, limit, offset] : [limit, offset];
    return this.db
      .prepare(sql)
      .all(...args)
      .map(rowToPlace);
  }

  /** Görseli olmayan ama Commons dosya adı olan kayıtlar */
  needingImages(limit) {
    return this.db
      .prepare('SELECT * FROM places WHERE commons_file IS NOT NULL AND image_url IS NULL LIMIT ?')
      .all(limit)
      .map(rowToPlace);
  }

  setImage(id, image) {
    this.db
      .prepare(
        'UPDATE places SET image_url = ?, image_thumb_url = ?, image_license = ?, image_author = ?, image_attribution = ? WHERE id = ?',
      )
      .run(image.url, image.thumbUrl, image.license, image.author, image.attribution, id);
  }

  close() {
    this.db.close();
  }
}

export function rowToPlace(row) {
  return {
    id: row.id,
    source: row.source,
    kind: row.kind,
    group: row.group,
    name: row.name,
    names: JSON.parse(row.names),
    adventureTypes: JSON.parse(row.adventure_types),
    lat: row.lat,
    lng: row.lng,
    elevationM: row.elevation_m,
    description: row.description,
    website: row.website,
    phone: row.phone,
    openingHours: row.opening_hours,
    countryCode: row.country_code,
    tags: JSON.parse(row.tags),
    wikidataId: row.wikidata_id,
    commonsFile: row.commons_file,
    image: row.image_url
      ? {
          url: row.image_url,
          thumbUrl: row.image_thumb_url,
          license: row.image_license,
          author: row.image_author,
          attribution: row.image_attribution,
        }
      : null,
    license: row.license,
    attribution: row.attribution,
    updatedAt: row.updated_at,
  };
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
