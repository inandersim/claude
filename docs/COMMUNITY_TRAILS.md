# Topluluk rotaları, POI türetme ve navigasyon (`tracks`)

Kullanıcıların GPS kayıtları, içe aktardıkları GPX/Strava/Komoot/AllTrails/Wikiloc/Garmin parçaları ve
konumlu medyaları (anlar, canlı yayınlar, gönderiler) **sanal yollara** (`CommunityTrail`) ve
**kamp/su/manzara noktalarına** (`TrackPoi`) dönüşür; kullanıcı bu rotalarda adım adım yön bulur.
Saf mantık `src/domain/tracks.ts` içindedir ve üretimde değişmeden kullanılır; demo verisi
`src/data/mock/seed.tracks.ts`, mock repository `src/data/mock/repos/tracks.ts`.

## Veri akışı

```
kayıt / GPX / Strava ──► save() ──► maskStart (300 m) ──► simplifyTrack (DP, 8 m) ──► Track (draft)
                                                                                     │
                                                              publish() ─────────────┘
                                                                  │
                                            rebuildCommunityTrails() = clusterTracks(yayınlananlar)
                                                                  │
                     ┌────────────────────────────────────────────┴──────────────┐
                     ▼                                                           ▼
         CommunityTrail (medianCenterline, trackCount, bbox, popularity)   Track.communityTrailId
                     │
        buildNavigation(points, pois) ──► NavigationStep[] ──► progressAlong(konum) ──► NavigationProgress
```

1. **Kayıt:** `useTrackRecorder` — `expo-location` `watchPositionAsync` (High, 5 m). Web'de örnek
   parça oynatılarak simüle edilir. Duraklat/devam et; "Nokta ekle" mevcut konuma POI bırakır.
2. **İçe aktarma:** `parseGpxTrack` tüm `trkseg`'leri birleştirir (lat/lon/ele/time), `wpt` → POI adayı
   (`poiHeuristics` ile tür). Strava akışları `stravaStreamsToPoints` ile noktaya çevrilir;
   `detectAdventureType` hız/eğimden tür tahmin eder (>12 km/sa bisiklet, >30 km/sa + net iniş
   yamaç paraşütü, km başına >250 m tırmanış + >1.500 m tırmanış, kış + >2.000 m kayak).
3. **Sadeleştirme:** Douglas–Peucker (`routing.ts` `simplifyPoints`), yükseklik ve zaman korunur.
   İstatistikler (`trackStats`): mesafe (Haversine), tırmanış/iniş **3 m histerezis** (GPS
   gürültüsü tırmanışa sayılmaz), süre, azami irtifa, ortalama hız.
4. **Yayın:** `publish()` parçayı `published` yapar ve kümelemeyi tetikler.
5. **Kümeleme (`clusterTracks`):** her parça `cellM/2` aralıkla yeniden örneklenir ve 30 m'lik metrik
   ızgara hücrelerine oturtulur (`snapToGridKey`; boylam ölçeği satır enlemine göre sabit, parçalar
   arası tutarlı). İki parçanın ortak hücre oranı (kısa parçanın hücrelerine göre, 8-komşuluk
   toleranslı) **≥ %60** ise birleşim-bul ile aynı kümeye girer. `minTracks: 2`.
6. **Merkez hattı (`medianCenterline`):** en uzun parça omurga alınır, 30 m'de bir örneklenir; her
   omurga noktası, kümedeki tüm parçaların 45 m içindeki noktalarının ortalamasıyla değiştirilir.
   `mergeIntoExisting` tek parçayı mevcut rotaya 1/(n+1) ağırlıkla karıştırır (artımlı güncelleme).
7. **Popülerlik:** parça sayısı + beğeni toplamı (+ her doğrulama). `bbox` GeoJSON sırası
   `[batı, güney, doğu, kuzey]`.
8. **Doğrulama:** `verifyTrail` kullanıcı başına bir kez; `VERIFY_THRESHOLD = 3` doğrulamada rota
   "doğrulanmış" sayılır ve bağlı parçaların durumu `verified` görünür (`statusFor`).
9. **Navigasyon:** `buildNavigation` köşeleri 12 m toleranslı sadeleştirilmiş çizgide bulur; dönüş
   açısı `<20°` düz (adım üretmez), `20–60` hafif, `60–120` sol/sağ, `120–160` keskin, `≥160` U dönüşü.
   25 m'den kısa adımlar bir öncekiyle birleşir. 60 m içindeki POI adıma bağlanır (`poiName`), başka
   adıma bağlanmayan koridor POI'leri kendi `waypoint` adımını alır; son adım `arrive`.
   `progressAlong` konumu en yakın segmente izdüşürür: kalan mesafe, sonraki adıma mesafe,
   rotadan çıkış (**> 60 m**), ETA (4 km/sa yatay + her 100 m tırmanış için 10 dk — Naismith).
   Adım indeksi geri sıçramaz. `voiceLine` TTS metni üretir (`expo-speech` projede yok; metin
   ekranda gösterilir), `instructionText` i18n anahtarı + parametre döner.
