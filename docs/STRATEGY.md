# Zirtan — Pazar Analizi, Farklılaşma ve Gelir Stratejisi

> Eylül 2026. Kaynaklar dokümanın sonunda; rakamlar kamuya açık bilgilerden derlendi.

## 1. Böyle bir uygulama var mı?

Kısa cevap: **parça parça var, bütün olarak yok.** Pazar dikey uygulamalara bölünmüş durumda:

| Kategori            | Lider ürünler                                                                                                                                     | Ne yapıyor                                                                                | Neyi yapmıyor                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Rota & keşif        | **AllTrails** (80 M+ kayıtlı kullanıcı, 450 K+ rota, Peak paketi 80 $/yıl), **Komoot**, **Outdooractive**, Gaia GPS, Wikiloc                      | Rota veritabanı, çevrimdışı harita, yorum/fotoğraf, AI rota önerisi, yanlış dönüş uyarısı | Eşleştirme, canlı yayın, pazar yeri, eğitmen rezervasyonu, topluluk tehlike haritası |
| Performans & sosyal | **Strava**                                                                                                                                        | Aktivite kaydı, segment, kulüpler, 2026'da yürüyüş araçları ve rota dışı uyarı            | Konum bazlı partner bulma, keşif verisi, güvenlik/ilk yardım                         |
| Kamp pazarı         | **Hipcamp** (1,2 M+ konaklama, ABD/Kanada/Avustralya, rezervasyon başına değişken komisyon, min. 3 $), **The Dyrt** (inceleme odaklı, PRO üyelik) | Kamp alanı rezervasyonu, arazi sahiplerini pazara bağlama                                 | Türkiye/Avrupa/Asya kapsamı zayıf; tırmanış, dalış, paraşüt yok                      |
| Tırmanış            | **theCrag** (1 M+ rota), **Mountain Project** (450 K+ rota, K. Amerika), **27 Crags**, **OpenBeta** (açık veri API)                               | Rota/sektör veritabanı, topo                                                              | Sosyal eşleşme, canlı yayın, eğitmen                                                 |
| Dalış               | PADI App, Deepblu, Diviac                                                                                                                         | Dalış logu, dalış merkezi rezervasyonu                                                    | Diğer sporlarla entegrasyon                                                          |
| Partner bulma       | Outdoor Duo, Wild, Adventurist, Meetup                                                                                                            | İlgi alanına göre eşleşme, grup etkinlikleri                                              | Doğrulanmış profil ve güven skoru zayıf; veri/rota katmanı yok                       |
| Güvenlik            | **Garmin inReach** (uydu SOS, yılda 3 000+ SOS olayı; 2026'da askıya alınmış planda da SOS), what3words, AKUT/Ulusal 112 uygulamaları             | Uydu üzerinden SOS, konum takibi                                                          | Uygulama içi ilk yardım rehberi + topluluk tehlike verisi + sosyal katman yok        |

**Sonuç:** AllTrails "rota", Strava "performans", Hipcamp "kamp rezervasyonu", theCrag "tırmanış verisi", Garmin "SOS" alanlarında güçlü. Hiçbiri **çok sporlu + sosyal eşleştirme + canlı yayın + topluluk güvenliği + pazar yeri + eğitmen ekonomisini** tek üründe birleştirmiyor. Zirtan'nin konumu: _"outdoor için süper uygulama"_.

## 2. Rakiplerin bizden üstün olduğu noktalar (dürüst liste)

1. **Veri derinliği ve ölçek** — AllTrails 450 K+ rota, theCrag 1 M+ tırmanış, Hipcamp 1,2 M+ konaklama. Bizim kütüphanemiz açık veriyle (OSM + Wikidata + Wikimedia Commons) hızla büyüyebilir ama yorum/fotoğraf yoğunluğu yıllar ister.
2. **Çevrimdışı topografik haritalar ve navigasyon** — Komoot/Gaia'nın en güçlü yanı. v1.2 ile rota motoru (A\*, Tobler süre modeli, yükseklik profili, GPX) ve PMTiles harita paketleri eklendi; üretimde MapLibre ile vektör karo render'ı gerekir.
3. **Giyilebilir entegrasyonu** — Garmin/Suunto/Apple Watch senkronu (AllTrails Wear OS 1 M+ indirme).
4. **Uydu SOS** — Garmin donanım + operasyon merkezi. v1.2 ile cihaz eşleştirme (inReach/Zoleo/iPhone uydu/Starlink Mini), dar bant mesaj sıkıştırma, sakla-ilet kuyruğu ve SOS aşama makinesi eklendi; gerçek iletim için Garmin Explore/Zoleo API köprüsü gerekir.
5. **AI rota üretimi ve hava tahmini** — 2026'da Komoot/Outdooractive/AllTrails Peak standardı. v1.2 ile Zirtan AI (uygulama içi yerel asistan + Claude tabanlı `server/ai-gateway`) eklendi.
6. **Marka ve ağ etkisi** — 10+ yıllık topluluklar.

## 3. Bize özgü yetenekler ve farklar

| Fark                                                                                                                            | Neden önemli                                                                                                | Durum                                              |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **ZMatch** — konum + doğrulama + güven skoru ile partner eşleştirme                                                             | Rakiplerde ya yok ya güvensiz. Doğrulanmış profil ve güven skoru "yabancıyla dağa çıkma" korkusunu azaltır. | ✅ Canlı                                           |
| **Topluluk tehlike haritası** (kaya düşmesi, çığ, sel, vahşi hayvan, kapalı bölge; onay mekanizması, yakındakilere anlık uyarı) | Hiçbir rakipte topluluk kaynaklı, sporlar arası, anlık bir tehlike katmanı yok. Güvenlik = elde tutma.      | ✅ Canlı                                           |
| **Canlı yayın + drone yayını** (irtifa telemetrili)                                                                             | Strava/AllTrails'te canlı video yok. Dağdan/sualtından canlı yayın viral içerik üretir.                     | ✅ Ürün katmanı; gerçek iletim için LiveKit/Mux    |
| **Çok sporlu tek kimlik** (yürüyüş, tırmanış, dalış, kayak, bisiklet, yamaç paraşütü; rafting, kano vb. genişletilebilir)       | Kullanıcı 3 uygulama yerine 1 uygulama kullanır.                                                            | ✅                                                 |
| **Eğitmen/rehber ekonomisi** (sertifika, rezervasyon, ödeme, Pro Guide)                                                         | Rakipler B2C içerik satıyor; biz B2B2C pazar yeri kuruyoruz.                                                | ✅ Rezervasyon; ödeme entegrasyonu yol haritasında |
| **Konaklama + ekipman + işletme pazarı** (otel, pansiyon, kamp alanı, kiralama, tur operatörü)                                  | Hipcamp yalnız kamp, yalnız 3 ülke.                                                                         | ✅ Bu sürümde                                      |
| **İlk yardım & SOS** (çevrimdışı rehberler, en yakın acil merkez, 112, acil kişilere canlı konum)                               | Garmin'de donanım şartı; AllTrails'te yok.                                                                  | ✅ Bu sürümde                                      |
| **Canlı konum paylaşımı** (arkadaş/eşleşme/SOS modları, süreli)                                                                 | AllTrails Plus'ta var ama sosyal katman yok.                                                                | ✅ Bu sürümde                                      |
| **Türkiye + yükselen pazarlar öncelikli, çok dilli**                                                                            | ABD merkezli rakipler TR/BR/JP içeriğinde zayıf.                                                            | ✅ TR/EN + DE/FR/ES/IT/JA/PT/RU                    |
| **Açık veri ile kütüphane** (OSM/Wikidata/Commons, lisans atıflı)                                                               | Kendi kapalı veritabanı yerine açık veri + topluluk = hızlı ölçek.                                          | ✅ Veri hattı bu sürümde                           |

### 3b. v1.2 — rakiplerin güçlü yanlarını kapatan modüller

| Rakip avantajı                          | Zirtan v1.2 karşılığı                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Komoot: çevrimdışı vektör harita + rota | `maps` modülü: PMTiles harita paketleri (indirme yöneticisi), trail grafı üzerinde A\* rota planlama, Tobler süre modeli, yükseklik profili, GPX     |
| theCrag: doğrulanmış tırmanış verisi    | `climbing` modülü: kaya → sektör → rota, 5 derece sistemi arası dönüşüm, logbook, topluluk (3 onay) + moderatör doğrulama                            |
| Garmin: uydu SOS donanımı               | `satellite` modülü: cihaz eşleştirme, bağlantı katmanı seçimi, 160 karakter sıkıştırılmış mesaj, kuyruk, SOS aşama makinesi, en yakın kurtarma       |
| Hipcamp: envanter + ödeme güveni        | `inventory` modülü: birim envanteri, müsaitlik takvimi, sezon fiyatı, emanet (escrow) ödeme akışı, iptal politikaları, ev sahibi doğrulama, yorumlar |
| AllTrails/Komoot: AI planlama           | `ai` modülü: Zirtan AI sohbet, gezi planı, güvenlik özeti, paketleme listesi; Claude tabanlı gateway (araç kullanımı, akış)                           |
| Strava: topluluk ve oyunlaştırma        | `fun` modülü: XP/seviye, rozetler, görevler, liderlik tablosu, günlük yarışma, macera ruleti, zirve pasaportu                                        |
| —                                       | `clubs` modülü: üniversite doğa sporları kulüpleri dizini, üyelik, etkinlik & RSVP, öğrenci doğrulama, kulüp sıralaması (rakiplerde yok)             |

## 4. Hedef diller (maceraperest yoğunluğuna göre)

Yürüyüş katılım oranları: Yeni Zelanda ~%70, Japonya %68, Almanya %45, Kanada %42, Birleşik Krallık %36; mutlak sayıda ABD (58 M+ günübirlik yürüyüşçü), Brezilya (aylık 11 M ekoturizm yürüyüşçüsü). Tırmanış/kayak/dalış merkezleri: Fransa, İspanya, İtalya, Avusturya/İsviçre (DE), Tayland/Endonezya (EN), Mısır (dalış), Nepal (Ağrı/Himalaya trekking).

Öncelik sırası: **Türkçe → İngilizce → Almanca → Fransızca → İspanyolca → İtalyanca → Japonca → Portekizce (BR) → Rusça**. Sonraki dalga: Korece, Çince (Basitleştirilmiş), Nepalce, Tayca, Arapça.

## 5. Gelir modeli

| Kaynak                                                 | Mekanizma                                                                                                                | Kıyas                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Zirtan Pro** (bireysel)                               | ₺149/ay veya ₺1.190/yıl: çevrimdışı harita paketleri, sınırsız canlı konum, gelişmiş tehlike uyarıları, reklamsız, rozet | AllTrails Plus 36 $/yıl, Peak 80 $/yıl; Strava ~80 $/yıl  |
| **Pro Guide** (eğitmen/rehber)                         | ₺399/ay: ücretli rezervasyon alma, komisyon %15 → %5, öne çıkan profil, drone yayını, takvim/analitik                    | Airbnb Experiences ~%20 komisyon                          |
| **Business** (otel, kamp alanı, mağaza, tur operatörü) | ₺799/ay + rezervasyon başına %8–12 komisyon; öne çıkan ilan                                                              | Hipcamp değişken servis ücreti (min. 3 $); Booking %15–18 |
| **Market** (C2C ekipman)                               | Ücretsiz ilan; öne çıkarma ₺49; güvenli ödeme (escrow) %5                                                                | Letgo/Sahibinden modeli                                   |
| **Canlı yayın**                                        | Sanal hediye/bahşiş (%30 platform payı), sponsorlu yayın                                                                 | Twitch/TikTok Live                                        |
| **Kurumsal**                                           | Yerel yönetim/park idaresi için tehlike verisi & ziyaretçi analitiği API'si                                              | —                                                         |

Ödeme altyapısı: uygulama içi abonelikler için **RevenueCat** (iOS/Android/Web tek entegrasyon), Türkiye'de pazar yeri bölünmüş ödemeler (sub-merchant, BDDK uyumlu escrow, haftalık ödeme döngüsü) için **iyzico Marketplace**, uluslararası için **Stripe Connect**.

## 6. Veri kütüphanesi stratejisi

Amaç: dünyadaki kamp alanı, tırmanış, dalış, trekking, rafting, kayak, yamaç paraşütü, kano/kayak, mağara, bisiklet vb. tüm noktaların **konum + bilgi + fotoğraf** ile tek kütüphanede toplanması.

Kaynaklar (tamamı açık lisanslı, atıf zorunlu):

| Kaynak                                        | Lisans                                 | İçerik                                                                                                                                        |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenStreetMap (Overpass API / planet extract) | ODbL                                   | `tourism=camp_site`, `sport=climbing` (+`climbing:*`), `sport=scuba_diving`, `amenity=dive_centre`, `route=hiking` ilişkileri, `sport=rafting | canoe | kayak | paragliding | skiing`, `natural=peak | cave_entrance`, `amenity=hospital`, `emergency=*` |
| Wikidata (SPARQL)                             | CC0                                    | Dağlar (yükseklik, koordinat), millî parklar, dalış noktaları, çok dilli adlar, Commons kategorileri                                          |
| Wikimedia Commons (Action API)                | CC BY / CC BY-SA / CC0 (dosya bazında) | Fotoğraflar; `extmetadata` ile lisans, yazar ve atıf metni                                                                                    |
| Wikipedia REST (özet)                         | CC BY-SA                               | Kısa açıklamalar                                                                                                                              |
| OpenBeta                                      | CC BY-SA                               | Tırmanış alanları/rotaları (API)                                                                                                              |

Kurallar: Overpass'ta hız sınırı (429) var; dünya ölçeği için **planet extract + osmium tags-filter** tercih edilir, Overpass yalnızca artımlı güncelleme için. Tüm isteklerde tanımlayıcı `User-Agent`. Her kayıtta kaynak, lisans ve atıf saklanır; uygulama "Kaynak: © OpenStreetMap katkıcıları" satırını gösterir.

Depolama: yerel diskte **SQLite** (tek dosya, telefona da paketlenebilir) ve sunucuda **PostgreSQL + PostGIS**. Uygulama içi arama `expo-sqlite` ile çevrimdışı çalışır; sunucu tarafında Meilisearch/Typesense.

## 7. Yol haritası

| Aşama               | Kapsam                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Şimdi (v1.1)**    | Canlı konum, Anlar, Konaklama & işletme pazarı, Pro planlar, drone yayını, ilk yardım & SOS, 9 dil, veri hattı + Kütüphane modülü                                                                  |
| **v1.2 (bu sürüm)** | Zirtan AI + AI gateway, çevrimdışı harita paketleri + rota motoru, doğrulanmış tırmanış veritabanı, uydu bağlantısı & SOS, rezervasyon envanteri & emanet ödeme, üniversite kulüpleri, oyunlaştırma |
| **v1.3**            | Gerçek backend (Supabase/PostGIS), kimlik doğrulama, push bildirim, RevenueCat + iyzico ödemeleri, LiveKit canlı yayın, MapLibre render                                                            |
| **v1.4**            | Hava & çığ bülteni entegrasyonu, Garmin/Zoleo API köprüsü, giyilebilir senkron, aktivite kaydı                                                                                                     |
| **v2.0**            | Rafting/kano/mağara/kite gibi yeni sporlar, kurumsal veri API'si, çoklu para birimi                                                                                                                |

## Kaynaklar

- [Best Hiking Apps of 2026 – Outdoors Magic](https://outdoorsmagic.com/article/best-hiking-apps/)
- [Strava debuts hiking tools – TechRadar](https://www.techradar.com/health-fitness/strava-subscribers-just-saved-themselves-another-sub-to-komoot-or-alltrails-as-the-freemium-app-debuts-a-new-suite-of-hiking-tools-that-spans-every-stage-of-the-outdoor-experience-including-vital-off-route-alerts)
- [Best Hiking Apps 2026 comparison – OpenRando](https://www.openrando.com/en/blog/comparatif-meilleures-applications-randonnee-2026)
- [AllTrails debuts $80/year Peak – TechCrunch](https://techcrunch.com/2025/05/12/alltrails-debuts-a-80-year-membership-that-includes-ai-powered-smart-routes)
- [AllTrails expands membership with Peak – PR Newswire](https://www.prnewswire.com/news-releases/alltrails-expands-membership-offering-with-alltrails-peak-302451541.html)
- [Hipcamp business breakdown – Contrary Research](https://research.contrary.com/company/hipcamp)
- [Hipcamp vs The Dyrt – Expedition Portal](https://expeditionportal.com/field-tested-hipcamp-and-the-dyrt/)
- [OpenBeta vs Mountain Project vs theCrag](https://openbeta.substack.com/p/openbeta-vs-mountainproject-vs-thecrag)
- [Best climbing apps 2026 – DroidLore](https://droidlore.com/outdoor/outdoor-climbing)
- [Best outdoor activity partner apps 2026 – TerenGO](https://terengo.com/blog/best-outdoor-activity-partner-apps-2026)
- [Garmin 2025 inReach SOS year in review](https://www.garmin.com/en-US/blog/outdoor/2025-inreach-sos-year-in-review/)
- [Garmin adds free inReach SOS to suspended plans – DC Rainmaker](https://www.dcrainmaker.com/2026/06/garmin-adds-free-inreach-sos-to-suspended-plans.html)
- [Hiking statistics 2026 – Gitnux](https://gitnux.org/hiking-statistics/)
- [2025 Outdoor Participation Trends Report – OIA](https://material-civet.files.svdcdn.com/production/images/documents/2025-OIA_Participation_Trends_Full_Report_2025-12-15-211912_fchj.pdf?dm=1765833552)
- [OSM Wiki: Tag:tourism=camp_site](https://wiki.openstreetmap.org/wiki/Tag:tourism=camp_site), [Tag:sport=climbing](https://wiki.openstreetmap.org/wiki/Tag:sport=climbing), [Tag:sport=scuba_diving](https://wiki.openstreetmap.org/wiki/Tag:sport=scuba_diving), [Tag:amenity=dive_centre](https://wiki.openstreetmap.org/wiki/Tag:amenity=dive_centre)
- [Overpass API – OSM Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API), [OSMF API usage policy](https://operations.osmfoundation.org/policies/api/)
- [Commons:Credit line](https://commons.wikimedia.org/wiki/Commons:Credit_line), [Extension:CommonsMetadata](https://www.mediawiki.org/wiki/Extension:CommonsMetadata)
- [DJI Mobile SDK LiveStreamManager](https://developer.dji.com/api-reference/android-api/Components/LiveStreamManager/DJILiveStreamManager.html), [DJI drone live streaming 2026 – Dacast](https://www.dacast.com/blog/drone-live-streaming/)
- [RevenueCat Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo), [iyzico Marketplace](https://docs.iyzico.com/en/products/marketplace)
