# ADR-0002 — Telefon numarası + SMS kodu ile kimlik doğrulama

**Durum:** kabul · **Tarih:** 2026-09 · **İlgili:** `docs/AUTH.md`, `supabase/migrations/0035_phone_auth.sql`

## Bağlam

Hedef kitle Türkiye ve komşu pazarlar. Bu pazarlarda telefon numarası, e-posta
adresinden daha güvenilir bir kimliktir: kullanıcıların çoğu e-postasını nadiren
kullanır, ancak numarasını ezbere bilir. Ayrıca sahte hesap üretmek telefonla
belirgin biçimde zorlaşır ve topluluk güvenliği (SOS, buluşma, konum paylaşımı)
doğrudan buna bağlıdır.

## Karar

Ana yol **telefon + tek kullanımlık SMS kodu (OTP)**. Supabase Auth telefon
sağlayıcısı kullanılır. E-posta/şifre yolu yalnızca sunucusuz geliştirme ve demo
için korunur ve karşılama ekranında ikincil bağlantıdır.

Deneme sayısı `otp_attempts` tablosunda tutulur; tabloda RLS açıktır ve
istemciye **açık `USING (false)` politikasıyla** tamamen kapalıdır — yalnızca
`SECURITY DEFINER` fonksiyonlar okur.

## Alternatifler

- **Yalnızca e-posta/şifre:** ucuz ama sahte hesap üretimi kolay, parola
  sıfırlama akışı ek yük.
- **Sosyal giriş (Google/Apple):** hızlı; ancak platform bağımlılığı ve
  Türkiye'de Apple ID/Google hesabı olmayan kullanıcı payı.
- **Kendi OTP altyapımız:** SMS sağlayıcı entegrasyonu, oran sınırı, kötüye
  kullanım savunması — hepsi bizim bakımımıza kalırdı.

## Gerekçe

Kimlik güveni, uygulamanın can güvenliği özelliklerinin (SOS, kurtarma, canlı
konum) ön koşulu. Supabase'in OTP'yi sağlaması, kritik ve kolay yanlış yapılan
bir parçayı (kod üretimi, süre, deneme sınırı) olgun bir uygulamaya devreder.

## Sonuçlar

- SMS maliyeti kullanıcı başına gerçek bir gider; oran sınırı ve kötüye kullanım
  savunması zorunlu.
- Numarasını değiştiren kullanıcı için hesap taşıma akışı gerekir (henüz yok —
  bilinen sınır).
- Geliştirmede kod konsola yazılır ve ekranda geliştirme rozeti gösterilir;
  bu davranış üretim yapılandırmasında kapalı olmalı.
