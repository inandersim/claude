-- =====================================================================
-- Zirtan — 0029 · Yazarlar ve makaleler
-- Sözleşme: ArticleRepository
-- İş kuralları (repos/articles.ts):
--   · 123 → zaten onaylı yazar yeniden başvuramaz
--   · 150 → yayımlamak için onaylı yazar olmalısın
--   · 194 → yalnızca yazarı düzenleyebilir
--   · 280 → kendini takip edemezsin
-- =====================================================================

SET search_path = public, extensions;

CREATE TABLE writer_profiles (
  user_id        uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  pen_name       text NOT NULL,
  bio            text NOT NULL DEFAULT '',
  languages      text[] NOT NULL DEFAULT '{}',
  topics         article_category[] NOT NULL DEFAULT '{}',
  website        text,
  is_verified    boolean NOT NULL DEFAULT false,
  follower_count integer NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  article_count  integer NOT NULL DEFAULT 0 CHECK (article_count >= 0),
  applied_at     timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz
);
CREATE INDEX writer_profiles_pen_trgm  ON writer_profiles USING GIN (pen_name gin_trgm_ops);
CREATE INDEX writer_profiles_topics_gin ON writer_profiles USING GIN (topics);
CREATE INDEX writer_profiles_approved_idx ON writer_profiles (follower_count DESC)
  WHERE approved_at IS NOT NULL;

CREATE TABLE writer_follows (
  follower_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  writer_user_id uuid NOT NULL REFERENCES writer_profiles (user_id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, writer_user_id),
  CONSTRAINT writer_follows_no_self CHECK (follower_id <> writer_user_id)
);
CREATE INDEX writer_follows_writer_idx ON writer_follows (writer_user_id);

CREATE TABLE articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  subtitle        text NOT NULL DEFAULT '',
  cover_url       text,
  category        article_category NOT NULL,
  body            text NOT NULL DEFAULT '',
  tags            text[] NOT NULL DEFAULT '{}',
  destination_id  uuid REFERENCES destinations (id) ON DELETE SET NULL,
  country_code    char(2),
  adventure_types adventure_type[] NOT NULL DEFAULT '{}',
  read_minutes    smallint NOT NULL DEFAULT 1 CHECK (read_minutes > 0),
  status          article_status NOT NULL DEFAULT 'draft',
  likes_count     integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count  integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  views_count     integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  locale          text NOT NULL DEFAULT 'tr',
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT articles_published_consistency CHECK (
    status = 'draft' OR published_at IS NOT NULL
  )
);
CREATE INDEX articles_author_idx    ON articles (author_id, created_at DESC);
CREATE INDEX articles_published_idx ON articles (published_at DESC) WHERE status <> 'draft';
CREATE INDEX articles_category_idx  ON articles (category, published_at DESC);
CREATE INDEX articles_country_idx   ON articles (country_code) WHERE country_code IS NOT NULL;
CREATE INDEX articles_dest_idx      ON articles (destination_id) WHERE destination_id IS NOT NULL;
CREATE INDEX articles_tags_gin      ON articles USING GIN (tags);
CREATE INDEX articles_title_trgm    ON articles USING GIN (title gin_trgm_ops);
CREATE INDEX articles_body_trgm     ON articles USING GIN (body gin_trgm_ops);
CREATE INDEX articles_featured_idx  ON articles (published_at DESC) WHERE status = 'featured';

CREATE TRIGGER articles_touch BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE article_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX article_comments_article_idx ON article_comments (article_id, created_at);
CREATE INDEX article_comments_author_idx  ON article_comments (author_id);

CREATE TABLE article_likes (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX article_likes_article_idx ON article_likes (article_id);

CREATE TABLE article_saves (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX article_saves_article_idx ON article_saves (article_id);

-- Yayımlamak için onaylı yazar olmalısın (articles.ts:150)
CREATE OR REPLACE FUNCTION require_approved_writer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.status <> 'draft' AND NOT EXISTS (
       SELECT 1 FROM writer_profiles w
       WHERE w.user_id = NEW.author_id AND w.approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Önce yazar başvurusu yapmalısın.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER articles_require_writer
  BEFORE INSERT OR UPDATE OF status ON articles
  FOR EACH ROW EXECUTE FUNCTION require_approved_writer();
