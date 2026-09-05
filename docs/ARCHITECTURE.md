# Mimari

Zirve, **özellik odaklı katmanlı mimari** ile yazılmıştır. Bağımlılık yönü her zaman aşağı doğrudur:

```
app (ekranlar) → features (hook + bileşen) → data (repository) → domain (saf mantık)
                              ↘ components/ui ↘ core (tema, i18n, utils)
```

## Katmanlar

### `domain/` — Saf iş mantığı

React'a ya da Expo'ya bağımlı değildir; Node'da doğrudan test edilir.

- **Option set'ler** (`enums.ts`): Macera türü, zorluk, rota durumu ve eşleşme durumu sabit listeleri; her biri ikon, renk ve çeviri anahtarı meta verisiyle gelir. UI bu meta veriyi doğrudan kullanır, böylece renk/ikon tutarlılığı tek yerden yönetilir.
- **Tipler** (`types.ts`): Bubble'daki veri tiplerinin bire bir karşılığı — `User`, `Post`, `Comment`, `Follow`, `Route`, `ZMatch`, `Message`, `Notification`, ek olarak `TrendingLocation`. `FeedPost`, `ZMatchWithUsers` gibi "zenginleştirilmiş" görünüm tipleri UI'ın ihtiyaç duyduğu ilişkili veriyi taşır.
- **Mantık**: `geo.ts` (Haversine), `trust.ts` (güven skoru: doğrulanmış hesap + doğrulanmış gönderi oranı + kabul edilen eşleşmeler + topluluk), `matching.ts` (ZMatch aday üretimi ve sıralaması).

### `data/` — Veri erişimi

`repositories/index.ts` tüm sözleşmeleri tanımlar (`AuthRepository`, `FeedRepository`, `MatchRepository`, …). `mock/` bu sözleşmeleri bellek içi tablolar üzerinde uygular ve AsyncStorage'a kalıcı yazar.

Tasarım kararları:

- **Sınırda kopyalama**: Repository'ler sonuçları derin kopya olarak döner; UI bellek içi kayıtları mutasyona uğratamaz.
- **Gecikme simülasyonu**: ~260 ms yapay gecikme, yükleme durumlarının (skeleton) gerçekçi test edilmesini sağlar. Testlerde 0 ms.
- **Yan etkiler tek yerde**: Beğeni, yorum, takip, eşleşme isteği/yanıtı ve mesaj gönderimi ilgili bildirimi otomatik üretir.
- **`status` her zaman `pending`**: Orijinal Bubble uygulamasındaki hata (yeni eşleşme kaydının `status` alanına bekleyen istek _sayısının_ yazılması) burada düzeltilmiştir; `MatchRepository.request` yeni kaydı daima `'pending'` ile oluşturur ve bu davranış testle korunur.

### `features/` — Özellik modülleri

Her özellik kendi `hooks.ts` (TanStack Query) ve `components/` klasörüne sahiptir. Hook'lar merkezi `queryKeys` ile önbelleği yönetir; beğeni, takip, okundu işaretleme ve mesaj gönderimi **iyimser güncelleme** kullanır.

### `components/ui/` — Tasarım sistemi

Tema token'larından (renk, tipografi, boşluk, yarıçap) beslenen, erişilebilirlik özellikleri (`accessibilityRole`, `accessibilityState`) tanımlı yeniden kullanılabilir bileşenler. Tüm dokunulabilir öğeler `Tappable` üzerinden geçer: basınca yay animasyonu ile küçülür ve dokunsal geri bildirim verir.

### `app/` — Navigasyon

Expo Router ile dosya tabanlı yapı:

- `_layout.tsx`: Fontlar ve oturum yüklenene kadar splash ekranı tutulur; `Stack.Protected` ile `(auth)` ve `(app)` grupları oturum durumuna göre korunur — yönlendirme mantığı ekranlara sızmaz.
- `(app)/(tabs)`: Özel `AppTabBar` (yüzen, bulanık, animasyonlu, bildirim rozetli).
- Modal ekranlar (`post/new`, `match/request`) `presentation: 'modal'` ile açılır.
- `experiments.typedRoutes` açık: `router.push({ pathname: '/post/[id]', params: { id } })` çağrıları derleme zamanında doğrulanır.
- Derin bağlantı: `zirve://post/p1`, `https://zirve.app/user/u_elif` gibi adresler doğrudan ilgili ekrana açılır.

