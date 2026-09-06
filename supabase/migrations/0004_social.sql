-- =====================================================================
-- Zirtan — 0004 · Sosyal: rotalar, trend konumlar, gönderiler, yorumlar,
--                 beğeni/tepki, koleksiyonlar, hikâyeler
-- Sözleşme: FeedRepository, ExploreRepository, SocialRepository,
--           StoryRepository
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- routes — domain: Route (gönderiye iliştirilen basit rota)
-- --------------------------------------------------------------------
CREATE TABLE routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  adventure_type   adventure_type   NOT NULL,
  difficulty       difficulty_grade NOT NULL,
  distance_km      numeric(8, 2) NOT NULL CHECK (distance_km >= 0),
  elevation_gain_m integer       NOT NULL DEFAULT 0,
  location_name    text NOT NULL DEFAULT '',
  -- {latitude, longitude} dizisi; `path` tetikleyiciyle türetilir
  path_points      jsonb NOT NULL DEFAULT '[]'::jsonb,
  path             geography(LineString, 4326),
  created_by       uuid REFERENCES profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routes_path_gix   ON routes USING GIST (path);
CREATE INDEX routes_type_idx   ON routes (adventure_type);
CREATE INDEX routes_name_trgm  ON routes USING GIN (name gin_trgm_ops);
CREATE INDEX routes_author_idx ON routes (created_by);

-- path_points → path (LineString) senkronu
CREATE OR REPLACE FUNCTION sync_route_path() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.path := geo_linestring(NEW.path_points);
  RETURN NEW;
END $$;

CREATE TRIGGER routes_sync_path BEFORE INSERT OR UPDATE OF path_points ON routes
  FOR EACH ROW EXECUTE FUNCTION sync_route_path();

-- --------------------------------------------------------------------
-- trending_locations — domain: TrendingLocation (keşfet vitrini)
-- --------------------------------------------------------------------
CREATE TABLE trending_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  region          text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  image_url       text,
  adventure_types adventure_type[] NOT NULL DEFAULT '{}',
  difficulty      difficulty_grade NOT NULL,
  posts_count     integer NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  coords          geography(Point, 4326) NOT NULL,
  best_season     text NOT NULL DEFAULT '',
  trend_percent   numeric(6, 2) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trending_locations_coords_gix ON trending_locations USING GIST (coords);
CREATE INDEX trending_locations_name_trgm  ON trending_locations USING GIN (name gin_trgm_ops);
CREATE INDEX trending_locations_trend_idx  ON trending_locations (trend_percent DESC);

-- --------------------------------------------------------------------
-- posts — domain: Post (macera + durum + fotoğraf gönderileri)
-- --------------------------------------------------------------------
CREATE TABLE posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  kind             post_kind NOT NULL DEFAULT 'adventure',
  image_url        text,
  -- Çoklu fotoğraf; image_url ilk kare
  images           text[] NOT NULL DEFAULT '{}',
  caption          text   NOT NULL DEFAULT '',
  adventure_type   adventure_type,
  difficulty       difficulty_grade,
  altitude_m       integer,
  distance_km      numeric(8, 2),
  temperature_c    numeric(5, 2),
  wind_kmh         numeric(6, 2),
  trail_condition  trail_condition,
  duration_min     integer,
  location_name    text NOT NULL DEFAULT '',
  coords           geography(Point, 4326),
  hashtags         text[] NOT NULL DEFAULT '{}',
  mentions         uuid[] NOT NULL DEFAULT '{}',
  -- Sayaçlar tetikleyicilerle (0200) tutulur
  likes_count      integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count   integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  saves_count      integer NOT NULL DEFAULT 0 CHECK (saves_count >= 0),
  reposts_count    integer NOT NULL DEFAULT 0 CHECK (reposts_count >= 0),
  is_verified_info boolean NOT NULL DEFAULT false,
  route_id         uuid REFERENCES routes (id) ON DELETE SET NULL,
  -- Alıntı/repost zinciri; kaynak silinirse repost da silinir
  repost_of_id     uuid REFERENCES posts (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Macera gönderisi telemetri alanlarını zorunlu kılar
  CONSTRAINT posts_adventure_fields CHECK (
    kind <> 'adventure' OR (adventure_type IS NOT NULL AND difficulty IS NOT NULL)
  ),
  CONSTRAINT posts_no_self_repost CHECK (repost_of_id IS NULL OR repost_of_id <> id)
);
CREATE INDEX posts_author_created_idx ON posts (author_id, created_at DESC);
CREATE INDEX posts_created_idx        ON posts (created_at DESC);
CREATE INDEX posts_type_idx           ON posts (adventure_type, created_at DESC)
  WHERE adventure_type IS NOT NULL;
