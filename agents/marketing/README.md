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

Claude API'ye gerçek istek atan yol (`plan`, `generate`, `reply`, `analyze`) testlerde çağrılmaz; `client.ts` içindeki `setClientForTests` sahte istemci enjekte etmek için bırakıldı.

## Bilinen sınırlar

- TikTok Content Posting API, YouTube Data API (upload) ve Reddit API için otomatik yayın yok: TikTok ve YouTube uygulama incelemesi/kota ister, Reddit kendi kendini tanıtan botları yasaklar. Bu kanallar için `generate` çıktısı elle yüklenir.
- Instagram Story ve Reels kapak görseli, Facebook grup gönderisi (Graph API gruplara yayın iznini kapattı) desteklenmez.
- Zamanlanmış yayın yok; `bestTime` bilgisini cron / GitHub Actions ile birleştirerek `post --yes` komutunu ilgili saatte çalıştır (örnek: `0 16 * * 1-5` UTC = 19:00 TR).
- Görsel/video üretimi kapsam dışı; `visualBrief` ve `media[].alt` alanları fotoğrafçı/tasarımcı brief'idir. `post` için medya URL/yolu `posts.json`'a elle girilir.
