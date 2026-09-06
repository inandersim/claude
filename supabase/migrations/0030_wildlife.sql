-- =====================================================================
-- Zirtan — 0030 · Türler, canlı tanımlama, soru-cevap, kaçırma sesleri
-- Sözleşme: WildlifeRepository
-- İş kuralı (repos/wildlife.ts:250): cevabı YALNIZCA soru sahibi kabul eder.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE species (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name     text NOT NULL,
  scientific_name text NOT NULL,
  "group"         species_group NOT NULL,
  danger          danger_level  NOT NULL,
  country_codes   text[] NOT NULL DEFAULT '{}',
  habitats        text[] NOT NULL DEFAULT '{}',
  description     text NOT NULL DEFAULT '',
  identification  text[] NOT NULL DEFAULT '{}',
  encounter_do    text[] NOT NULL DEFAULT '{}',
  encounter_dont  text[] NOT NULL DEFAULT '{}',
  first_aid_slug  text REFERENCES first_aid_guides (slug) ON DELETE SET NULL,
  venom_note      text,
  image_url       text,
  lookalikes      text[] NOT NULL DEFAULT '{}',
  active_months   smallint[] NOT NULL DEFAULT '{}',
  active_hours    species_active_hours NOT NULL DEFAULT 'both',
  sources         text[] NOT NULL DEFAULT '{}',
  locale          text NOT NULL DEFAULT 'tr',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scientific_name, locale)
);
CREATE INDEX species_group_idx      ON species ("group", danger);
CREATE INDEX species_common_trgm    ON species USING GIN (common_name gin_trgm_ops);
CREATE INDEX species_scientific_trgm ON species USING GIN (scientific_name gin_trgm_ops);
CREATE INDEX species_countries_gin  ON species USING GIN (country_codes);
CREATE INDEX species_danger_idx     ON species (danger) WHERE danger IN ('dangerous', 'deadly');
CREATE INDEX species_first_aid_idx  ON species (first_aid_slug) WHERE first_aid_slug IS NOT NULL;

CREATE TABLE species_identifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  image_uri  text,
  image_path text,
  -- [{speciesId, name, confidence, danger}] — en olası önce
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  advice     text[] NOT NULL DEFAULT '{}',
  source     advice_source NOT NULL DEFAULT 'local',
  coords     geography(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX species_identifications_user_idx   ON species_identifications (user_id, created_at DESC);
CREATE INDEX species_identifications_coords_gix ON species_identifications USING GIST (coords);

CREATE TABLE wildlife_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (length(btrim(title)) > 0),
  body              text NOT NULL DEFAULT '',
  image_url         text,
  coords            geography(Point, 4326),
  location_name     text NOT NULL DEFAULT '',
  species_guess_id  uuid REFERENCES species (id) ON DELETE SET NULL,
  status            question_status NOT NULL DEFAULT 'open',
  urgent            boolean NOT NULL DEFAULT false,
  answers_count     integer NOT NULL DEFAULT 0 CHECK (answers_count >= 0),
  accepted_answer_id uuid,   -- FK aşağıda (döngüsel)
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wildlife_questions_open_idx   ON wildlife_questions (created_at DESC)
  WHERE status = 'open';
CREATE INDEX wildlife_questions_urgent_idx ON wildlife_questions (created_at DESC)
  WHERE urgent AND status <> 'resolved';
CREATE INDEX wildlife_questions_author_idx ON wildlife_questions (author_id, created_at DESC);
CREATE INDEX wildlife_questions_coords_gix ON wildlife_questions USING GIST (coords);
CREATE INDEX wildlife_questions_title_trgm ON wildlife_questions USING GIN (title gin_trgm_ops);
CREATE INDEX wildlife_questions_species_idx ON wildlife_questions (species_guess_id)
  WHERE species_guess_id IS NOT NULL;

CREATE TABLE wildlife_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES wildlife_questions (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  species_id  uuid REFERENCES species (id) ON DELETE SET NULL,
  upvotes     integer NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  is_expert   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wildlife_answers_question_idx ON wildlife_answers (question_id, upvotes DESC);
CREATE INDEX wildlife_answers_author_idx   ON wildlife_answers (author_id);
CREATE INDEX wildlife_answers_species_idx  ON wildlife_answers (species_id)
  WHERE species_id IS NOT NULL;

ALTER TABLE wildlife_questions
  ADD CONSTRAINT wildlife_questions_accepted_fkey
  FOREIGN KEY (accepted_answer_id) REFERENCES wildlife_answers (id) ON DELETE SET NULL;
CREATE INDEX wildlife_questions_accepted_idx ON wildlife_questions (accepted_answer_id)
  WHERE accepted_answer_id IS NOT NULL;

CREATE TABLE answer_upvotes (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  answer_id  uuid NOT NULL REFERENCES wildlife_answers (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, answer_id)
);
CREATE INDEX answer_upvotes_answer_idx ON answer_upvotes (answer_id);

-- Kaçırma sesi profilleri (statik referans)
CREATE TABLE deterrent_profiles (
  animal         deterrent_animal PRIMARY KEY,
  -- [{sound, effectiveness, note}]
  sounds         jsonb NOT NULL DEFAULT '[]'::jsonb,
  behavior_do    text[] NOT NULL DEFAULT '{}',
  behavior_dont  text[] NOT NULL DEFAULT '{}',
  warnings       text[] NOT NULL DEFAULT '{}',
  evidence       text NOT NULL DEFAULT '',
  locale         text NOT NULL DEFAULT 'tr',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deterrent_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  animal     deterrent_animal NOT NULL,
  sound      deterrent_sound  NOT NULL,
  coords     geography(Point, 4326),
  duration_s integer NOT NULL DEFAULT 0 CHECK (duration_s >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deterrent_events_user_idx   ON deterrent_events (user_id, created_at DESC);
-- Hayvan sıcak noktaları (haritada uyarı katmanı)
CREATE INDEX deterrent_events_coords_gix ON deterrent_events USING GIST (coords);
CREATE INDEX deterrent_events_animal_idx ON deterrent_events (animal, created_at DESC);

-- Cevabı yalnızca soru sahibi kabul edebilir (wildlife.ts:250)
CREATE OR REPLACE FUNCTION check_answer_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.accepted_answer_id IS NOT NULL
     AND NEW.accepted_answer_id IS DISTINCT FROM OLD.accepted_answer_id THEN
    IF NOT EXISTS (SELECT 1 FROM wildlife_answers a
                   WHERE a.id = NEW.accepted_answer_id AND a.question_id = NEW.id) THEN
      RAISE EXCEPTION 'Cevap bu soruya ait değil.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    NEW.status := 'resolved';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER wildlife_questions_accept
  BEFORE UPDATE OF accepted_answer_id ON wildlife_questions
  FOR EACH ROW EXECUTE FUNCTION check_answer_acceptance();
