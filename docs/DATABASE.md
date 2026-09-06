# Zirtan — Veritabanı Mimarisi

> Kurulum ve dağıtım adımları için [`supabase/README.md`](../supabase/README.md).

Postgres 16+ (üretimde 17) + PostGIS 3.4. Şema PostGIS ve pg_trgm
dışında sürüme özgü hiçbir özellik kullanmaz; CI doğrulaması Postgres 16.13
+ PostGIS 3.4 üzerinde yapılmıştır. Şema `src/data/repositories/index.ts` içindeki
**38 repository arayüzünün** birebir sunucu karşılığıdır.

| Ölçüm | Değer |
|---|---|
| Tablo | 136 |
| Enum tipi | 105 |
| RLS politikası | 299 (136/136 tabloda RLS açık) |
| Fonksiyon | 90 |
| Tetikleyici | 89 |
| İndeks | 548 (44 GIST uzamsal, 60 GIN) |
| Yabancı anahtar | 214 |

---

## 1. Temel tasarım kararları

**Kimlikler.** Tüm birincil anahtarlar `uuid`. `profiles.id` doğrudan
`auth.users.id`'ye bakar (1-1). İstisnalar: `places.id` (`text` — açık veri
kaynağının kimliği, `tools/data-pipeline/schema.postgis.sql` ile ortak),
`country_guides.country_code` (`char(2)`), `first_aid_guides.slug`,
`family_checklist_items.key`, `deterrent_profiles.animal`, `plan_definitions.plan`.

**Coğrafya.** Nokta alanları `geography(Point, 4326)`, çizgiler
`geography(LineString, 4326)`. `geography` seçildi çünkü mesafe sorguları
metre cinsinden ve dünya ölçeğinde doğru olmalı (`ST_DWithin` küresel
hesaplar). Her coğrafi kolonun bir **GIST** indeksi var; yakınlık sorguları
`ST_DWithin(...)` ile süzüp `<->` ile sıralar.

**Zaman.** İstisnasız `timestamptz`, `DEFAULT now()`. Yalnızca takvim
günü tutan alanlar (`check_in`, `check_out`, `attempt_date`, `ascents.date`)
`date`.

**Alan adları.** `domain/types.ts` içindeki TypeScript alan adlarının
snake_case karşılığı. `displayName → display_name`, `priceTry → price_try`.
Böylece istemci eşlemesi mekanik kalır, elle sözlük gerekmez.

**Enum'lar.** 105 Postgres enum'u `src/domain/enums.ts`'ten üretilir
(`supabase/migrations/0002_enums.sql`). Kaynak değişirse enum listesi de
değişmeli — yeni değer eklemek `ALTER TYPE ... ADD VALUE` ile yapılır.

**JSONB nerede?** Yalnızca şekli sabit olmayan ya da bütün olarak okunan
yapılar: `destinations.transports/permits`, `stay_units.seasons`,
`payments.timeline`, `group_messages.poll`, `lessons.quiz`,
`tracks.points`, `saved_routes.planned`, `ai_messages.actions`.
Sorgulanan her alan normal kolondur.

---

## 2. Modül → tablo haritası

### Çekirdek (`0003_core.sql`)
| Tablo | İlişkiler | Not |
|---|---|---|
| `profiles` | → `auth.users` (1-1) | domain `User`. `xp`, `plan`, `push_tokens` eklendi |
| `emergency_contacts` | → `profiles` (N-1), → `profiles` (kişi) | `User.emergencyContacts` normalize edildi |
| `follows` | `profiles` × `profiles` | karşılıklı takip = "arkadaş" |
| `blocks` | `profiles` × `profiles` | RLS görünürlüğünün temeli |
| `reports` | → `profiles` | moderasyon şikâyeti |

### Telefon doğrulama (`0035_phone_auth.sql`)
| Tablo | İlişkiler | Not |
|---|---|---|
| `user_phones` | → `profiles` (1-1) | Doğrulanmış E.164 numara, **tekil**. Numara `profiles`'te DEĞİL: orada SELECT herkese açık. RLS: yalnızca sahibi okur, yazma yok (tetikleyici açar) |
| `otp_attempts` | — | Kod gönderim/doğrulama defteri. Ham numara yok, peppered SHA-256 özeti + IP. RLS politikası yok → yalnızca `service_role` |

