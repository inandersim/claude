---
description: Kırmızı CI'yı kök nedenden düzelt (test atlamadan)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '[PR numarası | dal adı | hata özeti]'
---

`steward` alt ajanını kullanarak CI hatasını kökten düzelt. Bağlam: `$ARGUMENTS`

1. Bağlam bir PR numarasıysa ve `gh` kimliği varsa günlükleri çek: `gh run list --branch <dal> --limit 3` ve `gh run view <id> --log-failed`. Yoksa yerelde yeniden üret: `npm run lint -- --max-warnings=0 && npm run typecheck && npm test -- --ci && npm run test:pipeline`.
2. İlk **kök** hatayı bul; belirtiyi değil nedeni düzelt. `it.skip`, `@ts-ignore`, `eslint-disable`, test beklentisini yumuşatma **yasak**.
3. Üçlü doğrulama yeşil olana kadar tekrar et; dokunulan dosyaları `npx prettier --write` ile biçimlendir.
4. Commit atma (istemediğim sürece). Önerilen Türkçe conventional commit mesajını ve değişen dosyaları raporla.
