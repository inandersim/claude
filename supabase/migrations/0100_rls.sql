-- =====================================================================
-- Zirtan — 0100 · Satır düzeyi güvenlik (RLS)
--
-- Kurallar `src/data/mock/repos/*.ts` ve `src/data/mock/provider.ts`
-- içindeki yetki kontrollerinden türetilmiştir. Her tablo dört gruptan
-- birine girer:
--
--   A) Açık referans veri   → herkes okur, yalnızca service_role yazar
--   B) Sahibine özel        → yalnızca auth.uid() = owner
--   C) Açık içerik          → herkes okur, sahibi yazar/siler
--   D) Taraf bazlı          → yalnızca ilgili taraflar (mesaj, danışma…)
--
-- service_role RLS'i tümüyle atlar (BYPASSRLS); edge fonksiyonları ve
-- veri hattı bu rolle çalışır.
-- =====================================================================

SET search_path = public, extensions;

-- --------------------------------------------------------------------
-- Politika üreticileri — tekrarlayan desenleri tek satırda kurar.
-- --------------------------------------------------------------------

-- A) Açık referans veri: SELECT herkese, yazma yalnızca service_role'a.
CREATE OR REPLACE PROCEDURE rls_public_read(tbl regclass)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO anon, authenticated USING (true)',
    tbl::text || '_read_all', tbl);
END $$;

-- B) Sahibine özel: tüm işlemler yalnızca satırın sahibine.
CREATE OR REPLACE PROCEDURE rls_owner_all(tbl regclass, owner_col text DEFAULT 'user_id')
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR ALL TO authenticated USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())',
    tbl::text || '_own', tbl, owner_col, owner_col);
END $$;

-- C) Açık içerik: herkes okur; sahibi ekler/günceller/siler.
CREATE OR REPLACE PROCEDURE rls_public_read_owner_write(tbl regclass, owner_col text DEFAULT 'user_id')
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO anon, authenticated USING (true)',
    tbl::text || '_read_all', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (%I = auth.uid())',
    tbl::text || '_insert_own', tbl, owner_col);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR UPDATE TO authenticated USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())',
    tbl::text || '_update_own', tbl, owner_col, owner_col);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR DELETE TO authenticated USING (%I = auth.uid())',
    tbl::text || '_delete_own', tbl, owner_col);
END $$;

-- Kullanıcının kendi kayıt/kaldırma yaptığı bağlantı tabloları
-- (beğeni, kaydetme, onay): herkes okur, herkes kendi satırını yazar.
CREATE OR REPLACE PROCEDURE rls_join_table(tbl regclass, owner_col text DEFAULT 'user_id')
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO anon, authenticated USING (true)',
    tbl::text || '_read_all', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (%I = auth.uid())',
    tbl::text || '_insert_own', tbl, owner_col);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR DELETE TO authenticated USING (%I = auth.uid())',
    tbl::text || '_delete_own', tbl, owner_col);
END $$;

-- =====================================================================
-- A) AÇIK REFERANS VERİ — okuma serbest, yazma yalnızca service_role
-- =====================================================================
CALL rls_public_read('places');                  -- kütüphane (veri hattı üretir)
CALL rls_public_read('trending_locations');
CALL rls_public_read('emergency_centers');
CALL rls_public_read('first_aid_guides');
CALL rls_public_read('plan_definitions');
CALL rls_public_read('map_regions');
CALL rls_public_read('trail_nodes');
CALL rls_public_read('trail_edges');
CALL rls_public_read('map_packs');
CALL rls_public_read('badges');
CALL rls_public_read('challenges');
CALL rls_public_read('quiz_questions');
CALL rls_public_read('destinations');
CALL rls_public_read('destination_stages');
CALL rls_public_read('weather_cache');
CALL rls_public_read('elevation_cache');
CALL rls_public_read('avalanche_bulletins');
CALL rls_public_read('country_guides');
CALL rls_public_read('species');
CALL rls_public_read('deterrent_profiles');
CALL rls_public_read('news_items');
CALL rls_public_read('tv_schedule');
CALL rls_public_read('heritage_sites');
CALL rls_public_read('audio_guide_stops');
CALL rls_public_read('kid_places');
CALL rls_public_read('hunt_tasks');
CALL rls_public_read('family_checklist_items');
CALL rls_public_read('courses');
CALL rls_public_read('course_sessions');
CALL rls_public_read('community_trails');