10. **Planlayıcı:** `trackToGraph` rotayı `TrailGraph`'a (ardışık düğüm/kenar, yüzey `trail`, tüm
    profiller) çevirir; `/maps/planner` bugün parametre almadığı için ekranda yalnızca bağlantı var.

## Medya POI türetme kuralları (`poisFromMedia`)

Kaynak: `t.stories`, `t.streams`, `t.posts` (hepsi `coords` taşır). Her medya için metin
(`caption` / `title + description`) ve yerel saat okunur; `poiHeuristics(text, hour)`:

| Tür         | Anahtar kelimeler (tr/en, öncelik sırası)                         |
| ----------- | ----------------------------------------------------------------- |
| `danger`    | tehlike, çığ, düşen kaya, uçurum, dikkat, avalanche, rockfall     |
| `water`     | pınar, çeşme, kaynak suyu, içme suyu, dere, spring, water source  |
| `summit`    | zirve, summit, doruk, peak                                        |
| `viewpoint` | manzara, viewpoint, panorama, gün batımı/doğumu, seyir, view      |
| `shelter`   | barınak, sığınak, kulübe, dağ evi, refuge, hut                    |
| `campsite`  | kamp, çadır, camp, tent, ⛺, bivak, konakla, gece burada          |
| `food`      | kahvaltı, lokanta, yemek, çay molası, restaurant, cafe            |
| `parking`   | otopark, park et, parking                                         |
| `trailhead` | patika başı, başlangıç noktası, trailhead                         |
| `junction`  | kavşak, yol ayrımı, junction, fork                                |

Anahtar kelime yoksa **20:00–06:00** arasındaki paylaşımlar kamp sayılır; gündüz ve ipucu yoksa aday
üretilmez. Tekilleştirme: mevcut bir POI'nin **50 m** içindeki adaylar ve aynı medyadan türemiş
POI'ler atlanır; adaylar kendi aralarında da 50 m ile tekilleştirilir (önce kullanıcının kendi
medyası, sonra en yeni). Aday `source` = `story | stream | post`, `mediaId` kaynak medya, ad
`locationName`'in ilk parçası, not = metin (140 karakter). Kullanıcı onaylayana kadar (`addPoi`)
kaydedilmez; ekranda "Anlarından N nokta türettik — onayla" banner'ı ile sunulur.

## Gizlilik

- **Ev konumu maskesi:** `maskStart(points, 300)` yayınlanan (`isPublic`) parçalarda başlangıç ve
  bitişin 300 m içindeki noktaları kırpar (`save` ve `publish` içinde uygulanır; toplam uzunluk
  900 m'den kısa parçalara dokunulmaz). Böylece ev/araç konumu topluluk rotasına ve GPX dışa
  aktarımına sızmaz.
- Taslak ve gizli parçalar yalnızca sahibine görünür (`filterTracks`, `getById`).
- Medyadan türetilen POI'ler yalnızca kullanıcı onayıyla kalıcı olur; öneri listesi sunucuda
  saklanmaz.
- POI notlarında telefon/adres gibi kişisel veri beklenmez; üretimde moderasyon kuyruğuna alınmalı.

## Üretim önerileri

- **PostGIS:** parçalar `geography(LineString)` olarak saklanır. Kümeleme için
  `ST_ClusterDBSCAN(ST_Centroid(geom), eps := 0.0003, minpoints := 2) OVER ()` ilk ayrım; küme
  içinde `ST_HausdorffDistance(a, b) < 60 m` ya da `ST_Buffer(a, 30) ∩ b` uzunluk oranı ≥ 0,6
  (bu dosyadaki ızgara-örtüşme kuralının karşılığı) ile doğrulama. Merkez hattı `ST_LineMerge` +
  `ST_Simplify(…, 8 m)`; bbox `ST_Envelope`.
- POI yakınlık/tekilleştirme: `ST_DWithin(poi.geom, cand.geom, 50)`; yakın POI sorgusu GiST indeksi.
- Navigasyon adımları istemcide üretilir (saf fonksiyon); büyük rotalarda sunucu önbelleği
  (`community_trail_id`, `version`) yeterlidir.
- Strava: gizli anahtar yalnızca ağ geçidinde (`server/ai-gateway/src/strava.ts`,
  `STRAVA_CLIENT_ID/SECRET`); uygulama `EXPO_PUBLIC_STRAVA_ENABLED=1` ile bağlantı düğmesini açar,
  OAuth dönüşü `zirtan://strava?code=…`. Kapsam yalnızca `read,activity:read`.
- Yükseklik eksik GPX'ler için `WeatherRepository.elevation(points)` ile DEM örneklemesi.
