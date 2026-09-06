---
description: Güvenlik taraması (gizli bilgi, bağımlılık, gateway, uygulama, CI) ve docs/security raporu
---

security-sentinel ajanını çalıştır: `.claude/agents/security-sentinel.md` içindeki tarama sırasını uygula, bulguları `docs/security/$(date +%F).md` dosyasına yaz, güvenli düzeltmeleri uygula ve `npm run lint && npm run typecheck && npm test` sonuçlarını raporla. $ARGUMENTS