-- Ders içeriği: yalnızca önizleme dersleri herkese; gerisi KAYITLI olana.
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lessons_preview_read ON lessons FOR SELECT TO anon, authenticated
  USING (preview);
CREATE POLICY lessons_enrolled_read ON lessons FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.course_id = lessons.course_id AND e.user_id = auth.uid()
  ));
-- Kursun eğitmeni kendi derslerini yönetir (courses.ts:289).
CREATE POLICY lessons_instructor_write ON lessons FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM courses c WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM courses c WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid()
  ));

-- =====================================================================
-- Çekirdek: profiller, takip, engelleme
-- =====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Profil kartları herkese açık (arama, akış, liderlik tablosu).
-- Engellenen kullanıcılar birbirini göremez.
CREATE POLICY profiles_read_all ON profiles FOR SELECT TO anon, authenticated
  USING (NOT is_suspended AND NOT is_blocked(id, coalesce(auth.uid(), id)));
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- INSERT yalnızca handle_new_auth_user tetikleyicisi üzerinden (SECURITY DEFINER).

CALL rls_join_table('follows', 'follower_id');
CALL rls_owner_all('blocks', 'blocker_id');
CALL rls_owner_all('emergency_contacts');

-- Şikâyet: kullanıcı kendi şikâyetini görür ve açar; kapatma moderatöre.
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_insert_own ON reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY reports_read_own ON reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- =====================================================================
-- Sosyal
-- =====================================================================

CALL rls_public_read_owner_write('routes', 'created_by');
CALL rls_public_read_owner_write('posts', 'author_id');
CALL rls_public_read_owner_write('comments', 'author_id');
CALL rls_join_table('post_likes');
CALL rls_join_table('reactions');
CALL rls_owner_all('collections');
CALL rls_owner_all('saved_posts');
CALL rls_public_read_owner_write('stories', 'author_id');
CALL rls_join_table('story_views');

-- =====================================================================
-- D) Birebir mesajlaşma, eşleşme, bildirim — yalnızca taraflar
-- =====================================================================

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_read_parties ON matches FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY matches_insert_requester ON matches FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
-- İsteğe YALNIZCA ALICI yanıt verir (provider.ts:503).
CREATE POLICY matches_respond_receiver ON matches FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());
CREATE POLICY matches_delete_requester ON matches FOR DELETE TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending');

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_read_parties ON messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY messages_send_own ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND NOT is_blocked(sender_id, receiver_id));
-- Okundu bilgisini yalnızca ALICI işaretler.
CREATE POLICY messages_mark_read ON messages FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());
CREATE POLICY messages_delete_sender ON messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read_own ON notifications FOR SELECT TO authenticated
  USING (receiver_id = auth.uid());
CREATE POLICY notifications_update_own ON notifications FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());
CREATE POLICY notifications_delete_own ON notifications FOR DELETE TO authenticated
  USING (receiver_id = auth.uid());
-- Bildirim üretimi tetikleyici/edge fonksiyonu (service_role) işidir.

-- =====================================================================
-- Tehlikeler — yalnızca BİLDİREN çözebilir (provider.ts:704)
-- =====================================================================

ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
CREATE POLICY hazards_read_all ON hazards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hazards_report ON hazards FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY hazards_resolve_reporter ON hazards FOR UPDATE TO authenticated
  USING (reporter_id = auth.uid()) WITH CHECK (reporter_id = auth.uid());
CREATE POLICY hazards_delete_reporter ON hazards FOR DELETE TO authenticated
  USING (reporter_id = auth.uid());

CALL rls_join_table('hazard_confirmations');

-- =====================================================================
-- Canlı yayın — yayını yalnızca YAYINCI bitirebilir (provider.ts:823)
-- =====================================================================

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_streams_read_all ON live_streams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY live_streams_start_own ON live_streams FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY live_streams_update_host ON live_streams FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY live_streams_delete_host ON live_streams FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CALL rls_public_read_owner_write('stream_messages', 'author_id');
CALL rls_join_table('stream_likes');

-- =====================================================================
-- Market — ilanı yalnızca SATICI kapatır (provider.ts:934)
-- =====================================================================

