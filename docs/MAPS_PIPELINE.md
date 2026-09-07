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

## Arazi katmanları — eşyükselti ve eğim

```bash
node tools/tiles/build-tiles.mjs --region uludag --terrain
node tools/tiles/build-tiles.mjs --region uludag --terrain --dem-step 60 --contour-interval 10
```

`--terrain` verildiğinde hat, OpenStreetMap katmanlarının yanına **DEM'den
hesaplanan** iki katman daha üretir:

| Katman     | Nasıl üretilir                                          | minzoom |
| ---------- | ------------------------------------------------------- | ------- |
| `contours` | Marching squares, varsayılan 20 m aralık                | 11      |
| `slope`    | Horn (1981) 3×3 eğim, çığ bantlarına sınıflandırma      | 10      |

**Kaynak.** DEM, `elevation.mjs` üzerinden Open-Meteo (Copernicus DEM GLO-90) —
yani uygulamadaki rota profiliyle **aynı** yükseklik kaynağı. İki ayrı DEM
kullanmak, profildeki tırmanış ile haritadaki eşyükseltilerin çelişmesi demekti.

**Önbellek.** Izgara `out/dem/` altına yazılır; aynı bölge yeniden derlendiğinde
binlerce API çağrısı tekrarlanmaz. Adım açıklığı değişirse yeni önbellek üretilir.

**Kaza freni.** Yanlış bir sınır kutusu yüz binlerce istek üretebilir; ızgara
250.000 noktayı aşarsa betik çalışmadan durur ve daha büyük `--dem-step` önerir.

### Eşyükselti eğrileri

Marching squares, hücre köşelerinin eşiğin altında/üstünde olmasına göre 16
durumu ayırır; kenar geçişleri doğrusal interpolasyonla bulunur ve parçalar uç
uca eklenir. Köşegen belirsizlik (5 ve 10 numaralı durumlar) hücre ortalamasına
göre çözülür — aksi hâlde sırtlar ve vadiler yanlış bağlanır, eğriler kesişir.

Her 5. eğri (`index: 1`) kalın çizilir. **Bilinen sınır:** stil dosyasında yazı
tipi (`glyphs`) tanımlı olmadığı için eşyükselti **etiketleri** (yükseklik
sayıları) henüz çizilmiyor; çevrimdışı çalışması gerektiğinden uzak bir glyph
sunucusu eklenmedi.

### Eğim açısı bantları

Çığların ezici çoğunluğu **30–45°** yamaçlarda tetiklenir. Bantlar EAWS ve
İsviçre SLF ölçütleriyle aynı: 27–30 · 30–35 · 35–40 · 40–45 · 45+.

Çıktı hücre başına poligon değildir: aynı sınıftaki komşu hücreler önce satır
içinde, sonra satırlar arasında dikdörtgenlere birleştirilir. Testte 10×10'luk
tek sınıf alan **100 poligon yerine 1** üretiyor; karo boyutu ve çizim başarımı
arasındaki fark budur.

Uygulamada katman **varsayılan kapalıdır** (`slopeShading`): kışın hayat
kurtarır, yazın haritayı okunmaz hâle getirir. Rota planlayıcıda "Eğim açısı"
düğmesiyle açılır ve bant efsanesi görünür.

### Doğrulama

```bash
node --test tools/tiles/test/terrain.test.mjs
```

22 test; yöntem **bilinen geometriler**: 1000 m'de 1000 m yükselen düzlemin eğimi
45° çıkmalı, doğu-batı yönünde yükselen yamaçta eşyükseltiler kuzey-güney
doğrultusunda düz olmalı, tepe çevresinde kapalı halka oluşmalı, birleştirme
hiçbir hücreyi atlamamalı ve iki kez saymamalı.

## Kabartma gölgelendirme ve 3B arazi (terrain-RGB)

```bash
node tools/tiles/build-tiles.mjs --region uludag --terrain-rgb
node tools/tiles/build-tiles.mjs --region uludag --terrain --terrain-rgb   # ikisi birden
```

`--terrain-rgb`, DEM'i **terrarium** kodlamasıyla PNG raster karolarına çevirir ve
ayrı bir arşive yazar: `out/tiles/<bölge>-dem.pmtiles`. Tek bir karo kümesi iki
özelliği birden açar — kabartma gölgelendirme (`hillshade` katmanı) ve 3B arazi
(MapLibre `terrain`).

