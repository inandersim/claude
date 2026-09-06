-- =====================================================================
-- Zirtan — 0200 · Sunucu tarafı fonksiyonlar ve tetikleyiciler
--
--   1. Sayaç tetikleyicileri (likes_count, comments_count, …)
--   2. XP / oyunlaştırma tetikleyicileri
--   3. Uzamsal RPC'ler (yakındaki kayıtlar)
--   4. Akış, trend etiketler, liderlik tablosu
--   5. Rezervasyon uygunluk / çakışma kontrolü
--   6. Sertifika kodu üretimi (domain/courses.ts ile birebir)
--   7. AMS puanı, tehlike/rota doğrulama seviyeleri
--
-- RPC'ler `SECURITY INVOKER`'dır: RLS geçerli kalır. Yalnızca yetki
-- yardımcıları (0003/0024/0031) SECURITY DEFINER'dır.
-- =====================================================================

SET search_path = public, extensions;

-- Eksik FK indeksi (0003)
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_id);

-- =====================================================================
-- 1. SAYAÇ TETİKLEYİCİLERİ
-- =====================================================================

-- Genel amaçlı sayaç: TG_ARGV = [hedef tablo, hedef kolon, kaynak kolon]
CREATE OR REPLACE FUNCTION bump_counter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  target_table constant text := TG_ARGV[0];
  target_col   constant text := TG_ARGV[1];
  source_col   constant text := TG_ARGV[2];
  -- Hedef tablonun anahtar kolonu; her tabloda `id` değildir
  -- (ör. writer_profiles → user_id, kompozit anahtarlı tablolar).
  target_key   constant text := COALESCE(TG_ARGV[3], 'id');
  key_value    text;
  delta        integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := 1;
    EXECUTE format('SELECT ($1).%I::text', source_col) INTO key_value USING NEW;
  ELSE
    delta := -1;
    EXECUTE format('SELECT ($1).%I::text', source_col) INTO key_value USING OLD;
  END IF;

  IF key_value IS NOT NULL THEN
    EXECUTE format(
      'UPDATE %I SET %I = GREATEST(0, %I + $1) WHERE %I::text = $2',
      target_table, target_col, target_col, target_key)
    USING delta, key_value;
  END IF;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION bump_counter IS
  'AFTER INSERT/DELETE tetikleyicisi; TG_ARGV = (hedef tablo, sayaç kolonu, kaynak FK kolonu, [hedef anahtar kolonu = id]).';

CREATE TRIGGER post_likes_count AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('posts', 'likes_count', 'post_id');
CREATE TRIGGER comments_count AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION bump_counter('posts', 'comments_count', 'post_id');
CREATE TRIGGER saved_posts_count AFTER INSERT OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION bump_counter('posts', 'saves_count', 'post_id');
CREATE TRIGGER story_views_count AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION bump_counter('stories', 'views_count', 'story_id');
CREATE TRIGGER listing_favorites_count AFTER INSERT OR DELETE ON listing_favorites
  FOR EACH ROW EXECUTE FUNCTION bump_counter('listings', 'favorites_count', 'listing_id');
CREATE TRIGGER hazard_confirmations_count AFTER INSERT OR DELETE ON hazard_confirmations
  FOR EACH ROW EXECUTE FUNCTION bump_counter('hazards', 'confirmations', 'hazard_id');
CREATE TRIGGER route_confirmations_count AFTER INSERT OR DELETE ON route_confirmations
  FOR EACH ROW EXECUTE FUNCTION bump_counter('climbing_routes', 'confirmations', 'route_id');
CREATE TRIGGER ascents_count AFTER INSERT OR DELETE ON ascents
  FOR EACH ROW EXECUTE FUNCTION bump_counter('climbing_routes', 'ascent_count', 'route_id');
CREATE TRIGGER poi_confirmations_count AFTER INSERT OR DELETE ON poi_confirmations
  FOR EACH ROW EXECUTE FUNCTION bump_counter('track_pois', 'confirmations', 'poi_id');
CREATE TRIGGER trail_verifications_count AFTER INSERT OR DELETE ON trail_verifications
  FOR EACH ROW EXECUTE FUNCTION bump_counter('community_trails', 'verified_count', 'trail_id');
CREATE TRIGGER track_likes_count AFTER INSERT OR DELETE ON track_likes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('tracks', 'likes_count', 'track_id');
CREATE TRIGGER stream_likes_count AFTER INSERT OR DELETE ON stream_likes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('live_streams', 'likes_count', 'stream_id');
CREATE TRIGGER article_likes_count AFTER INSERT OR DELETE ON article_likes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('articles', 'likes_count', 'article_id');
CREATE TRIGGER article_comments_count AFTER INSERT OR DELETE ON article_comments
  FOR EACH ROW EXECUTE FUNCTION bump_counter('articles', 'comments_count', 'article_id');
CREATE TRIGGER answer_upvotes_count AFTER INSERT OR DELETE ON answer_upvotes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('wildlife_answers', 'upvotes', 'answer_id');
CREATE TRIGGER wildlife_answers_count AFTER INSERT OR DELETE ON wildlife_answers
  FOR EACH ROW EXECUTE FUNCTION bump_counter('wildlife_questions', 'answers_count', 'question_id');
