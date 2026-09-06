# Zirtan — Veritabanı ve Sunucu Altyapısı

Postgres 16+ / PostGIS 3.4 üzerinde çalışan, **136 tablo · 105 enum · 299 RLS
politikası · 90 fonksiyon · 89 tetikleyici**den oluşan üretime hazır şema.

Şemanın sözleşmesi `src/data/repositories/index.ts` içindeki **38 repository
arayüzüdür**: her metot burada bir sorgu, RPC ya da mutasyona karşılık gelir.
İş kuralları `src/data/mock/repos/*.ts` dosyalarındaki yetki kontrollerinden
türetilmiştir — RLS politikaları o kuralların veritabanı karşılığıdır.

---

## Dizin düzeni

```
supabase/
├── config.toml                  supabase CLI yapılandırması
├── migrations/
│   ├── 0001_extensions.sql      postgis, pg_trgm, pgcrypto, uuid-ossp, btree_gist
│   ├── 0002_enums.sql           105 enum tipi (src/domain/enums.ts'ten türetilmiş)
│   ├── 0003_core.sql            profiller, takip, engelleme, acil kişiler
│   ├── 0004_social.sql          rotalar, gönderiler, yorumlar, tepkiler, hikâyeler
│   ├── 0005_messaging.sql       ZMatch, birebir mesajlar, bildirimler
│   ├── 0006_hazards.sql         tehlike bölgeleri ve onaylar
│   ├── 0007_live.sql            canlı yayın (kamera/drone) ve sohbet
│   ├── 0008_market.sql          ikinci el market
│   ├── 0009_instructors.sql     eğitmenler, değerlendirmeler, ders rezervasyonu
│   ├── 0010_library.sql         kütüphane (places) — veri hattıyla ortak şema
│   ├── 0011_presence.sql        canlı konum paylaşımı ve iz kaydı
│   ├── 0012_business.sql        işletmeler ve konaklama talepleri
│   ├── 0013_inventory.sql       envanter, emanet ödeme, çakışma kısıtı
│   ├── 0014_billing.sql         planlar, abonelik, hakediş
│   ├── 0015_emergency.sql       kurtarma merkezleri, SOS, ilk yardım
│   ├── 0016_ai.sql              yapay zekâ sohbetleri ve gezi planları
│   ├── 0017_maps.sql            harita bölgeleri, patika grafı, paketler
│   ├── 0018_climbing.sql        kaya / sektör / rota / çıkış
│   ├── 0019_satellite.sql       uydu cihaz, mesaj, SOS oturumu
│   ├── 0020_clubs.sql           kulüpler, etkinlikler, öğrenci doğrulaması
│   ├── 0021_gamification.sql    XP, rozet, görev, quiz, pasaport
│   ├── 0022_destinations.sql    destinasyonlar, aşamalar, AMS, dönüş sözü
│   ├── 0023_vision.sql          görüntü analizi geçmişi
│   ├── 0024_groups.sql          gruplar, kanallar, mesajlar, anketler
│   ├── 0025_courses.sql         kurslar, dersler, kayıt, sertifika
│   ├── 0026_tracks.sql          izler, POI'ler, topluluk rotaları
│   ├── 0027_weather.sql         hava / yükseklik / çığ önbelleği
│   ├── 0028_countries.sql       ülke rehberi ve belge kontrol listesi
│   ├── 0029_articles.sql        yazarlar ve makaleler
│   ├── 0030_wildlife.sql        türler, tanımlama, soru-cevap, kaçırma
│   ├── 0031_telemed.sql         tele-tıp (doktor, danışma, mesaj)
│   ├── 0032_tv.sql              Zirtan TV (kanal, program, akış, haber)
│   ├── 0033_heritage.sql        tarihi alanlar, sesli rehber, tur
│   ├── 0034_kids.sql            çocuk modülü
│   ├── 0100_rls.sql             tüm tablolar için satır düzeyi güvenlik
│   ├── 0200_functions.sql       sayaç/XP tetikleyicileri, uzamsal RPC'ler
│   └── 0300_realtime_storage.sql realtime yayını ve storage kovaları
├── seed/
│   ├── export-seed.mjs          mock tohum verisini SQL'e çevirir
│   └── seed.sql                 üretilen demo verisi (~2 000 satır)
├── functions/                   Deno edge fonksiyonları
│   ├── _shared/                 ortak istemci ve Expo Push yardımcıları
│   ├── sos-dispatch/            SOS → acil kişiler + kurtarma merkezi
│   ├── return-promise-check/    dönüş sözü gecikmesi taraması
│   ├── push-fanout/             bildirim → Expo Push dağıtımı
│   └── payment-webhook/         iyzico / Stripe emanet durum geçişleri
└── test/
    ├── 00_supabase_shim.sql     saf Postgres'te test için Supabase iskelesi
    ├── 01_assertions.sql        şema sağlık kontrolleri
    ├── 02_rls_tests.sql         RLS ve tetikleyici davranış testleri
    └── run.sh                   sıfırdan kur + doğrula
```