`profiles` iki kolon kazandı: `profile_completed` (kayıt ekranı gerekli mi) ve
`phone_verified` (numarası doğrulanmış hesap). `handle_new_auth_user`
telefonla açılan kayıtları da karşılar. Ayrıntı: `docs/AUTH.md`.

### Sosyal (`0004_social.sql`)
`routes` · `trending_locations` · `posts` · `comments` · `post_likes` ·
`reactions` · `collections` · `saved_posts` · `stories` · `story_views`

`posts` üç gönderi türünü birleştirir (`kind`: adventure / status / photo);
`repost_of_id` kendine referansla alıntı zinciri kurar. Sayaçlar
(`likes_count`, `comments_count`, `saves_count`, `reposts_count`)
tetikleyicilerle tutulur.

### Mesajlaşma (`0005_messaging.sql`)
`matches` (ZMatch) · `messages` · `notifications`

`matches` üzerinde `matches_one_pending_idx` kısmi benzersiz indeksi aynı
çift arasında tek bekleyen istek bırakır.

### Diğer modüller
| Migration | Tablolar |
|---|---|
| `0006` tehlikeler | `hazards`, `hazard_confirmations` |
| `0007` canlı yayın | `live_streams`, `stream_messages`, `stream_likes` |
| `0008` market | `listings`, `listing_favorites` |
| `0009` eğitmenler | `instructors`, `instructor_reviews`, `bookings` |
| `0010` kütüphane | `places` |
| `0011` konum | `location_shares`, `location_pings` |
| `0012` işletmeler | `businesses`, `stay_bookings` |
| `0013` envanter | `stay_units`, `unit_blocks`, `payments`, `stay_reviews`, `host_profiles` |
| `0014` faturalama | `plan_definitions`, `subscriptions`, `payouts` |
| `0015` acil durum | `emergency_centers`, `sos_events`, `first_aid_guides` |
| `0016` yapay zekâ | `ai_threads`, `ai_messages`, `ai_trip_plans` |
| `0017` haritalar | `map_regions`, `trail_nodes`, `trail_edges`, `map_packs`, `map_pack_downloads`, `saved_routes` |
| `0018` tırmanış | `crags`, `crag_sectors`, `climbing_routes`, `ascents`, `route_confirmations` |
| `0019` uydu | `sat_devices`, `sat_messages`, `sos_sessions` |
| `0020` kulüpler | `clubs`, `club_members`, `club_events`, `event_rsvps`, `student_verifications` |
| `0021` oyunlaştırma | `badges`, `earned_badges`, `challenges`, `challenge_progress`, `xp_events`, `quiz_questions`, `quiz_attempts`, `passport_stamps` |
| `0022` destinasyonlar | `destinations`, `destination_stages`, `saved_destinations`, `ams_checks`, `return_plans` |
| `0023` görüntü analizi | `vision_history` |
| `0024` gruplar | `groups`, `group_members`, `group_messages`, `poll_votes` |
| `0025` kurslar | `courses`, `lessons`, `course_sessions`, `enrollments`, `certificates`, `course_reviews` |
| `0026` izler | `community_trails`, `tracks`, `track_pois`, `poi_confirmations`, `trail_verifications`, `track_likes` |
| `0027` hava | `weather_cache`, `elevation_cache`, `avalanche_bulletins` |
| `0028` ülkeler | `country_guides`, `country_checklists` |
| `0029` makaleler | `writer_profiles`, `writer_follows`, `articles`, `article_comments`, `article_likes`, `article_saves` |
| `0030` türler | `species`, `species_identifications`, `wildlife_questions`, `wildlife_answers`, `answer_upvotes`, `deterrent_profiles`, `deterrent_events` |
| `0031` tele-tıp | `doctors`, `consultations`, `consult_messages` |
| `0032` TV | `tv_channels`, `tv_programs`, `tv_schedule`, `news_items`, `watch_progress`, `watch_later`, `program_likes`, `channel_follows` |
| `0033` tarihi alanlar | `heritage_sites`, `audio_guide_stops`, `heritage_tours`, `heritage_saves`, `heritage_visits` |
| `0034` çocuk | `kid_places`, `kid_place_saves`, `child_profiles`, `hunt_tasks`, `hunt_progress`, `family_checklist_items` |

### Modüller arası bağlar