CREATE INDEX posts_kind_idx           ON posts (kind, created_at DESC);
CREATE INDEX posts_hashtags_gin       ON posts USING GIN (hashtags);
CREATE INDEX posts_mentions_gin       ON posts USING GIN (mentions);
CREATE INDEX posts_coords_gix         ON posts USING GIST (coords);
CREATE INDEX posts_caption_trgm       ON posts USING GIN (caption gin_trgm_ops);
CREATE INDEX posts_location_trgm      ON posts USING GIN (location_name gin_trgm_ops);
CREATE INDEX posts_route_idx          ON posts (route_id) WHERE route_id IS NOT NULL;
CREATE INDEX posts_repost_idx         ON posts (repost_of_id) WHERE repost_of_id IS NOT NULL;

CREATE TRIGGER posts_touch BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMENT ON COLUMN posts.hashtags IS 'SocialRepository.hashtags/byHashtag → GIN indeks üzerinden.';

-- --------------------------------------------------------------------
-- comments — domain: Comment
-- --------------------------------------------------------------------
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx   ON comments (post_id, created_at);
CREATE INDEX comments_author_idx ON comments (author_id);

-- --------------------------------------------------------------------
-- post_likes — FeedRepository.toggleLike (mock: likes tablosu)
-- --------------------------------------------------------------------
CREATE TABLE post_likes (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX post_likes_post_idx ON post_likes (post_id);

-- --------------------------------------------------------------------
-- reactions — domain: Reaction (kullanıcı başına tek tepki)
-- --------------------------------------------------------------------
CREATE TABLE reactions (
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type       reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX reactions_user_idx      ON reactions (user_id);
CREATE INDEX reactions_post_type_idx ON reactions (post_id, type);

-- --------------------------------------------------------------------
-- collections + saved_posts — SocialRepository.toggleSave / collections
-- --------------------------------------------------------------------
CREATE TABLE collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  cover_url  text,
  count      integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX collections_user_idx ON collections (user_id, created_at DESC);

CREATE TABLE saved_posts (
  user_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  post_id       uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  -- Koleksiyon silinirse kayıt "koleksiyonsuz" olarak kalır
  collection_id uuid REFERENCES collections (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX saved_posts_post_idx       ON saved_posts (post_id);
CREATE INDEX saved_posts_collection_idx ON saved_posts (collection_id)
  WHERE collection_id IS NOT NULL;

-- --------------------------------------------------------------------
-- stories + story_views — domain: Story (24 saatlik anlar)
-- --------------------------------------------------------------------
CREATE TABLE stories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  media_url      text,
  media_type     story_media_type NOT NULL DEFAULT 'image',
  caption        text NOT NULL DEFAULT '',
  adventure_type adventure_type NOT NULL,
  location_name  text NOT NULL DEFAULT '',
  coords         geography(Point, 4326),
  altitude_m     integer,
  views_count    integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT stories_expiry_after_start CHECK (expires_at > created_at)
);
-- Aktif anlar sorgusu: expires_at > now()
CREATE INDEX stories_active_idx    ON stories (expires_at DESC);
CREATE INDEX stories_author_idx    ON stories (author_id, created_at DESC);
CREATE INDEX stories_coords_gix    ON stories USING GIST (coords);

CREATE TABLE story_views (
  user_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  story_id  uuid NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
CREATE INDEX story_views_story_idx ON story_views (story_id);
