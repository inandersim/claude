# Zirtan — harita ve navigasyon altyapısı

Bu belge, uygulamanın gerçek harita ve rota altyapısının **sunucu tarafını** anlatır:
OpenStreetMap'ten yönlendirme grafı ve çevrimdışı vektör harita paketi üretimi.

Uygulama tarafı (MapLibre bileşeni, çevrimdışı paket yöneticisi, sesli navigasyon)
`docs/MAPS.md` içinde; bu belge onu besleyen veriyi üretir.

## Neden kendi hattımız var

Hazır rota servisleri (Google Directions, Mapbox Directions) dağ patikalarını ya hiç
bilmez ya da otomobil mantığıyla ele alır. Yürüyüş ve tırmanışta önemli olan şeyler —
SAC zorluk ölçeği, patika görünürlüğü, yüzey, mevsimsel kar — yalnızca OpenStreetMap
etiketlerinde vardır. Ayrıca çevrimdışı çalışmak zorunludur: dağda şebeke yoktur.

Maliyet de belirleyici: OpenStreetMap (ODbL) ve Copernicus DEM ücretsizdir, kullanım
başına ödeme yoktur. Aylık sabit gideri olmayan bir altyapı, gelir gelmeden ayakta kalır.

## Üretilen iki çıktı

| Çıktı | Dosya | Ne işe yarar |
| --- | --- | --- |
| **Yönlendirme grafı** | `out/graphs/<bölge>.json` | A\* rota planlama, mesafe/tırmanış/süre, profil erişimi |
| **Vektör harita paketi** | `out/tiles/<bölge>.pmtiles` | Çevrimdışı harita çizimi (MapLibre) |

Graf, `src/domain/types.ts` içindeki `TrailGraph` şekliyle **birebir** aynıdır; uygulamadaki
A\* planlayıcısı (`src/domain/routing.ts`) hiçbir dönüşüm olmadan tüketir.

## 1. Yönlendirme grafı

```bash
node tools/tiles/build-graph.mjs --list                    # hazır bölgeler
node tools/tiles/build-graph.mjs --region likya            # ağdan çek + yükseklik
node tools/tiles/build-graph.mjs --region kackar --no-elevation
node tools/tiles/build-graph.mjs --input dump.json --region likya   # yerel döküm
```

### Hat adımları

1. **Çekme** — Overpass API'den bölge sınır kutusundaki yollar (`out geom` ile geometri dahil):
   patika, orman yolu, kaldırım, merdiven, bisiklet yolu, via ferrata, yürüyüş rotaları.
   Ağ kapalıysa `--input` ile yerel bir Overpass JSON dökümü ya da `osmium` çıkarımı verilebilir.
2. **Graf kurma** — her yol koordinat dizisi kenarlara bölünür. Koordinatlar 5 ondalığa
   (~1 m) yuvarlanarak düğüm kimliği üretilir; böylece iki yol aynı noktada kesişiyorsa
   **gerçek bir kavşak** oluşur. Kavşak oluşmazsa rota bulunamaz, bu adım kritiktir.
3. **Etiket çevirisi** — OSM etiketleri uygulamanın alanlarına dönüşür:
   - `surface`, `highway`, `tracktype` → `Surface` (`trail`/`rock`/`scree`/`snow`/`gravel`/`paved`)
   - `sac_scale`, `trail_visibility`, `ladder`, `via_ferrata_scale` → `technical` (0–1)
   - `foot`, `bicycle`, `access` + zorluk → `profiles` (`hike`/`trail_run`/`mtb`/`gravel`/`ski_tour`)
4. **Sadeleştirme** — derecesi 2 olan ara düğümler kaldırılıp kenarlar birleştirilir.
   Kavşaklar, isimli düğümler ve yüzey/zorluk değişim noktaları korunur.
   Tipik küçülme **%70–80**; A\* buna karşılık gelen oranda hızlanır.
5. **Ada budama** — kopuk bileşenler atılır, yalnızca en büyük bağlı ağ kalır.
   Kopuk patikalar kullanıcıya "rota bulunamadı" olarak döner, bu yüzden temizlenir.
6. **Yükseklik** — düğümler Open-Meteo Elevation API'sinden (Copernicus DEM GLO-90)
   100'erlik gruplar hâlinde zenginleştirilir. Uygulama da aynı kaynağı kullanır,
   böylece cihazdaki ve sunucudaki yükseklikler tutarlıdır.

### Erişim kuralları

| Etiket | Sonuç |
| --- | --- |
| `access=private` / `access=no` | Her profile kapalı, kenar hiç üretilmez |
| `foot=no` | Yaya profilleri kapalı; bisiklet yalnızca `bicycle=yes/designated` ise açık |
| `highway=steps` | Bisiklet ve kayak kapalı |
| `highway=via_ferrata` | Yalnızca `hike`; teknik puan 0,95 |
| `technical > 0,5` veya `surface=scree` | Tekerlekli profiller kapalı |

### Doğrulama

Hat, uygulamanın gerçek planlayıcısıyla uçtan uca sınanmıştır. Örnek bir Uludağ
patika ağında (12 yol): 76 ham düğüm → sadeleştirme sonrası 19 → ada budamasıyla 17 düğüm,
21 kenar. Aynı graf üzerinde A\*:

