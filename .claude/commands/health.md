---
description: Altyapı sağlık taraması (lint, typecheck, test, pipeline, expo-doctor, audit, i18n) ve docs/health raporu
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '[--fix] [--only=lint,typecheck,...]'
---

`infra-doctor` alt ajanını kullanarak tam bir altyapı sağlık taraması yap. Argümanlar: `$ARGUMENTS`

Adımlar:

1. Komut listesini göster: `node agents/devops/health.mjs --dry-run`
2. Taramayı çalıştır: `node agents/devops/health.mjs --out docs/health $ARGUMENTS` (`--only=` verildiyse aynen ilet).
3. `infra-doctor` ajanı `docs/health/<bugün>.md` raporunu bulgular, öncelikler ve önerilen düzeltmelerle tamamlasın; Metro/Hermes/React Compiler tuzak taramasını da eklesin.
4. `--fix` verildiyse yalnızca düşük riskli düzeltmeleri uygula (lint/typecheck/i18n/yer tutucu), `npm run lint && npm run typecheck && npm test` geçtiğini doğrula. Commit **yapma**; raporda değişen dosyaları listele.
5. Bana özet ver: durum (yeşil/sarı/kırmızı), en önemli 3 bulgu, rapor yolu.