---

## Sıfırdan kurulum (yerel)

### 1. Supabase CLI

```bash
npm install -g supabase          # ya da: brew install supabase/tap/supabase
supabase --version               # ≥ 2.0 gerekir
```

### 2. Yerel yığını başlat

```bash
cd /yol/zirtan
supabase start
```

Docker üzerinde Postgres (config.toml'da 17) + PostGIS, Auth, Storage, Realtime, Studio ve
Edge Runtime ayağa kalkar. Çıktıdaki `API URL`, `anon key` ve
`service_role key` değerlerini not al.

### 3. Migration'ları uygula ve tohumla

```bash
supabase db reset                # tüm migration'lar + supabase/seed/seed.sql
```

`supabase db reset` `supabase/migrations/*.sql` dosyalarını **ad sırasıyla**
uygular, ardından `seed.sql` yükler. Test iskelesine (`supabase/test/`)
gerek yoktur; `auth`, `storage` ve `supabase_realtime` platformdan gelir.

### 4. Tohum verisini yeniden üret

Mock veriler (`src/data/mock/seed*.ts`) değiştiğinde:

```bash
npx tsx supabase/seed/export-seed.mjs
supabase db reset
```

Betik metin kimlikleri (`u_me`, `p1`, …) **deterministik UUID'lere** çevirir
(`md5('zirtan|<tablo>|<kimlik>')`), bu yüzden her üretimde aynı kimlikler
çıkar ve yabancı anahtarlar tutarlı kalır.

### 5. Edge fonksiyonlarını çalıştır

```bash
supabase functions serve                       # hepsi, yerel
supabase functions serve sos-dispatch --no-verify-jwt
```

---

## Docker olmadan doğrulama

CI ya da Docker'sız bir ortamda şemayı doğrulamak için saf bir
Postgres + PostGIS yeterlidir:

```bash
# Postgres 16/17 + PostGIS kurulu olmalı
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3

# Küme başlat
initdb -D /tmp/zirtanpg -U postgres --auth=trust
pg_ctl -D /tmp/zirtanpg -o "-p 54322 -k /tmp" -l /tmp/zirtanpg/log start

# Şemayı sıfırdan kur + testleri çalıştır
PGHOST=/tmp PGPORT=54322 PGUSER=postgres ./supabase/test/run.sh
```

`run.sh` sırasıyla: veritabanını yeniden yaratır → `00_supabase_shim.sql`
(yalnızca test; `auth.uid()`, `storage.buckets`, `supabase_realtime`) →
tüm migration'lar → `seed.sql` → `01_assertions.sql` (RLS'siz tablo,
politikasız tablo, indekssiz yabancı anahtar taraması) →
`02_rls_tests.sql` (24 davranış testi).

Docker varsa aynısı tek satırla:

```bash
docker run -d --name zirtanpg -e POSTGRES_PASSWORD=postgres \
  -p 54322:5432 postgis/postgis:17-3.4
PGHOST=localhost PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres \
  ./supabase/test/run.sh
```

---

## Üretime dağıtım

```bash
supabase login
supabase link --project-ref <PROJE-REF>

# 1. Şema
supabase db push                      # migrations/ → uzak veritabanı

# 2. Gizli anahtarlar
supabase secrets set \
  ZIRTAN_CRON_SECRET="$(openssl rand -hex 32)" \
  EXPO_ACCESS_TOKEN="..." \
  ZIRTAN_STRIPE_WEBHOOK_SECRET="whsec_..." \
  ZIRTAN_IYZICO_SECRET="..." \
  ZIRTAN_SMS_WEBHOOK="https://..." \
  ZIRTAN_ALLOWED_ORIGIN="https://zirtan.app"

# 3. Edge fonksiyonları
supabase functions deploy sos-dispatch
supabase functions deploy return-promise-check --no-verify-jwt
supabase functions deploy push-fanout --no-verify-jwt
supabase functions deploy payment-webhook --no-verify-jwt

# 4. Kütüphane verisi (açık veri hattı)
node tools/data-pipeline/cli.js export --format=sql | \
  psql "$SUPABASE_DB_URL"
```

