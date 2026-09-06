-- =====================================================================
-- Zirtan — 0300 · Realtime yayınları ve Storage kovaları
--
-- Realtime: istemcinin canlı dinlediği tablolar publication'a eklenir.
-- RLS, Realtime için de geçerlidir (Supabase "RLS-aware" yayın yapar):
-- kullanıcı yalnızca SELECT edebildiği satırların değişimini görür.
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- REALTIME
-- --------------------------------------------------------------------

-- Satır silme/güncelleme olaylarında eski değerleri de yayınla ki
-- istemci önbelleğinden doğru satırı düşürebilsin.
ALTER TABLE messages         REPLICA IDENTITY FULL;
ALTER TABLE group_messages   REPLICA IDENTITY FULL;
ALTER TABLE stream_messages  REPLICA IDENTITY FULL;
ALTER TABLE consult_messages REPLICA IDENTITY FULL;
ALTER TABLE notifications    REPLICA IDENTITY FULL;
ALTER TABLE location_shares  REPLICA IDENTITY FULL;
ALTER TABLE sos_events       REPLICA IDENTITY FULL;
ALTER TABLE sos_sessions     REPLICA IDENTITY FULL;
ALTER TABLE poll_votes       REPLICA IDENTITY FULL;
ALTER TABLE matches          REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
  realtime_tables constant text[] := ARRAY[
    'messages',         -- birebir sohbet
    'group_messages',   -- grup/kanal mesajları
    'poll_votes',       -- anket sonuçları canlı
    'stream_messages',  -- canlı yayın sohbeti
    'live_streams',     -- izleyici sayısı / yayın durumu
    'location_shares',  -- canlı konum
    'notifications',    -- bildirim rozeti
    'matches',          -- ZMatch istek/yanıt
    'consult_messages', -- tele-tıp sohbeti
    'consultations',    -- danışma durumu (kabul/bitiş)
    'sos_events',       -- uygulama içi SOS
    'sos_sessions',     -- uydu SOS aşamaları
    'hazards'           -- yakındaki yeni tehlike uyarısı
  ];
BEGIN
  FOREACH t IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- STORAGE — kovalar
-- public = true → CDN üzerinden imzasız okunur (avatar, kapak, medya)
-- public = false → imzalı URL gerekir (sağlık görselleri, belgeler)
-- --------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',       'avatars',       true,   5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('covers',        'covers',        true,  10 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('post-media',    'post-media',    true,  25 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('story-media',   'story-media',   true,  25 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('listing-media', 'listing-media', true,  15 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('article-media', 'article-media', true,  15 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('species-photos','species-photos',true,  15 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('tv-videos',     'tv-videos',     true, 512::bigint * 1024 * 1024,
   ARRAY['video/mp4', 'video/webm', 'application/vnd.apple.mpegurl']),
  ('heritage-media','heritage-media',true,  25 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg']),
  ('map-packs',     'map-packs',     true, 2048::bigint * 1024 * 1024,
   ARRAY['application/octet-stream', 'application/vnd.pmtiles']),
  ('gpx-tracks',    'gpx-tracks',    false, 10 * 1024 * 1024,
   ARRAY['application/gpx+xml', 'application/xml', 'text/xml']),
  -- Gizli kovalar: sağlık ve kimlik verisi
  ('vision-uploads','vision-uploads',false, 15 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('consult-media', 'consult-media', false, 15 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('host-documents','host-documents',false, 20 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- --------------------------------------------------------------------
-- STORAGE — politikalar
-- Yol düzeni: <bucket>/<user_id>/<dosya>. İlk klasör segmenti sahibi
-- belirler; böylece kullanıcı yalnızca kendi klasörüne yazabilir.
-- --------------------------------------------------------------------

-- Açık kovalarda okuma serbest
DROP POLICY IF EXISTS zirtan_public_buckets_read ON storage.objects;
CREATE POLICY zirtan_public_buckets_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN (
    'avatars', 'covers', 'post-media', 'story-media', 'listing-media',
    'article-media', 'species-photos', 'tv-videos', 'heritage-media', 'map-packs'
  ));

-- Kendi klasörüne yükleme
DROP POLICY IF EXISTS zirtan_own_folder_insert ON storage.objects;
CREATE POLICY zirtan_own_folder_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN (
      'avatars', 'covers', 'post-media', 'story-media', 'listing-media',
      'article-media', 'species-photos', 'tv-videos', 'heritage-media',
      'gpx-tracks', 'vision-uploads', 'consult-media', 'host-documents'
    )
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kendi dosyanı güncelle/sil
DROP POLICY IF EXISTS zirtan_own_folder_update ON storage.objects;
CREATE POLICY zirtan_own_folder_update ON storage.objects FOR UPDATE TO authenticated
  USING ((storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK ((storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS zirtan_own_folder_delete ON storage.objects;
CREATE POLICY zirtan_own_folder_delete ON storage.objects FOR DELETE TO authenticated
  USING ((storage.foldername(name))[1] = auth.uid()::text);

-- Gizli kovalar: yalnızca sahibi okur…
DROP POLICY IF EXISTS zirtan_private_owner_read ON storage.objects;
CREATE POLICY zirtan_private_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('gpx-tracks', 'vision-uploads', 'consult-media', 'host-documents')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- …tele-tıp görselini danışmanın DOKTORU da okuyabilir.
-- Yol: consult-media/<hasta_id>/<consultation_id>/<dosya>
DROP POLICY IF EXISTS zirtan_consult_doctor_read ON storage.objects;
CREATE POLICY zirtan_consult_doctor_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'consult-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
      SELECT 1 FROM consultations c
      JOIN doctors d ON d.id = c.doctor_id
      WHERE c.id::text = (storage.foldername(name))[2] AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE storage.buckets IS
  'Zirtan kovaları — 0300_realtime_storage.sql. Yol düzeni: <bucket>/<user_id>/<dosya>.';