```
profiles ──┬─ posts ── comments / reactions / saved_posts
           ├─ tracks ── track_pois ── community_trails ── heritage_sites
           ├─ businesses ── stay_units ── unit_blocks ── stay_bookings ── payments
           ├─ instructors ── bookings          clubs ── club_events ── event_rsvps
           ├─ groups ── group_messages ── poll_votes
           ├─ consultations ── consult_messages    (species, first_aid_guides)
           ├─ enrollments ── certificates       courses ── lessons / course_sessions
           └─ xp_events ── (profiles.xp)        earned_badges ── badges ── challenges

destinations ──┬─ destination_stages
               ├─ return_plans / ams_checks
               ├─ articles / tv_programs
               └─ heritage_sites
```

### `ON DELETE` davranışları

| Desen | Kural | Örnek |
|---|---|---|
| Sahiplik | `CASCADE` | kullanıcı silinince gönderileri, mesajları, sağlık kayıtları da silinir |
| Bağlantı tablosu | `CASCADE` | `post_likes`, `event_rsvps`, `follows` |
| İsteğe bağlı bağ | `SET NULL` | `posts.route_id`, `payments`↔`emergency_centers`, `messages.match_id` |
| Geçmiş kaydı | `SET NULL` | `sat_messages.device_id` — cihaz silinse de mesaj geçmişi kalır |
| Zincir içerik | `CASCADE` | `posts.repost_of_id` — kaynak silinince alıntı da düşer |
| Kişisel ↔ referans | `SET NULL` | `consultations.doctor_id` — doktor hesabı gitse de hasta kaydı kalır |

---

## 3. RLS özeti

Her tablo dört gruptan birindedir. Politikalar `0100_rls.sql` içinde
üretici prosedürlerle (`rls_public_read`, `rls_owner_all`,
`rls_public_read_owner_write`, `rls_join_table`) kurulur; kritik tablolarda
elle yazılmış politikalar vardır.

### A) Açık referans veri — herkes okur, yalnızca `service_role` yazar
`places`, `country_guides`, `first_aid_guides`, `species`,
`deterrent_profiles`, `emergency_centers`, `destinations`,
`destination_stages`, `heritage_sites`, `audio_guide_stops`, `kid_places`,
`hunt_tasks`, `family_checklist_items`, `badges`, `challenges`,
`quiz_questions`, `plan_definitions`, `map_regions`, `trail_nodes`,
`trail_edges`, `map_packs`, `weather_cache`, `elevation_cache`,
`avalanche_bulletins`, `news_items`, `tv_schedule`, `courses`,
`course_sessions`, `community_trails`, `trending_locations`

### B) Sahibine özel — `auth.uid() = owner`
Kişisel/hassas veri hiçbir koşulda başkasına açılmaz:

| Tablo | Gerekçe |
|---|---|
| `ai_threads`, `ai_messages`, `ai_trip_plans` | yapay zekâ sohbet geçmişi |
| `vision_history` | kamera görüntüleri ve analiz |
| `ams_checks` | **sağlık verisi** (Lake Louise AMS) |
| `child_profiles`, `hunt_progress`, `kid_place_saves` | **çocuk verisi** |
| `sat_devices`, `sat_messages` | uydu cihaz ve mesajları |
| `country_checklists` | pasaport/vize belge durumu |
| `emergency_contacts`, `blocks` | mahremiyet |
| `xp_events`, `quiz_attempts`, `challenge_progress` | ham puan geçmişi (toplamı `profiles.xp` üzerinden açık) |
| `subscriptions`, `payouts` | finansal |
| `saved_routes`, `map_pack_downloads`, `collections`, `saved_posts` | kişisel kayıtlar |
| `heritage_tours`, `heritage_saves`, `heritage_visits`, `watch_progress`, `watch_later`, `article_saves`, `saved_destinations`, `listing_favorites`, `species_identifications`, `deterrent_events`, `student_verifications` | kişisel liste/geçmiş |

### C) Açık içerik — herkes okur, sahibi yazar/siler
`posts`, `comments`, `stories`, `routes`, `listings`, `instructors`,
`instructor_reviews`, `stream_messages`, `crags`, `crag_sectors`,
`climbing_routes`, `ascents`, `track_pois`, `passport_stamps`,
`writer_profiles`, `article_comments`, `wildlife_questions`,
`wildlife_answers`, `stay_reviews`, `course_reviews`, `businesses`,
`doctors` ve bağlantı tabloları (`post_likes`, `reactions`, `follows`,
`hazard_confirmations`, `route_confirmations`, `poi_confirmations`,
`trail_verifications`, `track_likes`, `stream_likes`, `article_likes`,
`answer_upvotes`, `earned_badges`, `event_rsvps`, `program_likes`,
`channel_follows`, `writer_follows`, `story_views`).