## Yeni özellik modülleri

| Modül                | Domain                                                   | Repository             | Öne çıkanlar                                                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tehlikeli yerler** | `HazardZone`, `selectHazards`, `bearingDeg`              | `HazardRepository`     | Şiddet → mesafe → tarih sıralaması, süre dolumu, onay tekilliği, yalnızca bildirenin çözüm yetkisi, 25 km içindeki kullanıcılara otomatik `hazard_alert` bildirimi. Radar görünümü SVG ile çizilir; `react-native-maps` eklenirse aynı veri doğrudan kullanılabilir. |
| **Canlı yayın**      | `LiveStream`, `StreamMessage`                            | `LiveRepository`       | Canlı → planlı → tekrar sıralaması, yayın başlatınca takipçilere `stream_live`, izleyici katıl/ayrıl sayacı, yayın bitince tekrar adresi. Oynatıcı `expo-video`, önizleme `expo-camera`.                                                                             |
| **Market**           | `Listing`, `filterListings`, `formatPriceTry`            | `MarketRepository`     | Satılmış gizleme, kategori / satıcı / metin filtresi, favori tekilliği, yalnızca satıcının "satıldı" yetkisi.                                                                                                                                                        |
| **Eğitmenler**       | `Instructor`, `Booking`, `rankInstructors`, `nextRating` | `InstructorRepository` | Puan / mesafe / fiyat sıralaması, rezervasyon yaşam döngüsü (`pending → confirmed                                                                                                                                                                                    | declined`) ve iki yönlü bildirimler, eğitmenin ilanları ve yayınlarıyla çapraz bağlantı. |

## v1.1 modülleri

| Modül           | Domain                                            | Repository            | Notlar                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kütüphane**   | `LibraryPlace`, `searchLibrary`                   | `LibraryRepository`   | Veri hattı ile aynı şema; `source`, `license`, `attribution` her kayıtta. Uygulama içinde `expo-sqlite` ile çevrimdışı arama yol haritasında.                                                             |
| **Canlı konum** | `LocationShare`, `visibleShares`                  | `PresenceRepository`  | Görünürlük: karşılıklı takip / kabul edilmiş eşleşme / SOS (herkes). 15 dk güncellenmeyen paylaşım "güncel değil". Cihazda `expo-location watchPosition`; üretimde arka plan görevi + WebSocket/Realtime. |
| **Anlar**       | `Story`, `StoryGroup`                             | `StoryRepository`     | 24 saat yaşam süresi, görüntülenme tekilliği, takipçilere `story_posted`.                                                                                                                                 |
| **İşletmeler**  | `Business`, `StayBooking`, `stayTotal`            | `BusinessRepository`  | Öne çıkan → puan sıralaması; rezervasyon = gece × fiyat + %5 misafir ücreti; işletme sahibine `stay_request`.                                                                                             |
| **Planlar**     | `PLAN_SPECS`, `splitPayment`                      | `BillingRepository`   | Komisyon: ücretsiz %15, Pro Guide %5, Business %10. Üretimde RevenueCat entitlement → `User.plan`.                                                                                                        |
| **Acil durum**  | `EmergencyCenter`, `nearestCenters`, `sosMessage` | `EmergencyRepository` | SOS: olay kaydı + SOS modunda konum paylaşımı + acil kişilere `sos_alert`; rehber içeriği `data/content/firstAid.ts` (TR/EN, çevrimdışı).                                                                 |

## v1.2 modülleri

Her modül kendi dosyalarında yaşar; ortak dosyalar (`enums.ts`, `types.ts`, `repositories/index.ts`, `database.ts`, `provider.ts`, `keys.ts`, `_layout.tsx`) yalnızca sözleşmeyi taşır. Mock repository'ler `data/mock/repos/<modül>.ts` içinde `create<X>Repository(ctx: MockContext)` fabrikalarıdır; `MockContext` (`data/mock/context.ts`) veritabanı, gecikme, kullanıcı doğrulama ve bildirim yardımcılarını sağlar.

