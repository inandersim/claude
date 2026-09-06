-- =====================================================================
-- Zirtan — 0006 · Tehlikeli bölgeler
-- Sözleşme: HazardRepository
-- İş kuralları (provider.ts:679-704):
--   · Kendi bildirdiğin tehlikeyi ONAYLAYAMAZSIN.
--   · Yalnızca BİLDİREN "çözüldü" işaretleyebilir.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE hazards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          hazard_type     NOT NULL,
  severity      hazard_severity NOT NULL,
  status        hazard_status   NOT NULL DEFAULT 'active',
  title         text NOT NULL CHECK (length(btrim(title)) > 0),
  description   text NOT NULL DEFAULT '',
  location_name text NOT NULL DEFAULT '',
  coords        geography(Point, 4326) NOT NULL,
  radius_m      integer NOT NULL DEFAULT 500 CHECK (radius_m BETWEEN 10 AND 50000),
  reporter_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  confirmations integer NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  resolved_at   timestamptz,
  CONSTRAINT hazards_resolved_consistency CHECK (
    (status = 'resolved') = (resolved_at IS NOT NULL)
  )
);
-- Yakındaki aktif tehlikeler: ST_DWithin(coords, ...) + status süzgeci
CREATE INDEX hazards_coords_gix   ON hazards USING GIST (coords);
CREATE INDEX hazards_active_idx   ON hazards (created_at DESC) WHERE status = 'active';
CREATE INDEX hazards_reporter_idx ON hazards (reporter_id);
CREATE INDEX hazards_expiry_idx   ON hazards (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX hazards_title_trgm   ON hazards USING GIN (title gin_trgm_ops);

CREATE TABLE hazard_confirmations (
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  hazard_id    uuid NOT NULL REFERENCES hazards (id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hazard_id)
);
CREATE INDEX hazard_confirmations_hazard_idx ON hazard_confirmations (hazard_id);

-- Kendi bildirimini onaylamayı veritabanı seviyesinde de engelle.
CREATE OR REPLACE FUNCTION forbid_self_hazard_confirm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM hazards h
             WHERE h.id = NEW.hazard_id AND h.reporter_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Kendi bildirdiğin tehlikeyi onaylayamazsın.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hazard_confirmations_no_self BEFORE INSERT ON hazard_confirmations
  FOR EACH ROW EXECUTE FUNCTION forbid_self_hazard_confirm();
