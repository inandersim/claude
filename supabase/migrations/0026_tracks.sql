-- =====================================================================
-- Zirtan — 0026 · İzler (tracks), POI'ler, topluluk rotaları
-- Sözleşme: TrackRepository
-- İş kuralları (repos/tracks.ts):
--   · 172 → parça en az iki nokta içermeli
--   · 275/297 → yalnızca kendi parçanı yayınlar/silersin
--   · 340/409 → aynı rotayı/noktayı iki kez doğrulayamazsın
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- community_trails — birden çok parçadan türeyen "sanal yol"
-- (tracks.community_trail_id bu tabloya bakar; önce oluşturulur)
-- --------------------------------------------------------------------
CREATE TABLE community_trails (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  adventure_type adventure_type NOT NULL,
  -- [{latitude, longitude, elevationM, t}]
  points         jsonb NOT NULL DEFAULT '[]'::jsonb,
  path           geography(LineString, 4326),
  distance_km    numeric(8, 2) NOT NULL DEFAULT 0,
  ascent_m       integer NOT NULL DEFAULT 0,
  descent_m      integer NOT NULL DEFAULT 0,
  track_count    integer NOT NULL DEFAULT 0 CHECK (track_count >= 0),
  verified_count integer NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  popularity     numeric(8, 2) NOT NULL DEFAULT 0,
  region_name    text NOT NULL DEFAULT '',
  country_code   char(2),
  bbox           double precision[4],
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_trails_path_gix    ON community_trails USING GIST (path);
CREATE INDEX community_trails_type_idx    ON community_trails (adventure_type);
CREATE INDEX community_trails_popular_idx ON community_trails (popularity DESC);
CREATE INDEX community_trails_name_trgm   ON community_trails USING GIN (name gin_trgm_ops);
CREATE INDEX community_trails_country_idx ON community_trails (country_code);

CREATE OR REPLACE FUNCTION sync_points_path() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.path := geo_linestring(NEW.points);
  RETURN NEW;
END $$;

CREATE TRIGGER community_trails_sync_path
  BEFORE INSERT OR UPDATE OF points ON community_trails
  FOR EACH ROW EXECUTE FUNCTION sync_points_path();

CREATE TABLE tracks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  adventure_type     adventure_type NOT NULL,
  source             track_source NOT NULL DEFAULT 'recorded',
  status             track_status NOT NULL DEFAULT 'draft',
  points             jsonb NOT NULL,
  path               geography(LineString, 4326),
  distance_km        numeric(8, 2) NOT NULL DEFAULT 0,
  ascent_m           integer NOT NULL DEFAULT 0,
  descent_m          integer NOT NULL DEFAULT 0,
  duration_min       integer NOT NULL DEFAULT 0,
  max_elevation_m    integer,
  started_at         timestamptz NOT NULL DEFAULT now(),
  region_name        text NOT NULL DEFAULT '',
  country_code       char(2),
  is_public          boolean NOT NULL DEFAULT false,
  likes_count        integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  community_trail_id uuid REFERENCES community_trails (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracks_min_two_points CHECK (jsonb_array_length(points) >= 2)
);
CREATE INDEX tracks_user_idx      ON tracks (user_id, created_at DESC);
CREATE INDEX tracks_public_idx    ON tracks (created_at DESC) WHERE is_public;
CREATE INDEX tracks_path_gix      ON tracks USING GIST (path);
CREATE INDEX tracks_type_idx      ON tracks (adventure_type);
CREATE INDEX tracks_name_trgm     ON tracks USING GIN (name gin_trgm_ops);
CREATE INDEX tracks_trail_idx     ON tracks (community_trail_id) WHERE community_trail_id IS NOT NULL;

CREATE TRIGGER tracks_sync_path BEFORE INSERT OR UPDATE OF points ON tracks
  FOR EACH ROW EXECUTE FUNCTION sync_points_path();

CREATE TABLE track_pois (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id           uuid REFERENCES tracks (id) ON DELETE CASCADE,
  community_trail_id uuid REFERENCES community_trails (id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  kind               poi_kind NOT NULL,
  coords             geography(Point, 4326) NOT NULL,
  elevation_m        integer,
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  note               text NOT NULL DEFAULT '',
  photo_url          text,
  source             poi_source NOT NULL DEFAULT 'user',
  -- Kaynak medya (an/yayın/gönderi) kimliği; çok tablolu, FK yok
  media_id           text,
  confirmations      integer NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX track_pois_coords_gix ON track_pois USING GIST (coords);
CREATE INDEX track_pois_track_idx  ON track_pois (track_id) WHERE track_id IS NOT NULL;
CREATE INDEX track_pois_trail_idx  ON track_pois (community_trail_id)
  WHERE community_trail_id IS NOT NULL;
CREATE INDEX track_pois_kind_idx   ON track_pois (kind);
CREATE INDEX track_pois_user_idx   ON track_pois (user_id);
CREATE INDEX track_pois_name_trgm  ON track_pois USING GIN (name gin_trgm_ops);

CREATE TABLE poi_confirmations (
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  poi_id       uuid NOT NULL REFERENCES track_pois (id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, poi_id)
);
CREATE INDEX poi_confirmations_poi_idx ON poi_confirmations (poi_id);

CREATE TABLE trail_verifications (
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  trail_id    uuid NOT NULL REFERENCES community_trails (id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trail_id)
);
CREATE INDEX trail_verifications_trail_idx ON trail_verifications (trail_id);

CREATE TABLE track_likes (
  user_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  liked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX track_likes_track_idx ON track_likes (track_id);
