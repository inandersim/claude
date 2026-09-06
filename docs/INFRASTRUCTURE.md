# Zirtan — altyapı durum değerlendirmesi ve üretim mimarisi

Bu belge dürüst bir envanterdir: neyin gerçek, neyin simülasyon olduğu ve üretime çıkmak için neyin gerektiği.

## 1. Bugünkü durum (v1.3)

| Katman                     | Durum                                                                                                     | Üretimde ne gerekir                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Uygulama (Expo/RN)         | ✅ Gerçek. iOS/Android/Web tek kod; typed routes; tasarım sistemi; 9 dil; erişilebilirlik etiketleri      | EAS Build + OTA (`eas.json` hazır), Sentry, analitik                                                               |
| İş mantığı (`src/domain`)  | ✅ Gerçek ve test edilmiş (A\* rota, derece dönüşümü, ödeme makinesi, AMS skoru, kuyruk politikası vb.)   | Değişmez; backend ile aynı kuralları paylaşmak için paket olarak yayınlanabilir                                    |
| Veri erişimi (`src/data`)  | ⚠️ Mock provider (AsyncStorage kalıcılığı). Arayüzler (`repositories/index.ts`) gerçek API sözleşmesidir  | `SupabaseProvider` (Postgres + PostGIS + Auth + Realtime + Storage) — aynı arayüzleri uygular                      |
| Kimlik                     | ⚠️ Demo giriş                                                                                             | Supabase Auth (e-posta, Apple, Google), `.edu` öğrenci doğrulama için e-posta OTP                                  |
| Gerçek zamanlı             | ⚠️ Polling (2–5 sn) ile simüle                                                                            | Supabase Realtime / WebSocket: grup sohbeti, canlı konum, yayın sohbeti, bildirimler                               |
| Push bildirim              | ❌ Yok (uygulama içi bildirim listesi var)                                                                | Expo Push + APNs/FCM; "dönüş sözü" gecikmesi ve SOS sunucu tarafından tetiklenir                                   |
| Medya                      | ⚠️ Yerel URI/örnek görseller                                                                              | Supabase Storage/S3 + CDN, sunucu tarafı küçültme, EXIF temizleme                                                  |
| Kütüphane verisi           | ✅ Veri hattı gerçek (OSM/Wikidata/Commons/Wikivoyage); uygulamada 84 örnek yer                           | Hattı yerelde çalıştır (`npm run data`), PostGIS'e yükle, `expo-sqlite` ile çevrimdışı paket                       |
| Destinasyon arşivi         | ✅ Editoryal içerik (Nepal/Himalaya, Kilimanjaro, Patagonya, Alpler, Türkiye…)                            | Editör paneli + Wikivoyage içe aktarma taslakları + topluluk düzeltmeleri                                          |
| Yapay zekâ                 | ✅ `server/ai-gateway` gerçek (Claude, araç kullanımı, SSE, görüntü analizi); uygulama çevrimdışı yedekli | Gateway'i dağıt (Fly/Cloud Run), anahtar yönetimi, oran sınırı, günlükleme; RAG için kütüphane/destinasyon indeksi |
| Canlı yayın / drone        | ⚠️ Ürün katmanı + demo akış                                                                               | LiveKit veya Mux (RTMP ingest, HLS/WebRTC oynatma), DJI RTMP                                                       |
| Uydu                       | ⚠️ Kuyruk/sıkıştırma/SOS makinesi gerçek; iletim simüle                                                   | Garmin Explore/IPC, ZOLEO API, Iridium SBD; sunucu tarafı kuyruk ve kurtarma merkezi entegrasyonu                  |
| Ülkeye göre SOS            | ✅ Konumdan ülke tespiti + 40+ ülke kurtarma dizini (uygulama içi)                                        | Dizinin editoryal bakımı; 112/911 aramaları cihaz üzerinden zaten gerçek                                           |
| Ödeme                      | ⚠️ Emanet makinesi gerçek; sağlayıcı simüle                                                               | iyzico Marketplace (alt üye işyeri) veya Stripe Connect; RevenueCat abonelik; 3DS; webhook                         |
| Harita                     | ⚠️ SVG graf görünümü; PMTiles indirme simüle                                                              | MapLibre RN + Protomaps PMTiles; OSM'den trail grafı üretimi (`docs/MAPS.md`)                                      |
| Sosyal / gruplar / kurslar | ✅ Ürün katmanı tam; veri mock                                                                            | Realtime, moderasyon (rapor/engelle), medya işleme, arama (Postgres FTS)                                           |
| Test & CI                  | ✅ 300+ Jest + pipeline testi; GitHub Actions (lint, typecheck, test, web export)                         | E2E (Maestro/Detox), görsel regresyon                                                                              |

## 2. Hedef üretim mimarisi

```
Mobil/Web (Expo)
   │  HTTPS / WebSocket
   ├── Supabase: Postgres + PostGIS (kütüphane, destinasyon, rota grafı, işletme envanteri)
   │             Auth · Realtime (sohbet, canlı konum) · Storage (medya) · Edge Functions (dönüş sözü, SOS)
   ├── ai-gateway (Node, Claude): sohbet, gezi planı, görüntü analizi, RAG
   ├── LiveKit/Mux: canlı yayın & drone
   ├── iyzico/Stripe + RevenueCat: ödeme & abonelik
   ├── Expo Push: bildirimler
   └── Uydu köprüsü: Garmin/ZOLEO webhook → kuyruk → kurtarma merkezi
```

- **Tek sözleşme:** `src/data/repositories/index.ts` arayüzleri; mock ve gerçek sağlayıcı aynı testlerle doğrulanır.
- **Çevrimdışı öncelik:** TanStack Query önbelleği + AsyncStorage; kütüphane/destinasyon/ilk yardım/haritalar cihazda.
- **Güvenlik:** kart verisi uygulamaya girmez (PCI kapsam dışı), KVKK/GDPR için veri silme akışı, canlı konum sunucuda geçmiş tutmaz.
- **Ölçek:** PostGIS uzamsal indeks, medya CDN, gateway prompt önbelleği, sohbet için oda başına kanal.

## 3. Sıradaki adımlar (öncelik sırasıyla)

1. Supabase şeması (`tools/data-pipeline/schema.postgis.sql` temel) + `SupabaseProvider`.
2. Auth + push + Realtime (gruplar, canlı konum).
3. Ödeme (iyzico) ve abonelik (RevenueCat).
4. MapLibre + PMTiles; OSM'den trail grafı.
5. LiveKit; DJI RTMP.
6. Uydu köprüsü (Garmin Explore API) ve kurtarma merkezi entegrasyonu.
