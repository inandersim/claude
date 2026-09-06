-- =====================================================================
-- Zirtan — 0015 · Acil durum, kurtarma merkezleri, SOS
-- Sözleşme: EmergencyRepository
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE emergency_centers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          emergency_center_type NOT NULL,
  coords        geography(Point, 4326) NOT NULL,
  location_name text NOT NULL DEFAULT '',
  phone         text,
  open_24h      boolean NOT NULL DEFAULT false,
  country_code  char(2) NOT NULL,
  -- SOS sevk kuyruğu için doğrulanmış merkezler
  is_verified   boolean NOT NULL DEFAULT false,
  contact_email text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- centers(origin, limit) → en yakın N merkez
CREATE INDEX emergency_centers_coords_gix  ON emergency_centers USING GIST (coords);
CREATE INDEX emergency_centers_country_idx ON emergency_centers (country_code, type);
CREATE INDEX emergency_centers_name_trgm   ON emergency_centers USING GIN (name gin_trgm_ops);

-- --------------------------------------------------------------------
-- sos_events — domain: SosEvent (uygulama içi hızlı SOS)
-- Kullanıcı başına aynı anda tek AÇIK olay.
-- --------------------------------------------------------------------
CREATE TABLE sos_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  coords            geography(Point, 4326) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  notified_contacts integer NOT NULL DEFAULT 0 CHECK (notified_contacts >= 0),
  -- sos-dispatch edge fonksiyonunun eşlediği merkez
  center_id         uuid REFERENCES emergency_centers (id) ON DELETE SET NULL,
  dispatched_at     timestamptz,
  note              text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX sos_events_one_active_idx ON sos_events (user_id)
  WHERE resolved_at IS NULL;
CREATE INDEX sos_events_user_idx   ON sos_events (user_id, created_at DESC);
CREATE INDEX sos_events_coords_gix ON sos_events USING GIST (coords);
CREATE INDEX sos_events_open_idx   ON sos_events (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX sos_events_center_idx ON sos_events (center_id) WHERE center_id IS NOT NULL;

-- İlk yardım rehberleri (statik içerik; çok dilli)
CREATE TABLE first_aid_guides (
  slug           text PRIMARY KEY,
  category       first_aid_category NOT NULL,
  locale         text NOT NULL DEFAULT 'tr',
  title          text NOT NULL,
  summary        text NOT NULL DEFAULT '',
  steps          text[] NOT NULL DEFAULT '{}',
  donts          text[] NOT NULL DEFAULT '{}',
  call_help_when text NOT NULL DEFAULT '',
  icon           text NOT NULL DEFAULT 'triangle-alert',
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX first_aid_guides_category_idx ON first_aid_guides (category, locale);