### Zamanlanmış işler (pg_cron)

Supabase panelinde `pg_cron` ve `pg_net` uzantılarını etkinleştirdikten sonra:

```sql
-- Bildirim dağıtımı: dakikada bir
SELECT cron.schedule('zirtan-push', '* * * * *', $$
  SELECT net.http_post(
    url     := 'https://<PROJE>.supabase.co/functions/v1/push-fanout',
    headers := jsonb_build_object('x-zirtan-cron', '<ZIRTAN_CRON_SECRET>'))
$$);

-- Dönüş sözü taraması: 15 dakikada bir
SELECT cron.schedule('zirtan-return-promise', '*/15 * * * *', $$
  SELECT net.http_post(
    url     := 'https://<PROJE>.supabase.co/functions/v1/return-promise-check',
    headers := jsonb_build_object('x-zirtan-cron', '<ZIRTAN_CRON_SECRET>'))
$$);

-- Süresi dolan anlar: saatte bir
SELECT cron.schedule('zirtan-expire-stories', '0 * * * *', $$
  DELETE FROM stories WHERE expires_at < now() - interval '7 days'
$$);

-- Konum izini buda: günde bir (son 72 saat kalır)
SELECT cron.schedule('zirtan-prune-pings', '30 3 * * *', $$
  DELETE FROM location_pings WHERE recorded_at < now() - interval '72 hours'
$$);

-- Süresi geçmiş tehlikeleri kapat: saatte bir
SELECT cron.schedule('zirtan-expire-hazards', '15 * * * *', $$
  UPDATE hazards SET status = 'resolved'
   WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now()
$$);

-- Hava önbelleğini temizle
SELECT cron.schedule('zirtan-weather-cache', '0 */6 * * *', $$
  DELETE FROM weather_cache WHERE expires_at < now() - interval '1 day'
$$);
```

---

## Ortam değişkenleri

### Uygulama (`.env` / `app.json` → `extra`)

| Değişken | Açıklama |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<proje>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Genel anon anahtarı (RLS korur) |

`service_role` anahtarı **asla** uygulamaya konmaz; yalnızca edge
fonksiyonlarında ve veri hattında kullanılır.

### Edge fonksiyonları (`supabase secrets set`)

| Değişken | Kullanan | Açıklama |
|---|---|---|
| `SUPABASE_URL` | hepsi | platform otomatik sağlar |
| `SUPABASE_SERVICE_ROLE_KEY` | hepsi | platform otomatik sağlar |
| `ZIRTAN_CRON_SECRET` | push-fanout, return-promise-check | zamanlayıcı kimliği |
| `EXPO_ACCESS_TOKEN` | push-fanout, sos-dispatch | Expo Push kotası için (isteğe bağlı) |
| `ZIRTAN_STRIPE_WEBHOOK_SECRET` | payment-webhook | HMAC imza doğrulaması |
| `ZIRTAN_IYZICO_SECRET` | payment-webhook | HMAC imza doğrulaması |
| `ZIRTAN_SMS_WEBHOOK` | sos-dispatch | uygulama dışı acil kişilere SMS köprüsü |
| `ZIRTAN_ALLOWED_ORIGIN` | hepsi | CORS kaynağı (varsayılan `*`) |

---

## İstemci tarafında kullanım

Repository sözleşmesi değişmez; yalnızca `MockProvider` yerine bir
`SupabaseProvider` yazılır. Örnekler:

```ts
// LibraryRepository.nearby → uzamsal RPC
const { data } = await supabase.rpc('nearby_places', {
  lat: origin.latitude, lng: origin.longitude,
  radius_km: radiusKm, place_kind: kind, max_rows: limit,
});

// SocialRepository.feed
const { data } = await supabase.rpc('feed_posts', {
  tab: filter.tab, tag: filter.hashtag, max_rows: 30,
});

// FunRepository.leaderboard
const { data } = await supabase.rpc('leaderboard', { scope, since_days: 7 });

// InventoryRepository.availability
const { data } = await supabase.rpc('unit_availability', {
  unit: unitId, from_date: from, to_date: to,
});

// MessageRepository.thread — RLS zaten yalnızca tarafları döndürür
const { data } = await supabase
  .from('messages')
  .select('*')
  .or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`)
  .order('created_at');

// Realtime: grup sohbeti
supabase.channel(`group:${groupId}`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}` },
      (payload) => append(payload.new))
  .subscribe();
```

Ayrıntılı tablo haritası, RLS özeti ve indeks gerekçeleri için
[`docs/DATABASE.md`](../docs/DATABASE.md).
