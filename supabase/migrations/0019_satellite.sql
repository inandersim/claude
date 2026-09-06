-- =====================================================================
-- Zirtan — 0019 · Uydu bağlantısı (cihaz / mesaj / SOS oturumu)
-- Sözleşme: SatelliteRepository
-- İş kuralları (repos/satellite.ts):
--   · 119 → IMEI 15 haneli olmalı
--   · 237 → aynı anda tek aktif SOS
--   · 238 → bağlantı yoksa SOS gönderilemez
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE sat_devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type             sat_device_type NOT NULL,
  name             text NOT NULL CHECK (length(btrim(name)) > 0),
  imei             text CHECK (imei IS NULL OR imei ~ '^\d{15}$'),
  battery_pct      smallint CHECK (battery_pct BETWEEN 0 AND 100),
  paired_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz,
  monthly_quota    integer NOT NULL DEFAULT 0 CHECK (monthly_quota >= 0),
  used_this_month  integer NOT NULL DEFAULT 0 CHECK (used_this_month >= 0),
  quota_reset_at   date NOT NULL DEFAULT date_trunc('month', now() + interval '1 month')::date
);
CREATE INDEX sat_devices_user_idx ON sat_devices (user_id, paired_at DESC);
-- Aynı IMEI iki hesaba bağlanamaz.
CREATE UNIQUE INDEX sat_devices_imei_key ON sat_devices (imei) WHERE imei IS NOT NULL;

CREATE TABLE sat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- Cihaz silinse de mesaj geçmişi korunur
  device_id    uuid REFERENCES sat_devices (id) ON DELETE SET NULL,
  kind         sat_message_kind   NOT NULL,
  -- Uydu bant genişliği: gövde 160 karakteri aşamaz
  body         text NOT NULL CHECK (length(body) <= 160),
  coords       geography(Point, 4326),
  to_contacts  text[] NOT NULL DEFAULT '{}',
  status       sat_message_status NOT NULL DEFAULT 'queued',
  link         link_type NOT NULL DEFAULT 'satellite',
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts     smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  CONSTRAINT sat_messages_delivered_consistency CHECK (
    (status = 'delivered') = (delivered_at IS NOT NULL)
  )
);
CREATE INDEX sat_messages_user_idx    ON sat_messages (user_id, created_at DESC);
CREATE INDEX sat_messages_queue_idx   ON sat_messages (created_at) WHERE status IN ('queued', 'sending');
CREATE INDEX sat_messages_device_idx  ON sat_messages (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX sat_messages_coords_gix  ON sat_messages USING GIST (coords);

CREATE TABLE sos_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  stage            sos_stage NOT NULL DEFAULT 'armed',
  coords           geography(Point, 4326) NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- [{stage, at, note}] aşama geçmişi
  timeline         jsonb NOT NULL DEFAULT '[]'::jsonb,
  rescue_center_id uuid REFERENCES emergency_centers (id) ON DELETE SET NULL,
  link             link_type NOT NULL DEFAULT 'satellite'
);
-- Kullanıcı başına tek aktif oturum (satellite.ts:237)
CREATE UNIQUE INDEX sos_sessions_one_active_idx ON sos_sessions (user_id)
  WHERE stage <> 'resolved';
CREATE INDEX sos_sessions_user_idx   ON sos_sessions (user_id, started_at DESC);
CREATE INDEX sos_sessions_stage_idx  ON sos_sessions (stage, updated_at DESC);
CREATE INDEX sos_sessions_coords_gix ON sos_sessions USING GIST (coords);
CREATE INDEX sos_sessions_center_idx ON sos_sessions (rescue_center_id)
  WHERE rescue_center_id IS NOT NULL;

CREATE TRIGGER sos_sessions_touch BEFORE UPDATE ON sos_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Aşama değişimini timeline'a yaz.
CREATE OR REPLACE FUNCTION append_sos_timeline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.timeline := NEW.timeline || jsonb_build_object(
      'stage', NEW.stage::text, 'at', now(), 'note', ''
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sos_sessions_timeline BEFORE UPDATE OF stage ON sos_sessions
  FOR EACH ROW EXECUTE FUNCTION append_sos_timeline();
