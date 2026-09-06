---
description: Üretim sinyallerini (telemetri, CI, kapsam, performans, i18n, güvenlik) birleştirip önceliklendirilmiş bulgu raporu üret
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '[--live] [--top 10]'
---

Self-heal analizini çalıştır ve sonucu yorumla. Argümanlar: `$ARGUMENTS`

Adımlar:

1. Analizi çalıştır: `node agents/selfheal/analyze.mjs $ARGUMENTS`
   - `--live` verilmediyse telemetri ve güvenlik verisi `agents/selfheal/fixtures/` altındaki örneklerden gelir; i18n denetimi her zaman canlı çalışır. Raporun "Veri kaynakları" tablosu hangi sinyalin nereden geldiğini gösterir — özetinde bunu **mutlaka** belirt.
2. Rapor `docs/health/self/<bugün>.json` ve `.md` olarak yazılır. Markdown'ı oku.
3. En yüksek puanlı üç bulgu için kısa bir yorum ekle: bu ölçüm gerçekten bir sorun mu, yoksa ölçüm hatası mı? (Örneğin tek bir cihaz modelinden gelen çökme, tüm kullanıcıları etkileyen bir hata değildir.)
4. Otomatik düzeltmeye uygun (`autoFixable`) bulgular arasından **en yüksek puanlıyı** seç ve görev tarifini göster: `node agents/selfheal/propose-fix.mjs plan --finding <id>`
5. Riskli alan (ödeme, SOS, kimlik) bulgularını ayrı bir başlıkta listele; bunlar insan onayı gerektirir.

Bana özet ver: durum (yeşil/sarı/kırmızı), en önemli 3 bulgu ve nedeni, kaç bulgu otomatik düzeltilebilir, rapor yolu. Düzeltme **uygulama** — bu komut yalnızca analiz eder.
