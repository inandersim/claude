# Uydu bağlantısı ve uydu tabanlı SOS

Bu belge `satellite` modülünün mock uygulamasını ve gerçek entegrasyon yolunu anlatır.

## Mevcut durum (mock)

| Katman     | Dosya                              | Not                                                                                          |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Domain     | `src/domain/satellite.ts`          | Bağlantı seçimi, 160 karakter kodlama/sözlük, kuyruk politikası, SOS aşama makinesi, kapsama |
| Seed       | `src/data/mock/seed.satellite.ts`  | 1 inReach Mini 2 + 1 iPhone, 6 mesaj, 1 geçmiş (çözülmüş) SOS oturumu                        |
| Repository | `src/data/mock/repos/satellite.ts` | Bellek içi bağlantı simülasyonu, sakla-ilet kuyruğu, SOS oturumu + `sosEvents` + bildirim    |
| Hooks      | `src/features/satellite/hooks.ts`  | TanStack Query; bağlantı 5 sn'de bir yenilenir                                               |
| Ekranlar   | `src/app/(app)/satellite/*`        | `index` (cihaz/kapsama/check-in), `messages` (kuyruk + compose), `sos` (aşama takibi)        |

### Bağlantı katmanı

`chooseLink({ cellular, wifi, satellite })` sırasıyla hücresel (sinyal ≥ 15/100) → Wi-Fi → uydu
(görüşte ≥ 1 uydu) → yok döner. Mock repository bunu "Demo" SegmentedControl ile taklit eder; gerçek
uygulamada `expo-network` (hücresel/Wi-Fi) ve cihaz SDK'sının uydu görüş bilgisi bu yapıya beslenir.

### Mesaj biçimi

```
k:<C|T|S|L>;t:HHMM;g:<lat5>,<lon5>;m:<sıkıştırılmış metin>
```

- `k` tür kodu (checkin/text/sos/location), `t` yerel saat, `g` 5 ondalıklı konum (~1 m), `m` gövde.
- Gövde önce Türkçe karakterlerden arındırılır (GSM-7 uyumu), ardından `SAT_DICTIONARY` ile sık
  kelimeler 2–3 harfli kodlara çevrilir (`güvendeyim → gv`, `konum → kn`, …). `decodeSatMessage` bu
  işlemi tersine çevirir; sadeleştirilen harfler geri gelmez, sözlük kelimeleri Türkçe haliyle döner.
- Toplam uzunluk daima ≤ 160; gövde sığmazsa kırpılır. Bu sınır Iridium SBD (340 bayt MO) ve SMS
  segmenti ile uyumludur.
- SOS yükü ayrı biçimdedir: `SOS;n:<ad>;g:<lat>,<lon>;t:HHMM;kb:<kan grubu>;ct:<ilk acil kişi>`;
  öncelik sırasına göre sığan parçalar eklenir.

### Kuyruk

- `queuePolicy(message, link, attempts)`: 5 denemeden sonra `fail`; bağlantı yoksa `wait`; uyduda
  sos/checkin/location hemen gönderilir, serbest metin ilk turda bekler (öncelikli trafiğe yol verir)
  ve `flush` ile gider.
- `nextRetryDelayS`: 15 → 30 → 60 → 120 → 240 sn (üst sınır 300).
- `prioritize`: sos > checkin > location > text, aynı türde eski → yeni.
- Mock'ta gönderilen mesaj 1,5 sn sonra `delivered` olur; uyduda cihaz kotası düşer.

### SOS aşama makinesi

`idle → armed → sent → acknowledged → dispatched → resolved`. `startSos` oturumu doğrudan `sent`
aşamasında oluşturur, en yakın dağ kurtarma/ambulans merkezini `rescueCenterId` olarak bağlar,
`sosEvents` tablosuna kayıt ekler (ilk yardım ekranındaki "aktif SOS" ile tutarlı), canlı konum
paylaşımını `sos` moduna alır ve uygulama kullanıcısı olan acil kişilere `sos_alert` bildirimi
gönderir. "Sonraki aşama (demo)" butonu kurtarma merkezinin yanıtlarını taklit eder.

## Gerçek entegrasyon yolu

### Garmin inReach

- **Explore API / IPC Outbound**: Garmin'in kurumsal "Inbound/Outbound" (IPC) servisleri, hesap
  sahibinin mesajlarını ve konum izlerini sunucuya web-hook ile iletir; mesaj göndermek için
  Outbound REST uç noktası kullanılır. Uygulama doğrudan cihazla konuşmaz; sunucu tarafında
  IPC hesabı ve cihaz IMEI eşlemesi gerekir.
- **BLE**: inReach Mini 2 / Messenger, Garmin Messenger uygulaması dışındaki üçüncü taraflara BLE
  protokolünü açmaz. Cihaz eşleştirme ekranımızdaki IMEI alanı IPC tarafındaki "device" kaydı için
  saklanır.