CREATE TRIGGER program_likes_count AFTER INSERT OR DELETE ON program_likes
  FOR EACH ROW EXECUTE FUNCTION bump_counter('tv_programs', 'likes_count', 'program_id');
CREATE TRIGGER channel_follows_count AFTER INSERT OR DELETE ON channel_follows
  FOR EACH ROW EXECUTE FUNCTION bump_counter('tv_channels', 'follower_count', 'channel_id');
CREATE TRIGGER event_rsvps_count AFTER INSERT OR DELETE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION bump_counter('club_events', 'attendee_count', 'event_id');
CREATE TRIGGER enrollments_count AFTER INSERT OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION bump_counter('courses', 'enrolled_count', 'course_id');

-- Takip sayaçları (iki taraflı)
CREATE OR REPLACE FUNCTION sync_follow_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSE
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER follows_counts AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();

CREATE TRIGGER writer_follows_count AFTER INSERT OR DELETE ON writer_follows
  FOR EACH ROW EXECUTE FUNCTION bump_counter(
    'writer_profiles', 'follower_count', 'writer_user_id', 'user_id');

-- Grup/kulüp üye sayısı
CREATE OR REPLACE FUNCTION sync_member_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  tbl constant text := TG_ARGV[0];
  fk  constant text := TG_ARGV[1];
  key uuid;
  delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := 1; ELSE delta := -1; END IF;
  EXECUTE format('SELECT ($1).%I', fk) INTO key USING coalesce(NEW, OLD);
  EXECUTE format('UPDATE %I SET member_count = GREATEST(0, member_count + $1) WHERE id = $2', tbl)
    USING delta, key;
  RETURN NULL;
END $$;

CREATE TRIGGER group_members_count AFTER INSERT OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION sync_member_count('groups', 'group_id');
CREATE TRIGGER club_members_count AFTER INSERT OR DELETE ON club_members
  FOR EACH ROW EXECUTE FUNCTION sync_member_count('clubs', 'club_id');

-- Repost sayacı
CREATE OR REPLACE FUNCTION sync_repost_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.repost_of_id IS NOT NULL THEN
    UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = NEW.repost_of_id;
  ELSIF TG_OP = 'DELETE' AND OLD.repost_of_id IS NOT NULL THEN
    UPDATE posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = OLD.repost_of_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER posts_repost_count AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION sync_repost_count();

-- Ortalama puan sayaçları (yorum ekleme/silme/güncelleme)
CREATE OR REPLACE FUNCTION sync_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  target_table constant text := TG_ARGV[0];
  fk_col       constant text := TG_ARGV[1];
  key          uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', fk_col) INTO key USING coalesce(NEW, OLD);
  EXECUTE format($f$
    UPDATE %I t SET
      rating = coalesce((SELECT round(avg(r.rating)::numeric, 2) FROM %I r WHERE r.%I = $1), 0),
      review_count = (SELECT count(*) FROM %I r WHERE r.%I = $1)
    WHERE t.id = $1
  $f$, target_table, TG_TABLE_NAME, fk_col, TG_TABLE_NAME, fk_col) USING key;
  RETURN NULL;
END $$;

CREATE TRIGGER instructor_reviews_rating AFTER INSERT OR UPDATE OR DELETE ON instructor_reviews
  FOR EACH ROW EXECUTE FUNCTION sync_rating('instructors', 'instructor_id');
CREATE TRIGGER stay_reviews_rating AFTER INSERT OR UPDATE OR DELETE ON stay_reviews
  FOR EACH ROW EXECUTE FUNCTION sync_rating('businesses', 'business_id');
CREATE TRIGGER course_reviews_rating AFTER INSERT OR UPDATE OR DELETE ON course_reviews
  FOR EACH ROW EXECUTE FUNCTION sync_rating('courses', 'course_id');

-- Kaya/sektör rota sayaçları
CREATE OR REPLACE FUNCTION sync_crag_route_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r record;
BEGIN
  r := coalesce(NEW, OLD);
  UPDATE crags SET route_count = (SELECT count(*) FROM climbing_routes WHERE crag_id = r.crag_id)
   WHERE id = r.crag_id;
  UPDATE crag_sectors SET route_count = (SELECT count(*) FROM climbing_routes WHERE sector_id = r.sector_id)
   WHERE id = r.sector_id;
  RETURN NULL;
END $$;

CREATE TRIGGER climbing_routes_counts AFTER INSERT OR DELETE ON climbing_routes
  FOR EACH ROW EXECUTE FUNCTION sync_crag_route_counts();

-- Kurs ders sayısı, destinasyon aşama sayısı, yazar makale sayısı
CREATE OR REPLACE FUNCTION sync_lesson_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE courses c SET lesson_count = (SELECT count(*) FROM lessons WHERE course_id = c.id)
   WHERE c.id = coalesce(NEW.course_id, OLD.course_id);
  RETURN NULL;
END $$;
CREATE TRIGGER lessons_count AFTER INSERT OR DELETE ON lessons
  FOR EACH ROW EXECUTE FUNCTION sync_lesson_count();

CREATE OR REPLACE FUNCTION sync_stage_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE destinations d SET stage_count = (SELECT count(*) FROM destination_stages WHERE destination_id = d.id)
   WHERE d.id = coalesce(NEW.destination_id, OLD.destination_id);
  RETURN NULL;
