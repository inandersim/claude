# ADR-0001 — Harita motoru ve karo biçimi

**Durum:** kabul · **Tarih:** 2026-09 · **İlgili:** `docs/MAPS.md`, `docs/MAPS_PIPELINE.md`

## Bağlam

Uygulamanın çekirdeği doğa navigasyonu. İki zorunluluk var: (1) **çevrimdışı**
çalışmak — dağda ağ yok; (2) maliyeti öngörülebilir tutmak — karo başına
ücretlendiren ticari sağlayıcılar, ücretsiz kullanıcı tabanı büyüdükçe
sürdürülemez hâle gelir.

## Karar

**MapLibre GL** (web: `maplibre-gl` v5, yerel: `@maplibre/maplibre-react-native`)
+ **PMTiles** tek dosya karo biçimi. Karolar OpenStreetMap'ten kendi hattımızla
üretilir (`tools/tiles/`), istemci HTTP Range ile yalnızca gereken baytları
çeker; çevrimdışı kullanımda aynı dosya cihazda durur.

## Alternatifler

- **Mapbox / Google Maps:** hazır, kaliteli; ancak karo başına ücret, çevrimdışı
  paket kısıtı ve lisans bağımlılığı.
- **Raster karolar:** basit ama büyük, döndürülemez, tema değiştirilemez.
- **Kendi karo sunucusu (TileServer GL):** çalışır ama sürekli ayakta bir sunucu
  ister; PMTiles'ta statik dosya + CDN yeterli.

## Gerekçe

PMTiles tek dosyadır: aynı dosya hem CDN'den Range ile hem cihazdan çevrimdışı
okunur — iki ayrı hat kurmaya gerek kalmaz. MapLibre açık kaynak ve BSD
lisanslıdır; vektör olduğu için tema varyantları (gündüz/gece/kontrast) ek
veri maliyeti olmadan üretilir.

## Sonuçlar

- Karo üretimi bizim sorumluluğumuz (`tools/tiles/build-tiles.mjs`); OSM
  güncellemeleri periyodik olarak yeniden üretilmeli.
- `maplibre-gl` **v5'e sabitlenmiştir**: v6 worker'ı `import.meta.url` ile
  çözüyor ve Metro altında sessizce başarısız oluyor.
- Motor yoksa (eski cihaz, paket yüklenmedi) SVG'ye zarif düşüş şart —
  `src/features/maps/vector/engine.tsx`.
