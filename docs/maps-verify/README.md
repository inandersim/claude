# Harita doğrulama kanıtları

Playwright ile web hedefinde (`npx expo start --web`) gezilerek üretildi.
Karo sunucusu: `node tools/tiles/serve.mjs --port 8090`,
uygulama: `EXPO_PUBLIC_TILES_URL=http://localhost:8090`.

| Dosya | Ekran | Ne gösteriyor |
| --- | --- | --- |
| `01-maps.png` | `/maps` | Paket listesi; hiçbiri diskte olmadığı için hepsi "İndir" (yönetici katalogla diski uzlaştırıyor) |
| `02-maps-indirme.png` | `/maps` | `pack_uludag` karo sunucusundan gerçekten indirildi → "Çevrimdışı hazır" + yerel adres |
| `03-planner.png` | `/maps/planner` | Patika grafı kaynağıyla vektör harita: 36 patika çizgisi, 28 düğüm işareti |
| `04-planner-rota.png` | `/maps/planner` | Haritaya dokunarak A/B seçildi; rota çizildi, yükseklik profili ve istatistikler hesaplandı |
| `06-navigate.png` | `/navigate/trk_uludag_selin` | PMTiles karolarından çizilen gerçek OSM patikaları + iz + kullanıcı konumu + sonraki adım |
| `07-navigate-ilerleme.png` | `/navigate/...` | Demo ile konum ilerletildi; katedilen bölüm soluk çizildi |
| `08-kayitli-rota.png` | `/maps/route/<id>` | Kayıtlı rota haritada |
| `09-zarif-dusus.png` | `/tracks/trk_ayder_kavrun_me` | Karo paketi olmayan bölge → SVG görünümüne zarif düşüş (`track-map-fallback`) |

`report.json`: ham sonuçlar — her ekran için MapLibre durumu (`styleLoaded`,
çizilen nesne sayısı, katman listesi), konsol hataları (**0**) ve karo sunucusuna
giden istekler (`206 Partial Content` Range istekleri dâhil).

Yeniden üretmek için: `docs/MAPS.md` § 6-7.
