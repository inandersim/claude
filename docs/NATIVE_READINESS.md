# Native hazırlık — ilk derlemenin ortaya çıkardıkları

> Bu belge, uygulamanın **ilk kez** native olarak üretildiği gün yazıldı
> (`npx expo prebuild`). O güne kadar 39 modül ve 145 ekran yalnızca web'de ve
> Jest'te çalışmıştı; native yapılandırma hiç sınanmamıştı.

## Sonuç: prebuild ilk denemede geçti

39 modülün config plugin'leri çakışmadan çözüldü. Ama üretilen manifest,
yalnızca derleyince görülebilecek dört sorunu gösterdi. Üçü düzeltildi, biri
açık kaldı.

| Bulgu | Etki | Durum |
| --- | --- | --- |
| İz kaydı ekran kapanınca duruyordu | Bir yürüyüş uygulamasının **en temel işlevi** | ✅ düzeltildi |
| `SYSTEM_ALERT_WINDOW` sürüm manifestine sızıyordu | Play politikası: ayrı gerekçe ister, sık ret sebebi | ✅ kaldırıldı |
| `edgeToEdgeEnabled` artık geçersiz | Android 16 uyarısı | ✅ kaldırıldı |
| Bildirim (push) altyapısı yok | "Yakındakilere uyarı" vaadi karşılanamıyor | ⛔ açık |

## 1. İz kaydı ekran kapanınca duruyordu

`Location.watchPositionAsync` yalnızca uygulama önplandayken çalışır. Yürüyüşçü
telefonu cebine koyunca kayıt sessizce duruyordu — hata mesajı yok, kullanıcı
saatler sonra yarım bir iz buluyordu.

Üstelik noktalar yalnızca React durumundaydı: Android uygulamayı bellekten
atınca kaydın tamamı kayboluyordu.

**Çözüm** üç parça:

| Dosya | İş |
| --- | --- |
| `recorder-background.ts` | `startLocationUpdatesAsync` + `expo-task-manager` görevi; kalıcı bildirimli ön plan servisi |
| `recorder-buffer.ts` | Dayanıklı nokta tamponu (JSON Lines), birleştirme ve ayıklama — **saf, test edilebilir** |
| `recorder-store.ts` | Tamponun `expo-file-system` uygulaması |

Görev **ayrı bir JS bağlamında** çalışır ve React durumuna yazamaz; noktaları
diske ekler. Uygulama öne döndüğünde (`AppState`) tampon boşaltılır ve mevcut
dizilime katılır.

### Neden ön plan servisi, arka plan izni değil

Android'de iki yol var:

1. `ACCESS_BACKGROUND_LOCATION` — Play tarafında **ayrı politika incelemesi**:
   tanıtım videosu, gerekçe formu, uzun onay süresi.
2. Kalıcı bildirimli **ön plan servisi** — kullanıcı kaydın açık olduğunu her an
   görür, bildirime dokununca uygulamaya döner.

İkincisi seçildi. Yalnızca daha kolay olduğu için değil: gizli konum takibi
yapmayan bir uygulama, kullanıcıya takibi **görünür** kılmalı.

Bunun bir tuzağı var ve koda yorum olarak yazıldı: `ACCESS_BACKGROUND_LOCATION`
manifestte tanımlı olmadığı için Android'de `requestBackgroundPermissionsAsync`
**reddedilmiş** döner. Çağırmak özelliği sessizce kapatırdı. Bu yüzden izin
isteği yalnızca iOS'ta yapılıyor (`ayriIzinGerekir`), iOS'ta da
`UIBackgroundModes: ['location']` eklendi.

### Çift nokta sorunu

Devir anında ön plan dinleyicisi ile arka plan görevi kısa süre **birlikte**
çalışır; aynı fiziksel ölçüm ikisine de düşer. Ölçümün zaman damgası işletim
sisteminden geldiği için ikisinde de aynıdır — ayıklama tam zaman damgası
eşitliğine bakıyor.

Mesafeye göre ayıklama bilerek **yapılmıyor**: yerinde duran yürüyüşçünün
noktalarını silmek izin şeklini değiştirirdi (mola süresi kaybolur).

### Ne doğrulandı, ne doğrulanmadı

- ✅ Saf mantık: 19 test (kodlama gidiş-dönüşü, bozuk satır dayanıklılığı,
  birleştirme, devir çakışması, platform izin kararı).
- ✅ Manifest: `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` üretiliyor.
- ⛔ **Gerçek cihazda sınanmadı.** Bu ortamda Android SDK yok. Ekran kapalıyken
  noktaların gerçekten geldiği, kalıcı bildirimin göründüğü ve pil tüketimi bir
  geliştirme derlemesiyle ölçülmeli. İlk fiziksel testte bakılacaklar:
  1. Kayıt başlat → ekranı kapat → 15 dk yürü → aç. Nokta sayısı sürekli mi?
  2. Bildirim görünüyor mu, dokununca uygulamaya dönüyor mu?
  3. Uygulamayı görevlerden kaydır (kill) → tampon dosyası duruyor mu?
  4. Pil: 1 saatlik kayıtta yüzde kaç?

## 2. `SYSTEM_ALERT_WINDOW`

"Diğer uygulamaların üzerinde göster" izni bir bağımlılıktan geliyor ve **sürüm**
manifestine sızıyordu (hata ayıklama manifestinde olması normaldir). Uygulamanın
hiçbir yerinde kullanılmıyor. `android.blockedPermissions` ile kaldırıldı;
üretilen manifestte artık `tools:node="remove"` taşıyor.

## 3. Hâlâ açık: bildirim altyapısı yok

`expo-notifications` bağımlılıklarda yok. `push-fanout` edge fonksiyonu var ama
istemcisi yok. Bunun ürün sonucu şu:

- Yakındaki tehlike uyarısı, canlı konum paylaşımı daveti, SOS bildirimi
  **uygulama kapalıyken kullanıcıya ulaşamaz**.
- Pazarlama metinlerindeki "yakındakilere uyarı" bugün karşılanamıyor.

Bu bir lansman kararı: ya bildirim eklenir ya da o vaat metinlerden çıkarılır.
İkisinden birini yapmadan yayına çıkmak, tutulamayacak bir söz vermek olur.

## Native projeler depoda tutulmuyor

`android/` ve `ios/` `.gitignore`'a alındı. Kaynak `app.json` + config
plugin'ler; native klasör her derlemede `npx expo prebuild` ile üretilir
(Expo CNG). Elle düzenlenen bir native dosya, bir sonraki prebuild'de sessizce
kaybolurdu.