CALL rls_public_read_owner_write('listings', 'seller_id');
CALL rls_owner_all('listing_favorites');

-- =====================================================================
-- Eğitmenler
-- =====================================================================

CALL rls_public_read_owner_write('instructors');
CALL rls_public_read_owner_write('instructor_reviews', 'author_id');

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_read_parties ON bookings FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR owns_instructor(instructor_id, auth.uid()));
CREATE POLICY bookings_create_student ON bookings FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'pending');
-- Talebe yalnızca EĞİTMEN yanıt verir (provider.ts:1046).
CREATE POLICY bookings_respond_instructor ON bookings FOR UPDATE TO authenticated
  USING (owns_instructor(instructor_id, auth.uid()))
  WITH CHECK (owns_instructor(instructor_id, auth.uid()));
CREATE POLICY bookings_cancel_student ON bookings FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');

-- =====================================================================
-- Canlı konum — domain/presence.ts görünürlük kuralları
-- =====================================================================

ALTER TABLE location_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_shares_own ON location_shares FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Görünürlük: sos → acil kişiler; friends → karşılıklı takip;
-- matches → kabul edilmiş eşleşme. Süresi dolmuş paylaşım görünmez.
CREATE POLICY location_shares_visible ON location_shares FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND NOT is_blocked(user_id, auth.uid())
    AND CASE mode
          WHEN 'sos'     THEN true
          WHEN 'friends' THEN is_mutual_follow(user_id, auth.uid())
          WHEN 'matches' THEN is_matched(user_id, auth.uid())
        END
  );

ALTER TABLE location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_pings_own ON location_pings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- İz geçmişi yalnızca AÇIK bir SOS varken acil kişilere görünür.
CREATE POLICY location_pings_sos_contacts ON location_pings FOR SELECT TO authenticated
  USING (
    is_emergency_contact(user_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM sos_events s
      WHERE s.user_id = location_pings.user_id AND s.resolved_at IS NULL
    )
  );

-- =====================================================================
-- İşletmeler, konaklama, envanter, emanet ödeme
-- =====================================================================

CALL rls_public_read_owner_write('businesses', 'owner_id');

ALTER TABLE stay_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY stay_bookings_read_parties ON stay_bookings FOR SELECT TO authenticated
  USING (guest_id = auth.uid() OR owns_business(business_id, auth.uid()));
CREATE POLICY stay_bookings_create_guest ON stay_bookings FOR INSERT TO authenticated
  WITH CHECK (guest_id = auth.uid());
CREATE POLICY stay_bookings_update_parties ON stay_bookings FOR UPDATE TO authenticated
  USING (guest_id = auth.uid() OR owns_business(business_id, auth.uid()))
  WITH CHECK (guest_id = auth.uid() OR owns_business(business_id, auth.uid()));

-- Birimler herkese görünür (fiyat/uygunluk); yalnızca sahibi yönetir.
ALTER TABLE stay_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY stay_units_read_all ON stay_units FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY stay_units_manage_owner ON stay_units FOR ALL TO authenticated
  USING (owns_business(business_id, auth.uid()))
  WITH CHECK (owns_business(business_id, auth.uid()));

-- Dolu tarihler herkese görünür (takvim); yalnızca sahibi kapatır.
ALTER TABLE unit_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY unit_blocks_read_all ON unit_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY unit_blocks_manage_owner ON unit_blocks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stay_units u
    WHERE u.id = unit_blocks.unit_id AND owns_business(u.business_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM stay_units u
    WHERE u.id = unit_blocks.unit_id AND owns_business(u.business_id, auth.uid())
  ));

-- Ödeme: yalnızca ödeyen ve ev sahibi görür; durum geçişleri service_role'a
-- (payment-webhook edge fonksiyonu) aittir.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read_parties ON payments FOR SELECT TO authenticated
  USING (
    payer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM stay_bookings b
      WHERE b.id = payments.booking_id AND owns_business(b.business_id, auth.uid())
    )
  );

CALL rls_public_read_owner_write('stay_reviews', 'author_id');

ALTER TABLE host_profiles ENABLE ROW LEVEL SECURITY;
-- Doğrulama seviyesi ve iptal politikası misafire de görünür.
CREATE POLICY host_profiles_read_all ON host_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY host_profiles_manage_owner ON host_profiles FOR ALL TO authenticated
  USING (owns_business(business_id, auth.uid()))
  WITH CHECK (owns_business(business_id, auth.uid()));

