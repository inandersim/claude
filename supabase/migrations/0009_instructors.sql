-- =====================================================================
-- Zirtan — 0009 · Eğitmenler ve ders rezervasyonu
-- Sözleşme: InstructorRepository
-- İş kuralları (provider.ts:1004, 1046):
--   · Kendinden ders talep edilemez.
--   · Talebe yalnızca EĞİTMEN yanıt verebilir.
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE instructors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  headline              text NOT NULL DEFAULT '',
  bio                   text NOT NULL DEFAULT '',
  specialties           adventure_type[] NOT NULL DEFAULT '{}',
  certifications        text[] NOT NULL DEFAULT '{}',
  rating                numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count          integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  price_per_session_try numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_per_session_try >= 0),
  session_duration_min  integer NOT NULL DEFAULT 120 CHECK (session_duration_min > 0),
  languages             text[] NOT NULL DEFAULT '{}',
  years_experience      integer NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  location_name         text NOT NULL DEFAULT '',
  coords                geography(Point, 4326),
  -- 0 = Pazar … 6 = Cumartesi
  available_days        smallint[] NOT NULL DEFAULT '{}',
  students_count        integer NOT NULL DEFAULT 0 CHECK (students_count >= 0),
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX instructors_coords_gix     ON instructors USING GIST (coords);
CREATE INDEX instructors_rating_idx     ON instructors (rating DESC);
CREATE INDEX instructors_price_idx      ON instructors (price_per_session_try);
CREATE INDEX instructors_specialty_gin  ON instructors USING GIN (specialties);
CREATE INDEX instructors_headline_trgm  ON instructors USING GIN (headline gin_trgm_ops);

CREATE TRIGGER instructors_touch BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE instructor_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES instructors (id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content       text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Bir öğrenci bir eğitmeni bir kez değerlendirir
  UNIQUE (instructor_id, author_id)
);
CREATE INDEX instructor_reviews_instructor_idx ON instructor_reviews (instructor_id, created_at DESC);
CREATE INDEX instructor_reviews_author_idx     ON instructor_reviews (author_id);

CREATE TABLE bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  uuid NOT NULL REFERENCES instructors (id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  adventure_type adventure_type NOT NULL,
  date           timestamptz NOT NULL,
  message        text NOT NULL DEFAULT '',
  status         booking_status NOT NULL DEFAULT 'pending',
  price_try      numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_try >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  CONSTRAINT bookings_responded_when_answered CHECK (
    status = 'pending' OR responded_at IS NOT NULL
  )
);
CREATE INDEX bookings_instructor_idx ON bookings (instructor_id, date DESC);
CREATE INDEX bookings_student_idx    ON bookings (student_id, date DESC);
CREATE INDEX bookings_pending_idx    ON bookings (instructor_id) WHERE status = 'pending';

-- Kendinden ders talep etmeyi engelle (eğitmen.user_id = öğrenci)
CREATE OR REPLACE FUNCTION forbid_self_booking() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM instructors i
             WHERE i.id = NEW.instructor_id AND i.user_id = NEW.student_id) THEN
    RAISE EXCEPTION 'Kendinden ders talep edemezsin.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_no_self BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION forbid_self_booking();

-- Eğitmen sahipliği (RLS)
CREATE OR REPLACE FUNCTION owns_instructor(instructor uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM instructors WHERE id = instructor AND user_id = viewer)
$$;
