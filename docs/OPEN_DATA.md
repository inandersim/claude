# Açık veri kaynakları, lisanslar ve veri politikası

Bu belge Zirve'nin kullandığı ücretsiz/açık veri kaynaklarını, atıf yükümlülüklerini, oran
sınırlarını ve önbellek stratejisini; ayrıca rakip uygulamalardan veri **çekmeme** kararının
gerekçesini anlatır. `weather` modülü (`src/data/external/*`) bu kuralların ilk uygulamasıdır.

## Kaynaklar ve lisanslar

| Kaynak                                                                                      | Kullanım                                                      | Lisans                                                                       | Atıf gereksinimi                                                                                      | Oran sınırı / kural                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Open-Meteo](https://open-meteo.com) Forecast API                                           | Saatlik/günlük hava, donma seviyesi, UV, gün doğumu/batımı    | CC BY 4.0 (veri), ticari olmayan kullanım için ücretsiz API                  | "Weather data by Open-Meteo.com" — ekranın kaynak satırında gösterilir (`weather.source.attribution`) | Anahtar yok; ticari olmayan kullanım için < 10 000 istek/gün. Kötüye kullanım IP engeline yol açar |
| Open-Meteo Elevation API (Copernicus DEM GLO-90)                                            | Nokta yüksekliği (rota noktaları, konum)                      | CC BY 4.0; DEM verisi Copernicus lisansı                                     | Aynı Open-Meteo atfı                                                                                  | İstek başına 100 nokta; 30 gün önbellek                                                            |
| [EAWS](https://www.avalanches.org) / [avalanche.report](https://avalanche.report) (Euregio) | Çığ bülteni (CAAML v6 JSON)                                   | CC BY 4.0 (Euregio bültenleri); diğer ulusal servisler kendi şartlarına tabi | "Kaynak: avalanche.report / EAWS" + bültene bağlantı (`AvalancheCard`)                                | Bülten günde 1–2 kez yayınlanır; 2 saat önbellek yeterli. Diğer bölgeler için yalnız bağlantı      |
| OpenStreetMap (Overpass / Nominatim)                                                        | Yer adları, zirveler, patikalar, kulübeler (`library` modülü) | ODbL 1.0                                                                     | "© OpenStreetMap contributors" — türev veri tabanı da ODbL ile paylaşılmalı                           | Overpass: makul kullanım (~2 istek/sn); Nominatim: 1 istek/sn, uygulama tanımlayan User-Agent      |
| Wikidata                                                                                    | Zirve yükseklikleri, çok dilli adlar, kimlikler               | CC0 1.0                                                                      | Zorunlu değil; iyi niyetle "Wikidata" belirtilir                                                      | SPARQL uç noktası: 60 sn sorgu limiti, User-Agent zorunlu                                          |
| Wikivoyage                                                                                  | Bölge açıklamaları, ulaşım ipuçları (`destinations`)          | CC BY-SA 4.0                                                                 | Yazar/lisans bağlantısı + türevlerin aynı lisansla paylaşılması                                       | MediaWiki API: makul kullanım; içerik önbelleğe alınır                                             |
| Open-Elevation / SRTM (NASA)                                                                | Yedek yükseklik kaynağı (Open-Meteo yanıt vermezse)           | SRTM kamu malı; Open-Elevation GPL-2.0 (sunucu yazılımı, veri değil)         | "Elevation data: NASA SRTM"                                                                           | Kamu örneği yavaş; kendi örneğini barındır ya da Open-Meteo'yu birincil tut                        |

Atıf metinleri i18n'de tutulur (`weather.source.*`) ve ilgili ekranın alt satırında gösterilir.
Ayarlar → Hakkında ekranı, tüm kaynakları lisanslarıyla listelemelidir (yapılacak).

## Önbellek stratejisi

`src/data/external/cache.ts` — AsyncStorage + bellek katmanlı TTL önbellek:

| Veri         | TTL    | Anahtar                               | Çevrimdışı davranış                                                        |
| ------------ | ------ | ------------------------------------- | -------------------------------------------------------------------------- |
| Hava tahmini | 30 dk  | `weather:<lat2>,<lon2>:<rakım\|auto>` | Süresi geçmiş veri `stale: true` ile döner; UI `fetchedAt` yaşını gösterir |
| Yükseklik    | 30 gün | `elevation:<lat4,lon4;…>`             | Yoksa kütüphane/parça noktalarından en yakın bilinen irtifa                |
| Çığ bülteni  | 2 sa   | `avalanche:<bölge kodu>`              | Süresi geçmiş bülten ya da deterministik mock                              |

Hiç veri yoksa (ilk açılış + çevrimdışı) `mockForecast(coords, seed, now)` mevsime ve rakıma
göre gerçekçi, deterministik bir tahmin üretir ve ekran "Demo veri" rozeti gösterir.
`WeatherForecast.source` alanı `'open-meteo' | 'mock'` olduğu için UI hangi durumda olduğunu
her zaman bilir; gerçek veri asla demo ile karıştırılmaz.

Koordinatlar 2 ondalığa (~1 km) yuvarlanarak anahtarlanır: yakın konumlar aynı tahmini
paylaşır, gereksiz istek atılmaz ve Open-Meteo'nun günlük sınırı korunur.

## Neden rakip uygulamalardan veri çekmiyoruz

AllTrails, Wikiloc, Komoot, Gaia GPS, Strava ve benzerlerinin rota/POI/fotoğraf verileri
**açık veri değildir**:

- **Kullanım şartları**: Hepsinin ToS'u otomatik erişimi (scraping, tersine mühendislik,
  toplu indirme) açıkça yasaklar. İhlal hesap kapatma ve hukuki yaptırıma yol açar.
- **Telif ve veri tabanı hakları**: Kullanıcıların yüklediği rotalar platforma lisanslanmıştır;
  derleme (veri tabanı) hakkı platforma aittir. AB _sui generis_ veri tabanı hakkı ve Türkiye
  FSEK m. 6/11 toplu çekimi yasaklar. OSM'nin ODbL'i ile de uyumsuzdur (karışık lisanslı türev
  veri tabanı oluşturamayız).
- **Kalite ve güven**: Kaynağı belirsiz rotalar güvenlik uygulamasında sorumluluk doğurur; resmi
  olmayan kaynaklardan gelen "patika" gerçekte özel mülk ya da tehlikeli olabilir.
- **Ürün stratejisi**: Zirve'nin farkı topluluk doğrulaması (`tracks` modülündeki onaylar,
  `hazards` teyitleri) ve açık kaynaklarla birleştirilmiş güvenlik katmanıdır; kopyalanmış
  içerik bu değeri üretmez.