-- =====================================================================
-- Faturalama
-- =====================================================================

CALL rls_owner_all('subscriptions');
CALL rls_owner_all('payouts');

-- =====================================================================
-- Acil durum & SOS
-- =====================================================================

ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sos_events_own ON sos_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Acil durum kişileri açık SOS'u görebilir.
CREATE POLICY sos_events_contacts_read ON sos_events FOR SELECT TO authenticated
  USING (is_emergency_contact(user_id, auth.uid()));

-- =====================================================================
-- Yapay zekâ, görüntü analizi — tamamen kişisel
-- =====================================================================

CALL rls_owner_all('ai_threads');
CALL rls_owner_all('ai_trip_plans');
CALL rls_owner_all('vision_history');

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_messages_own_thread ON ai_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_threads t WHERE t.id = ai_messages.thread_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_threads t WHERE t.id = ai_messages.thread_id AND t.user_id = auth.uid()
  ));

-- =====================================================================
-- Haritalar
-- =====================================================================

CALL rls_owner_all('map_pack_downloads');
CALL rls_owner_all('saved_routes');

-- =====================================================================
-- Tırmanış — topluluk katkısı, kendi rotanı onaylayamazsın
-- =====================================================================

CALL rls_public_read_owner_write('crags', 'submitted_by');
CALL rls_public_read_owner_write('climbing_routes', 'submitted_by');
CALL rls_public_read_owner_write('ascents');
CALL rls_join_table('route_confirmations');

ALTER TABLE crag_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY crag_sectors_read_all ON crag_sectors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY crag_sectors_write_crag_author ON crag_sectors FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crags c WHERE c.id = crag_sectors.crag_id AND c.submitted_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM crags c WHERE c.id = crag_sectors.crag_id AND c.submitted_by = auth.uid()
  ));

-- =====================================================================
-- Uydu — cihaz, mesaj ve SOS oturumu kişiseldir
-- =====================================================================

CALL rls_owner_all('sat_devices');
CALL rls_owner_all('sat_messages');

ALTER TABLE sos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sos_sessions_own ON sos_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sos_sessions_contacts_read ON sos_sessions FOR SELECT TO authenticated
  USING (is_emergency_contact(user_id, auth.uid()));

-- =====================================================================
-- Kulüpler — rol bazlı yönetim
-- =====================================================================

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY clubs_read_all ON clubs FOR SELECT TO anon, authenticated USING (true);
-- Kulüp bilgilerini yalnızca başkan/yetkili düzenler.
CREATE POLICY clubs_update_officers ON clubs FOR UPDATE TO authenticated
  USING (club_role_of(id, auth.uid()) IN ('officer', 'president'))
  WITH CHECK (club_role_of(id, auth.uid()) IN ('officer', 'president'));

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_members_read_all ON club_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY club_members_join_self ON club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member');
CREATE POLICY club_members_leave_self ON club_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());
-- Rol atamasını yalnızca başkan yapar.
CREATE POLICY club_members_manage_president ON club_members FOR UPDATE TO authenticated
  USING (club_role_of(club_id, auth.uid()) = 'president')
  WITH CHECK (club_role_of(club_id, auth.uid()) = 'president');

ALTER TABLE club_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_events_read_all ON club_events FOR SELECT TO anon, authenticated USING (true);
-- Etkinlik oluşturmak için ÜYE olmalısın (clubs.ts:177).
CREATE POLICY club_events_create_member ON club_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_club_member(club_id, auth.uid()));
CREATE POLICY club_events_manage_author ON club_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR club_role_of(club_id, auth.uid()) IN ('officer', 'president'))
  WITH CHECK (created_by = auth.uid() OR club_role_of(club_id, auth.uid()) IN ('officer', 'president'));
CREATE POLICY club_events_delete_author ON club_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR club_role_of(club_id, auth.uid()) = 'president');

CALL rls_join_table('event_rsvps');
CALL rls_owner_all('student_verifications');

-- =====================================================================
-- Oyunlaştırma
-- =====================================================================

