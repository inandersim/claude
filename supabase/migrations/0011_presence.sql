-- =====================================================================
-- Zirtan — 0011 · Canlı konum paylaşımı
-- Sözleşme: PresenceRepository
-- Görünürlük (domain/presence.ts → visibleShares):
--   · friends → KARŞILIKLI takip
--   · matches → KABUL EDİLMİŞ eşleşme
--   · sos     → acil kişiler (+ demo modunda herkes)
-- Kullanıcı başına EN FAZLA BİR aktif paylaşım (mock: shares filtrelenip
-- yeniden eklenir) → birincil anahtar user_id.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE location_shares (
  user_id     uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  coords      geography(Point, 4326) NOT NULL,
  mode        share_mode  NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  battery_pct smallint CHECK (battery_pct BETWEEN 0 AND 100),
  altitude_m  integer,
  speed_kmh   numeric(6, 2)
);
CREATE INDEX location_shares_coords_gix ON location_shares USING GIST (coords);
CREATE INDEX location_shares_active_idx ON location_shares (mode, updated_at DESC);
CREATE INDEX location_shares_expiry_idx ON location_shares (expires_at)
  WHERE expires_at IS NOT NULL;

-- İz kaydı: konum geçmişi (arama-kurtarma için son bilinen noktalar)
CREATE TABLE location_pings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  coords      geography(Point, 4326) NOT NULL,
  altitude_m  integer,
  speed_kmh   numeric(6, 2),
  battery_pct smallint CHECK (battery_pct BETWEEN 0 AND 100),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX location_pings_user_time_idx ON location_pings (user_id, recorded_at DESC);
CREATE INDEX location_pings_coords_gix    ON location_pings USING GIST (coords);

COMMENT ON TABLE location_pings IS
  'Son 72 saatin konum izi; pg_cron ile budanır (bkz. supabase/README.md).';
