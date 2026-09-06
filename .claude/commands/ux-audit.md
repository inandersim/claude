---
description: Playwright ile web'de tüm ekranları gez; ekran görüntüsü, konsol hatası, [missing i18n ve iç içe <button> raporu
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '[/rota,/rota2] [--fix]'
---

`ux-auditor` alt ajanını kullanarak UX denetimi yap. Argümanlar: `$ARGUMENTS`

1. Web sunucusu çalışmıyorsa başlat: `CI=1 npx expo start --web --port 8081 > /tmp/expo-web.log 2>&1 &` ve `curl -sf http://localhost:8081` yanıt verene kadar bekle (en fazla 3 dk).
2. Playwright yoksa `npm i --no-save playwright && npx playwright install --with-deps chromium`.
3. `node tools/ux-audit/drive.js` (rota listesi verildiyse `ROUTES=... node tools/ux-audit/drive.js`).
4. `tools/ux-audit/out/report.md` ve ekran görüntülerini incele; görsel bulguları ekle.
5. `--fix` verildiyse yalnızca UI katmanındaki küçük düzeltmeleri yap ve `npm run lint && npm run typecheck && npm test` ile doğrula. Commit yapma.
6. Sunucuyu sen başlattıysan kapat. Bana rota başına özet tablo ve en önemli 5 bulguyu ver.