CALL rls_join_table('earned_badges');       -- rozetler profilde görünür
CALL rls_public_read_owner_write('passport_stamps');
CALL rls_owner_all('challenge_progress');
CALL rls_owner_all('xp_events');            -- liderlik tablosu profiles.xp'yi kullanır
CALL rls_owner_all('quiz_attempts');

-- =====================================================================
-- Destinasyonlar, AMS, dönüş sözü
-- =====================================================================

CALL rls_owner_all('saved_destinations');
CALL rls_owner_all('ams_checks');           -- SAĞLIK VERİSİ

ALTER TABLE return_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY return_plans_own ON return_plans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Plana eklenen acil kişiler planı görebilir (gecikmede arama-kurtarma).
CREATE POLICY return_plans_contacts_read ON return_plans FOR SELECT TO authenticated
  USING (auth.uid() = ANY (contact_ids) OR is_emergency_contact(user_id, auth.uid()));

-- =====================================================================
-- Gruplar & kanallar — rol bazlı
-- =====================================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
-- Açık gruplar herkese; özel gruplar yalnızca üyelerine görünür.
CREATE POLICY groups_read_visible ON groups FOR SELECT TO authenticated
  USING (privacy = 'public' OR is_group_member(id, auth.uid()));
CREATE POLICY groups_read_public_anon ON groups FOR SELECT TO anon
  USING (privacy = 'public');
CREATE POLICY groups_create_own ON groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_manage_admins ON groups FOR UPDATE TO authenticated
  USING (can_manage_group(id, auth.uid())) WITH CHECK (can_manage_group(id, auth.uid()));
CREATE POLICY groups_delete_owner ON groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_members_read_members ON group_members FOR SELECT TO authenticated
  USING (is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
-- Açık gruba kendin katılırsın; özel gruba davet/kod ile (RPC, service_role).
CREATE POLICY group_members_join_public ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'member'
    AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.privacy = 'public')
  );
-- Yönetici üye ekleyebilir/çıkarabilir (groups.ts:265).
CREATE POLICY group_members_manage_admin ON group_members FOR ALL TO authenticated
  USING (can_manage_group(group_id, auth.uid()))
  WITH CHECK (can_manage_group(group_id, auth.uid()));
CREATE POLICY group_members_update_self ON group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND role = (
    SELECT m.role FROM group_members m WHERE m.group_id = group_members.group_id AND m.user_id = auth.uid()
  ));
CREATE POLICY group_members_leave_self ON group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_messages_read_members ON group_messages FOR SELECT TO authenticated
  USING (is_group_member(group_id, auth.uid()));
-- Kanalda yalnızca yöneticiler yazar (groups.ts:297).
CREATE POLICY group_messages_send ON group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND can_post_to_group(group_id, auth.uid()));
CREATE POLICY group_messages_edit_own ON group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY group_messages_delete ON group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR can_manage_group(group_id, auth.uid()));

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_votes_read_members ON poll_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_messages m
    WHERE m.id = poll_votes.message_id AND is_group_member(m.group_id, auth.uid())
  ));
CREATE POLICY poll_votes_vote_own ON poll_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- Kurslar
-- =====================================================================

CALL rls_owner_all('enrollments');
CALL rls_public_read_owner_write('course_reviews', 'author_id');

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
-- Sertifika kodu doğrulaması herkese açık (işverenler/kurumlar için).
CREATE POLICY certificates_read_all ON certificates FOR SELECT TO anon, authenticated USING (true);
-- Basımı yalnızca sistem (service_role) yapar.

-- =====================================================================
-- İzler, POI'ler, topluluk rotaları
-- =====================================================================

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tracks_read_public_or_own ON tracks FOR SELECT TO authenticated
  USING (is_public OR user_id = auth.uid());
CREATE POLICY tracks_read_public_anon ON tracks FOR SELECT TO anon USING (is_public);
CREATE POLICY tracks_insert_own ON tracks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- Yalnızca kendi parçanı yayınlar/silersin (tracks.ts:275, 297).
CREATE POLICY tracks_update_own ON tracks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tracks_delete_own ON tracks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CALL rls_public_read_owner_write('track_pois');
CALL rls_join_table('poi_confirmations');
CALL rls_join_table('trail_verifications');
CALL rls_join_table('track_likes');