- **Kota**: Aylık plan mesaj sayısı ve kota aşımı ücreti (`SAT_DEVICE_META.overQuotaPriceTry`)
  plan bilgisi API'den okunmalıdır; mock'taki değerler yaklaşıktır.

### ZOLEO

- ZOLEO, cihaz + uygulama + bulut modeliyle çalışır; iş ortakları için REST tabanlı mesajlaşma API'si
  ve SOS yönlendirmesi (GEOS/Overwatch) sağlar. Entegrasyon sunucu tarafında, kullanıcıya ait
  ZOLEO hesabı yetkilendirmesiyle yapılır.

### SPOT (Globalstar)

- SPOT cihazları tek yönlü (SPOT Gen4) veya iki yönlü (SPOT X) mesaj gönderir. "SPOT Shared Page"
  ve XML feed ile konum çekilebilir; iki yönlü mesajlaşma için Globalstar API anlaşması gerekir.
  Kapsama Globalstar ağı ile sınırlıdır (kutuplar ve bazı okyanus alanları dışında).

### Apple Emergency SOS via satellite / Messages via satellite

- **Emergency SOS via satellite** üçüncü taraf uygulamalara açık değildir; yalnızca sistem
  arayüzünden tetiklenir. Uygulama en fazla kullanıcıyı yönlendirebilir (`Linking` ile acil arama)
  ve konum bilgisini paylaşım kartına hazırlayabilir.
- **Messages via satellite (iOS 18)** yalnızca iMessage/SMS için çalışır; uygulama içinden mesaj
  gönderilemez. Bu nedenle `phone_satellite` cihaz türü mock'ta "kota yok, ücret yok" olarak
  modellenmiştir ve gerçek uygulamada yalnızca kullanıcıyı Mesajlar uygulamasına yönlendirir.
- Android tarafında Pixel "Satellite SOS" ve Skylo tabanlı operatör servisleri de benzer şekilde
  sisteme kapalıdır; `android.telephony.satellite` API'leri (Android 15+) operatör iznine bağlıdır.

### Iridium SBD (Short Burst Data)

- Kendi donanımı olan çözümler (RockBLOCK, 9603 modem) için Iridium SBD kullanılır: MO (cihazdan)
  ≤ 340 bayt, MT (cihaza) ≤ 270 bayt. `encodeSatMessage` çıktısı doğrudan MO yüküne yazılabilir.
  Sunucu tarafı, Iridium gateway'inden gelen e-posta/HTTP DirectIP mesajlarını alır.

### Starlink direct-to-cell / Starlink Mini

- Direct-to-cell servisi operatör anlaşmasıyla normal SMS/veri gibi görünür; uygulama için özel
  entegrasyon gerekmez, `chooseLink` bunu "cellular" olarak görür.
- Starlink Mini bir Wi-Fi erişim noktasıdır; uygulama için "wifi" bağlantısıdır. Kapsama
  `STARLINK_COUNTRIES` listesiyle ve kutup enlemleriyle sınırlandırılmıştır.

### BLE eşleştirme (uygulama tarafı)

- `react-native-ble-plx` ile tarama, cihaz türüne göre servis UUID filtresi, eşleştirme sonrası
  `SatDevice.imei`/`batteryPct`/`lastSeenAt` güncellemesi. Pil ve sinyal bilgileri BLE karakteristikleri
  üzerinden 30 sn'de bir okunur ve `useLinkStatus` sorgusuna beslenir.

### Sunucu tarafı kuyruk

- Mobil taraf yalnızca **yerel** kuyruğu tutar (bağlantı gelene kadar). Gerçek gönderim sunucuda:
  1. Mobil → API: `POST /sat/messages` (kodlanmış gövde, cihaz kimliği, öncelik).
  2. Sunucu kuyruğu (ör. SQS/Redis) `prioritize` ile aynı sırayı uygular, cihaz sağlayıcısına gönderir.
  3. Teslim raporu (Garmin IPC / SBD MT onayı) web-hook ile gelir → `status: delivered`.
  4. SOS için sunucu, kurtarma koordinasyon merkezi (IERCC/GEOS veya ulusal 112) ile konuşur ve
     aşama güncellemelerini (`acknowledged`, `dispatched`) push bildirimi olarak mobil tarafa iter.
- Çevrimdışıyken sunucuya ulaşılamayacağı için mobil kuyruk, bağlantı dönene kadar
  `nextRetryDelayS` ile yeniden dener; cihazın kendi sakla-ilet mekanizması (inReach) varsa mesaj
  BLE ile cihaza devredilir ve cihaz uydu görüşü bulunca gönderir.

## Bilinen sınırlar

- Kapsama hesabı kaba ülke sınır kutularına dayanır; gerçek uygulamada ters coğrafi kodlama kullanılmalı.
- Kan grubu alanı `User` tipinde yok; `buildSosPayload` isteğe bağlı `bloodType` alır, profil tarafı eklenince bağlanır.
- Mesaj maliyeti (₺) tahmini; gerçek fiyat sağlayıcı planından okunmalıdır.
