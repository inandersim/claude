-- =====================================================================
-- Zirtan — 0033 · Tarihi alanlar, sesli rehber, tur, ziyaret
-- Sözleşme: HeritageRepository
-- İş kuralları (repos/heritage.ts:134-136): tur adı zorunlu, en az 2 alan.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE heritage_sites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  kind                 heritage_kind NOT NULL,
  eras                 heritage_era[] NOT NULL DEFAULT '{}',
  country_code         char(2) NOT NULL,
  region               text NOT NULL DEFAULT '',
  coords               geography(Point, 4326) NOT NULL,
  elevation_m          integer,
  image_url            text,
  summary              text NOT NULL DEFAULT '',
  history              text NOT NULL DEFAULT '',
  is_unesco            boolean NOT NULL DEFAULT false,
  unesco_year          smallint CHECK (unesco_year IS NULL OR unesco_year BETWEEN 1970 AND 2200),
  opening_hours        text NOT NULL DEFAULT '',
  entry_fee_try        numeric(10, 2) CHECK (entry_fee_try IS NULL OR entry_fee_try >= 0),
  museum_pass_valid    boolean NOT NULL DEFAULT false,
  visit_duration_min   integer NOT NULL DEFAULT 60 CHECK (visit_duration_min > 0),
  accessibility        heritage_accessibility NOT NULL DEFAULT 'easy',
  nearest_trailhead    text,
  linked_trail_id      uuid REFERENCES community_trails (id) ON DELETE SET NULL,
  linked_destination_id uuid REFERENCES destinations (id) ON DELETE SET NULL,
  adventure_types      adventure_type[] NOT NULL DEFAULT '{}',
  rules                text[] NOT NULL DEFAULT '{}',
  best_months          smallint[] NOT NULL DEFAULT '{}',
  rating               numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count         integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  sources              text[] NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heritage_sites_unesco_year CHECK (is_unesco OR unesco_year IS NULL)
);
CREATE INDEX heritage_sites_coords_gix  ON heritage_sites USING GIST (coords);
CREATE INDEX heritage_sites_country_idx ON heritage_sites (country_code, kind);
CREATE INDEX heritage_sites_eras_gin    ON heritage_sites USING GIN (eras);
CREATE INDEX heritage_sites_name_trgm   ON heritage_sites USING GIN (name gin_trgm_ops);
CREATE INDEX heritage_sites_unesco_idx  ON heritage_sites (rating DESC) WHERE is_unesco;
CREATE INDEX heritage_sites_trail_idx   ON heritage_sites (linked_trail_id)
  WHERE linked_trail_id IS NOT NULL;
CREATE INDEX heritage_sites_dest_idx    ON heritage_sites (linked_destination_id)
  WHERE linked_destination_id IS NOT NULL;

CREATE TABLE audio_guide_stops (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES heritage_sites (id) ON DELETE CASCADE,
  "order"      smallint NOT NULL CHECK ("order" >= 0),
  title        text NOT NULL,
  coords       geography(Point, 4326),
  duration_sec integer NOT NULL DEFAULT 60 CHECK (duration_sec > 0),
  -- Metin olarak saklanır, cihazda TTS ile okunur
  script       text NOT NULL DEFAULT '',
  image_url    text,
  locale       text NOT NULL DEFAULT 'tr',
  UNIQUE (site_id, "order", locale)
);
CREATE INDEX audio_guide_stops_site_idx   ON audio_guide_stops (site_id, "order");
CREATE INDEX audio_guide_stops_coords_gix ON audio_guide_stops USING GIST (coords);

CREATE TABLE heritage_tours (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title      text NOT NULL CHECK (length(btrim(title)) > 0),
  site_ids   uuid[] NOT NULL CHECK (array_length(site_ids, 1) >= 2),
  date       date,
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX heritage_tours_user_idx  ON heritage_tours (user_id, created_at DESC);
CREATE INDEX heritage_tours_sites_gin ON heritage_tours USING GIN (site_ids);

CREATE TABLE heritage_saves (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES heritage_sites (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX heritage_saves_site_idx ON heritage_saves (site_id);

CREATE TABLE heritage_visits (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES heritage_sites (id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX heritage_visits_site_idx ON heritage_visits (site_id);
