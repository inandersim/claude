# ADR-0006 — Geliştirme otonomisi ve onay kapıları

**Durum:** kabul · **Tarih:** 2026-09 · **İlgili:** `docs/AI_CTO.md`, `agents/cto/policy.json`, `docs/SELF_IMPROVEMENT.md`

## Bağlam

Projenin geliştirmesini büyük ölçüde yapay zekâ ajanları yapıyor. Soru "ajan kod
yazsın mı" değil — yazıyor. Soru şu: **hangi noktada insan onayı zorunlu?**
Sınır yoksa, ilk ciddi hata üretim verisinde ya da güvenlik sınırında olur ve
geri alınamaz.

## Karar

Beş kademeli otonomi (L0–L4) tanımlanır ve etkin kademe **L2**'dir: ajan kod
yazar, test ve güvenlik taraması çalıştırır, taslak PR açar — **dağıtım
yapamaz**. L3 (sahne dağıtımı) gerçek sunucu kurulunca, L4 (sınırlı otonom
üretim) en az bir çeyrek kesintisiz L3 çalışmadan sonra açılır.

13 adımlı boru hattı ve kapıları `agents/cto/policy.json` içinde **veri olarak**
tutulur; betikler ve yönetim paneli aynı dosyayı okur. Kapılar kanıt ister:
kanıtsız adım geçmiş sayılmaz.

Hat **kendi kurallarını değiştiremez**: `policy.json`, `docs/AI_CTO.md`,
`agents/selfheal/**`, `.github/**` ve `.claude/**` DENY listesindedir.

## Alternatifler

- **Tam otonomi:** hızlı; ilk yanlış migration'da veri kaybı.
- **Her değişiklikte insan onayı:** güvenli ama ajan kullanmanın anlamını
  bitirir; onay yorgunluğu üretir ve onaylar gerçek incelemeye dönüşmez.
- **Kuralları yalnızca belgede tutmak:** belge ile kod ayrışır; kapı olduğunu
  sandığın yerde kapı olmaz.

## Gerekçe

Otonomi tek bir anahtar değil, kademeli bir yetkidir ve her kademe kanıtla
kazanılır. Kuralların makine okunur olması, "yazılı kural" ile "uygulanan kural"
arasındaki farkı kapatır — testler kapıların gerçekten kapattığını doğrular.

## Sonuçlar

- Politika değişikliği bir insan PR'ı gerektirir; ajan kendi yetkisini
  genişletemez.
- Kapı sayısı geliştirmeyi yavaşlatır. Bu, bilinçli bir bedeldir: LOW riskli
  işler için hızlı yol tanımlıdır, ancak test ve güvenlik hiçbir koşulda
  atlanmaz.
- Denetim izi yalnızca eklenir; geri alma yeni bir kayıtla yapılır.
