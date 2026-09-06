---
description: docs/MODULE_GUIDE.md'ye göre yeni özellik modülü iskeleti kur
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '<modülAdı> [kısa açıklama]'
---

`module-builder` alt ajanını kullanarak yeni modülü kur: `$ARGUMENTS`

1. Önce `docs/MODULE_GUIDE.md` dosyasını oku ve bana 10 satırlık bir plan sun: modül adı, rota grubu, domain tipleri, repository metodları, ekranlar, i18n anahtar grupları. Onayımı bekle.
2. Onaydan sonra katmanları sırayla yaz (domain → seed → mock repo → hooks → bileşen/ekran → i18n tr+en → test). Ortak dosyalara yalnızca sözleşme ekle.
3. Typed route tiplerini yenile, `npx prettier --write`, `npx tsc --noEmit`, `npx eslint --no-cache <dosyalar>`, `npx jest <test>` çalıştır.
4. Diğer 7 dil için `/translate <modül>` önerisiyle bitir. Commit yapma.
