-- =====================================================================
-- Zirtan — 0003 · Çekirdek: profiller, takip, acil durum kişileri
-- Sözleşme: AuthRepository, UserRepository (src/data/repositories/index.ts)
-- Alan adları `domain/types.ts` içindeki `User` arayüzünün snake_case
-- karşılıklarıdır; böylece istemci eşlemesi birebir kalır.
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- Ortak yardımcılar
-- --------------------------------------------------------------------

-- updated_at kolonunu her UPDATE'te tazeler.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- {latitude, longitude} JSON'undan coğrafi nokta üretir (seed ve RPC için).
CREATE OR REPLACE FUNCTION geo_point(lng double precision, lat double precision)
RETURNS geography(Point, 4326)
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
$$;

-- [{latitude,longitude,elevationM,t}, ...] dizisinden LineString üretir.
CREATE OR REPLACE FUNCTION geo_linestring(points jsonb)
RETURNS geography(LineString, 4326)
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN points IS NULL OR jsonb_array_length(points) < 2 THEN NULL
    ELSE ST_SetSRID(
      ST_MakeLine(
        ARRAY(
          SELECT ST_MakePoint((p ->> 'longitude')::double precision,
                              (p ->> 'latitude')::double precision)
          FROM jsonb_array_elements(points) AS p
        )
      ), 4326)::geography
  END
$$;

-- --------------------------------------------------------------------
-- profiles — auth.users'ın uygulama tarafı uzantısı (domain: User)
-- --------------------------------------------------------------------
CREATE TABLE profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username            text        NOT NULL,
  display_name        text        NOT NULL,
  avatar_url          text,
  cover_url           text,
  bio                 text        NOT NULL DEFAULT '',
  location_name       text        NOT NULL DEFAULT '',
  coords              geography(Point, 4326),
  is_verified         boolean     NOT NULL DEFAULT false,
  total_distance_km   numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_distance_km >= 0),
  total_adventures    integer     NOT NULL DEFAULT 0 CHECK (total_adventures >= 0),
  followers_count     integer     NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  following_count     integer     NOT NULL DEFAULT 0 CHECK (following_count >= 0),
  trust_score         smallint    NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  favorite_types      adventure_type[] NOT NULL DEFAULT '{}',
  joined_at           timestamptz NOT NULL DEFAULT now(),
  plan                plan        NOT NULL DEFAULT 'free',
  plan_period         billing_period,
  plan_renews_at      timestamptz,
  -- Toplam XP; oyunlaştırma tetikleyicisi tarafından güncellenir (0022).
  xp                  integer     NOT NULL DEFAULT 0 CHECK (xp >= 0),
  -- Push bildirimleri için Expo token'ları
  push_tokens         text[]      NOT NULL DEFAULT '{}',
  locale              text        NOT NULL DEFAULT 'tr',
  is_suspended        boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Kullanıcı adı büyük/küçük harften bağımsız benzersiz olmalı.
CREATE UNIQUE INDEX profiles_username_key ON profiles (lower(username));
-- Kullanıcı adı biçimi: 3–30 karakter, harf/rakam/nokta/alt çizgi.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9._]{3,30}$');

-- Arama: UserRepository.search(query) → ad + kullanıcı adı üzerinde trigram.
CREATE INDEX profiles_display_name_trgm_idx ON profiles USING GIN (display_name gin_trgm_ops);
CREATE INDEX profiles_username_trgm_idx     ON profiles USING GIN (username gin_trgm_ops);
-- ZMatch adayları / yakındaki kullanıcılar için uzamsal indeks.
CREATE INDEX profiles_coords_gix            ON profiles USING GIST (coords);
CREATE INDEX profiles_plan_idx              ON profiles (plan) WHERE plan <> 'free';
CREATE INDEX profiles_xp_idx                ON profiles (xp DESC);

CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMENT ON TABLE  profiles IS 'domain/types.ts → User. auth.users ile 1-1.';
COMMENT ON COLUMN profiles.trust_score IS '0–100 güvenilirlik (domain/trust.ts).';

-- Yeni kayıt olan her auth kullanıcısı için profil satırı aç.
CREATE OR REPLACE FUNCTION handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  base_username text;
  final_username text;
  suffix integer := 0;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1), 'gezgin'),
    '[^a-zA-Z0-9._]', '', 'g'));
  IF length(base_username) < 3 THEN
    base_username := base_username || 'gezgin';
  END IF;
  base_username := left(base_username, 24);
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles p WHERE lower(p.username) = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO profiles (id, username, display_name, avatar_url, locale)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data ->> 'display_name', final_username),
    NEW.raw_user_meta_data ->> 'avatar_url',
    coalesce(NEW.raw_user_meta_data ->> 'locale', 'tr')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- --------------------------------------------------------------------
-- emergency_contacts — User.emergencyContacts
-- SOS ve dönüş sözü uyarılarının gideceği kişiler.
-- --------------------------------------------------------------------
CREATE TABLE emergency_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name          text NOT NULL,
  phone         text NOT NULL,
  -- Uygulama içi kullanıcıysa kimliği (kullanıcı silinirse bağ kopar, kayıt kalır)
  contact_user_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  position      smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX emergency_contacts_user_idx ON emergency_contacts (user_id, position);
CREATE INDEX emergency_contacts_target_idx ON emergency_contacts (contact_user_id)
  WHERE contact_user_id IS NOT NULL;

-- --------------------------------------------------------------------
-- follows — UserRepository.toggleFollow / isFollowing
-- --------------------------------------------------------------------
CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON follows (following_id, created_at DESC);

COMMENT ON TABLE follows IS 'Tek yönlü takip. Karşılıklı takip = "arkadaş" (canlı konum görünürlüğü).';

-- --------------------------------------------------------------------
-- blocks — engelleme (RLS görünürlük kurallarının temeli)
-- --------------------------------------------------------------------
CREATE TABLE blocks (
  blocker_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);

-- --------------------------------------------------------------------
-- reports — kullanıcı/içerik şikâyeti (moderasyon)
-- --------------------------------------------------------------------
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  target_table text NOT NULL,
  target_id    text NOT NULL,
  reason       text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_open_idx ON reports (created_at DESC) WHERE resolved_at IS NULL;

-- --------------------------------------------------------------------
-- Yetki yardımcıları — RLS politikaları bunları kullanır.
-- SECURITY DEFINER: politika içinden çağrıldıklarında yinelemeli RLS
-- değerlendirmesine girmezler.
-- --------------------------------------------------------------------

-- Karşılıklı takip (domain/presence.ts → friendIds)
CREATE OR REPLACE FUNCTION is_mutual_follow(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = a AND following_id = b)
     AND EXISTS (SELECT 1 FROM follows WHERE follower_id = b AND following_id = a)
$$;

CREATE OR REPLACE FUNCTION is_following(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = a AND following_id = b)
$$;

CREATE OR REPLACE FUNCTION is_blocked(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  )
$$;

-- Acil durum kişisi mi? (SOS ve dönüş sözü görünürlüğü)
CREATE OR REPLACE FUNCTION is_emergency_contact(owner uuid, viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM emergency_contacts
    WHERE user_id = owner AND contact_user_id = viewer
  )
$$;
