---
description: OTA kanarya aşamasını değerlendir; eşik aşımında geri alma kararı üret
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '[--stage yuzde5] [--metrics <dosya>] [--risky]'
---

Kanarya nöbetini çalıştır. Argümanlar: `$ARGUMENTS`

Adımlar:

1. Merdiveni ve eşikleri göster: `node agents/selfheal/canary.mjs stages $ARGUMENTS`
2. Ölçümleri değerlendir: `node agents/selfheal/canary.mjs evaluate $ARGUMENTS`
   - `--metrics` verilmediyse `agents/selfheal/fixtures/canary-metrics.json` kullanılır; gerçek ölçüm kullanılmadıysa bunu özetinde belirt.
3. Kararı yorumla:
   - **geri-al** → hangi metrik hangi eşiği aştı, kaç kullanıcı etkilendi, geri alma komutu ne. Kararı uygulama; komutu göster ve insana bırak.
   - **bekle** → neyin eksik olduğunu (örneklem mi, süre mi) ve ne zaman yeniden bakılacağını söyle.
   - **ilerlet** → sonraki aşama yüzdesi ve komut.
4. Karar `geri-al` ya da `ilerlet` ise `docs/health/self/CHANGELOG.md` dosyasına denetim kaydı otomatik yazılır; kaydın son satırını göster.

Süreç ve eşiklerin gerekçesi `docs/SELF_IMPROVEMENT.md` içindedir. Bu komut yayın **yapmaz**, yalnızca karar üretir.
