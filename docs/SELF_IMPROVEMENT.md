# Kendini analiz eden ve geliştiren altyapı

Zirtan'ın bakım hattı üç halkadan oluşur: **ölç → düzelt → yayınla**. Her halka kendi kapısıyla
gelir ve hiçbir halka bir sonrakine kanıt olmadan geçemez. Bu belge hattın nasıl çalıştığını,
neyin otomatik olduğunu ve **neyin bilerek otomatik olmadığını** anlatır.

Bu hat, `docs/AGENTS.md`'deki gece sağlık taramasının üzerine kurulur; onun yerine geçmez.
Sağlık taraması "depo sağlıklı mı?" diye sorar, self-heal hattı "**kullanıcılar** ne yaşıyor ve
bunun için ne yapabiliriz?" diye sorar.

## 1. Şema

```
   Üretim                    Depo
   ┌──────────────┐          ┌───────────────────────────────────────┐
   │ telemetri    │          │ CI geçmişi · test kapsamı · i18n      │
   │ (7 olay türü)│          │ paket boyutu · güvenlik taraması      │
   └──────┬───────┘          └──────────────────┬────────────────────┘
          └────────────┬────────────────────────┘
                       ▼
            agents/selfheal/analyze.mjs          ← self-analysis.yml (günlük 04:30)
                       │  etki x sıklık x kolaylık
                       ▼
        docs/health/self/<tarih>.{json,md}       → PR (rapor)
                       │
                       ▼
            propose-fix.mjs plan                 ← self-fix.yml (elle / haftalık)
                       ▼
              .claude/agents/root-cause
                       │  1. kırmızı test  2. en küçük düzeltme  3. yeşil test
                       ▼
                    guard.mjs                    ← kanıt yoksa buradan geçilemez
                       ▼
     ┌──── propose-fix.mjs (4 kapı) ─────┐
     │ yetki · kalkan · kanıt · lint+tc+test │
     └──────────────┬────────────────────┘
                    ▼ (yalnızca hepsi yeşilse)
              taslak PR + denetim kaydı
                    ▼
              İNSAN İNCELEMESİ  ← burada durur, otomatik birleştirme yoktur
                    ▼
                 OTA yayını
                    ▼
              canary.mjs (%5 → %25 → %50 → %100)   ← canary.yml (2 saatte bir)
                    │  eşik aşıldı mı?
                    ▼
              geri-al / bekle / ilerlet
```

## 2. Telemetri sözleşmesi

Sözleşme: `agents/selfheal/telemetry.schema.json`. Doğrulayıcı ve okuyucu:
`agents/selfheal/lib/telemetry.mjs`.

Yedi olay türü toplanır:

| Tür              | Ne yakalar                           | Zorunlu detay alanları |
| ---------------- | ------------------------------------ | ---------------------- |
| `crash`          | Ölümcül çökme                        | `message`              |
| `error`          | Sınırda yakalanan hata               | `message`              |
| `slow_screen`    | Bütçeyi aşan ekran açılışı           | `screen`, `ms`         |
| `failed_request` | Başarısız ağ isteği                  | `endpoint`, `status`   |
| `flow_abandon`   | Yarıda bırakılan akış                | `flow`, `step`         |
| `empty_screen`   | Boş görünen ekran                    | `screen`               |
| `i18n_missing`   | Çalışma zamanında bulunamayan çeviri | `key`, `locale`        |

### Gizlilik kuralları (sözleşmenin parçası)

- **Kullanıcı kimliği taşınmaz.** Yalnızca `sessionHash` (16 haneli, geri döndürülemez özet)
  bulunur ve o da sadece "kaç ayrı oturum etkilendi" sayımı içindir.
- **Rota ve uç noktalardaki kimlikler maskelenir:** `/(app)/stories/98421` → `/(app)/stories/[id]`.
  Sorgu dizesi tamamen atılır (`?token=…` asla saklanmaz).
- **Serbest metin temizlenir:** e-posta, telefon, UUID ve uzun sayı dizileri `scrubText` ile
  maskelenir. Bu temizlik okuma anında, yerelde yapılır.
- **Şema dışı alan reddedilir.** `additionalProperties: false` sayesinde sunucu yeni bir alan
  eklerse (örneğin yanlışlıkla bir e-posta) olay geçersiz sayılır ve rapora "sözleşme dışı"
  olarak düşer — sessizce içeri alınmaz.
