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

## Telefon doğrulama (OTP) — tehditler ve karşı önlemler

Ayrıntılı akış ve sağlayıcı karşılaştırması: `docs/AUTH.md`.

| Tehdit | Karşı önlem | Nerede |
| ------ | ----------- | ------ |
| **Numara sıralama (enumeration)** — saldırgan numara listesi tarayıp hangisinin kayıtlı olduğunu öğrenir | Kod isteme yanıtı numaranın kayıtlı olup olmadığını **söylemez**; her iki durumda da aynı `OtpChallenge` döner. Kayıt/giriş ayrımı ancak kod doğrulandıktan sonra (`needsProfile`) belli olur. | `src/data/mock/provider.ts`, `src/data/remote/repos/auth.ts` |
| **Numara sıralama — maliyet saldırısı** | Numara başına üstel bekleme (30→60→120→240→300 sn) ve saatlik kota (5 kod/saat). Sunucuda ayrıca `[auth.rate_limit] sms_sent` proje geneli tavan koyar; `otp_attempts` defteri IP + numara özeti ile denemeleri kaydeder. | `src/domain/phone.ts`, `supabase/config.toml`, `0035_phone_auth.sql` |
| **Kaba kuvvet (kod tahmini)** | 6 haneli koda 5 deneme hakkı; hak bitince numara 15 dk kilitlenir. Kilit sırasında doğru kod da kabul edilmez. 10⁶ ihtimalde 5 deneme → tahmin olasılığı 5×10⁻⁶. | `evaluateOtpVerify` |
| **Kod yeniden kullanımı** | Kod tek kullanımlıktır: doğrulanan kod `consumedAt` ile tüketilir, ikinci kullanım `consumed` hatası verir. | `evaluateOtpVerify` |
| **Eski kodun süresiz geçerliliği** | Kod ömrü 180 sn; süre dolduğunda ekran "yeni kod iste" der. GoTrue tarafında `GOTRUE_SMS_OTP_EXP` aynı değerde tutulur. | `OTP_TTL_SEC` |
| **Bilgi sızıntısı (yan kanal)** | Doğrulamada sıra: kilit → tüketildi → süre → biçim → eşitlik. Kilitli numarada kodun süresi hakkında bilgi verilmez. Hata metinleri kodun kaç hanesinin doğru olduğunu asla söylemez. | `evaluateOtpVerify` |
| **Numaranın herkese açık olması** | Numara `profiles` içinde **değil**, RLS ile yalnızca sahibine açık `user_phones` tablosunda durur (`profiles` SELECT politikası herkese açıktır). Ekranlarda numara hep maskeli gösterilir (`+90 5•• ••• •• 67`). | `0035_phone_auth.sql`, `maskPhone` |
| **Defterden numara sızması** | `otp_attempts` ham numara saklamaz; peppered SHA-256 özeti tutar ve hiçbir istemci rolü okuyamaz (RLS politikası yok, `service_role` dışı yetki iptal). | `0035_phone_auth.sql` |
| **Kod istemciye sızması** | Uzak sağlayıcıda `devCode` her zaman `null`; kod yalnızca SMS ile gider. Ekrandaki geliştirme rozeti yalnızca mock sağlayıcıda dolar (sunucu yapılandırılmamışken). | `src/data/remote/repos/auth.ts` |
| **Bot kaydı / otomatik kod isteme** | **Yapılacak:** Supabase panelinde CAPTCHA (hCaptcha ya da Cloudflare Turnstile) açılır, istemci `signInWithOtp` çağrısına `options.captchaToken` ekler. CAPTCHA olmadan hız sınırı tek başına ölçekli bir botu durdurmaz; sağlayıcı bağlanırken bu adım zorunludur. Ek olarak cihaz bütünlüğü (Play Integrity / App Attest) ikinci katman olarak değerlendirilir. | `docs/AUTH.md` § 6 |
| **SIM takas (SIM swap)** | Telefon tek başına yüksek riskli işlemler için yeterli sayılmaz: hesap silme, ödeme ve numara değişikliği ikinci bir doğrulama ister (e-posta ya da yeniden SMS + bekleme süresi). Numara değişikliği Supabase'in `phone_change` akışıyla yapılır. | üretim yol haritası |
| **SMS maliyet patlaması** | Saatlik SMS eşiği için bütçe alarmı; eşik aşılırsa yeni kayıt için CAPTCHA zorunlu hâle getirilir. | `docs/AUTH.md` § 6 |

Kurallar tek kaynaktadır (`src/domain/phone.ts`) ve `src/domain/__tests__/phone.test.ts`
ile testlidir; mock ve uzak sağlayıcı aynı politikayı uygular, dolayısıyla
sunucusuz geliştirmede de aynı sınırlar geçerlidir.

## Bulgu raporları

`/security` komutu ya da haftalık iş akışı `docs/security/YYYY-MM-DD.md` üretir.
