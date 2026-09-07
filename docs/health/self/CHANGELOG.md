# Self-heal değişiklik günlüğü

Bu dosyaya **yalnızca ekleme** yapılır. Her satır otomatik hattın (analiz → düzeltme → kanarya)
attığı bir adımı kim/ne/neden/kanıt olarak kaydeder; bir adımı geri almak için yeni bir
"geri alma" kaydı yazılır, eski kayıt silinmez.

Alanlar:

- **kim** — adımı atan ajan ya da betik (`analyze.mjs`, `propose-fix.mjs`, `root-cause`, `canary.mjs`, insan kullanıcı adı).
- **ne** — yapılan iş (bir cümle).
- **neden** — hangi bulgu ve hangi ölçüm bunu tetikledi.
- **kanıt** — kırmızı → yeşil test kaydı, rapor yolu, PR/koşu bağlantısı.
## 2026-09-07T22:48:09.940Z — Geri alma kararı: u-2026-09-06-a1

- **kim:** canary.mjs (kanarya nöbeti)
- **ne:** Geri alma kararı: u-2026-09-06-a1
- **neden:** crashFreeSessionsPct: 99.31 — sınır 99.32 (temel 99.62) [temel-dusus] · errorRatePct: 1.9 — sınır 1.75 (temel 1.4) [temel-carpan]
- **kanıt:** aşama yuzde5, 2140 oturum, ölçüm `agents/selfheal/fixtures/canary-metrics.json`
- **komut:** `eas update:rollback --branch production   # ya da: eas update:republish --group <önceki-grup>`
- **insan onayı:** evet