END $$;
CREATE TRIGGER destination_stages_count AFTER INSERT OR DELETE ON destination_stages
  FOR EACH ROW EXECUTE FUNCTION sync_stage_count();

CREATE OR REPLACE FUNCTION sync_article_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE writer_profiles w
     SET article_count = (SELECT count(*) FROM articles
                          WHERE author_id = w.user_id AND status <> 'draft')
   WHERE w.user_id = coalesce(NEW.author_id, OLD.author_id);
  RETURN NULL;
END $$;
CREATE TRIGGER articles_writer_count AFTER INSERT OR UPDATE OF status OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION sync_article_count();

-- =====================================================================
-- 2. XP / OYUNLAŞTIRMA
-- =====================================================================

-- domain/gamification.ts → XP_TABLE
CREATE OR REPLACE FUNCTION xp_for(src xp_source) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE src
    WHEN 'post'          THEN 10
    WHEN 'route'         THEN 25
    WHEN 'ascent'        THEN 30
    WHEN 'hazard_report' THEN 40
    WHEN 'challenge'     THEN 100
    WHEN 'quiz'          THEN 5
    WHEN 'event'         THEN 50
    WHEN 'streak'        THEN 2
  END
$$;

-- domain/gamification.ts → xpThreshold(n) = 100·(n−1)·n/2
CREATE OR REPLACE FUNCTION xp_threshold(lvl integer) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT (100 * (GREATEST(1, lvl) - 1) * GREATEST(1, lvl)) / 2
$$;

CREATE OR REPLACE FUNCTION level_for(total_xp integer) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  -- xp_threshold(l+1) <= xp koşulunu sağlayan en büyük l
  SELECT GREATEST(1, floor((1 + sqrt(1 + 0.08 * GREATEST(0, total_xp))) / 2)::integer)
$$;

-- xp_events → profiles.xp senkronu
CREATE OR REPLACE FUNCTION sync_profile_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET xp = xp + NEW.amount WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles SET xp = GREATEST(0, xp - OLD.amount) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER xp_events_sync_profile AFTER INSERT OR DELETE ON xp_events
  FOR EACH ROW EXECUTE FUNCTION sync_profile_xp();

-- Aynı olay iki kez puanlanmaz (xp_events_ref_key benzersiz indeksi).
CREATE OR REPLACE FUNCTION award_xp(
  target_user uuid, src xp_source, ref_tbl text, ref text, note text DEFAULT ''
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  INSERT INTO xp_events (user_id, source, amount, note, ref_table, ref_id)
  VALUES (target_user, src, xp_for(src), note, ref_tbl, ref)
  ON CONFLICT (user_id, source, ref_table, ref_id) WHERE ref_id IS NOT NULL DO NOTHING
$$;

-- Gönderi / tehlike bildirimi / çıkış / yayınlanan parça XP'si
CREATE OR REPLACE FUNCTION award_xp_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  src        constant xp_source := TG_ARGV[0]::xp_source;
  owner_col  constant text      := TG_ARGV[1];
  -- Referans kimliği kolonu; kompozit anahtarlı tablolarda `id` yoktur
  -- (ör. event_rsvps → event_id).
  ref_col    constant text      := COALESCE(TG_ARGV[2], 'id');
  owner      uuid;
  ref        text;
BEGIN
  EXECUTE format('SELECT ($1).%I', owner_col) INTO owner USING NEW;
  EXECUTE format('SELECT ($1).%I::text', ref_col) INTO ref USING NEW;
  PERFORM award_xp(owner, src, TG_TABLE_NAME, ref, '');
  RETURN NULL;
END $$;

-- Kaynak satır silinince kazanılan XP geri alınır (XP çiftçiliğini önler).
CREATE OR REPLACE FUNCTION revoke_xp_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  src       constant xp_source := TG_ARGV[0]::xp_source;
  owner_col constant text      := TG_ARGV[1];
  ref_col   constant text      := COALESCE(TG_ARGV[2], 'id');
  owner     uuid;
  ref       text;
BEGIN
  EXECUTE format('SELECT ($1).%I', owner_col) INTO owner USING OLD;
  EXECUTE format('SELECT ($1).%I::text', ref_col) INTO ref USING OLD;
  DELETE FROM xp_events
   WHERE user_id = owner AND source = src
     AND ref_table = TG_TABLE_NAME AND ref_id = ref;
  RETURN NULL;
END $$;

CREATE TRIGGER posts_award_xp AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION award_xp_trigger('post', 'author_id');
CREATE TRIGGER hazards_award_xp AFTER INSERT ON hazards
  FOR EACH ROW EXECUTE FUNCTION award_xp_trigger('hazard_report', 'reporter_id');
CREATE TRIGGER ascents_award_xp AFTER INSERT ON ascents
  FOR EACH ROW EXECUTE FUNCTION award_xp_trigger('ascent', 'user_id');
CREATE TRIGGER event_rsvps_award_xp AFTER INSERT ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION award_xp_trigger('event', 'user_id', 'event_id');

CREATE TRIGGER posts_revoke_xp AFTER DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION revoke_xp_trigger('post', 'author_id');
CREATE TRIGGER hazards_revoke_xp AFTER DELETE ON hazards
  FOR EACH ROW EXECUTE FUNCTION revoke_xp_trigger('hazard_report', 'reporter_id');
CREATE TRIGGER ascents_revoke_xp AFTER DELETE ON ascents
  FOR EACH ROW EXECUTE FUNCTION revoke_xp_trigger('ascent', 'user_id');
CREATE TRIGGER tracks_revoke_xp AFTER DELETE ON tracks
  FOR EACH ROW EXECUTE FUNCTION revoke_xp_trigger('route', 'user_id');
-- Katılım geri alınınca etkinlik XP'si de geri alınır (katıl–vazgeç döngüsüyle
-- puan biriktirmeyi önler; diğer XP kaynaklarıyla aynı davranış).
CREATE TRIGGER event_rsvps_revoke_xp AFTER DELETE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION revoke_xp_trigger('event', 'user_id', 'event_id');

