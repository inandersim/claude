-- =====================================================================
-- Zirtan — 0028 · Ülke rehberi ve belge kontrol listesi
-- Sözleşme: CountryRepository
-- Kontrol listesi KİŞİSEL veridir (yalnızca sahibi).
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE country_guides (
  country_code      char(2) PRIMARY KEY,
  name              text NOT NULL,
  region            text NOT NULL DEFAULT '',
  languages         text[] NOT NULL DEFAULT '{}',
  currency          text NOT NULL DEFAULT '',
  try_rate          numeric(14, 6),
  timezone          text NOT NULL DEFAULT 'UTC',
  plug_types        text[] NOT NULL DEFAULT '{}',
  -- VisaInfo: {type, maxStayDays, costTry, processingDays, url, note}
  visa              jsonb NOT NULL DEFAULT '{}'::jsonb,
  visa_type         visa_type NOT NULL DEFAULT 'e_visa',
  -- [{key, label, required, note}]
  documents         jsonb NOT NULL DEFAULT '[]'::jsonb,
  etiquette         text[] NOT NULL DEFAULT '{}',
  dress_code        text NOT NULL DEFAULT '',
  religion_notes    text NOT NULL DEFAULT '',
  photography_rules text NOT NULL DEFAULT '',
  tipping           text NOT NULL DEFAULT '',
  bargaining        text NOT NULL DEFAULT '',
  watch_out         text[] NOT NULL DEFAULT '{}',
  women_travelers   text NOT NULL DEFAULT '',
  laws              text[] NOT NULL DEFAULT '{}',
  drone_rules       text NOT NULL DEFAULT '',
  alcohol_rules     text NOT NULL DEFAULT '',
  money             text NOT NULL DEFAULT '',
  connectivity      text NOT NULL DEFAULT '',
  health            text[] NOT NULL DEFAULT '{}',
  vaccines          text[] NOT NULL DEFAULT '{}',
  best_months       smallint[] NOT NULL DEFAULT '{}',
  daily_tips        text[] NOT NULL DEFAULT '{}',
  sources           text[] NOT NULL DEFAULT '{}',
  locale            text NOT NULL DEFAULT 'tr',
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX country_guides_name_trgm ON country_guides USING GIN (name gin_trgm_ops);
CREATE INDEX country_guides_visa_idx  ON country_guides (visa_type);
CREATE INDEX country_guides_region_idx ON country_guides (region);

CREATE TABLE country_checklists (
  user_id      uuid    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  country_code char(2) NOT NULL REFERENCES country_guides (country_code) ON DELETE CASCADE,
  -- İşaretlenen belge anahtarları (country_guides.documents[].key)
  done         text[]  NOT NULL DEFAULT '{}',
  trip_date    date,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, country_code)
);
CREATE INDEX country_checklists_country_idx ON country_checklists (country_code);
CREATE INDEX country_checklists_trip_idx    ON country_checklists (trip_date)
  WHERE trip_date IS NOT NULL;

CREATE TRIGGER country_checklists_touch BEFORE UPDATE ON country_checklists
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
