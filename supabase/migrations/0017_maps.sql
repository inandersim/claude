-- =====================================================================
-- Zirtan — 0017 · Çevrimdışı haritalar & rota motoru
-- Sözleşme: MapsRepository
-- Patika grafı düğüm/kenar olarak normalize edilir; rota planlayıcı
-- sunucu tarafında da çalışabilsin diye kenarlar coğrafi tutulur.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE map_regions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  country_code char(2) NOT NULL,
  center       geography(Point, 4326) NOT NULL,
  bbox         geography(Polygon, 4326),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX map_regions_center_gix  ON map_regions USING GIST (center);
CREATE INDEX map_regions_country_idx ON map_regions (country_code);

CREATE TABLE trail_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   uuid NOT NULL REFERENCES map_regions (id) ON DELETE CASCADE,
  coords      geography(Point, 4326) NOT NULL,
  elevation_m integer NOT NULL DEFAULT 0,
  name        text
);
CREATE INDEX trail_nodes_region_idx ON trail_nodes (region_id);
CREATE INDEX trail_nodes_coords_gix ON trail_nodes USING GIST (coords);

CREATE TABLE trail_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   uuid NOT NULL REFERENCES map_regions (id) ON DELETE CASCADE,
  from_node   uuid NOT NULL REFERENCES trail_nodes (id) ON DELETE CASCADE,
  to_node     uuid NOT NULL REFERENCES trail_nodes (id) ON DELETE CASCADE,
  distance_km numeric(8, 3) NOT NULL CHECK (distance_km >= 0),
  surface     surface NOT NULL,
  -- Bu kenarı kullanabilen profiller
  profiles    route_profile[] NOT NULL DEFAULT '{}',
  -- 0..1, 1 = teknik
  technical   numeric(3, 2) NOT NULL DEFAULT 0 CHECK (technical BETWEEN 0 AND 1),
  geom        geography(LineString, 4326),
  CONSTRAINT trail_edges_no_loop CHECK (from_node <> to_node)
);
CREATE INDEX trail_edges_region_idx   ON trail_edges (region_id);
CREATE INDEX trail_edges_from_idx     ON trail_edges (from_node);
CREATE INDEX trail_edges_to_idx       ON trail_edges (to_node);
CREATE INDEX trail_edges_profiles_gin ON trail_edges USING GIN (profiles);
CREATE INDEX trail_edges_geom_gix     ON trail_edges USING GIST (geom);

CREATE TABLE map_packs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    uuid REFERENCES map_regions (id) ON DELETE SET NULL,
  name         text NOT NULL,
  country_code char(2) NOT NULL,
  -- [minLng, minLat, maxLng, maxLat]
  bbox         double precision[4] NOT NULL,
  size_mb      numeric(8, 2) NOT NULL CHECK (size_mb >= 0),
  version      text NOT NULL,
  format       map_pack_format NOT NULL DEFAULT 'pmtiles',
  -- İndirme adresi (Storage veya CDN)
  url          text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
CREATE INDEX map_packs_country_idx ON map_packs (country_code);
CREATE INDEX map_packs_region_idx  ON map_packs (region_id) WHERE region_id IS NOT NULL;

COMMENT ON TABLE map_packs IS
  'Paket kataloğu sunucuda; indirme durumu (status/progress/localPath) CİHAZDA tutulur.';

-- Kullanıcının cihaz başına indirme durumu (MapPack.status/progress)
CREATE TABLE map_pack_downloads (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  pack_id    uuid NOT NULL REFERENCES map_packs (id) ON DELETE CASCADE,
  status     map_pack_status NOT NULL DEFAULT 'available',
  progress   numeric(4, 3) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pack_id)
);
CREATE INDEX map_pack_downloads_pack_idx ON map_pack_downloads (pack_id);

CREATE TABLE saved_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  region_id     uuid REFERENCES map_regions (id) ON DELETE SET NULL,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  route_profile route_profile NOT NULL,
  -- PlannedRoute: {nodeIds, points, distanceKm, ascentM, ...}
  planned       jsonb NOT NULL,
  path          geography(LineString, 4326),
  distance_km   numeric(8, 2) NOT NULL DEFAULT 0,
  ascent_m      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_routes_user_idx  ON saved_routes (user_id, created_at DESC);
CREATE INDEX saved_routes_path_gix  ON saved_routes USING GIST (path);
CREATE INDEX saved_routes_region_idx ON saved_routes (region_id) WHERE region_id IS NOT NULL;

-- planned.points → path senkronu
CREATE OR REPLACE FUNCTION sync_saved_route_path() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.path := geo_linestring(NEW.planned -> 'points');
  RETURN NEW;
END $$;

CREATE TRIGGER saved_routes_sync_path BEFORE INSERT OR UPDATE OF planned ON saved_routes
  FOR EACH ROW EXECUTE FUNCTION sync_saved_route_path();
