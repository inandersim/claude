# Uzak veri sağlayıcısı (Supabase)

`src/data/remote/` — `src/data/repositories/index.ts` içindeki **38 repository /
306 metotluk** sözleşmenin Supabase (PostgREST + PostGIS) uygulaması.
Mock sağlayıcı (`src/data/mock/`) referanstır: iş kuralları `src/domain`
içindeki saf fonksiyonlardan geldiği için iki uygulama **aynı davranışı**
üretir. Ekranlar hangisinin bağlı olduğunu bilmez.

---

## Dizin düzeni

```
src/data/remote/
├── client.ts       Supabase istemcisi (AsyncStorage oturumu, otomatik yenileme)
├── postgrest.ts    Kullanılan PostgREST yüzeyinin yapısal tipleri + hata sarmalayıcılar
├── context.ts      Ortak bağlam: profil çekme, bildirim yazma, hata sınıfları
├── mappers.ts      satır ↔ domain (snake_case ↔ camelCase, tarih, PostGIS noktası)
├── provider.ts     DataProvider birleşimi
├── realtime.ts     Grup/yayın sohbeti, canlı konum, bildirim abonelikleri
├── storage.ts      Medya yükleme (kova, boyut/tip doğrulaması, EXIF notu)
├── offline.ts      Çevrimdışı yazma kuyruğu ve çakışma politikası
└── repos/
    ├── core.ts     auth, users, feed, explore, matches, notifications,
    │               messages, hazards, live, market, instructors, library,
    │               presence, stories, businesses, billing, emergency
    ├── social.ts   social
    ├── groups.ts   groups
    ├── inventory.ts inventory
    ├── climbing.ts climbing
    ├── fun.ts      fun
    ├── clubs.ts    clubs
    ├── courses.ts  courses
    ├── places.ts   destinations, countries, heritage, kids
    ├── articles.ts articles
    ├── wildlife.ts wildlife
    ├── telemed.ts  telemed
    ├── tv.ts       tv
    ├── tracks.ts   tracks
    └── tools.ts    ai, maps, satellite, vision, weather
```