### Yasal alternatif: kullanıcı kendi verisini getirir

- **GPX / KML içe aktarma** (`tracks` modülü): Kullanıcı kendi cihazından, Wikiloc/AllTrails
  dışa aktarımından ya da saatinden indirdiği GPX dosyasını yükler. Dosya kullanıcının kendi
  verisidir; GDPR/KVKK veri taşınabilirliği hakkı bunu destekler.
- **Strava / Garmin / Suunto resmi API'leri** (OAuth): Kullanıcı kendi hesabını bağlar; yalnızca
  kendi aktiviteleri, kendi izniyle ve API şartlarına uygun olarak çekilir (Strava: veriyi
  yeniden dağıtmamak, "Powered by Strava" logosu, oran sınırı 200 istek/15 dk). Yapılacak.
- **Topluluk katkısı**: Kullanıcının kaydettiği parça, açık rızasıyla "topluluk rotası"na
  dönüşür ve ODbL uyumlu şekilde OSM'e geri katkı için aday olur.

## Uygulama kontrol listesi

- [x] Open-Meteo istemcisi, 8 sn zaman aşımı, `toForecast` saf dönüştürücü + fixture testi
- [x] EAWS CAAML v6 ayrıştırıcısı (`parseCaaml`) + fixture testi
- [x] TTL önbellek, stale geri dönüşü, koordinat anahtarı
- [x] Deterministik mock (`mockForecast`, `mockAvalanche`)
- [x] Kaynak/atıf satırı ve "Demo veri" rozeti
- [ ] Ayarlar → Hakkında: tüm kaynaklar ve lisanslar listesi
- [ ] Strava/Garmin OAuth içe aktarma
- [ ] Diğer EAWS ulusal servisleri için CAAML uç noktaları (SLF, Météo-France, Varsom)
