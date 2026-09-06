-- =====================================================================
-- Zirtan — 0027 · Hava durumu ve çığ bülteni önbelleği
-- Sözleşme: WeatherRepository (forecast, elevation, avalanche)
-- Açık veri sağlayıcılarının (Open-Meteo, EAWS) yanıtları burada
-- önbelleklenir; istemci hız/kota için doğrudan tabloyu okur.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE weather_cache (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 0.05° (≈5 km) yuvarlanmış hücre anahtarı: önbellek isabetini artırır
  cell_lat    numeric(6, 2) NOT NULL,
  cell_lng    numeric(6, 2) NOT NULL,
  elevation_m integer,
  timezone    text NOT NULL DEFAULT 'UTC',
  source      text NOT NULL DEFAULT 'open-meteo',
  hourly      jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily       jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerts      jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  UNIQUE (cell_lat, cell_lng, elevation_m)
);
CREATE INDEX weather_cache_expiry_idx ON weather_cache (expires_at);

CREATE TABLE elevation_cache (
  cell_lat    numeric(7, 3) NOT NULL,
  cell_lng    numeric(7, 3) NOT NULL,
  elevation_m integer,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cell_lat, cell_lng)
);

CREATE TABLE avalanche_bulletins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code   text NOT NULL,
  region_name   text NOT NULL DEFAULT '',
  -- Bültenin kapsadığı alan; ST_Intersects ile eşlenir
  area          geography(Polygon, 4326),
  valid_from    timestamptz NOT NULL,
  valid_to      timestamptz NOT NULL,
  danger_level  smallint NOT NULL CHECK (danger_level BETWEEN 1 AND 5),
  -- {elevationM, level}
  danger_above  jsonb,
  problems      text[] NOT NULL DEFAULT '{}',
  summary       text NOT NULL DEFAULT '',
  source        avalanche_source NOT NULL DEFAULT 'eaws',
  url           text,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avalanche_bulletins_window CHECK (valid_to > valid_from),
  UNIQUE (region_code, valid_from)
);
CREATE INDEX avalanche_bulletins_area_gix   ON avalanche_bulletins USING GIST (area);
CREATE INDEX avalanche_bulletins_valid_idx  ON avalanche_bulletins (valid_to DESC);