---

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | uzak için | `https://<proje>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | uzak için | Genel anon anahtarı (RLS korur) |
| `EXPO_PUBLIC_DATA_PROVIDER` | hayır | `mock` → her zaman mock (açık geçersiz kılma) |
| `EXPO_PUBLIC_AI_GATEWAY_URL` | hayır | AI sohbet / görüntü / tür / triyaj ağ geçidi |
| `EXPO_PUBLIC_AI_GATEWAY_KEY` | hayır | Ağ geçidi anahtarı |

`service_role` anahtarı **asla** uygulamaya konmaz; yalnızca edge
fonksiyonlarında ve veri hattında kullanılır.

### mock ↔ gerçek geçişi

`src/data/index.ts` içindeki seçim kuralı:

1. `EXPO_PUBLIC_DATA_PROVIDER=mock` → mock (demo/çevrimdışı sunum).
2. `EXPO_PUBLIC_SUPABASE_URL` **ve** `EXPO_PUBLIC_SUPABASE_ANON_KEY` tanımlı → uzak.
3. Aksi hâlde mock.

Geçiş için kod değişikliği gerekmez; `.env` düzenlenir ve uygulama yeniden
başlatılır (`getDataProvider()` sağlayıcıyı bir kez kurar). Testlerde
`setDataProvider(...)` ile doğrudan enjekte edilebilir.

---

## Tasarım kararları

### 1. İş kuralları tek kaynaktan

Uzak repository'ler sorgu sonuçlarını `mappers.ts` ile domain tiplerine çevirir
ve ardından **mock'un kullandığı aynı** saf fonksiyonları çağırır
(`selectHazards`, `filterGroups`, `applyVote`, `buildQuote`, `rankInstructors`,
`buildLeaderboard`, `filterTracks`, …). Böylece sıralama, süzme ve doğrulama
davranışı iki sağlayıcıda birebir aynıdır.

### 2. Sayaçlar veritabanında

`likes_count`, `member_count`, `confirmations`, `ascent_count`, `follower_count`
gibi sayaçlar tetikleyicilerle (`bump_counter`, `sync_*`) tutulur. Uzak
repository yalnızca ilişki satırını yazar ve taze değeri geri okur; çift sayım
olmaz. XP de aynı şekilde tetikleyicilerden gelir (`award_xp_trigger`,
`award_quiz_xp`, `award_challenge_xp`, `award_track_xp`).

### 3. Uzamsal sorgular RPC ile

`nearby_places`, `nearby_emergency_centers`, `nearby_heritage_sites`,
`match_candidates`, `feed_posts`, `trending_hashtags`, `unit_availability`,
`reserve_unit` gibi hazır fonksiyonlar kullanılır. RPC ön eleme yapar; kesin
sıralama/biçim domain fonksiyonundadır.

### 4. N+1 sorgudan kaçınma

İlişkili veri PostgREST gömülü kaynaklarıyla tek istekte çekilir:

```ts
db.from('posts').select('*, author:profiles!author_id(*, emergency_contacts!user_id(*))')
```

Gömülü kaynaklarda **FK ipucu (`!sütun`) her zaman yazılır** — hem PostgREST'te
belirsizliği kaldırır hem de sözleşme testlerindeki uyarlayıcının ilişkiyi
çözebilmesi için gereklidir. Toplu veri gereken yerlerde tek `in(...)` sorgusu
kullanılır (`fetchUsers`, beğeni/kayıt/tepki kümeleri).

### 5. PostGIS noktaları

`geography(Point,4326)` sütunları PostgREST'ten onaltılık EWKB metni olarak
gelir; `mappers.toGeoPoint` bunu çözer (GeoJSON nesnesi, WKT metni ve
`{lat,lng}` biçimleri de kabul edilir). Yazarken `fromGeoPoint` ile
`SRID=4326;POINT(lng lat)` metni gönderilir.

### 6. Zaman damgaları

`iso()` tüm zaman damgalarını `…Z` biçimine indirger; böylece
`localeCompare` ile yapılan sıralamalar mock ve uzak sağlayıcıda aynı sonucu
verir. `date` sütunları `YYYY-MM-DDT00:00:00.000Z` olur.

---

## Realtime

`realtime.ts` mock'taki periyodik sorgulamanın yerini alır. `0300_realtime_storage.sql`
şu tabloları yayına ekler: `group_messages`, `stream_messages`, `location_shares`,
`notifications`, `messages`, `sos_sessions`, `hazards`.

```ts
const stop = subscribeGroupMessages(client, groupId, (message) => append(message));
useEffect(() => () => void stop(), []);
```

Yardımcılar: `subscribeGroupMessages`, `subscribeStreamMessages`,
`subscribeLocationShares`, `subscribeNotifications`, `subscribeDirectMessages`,
`subscribeHazards`, `subscribeSosSession`.

---

## Depolama

`storage.ts` kovaları ve sınırları `0300_realtime_storage.sql` ile birebir
aynıdır. Yol düzeni **`<kova>/<kullanıcı-kimliği>/<dosya>`**; RLS ilk klasör
segmentine bakar.

> **EXIF temizleme:** fotoğrafın GPS/EXIF verisi **cihazda**, yüklemeden önce
> silinmelidir. `expo-image-picker` çıktısını `expo-image-manipulator`
> (`manipulateAsync(uri, [], { compress, format })`) üzerinden geçirmek görüntüyü
> yeniden kodlar ve EXIF bloklarını düşürür. `uploadMedia` yalnızca temizlenmiş
> baytları bekler; sunucuda ek temizleme **yoktur**.

---

## Çevrimdışı yazma kuyruğu

`offline.ts` — ağ yokken mutasyonlar `AsyncStorage`'da sıraya girer, bağlantı
gelince **oluşturulma sırasına göre** gönderilir. Okuma işlemleri kuyruğa girmez
(React Query önbelleği bunu üstlenir).

```ts
const queue = createOfflineQueue({ isOnline: () => netInfo.isConnected === true });
await queue.enqueue({ kind: 'insert', target: 'post_likes', payload: { user_id, post_id } });
const result = await queue.flush(client); // { sent, conflicts, rejected, remaining, details }
```

### Çakışma politikası

| Durum | SQLSTATE | Davranış |
|---|---|---|
| Ağ hatası / bağlantı kopması / kilit zaman aşımı | `08*`, `53*`, `40001`, `40P01`, `57014`, ağ istisnası | Yeniden denenir; üstel bekleme (`backoffMs`: 1s, 4s, 9s…), `maxAttempts` (varsayılan 5) sonrası kalıcı reddedilir |
| Benzersizlik ihlali | `23505` | **Sunucu kazanır** — işlem başarılı sayılır ve düşer (aynı beğeni/katılım iki kez yazılmaz) |
| Dışlama kısıtı (rezervasyon çakışması) | `23P01` | **Sunucu kazanır** — `conflict` ile düşer; kullanıcıya bildirilir, sessizce üzerine yazılmaz |
| Yetki / RLS | `42501`, `PGRST301` | `rejected` — yeniden denenmez |
| Diğer kısıt ihlalleri | `23*` | `rejected` — ayrıntı `lastError` alanında saklanır |

Ek kurallar:

* **Sıra korunur.** İlk geçici hatadan sonra kalan işlemler denenmez; kuyruk
  bozulmadan bekler.
* **Son yazan kazanır.** Aynı satıra iki cihazdan yazıldığında `update` tam alan
  kümesini gönderir.
* **Çift sayım yok.** Sayaçlar uygulama değil veritabanı tetikleyicileriyle
  güncellendiği için kuyruk yeniden oynatıldığında sayaçlar şişmez.
* Aynı anda yalnızca bir `flush` çalışır (eşzamanlı çağrılar aynı sonucu bekler).

---

## Doğrulama — sözleşme testleri

Gerçek bir Supabase sunucusu olmadan uzak sağlayıcı **gerçek Postgres+PostGIS**
üzerinde çalıştırılır.

```bash
# 1) Yerel küme (bir kez)
initdb -D /tmp/zirtanpg -U postgres --auth=trust
pg_ctl -D /tmp/zirtanpg -o "-p 54329 -k /tmp" -l /tmp/zirtanpg/log start