**Neden ayrı dosya?** Kullanıcı kabartma istemiyorsa DEM'i indirmez. Karo
sunucusu `-dem` sonekini tanır ve onu **ayrı bir paket olarak listelemez**; ana
paketin `demUrl` alanına bağlar. Aksi hâlde kullanıcı listede iki "harita paketi"
görür ve ikisini de indirir.

**Kodlama** (`tools/tiles/lib/terrain-rgb.mjs`):

    yükseklik = (R * 256 + G + B / 256) - 32768

Mapbox'ın terrain-rgb biçimi yerine terrarium seçildi: açık biçim, 1/256 m
çözünürlük, negatif yükseklikleri (Ölü Deniz, Hazar) doğal olarak taşıyor.
Stil tarafındaki `encoding: 'terrarium'` ve `tileSize: 256` bu hatla **birebir**
eşleşmek zorundadır; uyuşmazsa harita çökmez, **yanlış** arazi çizer.

**PNG kodlayıcı** (`tools/tiles/lib/png.mjs`): bağımlılıksız, `node:zlib`
üzerine ~100 satır. Yalnızca 8 bit RGB, aralıksız, tek IDAT — terrain-RGB'nin
ihtiyacı bu. Genel amaçlı bir PNG kütüphanesi eklemek, bu iş için 100 satırı
1 MB'lık bağımlılıkla değiştirmek olurdu. Satır filtresi `Sub`: komşu pikseller
birbirine yakın olduğu için düz `None`dan belirgin biçimde iyi sıkışıyor.

**Çözünürlük sınırı.** Izgara adımından daha ince karo üretmek yeni bilgi
taşımaz. `terrainRange()` gerçek sınırı hesaplar ve CLI bunu raporlar
("DEM z10'a kadar gerçek bilgi taşıyor; üstündeki zumlar ara değerdir").
Kaba ızgarada üst sınır `minzoom`un altına düşerse aralık kenetlenir —
eskiden bu durumda **sessizce boş** bir karo kümesi üretiliyordu.

**Örnekleme** çift doğrusaldır. En yakın komşu, karo çözünürlüğü ızgaradan
yüksek olduğunda basamaklı bir yüzey üretir ve kabartmada satranç tahtası
deseni olarak görünür.

### Uygulama tarafı

| Ayar             | Varsayılan | Neden                                                        |
| ---------------- | ---------- | ------------------------------------------------------------ |
| `hillshade`      | **açık**   | Görsel kazancı büyük, maliyeti düşük; arazi okunur hâle gelir |
| `terrain3d`      | kapalı     | Kamerayı eğmek pil ve GPU maliyeti getirir                    |
| `slopeShading`   | kapalı     | Kışın hayat kurtarır, yazın haritayı okunmaz yapar            |

Kabartma katmanı zeminin **üstünde**, arazi renklerinin **altında** durur; aksi
hâlde harita gri bir kabartmaya döner. Aydınlatma kuzeybatıdan (315°) —
kartografyada yerleşik kural; tersi "kabarık yerine çukur" yanılsaması üretir.

### Doğrulama

```bash
node --test tools/tiles/test/terrain-rgb.test.mjs
```

17 test. Ölçüt **gidiş-dönüş**: kodlanan yükseklik çözüldüğünde 1/256 m içinde
aynı değeri vermeli. Ayrıca PNG'nin kayıpsız geri okunduğu (filtre çözümü),
karo koordinat dönüşümlerinin tersinir olduğu ve kaba ızgarada bile karo
üretildiği doğrulanıyor.

Uçtan uca tarayıcıda da denendi: sentetik bir Likya paketi + DEM arşivi karo
sunucusundan servis edildi, uygulama `pmtiles://` üzerinden `likya-dem.pmtiles`
arşivini çekti (başlık + karo verisi), kabartma ve 3B düğmeleri çalıştı,
konsolda stil hatası çıkmadı.

### Çevrimdışı indirme

Paket yöneticisi vektör paketten sonra yükseklik dosyasını da indirir
(`<paket>-dem.pmtiles`), böylece kabartma ve 3B **çevrimdışı** da çalışır —
uygulamanın asıl kullanım senaryosu bu.

- **Sıra:** önce vektör, sonra DEM. Vektör paket olmadan harita zaten çizilemez;
  yarıda kesilen indirmede ilk dosyayı tamamlamış olmak daha çok işe yarar.
