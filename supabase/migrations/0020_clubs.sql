-- =====================================================================
-- Zirtan — 0020 · Üniversite kulüpleri, etkinlikler, üyelik
-- Sözleşme: ClubRepository
-- İş kuralları (repos/clubs.ts):
--   · 101/102 → aynı kulübe iki kez katılma/talep yok
--   · 177     → etkinlik oluşturmak için üye olmalısın
--   · 182     → bitiş, başlangıçtan önce olamaz
--   · 225     → öğrenci doğrulaması üniversite e-postası ister
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE clubs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  university      text NOT NULL,
  city            text NOT NULL DEFAULT '',
  country_code    char(2) NOT NULL,
  description     text NOT NULL DEFAULT '',
  logo_url        text,
  cover_url       text,
  adventure_types adventure_type[] NOT NULL DEFAULT '{}',
  member_count    integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  founded_year    smallint CHECK (founded_year IS NULL OR founded_year BETWEEN 1800 AND 2200),
  is_verified     boolean NOT NULL DEFAULT false,
  -- Bu dönem toplam XP (kulüp sıralaması)
  season_xp       integer NOT NULL DEFAULT 0 CHECK (season_xp >= 0),
  contact_email   text,
  instagram       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university, name)
);
CREATE INDEX clubs_city_idx     ON clubs (city);
CREATE INDEX clubs_country_idx  ON clubs (country_code);
CREATE INDEX clubs_name_trgm    ON clubs USING GIN (name gin_trgm_ops);
CREATE INDEX clubs_uni_trgm     ON clubs USING GIN (university gin_trgm_ops);
CREATE INDEX clubs_types_gin    ON clubs USING GIN (adventure_types);
CREATE INDEX clubs_ranking_idx  ON clubs (season_xp DESC);

CREATE TRIGGER clubs_touch BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE club_members (
  club_id   uuid NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role      club_role NOT NULL DEFAULT 'member',
  status    membership_status NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX club_members_user_idx ON club_members (user_id);
CREATE INDEX club_members_role_idx ON club_members (club_id, role);

CREATE OR REPLACE FUNCTION is_club_member(club uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = club AND user_id = viewer AND status = 'member'
  )
$$;

CREATE OR REPLACE FUNCTION club_role_of(club uuid, viewer uuid) RETURNS club_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT role FROM club_members
  WHERE club_id = club AND user_id = viewer AND status = 'member'
$$;

CREATE TABLE club_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  created_by     uuid REFERENCES profiles (id) ON DELETE SET NULL,
  title          text NOT NULL CHECK (length(btrim(title)) > 0),
  kind           club_event_kind NOT NULL,
  adventure_type adventure_type  NOT NULL,
  description    text NOT NULL DEFAULT '',
  location_name  text NOT NULL DEFAULT '',
  coords         geography(Point, 4326),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  capacity       integer CHECK (capacity IS NULL OR capacity > 0),
  attendee_count integer NOT NULL DEFAULT 0 CHECK (attendee_count >= 0),
  open_to_all    boolean NOT NULL DEFAULT false,
  price_try      numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_try >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_events_time_order CHECK (ends_at >= starts_at)
);
CREATE INDEX club_events_club_idx     ON club_events (club_id, starts_at DESC);
-- Yaklaşan etkinlikler: now() değişken olduğu için kısmi indeks yerine tam indeks.
CREATE INDEX club_events_upcoming_idx ON club_events (starts_at);
CREATE INDEX club_events_coords_gix   ON club_events USING GIST (coords);
CREATE INDEX club_events_author_idx   ON club_events (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE event_rsvps (
  event_id   uuid NOT NULL REFERENCES club_events (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_rsvps_user_idx ON event_rsvps (user_id);

CREATE TABLE student_verifications (
  user_id     uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  email       text NOT NULL,
  university  text NOT NULL,
  token       text,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Üniversite e-postası: *.edu / *.edu.tr / *.ac.* (clubs.ts:225)
  CONSTRAINT student_verifications_edu_email CHECK (
    email ~* '@[a-z0-9.-]+\.(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$'
  )
);
CREATE UNIQUE INDEX student_verifications_email_key ON student_verifications (lower(email));
