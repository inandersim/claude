# Zirtan — Kimlik doğrulama: telefon numarası + SMS kodu (OTP)

Ana kayıt/giriş yolu **telefon numarası + tek kullanımlık SMS kodu**dur.
E-posta/şifre yolu yalnızca sunucusuz geliştirme ve demo için korunur
(`/sign-in`, `/sign-up`); karşılama ekranında ikincil bağlantıdır.

## 1. Akış

```
(auth)/welcome  ── "Telefonla devam et" ──▶ (auth)/phone
                                              │  ülke kodu + numara
                                              │  requestOtp(phone)
                                              ▼
                                          (auth)/verify
                                              │  6 haneli kod, geri sayım
                                              │  verifyOtp(phone, code)
                                    ┌─────────┴──────────┐
                    needsProfile:false          needsProfile:true
                            │                           │
                            ▼                           ▼
                    oturum açıldı (app)      (auth)/complete-profile
                                                        │ ad + kullanıcı adı
                                                        │ completeProfile(...)
                                                        ▼
                                                 oturum açıldı (app)
```

| Katman         | Dosya                                                       |
| -------------- | ----------------------------------------------------------- |
| Kurallar (saf) | `src/domain/phone.ts` + `src/domain/__tests__/phone.test.ts` |
| Sözleşme       | `PhoneAuthRepository` — `src/data/repositories/index.ts`     |
| Mock sağlayıcı | `src/data/mock/otp.ts`, `src/data/mock/provider.ts`          |
| Uzak sağlayıcı | `src/data/remote/repos/auth.ts` (Supabase Auth)              |
| Oturum         | `src/features/auth/session.store.ts`                        |
| Akış durumu    | `src/features/auth/phoneAuth.store.ts`                      |
| Ekranlar       | `src/app/(auth)/phone.tsx`, `verify.tsx`, `complete-profile.tsx` |
| Şema           | `supabase/migrations/0035_phone_auth.sql`                    |
| Yapılandırma   | `supabase/config.toml` → `[auth.sms]`                        |

## 2. Numara kuralları

`src/domain/phone.ts` saf fonksiyonlardan oluşur; ekran, mock ve uzak sağlayıcı
aynı kuralları kullanır.

- **E.164 normalizasyonu:** `0532 111 22 67`, `532 111 22 67`, `905321112267`,
  `0090 532…` ve `+90 532…` girişlerinin hepsi `+905321112267` olur.
- **Ülke tespiti:** en uzun eşleşen arama kodu kazanır (`+995` → Gürcistan,
  `+9` değil). Listede 24 ülke var; **listede olmayan** bir `+` numarası da
  E.164 uzunluk kuralıyla (8–15 hane) kabul edilir, yalnızca mobil öneki
  denetlenemez.
- **Doğrulama:** NSN uzunluğu + mobil öneki. Türkiye'de `0212…` sabit hattı
  `notMobile` ile reddedilir, kullanıcı bunu ekranda gerekçesiyle görür.
- **Maskeleme:** `maskPhone('+905321112267')` → `+90 5•• ••• •• 67`. İlk hane ve
  son iki hane açık kalır; doğrulama ekranı numarayı hep maskeli gösterir.

## 3. Kod ve hız sınırı politikası

Tümü `src/domain/phone.ts` içinde sabit olarak durur ve testlidir:

| Kural                            | Değer                              | Sabit                       |
| -------------------------------- | ---------------------------------- | --------------------------- |
| Kod uzunluğu                     | 6 hane                             | `OTP_LENGTH`                |
| Kod ömrü                         | 180 sn                             | `OTP_TTL_SEC`               |
| Tek kullanımlık                  | evet (doğrulanan kod tüketilir)    | `evaluateOtpVerify`         |
| Yanlış deneme hakkı              | 5                                  | `OTP_MAX_VERIFY_ATTEMPTS`   |
| Hak bitince kilit                | 900 sn (15 dk)                     | `OTP_LOCK_SEC`              |
| Yeniden gönderme beklemesi       | 30 → 60 → 120 → 240 → 300 sn       | `OTP_RESEND_DELAYS_SEC`     |
| Pencere başına kod               | 5                                  | `OTP_MAX_SENDS_PER_WINDOW`  |
| Pencere                          | 3600 sn                            | `OTP_SEND_WINDOW_SEC`       |

Davranış:

- İlk kod anında gider; sonraki her kod için bekleme **üstel** artar. Ekran
  "Yeniden gönder (00:30)" biçiminde geri sayar, düğme o süre boyunca kapalıdır.
- Saatlik kota dolarsa `quota` hatası döner ve pencerenin bitişine kalan süre
  gösterilir. Pencere dolduğunda sayaç sıfırlanır.
