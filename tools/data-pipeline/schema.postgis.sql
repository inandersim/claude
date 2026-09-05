-- Zirve kütüphanesi — PostgreSQL + PostGIS şeması
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS places (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL,
  kind             TEXT NOT NULL,
  "group"          TEXT NOT NULL,
  name             TEXT NOT NULL,
  names            JSONB NOT NULL DEFAULT '{}'::jsonb,
  adventure_types  TEXT[] NOT NULL DEFAULT '{}',
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  geom             GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  elevation_m      REAL,
  description      TEXT,
  website          TEXT,
  phone            TEXT,
  opening_hours    TEXT,
  country_code     CHAR(2),
  tags             JSONB NOT NULL DEFAULT '{}'::jsonb,
  wikidata_id      TEXT,
  commons_file     TEXT,
  image_url        TEXT,
  image_thumb_url  TEXT,
  image_license    TEXT,
  image_author     TEXT,
  image_attribution TEXT,
  license          TEXT NOT NULL,
  attribution      TEXT NOT NULL,
  dedupe_key       TEXT NOT NULL UNIQUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS places_geom_idx ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS places_kind_idx ON places (kind);
CREATE INDEX IF NOT EXISTS places_country_idx ON places (country_code);
CREATE INDEX IF NOT EXISTS places_name_trgm_idx ON places USING GIN (name gin_trgm_ops);

-- Yakındaki yerler: SELECT * FROM places WHERE ST_DWithin(geom, ST_MakePoint(:lng,:lat)::geography, :meters) ORDER BY geom <-> ST_MakePoint(:lng,:lat)::geography LIMIT 50;
