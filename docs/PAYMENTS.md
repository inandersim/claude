# Ödeme & emanet (escrow) mimarisi

Zirve'de konaklama ödemesi **misafir → platform → işletme** şeklinde akar. Misafirin parası giriş
yapılana kadar platformda tutulur ("Zirve Emaneti"), girişten 24 saat sonra işletmeye aktarılır.
Bu belge sağlayıcı seçimini, güvenlik kapsamını ve iade akışını özetler. Mock katmanı
(`src/data/mock/repos/inventory.ts`) aynı durum makinesini (`src/domain/inventory.ts`) çalıştırır.

## Ödeme durum makinesi

```
pending ─authorize→ authorized ─capture→ escrow ─release→ released
   │                    │                  │
   └─fail→ failed       └─refund→ refunded └─refund→ refunded
```

- **authorized**: kart bloke edildi (provizyon). Rezervasyon anında.
- **escrow**: tutar tahsil edildi, platform hesabında bekliyor.
- **released**: girişten 24 sa sonra (`releaseDue`) işletmenin alt üye işyeri hesabına aktarıldı.
- **refunded**: iptal politikasına göre tam/kısmi iade (`refundAmount`).

Geçersiz geçişler (`released → refund` gibi) `nextPaymentStatus` tarafından reddedilir; iade
sonrası işlemler "itiraz" (chargeback) sürecine girer, uygulama içinden değil.

## Sağlayıcı: iyzico Marketplace (birincil)

Türkiye'de TRY tahsilatı, yerli kart oranları ve BDDK uyumu için **iyzico Marketplace** modeli:

- Her işletme bir **alt üye işyeri** (sub-merchant) olarak kaydedilir: vergi no / TCKN, IBAN,
  iletişim. `HostProfile.payoutIban` bu kaydın karşılığıdır.
- Ödeme isteğinde **ödeme kırılımı** (`paymentItems`) gönderilir: işletme payı + platform komisyonu
  (`PLATFORM_FEE_PCT`, %8). iyzico bu tutarı kendi havuzunda tutar → escrow davranışı.
- **Onay (approval)** çağrısı girişten 24 sa sonra yapılır; onay gelene kadar para işletmeye geçmez.
  İptalde `refund` çağrısıyla kısmi/tam iade, alt üye işyerinin bakiyesinden düşülür.
- Ödemenin kendisi **3D Secure** ile başlatılır (`threedsInitialize`); callback URL'i uygulamaya
  deep link ile döner.

## Alternatif: Stripe Connect

Yurt dışı işletmeler ve çoklu para birimi için **Stripe Connect (Express hesaplar)**:

- `PaymentIntent` `capture_method: manual` → authorized; `capture` → escrow (platform bakiyesi);
  `Transfer` → released. `transfer_data.destination` + `application_fee_amount` komisyonu keser.
- Stripe Türkiye'de doğrudan yerel tahsilat sunmadığı için iyzico birincil kalır; `Payment.provider`
  alanı iki sağlayıcıyı da modeller.

## PCI kapsamı

- Kart verisi **uygulamaya girmez**. Ödeme formu sağlayıcının hosted/SDK bileşeninde açılır;
  uygulamaya yalnızca token ve sonuç döner. Bu sayede Zirve **SAQ A** kapsamında kalır.
- Kart numarası, CVV veya son kullanma tarihi hiçbir zaman loglanmaz, AsyncStorage'a yazılmaz,
  analitik olaylarına eklenmez.
- Uygulama, sağlayıcı callback'lerini imza doğrulamalı backend üzerinden alır; istemciden gelen
  "ödeme başarılı" bilgisine güvenilmez.

## İade ve itiraz akışı

1. Misafir iptal eder → `refundAmount(policy, checkIn, now, total)` önizleme gösterir
   (esnek / orta / katı politikalar, `docs` içindeki eşikler).
2. Onayda sağlayıcıya `refund` isteği; başarılı yanıt gelmeden `Payment.status` değişmez.
3. Kısmi iadede kalan tutar işletmeye aktarılır, komisyon oransal kesilir.
4. Kart sahibinin bankasından **itiraz** gelirse sağlayıcı webhook'u ile kayıt "disputed" olarak
   işaretlenir; rezervasyon kanıtları (giriş onayı, mesajlaşma) sağlayıcı paneline yüklenir.
5. Emanet süresi, itiraz penceresini kapsayacak biçimde işletme planına göre uzatılabilir.

## KVKK

- Ödeme verisi işleme amacı "sözleşmenin ifası"; açık rıza gerekmez ama aydınlatma metni gösterilir.
- Kimlik/adres doğrulama belgeleri (`HostVerificationLevel`) sağlayıcının KYC servisinde tutulur,
  Zirve yalnızca seviye bilgisini saklar.
- IBAN yalnızca maskelenmiş biçimde (`TR** **** 26`) istemciye döner; tam değer backend'de.
- Saklama süresi: mali kayıtlar 10 yıl (VUK), pazarlama amaçlı hiçbir ödeme verisi tutulmaz.
- Veri sahibi talebinde (silme) ödeme kayıtları anonimleştirilir, muhasebe kaydı korunur.

## Mock → gerçek geçiş kontrol listesi

- [ ] `InventoryRepository.book` → backend `POST /bookings` (3DS başlatma URL'si döner)
- [ ] `checkIn` → işletme onayı + 24 sa sonra zamanlanmış `approve`
- [ ] `cancel` → backend `refund`, sonuç webhook ile senkronize
- [ ] `verifyHost` → sağlayıcı KYC durumu webhook'u
- [ ] Sağlayıcı seçim ekranı yalnızca demo; gerçekte işletmenin ülkesine göre otomatik seçilir