- Yanlış kodda kalan hak ekranda yazar ("3 deneme hakkın kaldı"). Hak bitince
  numara 15 dakika kilitlenir; kilit sırasında **doğru kod da** kabul edilmez ve
  kodun süresi hakkında bilgi sızdırılmaz (önce kilit denetlenir).

Mock sağlayıcıda bu kuralların tamamı gerçekten uygulanır — sunucusuz
geliştirmede de akış gerçek gibi davranır. Kod **üretilir** (sabit `123456`
değildir), konsola yazılır (`[Zirtan OTP] +90… → 123456`) ve doğrulama
ekranında kesikli çerçeveli **geliştirme rozetinde** gösterilir. Uzak
sağlayıcıda `devCode` her zaman `null`'dır.

## 4. Sunucu tarafı

Supabase Auth telefon OTP'sini kendi yürütür: `signInWithOtp({ phone })` kodu
üretip SMS'i gönderir, `verifyOtp({ phone, token, type: 'sms' })` doğrular ve
oturum açar. Kod hiçbir zaman istemciye dönmez.

`supabase/migrations/0035_phone_auth.sql` uygulama tarafını tamamlar:

- **`user_phones`** — doğrulanmış numara ↔ kullanıcı (1-1), `phone` **tekil**
  indeksli, E.164 CHECK'li. RLS: yalnızca sahibi okur; yazma yok (satırı
  `handle_new_auth_user` açar).
  **Neden `profiles.phone` değil:** `profiles` üzerindeki SELECT politikası
  herkese açıktır (`profiles_read_all`) ve PostgREST `select=*` kullandığı için
  kolon düzeyinde yetki kısıtı istemciyi kırar. Numara kişisel veridir; ayrı
  tabloda tutulup yalnızca sahibine açılır. Benzersizlik iki katmanlıdır:
  GoTrue'daki `auth.users.phone` + buradaki tekil indeks.
- **`profiles.profile_completed`** — `false` ise ad/kullanıcı adı adımı bekliyor
  demektir; `verifyOtp` bu alana bakıp `needsProfile` döner. Varsayılan `true`
  olduğu için mevcut kayıtlar ve demo tohumu etkilenmez.
- **`profiles.phone_verified`** — numarası doğrulanmış hesap rozeti.
- **`is_username_available(candidate)`** — `SECURITY DEFINER` RPC. Kayıt
  ekranındaki canlı denetim; aday adın varlığı dışında bilgi sızdırmaz.
- **`otp_attempts`** — gönderim/doğrulama defteri. Ham numara saklanmaz,
  yalnızca peppered SHA-256 özeti + IP tutulur. RLS politikası yoktur; sadece
  `service_role` erişir. `prune_otp_attempts()` 24 saatten eskisini siler.

`handle_new_auth_user` telefonla açılan kayıtları da karşılar: kullanıcı adı
e-posta yoksa numaradan türetilir (`gezgin2267`), kayıt `profile_completed =
false` ile açılır ve `user_phones` satırı yazılır.

### `config.toml` özeti

```toml
[auth.sms]
enable_signup = true
enable_confirmations = true
template = "Zirtan dogrulama kodun: {{ .Code }}. Kodu kimseyle paylasma."
max_frequency = "30s"

[auth.sms.test_otp]        # YEREL geliştirme; üretimde boş
"+905321112267" = "123456"

[auth.rate_limit]
sms_sent = 30              # saatte proje geneli SMS
token_verifications = 30   # 5 dakikada IP başına doğrulama
```

Kod uzunluğu ve ömrü GoTrue ortam değişkenleriyle ayarlanır ve istemcideki
sabitlerle **birebir aynı** olmalıdır:

```
GOTRUE_SMS_OTP_LENGTH = 6     # OTP_LENGTH
GOTRUE_SMS_OTP_EXP    = 180   # OTP_TTL_SEC
```

## 5. SMS sağlayıcısı seçimi

Fiyatlar Eylül 2026 itibarıyla **liste fiyatlarıdır**; sözleşmeli hacimde
düşer, operatör ve ülke başına değişir. Kesin rakam için teklif alınmalıdır.

