-- =====================================================================
-- Zirtan — 0032 · Zirtan TV (kanal, program, yayın akışı, haber)
-- Sözleşme: TvRepository
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE tv_channels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL UNIQUE,
  kind           tv_channel_kind NOT NULL,
  description    text NOT NULL DEFAULT '',
  logo_url       text,
  color          text NOT NULL DEFAULT '#5EE39B',
  follower_count integer NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  owner_id       uuid REFERENCES profiles (id) ON DELETE SET NULL,
  is_official    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tv_channels_kind_idx  ON tv_channels (kind);
CREATE INDEX tv_channels_owner_idx ON tv_channels (owner_id) WHERE owner_id IS NOT NULL;

CREATE TABLE tv_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      uuid NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  submitted_by    uuid REFERENCES profiles (id) ON DELETE SET NULL,
  title           text NOT NULL,
  kind            tv_program_kind NOT NULL,
  description     text NOT NULL DEFAULT '',
  thumbnail_url   text,
  video_url       text NOT NULL,
  duration_min    integer NOT NULL DEFAULT 0 CHECK (duration_min >= 0),
  adventure_types adventure_type[] NOT NULL DEFAULT '{}',
  destination_id  uuid REFERENCES destinations (id) ON DELETE SET NULL,
  country_code    char(2),
  series_title    text,
  episode         smallint CHECK (episode IS NULL OR episode > 0),
  published_at    timestamptz NOT NULL DEFAULT now(),
  views_count     integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  likes_count     integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  languages       text[] NOT NULL DEFAULT '{}',
  subtitles       text[] NOT NULL DEFAULT '{}',
  kids_friendly   boolean NOT NULL DEFAULT false,
  credits_note    text NOT NULL DEFAULT '',
  is_approved     boolean NOT NULL DEFAULT true
);
CREATE INDEX tv_programs_channel_idx  ON tv_programs (channel_id, published_at DESC);
CREATE INDEX tv_programs_kind_idx     ON tv_programs (kind, published_at DESC);
CREATE INDEX tv_programs_kids_idx     ON tv_programs (published_at DESC) WHERE kids_friendly;
CREATE INDEX tv_programs_title_trgm   ON tv_programs USING GIN (title gin_trgm_ops);
CREATE INDEX tv_programs_types_gin    ON tv_programs USING GIN (adventure_types);
CREATE INDEX tv_programs_dest_idx     ON tv_programs (destination_id) WHERE destination_id IS NOT NULL;
CREATE INDEX tv_programs_author_idx   ON tv_programs (submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX tv_programs_series_idx   ON tv_programs (series_title, episode) WHERE series_title IS NOT NULL;

CREATE TABLE tv_schedule (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  program_id uuid REFERENCES tv_programs (id) ON DELETE CASCADE,
  stream_id  uuid REFERENCES live_streams (id) ON DELETE CASCADE,
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  CONSTRAINT tv_schedule_window CHECK (ends_at > starts_at),
  CONSTRAINT tv_schedule_source CHECK (program_id IS NOT NULL OR stream_id IS NOT NULL),
  -- Aynı kanalda yayın akışı çakışamaz
  CONSTRAINT tv_schedule_no_overlap EXCLUDE USING GIST (
    channel_id WITH =, tstzrange(starts_at, ends_at) WITH &&
  )
);
CREATE INDEX tv_schedule_window_idx  ON tv_schedule (starts_at, ends_at);
CREATE INDEX tv_schedule_program_idx ON tv_schedule (program_id) WHERE program_id IS NOT NULL;
CREATE INDEX tv_schedule_stream_idx  ON tv_schedule (stream_id)  WHERE stream_id  IS NOT NULL;

CREATE TABLE news_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     news_category NOT NULL,
  title        text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  region       text NOT NULL DEFAULT '',
  country_code char(2),
  coords       geography(Point, 4326),
  source_name  text NOT NULL DEFAULT '',
  source_url   text,
  severity     news_severity NOT NULL DEFAULT 'info',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);
CREATE INDEX news_items_published_idx ON news_items (published_at DESC);
CREATE INDEX news_items_category_idx  ON news_items (category, published_at DESC);
CREATE INDEX news_items_country_idx   ON news_items (country_code) WHERE country_code IS NOT NULL;
CREATE INDEX news_items_coords_gix    ON news_items USING GIST (coords);
CREATE INDEX news_items_critical_idx  ON news_items (published_at DESC)
  WHERE severity IN ('warning', 'critical');
CREATE INDEX news_items_title_trgm    ON news_items USING GIN (title gin_trgm_ops);

CREATE TABLE watch_progress (
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  program_id   uuid NOT NULL REFERENCES tv_programs (id) ON DELETE CASCADE,
  position_sec integer NOT NULL DEFAULT 0 CHECK (position_sec >= 0),
  duration_sec integer NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);
CREATE INDEX watch_progress_recent_idx  ON watch_progress (user_id, updated_at DESC);
CREATE INDEX watch_progress_program_idx ON watch_progress (program_id);

CREATE TABLE watch_later (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES tv_programs (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);
CREATE INDEX watch_later_program_idx ON watch_later (program_id);

CREATE TABLE program_likes (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES tv_programs (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);
CREATE INDEX program_likes_program_idx ON program_likes (program_id);

CREATE TABLE channel_follows (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX channel_follows_channel_idx ON channel_follows (channel_id);