# 2) Şema + tohum
PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/test/run.sh

# 3) Testler
npx jest src/data/__tests__
```

| Dosya | İşlev |
|---|---|
| `src/data/__tests__/contract/scenarios.ts` | Sağlayıcıdan bağımsız 15 senaryo (yalnızca `DataProvider` yüzeyi) |
| `src/data/__tests__/contract/pgPostgrest.ts` | `SupabaseLike` uyarlayıcısı — çağrıları SQL'e çevirir, doğrudan Postgres'e bağlanır |
| `src/data/__tests__/contract/pgHarness.ts` | Şablon veritabanından her koşumda yeni kopya üretir |
| `src/data/__tests__/mockProviderContract.test.ts` | Senaryoların mock koşumu |
| `src/data/__tests__/remoteProviderContract.test.ts` | Senaryoların uzak koşumu (gerçek Postgres) |
| `src/data/__tests__/remoteProviderModules.test.ts` | 38 modülün tamamının okuma/yazma yollarını gerçek veritabanında çalıştırır |
| `src/data/__tests__/remoteProviderSurface.test.ts` | 306 metodun tamamının uygulandığını doğrular |
| `src/data/__tests__/remoteOffline.test.ts` | Kuyruk sırası ve çakışma politikası |
| `src/data/__tests__/remoteStorage.test.ts` | Kova sınırları, tür/boyut doğrulaması |
| `src/data/__tests__/remoteMappers.test.ts` | EWKB/GeoJSON/WKT çözümü, tarih ve dizi eşlemesi |

Postgres bulunamazsa (`ZIRTAN_TEST_PG=0` ya da soket yok) uzak koşumlar
**atlanır**; mock koşumu ve birim testleri her ortamda çalışır. `PGPORT`
verilmezse unix soketi için 54329 → 54322 → 5432 sırasıyla aranır; TCP
bağlantısında `ZIRTAN_TEST_PG=1` bayrağı gerekir.

Kapsanan uçtan uca akışlar: akış listeleme · gönderi oluşturma ve beğenme ·
takip · grup mesajı ve anket · rezervasyon oluşturma, çakışma kısıtı ve iptal ·
tehlike bildirimi, onay ve çözme yetkisi · tırmanış rotası onayı · XP kazanımı ·
sosyal tepki/kaydetme/yeniden paylaşım · birebir mesaj · bildirimler.

> **Uyarlayıcı bir taklit değildir.** Sorgular, kısıtlar, tetikleyiciler ve
> RPC'ler gerçekten çalışır; yalnızca HTTP/PostgREST katmanı atlanır.
> Desteklenen alt küme: `select/insert/upsert/update/delete`, `eq/neq/gt/gte/
> lt/lte/like/ilike/is/in/contains/overlaps/not/or` (iç içe `and()`/`or()` dahil),
> `order/limit/range/single/maybeSingle`, FK ipuçlu gömülü kaynaklar ve `rpc`.

---

## Bilinen farklar (mock ↔ uzak)

| Konu | Fark |
|---|---|
| `telemed` doktor simülasyonu | Mock'ta talep 3–6 sn sonra otomatik kabul edilir ve hasta mesajlarına kural tabanlı yanıt üretilir. Uzak sağlayıcıda **simülasyon yoktur**: talep `requested` kalır, gerçek hekim `accept` ile devralır. |
| `telemed.request` ilk yardım slug'ı | `consultations.first_aid_slug` `first_aid_guides` tablosuna FK'dir; rehberler ise kodda tutulur (`src/data/content/firstAid.ts`) ve tabloya tohumlanmamıştır. Uzak sağlayıcı yalnızca tabloda karşılığı olan slug'ı yazar; triyaj adımları `triage` alanında tam olarak saklanır. |
| `maps.download` / `remove` | Mock indirmeyi adım adım simüle eder. Uzak sağlayıcı yalnızca `map_pack_downloads` durumunu tutar; gerçek indirme istemci tarafındadır (`EXPO_PUBLIC_TILES_URL`). |
| `satellite.linkStatus` / `setLink` | Bağlantı durumu cihaza özgüdür, sunucuda tutulmaz — uzak sağlayıcıda da bellek içidir. |
| `wildlife.deterrents` | `deterrent_profiles` tablosu yerine domain sabiti (`DETERRENT_PROFILES`) döner; kaynak doğruluğu koddadır. |
| Türkçe metin araması | Mock `toLocaleLowerCase('tr-TR')` kullanır; uzak sağlayıcı `ilike` ile veritabanı harmanlamasına güvenir. `İ/ı` gibi harflerde küçük farklar olabilir. |
| `provider.reset()` | Uzak sağlayıcıda **boştur** (yıkıcı işlem istemciden tetiklenmez). |
| `tracks.rebuildCommunityTrails()` | Kümeleme sonucu satır satır yazılır (tek işlem değildir); eşzamanlı çağrılarda son yazan kazanır. |
| Sayfalama | `feed.list` ve benzeri listeler mock ile aynı şekilde tümünü döner (sözleşmede limit yok). Üretimde `feed_posts` RPC'sinin `max_rows` değeri 200'dür. |

---

## KOORDİNATÖR GEREKLİ — şema düzeltmeleri

Aşağıdaki üç sorun `supabase/migrations/` içinde düzeltilmelidir; uzak
sağlayıcıda geçici olarak tolere edilir ve testlerde açıkça işaretlenir.
Tohum verisi `session_replication_role = replica` ile yüklendiği için bu hatalar
tohumlamada görünmez, yalnızca **çalışma zamanı yazmalarında** ortaya çıkar.

1. **`event_rsvps` → `award_xp_trigger`** (`0200_functions.sql`)
   `award_xp_trigger` `NEW.id` okur; `event_rsvps` tablosunda `id` sütunu yoktur
   (PK: `event_id, user_id`). Sonuç: **her RSVP hata verir**
   (`record "new" has no field "id"`). Etkilenen sözleşme metotları:
   `ClubRepository.rsvp`, `ClubRepository.createEvent`.
   *Öneri:* `award_xp_trigger`'a referans sütunu argümanı eklemek ya da
   `event_rsvps` için ayrı bir tetikleyici yazmak
   (`ref_id := NEW.event_id::text`).

2. **`writer_follows` → `bump_counter`** (`0200_functions.sql`)
   `bump_counter` hedef tablonun birincil anahtarını `id` varsayar
   (`WHERE id::text = $2`); `writer_profiles` ise `user_id` kullanır. Sonuç:
   **yazar takibi hata verir** (`column "id" does not exist`). Etkilenen metot:
   `ArticleRepository.toggleFollowWriter`.
   *Öneri:* `bump_counter`'a hedef anahtar sütunu için dördüncü bir `TG_ARGV`
   eklemek.

3. **`first_aid_guides` tohumlanmamış**
   Tablo boş; `consultations.first_aid_slug` ve `species.first_aid_slug` bu
   tabloya FK'dir. Uzak sağlayıcı slug'ı düşürerek çalışır ama ilk yardım bağı
   kaybolur. *Öneri:* `src/data/content/firstAid.ts` içeriğini tohuma eklemek
   (`export-seed.mjs`).

---

## Gerçek sunucu bağlanınca yapılacaklar

1. `supabase db push` ile şemayı yükle, `supabase/seed/seed.sql`'i yalnızca
   demo ortamında uygula.
2. Yukarıdaki üç şema düzeltmesini uygula ve
   `PGHOST=… ./supabase/test/run.sh` ile doğrula.
3. `.env` içine `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   yaz, `EXPO_PUBLIC_DATA_PROVIDER` satırını kaldır ya da `remote` yap.
4. Auth sağlayıcılarını (e-posta/şifre, gerekirse OAuth) panelde etkinleştir;
   `handle_new_auth_user` tetikleyicisi profili otomatik açar.