-- Parça yalnızca YAYINLANDIĞINDA rota XP'si verir.
CREATE OR REPLACE FUNCTION award_track_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status <> 'published') THEN
    PERFORM award_xp(NEW.user_id, 'route', 'tracks', NEW.id::text, NEW.name);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER tracks_award_xp AFTER INSERT OR UPDATE OF status ON tracks
  FOR EACH ROW EXECUTE FUNCTION award_track_xp();

-- Görev tamamlandığında ödül XP'si
CREATE OR REPLACE FUNCTION award_challenge_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE reward integer;
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    SELECT GREATEST(xp_for('challenge'), c.reward_xp) INTO reward
      FROM challenges c WHERE c.id = NEW.challenge_id;
    INSERT INTO xp_events (user_id, source, amount, note, ref_table, ref_id)
    VALUES (NEW.user_id, 'challenge', reward, '', 'challenges', NEW.challenge_id::text)
    ON CONFLICT (user_id, source, ref_table, ref_id) WHERE ref_id IS NOT NULL DO NOTHING;
    -- Göreve bağlı rozet varsa ver
    INSERT INTO earned_badges (badge_id, user_id)
    SELECT c.badge_id, NEW.user_id FROM challenges c
     WHERE c.id = NEW.challenge_id AND c.badge_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER challenge_progress_award AFTER UPDATE OF completed_at ON challenge_progress
  FOR EACH ROW EXECUTE FUNCTION award_challenge_xp();

-- Quiz denemesi XP'si (doğru × 5, tam puanda +25)
CREATE OR REPLACE FUNCTION award_quiz_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE gained integer;
BEGIN
  gained := NEW.correct * xp_for('quiz')
          + CASE WHEN NEW.total > 0 AND NEW.correct = NEW.total THEN 25 ELSE 0 END;
  NEW.xp_earned := gained;
  INSERT INTO xp_events (user_id, source, amount, note, ref_table, ref_id)
  VALUES (NEW.user_id, 'quiz', gained, '', 'quiz_attempts', NEW.attempt_date::text)
  ON CONFLICT (user_id, source, ref_table, ref_id) WHERE ref_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER quiz_attempts_award BEFORE INSERT ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION award_quiz_xp();

-- Kulüp dönem XP'si: üyelerinin XP'si toplanır.
CREATE OR REPLACE FUNCTION sync_club_season_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE clubs c SET season_xp = coalesce((
    SELECT sum(e.amount)::integer FROM xp_events e
     JOIN club_members m ON m.user_id = e.user_id AND m.club_id = c.id
     WHERE e.created_at >= date_trunc('year', now())
  ), 0)
  WHERE c.id IN (SELECT club_id FROM club_members WHERE user_id = NEW.user_id);
  RETURN NULL;
END $$;

CREATE TRIGGER xp_events_club_sync AFTER INSERT ON xp_events
  FOR EACH ROW EXECUTE FUNCTION sync_club_season_xp();

-- =====================================================================
-- 3. UZAMSAL RPC'LER — "yakındaki kayıtlar"
-- Hepsi ST_DWithin (GIST indeksi kullanır) + <-> ile mesafe sıralaması.
-- =====================================================================