-- =====================================================================
-- Ülke rehberi kontrol listesi — kişisel
-- =====================================================================

CALL rls_owner_all('country_checklists');

-- =====================================================================
-- Yazarlar & makaleler
-- =====================================================================

CALL rls_public_read_owner_write('writer_profiles');
CALL rls_join_table('writer_follows', 'follower_id');

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
-- Taslaklar yalnızca yazarına görünür.
CREATE POLICY articles_read_published ON articles FOR SELECT TO anon, authenticated
  USING (status <> 'draft');
CREATE POLICY articles_read_own_drafts ON articles FOR SELECT TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY articles_write_own ON articles FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
-- Yalnızca yazarı düzenleyebilir (articles.ts:194).
CREATE POLICY articles_update_own ON articles FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY articles_delete_own ON articles FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CALL rls_public_read_owner_write('article_comments', 'author_id');
CALL rls_join_table('article_likes');
CALL rls_owner_all('article_saves');

-- =====================================================================
-- Türler, soru-cevap, kaçırma sesleri
-- =====================================================================

CALL rls_owner_all('species_identifications');
CALL rls_public_read_owner_write('wildlife_questions', 'author_id');
CALL rls_public_read_owner_write('wildlife_answers', 'author_id');
CALL rls_join_table('answer_upvotes');
CALL rls_owner_all('deterrent_events');

-- =====================================================================
-- Tele-tıp — yalnızca hasta ve atanan doktoru (SAĞLIK VERİSİ)
-- =====================================================================

CALL rls_public_read_owner_write('doctors');

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY consultations_read_parties ON consultations FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM doctors d WHERE d.id = consultations.doctor_id AND d.user_id = auth.uid())
    -- Doğrulanmış doktorlar BEKLEYEN talep kuyruğunu görebilir (telemed.ts:326)
    OR (status = 'requested' AND EXISTS (
          SELECT 1 FROM doctors d WHERE d.user_id = auth.uid() AND d.is_verified))
  );
CREATE POLICY consultations_create_patient ON consultations FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() AND status = 'requested');
CREATE POLICY consultations_update_parties ON consultations FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM doctors d WHERE d.id = consultations.doctor_id AND d.user_id = auth.uid())
    OR (status = 'requested' AND EXISTS (
          SELECT 1 FROM doctors d WHERE d.user_id = auth.uid() AND d.is_verified))
  )
  WITH CHECK (is_consult_participant(id, auth.uid()));

ALTER TABLE consult_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY consult_messages_read_parties ON consult_messages FOR SELECT TO authenticated
  USING (is_consult_participant(consultation_id, auth.uid()));
CREATE POLICY consult_messages_send_parties ON consult_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_consult_participant(consultation_id, auth.uid()));

-- =====================================================================
-- Zirtan TV
-- =====================================================================

ALTER TABLE tv_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tv_channels_read_all ON tv_channels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tv_channels_manage_owner ON tv_channels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE tv_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tv_programs_read_approved ON tv_programs FOR SELECT TO anon, authenticated
  USING (is_approved);
CREATE POLICY tv_programs_read_own ON tv_programs FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());
-- Program yükleme: kanal sahibi ya da kullanıcı katkısı (onay bekler).
CREATE POLICY tv_programs_submit ON tv_programs FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY tv_programs_update_owner ON tv_programs FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM tv_channels c WHERE c.id = tv_programs.channel_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM tv_channels c WHERE c.id = tv_programs.channel_id AND c.owner_id = auth.uid())
  );

CALL rls_owner_all('watch_progress');
CALL rls_owner_all('watch_later');
CALL rls_join_table('program_likes');
CALL rls_join_table('channel_follows');

-- =====================================================================
-- Tarihi alanlar
-- =====================================================================

CALL rls_owner_all('heritage_tours');
CALL rls_owner_all('heritage_saves');
CALL rls_owner_all('heritage_visits');

-- =====================================================================
-- Çocuk modülü — ÇOCUK VERİSİ yalnızca ebeveyne
-- =====================================================================

CALL rls_owner_all('child_profiles');
CALL rls_owner_all('hunt_progress');
CALL rls_owner_all('kid_place_saves');

-- --------------------------------------------------------------------
-- Rol izinleri: RLS'in etkili olması için tablo düzeyi GRANT gerekir.
-- --------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
