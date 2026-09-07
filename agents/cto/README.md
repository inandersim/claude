# agents/cto — AI CTO hattı

Bağımlılıksız Node 22 betikleri. Doğal dildeki bir geliştirme talebini
yapılandırılmış bir kayda çevirir, riskini sınıflar, hangi kapılardan geçmesi
gerektiğini belirler ve süreci denetlenebilir biçimde kaydeder.

Tüzüğün tamamı: **`docs/AI_CTO.md`**. Bağlayıcı politika: **`policy.json`**.

> **Bu hat kod yazmaz.** Talebi analiz eder ve kapıları yönetir; kodu Claude Code
> ajanları (`.claude/agents/`) yazar, CI doğrular, insan onaylar. Ayrım
> güvenlik gereğidir — bkz. tüzük §0.

## Dosyalar

| Dosya                   | İş                                                                     |
| ----------------------- | ---------------------------------------------------------------------- |
| `policy.json`           | **Bağlayıcı politika:** otonomi, risk, kapılar, onaylar, model seçimi  |
| `lib/policy.mjs`        | Politika okuma + doğrulama; eksik alanda fırlatır                      |
| `lib/impact.mjs`        | Talep → etkilenen modül/tablo/yol (modül listesi depodan okunur)        |
| `lib/risk-classify.mjs` | Deterministik risk sınıflandırma; yükseltilebilir, düşürülemez         |
| `lib/pipeline.mjs`      | 13 adımlı durum makinesi; kanıtsız adım geçemez                        |
| `lib/store.mjs`         | Talep kayıtları + yalnızca eklenen denetim izi                         |
| `intake.mjs`            | Talep alımı (adım 1–6)                                                 |
| `pipeline.mjs`          | Adım sonucu kaydı, insan onayı, durum                                  |
| `dispatch.mjs`          | Talebi `ai-cto` etiketli GitHub issue'ya çevirir (ajana devreder)      |
| `report.mjs`            | FEATURE / BUG / SECURITY raporları                                     |
| `health-report.mjs`     | Mühendislik sağlık raporu (puan uydurmaz)                              |
| `cto.test.mjs`          | 40 test (`npm run test:cto`)                                           |

Çıktılar `agents/cto/out/` altına yazılır (gitignore'da): `requests/<id>.json`,
`audit.jsonl`.

## Kullanım

```bash
# 1. Talep ver — ne anlaşıldığı, etki, risk ve plan ekrana gelir
node agents/cto/intake.mjs "Karadeniz'de 3 günlük trekking rotası önerisi ekle"

# 2. Ajana devret (onay gerekiyorsa önce onay alınmalı)
node agents/cto/dispatch.mjs --request <id> --dry   # gövdeyi gör
node agents/cto/dispatch.mjs --request <id>         # issue aç → workflow devralır

# 3. Adımları ilerlet (kanıt zorunlu)
node agents/cto/pipeline.mjs pass --request <id> --step understand --evidence "kapsam netleşti"
node agents/cto/pipeline.mjs pass --request <id> --step test --evidence "73 paket / 904 test yeşil"
node agents/cto/pipeline.mjs block --request <id> --step deploy --note "insan onayı bekliyor"
node agents/cto/pipeline.mjs approve --request <id> --by inan --evidence "PR #12 onaylandı"

# 4. Durum ve rapor
node agents/cto/pipeline.mjs status --request <id>
node agents/cto/report.mjs feature --request <id>
node agents/cto/health-report.mjs
```

## Değişmez kurallar

- **Risk sınıfını model belirlemez.** Yollar ve anahtar kelimeler belirler;
  model seviyeyi yalnızca yükseltebilir (`escalateTo`).
- **Kanıtsız kapı geçilmez.** `pass` için `evidence` zorunludur.
- **Test ve güvenlik atlanamaz.** `policy.pipeline.fastPath.neverSkip`.
- **Denetim izi yalnızca eklenir.** Geri alma, yeni bir kayıtla yapılır.
- **Hat kendi kurallarını değiştiremez.** `policy.json` ve `docs/AI_CTO.md`
  DENY listesindedir (`policy.denyPaths` ve `agents/selfheal/lib/risk.mjs`).
- **Onaysız devretme yok.** İnsan onayı gerektiren bir talep, onay kaydı
  olmadan ajana verilemez (`dispatch.mjs`).
