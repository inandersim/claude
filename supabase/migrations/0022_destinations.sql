-- =====================================================================
-- Zirtan — 0022 · Destinasyon arşivi, aşamalar, AMS, dönüş sözü
-- Sözleşme: DestinationRepository
-- İş kuralları (repos/destinations.ts):
--   · 116 → irtifa 0–9000 m
--   · 198 → iptal edilmiş plan kapatılamaz
--   · 209 → tamamlanmış plan iptal edilemez
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE destinations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  region            text NOT NULL DEFAULT '',
  country_code      char(2) NOT NULL,
  type              destination_type NOT NULL,
  adventure_types   adventure_type[] NOT NULL DEFAULT '{}',
  coords            geography(Point, 4326) NOT NULL,
  image_url         text,
  summary           text NOT NULL DEFAULT '',
  guide             text NOT NULL DEFAULT '',
  max_elevation_m   integer NOT NULL DEFAULT 0 CHECK (max_elevation_m BETWEEN 0 AND 9000),
  typical_days      smallint NOT NULL DEFAULT 1 CHECK (typical_days > 0),
  total_distance_km numeric(8, 2) NOT NULL DEFAULT 0 CHECK (total_distance_km >= 0),
  difficulty        difficulty_grade NOT NULL,
  best_months       smallint[] NOT NULL DEFAULT '{}',
  -- [{mode, from, to, durationMin, costTry, note}]
  transports        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{name, costTry, where, note}]
  permits           jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_low_try    numeric(12, 2) NOT NULL DEFAULT 0,
  budget_high_try   numeric(12, 2) NOT NULL DEFAULT 0,
  risks             text[] NOT NULL DEFAULT '{}',
  gear              text[] NOT NULL DEFAULT '{}',
  rescue_note       text NOT NULL DEFAULT '',
  insurance_required boolean NOT NULL DEFAULT false,
  stage_count       integer NOT NULL DEFAULT 0 CHECK (stage_count >= 0),
  rating            numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count      integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  sources           text[] NOT NULL DEFAULT '{}',
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT destinations_budget_order CHECK (budget_high_try >= budget_low_try)
);
CREATE INDEX destinations_coords_gix  ON destinations USING GIST (coords);
CREATE INDEX destinations_country_idx ON destinations (country_code);
CREATE INDEX destinations_type_idx    ON destinations (type);
CREATE INDEX destinations_name_trgm   ON destinations USING GIN (name gin_trgm_ops);
CREATE INDEX destinations_guide_trgm  ON destinations USING GIN (summary gin_trgm_ops);
CREATE INDEX destinations_types_gin   ON destinations USING GIN (adventure_types);
CREATE INDEX destinations_months_gin  ON destinations USING GIN (best_months);

CREATE TABLE destination_stages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
  "order"        smallint NOT NULL CHECK ("order" >= 0),
  name           text NOT NULL,
  kind           stage_kind NOT NULL,
  coords         geography(Point, 4326) NOT NULL,
  elevation_m    integer NOT NULL DEFAULT 0,
  distance_km    numeric(8, 2) NOT NULL DEFAULT 0,
  duration_min   integer NOT NULL DEFAULT 0,
  sleeping       boolean NOT NULL DEFAULT false,
  facilities     text[] NOT NULL DEFAULT '{}',
  water_available boolean NOT NULL DEFAULT false,
  connectivity   stage_connectivity NOT NULL DEFAULT 'none',
  note           text NOT NULL DEFAULT '',
  rest_day_recommended boolean NOT NULL DEFAULT false,
  UNIQUE (destination_id, "order")
);
CREATE INDEX destination_stages_dest_idx  ON destination_stages (destination_id, "order");
CREATE INDEX destination_stages_coords_gix ON destination_stages USING GIST (coords);

CREATE TABLE saved_destinations (
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, destination_id)
);
CREATE INDEX saved_destinations_dest_idx ON saved_destinations (destination_id);

-- --------------------------------------------------------------------
-- ams_checks — Lake Louise AMS öz-değerlendirme (KİŞİSEL SAĞLIK VERİSİ)
-- Yalnızca sahibi görebilir (RLS 0100).
-- --------------------------------------------------------------------
CREATE TABLE ams_checks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  destination_id uuid REFERENCES destinations (id) ON DELETE SET NULL,
  elevation_m    integer  NOT NULL CHECK (elevation_m BETWEEN 0 AND 9000),
  headache       smallint NOT NULL CHECK (headache  BETWEEN 0 AND 3),
  gi             smallint NOT NULL CHECK (gi        BETWEEN 0 AND 3),
  fatigue        smallint NOT NULL CHECK (fatigue   BETWEEN 0 AND 3),
  dizziness      smallint NOT NULL CHECK (dizziness BETWEEN 0 AND 3),
  -- score/severity tetikleyiciyle hesaplanır (0200)
  score          smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 12),
  severity       ams_severity NOT NULL DEFAULT 'none',
  note           text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ams_checks_user_idx ON ams_checks (user_id, created_at DESC);
CREATE INDEX ams_checks_dest_idx ON ams_checks (destination_id) WHERE destination_id IS NOT NULL;

-- --------------------------------------------------------------------
-- return_plans — "dönüş sözü": süresi geçerse acil kişilere uyarı gider
-- return-promise-check edge fonksiyonu bu tabloyu tarar.
-- --------------------------------------------------------------------
CREATE TABLE return_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (length(btrim(title)) > 0),
  destination_id    uuid REFERENCES destinations (id) ON DELETE SET NULL,
  adventure_type    adventure_type NOT NULL,
  start_at          timestamptz NOT NULL,
  expected_return_at timestamptz NOT NULL,
  grace_min         integer NOT NULL DEFAULT 60 CHECK (grace_min >= 0),
  route             text NOT NULL DEFAULT '',
  companions        text NOT NULL DEFAULT '',
  contact_ids       uuid[] NOT NULL DEFAULT '{}',
  status            trip_plan_status NOT NULL DEFAULT 'planned',
  returned_at       timestamptz,
  alert_sent_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_plans_time_order CHECK (expected_return_at > start_at),
  CONSTRAINT return_plans_returned_consistency CHECK (
    (status = 'returned') = (returned_at IS NOT NULL)
  )
);
CREATE INDEX return_plans_user_idx ON return_plans (user_id, start_at DESC);
CREATE INDEX return_plans_dest_idx ON return_plans (destination_id)
  WHERE destination_id IS NOT NULL;
-- checkOverdue: süresi geçmiş ama henüz uyarılmamış planlar
CREATE INDEX return_plans_watch_idx ON return_plans (expected_return_at)
  WHERE status IN ('planned', 'active');
CREATE INDEX return_plans_contacts_gin ON return_plans USING GIN (contact_ids);
