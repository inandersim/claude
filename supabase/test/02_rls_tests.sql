-- =====================================================================
-- Zirtan — RLS davranış testleri
-- Tohum verisiyle birlikte çalışır. `SET LOCAL request.jwt.claim.sub`
-- ile kimlik taklit edilir; rol `authenticated`'a düşürülür.
-- Her bölüm başarısız olursa EXCEPTION fırlatır.
-- =====================================================================
\set ON_ERROR_STOP on
\pset pager off

CREATE OR REPLACE FUNCTION _assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN RAISE EXCEPTION 'BAŞARISIZ: %', msg; END IF;
  RAISE NOTICE '  ✓ %', msg;
END $$;

-- Test kullanıcıları (seed'deki ilk üç profil)
CREATE OR REPLACE FUNCTION _uid(n integer) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT id FROM profiles ORDER BY joined_at, id OFFSET n LIMIT 1
$$;

DO $$
DECLARE
  a uuid := _uid(0);
  b uuid := _uid(1);
  c uuid := _uid(2);
  n integer;
BEGIN
  RAISE NOTICE 'RLS testleri — a=% b=% c=%', a, b, c;

  -- ================================================================
  -- 1. Birebir mesajlar yalnızca taraflara görünür
  -- ================================================================
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM messages WHERE sender_id <> a AND receiver_id <> a;
  PERFORM _assert(n = 0, 'messages: taraf olmayan mesaj görünmüyor');
  RESET ROLE;

  -- ================================================================
  -- 2. Yapay zekâ sohbeti yalnızca sahibine
  -- ================================================================
  PERFORM set_config('request.jwt.claim.sub', b::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM ai_threads WHERE user_id <> b;
  PERFORM _assert(n = 0, 'ai_threads: başkasının sohbeti görünmüyor');
  SELECT count(*) INTO n FROM ai_messages;
  PERFORM _assert(
    n = (SELECT count(*) FROM ai_messages m JOIN ai_threads t ON t.id = m.thread_id WHERE t.user_id = b),
    'ai_messages: yalnızca kendi konularının mesajları');
  RESET ROLE;

  -- ================================================================
  -- 3. Tele-tıp: yalnızca hasta ve atanan doktor
  -- ================================================================
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM consult_messages cm
   WHERE NOT is_consult_participant(cm.consultation_id, a);
  PERFORM _assert(n = 0, 'consult_messages: taraf olmayan mesaj görünmüyor');
  RESET ROLE;

  -- ================================================================
  -- 4. Sağlık verisi (AMS) yalnızca sahibine
  -- ================================================================
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM ams_checks WHERE user_id <> a;
  PERFORM _assert(n = 0, 'ams_checks: başkasının sağlık kaydı görünmüyor');
  RESET ROLE;

  -- ================================================================
  -- 5. Çocuk profilleri yalnızca ebeveyne
  -- ================================================================
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM child_profiles WHERE user_id <> a;
  PERFORM _assert(n = 0, 'child_profiles: başkasının çocuğu görünmüyor');
  RESET ROLE;
END $$;

-- =====================================================================
-- 6. Gönderiyi yalnızca yazarı silebilir
-- =====================================================================
DO $$
DECLARE
  victim uuid;
  author uuid;
  other  uuid;
  n integer;
BEGIN
  SELECT id, author_id INTO victim, author FROM posts LIMIT 1;
  SELECT id INTO other FROM profiles WHERE id <> author LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', other::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM posts WHERE id = victim;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM _assert(n = 0, 'posts: başkasının gönderisi silinemedi');

  PERFORM set_config('request.jwt.claim.sub', author::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM posts WHERE id = victim;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM _assert(n = 1, 'posts: yazarı kendi gönderisini sildi');
  RAISE EXCEPTION 'geri al' USING ERRCODE = 'restrict_violation';
EXCEPTION WHEN restrict_violation THEN
  RAISE NOTICE '  (silme testi geri alındı)';
END $$;

-- =====================================================================
-- 7. Tehlikeyi yalnızca bildiren çözebilir
-- =====================================================================
DO $$
DECLARE
  h uuid; reporter uuid; other uuid; n integer;
BEGIN
  SELECT id, reporter_id INTO h, reporter FROM hazards WHERE status = 'active' LIMIT 1;
  SELECT id INTO other FROM profiles WHERE id <> reporter LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', other::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE hazards SET status = 'resolved' WHERE id = h;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM _assert(n = 0, 'hazards: başkası çözüldü işaretleyemedi');

  PERFORM set_config('request.jwt.claim.sub', reporter::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE hazards SET status = 'resolved' WHERE id = h;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM _assert(n = 1, 'hazards: bildiren çözüldü işaretledi');
  RAISE EXCEPTION 'geri al' USING ERRCODE = 'restrict_violation';
EXCEPTION WHEN restrict_violation THEN NULL;
END $$;

-- =====================================================================
-- 8. Kendi tehlikeni onaylayamazsın (tetikleyici)
-- =====================================================================
DO $$
DECLARE h uuid; reporter uuid; ok boolean := false;
BEGIN
  SELECT id, reporter_id INTO h, reporter FROM hazards LIMIT 1;
  BEGIN
    INSERT INTO hazard_confirmations (user_id, hazard_id) VALUES (reporter, h);
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM _assert(ok, 'hazard_confirmations: kendi bildirimini onaylayamadı');
END $$;

-- =====================================================================
-- 9. Canlı konum görünürlüğü (friends = karşılıklı takip)
-- =====================================================================
DO $$
DECLARE owner_id uuid; viewer uuid; n integer;
BEGIN
  SELECT s.user_id INTO owner_id FROM location_shares s WHERE s.mode = 'friends' LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE NOTICE '  (friends modunda paylaşım yok, atlandı)';
    RETURN;
  END IF;
  -- Karşılıklı takip etmeyen biri
  SELECT p.id INTO viewer FROM profiles p
   WHERE p.id <> owner_id AND NOT is_mutual_follow(owner_id, p.id) LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', viewer::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM location_shares WHERE user_id = owner_id;
  RESET ROLE;
  PERFORM _assert(n = 0, 'location_shares: karşılıklı takip yoksa konum gizli');

  -- Karşılıklı takip eden biri (varsa)
  SELECT p.id INTO viewer FROM profiles p
   WHERE p.id <> owner_id AND is_mutual_follow(owner_id, p.id) LIMIT 1;
  IF viewer IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', viewer::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM location_shares WHERE user_id = owner_id;
    RESET ROLE;
    PERFORM _assert(n = 1, 'location_shares: karşılıklı takipçi konumu görüyor');
  END IF;
END $$;

-- =====================================================================
-- 10. Özel grup mesajları yalnızca üyelerine
-- =====================================================================
DO $$
DECLARE g uuid; outsider uuid; n integer;
BEGIN
  SELECT id INTO g FROM groups LIMIT 1;
  SELECT p.id INTO outsider FROM profiles p
   WHERE NOT is_group_member(g, p.id) LIMIT 1;
  IF outsider IS NULL THEN RETURN; END IF;

  PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM group_messages WHERE group_id = g;
  RESET ROLE;
  PERFORM _assert(n = 0, 'group_messages: üye olmayan mesajları göremiyor');
END $$;

-- =====================================================================
-- 11. Rezervasyon çakışması (EXCLUDE kısıtı)
-- =====================================================================
DO $$
DECLARE u uuid; ok boolean := false; b1 uuid;
BEGIN
  SELECT id INTO u FROM stay_units WHERE quantity = 1 LIMIT 1;
  IF u IS NULL THEN SELECT id INTO u FROM stay_units LIMIT 1; END IF;

  INSERT INTO unit_blocks (unit_id, during, reason, slot)
  VALUES (u, daterange('2030-01-10', '2030-01-15', '[)'), 'maintenance', 0)
  RETURNING id INTO b1;

  BEGIN
    INSERT INTO unit_blocks (unit_id, during, reason, slot)
    VALUES (u, daterange('2030-01-12', '2030-01-18', '[)'), 'maintenance', 0);
  EXCEPTION WHEN exclusion_violation THEN ok := true;
  END;
  DELETE FROM unit_blocks WHERE id = b1;
  PERFORM _assert(ok, 'unit_blocks: çakışan tarih aralığı reddedildi');
END $$;

-- =====================================================================
-- 12. Sayaç tetikleyicileri
-- =====================================================================
DO $$
DECLARE p uuid; u uuid; before_count integer; after_count integer;
BEGIN
  SELECT id INTO p FROM posts LIMIT 1;
  SELECT id INTO u FROM profiles WHERE id NOT IN (SELECT user_id FROM post_likes WHERE post_id = p) LIMIT 1;
  SELECT likes_count INTO before_count FROM posts WHERE id = p;
  INSERT INTO post_likes (user_id, post_id) VALUES (u, p);
  SELECT likes_count INTO after_count FROM posts WHERE id = p;
  PERFORM _assert(after_count = before_count + 1, 'posts.likes_count: beğeni ile arttı');
  DELETE FROM post_likes WHERE user_id = u AND post_id = p;
  SELECT likes_count INTO after_count FROM posts WHERE id = p;
  PERFORM _assert(after_count = before_count, 'posts.likes_count: beğeni kalkınca azaldı');
END $$;

-- =====================================================================
-- 13. XP tetikleyicisi ve profiles.xp senkronu
-- =====================================================================
DO $$
DECLARE u uuid; xp_before integer; xp_after integer; pid uuid;
BEGIN
  SELECT id INTO u FROM profiles LIMIT 1;
  SELECT xp INTO xp_before FROM profiles WHERE id = u;
  INSERT INTO posts (author_id, kind, caption, adventure_type, difficulty)
  VALUES (u, 'adventure', 'XP testi', 'hiking', 'easy') RETURNING id INTO pid;
  SELECT xp INTO xp_after FROM profiles WHERE id = u;
  PERFORM _assert(xp_after = xp_before + 10, 'xp_events: gönderi 10 XP kazandırdı');
  DELETE FROM posts WHERE id = pid;
  SELECT xp INTO xp_after FROM profiles WHERE id = u;
  PERFORM _assert(xp_after = xp_before, 'xp_events: gönderi silinince XP geri alındı');
END $$;

-- =====================================================================
-- 14. Uzamsal RPC'ler çalışıyor
-- =====================================================================
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM nearby_places(41.0, 29.0, 500);
  PERFORM _assert(n > 0, format('nearby_places: İstanbul çevresinde %s kayıt', n));
  SELECT count(*) INTO n FROM nearby_emergency_centers(41.0, 29.0, 5);
  PERFORM _assert(n > 0, 'nearby_emergency_centers: en yakın merkezler döndü');
  SELECT count(*) INTO n FROM trending_hashtags(10);
  PERFORM _assert(n >= 0, 'trending_hashtags: çalıştı');
END $$;

-- =====================================================================
-- 15. Sertifika kodu üretimi
-- =====================================================================
DO $$
DECLARE code text;
BEGIN
  SELECT certificate_code(
    '11111111-2222-3333-4444-555555555555'::uuid,
    '66666666-7777-8888-9999-000000000000'::uuid,
    '2026-09-06T10:20:30.400Z'::timestamptz) INTO code;
  -- domain/courses.ts → certificateCode() ile aynı sonuç
  PERFORM _assert(code = 'ZRV-2A6G-PN64',
    format('certificate_code: TypeScript ile birebir (%s)', code));
END $$;

-- =====================================================================
-- 16. Rezervasyon slotu ayırma
-- =====================================================================
DO $$
DECLARE u uuid; b uuid; blk uuid; ok boolean := false;
BEGIN
  SELECT id INTO u FROM stay_units LIMIT 1;
  SELECT id INTO b FROM stay_bookings LIMIT 1;
  SELECT reserve_unit(u, b, '2031-05-01', '2031-05-05') INTO blk;
  PERFORM _assert(blk IS NOT NULL, 'reserve_unit: slot ayrıldı');
  DELETE FROM unit_blocks WHERE id = blk;
END $$;

DROP FUNCTION _assert(boolean, text);
DROP FUNCTION _uid(integer);

SELECT 'RLS ve fonksiyon testleri tamamlandı' AS sonuc;
