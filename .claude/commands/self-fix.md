---
description: Bir self-heal bulgusunu kök nedenden düzelt (önce kırmızı test, sonra en küçük düzeltme, sonra kapılar)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
argument-hint: '<bulgu-id> [--dry-run]'
---

`root-cause` alt ajanını kullanarak `$ARGUMENTS` bulgusunu düzelt.

Adımlar:

1. Görev tarifini al: `node agents/selfheal/propose-fix.mjs plan --finding $ARGUMENTS`
   Tarif hangi dosyalara dokunabileceğini ve neyin yasak olduğunu söyler; dışına çıkma.
2. `root-cause` ajanı kök nedeni bulsun (yığın izi → çağıran → neden zinciri → yayılım taraması).
3. **Önce kırmızı test:** `node agents/selfheal/guard.mjs record --finding <id> --test <test> --phase red`
   Test bu adımda geçerse hatayı yakalamıyordur; testi düzelt. Bu adım atlanamaz.
4. En küçük düzeltmeyi uygula, sonra yeşili kanıtla: `... --phase green`
5. Kapıları çalıştır: `node agents/selfheal/propose-fix.mjs verify --finding <id>`
   Dördü de (yetki · kalkan · kanıt · doğrulama) yeşil olmadan devam etme.
6. `--dry-run` verildiyse `node agents/selfheal/propose-fix.mjs pr --finding <id> --dry-run` ile PR taslağını göster, **açma**. Aksi halde kullanıcı açıkça istediyse PR aç.

Kurallar: test atlama/yumuşatma yok (`it.skip`, `@ts-ignore`, `eslint-disable`), testi silme yok, kanıtsız PR yok. Riskli alan (ödeme/SOS/kimlik) ise PR `needs-human` etiketiyle taslak açılır ve otomatik birleştirilmez.

Bana özet ver: kök neden (1-2 cümle), değişen dosyalar, kanıt (test + kırmızı/yeşil çıkış kodları), kapı sonuçları, insan onayı gerekiyor mu.
