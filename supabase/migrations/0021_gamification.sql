-- =====================================================================
-- Zirtan — 0021 · Oyunlaştırma (XP, rozet, görev, quiz, pasaport)
-- Sözleşme: FunRepository
-- XP tablosu ve seviye eşiği domain/gamification.ts ile aynıdır:
--   xpThreshold(n) = 100·(n−1)·n/2
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  tier        badge_tier NOT NULL,
  icon        text NOT NULL DEFAULT 'award',
  criteria    text NOT NULL DEFAULT ''
);
CREATE INDEX badges_tier_idx ON badges (tier);

CREATE TABLE earned_badges (
  badge_id  uuid NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (badge_id, user_id)
);
CREATE INDEX earned_badges_user_idx ON earned_badges (user_id, earned_at DESC);

CREATE TABLE challenges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  period         challenge_period NOT NULL,
  adventure_type adventure_type,
  target         numeric(10, 2) NOT NULL CHECK (target > 0),
  unit           challenge_unit NOT NULL,
  reward_xp      integer NOT NULL DEFAULT 100 CHECK (reward_xp >= 0),
  badge_id       uuid REFERENCES badges (id) ON DELETE SET NULL,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  CONSTRAINT challenges_window CHECK (ends_at > starts_at)
);
CREATE INDEX challenges_active_idx ON challenges (starts_at, ends_at);
CREATE INDEX challenges_badge_idx  ON challenges (badge_id) WHERE badge_id IS NOT NULL;

CREATE TABLE challenge_progress (
  challenge_id uuid NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  value        numeric(10, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  completed_at timestamptz,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX challenge_progress_user_idx ON challenge_progress (user_id);

CREATE TABLE xp_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  source     xp_source NOT NULL,
  amount     integer NOT NULL CHECK (amount >= 0),
  note       text NOT NULL DEFAULT '',
  -- Aynı olayın iki kez puanlanmasını engelleyen doğal anahtar
  ref_table  text,
  ref_id     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_idx  ON xp_events (user_id, created_at DESC);
-- Liderlik tablosu: haftalık/aylık pencere taraması
CREATE INDEX xp_events_recent_idx ON xp_events (created_at DESC);
CREATE UNIQUE INDEX xp_events_ref_key ON xp_events (user_id, source, ref_table, ref_id)
  WHERE ref_id IS NOT NULL;

CREATE TABLE quiz_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question       text NOT NULL,
  options        text[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 6),
  answer_index   smallint NOT NULL CHECK (answer_index >= 0),
  explanation    text NOT NULL DEFAULT '',
  adventure_type adventure_type,
  locale         text NOT NULL DEFAULT 'tr',
  CONSTRAINT quiz_questions_answer_in_range CHECK (
    answer_index < array_length(options, 1)
  )
);
CREATE INDEX quiz_questions_type_idx ON quiz_questions (adventure_type, locale);

-- Günde bir deneme (mock: quizAttempts {userId, date, correct})
CREATE TABLE quiz_attempts (
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  attempt_date date NOT NULL DEFAULT current_date,
  correct      smallint NOT NULL DEFAULT 0 CHECK (correct >= 0),
  total        smallint NOT NULL DEFAULT 0 CHECK (total >= 0),
  xp_earned    integer  NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, attempt_date)
);

CREATE TABLE passport_stamps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  place_name     text NOT NULL,
  country_code   char(2) NOT NULL,
  adventure_type adventure_type NOT NULL,
  elevation_m    integer,
  coords         geography(Point, 4326),
  stamped_at     timestamptz NOT NULL DEFAULT now(),
  -- Aynı yer için tek damga
  UNIQUE (user_id, place_name, country_code)
);
CREATE INDEX passport_stamps_user_idx    ON passport_stamps (user_id, stamped_at DESC);
CREATE INDEX passport_stamps_country_idx ON passport_stamps (country_code);
CREATE INDEX passport_stamps_coords_gix  ON passport_stamps USING GIST (coords);
