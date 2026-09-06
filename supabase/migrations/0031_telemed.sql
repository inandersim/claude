-- =====================================================================
-- Zirtan — 0031 · Tele-tıp (doktor, konsültasyon, mesaj)
-- Sözleşme: TelemedRepository
-- İş kuralları (repos/telemed.ts):
--   · 114 → taraf = hasta VEYA konsültasyonun doktoru
--   · 206 → aynı anda tek açık danışma
--   · 282 → kapalı danışmaya mesaj gönderilemez
--   · 326 → yalnızca 'requested' talep kabul edilebilir
-- SAĞLIK VERİSİ: RLS en dar kapsamda (yalnızca hasta ve atanan doktor).
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE doctors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  title                text NOT NULL DEFAULT '',
  specialties          doctor_specialty[] NOT NULL DEFAULT '{}',
  languages            text[] NOT NULL DEFAULT '{}',
  license_no           text NOT NULL,
  institution          text NOT NULL DEFAULT '',
  is_verified          boolean NOT NULL DEFAULT false,
  is_online            boolean NOT NULL DEFAULT false,
  response_min         integer NOT NULL DEFAULT 15 CHECK (response_min >= 0),
  rating               numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  consult_count        integer NOT NULL DEFAULT 0 CHECK (consult_count >= 0),
  volunteer            boolean NOT NULL DEFAULT false,
  price_try_per_consult numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_try_per_consult >= 0),
  country_codes        text[] NOT NULL DEFAULT '{}',
  bio                  text NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (license_no)
);
CREATE INDEX doctors_online_idx      ON doctors (rating DESC) WHERE is_online AND is_verified;
CREATE INDEX doctors_specialties_gin ON doctors USING GIN (specialties);
CREATE INDEX doctors_countries_gin   ON doctors USING GIN (country_codes);

CREATE TRIGGER doctors_touch BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE consultations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- Doktor silinse de hasta kaydı korunur
  doctor_id      uuid REFERENCES doctors (id) ON DELETE SET NULL,
  urgency        consult_urgency NOT NULL DEFAULT 'medium',
  complaint      text NOT NULL CHECK (length(btrim(complaint)) >= 3),
  triage         text[] NOT NULL DEFAULT '{}',
  first_aid_slug text REFERENCES first_aid_guides (slug) ON DELETE SET NULL,
  species_id     uuid REFERENCES species (id) ON DELETE SET NULL,
  coords         geography(Point, 4326),
  status         consult_status  NOT NULL DEFAULT 'requested',
  channel        consult_channel NOT NULL DEFAULT 'chat',
  created_at     timestamptz NOT NULL DEFAULT now(),
  accepted_at    timestamptz,
  ended_at       timestamptz,
  summary        text,
  CONSTRAINT consultations_accepted_has_doctor CHECK (
    status IN ('requested', 'cancelled') OR doctor_id IS NOT NULL
  ),
  CONSTRAINT consultations_ended_consistency CHECK (
    (status = 'completed') = (ended_at IS NOT NULL)
  )
);
-- Aynı anda tek açık danışma (telemed.ts:206)
CREATE UNIQUE INDEX consultations_one_open_idx ON consultations (patient_id)
  WHERE status IN ('requested', 'active');
CREATE INDEX consultations_patient_idx ON consultations (patient_id, created_at DESC);
CREATE INDEX consultations_doctor_idx  ON consultations (doctor_id, created_at DESC)
  WHERE doctor_id IS NOT NULL;
CREATE INDEX consultations_queue_idx   ON consultations (urgency, created_at)
  WHERE status = 'requested';
CREATE INDEX consultations_coords_gix  ON consultations USING GIST (coords);
CREATE INDEX consultations_species_idx ON consultations (species_id) WHERE species_id IS NOT NULL;
CREATE INDEX consultations_first_aid_idx ON consultations (first_aid_slug)
  WHERE first_aid_slug IS NOT NULL;

CREATE TABLE consult_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations (id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content         text NOT NULL DEFAULT '',
  image_url       text,
  -- Doktor talimatı (arayüzde vurgulanır)
  is_instruction  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consult_messages_not_empty CHECK (
    length(btrim(content)) > 0 OR image_url IS NOT NULL
  )
);
CREATE INDEX consult_messages_consult_idx ON consult_messages (consultation_id, created_at);
CREATE INDEX consult_messages_sender_idx  ON consult_messages (sender_id);

-- Konsültasyon tarafı mı? (telemed.ts:114 → isParticipant)
CREATE OR REPLACE FUNCTION is_consult_participant(consult uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM consultations c
    LEFT JOIN doctors d ON d.id = c.doctor_id
    WHERE c.id = consult AND (c.patient_id = viewer OR d.user_id = viewer)
  )
$$;

-- Kapalı danışmaya mesaj gönderilemez (telemed.ts:282)
CREATE OR REPLACE FUNCTION require_open_consultation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM consultations c
                 WHERE c.id = NEW.consultation_id
                   AND c.status IN ('requested', 'active')) THEN
    RAISE EXCEPTION 'Bu danışmaya mesaj gönderilemez.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER consult_messages_require_open BEFORE INSERT ON consult_messages
  FOR EACH ROW EXECUTE FUNCTION require_open_consultation();
