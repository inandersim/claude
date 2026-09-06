# Self-heal değişiklik günlüğü

Bu dosyaya **yalnızca ekleme** yapılır. Her satır otomatik hattın (analiz → düzeltme → kanarya)
attığı bir adımı kim/ne/neden/kanıt olarak kaydeder; bir adımı geri almak için yeni bir
"geri alma" kaydı yazılır, eski kayıt silinmez.

Alanlar:

- **kim** — adımı atan ajan ya da betik (`analyze.mjs`, `propose-fix.mjs`, `root-cause`, `canary.mjs`, insan kullanıcı adı).
- **ne** — yapılan iş (bir cümle).
- **neden** — hangi bulgu ve hangi ölçüm bunu tetikledi.
- **kanıt** — kırmızı → yeşil test kaydı, rapor yolu, PR/koşu bağlantısı.
