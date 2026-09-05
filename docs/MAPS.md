# Çevrimdışı haritalar & rota motoru (`maps`)

Demo sürümü, harita paketlerini ve rota planlamayı tamamen mock veriyle çalıştırır
(`src/data/mock/seed.maps.ts`, `src/data/mock/repos/maps.ts`). Rota motoru saf TypeScript'tir
(`src/domain/routing.ts`) ve üretimde de değişmeden kullanılır; yalnızca veri kaynağı değişir.

## Üretim mimarisi

- **Vektör karo:** [MapLibre React Native](https://github.com/maplibre/maplibre-react-native) +
  [PMTiles](https://github.com/protomaps/PMTiles) (Protomaps). Tek dosyalık `.pmtiles` arşivleri
  `MapPack.localPath` altına indirilir; MapLibre `pmtiles://` protokolü ile doğrudan yerel dosyadan okur.
- **Stil:** OpenMapTiles şeması + outdoor odaklı özel stil (kontur çizgileri, gölgeleme, patika
  vurguları). Stil JSON'u pakete gömülür; yazı tipleri/glif'ler ve sprite'lar da çevrimdışı paketlenir.
- **Atıf:** Tüm harita verisi © OpenStreetMap katkıcıları, ODbL lisansı. Harita ekranında ve paket
  kartlarında "© OpenStreetMap" atfı zorunludur; Protomaps/MapLibre atfı da eklenir.
- **Paket boyutu:** `packSizeEstimateMb(bbox, zoomMax)` bbox alanından tahmin üretir (z14 için ≈ 3,6 KB/km²).
  Yayınlanan paketlerde gerçek boyut sunucudan gelir.

## Patika grafı üretimi

Rota motoru `TrailGraph` (düğüm + kenar) bekler. Üretimde graf OSM'den türetilir:

1. `tools/data-pipeline` ile bölge bbox'ı için OSM PBF ayıklanır (`osmium extract`).
2. `highway=path|footway|track|bridleway|cycleway` yolları alınır; `sac_scale`, `trail_visibility`,
   `surface`, `mtb:scale` etiketleri okunur.
3. Kavşaklar düğüm olur; `name`/`natural=peak`/`place=locality` düğüm adı için kullanılır.
   Yükseklik SRTM/Copernicus DEM'den örneklenir (`elevationM`).
4. Kenar başına: `distanceKm` (geometri uzunluğu), `surface` (OSM `surface` → `Surface` enum),
   `technical` (0–1; `sac_scale` T1→0.1 … T6→1.0, `mtb:scale` benzer), `profiles` (hangi profiller
   kullanabilir: `bicycle=no` → mtb/gravel hariç, `ski=yes`/kar örtüsü → ski_tour).
5. Sonuç `TrailGraph` JSON olarak pakete gömülür ve `MapsRepository.graph(regionId)` ile yüklenir.

## Motor özeti

- **A\*** (`planRoute`): kenar maliyeti = süre (dk) × yüzey × teknik çarpanları; sezgisel = kuş uçuşu
  mesafe / profilin azami hızı (kabul edilebilir → en hızlı yol garantili).
- **Süre:** yürüyüş/koşu için Tobler (`6·e^(−3.5·|eğim+0.05|)` km/sa), bisiklet için düz 15/18 km/sa +
  eğim düzeltmesi, kayak turu için çıkışta Tobler, inişte hızlı kayış.
- **Profil kısıtları:** mtb/gravel `technical > 0.6` kenarları kullanamaz; ski_tour yalnızca
  kar/moloz/kaya; trail_run patika/stabilize tercih eder.
- **GPX 1.1** dışa/içe aktarma (`toGpx`, `fromGpx`) ve Douglas–Peucker sadeleştirme (`simplifyPoints`).