5. Storage kovalarını `0300_realtime_storage.sql` ile oluştur; `avatars`,
   `post-media` gibi açık kovalarda CDN önbelleğini aç.
6. Realtime'da `supabase_realtime` yayınını ve tablo başına RLS'i doğrula
   (`subscribe*` yardımcıları RLS'e güvenir).
7. Edge fonksiyonlarını dağıt (`sos-dispatch`, `push-fanout`,
   `return-promise-check`, `payment-webhook`) ve `pg_cron` işlerini kur.
8. `wal_level = logical` olduğundan emin ol (realtime yayını için).
9. Ödeme sağlayıcısını (iyzico/Stripe) `payments` tablosuna bağla; şu an
   `book()` demo emanet akışını yerel olarak uygular
   (`authorize → capture`), gerçek sağlayıcı webhook'u
   `payment-webhook` fonksiyonundan gelmelidir.
10. Yapay zekâ ağ geçidini (`EXPO_PUBLIC_AI_GATEWAY_URL`) bağla; bağlanmazsa
    `ai`, `vision`, `wildlife.identify` ve `telemed.triage` yerel yanıtlara düşer.
11. Çevrimdışı kuyruğu ağ durumuna bağla (`@react-native-community/netinfo`
    ya da `expo-network`) ve uygulama öne geldiğinde `flush` çağır.
12. Yük testinden sonra `feed_posts` / `leaderboard` RPC'lerine sayfalama
    parametreleri eklemeyi değerlendir (sözleşme değişikliği gerektirir →
    koordinatör).