- **Veri yalnızca okunur.** `loadTelemetry` sadece `GET` yapar; gövde göndermez, kimlik bilgisi
  eklemez. Hattın hiçbir yerinde uzak sunucuya veri **gönderen** kod yoktur.

### Gerçek sunucu yokken

`ZIRTAN_TELEMETRY_URL` tanımlı değilse `agents/selfheal/fixtures/telemetry.json` kullanılır.
Rapor hangi sinyalin nereden geldiğini **her zaman** yazar ("Veri kaynakları" tablosu) — fixture
verisi gerçek veri gibi sunulmaz.

## 3. Önceliklendirme

`agents/selfheal/lib/findings.mjs` iki ayrı sayı üretir; karıştırılmamalıdırlar:

- **aciliyet = etki × sıklık** → "ne kadar kötü" (önem derecesi buradan gelir)
- **puan = etki × sıklık × kolaylık** → "önce neyi düzeltelim" (sıralama buradan gelir)

Ayrılmalarının sebebi: kolaylık bir sorunu daha az ciddi yapmaz. Düzeltmesi zor bir çökme hâlâ
kritiktir, yalnızca sıraya daha aşağıda girer.

- **Etki**: tür ağırlığı (`crash` 1.0 → `i18n_missing` 0.3), riskli alandaysa +0.15 (üst sınır 1.0).
- **Sıklık**: etkilenen oturum / toplam oturum, logaritmik ölçekte (%0,1 ≈ 0.10 · %1 ≈ 0.35 ·
  %10 ≈ 0.70). Oran tabanlıdır, mutlak sayı değil — uygulama büyüdükçe eşikler kaymaz.
- **Kolaylık**: tür ağırlığı; riskli alanda ×0.6 (insan kapısı yavaşlatır), dosya belirsizse ×0.7.

**Önem tabanı:** can güvenliği (SOS) ve kimlik alanındaki çökme/hatalar, az sayıda oturumu
etkilese bile "yüksek"in altına düşemez. Nadir ama ölümcül bir SOS hatasının sıklık düşük diye
listenin dibine düşmesini engeller.

**Birleştirme:** aynı konuyu iki kaynaktan bildiren bulgular (telemetrideki "yavaş ekran" ile
performans nöbetindeki "açılış bütçesi aşıldı") tek satırda birleşir; ikincisi `corroboratedBy`
olarak kaydedilir.

## 4. Ajanların yetki sınırları

Sınırlar tek bir yerde tanımlıdır: `agents/selfheal/lib/risk.mjs`. Üç liste sırayla uygulanır.

### DENY — hiçbir koşulda değiştirilemez

