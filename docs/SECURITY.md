# Zirtan — güvenlik modeli ve ajan yetenekleri (dürüst özet)

## Yazılım ajanları ne yapar, ne yapamaz

| Soru                            | Cevap                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arka planda çalışıyorlar mı?    | Henüz değil. Ajanlar repo içinde tanımlı (`.claude/agents`, `.github/workflows`). Çalışmaları için (1) depoda `main` dalı, (2) GitHub Secrets'ta `ANTHROPIC_API_KEY`, (3) Actions'ın açık olması gerekir. Sonra CI kırmızıya döndüğünde, her gece 03:00 UTC'de, her Pazartesi ve `@claude` yorumlarında otomatik tetiklenirler.                                                   |
| Hangi dillere hâkimler?         | Claude API tabanlıdırlar; TypeScript/JavaScript, Python, SQL, YAML, Kotlin/Swift (native modüller), Bash dâhil yaygın dillerde üretim kalitesinde kod yazarlar. Bu repoda TypeScript strict + React Native kurallarıyla sınırlandırılmışlardır.                                                                                                                                   |
| Kod yazma başarısı?             | Bu projede 30'dan fazla modül bu ajanlarla yazıldı; her modül lint + tip denetimi + Jest ile doğrulandı. Hata oranı: kod tamamlanmadan CI'dan geçmez.                                                                                                                                                                                                                             |
| Analiz / anti-hacker?           | `security-sentinel` ajanı + `security.yml` iş akışı: gitleaks (gizli anahtar), CodeQL (statik analiz), Semgrep (OWASP), `npm audit` (bağımlılık), gateway sertleştirme testi (anahtarsız istek 401, aşırı gövde reddi). Saldırı **tespiti** için çalışma zamanında oran sınırı ve anomali günlükleri gateway'de; üretimde Cloudflare WAF + Supabase RLS + Sentry önerilir.        |
| Kendilerini geliştiriyorlar mı? | Model kendi ağırlıklarını değiştirmez. "Gelişme" üç yoldan olur: (1) Anthropic yeni model yayınladıkça ajanlar otomatik daha iyi olur, (2) `docs/health` ve `docs/security` raporlarındaki tekrar eden bulgular ajan talimatlarına (`.claude/agents/*.md`) eklenir, (3) test/lint kuralları sıkılaştıkça ajanlar daha az hata yapar. Bu döngüyü `nightly-health` iş akışı besler. |
| Sınırlar                        | İnsan onayı olmadan `main`e yazamazlar; PR açarlar. Issue metinleri güvensiz veri sayılır. Maliyet Claude API kullanımıyla sınırlıdır.                                                                                                                                                                                                                                            |

## Saldırı yüzeyi ve karşı önlemler

- **AI gateway:** `x-zirtan-key` zorunlu, IP+anahtar oran sınırı, gövde 8 MB / görüntü 5 MB sınırı, CORS listesi, sistem promptu sabit (kullanıcı metni ayrı blokta), araç sonuçları güvensiz veri, `refusal` → 422.
- **Uygulama:** kart verisi girmez (PCI dışı), derin bağlantı parametreleri doğrulanır, `Linking.openURL` yalnızca `https:/tel:/mailto:`, canlı konum sunucuda geçmiş tutmaz, acil kişiler cihazda.
- **CI/CD:** iş akışı izinleri en az ayrıcalıklı, `pull_request_target` yok, action'lar sürümlü, bot commit'leri döngüyü tetiklemez.
- **Veri:** KVKK/GDPR silme akışı üretim backend'inde (Supabase RLS + edge function) uygulanacak; çocuk modülünde yalnızca ad ve yaş bandı tutulur.

## Bulgu raporları

`/security` komutu ya da haftalık iş akışı `docs/security/YYYY-MM-DD.md` üretir.