- **İlerleme** iki dosya için tek çubukta birleşir. Boyutlar sunucudan geldiği
  için (`sizeBytes`, `demSizeBytes`) ağırlık gerçek bayta göre hesaplanır;
  bilinmiyorsa vektöre %80 pay verilir. Çubuk hiçbir koşulda geri gitmez.
- **DEM inemezse paket yine kullanılabilir kalır.** Kabartma olmadan harita
  çalışır; vektör paketi silmek aşırı tepki olurdu. Yarım DEM dosyası silinir ve
  katman kapalı görünür — sessizce yanlış çizmez.
- **Silme DEM'i de kaldırır.** Bırakılsa disk kullanımı yalan söylerdi:
  "sildim ama yer açılmadı".
- Bildirilen paket boyutu iki dosyanın **toplamıdır**.

**Bilinen sınır:** 3B arazi yalnızca web motorunda doğrulandı. Yerel (iOS/Android)
motor stil belirtimindeki `terrain` alanını okur ama geliştirme derlemesi
gerektirdiği için burada sınanamadı.

## Harita metinleri (SDF glyph)

```bash
npm run glyphs        # public/glyphs/ + assets/glyphs/ altına <yığın>/<aralık>.pbf üretir
npm run test:glyphs
```

**Sorun:** MapLibre, stilde `glyphs` tanımlı olmadıkça **hiç metin çizmez**.
Harita bu yüzden tamamen sessizdi: ne zirve adı, ne sığınak adı, ne eşyükselti
rakamı. Uzak bir glyph sunucusuna bağlanmak çevrimdışı çalışmayı bozardı.

**Çözüm:** yazı tipi uygulamayla birlikte geliyor. `tools/glyphs/` üç aşamalı,
bağımlılıksız bir hat:

| Dosya               | İş                                                            |
| ------------------- | ------------------------------------------------------------- |
| `lib/ttf.mjs`       | TrueType okuma: `cmap`, `hmtx`, `loca`, `glyf` (bileşik dahil) |
| `lib/sdf.mjs`       | Anahat → örtü → işaretli mesafe alanı                         |
| `lib/glyph-pbf.mjs` | MapLibre glyph protobuf kodlama/çözme                          |
| `build-glyphs.mjs`  | CLI                                                            |

Genel amaçlı bir yazı tipi kütüphanesi eklemek yerine ~500 satır yazıldı: harita
metni için gereken bu kadar ve depo bağımlılıksız kalıyor.

### Sözleşmeler — biri kayarsa metin sessizce kaybolur

| Sabit          | Değer               | Nerede eşleşmeli                          |
| -------------- | ------------------- | ----------------------------------------- |
| Yığın adı      | `Zirtan-SemiBold`   | stildeki `text-font` ile birebir           |
| Em boyu        | 24 piksel           | MapLibre glyph sözleşmesi                  |
| Çerçeve        | 3 piksel            | protobuf'ta `width` çerçevesiz, bitmap'te dahil |
| Yarıçap/cutoff | 8 / 0.25 → kenar 192 | MapLibre kenarı 192 alfada arar           |
| Aralık         | **256'lık bloklar** | MapLibre yalnızca 0-255, 256-511… ister    |

Son satır gerçek bir hataydı: ilk denemede `256-383` üretildi (Latin
Genişletilmiş-A bloğunun sınırı). Dosya geçerliydi ama MapLibre onu hiç
istemedi — `ı ğ ş İ Ğ Ş` sessizce çizilmedi. Artık `parseRange` hizalamayı
zorunlu tutuyor.

### Nasıl sunuluyor

Aynı içerik iki yere yazılır, çünkü iki platform glyph'i farklı yoldan okur:

| Klasör          | Kim okur   | Nasıl                                              |
| --------------- | ---------- | -------------------------------------------------- |
| `public/glyphs` | web        | Expo bu klasörü çıktıya kopyalar, HTTP ile istenir |
| `assets/glyphs` | iOS/Android| Metro varlığı olarak **uygulama paketine girer**   |

Adres sırası (`glyphsUrl`):

1. `EXPO_PUBLIC_GLYPHS_URL` — açık ayar her şeyi geçer.
2. **Paketlenmiş glyph** (`bundled`) — ağ gerektirmez, bu yüzden karo
   sunucusundan önce gelir.