### D) Taraf/rol bazlı — mock repolardan birebir türetilenler

| Kural | Kaynak | Politika |
|---|---|---|
| Tehlikeyi **yalnızca bildiren** çözer | `provider.ts:704` | `hazards_resolve_reporter` (`reporter_id = auth.uid()`) |
| Kendi tehlikeni **onaylayamazsın** | `provider.ts:680` | `forbid_self_hazard_confirm()` tetikleyicisi |
| Gönderiyi **yalnızca yazarı** siler | `repos/social.ts:337` | `posts_delete_own` |
| İsteğe **yalnızca alıcı** yanıt verir | `provider.ts:503` | `matches_respond_receiver` |
| Yayını **yalnızca yayıncı** bitirir | `provider.ts:823` | `live_streams_update_host` |
| İlanı **yalnızca satıcı** kapatır | `provider.ts:934` | `listings_update_own` |
| Ders talebine **yalnızca eğitmen** yanıt verir | `provider.ts:1046` | `bookings_respond_instructor` |
| **Kendinden ders** talep edilemez | `provider.ts:1004` | `forbid_self_booking()` tetikleyicisi |
| Rezervasyon **yalnızca misafirine ve ev sahibine** | `repos/inventory.ts:261` | `stay_bookings_read_parties` |
| Envanteri **yalnızca işletme sahibi** yönetir | `repos/inventory.ts:103` | `stay_units_manage_owner`, `unit_blocks_manage_owner` |
| Doğrulama seviyesi **düşürülemez** | `repos/inventory.ts:437` | `forbid_verification_downgrade()` |
| Yalnızca **kendi parçanı** yayınlar/silersin | `repos/tracks.ts:275,297` | `tracks_update_own`, `tracks_delete_own` |
| Kendi rotanı **onaylayamazsın** | `repos/climbing.ts:180` | `forbid_self_route_confirm()` |
| Etkinlik açmak için **kulüp üyesi** olmalısın | `repos/clubs.ts:177` | `club_events_create_member` |
| Grup yönetimi **rol bazlı** | `repos/groups.ts:265,269` | `group_members_manage_admin`, `can_manage_group()` |
| **Kanalda yalnızca yöneticiler** yazar | `repos/groups.ts:297` | `group_messages_send` + `can_post_to_group()` |
| Grup **sahibi ayrılamaz** | `repos/groups.ts:234` | `forbid_owner_leave()` |
| Özel grup **yalnızca üyelerine** görünür | `repos/groups.ts:211` | `groups_read_visible` |
| Yayımlamak için **onaylı yazar** olmalısın | `repos/articles.ts:150` | `require_approved_writer()` |
| Yazıyı **yalnızca yazarı** düzenler; taslak gizli | `repos/articles.ts:194` | `articles_update_own`, `articles_read_own_drafts` |
| Yorum için **kursa kayıt** şart | `repos/courses.ts:261` | `require_enrollment_for_review()` |
| Ders içeriği **yalnızca kayıtlıya** (önizleme hariç) | `domain/courses.ts` | `lessons_enrolled_read`, `lessons_preview_read` |
| Konsültasyon **yalnızca hasta + atanan doktor** | `repos/telemed.ts:114` | `is_consult_participant()` |
| Kapalı danışmaya **mesaj gönderilemez** | `repos/telemed.ts:282` | `require_open_consultation()` |
| Cevabı **yalnızca soru sahibi** kabul eder | `repos/wildlife.ts:250` | `check_answer_acceptance()` |

### Canlı konum görünürlüğü

`domain/presence.ts → visibleShares()` kuralı politikaya çevrildi:

```sql
CREATE POLICY location_shares_visible ON location_shares FOR SELECT
USING (
  (expires_at IS NULL OR expires_at > now())
  AND NOT is_blocked(user_id, auth.uid())
  AND CASE mode
        WHEN 'sos'     THEN true                               -- acil durum
        WHEN 'friends' THEN is_mutual_follow(user_id, auth.uid())
        WHEN 'matches' THEN is_matched(user_id, auth.uid())
      END
);
```

`location_pings` (konum izi) daha da dardır: yalnızca sahibi, **ve açık bir
SOS varken** acil durum kişileri görebilir.

### Yetki yardımcıları

`SECURITY DEFINER` + `STABLE` işaretlidirler; politika içinden çağrıldıklarında
yinelemeli RLS değerlendirmesine girmezler:

`is_mutual_follow` · `is_following` · `is_blocked` · `is_emergency_contact` ·
`is_matched` · `owns_business` · `owns_instructor` · `is_club_member` ·
`club_role_of` · `is_group_member` · `group_role_of` · `can_manage_group` ·
`can_post_to_group` · `is_consult_participant`

---

## 4. Fonksiyonlar ve tetikleyiciler

### Uzamsal RPC'ler (`0200_functions.sql`)
`nearby_places` · `nearby_hazards` · `nearby_emergency_centers` ·
`nearby_crags` · `nearby_destinations` · `nearby_heritage_sites` ·
`nearby_kid_places` · `nearby_pois` · `nearby_businesses` · `match_candidates`

Hepsi aynı deseni izler:

```sql
WHERE ST_DWithin(coords, geo_point(lng, lat), radius_km * 1000)  -- GIST indeksi
ORDER BY coords <-> geo_point(lng, lat)                          -- KNN sıralaması
```

### Sorgu RPC'leri
`feed_posts(tab, want, tag, before_at, max_rows)` — `FeedRepository.list` /
`SocialRepository.feed`; engellenen kullanıcıları ve sekme süzgecini uygular.
`trending_hashtags(max_rows)` — son 7 gündeki payı toplamın yarısını aşan
etiketler "trend" sayılır.
`leaderboard(scope, since_days, max_rows)` — friends / city / club / global.
`unit_availability(unit, from, to)` ve `is_unit_available(...)`.
`overdue_return_plans(...)`, `sos_coordinates(...)`, `advance_payment(...)`.

### Sayaç tetikleyicileri
Genel amaçlı `bump_counter(hedef_tablo, sayaç, fk)` 20 bağlantı tablosunda
kullanılır. Ayrıca: `sync_follow_counts`, `sync_member_count`,
`sync_repost_count`, `sync_rating` (eğitmen/işletme/kurs ortalaması),
`sync_crag_route_counts`, `sync_lesson_count`, `sync_stage_count`,
`sync_article_count`, `sync_collection_count`.

### Oyunlaştırma
`xp_for(source)` ve `xp_threshold(n) = 100·(n−1)·n/2` — `domain/gamification.ts`
ile birebir. `award_xp()` `xp_events_ref_key` benzersiz indeksi sayesinde aynı
olayı iki kez puanlamaz; `revoke_xp_trigger` kaynak satır silinince XP'yi geri
alır (XP çiftçiliğini önler). `sync_profile_xp` → `profiles.xp`,
`sync_club_season_xp` → `clubs.season_xp`.

### Rezervasyon bütünlüğü
Aşırı rezervasyon veritabanı seviyesinde imkânsızdır:

```sql
CONSTRAINT unit_blocks_no_overlap
  EXCLUDE USING GIST (unit_id WITH =, slot WITH =, during WITH &&)
```

`reserve_unit(unit, booking, from, to)` boş slotu döngüyle arar; kısıt yarış
durumlarında son savunmadır. `tv_schedule` de aynı yöntemle çakışmayı önler.