| Modül         | Domain                                                                                 | Repository            | Notlar                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zirve AI**  | `classifyIntent`, `answerLocally`, `buildTripPlan`                                     | `AiRepository`        | Yerel bilgi tabanı (kütüphane, tehlike, acil merkez, rehberler) → çevrimdışı yanıt; `EXPO_PUBLIC_AI_GATEWAY_URL` varsa `RemoteAiClient` (SSE) → `server/ai-gateway` (Claude, araçlar). |
| **Haritalar** | `planRoute` (A\*), `routeStats` (Tobler), `toGpx`/`fromGpx`, `simplifyPoints`          | `MapsRepository`      | Trail grafı `TrailGraph`; harita paketleri PMTiles (indirme simülasyonu); üretimde MapLibre + Protomaps (`docs/MAPS.md`).                                                              |
| **Tırmanış**  | `convertGrade`, `verificationOf`, `canConfirm`, `pyramidOf`                            | `ClimbingRepository`  | Ortak zorluk puanı (10–66) ile sistemler arası dönüşüm; doğrulama: 3 bağımsız onay → community, moderatör/kulüp → verified (`docs/CLIMBING.md`).                                       |
| **Uydu**      | `chooseLink`, `encodeSatMessage`, `queuePolicy`, `advanceSosStage`                     | `SatelliteRepository` | 160 karakter sıkıştırma sözlüğü, sakla-ilet kuyruğu, SOS aşama makinesi; gerçek entegrasyon yolu `docs/SATELLITE.md`.                                                                  |
| **Envanter**  | `buildQuote`, `availabilityFor`, `refundAmount`, `nextPaymentStatus`, `hostTrustScore` | `InventoryRepository` | Birim/blok takvimi, emanet ödeme makinesi, iptal politikaları, doğrulanmış yorum; iyzico/Stripe planı `docs/PAYMENTS.md`.                                                              |
| **Kulüpler**  | `filterClubs`, `rankClubs`, `canRsvp`, `isStudentEmail`                                | `ClubRepository`      | Bekleyen üyelik talebi `joinedAt: ''` ile işaretlenir; doğrulanmış kulüpte katılım talep olur.                                                                                         |
| **Eğlence**   | `levelFor`, `xpFor`, `evaluateBadges`, `buildLeaderboard`, `pickQuiz`, `spinRoulette`  | `FunRepository`       | Günün yarışması deterministik (gün numarası tohumlu); rozet kazanımı quiz/görev sonrası değerlendirilir.                                                                               |

**Modül i18n:** Her modülün çevirileri `core/i18n/modules/<modül>.ts` içinde (`tr` kaynak, `en` zorunlu, `XI18nShape` tipi) ve diğer 7 dil `core/i18n/modules/locales/<dil>/<modül>.ts` dosyalarında; `localeSet()` eksik dili İngilizceye düşürür. `tr.ts`/`en.ts` yalnızca `ai: aiI18n.tr` gibi bağlar.

**i18n notu:** `useT()` dile bağlı bir `t` döndürür; React Compiler modül düzeyindeki saf fonksiyon çağrılarını önbelleğe aldığından, bileşenlerde her zaman `useT()` kullanılmalı, `t` doğrudan import edilmemelidir.

## Tema

`core/theme/tokens.ts` açık ve koyu paletleri, tipografi ölçeğini (Manrope) ve boşluk/yarıçap ölçeğini tanımlar. `ThemeProvider` kullanıcı tercihini (sistem/açık/koyu) kalıcı tutar. Bileşenler renkleri yalnızca `useTheme().colors` üzerinden alır.

## Uluslararasılaştırma

`core/i18n` altında `tr.ts` kaynak sözlük, `en.ts` aynı tipe uymak zorundadır (`Translations`). `t('home.altitude')` anahtarları derleme zamanında kontrol edilir; dil değişimi Zustand store üzerinden tüm ekranları yeniden çizer.

## Test stratejisi

- **Birim**: `domain/` ve `core/utils/` fonksiyonları.
- **Entegrasyon**: `data/mock/provider` — akış, beğeni, yorum, eşleşme yaşam döngüsü, bildirim ve mesaj akışları gerçek repository çağrılarıyla test edilir.
- CI her push'ta `lint → typecheck → test` çalıştırır.

## Gelecek adımlar

- `data/remote` sağlayıcısı (REST/GraphQL) ve gerçek kimlik doğrulama
- Harita SDK'sı ile rota görüntüleme (`react-native-maps` / MapLibre)
- Push bildirimleri (`expo-notifications`)
- Görsel yükleme ve CDN
- E2E testler (Maestro)