3. Karo sunucusu (`/glyphs/...`).
4. Web'de `/glyphs/...`.

Hiçbiri yoksa **metin katmanları stile hiç eklenmez**; `glyphs` alanı olmayan
bir stile symbol katmanı koymak MapLibre'de stilin tamamını düşürür.

### Yerelde çevrimdışı metin

`src/features/maps/vector/glyphs.native.ts` uygulamayla gelen `.pbf`
dosyalarını ilk açılışta belge klasörüne açar ve MapLibre'ye gerçek bir
`file://…/glyphs/{fontstack}/{range}.pbf` şablonu verir.

Kopyalama neden gerekiyor: paketteki varlıkların yolu öngörülemez — Metro
dosya adlarını özet değerine çevirir (`assets/6b1c8a4b…`), Android'de varlık
APK içindedir. MapLibre ise şablonu çalışma anında doldurduğu için **gerçek ve
tahmin edilebilir** bir yol ister.

Kopya bir kez yapılır: varlıkların özet değerlerinden bir **damga** yazılır;
uygulama güncellenip glyph'ler değişince damga tutmaz ve dosyalar yeniden
açılır. Damga en sonda yazıldığı için yarıda kalan bir kopyalama bir sonraki
açılışta baştan denenir. Hata durumunda `null` döner — harita metinsiz ama
çalışır kalır.

Yığın adında **boşluk yok** (`Zirtan-SemiBold`): MapLibre `{fontstack}`
yer tutucusunu yüzde kodlar, `file://` adreslerinde kodlanmış yolun diskteki
klasör adıyla eşleşmesi platforma göre değişiyor. Boşluksuz ad bu belirsizliği
tümüyle kaldırıyor.

Metro'nun `.pbf` uzantısını kaynak değil **varlık** sayması gerekir; bu
`metro.config.js` içinde `resolver.assetExts`'e eklendi.

### Katmanlar

| Katman            | Ne yazar                       | Zum |
| ----------------- | ------------------------------ | --- |
| `contour-label`   | Kalın eşyükseltilerde `1900 m` | 13+ |
| `poi-peak-label`  | Zirve adı + yükseklik          | 11+ |
| `poi-label`       | Sığınak, kamp, su, manzara adı | 13+ |

Etiketler en üstte durur; hiçbir dolgu ya da çizgi metnin üstüne binmez.
Halka (halo) her varyantta zemin rengiyle tanımlı — halosuz metin arka planda
kaybolur.

### Doğrulama

`npm run test:glyphs` → 24 test: Türkçe karakterlerin cmap'te bulunması,
bileşik glyph çözümü (`ğ` = `g` + breve), örtük eğri-üstü nokta kuralı,
nonzero sarımın delik açması, SDF kenarının 192'yi kuşatması, protobuf gidiş
dönüşü (bitmap baytı baytına), aralık hizalaması.

Tarayıcıda uçtan uca sürüldü: uygulamanın kendi çözdüğü stille (aynı
`resolveMapStyle` çıktısı) Uludağ paketi z13.5'te açıldı, `0-255.pbf` ve
`256-511.pbf` 200 döndü, MapLibre hiçbir glyph uyarısı basmadı ve ekranda
**"Çobankaya Tepesi / 2180 m"** okundu — `Ç` 256-511 bloğundan geliyor.

Paketleme ayrıca `expo export --platform android` ile doğrulandı: her iki
`.pbf` çıktı manifestinde **varlık** olarak görünüyor (özet adlı yollarla —
kopyalama adımının neden gerekli olduğunun kanıtı).

**Bilinen sınır:** `file://` şablonunun MapLibre'nin yerel motorunda okunması
yalnızca kod düzeyinde doğrulandı; gerçek cihazda (geliştirme derlemesi)
sınanmadı.

---

## Performans ölçümü

```bash
node tools/tiles/serve.mjs --port 8090   # karo sunucusu
npx expo start --web                     # uygulama
npm run perf:maps                        # ölçüm → docs/health/maps-perf-<tarih>.md
npm run test:maps                        # karar mantığının testleri
```

Ölçüm **uygulamanın kendisini** sürer: Playwright giriş yapar, rota planlama
ekranını açar, bölgeyi seçer ve geliştirme derlemesinin açtığı
`window.__ZIRTAN_MAPS__` üzerinden MapLibre örneğini ele geçirir. Stili elle
kurmak ölçümü gerçek ekrandan koparırdı.

