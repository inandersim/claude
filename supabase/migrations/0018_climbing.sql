-- =====================================================================
-- Zirtan — 0018 · Tırmanış veritabanı (kaya / sektör / rota / çıkış)
-- Sözleşme: ClimbingRepository
-- İş kuralları (repos/climbing.ts):
--   · 140 → sektör, rotanın kayasına ait olmalı
--   · 180 → kendi eklediğin rotayı onaylayamazsın
--   · 3+ bağımsız onay → verification = 'community'
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE crags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  location_name text NOT NULL DEFAULT '',
  country_code  char(2) NOT NULL,
  coords        geography(Point, 4326) NOT NULL,
  rock_type     text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  image_url     text,
  climb_types   climb_type[] NOT NULL DEFAULT '{}',
  route_count   integer NOT NULL DEFAULT 0 CHECK (route_count >= 0),
  verification  verification_status NOT NULL DEFAULT 'unverified',
  -- En iyi mevsimler (ay numaraları 1-12)
  seasons       smallint[] NOT NULL DEFAULT '{}',
  approach_min  integer NOT NULL DEFAULT 0 CHECK (approach_min >= 0),
  submitted_by  uuid REFERENCES profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crags_coords_gix   ON crags USING GIST (coords);
CREATE INDEX crags_country_idx  ON crags (country_code);
CREATE INDEX crags_name_trgm    ON crags USING GIN (name gin_trgm_ops);
CREATE INDEX crags_types_gin    ON crags USING GIN (climb_types);
CREATE INDEX crags_verified_idx ON crags (verification);
CREATE INDEX crags_author_idx   ON crags (submitted_by) WHERE submitted_by IS NOT NULL;

CREATE TRIGGER crags_touch BEFORE UPDATE ON crags
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE crag_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crag_id     uuid NOT NULL REFERENCES crags (id) ON DELETE CASCADE,
  name        text NOT NULL,
  orientation text NOT NULL DEFAULT '',
  route_count integer NOT NULL DEFAULT 0 CHECK (route_count >= 0),
  UNIQUE (crag_id, name)
);
CREATE INDEX crag_sectors_crag_idx ON crag_sectors (crag_id);

CREATE TABLE climbing_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crag_id       uuid NOT NULL REFERENCES crags (id) ON DELETE CASCADE,
  sector_id     uuid NOT NULL REFERENCES crag_sectors (id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  type          climb_type   NOT NULL,
  grade         text         NOT NULL,
  grade_system  grade_system NOT NULL,
  length_m      integer CHECK (length_m IS NULL OR length_m > 0),
  pitches       smallint NOT NULL DEFAULT 1 CHECK (pitches > 0),
  bolts         smallint CHECK (bolts IS NULL OR bolts >= 0),
  -- Yıldız: 0–5 (topluluk kalite oyu)
  stars         smallint NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  first_ascent  text,
  description   text NOT NULL DEFAULT '',
  verification  verification_status NOT NULL DEFAULT 'unverified',
  confirmations integer NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  ascent_count  integer NOT NULL DEFAULT 0 CHECK (ascent_count >= 0),
  submitted_by  uuid REFERENCES profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX climbing_routes_crag_idx   ON climbing_routes (crag_id);
CREATE INDEX climbing_routes_sector_idx ON climbing_routes (sector_id);
CREATE INDEX climbing_routes_grade_idx  ON climbing_routes (grade_system, grade);
CREATE INDEX climbing_routes_name_trgm  ON climbing_routes USING GIN (name gin_trgm_ops);
CREATE INDEX climbing_routes_author_idx ON climbing_routes (submitted_by)
  WHERE submitted_by IS NOT NULL;

-- Sektör, rotanın kayasına ait olmalı (climbing.ts:140)
CREATE OR REPLACE FUNCTION check_route_sector_belongs_to_crag() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crag_sectors s
                 WHERE s.id = NEW.sector_id AND s.crag_id = NEW.crag_id) THEN
    RAISE EXCEPTION 'Sektör bu kayaya ait değil.' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER climbing_routes_sector_check
  BEFORE INSERT OR UPDATE OF crag_id, sector_id ON climbing_routes
  FOR EACH ROW EXECUTE FUNCTION check_route_sector_belongs_to_crag();

CREATE TABLE ascents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   uuid NOT NULL REFERENCES climbing_routes (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  style      ascent_style NOT NULL,
  date       date NOT NULL DEFAULT current_date,
  note       text NOT NULL DEFAULT '',
  felt_grade text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ascents_route_idx ON ascents (route_id, date DESC);
CREATE INDEX ascents_user_idx  ON ascents (user_id, date DESC);

CREATE TABLE route_confirmations (
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  route_id     uuid NOT NULL REFERENCES climbing_routes (id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);
CREATE INDEX route_confirmations_route_idx ON route_confirmations (route_id);

-- Kendi eklediğin rotayı onaylayamazsın (climbing.ts:180)
CREATE OR REPLACE FUNCTION forbid_self_route_confirm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM climbing_routes r
             WHERE r.id = NEW.route_id AND r.submitted_by = NEW.user_id) THEN
    RAISE EXCEPTION 'Bu rotayı onaylayamazsın.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER route_confirmations_no_self BEFORE INSERT ON route_confirmations
  FOR EACH ROW EXECUTE FUNCTION forbid_self_route_confirm();