CREATE OR REPLACE FUNCTION nearby_places(
  lat double precision, lng double precision, radius_km double precision,
  place_kind text DEFAULT NULL, max_rows integer DEFAULT 50
)
RETURNS TABLE (id text, name text, kind text, country_code char(2), distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.name, p.kind, p.country_code,
         ST_Distance(p.geom, geo_point(lng, lat)) / 1000.0
  FROM places p
  WHERE ST_DWithin(p.geom, geo_point(lng, lat), radius_km * 1000)
    AND (place_kind IS NULL OR p.kind = place_kind)
  ORDER BY p.geom <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_hazards(
  lat double precision, lng double precision, radius_km double precision,
  include_resolved boolean DEFAULT false, max_rows integer DEFAULT 100
)
RETURNS TABLE (id uuid, title text, type hazard_type, severity hazard_severity,
               status hazard_status, distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT h.id, h.title, h.type, h.severity, h.status,
         ST_Distance(h.coords, geo_point(lng, lat)) / 1000.0
  FROM hazards h
  WHERE ST_DWithin(h.coords, geo_point(lng, lat), radius_km * 1000)
    AND (include_resolved OR h.status = 'active')
    AND (h.expires_at IS NULL OR h.expires_at > now())
  ORDER BY h.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_emergency_centers(
  lat double precision, lng double precision, max_rows integer DEFAULT 10
)
RETURNS TABLE (id uuid, name text, type emergency_center_type, phone text,
               open_24h boolean, distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.type, c.phone, c.open_24h,
         ST_Distance(c.coords, geo_point(lng, lat)) / 1000.0
  FROM emergency_centers c
  ORDER BY c.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_crags(
  lat double precision, lng double precision, radius_km double precision,
  max_rows integer DEFAULT 50
)
RETURNS TABLE (id uuid, name text, country_code char(2), route_count integer,
               distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.country_code, c.route_count,
         ST_Distance(c.coords, geo_point(lng, lat)) / 1000.0
  FROM crags c
  WHERE ST_DWithin(c.coords, geo_point(lng, lat), radius_km * 1000)
  ORDER BY c.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_destinations(
  lat double precision, lng double precision, radius_km double precision,
  max_rows integer DEFAULT 50
)
RETURNS TABLE (id uuid, slug text, name text, type destination_type, distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT d.id, d.slug, d.name, d.type,
         ST_Distance(d.coords, geo_point(lng, lat)) / 1000.0
  FROM destinations d
  WHERE ST_DWithin(d.coords, geo_point(lng, lat), radius_km * 1000)
  ORDER BY d.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_heritage_sites(
  lat double precision, lng double precision, radius_km double precision,
  max_rows integer DEFAULT 50
)
RETURNS TABLE (id uuid, slug text, name text, kind heritage_kind, is_unesco boolean,
               distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.slug, s.name, s.kind, s.is_unesco,
         ST_Distance(s.coords, geo_point(lng, lat)) / 1000.0
  FROM heritage_sites s
  WHERE ST_DWithin(s.coords, geo_point(lng, lat), radius_km * 1000)
  ORDER BY s.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_kid_places(
  lat double precision, lng double precision, radius_km double precision,
  band kid_age_band DEFAULT NULL, max_rows integer DEFAULT 50
)
RETURNS TABLE (id uuid, name text, kind kid_place_kind, stroller_friendly boolean,
               distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT k.id, k.name, k.kind, k.stroller_friendly,
         ST_Distance(k.coords, geo_point(lng, lat)) / 1000.0
  FROM kid_places k
  WHERE ST_DWithin(k.coords, geo_point(lng, lat), radius_km * 1000)
    AND (band IS NULL OR band = ANY (k.age_bands))
  ORDER BY k.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_pois(
  lat double precision, lng double precision, radius_km double precision,
  poi poi_kind DEFAULT NULL, max_rows integer DEFAULT 100
)
RETURNS TABLE (id uuid, name text, kind poi_kind, confirmations integer,
               distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.name, p.kind, p.confirmations,
         ST_Distance(p.coords, geo_point(lng, lat)) / 1000.0
  FROM track_pois p
  WHERE ST_DWithin(p.coords, geo_point(lng, lat), radius_km * 1000)
    AND (poi IS NULL OR p.kind = poi)
  ORDER BY p.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

CREATE OR REPLACE FUNCTION nearby_businesses(
  lat double precision, lng double precision, radius_km double precision,
  stays_only boolean DEFAULT false, max_rows integer DEFAULT 50
)
RETURNS TABLE (id uuid, name text, type business_type, rating numeric,
               price_from_try numeric, distance_km double precision)
LANGUAGE sql STABLE AS $$
  SELECT b.id, b.name, b.type, b.rating, b.price_from_try,
         ST_Distance(b.coords, geo_point(lng, lat)) / 1000.0
  FROM businesses b
  WHERE ST_DWithin(b.coords, geo_point(lng, lat), radius_km * 1000)
    AND (NOT stays_only OR b.price_from_try IS NOT NULL)
  ORDER BY b.coords <-> geo_point(lng, lat)
  LIMIT max_rows
$$;

-- ZMatch adayları: yarıçap içinde, ortak macera türü olan, engellenmemiş
-- ve daha önce eşleşmemiş kullanıcılar.
CREATE OR REPLACE FUNCTION match_candidates(
  origin_lat double precision, origin_lng double precision,
  radius_km double precision, want adventure_type DEFAULT NULL,
  max_rows integer DEFAULT 50
)
RETURNS TABLE (user_id uuid, username text, display_name text, avatar_url text,
               distance_km double precision, shared_types adventure_type[])
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         ST_Distance(p.coords, geo_point(origin_lng, origin_lat)) / 1000.0,
         ARRAY(SELECT unnest(p.favorite_types)
               INTERSECT
               SELECT unnest(me.favorite_types))::adventure_type[]
  FROM profiles p
  CROSS JOIN LATERAL (SELECT favorite_types FROM profiles WHERE id = auth.uid()) me
  WHERE p.id <> auth.uid()
    AND NOT p.is_suspended
    AND p.coords IS NOT NULL
    AND ST_DWithin(p.coords, geo_point(origin_lng, origin_lat), radius_km * 1000)
    AND (want IS NULL OR want = ANY (p.favorite_types))
    AND NOT is_blocked(p.id, auth.uid())
  ORDER BY p.coords <-> geo_point(origin_lng, origin_lat)
  LIMIT max_rows
$$;

-- =====================================================================
-- 4. AKIŞ, TREND ETİKETLER, LİDERLİK TABLOSU
-- =====================================================================

-- FeedRepository.list / SocialRepository.feed
CREATE OR REPLACE FUNCTION feed_posts(
  tab text DEFAULT 'all',              -- all | following | adventures | status
  want adventure_type DEFAULT NULL,
  tag text DEFAULT NULL,
  before_at timestamptz DEFAULT NULL,
  max_rows integer DEFAULT 30
)
RETURNS SETOF posts
LANGUAGE sql STABLE AS $$
  SELECT p.* FROM posts p
  WHERE (before_at IS NULL OR p.created_at < before_at)
    AND (want IS NULL OR p.adventure_type = want)
    AND (tag  IS NULL OR lower(tag) = ANY (SELECT lower(t) FROM unnest(p.hashtags) t))
    AND NOT is_blocked(p.author_id, coalesce(auth.uid(), p.author_id))
    AND CASE tab
          WHEN 'following'  THEN is_following(auth.uid(), p.author_id) OR p.author_id = auth.uid()
          WHEN 'adventures' THEN p.kind = 'adventure'
          WHEN 'status'     THEN p.kind IN ('status', 'photo')
          ELSE true
        END
  ORDER BY p.created_at DESC
  LIMIT max_rows
$$;

-- SocialRepository.hashtags — son 7 günde artan etiketler "trend"
CREATE OR REPLACE FUNCTION trending_hashtags(max_rows integer DEFAULT 20)
RETURNS TABLE (tag text, count bigint, trending boolean)
LANGUAGE sql STABLE AS $$
  WITH tags AS (
    SELECT lower(t) AS tag, p.created_at
    FROM posts p, unnest(p.hashtags) AS t
  )
  SELECT tag,
         count(*) AS count,
         count(*) FILTER (WHERE created_at > now() - interval '7 days') * 2 > count(*) AS trending
  FROM tags
  GROUP BY tag
  ORDER BY count(*) FILTER (WHERE created_at > now() - interval '7 days') DESC, count(*) DESC
  LIMIT max_rows
$$;

-- FunRepository.leaderboard — kapsam: friends | city | club | global
CREATE OR REPLACE FUNCTION leaderboard(
  scope leaderboard_scope DEFAULT 'global',
  since_days integer DEFAULT 7,
  max_rows integer DEFAULT 50
)
RETURNS TABLE (rank bigint, user_id uuid, username text, display_name text,
               avatar_url text, xp bigint, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH me AS (SELECT id, location_name FROM profiles WHERE id = auth.uid()),
  scoped AS (
    SELECT p.id, p.username, p.display_name, p.avatar_url
    FROM profiles p, me
    WHERE NOT p.is_suspended
      AND CASE scope
            WHEN 'friends' THEN is_mutual_follow(p.id, me.id) OR p.id = me.id
            WHEN 'city'    THEN p.location_name = me.location_name
            WHEN 'club'    THEN EXISTS (
                   SELECT 1 FROM club_members a
                   JOIN club_members b ON b.club_id = a.club_id
                   WHERE a.user_id = me.id AND b.user_id = p.id)
            ELSE true
          END
  ),
  totals AS (
    SELECT s.*, coalesce(sum(e.amount), 0) AS xp
    FROM scoped s
    LEFT JOIN xp_events e
      ON e.user_id = s.id AND e.created_at >= now() - make_interval(days => since_days)
    GROUP BY s.id, s.username, s.display_name, s.avatar_url
  )
  SELECT row_number() OVER (ORDER BY xp DESC, display_name),
         id, username, display_name, avatar_url, xp, id = auth.uid()
  FROM totals
  ORDER BY xp DESC, display_name
  LIMIT max_rows
$$;

COMMENT ON FUNCTION leaderboard IS
  'SECURITY DEFINER: başkalarının xp_events satırlarını toplayabilmesi için; '
  'yalnızca toplam XP döner, olay detayı sızmaz.';

-- =====================================================================
-- 5. REZERVASYON UYGUNLUK / ÇAKIŞMA
-- =====================================================================

-- InventoryRepository.availability — gün gün boş kontenjan
CREATE OR REPLACE FUNCTION unit_availability(
  unit uuid, from_date date, to_date date
)
RETURNS TABLE (date date, available integer, price_try numeric)
LANGUAGE sql STABLE AS $$
  SELECT d::date,
         GREATEST(0, u.quantity - (
           SELECT count(*)::integer FROM unit_blocks b
           WHERE b.unit_id = unit AND b.during @> d::date
         )),
         round(
           u.base_price_try
           * CASE WHEN extract(isodow FROM d) IN (5, 6) THEN u.weekend_multiplier ELSE 1 END
           * coalesce((
               SELECT (s ->> 'multiplier')::numeric
               FROM jsonb_array_elements(u.seasons) s
               WHERE d::date BETWEEN (s ->> 'from')::date AND (s ->> 'to')::date
               LIMIT 1), 1),
           2)
  FROM stay_units u,
       generate_series(from_date, to_date - 1, interval '1 day') d
  WHERE u.id = unit
$$;

-- InventoryRepository.quote/book — tüm aralık için yer var mı?
CREATE OR REPLACE FUNCTION is_unit_available(
  unit uuid, from_date date, to_date date
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unit_availability(unit, from_date, to_date) a WHERE a.available < 1
  )
$$;

-- Rezervasyon oluştururken boş slotu bulur; yoksa hata verir.
-- EXCLUDE kısıtı (0013) yarış durumlarında son savunmadır.
CREATE OR REPLACE FUNCTION reserve_unit(
  unit uuid, booking uuid, from_date date, to_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  qty       smallint;
  candidate smallint;
  block_id  uuid;
BEGIN
  SELECT quantity INTO qty FROM stay_units WHERE id = unit;
  IF qty IS NULL THEN
    RAISE EXCEPTION 'Birim bulunamadı.' USING ERRCODE = 'no_data_found';
  END IF;

  FOR candidate IN 0 .. qty - 1 LOOP
    BEGIN
      INSERT INTO unit_blocks (unit_id, during, reason, booking_id, slot)
      VALUES (unit, daterange(from_date, to_date, '[)'), 'booking', booking, candidate)
      RETURNING id INTO block_id;
      RETURN block_id;
    EXCEPTION WHEN exclusion_violation THEN
      -- Bu slot dolu; bir sonrakini dene.
      CONTINUE;
    END;
  END LOOP;

  RAISE EXCEPTION 'Seçilen tarihlerde uygun yer kalmadı.' USING ERRCODE = 'check_violation';
END $$;

-- =====================================================================
-- 6. SERTİFİKA KODU (domain/courses.ts ile birebir)
-- =====================================================================

-- FNV-1a 32 bit
CREATE OR REPLACE FUNCTION fnv1a32(input text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  h bigint := 2166136261;      -- 0x811c9dc5
  i integer;
BEGIN
  FOR i IN 1 .. length(input) LOOP
    h := (h # ascii(substr(input, i, 1)))::bigint;
    h := (h * 16777619) & 4294967295;   -- × 0x01000193, 32 bit'e kırp
  END LOOP;
  RETURN h;
END $$;

CREATE OR REPLACE FUNCTION certificate_block(n bigint) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  v bigint := n;
  i integer;
BEGIN
  FOR i IN 1 .. 4 LOOP
    out := substr(alphabet, (v % 32)::integer + 1, 1) || out;
    v := v / 32;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION certificate_code(
  target_user uuid, course uuid, issued timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT 'ZRV-'
      || certificate_block(fnv1a32(target_user::text || '|' || course::text || '|' || to_char(issued AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      || '-'
      || certificate_block(fnv1a32(to_char(issued AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || course::text || '|' || target_user::text || '|zirve'))
$$;

-- Kod verilmediyse üret.
CREATE OR REPLACE FUNCTION fill_certificate_code() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := certificate_code(NEW.user_id, NEW.course_id, NEW.issued_at);
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE certificates ALTER COLUMN code DROP NOT NULL;
CREATE TRIGGER certificates_fill_code BEFORE INSERT ON certificates
  FOR EACH ROW EXECUTE FUNCTION fill_certificate_code();

-- Kurs tamamlandığında sertifika bas (certificateName tanımlıysa).
CREATE OR REPLACE FUNCTION issue_certificate_on_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE c record;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT certificate_name, validity_months INTO c FROM courses WHERE id = NEW.course_id;
    IF c.certificate_name IS NOT NULL THEN
      INSERT INTO certificates (user_id, course_id, issued_at, expires_at, holder_name)
      SELECT NEW.user_id, NEW.course_id, now(),
             CASE WHEN c.validity_months IS NULL THEN NULL
                  ELSE now() + make_interval(months => c.validity_months) END,
             p.display_name
      FROM profiles p WHERE p.id = NEW.user_id
      ON CONFLICT (user_id, course_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER enrollments_issue_certificate AFTER UPDATE OF status ON enrollments
  FOR EACH ROW EXECUTE FUNCTION issue_certificate_on_completion();

-- =====================================================================
-- 7. TÜRETİLMİŞ ALANLAR
-- =====================================================================

-- Lake Louise AMS puanı ve şiddeti (domain/destinations.ts ile aynı eşikler)
CREATE OR REPLACE FUNCTION compute_ams_score() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.score := NEW.headache + NEW.gi + NEW.fatigue + NEW.dizziness;
  NEW.severity := CASE
    WHEN NEW.headache = 0 OR NEW.score < 3 THEN 'none'
    WHEN NEW.score <= 5  THEN 'mild'
    WHEN NEW.score <= 9  THEN 'moderate'
    ELSE 'severe'
  END::ams_severity;
  RETURN NEW;
END $$;

CREATE TRIGGER ams_checks_score BEFORE INSERT OR UPDATE ON ams_checks
  FOR EACH ROW EXECUTE FUNCTION compute_ams_score();

-- 3+ bağımsız onay → 'community' doğrulaması (enums.ts yorumu)
CREATE OR REPLACE FUNCTION promote_route_verification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE climbing_routes
     SET verification = 'community'
   WHERE id = NEW.route_id AND verification = 'unverified' AND confirmations >= 3;
  RETURN NULL;
END $$;

CREATE TRIGGER route_confirmations_promote AFTER INSERT ON route_confirmations
  FOR EACH ROW EXECUTE FUNCTION promote_route_verification();

-- Tehlike çözüldüğünde durum/zaman tutarlılığı
CREATE OR REPLACE FUNCTION sync_hazard_resolution() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  ELSIF NEW.status = 'active' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hazards_resolution BEFORE UPDATE OF status ON hazards
  FOR EACH ROW EXECUTE FUNCTION sync_hazard_resolution();

-- Koleksiyon sayacı
CREATE OR REPLACE FUNCTION sync_collection_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid;
BEGIN
  cid := coalesce(NEW.collection_id, OLD.collection_id);
  IF cid IS NOT NULL THEN
    UPDATE collections c
       SET count = (SELECT count(*) FROM saved_posts WHERE collection_id = c.id)
     WHERE c.id = cid;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER saved_posts_collection_count
  AFTER INSERT OR UPDATE OF collection_id OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION sync_collection_count();

-- Rezervasyon iptalinde blokajı kaldır ve ödemeyi iade sürecine al.
CREATE OR REPLACE FUNCTION release_blocks_on_cancel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    DELETE FROM unit_blocks WHERE booking_id = NEW.id;
    NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stay_bookings_release_blocks BEFORE UPDATE OF status ON stay_bookings
  FOR EACH ROW EXECUTE FUNCTION release_blocks_on_cancel();

-- Ödeme durum geçişini timeline'a yaz.
CREATE OR REPLACE FUNCTION append_payment_timeline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.timeline := NEW.timeline || jsonb_build_object('status', NEW.status::text, 'at', now());
    IF NEW.status = 'released' AND NEW.released_at IS NULL THEN
      NEW.released_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER payments_timeline BEFORE UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION append_payment_timeline();

-- =====================================================================
-- 8. EDGE FONKSİYONLARI İÇİN YARDIMCILAR
-- =====================================================================

-- geography(Point) → {lat, lng}
CREATE OR REPLACE FUNCTION geo_latlng(p geography)
RETURNS TABLE (lat double precision, lng double precision)
LANGUAGE sql IMMUTABLE AS $$
  SELECT ST_Y(p::geometry), ST_X(p::geometry)
$$;

-- sos-dispatch: SOS kaydının koordinatını çözer (sos_events | sos_sessions).
CREATE OR REPLACE FUNCTION sos_coordinates(table_name text, row_id uuid)
RETURNS TABLE (lat double precision, lng double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF table_name NOT IN ('sos_events', 'sos_sessions') THEN
    RAISE EXCEPTION 'Geçersiz tablo: %', table_name USING ERRCODE = 'check_violation';
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT ST_Y(coords::geometry), ST_X(coords::geometry) FROM %I WHERE id = $1',
    table_name) USING row_id;
END $$;

-- return-promise-check: süresi geçmiş, henüz uyarılmamış dönüş sözleri.
CREATE OR REPLACE FUNCTION overdue_return_plans(grace_extra_min integer DEFAULT 0)
RETURNS TABLE (id uuid, user_id uuid, title text, expected_return_at timestamptz,
               contact_ids uuid[], overdue_min integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT r.id, r.user_id, r.title, r.expected_return_at, r.contact_ids,
         (extract(epoch FROM now() - r.expected_return_at) / 60)::integer
  FROM return_plans r
  WHERE r.status IN ('planned', 'active')
    AND r.alert_sent_at IS NULL
    AND now() > r.expected_return_at
                + make_interval(mins => r.grace_min + grace_extra_min)
  ORDER BY r.expected_return_at
$$;

-- payment-webhook: emanet durum geçişi (yalnızca ileri yönde).
CREATE OR REPLACE FUNCTION advance_payment(
  payment uuid, next_status payment_status, provider_reference text DEFAULT NULL,
  refund_try numeric DEFAULT NULL
) RETURNS payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  ranks constant payment_status[] :=
    ARRAY['pending', 'authorized', 'escrow', 'released', 'refunded', 'failed']::payment_status[];
  current_status payment_status;
  result payments;
BEGIN
  SELECT status INTO current_status FROM payments WHERE id = payment FOR UPDATE;
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Ödeme bulunamadı: %', payment USING ERRCODE = 'no_data_found';
  END IF;
  -- released/refunded/failed uç durumlardır; geri dönüş yok.
  IF current_status IN ('released', 'refunded', 'failed') THEN
    RAISE EXCEPTION 'Ödeme % durumundan çıkarılamaz.', current_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF array_position(ranks, next_status) < array_position(ranks, current_status) THEN
    RAISE EXCEPTION 'Geçersiz ödeme geçişi: % → %', current_status, next_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE payments
     SET status = next_status,
         provider_ref = coalesce(provider_reference, provider_ref),
         refunded_try = coalesce(refund_try, refunded_try)
   WHERE id = payment
  RETURNING * INTO result;

  -- Ev sahibi bakiyesi: emanetten çıkınca hakedişe geçer.
  IF next_status = 'released' THEN
    UPDATE host_profiles h
       SET pending_payout_try = GREATEST(0, h.pending_payout_try
                                            - (result.amount_try - result.platform_fee_try)),
           paid_out_try = h.paid_out_try + (result.amount_try - result.platform_fee_try)
      FROM stay_bookings b
     WHERE b.id = result.booking_id AND h.business_id = b.business_id;
  ELSIF next_status = 'escrow' THEN
    UPDATE host_profiles h
       SET pending_payout_try = h.pending_payout_try
                                + (result.amount_try - result.platform_fee_try)
      FROM stay_bookings b
     WHERE b.id = result.booking_id AND h.business_id = b.business_id;
  END IF;

  RETURN result;
END $$;

-- Yeni RPC'lere yürütme izni
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