| Profil | Mesafe | Tırmanış | Süre | Yüzey dağılımı |
| --- | --- | --- | --- | --- |
| Yürüyüş | 4,03 km | +675 m | 132 dk | patika 3,85 km · kaya 0,19 km |
| Dağ bisikleti | 4,68 km | +585 m | 52 dk | çakıl 3,63 km · patika 1,05 km |

Süre farkı Tobler yürüyüş fonksiyonundan gelir; bisiklet aynı tırmanışı üçte bir sürede
tamamlar. Yayaya kapalı özel yol grafa hiç girmemiş, kopuk ada patikası budanmıştır.

## 2. Vektör harita paketi (PMTiles)

```bash
node tools/tiles/build-tiles.mjs --check            # araç kontrolü
node tools/tiles/build-tiles.mjs --region likya
node tools/tiles/build-tiles.mjs --region likya --geojson-only
```

Katmanlar ve en düşük zum seviyeleri:

| Katman | Zum | İçerik |
| --- | --- | --- |
| `trails` | 9 | Patika, orman yolu, merdiven, via ferrata, yürüyüş rotaları |
| `roads` | 7 | Karayolu ağı (yaklaşım için) |
| `water` | 8 | Göl, nehir, dere |
| `landuse` | 9 | Orman, çalılık, çıplak kaya, taşlık, buzul |
| `poi` | 11 | Zirve, pınar, sığınak, kamp alanı, manzara noktası, geçit |

Hat: Overpass → GeoJSON → `tippecanoe` (MBTiles) → `pmtiles convert` (tek dosya).

**PMTiles neden:** tek bir dosyadır ve istemci HTTP Range istekleriyle yalnızca gereken
karo baytlarını çeker. Yani ayrı bir karo sunucusu gerekmez; dosyayı bir nesne
deposuna (Cloudflare R2, S3) koymak yeterlidir. Çevrimdışı kullanımda aynı dosya
cihaza indirilir. Bu, aylık sunucu gideri olmayan tek çözümdür.

### Gerekli araçlar

`tippecanoe` ve `pmtiles` dış ikili dosyalardır; kurulu değilse betik GeoJSON'a kadar
üretir ve kurulum talimatını yazar. Araç kurmak istemiyorsan hazır küresel Protomaps
paketinden bölge kesmek de mümkündür:

```bash
pmtiles extract https://build.protomaps.com/<tarih>.pmtiles out/tiles/likya.pmtiles \
  --bbox=29.10,36.15,29.95,36.65
```

## 3. Geliştirme sunucusu

```bash
node tools/tiles/serve.mjs --port 8090
```

| Uç | Döndürdüğü |
| --- | --- |
| `GET /health` | Sunucu durumu ve paket sayısı |
| `GET /packs` | Mevcut paketler (uygulamadaki `MapPack` listesiyle eşleşir) |
| `GET /tiles/<bölge>.pmtiles` | Range destekli karo dosyası |
| `GET /graphs/<bölge>.json` | Yönlendirme grafı |

Range desteği gerçektir (206 Partial Content), böylece MapLibre'nin PMTiles protokolü
yerelde de üretimdeki gibi davranır. Yol geçişi saldırılarına karşı dosya adları
kısıtlıdır.

## 4. Üretim dağıtımı

1. Bölge grafını ve karolarını üret (yukarıdaki iki komut).
2. `out/tiles/*.pmtiles` dosyalarını nesne deposuna yükle, önüne CDN koy.
3. Grafları veritabanına yaz (`map_packs` ve `trail_graphs` tabloları) ya da aynı CDN'den sun.
4. Uygulamada `MapPack.sizeMb` ve sürüm alanlarını güncelle; istemci fark varsa yeniden indirir.
5. Bölgeleri **ayda bir** yeniden üret: OpenStreetMap sürekli güncellenir, yeni patikalar eklenir.

## 5. Lisans ve atıf

| Kaynak | Lisans | Zorunlu atıf |
| --- | --- | --- |
| OpenStreetMap | ODbL 1.0 | "© OpenStreetMap katkıcıları" — haritada görünür olmalı |
| Copernicus DEM GLO-90 | Ücretsiz, atıflı | Yükseklik verisi için künyede |
| Open-Meteo | CC BY 4.0 | Hava ve yükseklik uçları |

Atıf metni graf dosyasının `meta.attribution` alanına yazılır; uygulama bunu harita
künyesinde gösterir. ODbL'nin "share-alike" koşulu türetilmiş veriyi kapsar: grafı
dağıtırsan aynı lisansla dağıtman gerekir.

## 6. Ölçek notları

- Bir bölge grafı tipik olarak 5–50 bin düğümdür; JSON olarak 2–20 MB, gzip ile 300 KB–3 MB.
- A\* bu boyutta cihazda 50 ms'nin altında sonuçlanır; ek indeks gerekmez.
- Ülke ölçeğinde (yüz binlerce düğüm) hiyerarşik yönlendirmeye (contraction hierarchies)
  geçmek gerekir; bölge bazlı paketler bu ihtiyacı bugünlük ortadan kaldırır.
- Karo paketleri bölge başına 20–200 MB. Kullanıcı yalnızca gideceği bölgeyi indirir.