| Yol                                                                       | Neden                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.env*`, `**/secrets/**`, `*.pem`, `*.key`, `*.keystore`, `*.p8`, `*.p12` | Sır ve imzalama anahtarları. Ajan bunları **okumaz** da.                                           |
| `package.json`, `package-lock.json`                                       | Bağımlılık kararı insana aittir (`dependency-update.yml` ayrı akış).                               |
| `app.json`, `eas.json`                                                    | Uygulama izinleri ve yayın profilleri.                                                             |
| `.github/**`                                                              | Hat kendi tetikleyicisini ve CI kapılarını değiştiremez.                                           |
| `.claude/**`                                                              | Hat kendi talimatlarını değiştiremez.                                                              |
| `agents/selfheal/**`                                                      | **Self-modification lock:** hat kendi güvenlik kurallarını, bütçelerini ve kalkanını değiştiremez. |

Son üç satır hattın en önemli güvencesidir: bir ajan kapıları geçemediğinde kapıyı gevşetme
seçeneğine sahip değildir. Bu dosyaları değiştirmek yalnızca insan PR'ı ile mümkündür.

### ALLOW — otomatik düzeltmenin dokunabileceği yerler

`src/**/*.ts`, `src/**/*.tsx`, `src/**/__tests__/**`, `tools/**/*.js`, `tools/**/*.mjs`,
`docs/health/self/**`. Listede olmayan her yol reddedilir (yasak olmasa bile) — `server/`,
`website/`, `assets/` dahil.

### RISKY — izinli ama insan onaylı

| Kategori | Kapsam                                                                                                                                                                        | Sonuç                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `odeme`  | `pricing.ts`, `marketplace.ts`, `inventory.ts`, `features/{market,courses,inventory}`, adında `payment`/`checkout` geçen her dosya                                            | PR `needs-human` etiketiyle **taslak** açılır, otomatik birleştirilmez |
| `sos`    | `emergency.ts`, `rescue.ts`, `satellite.ts`, `telemed.ts`, `features/{satellite,rescue,firstaid,telemed}`, `app/(app)/satellite/**`, adında `sos`/`emergency` geçen her dosya | Aynısı + kanarya aşamaları zorunlu, bekleme süreleri iki katı          |
| `kimlik` | `features/auth/**`, `app/(auth)/**`, `trust.ts`, `data/session*`, adında `auth` geçen her dosya                                                                               | Aynısı                                                                 |

Eşleşme büyük/küçük harfe duyarsızdır: depoda `PaymentTimeline.tsx`, `HoldSosButton.tsx` gibi
adlar var; duyarlı eşleşme bunları kaçırırdı ve kaçırmanın bedeli yanlış pozitiften ağırdır.

### Ajan başına yetki

| Ajan / betik                     | Okur                                      | Yazar                           | Yapamaz                                                             |
| -------------------------------- | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `analyze.mjs`                    | telemetri, CI, kapsam, bütçe, i18n, audit | `docs/health/self/**`           | Kod değiştiremez                                                    |
| `root-cause` (`.claude/agents/`) | `src/**`, raporlar                        | ALLOW listesi                   | Sır okuyamaz, test atlayamaz, kapı gevşetemez, `main`'e push edemez |
| `propose-fix.mjs`                | rapor, git diff                           | dal + taslak PR + denetim kaydı | Kapı kırmızıysa PR açamaz                                           |
| `guard.mjs`                      | test çıktıları                            | `docs/health/self/evidence/**`  | Kanıt uyduramaz (kırmızı adım gerçekten başarısız olmalı)           |
| `canary.mjs`                     | kanarya ölçümleri                         | denetim kaydı                   | Yayın yapamaz, geri alamaz — yalnızca karar üretir                  |

## 5. Regresyon kalkanı — kırmızı → yeşil kanıtı

Her düzeltme için **önce başarısız olan bir test** yazılır. Kanıt olmadan PR açılmaz.

```bash
# 1. Düzeltmeden ÖNCE: test yazılır ve kırmızı olduğu kanıtlanır
node agents/selfheal/guard.mjs record --finding <id> --test <test-dosyasi> --phase red

# 2. En küçük düzeltme uygulanır

# 3. Düzeltmeden SONRA: aynı testin geçtiği kanıtlanır
node agents/selfheal/guard.mjs record --finding <id> --test <test-dosyasi> --phase green
```

Kanıt `docs/health/self/evidence/<id>.json` dosyasında saklanır ve şu kurallarla doğrulanır:

- Kırmızı adımda test **gerçekten başarısız olmalı**. Geçerse kayıt reddedilir — testin hatayı
  yakalamadığı anlamına gelir. "Zaten geçen" bir test kanıt sayılmaz.
- Yeşil adım kırmızıdan **sonra** alınmış olmalı; ikisi aynı dosya ve aynı komutla.
- Yeşil kayıt olmadan (ya da kırmızı olmadan yeşil) zincir geçersizdir.
- Kanıttaki test dosyası PR anında hâlâ var ve dolu olmalıdır — sonradan silmek kapıyı kırar.

Ayrıca `guard.mjs scan-diff` diff'i tarar ve şunları **ihlal** sayar: `it.skip`, `xit`,
`test.todo`, `.only`, `--passWithNoTests`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable`,
silinmiş test dosyası ve net olarak azalan `expect()` sayısı.

## 6. Dört kapı

`propose-fix.mjs verify` sırayla çalıştırır; **hepsi** yeşil olmadan PR açılmaz ve kapıları
atlayan bir bayrak yoktur.

1. **Yetki** — değişen her dosya ALLOW listesinde, hiçbiri DENY listesinde değil.
2. **Kalkan** — diff'te test atlama/silme/yumuşatma yok.
3. **Kanıt** — bulguya ait kırmızı → yeşil zinciri geçerli.
4. **Doğrulama** — `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test -- --ci`.

Riskli alana dokunulduysa PR `needs-human` etiketiyle **taslak** açılır ve otomatik birleştirilmez.
Temiz bir PR bile taslak açılır: **birleştirme kararı her zaman insana aittir.**

## 7. Performans bütçeleri

Bütçeler `agents/selfheal/budgets.json` içindedir ve hat tarafından **değiştirilemez** (kendi
klasörü DENY listesinde) — bütçe gevşetmek insan kararıdır.

| Bütçe                           | Sınır                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| JS paketi (gzip)                | 1200 KB                                                           |
| Toplam paket (gzip)             | 2000 KB                                                           |
| Ekran açılışı (p75), varsayılan | 1200 ms                                                           |
| Ekran başına sorgu, varsayılan  | 5                                                                 |
| `/(app)/satellite/sos`          | 800 ms / 2 sorgu — can güvenliği akışı her koşulda hızlı açılmalı |
| `/(app)/explore`                | 1500 ms / 8 sorgu — harita ve öneri listesi birlikte yükleniyor   |
| `/(app)/tracks/[id]`            | 1400 ms / 6 sorgu — yükseklik grafiği ve iz geometrisi            |

Aşım bulgu üretir; `node agents/selfheal/perf.mjs` aşım varsa 1 ile çıkar.

## 8. Kanarya ve geri alma

OTA (expo-updates) güncellemesi kademeli açılır. `canary.mjs` **karar üretir, yayın yapmaz** —
"ölçen" ile "yayınlayan" bilerek ayrıdır.

### Merdiven

| Aşama     | Kullanıcı | Bekleme | En az oturum |
| --------- | --------: | ------: | -----------: |
| `yuzde5`  |        %5 |   60 dk |          500 |
| `yuzde25` |       %25 |  180 dk |        2.000 |
| `yuzde50` |       %50 |  360 dk |        5.000 |
| `tam`     |      %100 |       — |            — |

`minSessions` şunun içindir: az örneklemle **ilerlemek de geri almak da** yanlıştır. Örneklem
dolmadan karar `bekle` olur.

### Geri alma eşikleri

Her metrikte hem **mutlak** hem **temel çizgiye göreli** sınır vardır; mutlak sınır felaketi,
göreli sınır sessiz bozulmayı yakalar. Herhangi biri aşılırsa karar **`geri-al`**'dır.

| Metrik                | Mutlak sınır  | Temele göre sınır                |
| --------------------- | ------------- | -------------------------------- |
| Çökmesiz oturum oranı | en az %99,0   | temelden en fazla 0,3 puan düşük |
| Hata oranı            | en fazla %5,0 | temelin en fazla 1,25 katı       |
| Akış tamamlama oranı  | —             | temelin en az %95'i              |
| Ekran açılışı (p75)   | —             | temelin en fazla 1,2 katı        |

Eşik aşımı, örneklem ve bekleme kapılarından **önce** değerlendirilir: felaket varsa örneklem
beklenmez.

### Riskli alan (ödeme / SOS / kimlik) kuralları

- Bekleme süreleri **iki katı**.
- **Her aşamada** insan onayı gerekir.
- `yuzde50` üstüne çıkmak otomatik karar değildir; insan onayı şarttır.

### Süreç

1. PR birleşir, OTA `production` dalına %5 ile yayınlanır.
2. `canary.yml` iki saatte bir `canary.mjs evaluate` çalıştırır.
3. Karar `ilerlet` → sonraki yüzde; `bekle` → yeniden ölç; **`geri-al` → iş akışı kırmızı biter,
   `needs-human` etiketli issue açılır.**
4. Geri alma komutu **otomatik çalıştırılmaz**; bir bakımcı uygular:
   ```bash
   eas update:rollback --branch production
   # ya da: eas update:republish --group <önceki-grup>
   ```
   Bunun otomatik olmamasının sebebi: hatalı bir geri alma da kullanıcıyı bozuk bir sürümde
   bırakabilir; kararın ölçümü otomatik, uygulaması insanlıdır.

## 9. Denetlenebilirlik

Her otomatik adım `docs/health/self/CHANGELOG.md` dosyasına **kim / ne / neden / kanıt** olarak
yazılır. Dosyaya yalnızca ekleme yapılır; bir adımı geri almak için yeni bir kayıt yazılır,
geçmiş yeniden yazılmaz. Kim/ne/neden alanları boşsa kayıt reddedilir — sessiz değişiklik olamaz.

Kanıt dosyaları `docs/health/self/evidence/<bulgu-id>.json` altında durur ve PR gövdesinden
bağlanır: hangi test, hangi commit'te kırmızıydı, hangi commit'te yeşile döndü.

## 10. Günlük kullanım

```bash
npm run test:selfheal                                   # hattın kendi birim testleri
node agents/selfheal/analyze.mjs                        # fixture verisiyle analiz
node agents/selfheal/analyze.mjs --live                 # gh + npm audit + gerçek telemetri
node agents/selfheal/perf.mjs                           # bütçe aşımları
node agents/selfheal/canary.mjs stages --risky          # merdiven ve eşikler
node agents/selfheal/canary.mjs evaluate --metrics <f>  # kanarya kararı

node agents/selfheal/propose-fix.mjs plan --finding <id>    # görev tarifi ve yetki sınırları
node agents/selfheal/guard.mjs record --finding <id> --test <t> --phase red
node agents/selfheal/propose-fix.mjs verify --finding <id>  # dört kapı
node agents/selfheal/propose-fix.mjs pr --finding <id> --dry-run
```

Claude ile: `/self-analyze`, `/self-fix <bulgu-id>`, `/self-canary`. Ajan: `root-cause`.

## 11. Gerçek sunucu bağlanınca yapılacaklar

Hat bugün fixture verisiyle uçtan uca çalışır. Üretim verisine geçmek için:

1. **Telemetri ucu.** `telemetry.schema.json` sözleşmesine uyan bir JSON döndüren okuma uç noktası
   yayınla. Yanıt `{ window: { from, to, totalSessions }, events: [...] }` şeklinde olmalı;
   olaylar sunucu tarafında imzaya göre toplulaştırılmalı (`count` ve `sessions` alanları).
   Adresi `ZIRTAN_TELEMETRY_URL` deposu sırrı olarak tanımla — `self-analysis.yml` ve `canary.yml`
   onu okur.
2. **Uygulama tarafı gönderici.** `src/` içinde olay üreten bir katman gerekir (bu hat onu
   yazmaz). Gönderici, şemadaki gizlilik kurallarına **kaynağında** uymalıdır: kullanıcı kimliği
   yerine oturum özeti, rota kimliklerini maskeleyerek, sorgu dizesi olmadan.
3. **Kanarya ucu.** `GET <telemetri>/canary?stage=…` aynı biçimde `{ updateId, stage,
observedMinutes, canary: {...}, baseline: {...} }` döndürmeli.
4. **Kapsam.** `self-analysis.yml` kapsamı zaten üretiyor; `coverage/coverage-summary.json` varsa
   analiz fixture yerine onu kullanır — ek iş gerekmez.
5. **Paket boyutu.** `npm run bundle-size` çalıştıkça `docs/health/self` yerine
   `docs/health/bundle-size.json` güncellenir; `perf.mjs` onu otomatik tercih eder.
6. **CI geçmişi.** `--live` verildiğinde `gh run list` okunur; `GH_TOKEN` iş akışlarında zaten var.
7. **Güvenlik.** `--live` ile `npm audit --omit=dev` gerçek çalışır; ağ kapalıysa fixture'a düşer
   ve rapor bunu yazar.
8. **EAS.** Kanarya yüzdelerini uygulamak için `eas update --branch production --rollout <yüzde>`
   akışını kur. `EAS_TOKEN` sırrı **isteğe bağlıdır** ve yalnızca yayın işine verilmelidir;
   `canary.mjs` ona ihtiyaç duymaz.

Bağlanana kadar her rapor hangi sinyalin fixture'dan geldiğini açıkça yazar — kimse fixture
verisine bakıp üretim kararı vermez.

## 12. Bilinen sınırlar

- Telemetri fixture'ı gerçek kullanıcı davranışını temsil etmez; puanlar ancak gerçek veriyle anlam kazanır.
- `analyze.mjs --live` `gh` ve ağ gerektirir; yoksa sessizce fixture'a düşer (rapor bunu yazar).
- `root-cause` ajanı yalnızca `src/**` düzeltir; `server/` ve `website/` kapsam dışıdır.
- Kanarya ölçümleri OTA (JS) güncellemeleri içindir; native sürüm çıkışları bu merdivene girmez.
- Terk edilen akış ve başarısız uzak istek bulguları **ürün/altyapı kararıdır**; hat bunları
  ölçer ve raporlar, düzeltmez.
