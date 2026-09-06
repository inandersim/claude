---
description: Bir i18n modülünü 7 ek dile çevir (de, fr, es, it, ja, pt, ru) ve eksik anahtarları doğrula
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '<modül> [dil,dil,...]'
---

`translator` alt ajanını kullanarak `src/core/i18n/modules/$ARGUMENTS` için çeviri üret.

- İlk argüman modül adı (örn. `groups`, `destinations`); ikinci argüman verilmişse yalnızca o diller, verilmemişse `de,fr,es,it,ja,pt,ru`.
- Modül adı `all` ise `node agents/devops/i18n-check.mjs` çıktısındaki tüm eksik modül/dil çiftlerini sırayla tamamla.
- Önce mevcut durumu `node agents/devops/i18n-check.mjs` ile ölç; sonra dosyaları yaz; `localeSet(...)` bağını kur; `npx prettier --write` ve `npx tsc --noEmit` ile doğrula; yeniden `i18n-check` çalıştır.
- Rapor: yazılan dosyalar, anahtar sayısı, tsc sonucu. Commit yapma.