| Sağlayıcı              | TR'ye SMS (yaklaşık)   | Yurt dışı | GoTrue desteği           | Notlar |
| ---------------------- | ---------------------- | --------- | ------------------------ | ------ |
| **Twilio Verify**      | ~0,05 USD / doğrulama  | çok geniş | Yerleşik (`[auth.sms.twilio]`) | Kurulumu en kolay yol. Doğrulama başına ücret; teslimat ve yeniden deneme yönetimi dâhil. Türkiye trafiğinde en pahalı seçenek. |
| **Twilio Programmable SMS** | ~0,04 USD / SMS   | çok geniş | Yerleşik                 | Segment başına ücret; 160 karakteri aşan metin ikiye katlar. |
| **Vonage (Nexmo)**     | ~0,035 USD / SMS       | geniş     | Yerleşik (`[auth.sms.vonage]`) | Twilio'ya yakın, biraz ucuz. Alfanümerik gönderici adı TR'de kayıt ister. |
| **MessageBird**        | ~0,03 USD / SMS        | geniş     | Yerleşik                 | Avrupa merkezli; KVKK/GDPR açısından veri işleme sözleşmesi kolay. |
| **Netgsm** (TR)        | ~0,006–0,010 USD / SMS | sınırlı   | **Yok** → `send_sms` kancası | Türkiye trafiğinde 4–8 kat ucuz. IYS (İleti Yönetim Sistemi) ve marka başlığı başvurusu gerekir. |
| **İletimerkezi** (TR)  | ~0,006–0,010 USD / SMS | sınırlı   | **Yok** → `send_sms` kancası | Netgsm'e benzer fiyat; API'si sade, TR operatörlerinde teslimat oranı yüksek. |

**Öneri:** Türkiye ağırlıklı trafik için birincil sağlayıcı **Netgsm ya da
İletimerkezi**, yurt dışı numaralar için yedek olarak **Twilio**. Yönlendirme,
`[auth.hook.send_sms]` kancasıyla çağrılan tek bir Edge Function içinde numaranın
ülke koduna bakılarak yapılır:

```
+90 ile başlıyorsa  → Netgsm / İletimerkezi
aksi hâlde          → Twilio
```

Bu kancayla GoTrue kodu üretmeye ve doğrulamaya devam eder; yalnızca **taşıma**
değişir, güvenlik modeli aynı kalır.

### Maliyet kabası

100 000 kayıt/ay, kullanıcı başına ortalama 1,3 SMS (yeniden gönderimler dâhil)
→ ~130 000 SMS:

| Sağlayıcı        | Aylık (yaklaşık) |
| ---------------- | ---------------- |
| Twilio Verify    | 6 500 USD        |
| Vonage           | 4 550 USD        |
| Netgsm (TR)      | 780–1 300 USD    |

Yerel sağlayıcıya geçmek büyük hacimde en belirgin tasarruf kalemidir; bu yüzden
mimari **baştan** kanca üzerinden kurgulanmıştır.

## 6. Gerçek SMS sağlayıcısı bağlanınca yapılacaklar

1. `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` tanımla —
   uygulama mock'tan uzak sağlayıcıya kendiliğinden geçer (`src/data/index.ts`).
2. Supabase panelinde **Authentication → Providers → Phone**'u aç; sağlayıcıyı
   ve `SMS OTP length = 6`, `SMS OTP expiry = 180` değerlerini gir.
3. `supabase/migrations/0035_phone_auth.sql` migration'ını uygula.
4. Yerel sağlayıcı kullanılacaksa `send-sms` Edge Function'ını yaz ve
   `config.toml` içindeki `[auth.hook.send_sms]` bloğunu aç. Sağlayıcı
   anahtarları yalnızca fonksiyon ortamında (`supabase secrets set`) durur.
5. Marka/başlık (sender ID) ve **IYS** kaydını tamamla — Türkiye'de ticari
   olmayan işlem SMS'i için de gönderici başlığı kaydı gerekir.
6. `[auth.sms.test_otp]` bloğunu **boşalt** (üretimde sabit kod olmamalı).
7. Bot koruması: Supabase panelinde CAPTCHA'yı (hCaptcha/Turnstile) aç ve
   istemciye jeton üretimini ekle — bkz. `docs/SECURITY.md` § Telefon doğrulama.
8. `otp_attempts` defterini besleyecek `send_sms`/`verify` kancasına yazma
   ekle ve `prune_otp_attempts()` için günlük bir zamanlayıcı kur.
9. Bütçe alarmı kur: saatlik SMS sayısı eşiği aşarsa uyarı (numara sıralama
   saldırısının ilk belirtisi maliyet artışıdır).

## 7. Sunucusuz geliştirme

Supabase değişkenleri yoksa mock sağlayıcı devrededir:

- Kod gerçekten üretilir, konsola yazılır ve doğrulama ekranında geliştirme
  rozetinde görünür.
- Hız sınırı, kod ömrü, tek kullanımlık kod ve kilit **gerçekten** uygulanır.
- `+90 532 111 22 67` demo hesabına (`deniz.kaya`) bağlıdır; başka her numara
  yeni kayıt olarak açılır ve profil adımı ister.
- E-posta/şifre demo girişi (`/sign-in`) yerinde durur.