### Sertifika kodu
`certificate_code(user, course, issued)` → `ZRV-XXXX-XXXX`.
`fnv1a32` + 32 harfli alfabe (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) ile
`domain/courses.ts → certificateCode()` ile **aynı** çıktıyı verir; test
(`02_rls_tests.sql` #15) bu eşitliği doğrular. Kurs tamamlanınca
`issue_certificate_on_completion` sertifikayı otomatik basar.

### Türetilmiş alanlar
`compute_ams_score` (Lake Louise puanı ve şiddeti), `promote_route_verification`
(3+ bağımsız onay → `community`), `sync_hazard_resolution`,
`append_payment_timeline`, `append_sos_timeline`, `release_blocks_on_cancel`,
`sync_route_path` / `sync_points_path` (nokta dizisi → `LineString`).

---

## 5. İndeks gerekçeleri

| Tür | Sayı | Neden |
|---|---|---|
| **GIST (uzamsal)** | 44 | Her coğrafi kolonda. `ST_DWithin` + `<->` KNN sıralaması bu indeks olmadan tam tarama yapar; kütüphanede 168 → milyonlarca satıra çıkacak. |
| **GIN (trigram)** | ~30 | `pg_trgm` ile `ILIKE '%…%'` aramaları: kullanıcı adı, gönderi metni, yer/kaya/destinasyon/kurs/makale/tür adları. Türkçe ekli sözcüklerde (`Kaçkarlar'da`) tam metin aramadan daha iyi sonuç verir. |
| **GIN (dizi)** | ~30 | `adventure_types`, `hashtags`, `mentions`, `specialties`, `age_bands`, `eras`, `country_codes` gibi `&&` / `@>` süzgeçleri. |
| **Kısmi indeks** | ~25 | Sıcak alt kümeler: `WHERE status='active'` (tehlikeler), `WHERE NOT is_sold` (ilanlar), `WHERE is_public` (izler), `WHERE NOT is_read` (bildirimler), `WHERE pushed_at IS NULL` (push kuyruğu). Küçük indeks = daha hızlı tarama, daha az yazma maliyeti. |
| **Kısmi benzersiz** | 6 | İş kuralını indeksle uygular: tek bekleyen eşleşme, tek aktif SOS, tek açık danışma, grup başına tek sahip, cihaz başına tek IMEI. |
| **Bileşik** | ~40 | Akış ve sohbet sorguları: `(author_id, created_at DESC)`, `(group_id, created_at DESC)`, `(receiver_id, created_at DESC)`. |
| **İfade indeksi** | 2 | `lower(username)` (büyük/küçük harf duyarsız benzersizlik), `messages_thread_idx` `least/greatest` ile iki yönlü sohbeti tek indekste tarar. |
| **Yabancı anahtar** | 214/214 | `01_assertions.sql` indekssiz FK kalmadığını doğrular; indekssiz FK üst tablodan silmede tam tarama yapar. |

---

## 6. Ölçekleme notları

**Şimdiden hazır olanlar**
- Sayaçlar denormalize (`likes_count` vb.) — akışta `count(*)` yok.
- Bağlantı havuzu `config.toml`'da `transaction` modunda (mobil istemci çok
  sayıda kısa bağlantı açar).
- PostgREST `max_rows = 1000` ile sınırsız çekimi engeller.
- Uzamsal sorgular yarıçapla sınırlıdır; `LIMIT` varsayılanları RPC imzasında.

**Büyüdükçe yapılacaklar**

1. **Bölümleme (partitioning).** Zaman serisi tabloları aylık `RANGE`
   bölümlemeye aday: `location_pings`, `xp_events`, `notifications`,
   `messages`, `group_messages`, `weather_cache`. Eski bölümleri `DETACH` +
   arşivle. `location_pings` zaten pg_cron ile 72 saatte budanıyor.
2. **Akış (feed) genişletme.** `feed_posts` şimdilik "pull" modeli
   (takip edilenlerden çek). Takip grafiği büyüdüğünde `feed_entries`
   materyalize tablosuna ("fan-out on write") geçilmeli; gönderi
   ekleme tetikleyicisi takipçilere satır yazar.
3. **Trend etiketler.** `trending_hashtags` her çağrıda tüm gönderileri
   tarar. `MATERIALIZED VIEW` + saatlik `REFRESH ... CONCURRENTLY`.
4. **Liderlik tablosu.** `leaderboard` `xp_events` üzerinde toplama yapar;
   haftalık/aylık toplamları `xp_weekly` özet tablosuna taşımak gerekir.
5. **Kütüphane (places).** Açık veri hattı milyonlarca satır üretebilir.
   `kind` ya da `country_code` üzerinde `LIST` bölümleme + ülke başına
   ayrı GIST indeksi.
6. **Okuma kopyası.** Kütüphane, destinasyon, tür ve makale gibi salt okunur
   modüller okuma replikasına yönlendirilebilir (Supabase Read Replica).
7. **Medya.** Görseller Storage + CDN'de; veritabanı yalnızca yol tutar.
   `tv-videos` kovası için ayrı CDN/HLS paketleyici önerilir.
8. **Realtime.** Publication 13 tabloyla sınırlı tutuldu; her yeni tablo
   WAL trafiğini artırır. Yüksek hacimli kanallar (grup mesajı) için
   `filter` ile abone olun, tüm tabloyu dinlemeyin.
9. **Vacuum.** Sayaç tetikleyicileri `posts`, `profiles` gibi tablolarda çok
   sayıda ölü satır üretir; bu tablolarda `autovacuum_vacuum_scale_factor`
   0.02'ye çekilmeli.

**İzleme**
`pg_stat_statements` açık tutulmalı. İzlenecek ilk sorgular: `feed_posts`,
`nearby_places`, `leaderboard`, `unit_availability`.
