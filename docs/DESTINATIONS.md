# Destinasyon arşivi, "Dönüş Sözü" yol planı ve AMS takibi

Bu belge `destinations` modülünün içerik modelini, kaynak/lisans kurallarını ve editoryal süreci
anlatır. Kullanıcı, "Nepal Himalaya'ya nasıl gidilir, nerede kamp kurulur, izinler, maliyet,
riskler" sorusunun tam cevabını uygulama içinde bulmalıdır.

## Mevcut durum (mock)

| Katman     | Dosya                                   | Not                                                                                       |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Domain     | `src/domain/destinations.ts`            | Filtreleme, Lake Louise skoru, aklimatizasyon uyarıları, etap profili, yol planı durumu   |
| Seed       | `src/data/mock/seed.destinations.ts`    | 18 destinasyon, 160+ etap, 27 acil merkez, `u_me` için 2 kayıt, 4 AMS kaydı, 2 yol planı |
| Repository | `src/data/mock/repos/destinations.ts`   | Liste/detay (mesafe + kayıt), AMS kaydı, yol planı yaşam döngüsü, `checkOverdue` bildirimi |
| Hooks      | `src/features/destinations/hooks.ts`    | TanStack Query; `useOverdueCheck` 60 sn'de bir gecikme kontrolü                           |
| Bileşenler | `src/features/destinations/components/` | Kart, etap zaman çizelgesi, SVG irtifa grafiği, AMS formu/grafiği, dönüş planı kartı       |
| Ekranlar   | `src/app/(app)/destinations/*`          | `index`, `[id]`, `ams`, `plans`, `plan-new`                                               |
| i18n       | `src/core/i18n/modules/destinations.ts` | tr + en (diğer diller `translate` becerisiyle eklenir)                                    |

## İçerik modeli

`Destination` bir rotayı/bölgeyi tanımlar; `DestinationStage[]` günlük durakları verir.

- **Kimlik:** `id`, `slug`, `name`, `region`, `countryCode` (ISO-2), `type`
  (`trek | expedition | climbing_area | dive_region | ski_region | multi_sport`), `adventureTypes`.
- **Özet istatistik:** `maxElevationM`, `typicalDays`, `totalDistanceKm`, `difficulty`, `bestMonths`
  (1–12), `rating`, `reviewCount`, `stageCount` (etap sayısıyla eşit olmalı — provider testi kontrol
  eder).
- **Rehber (`guide`):** 1.500–3.000 karakter Türkçe düz metin. Boş satırla ayrılmış paragraflar;
  48 karakterden kısa ve noktalama ile bitmeyen tek satırlar başlık sayılır (`GuideSection` ayrıştırır).
  Standart başlıklar: _Nasıl gidilir, Ne zaman, İzinler, Konaklama, Aklimatizasyon, Bütçe, Riskler,
  Bağlantı & para_.
- **Lojistik:** `transports` (mod, nereden → nereye, süre, ₺ tahmini), `permits` (ad, ₺, nereden, not),
  `budgetTry` (kişi başı düşük/yüksek, uluslararası uçuş hariç).
- **Güvenlik:** `risks[]`, `gear[]`, `rescueNote` (yerel kurtarma/klinik/telefon), `insuranceRequired`.
- **Kaynaklar:** `sources[]` URL listesi; `updatedAt` editoryal doğrulama tarihi.

`DestinationStage`: `order`, `kind` (trailhead/village/teahouse/camp/hut/base_camp/pass/summit/
viewpoint), gerçek `coords` ve `elevationM`, önceki duraktan `distanceKm`/`durationMin`, `sleeping`,
`facilities[]`, `waterAvailable`, `connectivity` (none/sat_only/2g/4g/wifi), `restDayRecommended`,
`note`.

Destinasyon bölgelerindeki kurtarma noktaları (`seedDestinationEmergencyCenters`) ana
`emergencyCenters` tablosuna eklenir; böylece `/first-aid` ekranındaki "en yakın merkez" listesi
Pheriche HRA, KINAPA, PGHM Chamonix, Air Zermatt gibi noktaları da görür.

## Aklimatizasyon ve AMS kuralları

- `lakeLouiseScore(h, gi, f, d)`: 2018 Lake Louise skoru; baş ağrısı 0 ise AMS yok; 3–5 hafif,
  6–9 orta, ≥10 şiddetli. Tavsiye metinleri `destinations.ams.advice.*` anahtarlarında; şiddetli için
  ekran "İn, 112 / uydu SOS" aksiyonu gösterir.
