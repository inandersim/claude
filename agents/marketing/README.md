# Zirtan pazarlama ajanları

Claude API tabanlı, **sıfır bütçeli** büyüme için komut satırı ajanları. Oyun kitabı [`docs/GROWTH.md`](../../docs/GROWTH.md); bu paket onu her hafta koşturan otomasyondur:

| Komut      | Ne yapar                                                                                                                                                                   | Çıktı                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `plan`     | N haftalık içerik takvimi (tarih, kanal, biçim, tema, kitle, amaç, KPI) — yapılandırılmış JSON çıktı                                                                       | `content/plan.json`                                               |
| `generate` | Planın bir haftası için gönderiler: başlık, metin (kanal ton/uzunluk, TR/EN/RU), hashtag seti, sahne sahne Reel senaryosu, hikâye kareleri, CTA, en iyi saat, UTM bağlantı | `content/week-NN/posts.json` + gönderi başına `.md` + `README.md` |
| `reply`    | Yorum / DM için yanıt önerileri (marka sesi; güvenlik imasında 112 + yükseltme bayrağı)                                                                                    | `content/replies-<tarih>.{json,md}`                               |
| `analyze`  | `insights.csv` → deterministik metrik özeti + Claude API yorumu ve gelecek hafta önerileri                                                                                 | `content/analysis-<tarih>.{json,md}`                              |
| `post`     | `posts.json` içindeki gönderileri Instagram / Facebook / VK / Telegram API'lerine gönderir (`--dry-run` varsayılan)                                                        | Konsol planı; `--yes` ile `content/post-log.json`                 |

Bağımlılık yalnızca `@anthropic-ai/sdk`; sosyal ağ API'leri Node 22'nin yerleşik `fetch` / `FormData` ile çağrılır.

## Kurulum

```bash
cd agents/marketing
npm install
cp .env.example .env      # ANTHROPIC_API_KEY (+ kanal token'ları)
npm run build             # tsc → dist/
npm test                  # şema + biçimlendirici + yayın akışı testleri (API çağrısı yok)
```

Node ≥ 22 gerekir (`process.loadEnvFile`, `fetch`, `openAsBlob`). `npm run check` yalnızca tip denetimi yapar.
`.env` dosyası hem paket kökünden hem de repo kökünden (`agents/marketing/.env`) bulunur.

> Sandbox ağ erişimini engellerse `npm install` başarısız olabilir; bu depoda kurulum denenmiş, `npm run check` ve `npm test` temiz geçmiştir.

## Kullanım

```bash
# 12 haftalık plan, Türkçe ana dil, seçili kanallar (varsayılan: hepsi), sonraki Pazartesi'den başlar
npm run plan -- --weeks 12 --lang tr --channels instagram,tiktok,vk,telegram,facebook,reddit,youtube

# 1. haftanın gönderilerini üret (yalnızca belirli kanallar için --channels)
npm run generate -- --plan content/plan.json --week 1

# Yorum/DM yanıtları (girdi biçimi: content/example-mentions.json)
npm run reply -- --input content/example-mentions.json

# Performans analizi (girdi biçimi: content/example-insights.csv — sütun adları esnek, TR/EN/RU takma adlar tanınır)
npm run analyze -- --input content/example-insights.csv

# Yayın planını gör (token gerekmez; eksik değişkenler yer tutucuyla gösterilir)
npm run post -- --channel instagram --file content/example-posts.json
# Gerçek gönderim (token'lar .env'de olmalı)
npm run post -- --channel telegram --file content/week-01/posts.json --yes
# Tek gönderi, marka denetimini atla (dikkat)
npm run post -- --channel vk --file content/week-01/posts.json --ids vk-post-likiyskaya-tropa --yes --force
```

`content/` altındaki üretilen dosyalar `.gitignore` ile dışarıda tutulur; yalnızca `example-*` dosyaları depodadır. `content/example-week.md`, `example-posts.json`'dan üretilmiş bir haftalık örnek çıktıdır.

### Çıkış kodları

`0` başarılı · `1` hata (eksik argüman, API hatası, şema ihlali) · `2` `post`'ta en az bir gönderi başarısız/atlandı.

## Nasıl çalışır