Sabit bir kamera betiği sürülür (kaydırma → yakınlaştırma → kaydırma → eğme →
uzaklaştırma). Betik `tools/maps/perf.mjs` içinde tek yerde durur; değişirse
koşumlar karşılaştırılamaz.

### İki tür metrik — biri kapı, diğeri değil

| Tür | Örnek | Kapı mı |
| --- | --- | --- |
| **Kesin** | karo isteği, karo baytı, stil katmanı sayısı | evet, `agents/selfheal/budgets.json` → `maps.kesin` |
| **Gösterge** | ilk çizim, kare p50/p95, düşen kare, fps | hayır — yalnızca koşumlar arası karşılaştırma |

Ayrım bilinçli: başsız Chromium yazılım GL (SwiftShader) kullanır, kare
süreleri gerçek telefon GPU'sunu temsil etmez. Zamanı kapıya bağlamak,
ölçümün taşımadığı bir kesinliği varsaymak olurdu.

### Ölçümün kendi kusurları da düzeltildi

İlk koşum üç yanlış sayı üretti; üçü de ölçüm hatasıydı ve düzeltildi:

| Belirti | Neden | Düzeltme |
| --- | --- | --- |
| Düşen kare %61, fps aynı anda 60 | eşik tam kare bütçesi (16,67 ms); 60 fps'te aralıklar bu değerin iki yanında salınıyor | eşik bütçenin **1,5 katı** — "en az bir kare atlandı"nın ölçülebilir karşılığı |
| İlk çizim 5 ms, sonra 0 ms | ölçüm, işin çoğunu yutan bir beklemeden **sonra** başlıyordu | zaman sayfanın içinde, bölge tıklamasından itibaren tutuluyor |
| 6 katman, 0 metin, 0 karo — "bütçe aşımı yok" | ekrandaki harita yedek stildi; hiçbir şey ölçülmediği için rapor temiz görünüyordu | stilde karo paketi yoksa ölçüm **hata verir** |

### İlk ölçümün bulduğu gerçek hata

Ölçüm, haritanın **hiç `idle` olmadığını** gösterdi: `zirtan-dem` kaynağı
sonsuza kadar "yüklenmedi" durumunda kalıyordu.

Kök neden: istemci DEM kaynağına **vektör paketinin** zum aralığını yazıyordu
(`maxzoom: 15`), DEM arşivi ise z10'da bitiyor. MapLibre arşivde olmayan bir
zumdan karo istiyor, `pmtiles://` protokolü ağa hiç çıkmadan boş dönüyor,
kaynak hiç yüklenmiş sayılmıyor — ve **kabartma gölgelendirme hiç
çizilmiyordu**. Hata sessizdi: konsolda tek satır yoktu.

Düzeltme üç yerde:

- `tools/tiles/serve.mjs` → `/packs` artık `demMinzoom` / `demMaxzoom`
  bildiriyor (DEM arşivinin **kendi** başlığından).
- `src/features/maps/vector/source.ts` → DEM kaynağına paketin aralığı
  kopyalanmıyor.
- `src/features/maps/vector/style.ts` → aralık **tahmin edilmiyor**;
  verilmezse hiç yazılmıyor, `pmtiles://` protokolü doğrusunu bildiriyor.

Düzeltmeden sonra: `isSourceLoaded('zirtan-dem')` doğru, harita `idle` oluyor,
DEM karoları gerçekten isteniyor ve kabartma ekranda görünüyor.

### İlk temel ölçüm

Likya paketi, z10,2, 1280×900:

| | |
| --- | ---: |
| Karo isteği (kamera betiği boyunca) | 5 |
| Karo baytı | 161 KB |
| Stil katmanı | 22 |
| İlk çizim | 790 ms |
| Kare p50 / p95 | 16,7 / 16,8 ms |
| Düşen kare | %2,6 |
| Eğim gölgelendirmenin maliyeti | ölçüm gürültüsü içinde |
| **3B arazinin maliyeti** | **p95 +437 ms, düşen kare +85 puan** |

3B arazi, yazılım GL'de haritayı kullanılamaz hâle getiriyor. Gerçek GPU'da
çok daha ucuz olacak ama bu sayı, 3B'nin **varsayılan kapalı** tutulmasının
gerekçesini ölçüye bağlıyor.