- `ascentRateWarning(stages)`: ardışık **konaklanan** etaplar arasında uyku irtifası >500 m artıyorsa
  ve hedef ≥2.500 m ise uyarı.
- `acclimatizationPlan(stages)`: `restDayRecommended` işaretli duraklar + 3.000 m üstünde son
  dinlenmeden beri ≥1.000 m kazanç + hızlı artış uyarıları → önerilen ek gün listesi.

## "Dönüş Sözü" (ReturnPlan)

- `returnPlanStatus(plan, now)`: `returned`/`cancelled` sabit; başlangıçtan önce `planned`, beklenen
  dönüş + `graceMin` geçtiyse `overdue`, aksi hâlde `active`.
- `checkOverdue(meId, now)` (repository): gecikmiş aktif/planlı planları `overdue` yapar,
  `alertSentAt` yazar ve plan sahibinin `emergencyContacts` içindeki uygulama kullanıcılarına
  (`contactIds`) `trip_overdue` bildirimi gönderir. Mesaj `overdueMessage()` ile üretilir: ad, plan,
  rota, yol arkadaşları, "son konum bilinmiyor" uyarısı ve 112 yönlendirmesi.
- `useOverdueCheck` hook'u uygulama açıkken 60 sn'de bir kontrol eder. Gerçek üründe bu iş sunucu
  tarafında zamanlanmış görev + push/SMS ile yapılmalıdır; mock yalnızca uygulama açıkken çalışır.

## Kaynaklar ve lisans

- **Wikivoyage** (CC BY-SA 3.0): rota anlatımlarının iskeleti buradan uyarlanır. Uygulama içinde
  `destinations.sources.license` metniyle atıf yapılır ve her destinasyonun `sources` listesinde ilgili
  Wikivoyage sayfası bulunur. Türetilmiş metinler de CC BY-SA 3.0 ile paylaşılmalıdır.
- **Resmî kaynaklar** (izin/ücret/kural): Nepal Tourism Board & Göçmenlik Dairesi, NTNC (ACAP/MCAP),
  Himalayan Rescue Association, KINAPA/TANAPA, CONAF, SERNANP, Aconcagua Eyalet Parkı, Mont Blanc
  refuge rezervasyon merkezi, SAC, Kültür Rotaları Derneği, T.C. Kaymakamlıklar.
- Ücretler ₺'ye editoryal tarihte çevrilir; kesin rakam için kaynak bağlantısı esastır.

## Editoryal doğrulama süreci

1. **Kaynak toplama:** Wikivoyage + en az bir resmî kaynak; koordinat/irtifa için OpenStreetMap ya da
   resmî harita. Her etabın koordinatı ve irtifası ayrı ayrı doğrulanır.
2. **Yazım:** Rehber standart başlıklarla, ikinci tekil ("in", "rezervasyon yap") üslubuyla yazılır;
   fiyat ve süreler aralık olarak verilir.
3. **Güvenlik incelemesi:** Riskler, kurtarma notu ve sigorta zorunluluğu dağcılık/ilk yardım
   deneyimi olan ikinci bir editör tarafından okunur; AMS eşikleri `ascentRateWarning` ile çapraz
   kontrol edilir.
4. **Teknik doğrulama:** `npm test` (`destinationsProvider.test.ts` etap sayısı, sıra, rehber
   uzunluğu ve kayıt bütünlüğünü kontrol eder).
5. **Yayın:** `updatedAt` güncellenir; 12 ayı geçen içerikler "gözden geçir" listesine düşer.

## Veri hattı önerisi: `import-wikivoyage`

`tools/data-pipeline` altına kısa bir komut önerilir:

```
npm run data -- import-wikivoyage --page "Everest_Base_Camp_Trek" --out draft/ebc.json
```

- MediaWiki API'den sayfa metnini (`action=parse&prop=wikitext`) çeker, "Get in / Do / Sleep / Stay
  safe" bölümlerini `guide` başlıklarına eşler ve `Destination` taslağı üretir (`sources` alanına
  sayfa URL'si + revizyon id'si eklenir).
- Taslak otomatik yayınlanmaz; yukarıdaki editoryal süreçten geçip `seed.destinations.ts`'e (ileride
  içerik CMS'ine) aktarılır. CC BY-SA atıf bloğu taslağa otomatik eklenir.

## Bilinen sınırlar

- Rehber metinleri yalnızca Türkçedir; diğer dillerde arayüz çevrilir, içerik Türkçe kalır.
- Gecikme bildirimi mock ortamda yalnızca uygulama açıkken tetiklenir (bkz. yukarı).
- Görseller Unsplash bağlantılarıdır; çevrimdışı paket için yerel kopya gerekir.
