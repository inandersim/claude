-- =====================================================================
-- Zirtan — 0025 · Kurslar, dersler, kayıt, sertifika, oturum
-- Sözleşme: CourseRepository
-- İş kuralları (repos/courses.ts):
--   · 123 → aynı kursa iki kez kayıt yok
--   · 126 → yüz yüze kurs oturum ister
--   · 135 → kontenjan dolu olamaz
--   · 261 → yorum için kayıt şart, 266 → kurs başına tek yorum
--   · 289 → kurs oluşturmak Pro Guide / Business planı ister
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL CHECK (length(btrim(title)) >= 5),
  category         course_category NOT NULL,
  level            course_level    NOT NULL,
  format           course_format   NOT NULL,
  summary          text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',
  image_url        text,
  instructor_id    uuid REFERENCES profiles (id) ON DELETE SET NULL,
  provider         text NOT NULL DEFAULT '',
  certificate_name text,
  validity_months  smallint CHECK (validity_months IS NULL OR validity_months > 0),
  price_try        numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_try >= 0),
  duration_hours   numeric(6, 2) NOT NULL DEFAULT 0 CHECK (duration_hours >= 0),
  lesson_count     integer NOT NULL DEFAULT 0 CHECK (lesson_count >= 0),
  rating           numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count     integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  enrolled_count   integer NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  languages        text[] NOT NULL DEFAULT '{}',
  prerequisites    text[] NOT NULL DEFAULT '{}',
  outcomes         text[] NOT NULL DEFAULT '{}',
  adventure_types  adventure_type[] NOT NULL DEFAULT '{}',
  is_published     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_category_idx   ON courses (category, level);
CREATE INDEX courses_instructor_idx ON courses (instructor_id) WHERE instructor_id IS NOT NULL;
CREATE INDEX courses_title_trgm     ON courses USING GIN (title gin_trgm_ops);
CREATE INDEX courses_summary_trgm   ON courses USING GIN (summary gin_trgm_ops);
CREATE INDEX courses_types_gin      ON courses USING GIN (adventure_types);
CREATE INDEX courses_rating_idx     ON courses (rating DESC) WHERE is_published;

CREATE TRIGGER courses_touch BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE lessons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  module_title text NOT NULL DEFAULT '',
  "order"      smallint NOT NULL CHECK ("order" >= 0),
  title        text NOT NULL,
  type         lesson_type NOT NULL,
  duration_min integer NOT NULL DEFAULT 0 CHECK (duration_min >= 0),
  video_url    text,
  body         text NOT NULL DEFAULT '',
  -- [{question, options, answerIndex}]
  quiz         jsonb,
  preview      boolean NOT NULL DEFAULT false,
  UNIQUE (course_id, "order")
);
CREATE INDEX lessons_course_idx ON lessons (course_id, "order");

CREATE TABLE course_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  location_name text NOT NULL DEFAULT '',
  coords        geography(Point, 4326),
  seats         smallint NOT NULL CHECK (seats > 0),
  seats_left    smallint NOT NULL CHECK (seats_left >= 0),
  price_try     numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_try >= 0),
  CONSTRAINT course_sessions_time_order CHECK (ends_at > starts_at),
  CONSTRAINT course_sessions_seats_left CHECK (seats_left <= seats)
);
CREATE INDEX course_sessions_course_idx ON course_sessions (course_id, starts_at);
CREATE INDEX course_sessions_coords_gix ON course_sessions USING GIST (coords);

CREATE TABLE enrollments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  session_id           uuid REFERENCES course_sessions (id) ON DELETE SET NULL,
  status               enrollment_status NOT NULL DEFAULT 'active',
  completed_lesson_ids uuid[] NOT NULL DEFAULT '{}',
  progress             numeric(4, 3) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  -- {lessonId: score}
  quiz_scores          jsonb NOT NULL DEFAULT '{}'::jsonb,
  enrolled_at          timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  -- Aynı kursa tek aktif kayıt (courses.ts:123)
  UNIQUE (course_id, user_id),
  CONSTRAINT enrollments_completed_consistency CHECK (
    (status = 'completed') = (completed_at IS NOT NULL)
  )
);
CREATE INDEX enrollments_user_idx    ON enrollments (user_id, enrolled_at DESC);
CREATE INDEX enrollments_session_idx ON enrollments (session_id) WHERE session_id IS NOT NULL;

CREATE TABLE certificates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  -- Deterministik doğrulama kodu: ZRV-XXXX-XXXX (domain/courses.ts)
  code        text NOT NULL UNIQUE CHECK (code ~ '^ZRV-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  holder_name text NOT NULL,
  UNIQUE (user_id, course_id)
);
CREATE INDEX certificates_user_idx   ON certificates (user_id, issued_at DESC);
CREATE INDEX certificates_course_idx ON certificates (course_id);

CREATE TABLE course_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       text NOT NULL CHECK (length(btrim(text)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Kurs başına tek yorum (courses.ts:266)
  UNIQUE (course_id, author_id)
);
CREATE INDEX course_reviews_course_idx ON course_reviews (course_id, created_at DESC);
CREATE INDEX course_reviews_author_idx ON course_reviews (author_id);

-- Kayıtlı olmayan yorum yazamaz (courses.ts:261)
CREATE OR REPLACE FUNCTION require_enrollment_for_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.course_id = NEW.course_id AND e.user_id = NEW.author_id) THEN
    RAISE EXCEPTION 'Yorum yazmak için kursa kayıtlı olmalısın.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER course_reviews_require_enrollment BEFORE INSERT ON course_reviews
  FOR EACH ROW EXECUTE FUNCTION require_enrollment_for_review();
