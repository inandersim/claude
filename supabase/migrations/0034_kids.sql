-- =====================================================================
-- Zirtan — 0034 · Çocuk modülü (yer, profil, doğa avı, kontrol listesi)
-- Sözleşme: KidsRepository
-- ÇOCUK VERİSİ: profiller ve ilerleme YALNIZCA ebeveyne görünür (RLS 0100).
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE kid_places (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  kind                    kid_place_kind NOT NULL,
  age_bands               kid_age_band[] NOT NULL DEFAULT '{}',
  coords                  geography(Point, 4326) NOT NULL,
  location_name           text NOT NULL DEFAULT '',
  country_code            char(2),
  description             text NOT NULL DEFAULT '',
  image_url               text,
  facilities              text[] NOT NULL DEFAULT '{}',
  stroller_friendly       boolean NOT NULL DEFAULT false,
  shade                   boolean NOT NULL DEFAULT false,
  toilets                 boolean NOT NULL DEFAULT false,
  water                   boolean NOT NULL DEFAULT false,
  safety_notes            text[] NOT NULL DEFAULT '{}',
  trail_km                numeric(6, 2) CHECK (trail_km IS NULL OR trail_km >= 0),
  trail_min               integer CHECK (trail_min IS NULL OR trail_min >= 0),
  entry_fee_try           numeric(10, 2) CHECK (entry_fee_try IS NULL OR entry_fee_try >= 0),
  rating                  numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count            integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  season_months           smallint[] NOT NULL DEFAULT '{}',
  linked_business_id      uuid REFERENCES businesses (id) ON DELETE SET NULL,
  -- Kütüphane kaydı TEXT kimlikli (places tablosu)
  linked_library_place_id text REFERENCES places (id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kid_places_coords_gix   ON kid_places USING GIST (coords);
CREATE INDEX kid_places_kind_idx     ON kid_places (kind);
CREATE INDEX kid_places_ages_gin     ON kid_places USING GIN (age_bands);
CREATE INDEX kid_places_name_trgm    ON kid_places USING GIN (name gin_trgm_ops);
CREATE INDEX kid_places_stroller_idx ON kid_places (rating DESC) WHERE stroller_friendly;
CREATE INDEX kid_places_business_idx ON kid_places (linked_business_id)
  WHERE linked_business_id IS NOT NULL;
CREATE INDEX kid_places_library_idx  ON kid_places (linked_library_place_id)
  WHERE linked_library_place_id IS NOT NULL;

CREATE TABLE kid_place_saves (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  place_id   uuid NOT NULL REFERENCES kid_places (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);
CREATE INDEX kid_place_saves_place_idx ON kid_place_saves (place_id);

CREATE TABLE child_profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  age_band   kid_age_band NOT NULL,
  avatar     text NOT NULL DEFAULT '🧒',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Aynı adla ikinci profil olmasın (kids.ts:96)
  UNIQUE (user_id, name)
);
CREATE INDEX child_profiles_user_idx ON child_profiles (user_id);

CREATE TABLE hunt_tasks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text      text NOT NULL,
  icon      text NOT NULL DEFAULT '🌿',
  category  hunt_task_category NOT NULL,
  age_bands kid_age_band[] NOT NULL DEFAULT '{}',
  points    smallint NOT NULL DEFAULT 1 CHECK (points > 0),
  locale    text NOT NULL DEFAULT 'tr'
);
CREATE INDEX hunt_tasks_ages_gin ON hunt_tasks USING GIN (age_bands);
CREATE INDEX hunt_tasks_category_idx ON hunt_tasks (category, locale);

CREATE TABLE hunt_progress (
  user_id            uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  child_name         text NOT NULL,
  completed_task_ids uuid[] NOT NULL DEFAULT '{}',
  stickers           text[] NOT NULL DEFAULT '{}',
  points             integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, child_name)
);

CREATE TRIGGER hunt_progress_touch BEFORE UPDATE ON hunt_progress
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE family_checklist_items (
  key       text PRIMARY KEY,
  label     text NOT NULL,
  age_bands kid_age_band[] NOT NULL DEFAULT '{}',
  category  family_checklist_category NOT NULL,
  locale    text NOT NULL DEFAULT 'tr'
);
CREATE INDEX family_checklist_items_ages_gin ON family_checklist_items USING GIN (age_bands);
