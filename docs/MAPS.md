# Harita ve çevrimdışı paketler (`maps`)

Uygulamadaki harita artık **gerçek bir vektör haritadır**: MapLibre + PMTiles.
Bu belge uygulama tarafını anlatır; haritayı besleyen veriyi (OpenStreetMap → yönlendirme
grafı → PMTiles paketi) üreten sunucu hattı **[docs/MAPS_PIPELINE.md](./MAPS_PIPELINE.md)**
içindedir.

| Katman | Dosya | Ne yapar |
| --- | --- | --- |
| Harita bileşeni | `src/features/maps/components/MapView.tsx` | Platformlar arası tek arayüz + zarif düşüş |
| Web motoru | `src/features/maps/vector/engine.web.tsx` | `maplibre-gl` + `pmtiles://` protokolü |
| Yerel motor | `src/features/maps/vector/engine.native.tsx` | `@maplibre/maplibre-react-native` |
| Motor yoksa | `src/features/maps/vector/engine.tsx` | "motor yok" — SVG'ye düşülür |
| Stil | `assets/map-style/zirtan-outdoor.json` | Doğa temalı vektör stil, üç tema varyantı |
| Stil çözümleme | `src/features/maps/vector/style.ts` | Varyant + kaynak + üst katmanlar |
| Kaynak seçimi | `src/features/maps/vector/source.ts` | Paket → sunucu → graf kademeleri |
| Paket yöneticisi | `src/features/maps/pack-manager.ts` | İndir / iptal / sil / sürüm / disk |

## 1. Harita bileşeni

```tsx
<MapView
  source={{ kind: 'pmtiles', url: 'file:///.../uludag.pmtiles' }}
  center={{ latitude: 40.1, longitude: 29.15 }}
  zoom={13}
  bounds={[minLon, minLat, maxLon, maxLat]}   // verilirse kamera buna oturur
  route={plannedPoints}                        // planlanan rota çizgisi
  routeDone={walkedPoints}                     // katedilen bölüm (soluk)
  track={trackPoints}                          // kaydedilmiş iz
  markers={markers}                            // A/B, POI, sonraki adım
  userLocation={position}
  offRoute={progress.isOffRoute}               // rota ve konum uyarı rengine döner
  onPress={(coords) => …}
  onRegionChange={({ center, zoom, bounds }) => …}
  onMarkerPress={(id) => …}
  fallback={<RouteMap … />}                    // vektör çizilemezse bu görünür
/>
```

Rota, iz, işaret ve konum katmanları **stil belgesinin içine** eklenir
(`applyOverlay`), dolayısıyla web ve yerel tarafta bire bir aynı görünürler;
platforma özel çizim kodu yoktur.

Ekran sarmalayıcıları:

- `src/features/maps/components/TrailMapView.tsx` — patika grafı + planlanan rota
  (`/maps/planner`, `/maps/route/[id]`). Haritaya dokunulunca en yakın düğüm seçilir
  (`nearestNode`, 1,5 km yarıçap).
- `src/features/tracks/components/TrackMapView.tsx` — iz, POI'ler, kullanıcı konumu,
  rotadan sapma (`/navigate/[id]`, `/tracks/*`).

### Zarif düşüş

`fallbackReason()` (`src/features/maps/vector/fallback.ts`) kararı verir:

| Neden | Ne zaman | Sonuç |
| --- | --- | --- |
| `no-source` | Karo paketi de graf de yok | Mevcut SVG görünümü (`RouteMap` / `TrackMap`) |
| `style-error` | Stil çözülemedi | SVG görünümü |
| `engine-unavailable` | MapLibre yüklenemedi (Expo Go, WebGL kapalı) | SVG görünümü |

Uygulama **hiçbir koşulda boş harita göstermez**: en kötü durumda eski SVG şeması,
her durumda "© OpenStreetMap katkıcıları" künyesi ve hangi kaynağın kullanıldığını
söyleyen bir etiket çizilir.

## 2. Kaynak kademeleri

`resolveSource()` üç kademeyi sırayla dener:

1. **`pack`** — cihazda indirilmiş PMTiles paketi. Tam kartografya, çevrimdışı.
   Demo verisindeki `localPath` alanına güvenilmez; dosyanın gerçekten durduğu
   `MapPackManager.isInstalled()` ile doğrulanır (web'de kalıcı dosya sistemi
   olmadığı için bu kademe web'de hiç kullanılmaz).
2. **`server`** — `EXPO_PUBLIC_TILES_URL` tanımlıysa karo sunucusundaki paket.
   Sunucunun `/packs` yanıtındaki sınır kutusu noktayı kapsıyorsa seçilir; en dar
   kapsayan paket kazanır.
3. **`graph`** — karo yoksa **patika grafının kendisi** GeoJSON kaynağına çevrilir
   (`graphToGeoJson`). Uydurma veri yoktur: bu, rota planlayıcısının kullandığı grafın
   ta kendisidir; OSM etiket adlarıyla (`highway`, `surface`, `sac_scale`) yazıldığı
   için aynı stil dosyası hiç değişmeden çalışır. Böylece paket indirilmemiş bölgelerde
   de kaydırılıp yakınlaştırılabilen gerçek bir vektör harita çıkar.

Hiçbiri olmazsa `none` → SVG.

## 3. Stil

`assets/map-style/zirtan-outdoor.json` geçerli bir MapLibre stil belgesidir; iki farkı var:

- Renkler `"@land"`, `"@trail"` gibi **göstergelerle** yazılır. `resolveMapStyle()`
  bunları `metadata["zirtan:variants"]` altındaki üç palete göre çözer:
  `light` · `dark` · `sun` — uygulamanın renk şemalarıyla birebir aynı.
- Kaynak adı `"@source"` yer tutucusudur; PMTiles kaynağında tek vektör kaynağa,
  GeoJSON kaynağında katman başına ayrı kaynağa bağlanır.

Katmanlar (alttan üste): arka plan → arazi örtüsü (orman, çalılık, kaya/moloz, buzul)
→ su (alan + akarsu) → kontur → karayolu (kenar + dolgu) → patikalar → POI'ler.
Patika çizgileri OSM etiketlerine göre ayrışır:

| Katman | Filtre | Görünüm |
| --- | --- | --- |
| `trail-track` | `highway=track` | Uzun kesikli, kalın; `surface` asfalt/kayaysa rengi değişir |
| `trail-path` | `highway=path/footway/bridleway/cycleway` | Kısa kesikli; renk `surface`'a göre (patika/çakıl/kaya/moloz/kar/asfalt) |
| `trail-demanding` | `sac_scale ≥ demanding_mountain_hiking`, via ferrata | Sık kesikli, uyarı rengi |
| `trail-steps` | `highway=steps` | Nokta nokta |

POI'ler zirve / sığınak-dağ evi / kamp / pınar / manzara-geçit olarak ayrı renklerle
çizilir. **Yazı ve simge yoktur**: çevrimdışı çalışmayı garanti etmek için stil
`glyphs`/`sprite` istemez (bunlar ağ ister). Ad etiketleri uygulama katmanında,
işaret balonlarıyla gösterilir. Bir dağıtımda glif/sprite paketlenirse stile
`glyphs`/`sprite` alanları eklenip metin katmanları açılabilir.

Kontur katmanı (`contours`) stilde tanımlıdır ama varsayılan karo paketinde bu katman
yoktur; `resolveMapStyle` pakette bulunmayan katmanların stil katmanlarını atar
(aksi hâlde MapLibre "source-layer yok" hatası basar).

## 4. Çevrimdışı paket yöneticisi

`src/features/maps/pack-manager.ts` `MapPack` sözleşmesini korur ve eski indirme
benzetiminin yerini alır.

- **Durum makinesi** — `packReducer(pack, event)` saf fonksiyondur, dosya sistemi bilmez:

  ```
  available ──download──▶ downloading ──complete──▶ downloaded
       ▲                       │                        │
       └──── cancel / fail ────┘                        │
       └──────────── remove ────────────────────────────┘
  downloaded ──remote-version (daha yeni)──▶ update_available
  ```

- **İndirme** — `expo-file-system`'in `File.downloadFileAsync` çağrısı; ilerleme
  (`bytesWritten/totalBytes`) `addProgressListener` ile ekrana akar, `AbortSignal`
  ile iptal edilir. İptal ya da hata durumunda yarım dosya silinir.
- **Sürüm** — dosyanın yanına `<paket>.pmtiles.json` künyesi yazılır; `compareVersions`
  (`2026.09` > `2026.08`) ile sunucu sürümü karşılaştırılır, eskiyse `update_available`.
- **Disk** — `diskUsageBytes()` / `diskUsageMb()` paket dizinini toplar.
- **Uzlaştırma** — `reconcile(pack, remoteVersion)` katalogla diskteki gerçeği birleştirir;
  `useMapPacks` bunu (yalnızca karo sunucusu tanımlıyken) listeye uygular. Böylece
  "indirilmiş" görünen ama dosyası olmayan paket haritayı boşa düşürmez.
- **Web** — `expo-file-system`'in web uygulaması boş bir gölgedir; bu yüzden web'de
  bellek içi depolama kullanılır (`createMemoryStorage`), paketler kalıcı olmaz ve
  karolar doğrudan sunucudan HTTP Range ile okunur.

Yapılandırma: `.env` içinde `EXPO_PUBLIC_TILES_URL` (örn. `http://localhost:8090`).
Tanımlı değilse indirme demo benzetimine düşer ve harita graf kaynağını kullanır.

## 5. Yerel platformda çalıştırma (geliştirme derlemesi gerekir)

`@maplibre/maplibre-react-native` **yerel (native) bir modüldür; Expo Go'da çalışmaz.**
Expo Go'da `loadMapLibre()` `null` döner ve harita SVG görünümüne düşer — uygulama
çalışmaya devam eder, yalnızca vektör harita olmaz.

Eklenti `app.json`'a kayıtlıdır:

```json
["@maplibre/maplibre-react-native", { "android": { "nativeVariant": "opengl" } }]
```

Geliştirme derlemesi:

```bash
npx expo prebuild            # ios/ ve android/ üretir (eklenti burada işlenir)
npx expo run:android         # ya da: eas build --profile development --platform android
npx expo run:ios             # macOS + Xcode gerekir
```

Notlar:

- Android'de `nativeVariant` `opengl` (varsayılan) ya da `vulkan` olabilir.
- iOS tarafında MapLibre, Swift Package Manager ile çekilir; ilk derleme uzun sürer.
- `newArchEnabled: true` ile uyumludur (kütüphane 11.x yeni mimariyi destekler).

> **Doğrulanmamış:** Bu ortamda iOS/Android derlemesi alınamadı; yerel motor kodu
> derlenmiş bir uygulamada denenmedi. Web tarafı uçtan uca doğrulandı (aşağıya bakın).

## 6. Karo sunucusuyla yerel deneme

```bash
# 1. Graf ve karo üret (ağ kapalıysa yerel Overpass dökümünden)
node tools/tiles/build-graph.mjs --input tools/tiles/fixtures/uludag.overpass.json --region uludag --no-elevation
node tools/tiles/build-tiles.mjs --input tools/tiles/fixtures/uludag.overpass.json --region uludag

# 2. Sunucuyu ayağa kaldır (Range destekli)
node tools/tiles/serve.mjs --port 8090

# 3. Uygulamaya adresi ver
echo 'EXPO_PUBLIC_TILES_URL=http://localhost:8090' >> .env
npx expo start --web
```

`tippecanoe`/`pmtiles` ikilileri kurulu değilse `build-tiles.mjs` **saf JS hattına**
düşer (`tools/tiles/lib/pmtiles-writer.mjs`: geojson-vt → vt-pbf → PMTiles v3) ve yine
gerçek bir `.pmtiles` arşivi üretir. `--js-tiler` ile bu hat zorlanabilir.
Doğrulaması: `npm run test:tiles`.

## 7. Doğrulama (web, bu depoda çalıştırıldı)

Playwright ile `/maps`, `/maps/planner`, `/navigate/<id>`, `/maps/route/<id>` gezildi;
ekran görüntüleri `docs/maps-verify/` altında, ham rapor `docs/maps-verify/report.json`:

| Ekran | Kaynak | Sonuç |
| --- | --- | --- |
| `/maps` | — | `pack_uludag` karo sunucusundan **gerçekten indirildi** → "Çevrimdışı hazır" |
| `/maps/planner` | `graph` | 36 patika çizgisi + 28 düğüm işareti çizildi; haritaya dokunarak A/B seçilip rota planlandı |
| `/navigate/<id>` | `server` | PMTiles'tan `206 Partial Content` karo istekleri; iz, konum, sonraki adım çizildi |
| `/maps/route/<id>` | `graph` | Kayıtlı rota haritada çizildi |

Konsol hatası: **0**. MapLibre hata olayı: **0**.

## 8. Atıf ve lisans

Tüm harita verisi © OpenStreetMap katkıcıları (ODbL 1.0). Atıf hem vektör haritada
(MapLibre künyesi) hem de zarif düşüş görünümünde çizilir; kaldırılamaz.
Ayrıntılar: [docs/MAPS_PIPELINE.md § 5](./MAPS_PIPELINE.md).

## 9. Rota motoru

Rota planlama saf TypeScript'tir ve bu çalışmada değişmedi: `src/domain/routing.ts`
(A\*, Tobler yürüyüş hızı, profil kısıtları, GPX 1.1 dışa/içe aktarma,
Douglas–Peucker sadeleştirme). Harita yalnızca sonucu çizer.

- **A\*** maliyeti = süre (dk) × yüzey × teknik çarpanları; sezgisel = kuş uçuşu / azami hız.
- **Profil kısıtları:** mtb/gravel `technical > 0.6` kenarlarını kullanamaz; ski_tour
  yalnızca kar/moloz/kaya; trail_run patika/stabilize tercih eder.
