# agents/selfheal — kendini analiz eden ve geliştiren hat

Bağımlılıksız Node 22 betikleri. Üretim sinyallerini okur, önceliklendirilmiş bulgu listesi
üretir, düzeltmeleri kapılardan geçirir ve yayını kanaryayla izler.

Sürecin tamamı, gerekçeleri ve eşikler: **`docs/SELF_IMPROVEMENT.md`**.
Ajan ekosisteminin geneli: `docs/AGENTS.md`.

## Dosyalar

| Dosya                   | İş                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `telemetry.schema.json` | Telemetri sözleşmesi (7 olay türü + gizlilik kuralları)                            |
| `lib/telemetry.mjs`     | Şema doğrulama, gizlilik temizliği, imzaya göre gruplama, fixture/HTTP okuma       |
| `lib/findings.mjs`      | Bulgu modeli, önceliklendirme (etki × sıklık × kolaylık), kaynak başına üreticiler |
| `lib/risk.mjs`          | **Yetki sınırı:** DENY / ALLOW / RISKY listeleri                                   |
| `lib/audit.mjs`         | Denetim kaydı (kim/ne/neden/kanıt), yalnızca ekleme                                |
| `lib/util.mjs`          | Ortak yardımcılar (argüman, dosya, normalizasyon)                                  |
| `analyze.mjs`           | Altı sinyali birleştirip rapor üretir                                              |
| `perf.mjs`              | Paket / açılış süresi / sorgu sayısı bütçeleri                                     |
| `guard.mjs`             | **Regresyon kalkanı:** kırmızı → yeşil kanıtı ve test yumuşatma taraması           |
| `propose-fix.mjs`       | Dört kapı ve taslak PR                                                             |
| `canary.mjs`            | Kademeli açılım ve geri alma kararı                                                |
| `budgets.json`          | Performans bütçeleri (insan kararı; hat değiştiremez)                              |
| `fixtures/`             | Gerçek sunucu yokken kullanılan örnek veriler                                      |
| `*.test.mjs`            | Birim testler (`npm run test:selfheal`)                                            |

Çıktılar `docs/health/self/` altına yazılır: `<tarih>.json`, `<tarih>.md`, `latest.json`,
`CHANGELOG.md` (denetim kaydı), `evidence/<bulgu-id>.json` (kırmızı → yeşil kanıtı).

## Hızlı kullanım

```bash
npm run test:selfheal                     # hattın kendi testleri (101 test)
node agents/selfheal/analyze.mjs          # fixture verisiyle analiz + rapor
node agents/selfheal/analyze.mjs --live   # gh run list + npm audit + ZIRTAN_TELEMETRY_URL
node agents/selfheal/perf.mjs             # bütçe aşımları (aşım varsa çıkış 1)
node agents/selfheal/canary.mjs stages    # kanarya merdiveni ve eşikler

node agents/selfheal/propose-fix.mjs plan --finding <id>     # görev tarifi
node agents/selfheal/guard.mjs record --finding <id> --test <t> --phase red
node agents/selfheal/propose-fix.mjs verify --finding <id>   # dört kapı
```

## Değişmez kurallar

- **Sır okunmaz, veri gönderilmez.** Telemetri yalnızca `GET` ile okunur; `.env`, anahtar ve
  sertifika dosyaları DENY listesindedir.
- **Kanıtsız düzeltme yok.** Kırmızı adımda test gerçekten başarısız olmadıysa kayıt reddedilir.
- **Kapı gevşetilemez.** `agents/selfheal/**`, `.github/**` ve `.claude/**` DENY listesindedir —
  hat kendi kurallarını değiştiremez (self-modification lock).
- **Birleştirme kararı insana aittir.** PR'lar taslak açılır; riskli alanlarda `needs-human`.

## İş akışları

`.github/workflows/self-analysis.yml` (günlük analiz + rapor PR'ı) ·
`.github/workflows/self-fix.yml` (bulgu başına düzeltme PR'ı) ·
`.github/workflows/canary.yml` (kanarya değerlendirmesi, geri alma issue'su).
