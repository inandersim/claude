<p align="center">
  <img src="assets/images/icon.png" width="120" alt="Zirve logosu" />
</p>

<h1 align="center">Zirve</h1>

<p align="center">
  Doğayı birlikte keşfet — outdoor macera sosyal ağı.<br/>
  Maceranı paylaş, yakınındaki doğrulanmış maceraperestlerle <b>ZMatch</b> ile eşleş, birlikte rota planla.
</p>

<p align="center">
  <a href="https://github.com/inandersim/claude/actions/workflows/ci.yml"><img src="https://github.com/inandersim/claude/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript" alt="TypeScript strict" />
</p>

---

## Özellikler

| Sekme | Neler var |
| --- | --- |
| **Ana Sayfa** | Macera akışı; irtifa, mesafe, sıcaklık, rüzgar, süre gibi teknik verilerle. Çift dokunuşla beğeni, yorum, macera türüne göre filtre. |
| **Keşfet** | Trend lokasyonlar, türe göre keşif, popüler rotalar (SVG rota önizlemesi), son maceralar ve birleşik arama (lokasyon / kullanıcı / rota). |
| **ZMatch** | Konuma göre yakındaki **doğrulanmış** maceraperestler; mesafe ve tür filtresi; eşleşme isteği gönder / kabul et / reddet; kabul edilen planlar ve birebir mesajlaşma. |
| **Canlı** | Şu an canlı yayınlar, yaklaşan yayınlar ve tekrarlar; yayın ekranında video oynatıcı (expo-video), izleyici sayısı, canlı sohbet ve beğeni; kamera önizlemeli **yayın başlatma** akışı. |
| **Profil** | Takipçi / takip, toplam macera ve km, güven skoru halkası, favori aktiviteler, paylaşım ızgarası, kısayollar (rezervasyonlar, market, tehlike haritası, bildirimler). Ayarlar: tema, dil, demo verilerini sıfırlama. |

**Güvenlik — Tehlike haritası:** Topluluk tarafından işaretlenen riskli bölgeler (kaya düşmesi, çığ, sel, vahşi hayvan, şiddetli hava, bozuk patika, kapalı bölge). Şiddet seviyesi, etki yarıçapı ve geçerlilik süresi; harita SDK'sı gerektirmeyen **radar görünümü**; "Ben de gördüm" onayı, bildiren için "çözüldü" işareti; yakındaki kullanıcılara otomatik uyarı bildirimi; Ana Sayfa ve lokasyon detayında yakın tehlike şeridi.

**Market:** Outdoor ekipman al / sat / kirala. Kategori ve durum filtreleri, arama, favoriler, ilan verme (fotoğraf, fiyat, uygun aktiviteler), ilan detayı, satıcıya mesaj, "satıldı" işareti, güvenli alışveriş uyarısı.

**Eğitmenler:** Sertifikalı rehber ve eğitmen profilleri (uzmanlık, sertifikalar, diller, uygun günler, puan ve değerlendirmeler, ders ücreti). Puan / mesafe / fiyata göre sıralama, ders talebi (rezervasyon) akışı, eğitmen tarafında onay / red, rezervasyonlarım ekranı, eğitmenin ilanları ve yaklaşan yayınları.

Ek olarak: karşılama + giriş + kayıt akışı, yeni macera paylaşma (fotoğraf seçici, teknik veri formu), kullanıcı profili, lokasyon detayı, eşleşme detayı, sohbet, bildirimler (13 bildirim türü, derin bağlantı ile ilgili ekrana gidiş), 404 ekranı.

## Teknoloji

- **Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict)**
- **Expo Router** — dosya tabanlı navigasyon, tip güvenli rotalar, derin bağlantı (`zirve://`, `https://zirve.app`), korumalı rota grupları (`Stack.Protected`)
- **TanStack Query** (sunucu durumu, iyimser güncellemeler) + **Zustand** (oturum, dil, toast)
- **Reanimated 4** + Gesture Handler (mikro animasyonlar, yüzen sekme çubuğu)
- **expo-image**, **expo-location**, **expo-image-picker**, **expo-haptics**, **expo-blur**, **expo-video**, **expo-camera**, **react-native-svg**
- **i18n-js** — Türkçe (varsayılan) ve İngilizce
- **Jest + jest-expo** birim testleri, **ESLint (expo + react-compiler kuralları)**, **Prettier**
- **GitHub Actions** CI: lint → typecheck → test

## Hızlı başlangıç

> Gereksinimler: Node 20+, npm 10+, telefonda **Expo Go** (veya Android Studio / Xcode).

```bash
git clone https://github.com/inandersim/claude.git zirve
cd zirve
npm install
npm start
```