```
brand.ts ─┐
channels/ ├─ prompts.ts (deterministik sistem istemi, prompt önbelleği) ─▶ client.ts ─▶ Claude API
templates/┘                                                                  │ json_schema (output_config.format)
                                                                             ▼
schemas.ts (JSON şema + yerel doğrulayıcı) ◀── yanıt JSON ──▶ render.ts ──▶ content/week-NN/*.md
```

- **`brand.ts`** — marka sesi, ürün gerçekleri (README özellik listesi), _henüz yok_ listesi, yasak ifadeler (üç dilde; "asla kaybolmazsın", "guaranteed rescue" gibi mutlak güvenlik vaatleri, rakip karalama), yasal notlar (UGC/fotoğraf izni, drone, KVKK, reklam etiketi, açık veri atfı), hedef kitleler, hashtag setleri (TR/EN/RU), CTA kalıpları. `checkBrandCompliance(text)` `generate` çıktısını işaretler, `post` ise ihlalli gönderiyi atlar (`--force` ile geçilir).
- **`schemas.ts`** — plan / gönderi / yanıt / analiz JSON şemaları; aynı şema hem API'ye `output_config.format = { type: 'json_schema' }` olarak gider hem de yerel `validate()` ile yanıt denetlenir (bağımlılık yok).
- **`client.ts`** — Claude API sarmalayıcısı: adaptif düşünme, önbelleğe alınan sistem istemi (`cache_control`), uzun üretimlerde streaming (`messages.stream` + `finalMessage`), `max_tokens` kesilmesi ve reddetme durumlarını açıklayan hatalar, token kullanım özeti. Model kimliği `MARKETING_MODEL` ile değiştirilebilir.
- **`channels/*.ts`** — kanal başına biçim kuralları (`spec`: karakter/hashtag sınırı, bağlantı politikası, en iyi saatler, ton, kurallar) ve `format(post)`; Instagram / Facebook / VK / Telegram için `publisher.publish()`. TikTok, YouTube ve Reddit yalnızca biçimlendirir (resmî yükleme API'leri onay/başvuru ister; elle yükle).
- **`templates/`** — Reel/Short senaryoları ("Kaçkar'da 3 gün", "Bunu yapma" serisi, POV drone, yalnız yürüyüş, kulüp, Rusça Likya), hikâye ve karusel şablonları, topluluk yanıt kalıpları. `generate`/`reply` sistem istemine gömülür; düzenlemek için Markdown'ı değiştir.
- **`metrics.ts`** — CSV'den kanal/biçim/hafta bazında erişim, etkileşim oranı, kaydetme, tıklama, takipçi, kurulum; en iyi/en kötü gönderiler (erişim ≥ 100). Model sayı hesaplamaz, yorumlar.

Uzun planlar 4'er hafta, gönderiler 6'şar öğe, yanıtlar 20'şer halinde üretilir; her parça ayrı istek olduğundan hafta/tarih tutarlılığı `fixWeek` ile yerelde düzeltilir.

## Lansman otomasyonu (`.mjs` katmanı)

Claude API'siz, **derleme gerektirmeyen** ikinci bir katman: kütüphane verisinden içerik üretir,
12 haftalık takvimi kurar, lansman gününü yürütür, 23 dilde mağaza metni yazar, davet döngüsünü
modeller ve haftalık raporu çıkarır. Hepsi **kuru çalışma** varsayılanıyla çalışır: anahtar yoksa
`out/` altına elle yayınlanabilir paket yazar (metin + hashtag + görsel talimatı + en iyi saat +
adım adım yayın yönergesi).

| Komut | Ne yapar | Çıktı |
| --- | --- | --- |
| `npm run content` | Destinasyon, rota, tür, tarihi alan, kaya alanı, yer ve kulüp verisinden 11 arketipte içerik (tr/en/de/ru) | `out/content/` |
| `npm run calendar` | 12 haftalık lansman takvimi (hazırlık → teaser → lansman → ivme → ritim), kanal kadansı, en iyi saatler, tekrar kullanım zinciri | `out/calendar/` + `.ics` |
| `npm run launch` | Lansman dizisi: 10 kanal duyurusu, Product Hunt, Show HN, Reddit planı, basın bülteni (tr/en), e-posta, mağaza sürüm notu, saat saat akış | `out/launch/` |
| `npm run aso` | 23 dil için başlık/alt başlık/anahtar kelime/açıklama/ekran metinleri + rakip analizi; karakter sınırlarını denetler | `out/aso/` |
| `npm run referral` | Davet kodu şeması, ödül tablosu, K faktörü simülasyonu, paylaşım metinleri, API sözleşmesi | `out/referral/` |
| `npm run report -- --input <csv>` | Haftalık büyüme raporu: huni, kanal/biçim kırılımı, hedef sapması, kural tabanlı öneri | `out/reports/` |
| `npm run dispatch -- <komut>` | Kanal adaptörlerini çalıştırır: `publish` · `schedule` · `metrics` · `reply` · `channels` | `out/packets/`, `out/metrics/`, `out/replies/` |

```bash
npm run content -- --langs tr,en,de,ru --per-archetype 3
npm run calendar -- --start 2026-10-05 --weeks 12 --launch-week 5
npm run launch -- --date 2026-11-03            # kuru çalışma
npm run launch -- --date 2026-11-03 --live      # anahtarı olan kanallarda gerçek yayın
npm run aso:check                               # mağaza karakter sınırı denetimi (CI dostu)
npm run referral -- --invite-rate 0.35 --accept-rate 0.45
npm run report -- --input content/example-growth.csv --all
npm run dispatch -- publish --input out/content/content.json --channels x,pinterest
```

### Kanallar

On kanal, **tek arayüz**: `publish` · `schedule` · `metrics` · `reply`.

| Kanal | API ile yayın | Gerekli değişkenler | Not |
| --- | --- | --- | --- |
| instagram | evet | `META_ACCESS_TOKEN`, `IG_USER_ID` | Bağlantı bio'da; karusel/Reel |
| facebook | evet | `META_ACCESS_TOKEN`, `FB_PAGE_ID` | Gruplara API yok, elle |
| vk | evet | `VK_ACCESS_TOKEN`, `VK_GROUP_ID` | Rusça uzun gönderi + Clips |
| telegram | evet | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL` | Kanal + şehir grupları |
| x | evet | `X_BEARER_TOKEN` | 280 karakter; bağlantı 23 sayılır; zincir bölme |
| pinterest | evet | `PINTEREST_ACCESS_TOKEN`, `PINTEREST_BOARD_ID` | Arama niyeti; 2:3 pin |
| linkedin | evet | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORG_URN` | Bağlantı ilk yoruma |
| reddit | evet | `REDDIT_ACCESS_TOKEN`, `REDDIT_SUBREDDIT` | Subreddit kuralı metinde |
| tiktok | hayır | `TIKTOK_ACCESS_TOKEN` (onaylı uygulama) | Elle yükleme paketi üretir |
| youtube | hayır | `YOUTUBE_ACCESS_TOKEN` | Sürdürülebilir yükleme; elle |

Anahtar yoksa ya da `--live` verilmediyse hiçbir ağ çağrısı yapılmaz; kanal klasörüne
kopyala-yapıştır hazır `.md` paketi düşer. Yasak ifade içeren gönderi **yayına çıkmaz**
(çıkış kodu 2).

### İçerik motoru

`content/engine.mjs` + `content/archetypes.mjs` + `content/lexicon.mjs`, veri kaynağı
`content/data/*.json` (anlık görüntü; `npm run content:extract` ile tazelenir —
`website/src/data/generated/*.json` ve `src/data/mock/seed.{heritage,wildlife}.ts`).

Arketipler: etap etap gezi planı · ilk 10 dakika (tür + ilk yardım) · çıkmadan önce tehlike
özeti · patikanın yanındaki tarihi alan · kaya alanı rehberi · bu ay nereye · bütçe ve izin ·
rota kartı · üniversite kulübü çağrısı · yer kartı · UNESCO alanı + rota.

Her içerik üç uzunlukta (kısa/orta/uzun), dört dilde, hashtag seti + görsel brief + çekim
listesi + alt metin + kaynak/lisans atfı ile gelir. **Türkçe dışı diller çeviri değildir:**
kütüphane verisi Türkçe olduğu için ilk yardım adımları, risk cümleleri ve alan kuralları
`content/lexicon.mjs` içinde o dilde yazılmıştır; eşleşmeyen Türkçe veri çıktıya girmez ve
`qa` alanında rapor edilir (`content.test.mjs` sızıntı olmadığını doğrular).

## Token alma adımları (hepsi ücretsiz)

### Meta — Instagram Graph API + Facebook Sayfa

1. Instagram hesabını **Business** ya da **Creator** yap ve bir Facebook Sayfasına bağla (Instagram → Ayarlar → Hesap türü).
2. [developers.facebook.com](https://developers.facebook.com) → **Create App** → tür _Business_ → ürün olarak **Instagram Graph API** ve **Facebook Login** ekle.
3. **Graph API Explorer**'da uygulamayı seç, izinleri işaretle: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (Facebook Sayfa gönderisi için), `instagram_manage_comments` (isteğe bağlı, `reply` girdisi için).
4. Kısa ömürlü kullanıcı token'ını **uzun ömürlü** yap (60 gün): `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=…&client_secret=…&fb_exchange_token=…`. Sayfa token'ı için `GET /me/accounts` (süresiz sayfa token'ı verir).
5. `IG_USER_ID`: `GET /{page-id}?fields=instagram_business_account`. `FB_PAGE_ID`: `GET /me/accounts`.
6. Uygulama **Development** modunda kaldığı sürece yalnızca uygulamaya rol verilmiş hesaplarda (Admin/Tester) çalışır — kendi hesabın için yeterlidir; başkalarının hesabına yayın için App Review gerekir.
7. Sınırlar: Instagram içerik yayınlama **hesap başına 24 saatte 100 gönderi** (`GET /{ig-user-id}/content_publishing_limit`), medya yalnızca **herkese açık URL** ile (JPEG ≤ 8 MB, video MP4/MOV ≤ 1 GB, 3–90 sn Reels). Görselleri ücretsiz barındırmak için GitHub Pages / Cloudflare R2 (10 GB ücretsiz) / Supabase Storage kullanılabilir.

### VK — Standalone uygulama

1. [dev.vk.com](https://dev.vk.com) → **Создать приложение** → tür _Standalone_ (Мини-приложение değil).
2. Implicit Flow ile kullanıcı token'ı: `https://oauth.vk.com/authorize?client_id=APP_ID&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,groups,offline&response_type=token&v=5.199` → adres çubuğundaki `access_token` (`offline` kapsamı ile süresiz).
3. `VK_GROUP_ID`: topluluk adresindeki sayısal id (`vk.com/club123456` → `123456`; ekran adı varsa `groups.getById?group_id=zirtanapp`). Token sahibi toplulukta yönetici olmalı.
4. Sınırlar: **saniyede 3 istek**, günde 50 duvar gönderisi; yanıt HTTP 200 içinde `error` nesnesiyle döner (paket bunu hataya çevirir).

### Telegram — BotFather

1. Telegram'da `@BotFather` → `/newbot` → token (`123456:ABC-…`).
2. Botu kanala **yönetici** ekle ("Post messages" izni). `TELEGRAM_CHANNEL` için `@kanaladi` ya da sayısal `chat_id` (özel kanallarda `-100…`; `getUpdates` ile öğrenilir).
3. Sınırlar: kanal başına dakikada ~20 mesaj, fotoğraf açıklaması 1024, metin 4096 karakter; paket uzun metni ikinci mesaja böler.

### Claude API

`ANTHROPIC_API_KEY` [console](https://console.anthropic.com) üzerinden alınır; SDK ortamdan okur. Bir haftalık plan+üretim tipik olarak on binlerce giriş / birkaç bin çıkış token'ı tüketir; sistem istemi önbelleğe alındığından tekrar eden çağrılar ucuzdur. Kullanım özeti her komut sonunda stderr'e yazılır.

## Girdi biçimleri

- **mentions.json** — dizi ya da `{ "mentions": [...] }`: `{ id, channel, kind: comment|dm|mention|review, author, text, lang?, postId? }` (bkz. `content/example-mentions.json`). Meta/VK/Telegram'dan dışa aktarım için ayrı bir toplayıcı yazılmadı; Meta Business Suite / VK "Сообщения" dışa aktarımı ya da elle liste yeterli.
- **insights.csv** — başlık satırı serbest; tanınan sütunlar: `date, channel, post_id, format, reach|impressions|views, likes, comments, shares, saves, link_clicks|clicks, new_followers|followers, installs` (TR/RU takma adlar da tanınır; `;` ve `\t` ayırıcı desteklenir). Meta Insights, VK Статистика, Telegram kanal istatistiği ve App Store Connect / Play Console verilerini tek CSV'de birleştir.

## Testler

`npm test` → `tsc` derler, ardından `node --test dist/test/**/*.test.js`:

- `schemas.test.ts` — örnek dosyaların şemaya uyması, doğrulayıcının tür/enum/desen/zorunlu/fazla alan hataları, şema iç tutarlılığı.
- `brand.test.ts` — yasak ifade yakalama (TR/EN/RU), temiz metin, deterministik marka özeti.
- `channels.test.ts` — kanal biçimlendiricileri (hashtag sınırı, bio bağlantı notu, Reddit'te hashtag yok, Telegram 1024 uyarısı, kısaltma).
- `publish.test.ts` — sahte `fetch` ile Instagram (görsel, karusel, dry-run), Facebook (photos/feed), VK (upload zinciri + hata nesnesi), Telegram (sendPhoto/sendMessage/bölme) istek şekilleri; token maskeleme.
- `metrics.test.ts` — CSV ayrıştırma, yerel sayı biçimleri, özet metrikler, ISO hafta.
- `commands.test.ts` — tarih yardımcıları, `fixWeek`, id tekilleştirme, marka bayrağı, Markdown render, `parseMentions`, `runPost` dry-run'da ağ çağrısı yapılmaması.

`.mjs` katmanı için `npm run test:mjs` (aynı zamanda `npm test` içinde koşar):

- `lib.test.mjs` — argüman ayrıştırma, UTC tarih yardımcıları, metin/CSV, UTM şeması, yasak ifade denetimi (dört dil).
- `channels.test.mjs` — on kanalın dört yöntemi, kuru çalışma paketi, sahte `fetch` ile canlı yayın, karakter/hashtag sınırları, X zincir bölme, `.ics`, yanıt niyet sınıflaması.
- `content.test.mjs` — veri anlık görüntüsü, 11 arketip × 4 dil, Türkçe sızıntı denetimi, ilk yardım sözlüğünün tam olması, kanal uyarlaması.
- `calendar.test.mjs` — 12 hafta, faz sırası, lansman günü slotları, kanal kadansı, sıralama.
- `launch.test.mjs` — duyuru metinleri, tüm lansman belgeleri, Show HN başlık sınırı, basın bülteninde iddia denetimi.
- `aso.test.mjs` — 23 dilin karakter sınırları, marka adının çevrilmemesi, yasak ifade, rakip analizi kapsamı.
- `referral.test.mjs` — K faktörü matematiği, kod uzayı, ödül ve kötüye kullanım kuralları, paylaşım metinleri.
- `report.test.mjs` — sütun eş anlamlıları, oran hesapları, hafta bölme, öneri kuralları.
- `dispatch.test.mjs` — CLI uçtan uca (publish/schedule/metrics/reply) geçici çıktı klasöründe.

Claude API'ye gerçek istek atan yol (`plan`, `generate`, `reply`, `analyze`) testlerde çağrılmaz; `client.ts` içindeki `setClientForTests` sahte istemci enjekte etmek için bırakıldı.

## Bilinen sınırlar

- `.mjs` katmanının canlı yayın yolu (`--live`) yalnızca sahte `fetch` ile test edilmiştir; gerçek anahtarla ilk yayın **elle** doğrulanmalıdır.
- TikTok ve YouTube için otomatik yükleme yoktur (uygulama incelemesi/kota); kuru çalışma paketi elle yüklenir.
- Görsel ve video üretimi kapsam dışıdır: `visual.brief`, `visual.shots` ve `visual.alt` alanları çekim brief'idir.
- TikTok Content Posting API, YouTube Data API (upload) ve Reddit API için otomatik yayın yok: TikTok ve YouTube uygulama incelemesi/kota ister, Reddit kendi kendini tanıtan botları yasaklar. Bu kanallar için `generate` çıktısı elle yüklenir.
- Instagram Story ve Reels kapak görseli, Facebook grup gönderisi (Graph API gruplara yayın iznini kapattı) desteklenmez.
- Zamanlanmış yayın yok; `bestTime` bilgisini cron / GitHub Actions ile birleştirerek `post --yes` komutunu ilgili saatte çalıştır (örnek: `0 16 * * 1-5` UTC = 19:00 TR).
- Görsel/video üretimi kapsam dışı; `visualBrief` ve `media[].alt` alanları fotoğrafçı/tasarımcı brief'idir. `post` için medya URL/yolu `posts.json`'a elle girilir.