- Telefonda **Expo Go** ile QR kodu okutun (iOS ve Android).
- `a` → Android emülatörü, `i` → iOS simülatörü, `w` → web.

### Diğer komutlar

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Jest
npm run format      # Prettier
node scripts/generate-icons.js   # uygulama ikonlarını yeniden üret
```

### Demo hesabı

Uygulama şu an **yerel mock veri sağlayıcısı** ile çalışır; ağ gerektirmez, veriler cihazda (AsyncStorage) kalıcıdır.
Giriş için herhangi bir e-posta ve 6+ karakterli şifre yeterlidir. Ayarlar → *Demo verilerini sıfırla* ile örnek veri yeniden yüklenir.

## Proje yapısı

```
src/
├── app/                 # Expo Router ekranları (dosya = rota)
│   ├── _layout.tsx      # Sağlayıcılar, fontlar, splash, oturum koruması
│   ├── (auth)/          # welcome · sign-in · sign-up
│   └── (app)/           # oturum gerektiren ekranlar
│       ├── (tabs)/      # index · explore · zmatch · live · profile
│       ├── post/        # [id] · new (modal)
│       ├── match/       # [id] · request (modal)
│       ├── live/        # [id] · start (tam ekran modal)
│       ├── hazards/     # index (radar + liste) · [id] · report (modal)
│       ├── market/      # index · [id] · new (modal)
│       ├── instructors/ # index · [id] · book (modal)
│       ├── user/[id]  chat/[id]  location/[id]  notifications  bookings  settings
├── components/
│   ├── ui/              # Tasarım sistemi: Text, Button, Chip, Avatar, Skeleton, …
│   └── AppTabBar.tsx    # Yüzen, animasyonlu özel sekme çubuğu
├── core/
│   ├── theme/           # Token'lar (renk, tipografi, boşluk) + ThemeProvider
│   ├── i18n/            # tr.ts · en.ts · tip güvenli t()
│   ├── query/           # QueryClient + merkezi query anahtarları
│   ├── hooks/           # useLocation, useToast, haptics
│   └── utils/           # format, time, clone
├── domain/              # Saf iş mantığı (UI'dan bağımsız, %100 test edilebilir)
│   ├── enums.ts         # AdventureType, DifficultyGrade, TrailCondition, MatchStatus (+ meta)
│   ├── types.ts         # User, Post, Comment, Route, ZMatch, Message, Notification, …
│   ├── geo.ts           # Haversine mesafe
│   ├── trust.ts         # Güven skoru
│   ├── matching.ts      # ZMatch aday algoritması
│   ├── hazards.ts       # Tehlike seçimi / sıralama, yön hesabı (radar)
│   ├── marketplace.ts   # İlan filtreleme, fiyat biçimi
│   └── instructors.ts   # Eğitmen sıralama, puan güncelleme
├── data/
│   ├── repositories/    # Veri sözleşmeleri (arayüzler)
│   └── mock/            # Bellek içi + AsyncStorage kalıcı demo sağlayıcı ve tohum veri
└── features/            # Özellik bazlı hook'lar ve bileşenler
    ├── auth · feed · explore · zmatch · notifications · profile · chat
    └── hazards · live · market · instructors
```

Ayrıntılar için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Gerçek API'ye geçiş

UI yalnızca `src/data/repositories` altındaki arayüzlere bağımlıdır. Gerçek bir backend için:

1. `src/data/remote/provider.ts` altında aynı `DataProvider` sözleşmesini uygulayın.
2. `.env` içinde `EXPO_PUBLIC_DATA_PROVIDER=remote` ve `EXPO_PUBLIC_API_URL` tanımlayın.
3. `src/data/index.ts` içindeki `getDataProvider()` seçim noktasını güncelleyin.

Ekranlar ve hook'lar değişmeden çalışmaya devam eder.

## Canlı yayın altyapısı

Uygulama yayın **ürün katmanını** (liste, yayın ekranı, sohbet, izleyici sayacı, başlatma / bitirme akışı, kamera önizlemesi) tamamen içerir. Gerçek video iletimi için bir sağlayıcı bağlanmalıdır — önerilen seçenekler **LiveKit** (WebRTC, açık kaynak) veya **Mux Live**. Entegrasyon noktası `LiveRepository.start()` (yayın anahtarı / oda oluşturma) ve `LiveStream.playbackUrl` (HLS adresi) alanıdır; demo modunda örnek bir HLS akışı oynatılır.

## Derleme (EAS)

```bash
npm i -g eas-cli
eas login
eas build --profile preview --platform android   # APK
eas build --profile production --platform all
```

Profil tanımları `eas.json` içindedir.

## Lisans

MIT — bkz. [LICENSE](LICENSE).
