# Zirtan Veri Hattı — Dünya Outdoor Lokasyon Kütüphanesi

Kamp alanları, tırmanış bölgeleri, dalış noktaları, trekking rotaları, rafting/kano parkurları, kayak merkezleri,
yamaç paraşütü kalkış noktaları, zirveler, mağaralar ve acil durum merkezlerini **açık veri** kaynaklarından toplar,
tek bir şemaya dönüştürür ve **SQLite** (tek dosya) ile **PostgreSQL/PostGIS** şemasına yazar.

Bağımlılık gerektirmez: Node 22+ (`fetch`, `node:sqlite`, `node:test`).

## Kaynaklar ve lisanslar

| Kaynak                         | Lisans                                    | Kullanım                                                                 |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| OpenStreetMap — Overpass API   | ODbL 1.0                                  | Nokta/alan verisi, etiketler, telefon, web, açılış saatleri              |
| Wikidata — SPARQL              | CC0                                       | Zirveler (yükseklik), millî parklar, çok dilli adlar, Commons görsel adı |
| Wikimedia Commons — Action API | dosya bazında CC BY / CC BY-SA / CC0 / PD | Fotoğraf + `extmetadata` lisans, yazar, atıf                             |
| Wikipedia REST                 | CC BY-SA 4.0                              | Özet açıklama                                                            |

Her kayıtta `source`, `license`, `attribution` alanları saklanır. Uygulama bu satırları görüntüler
(örn. _"© OpenStreetMap katkıcıları — ODbL"_). Fotoğraflarda yazar + lisans zorunludur.

## Hızlı başlangıç

```bash
# 1) Türkiye kamp alanları + tırmanış + dalış noktalarını çek
node tools/data-pipeline/cli.js import-osm --region TR --kinds campsite,climbing,diving,dive_centre --out data/library

# 2) Zirveler ve millî parklar (Wikidata)
node tools/data-pipeline/cli.js import-wikidata --country TR --out data/library

# 3) Fotoğrafları Commons'tan lisans bilgisiyle zenginleştir
node tools/data-pipeline/cli.js enrich-images --in data/library --limit 500

# 4) Tek dosya SQLite kütüphanesi (FTS5 tam metin arama dahil)
node tools/data-pipeline/cli.js build-sqlite --in data/library --db data/library/zirtan-library.sqlite

# 5) Uygulama için örnek tohum (src/data/library/seed.json)
node tools/data-pipeline/cli.js export-app-seed --db data/library/zirtan-library.sqlite --limit 200
```

```bash
# 6) Wikivoyage seyahat rehberlerini destinasyon taslağı olarak al (CC BY-SA 3.0 — atıf zorunlu)
node tools/data-pipeline/cli.js import-wikivoyage --titles "Everest Base Camp trek,Annapurna Circuit,Kilimanjaro" --lang en --out data/destinations
node tools/data-pipeline/cli.js import-wikivoyage --category "Hiking trails" --lang en --out data/destinations
```

Taslaklar (`wikivoyage-<dil>.ndjson`) "Nasıl gidilir / İzinler / Konaklama / Güvenlik" bölümlerine ayrılmış düz metin içerir;
editör onayından sonra `Destination` kaydına dönüştürülür (bkz. `docs/DESTINATIONS.md`).

`--region world` verildiğinde dünya 10°×10° karolara bölünür, her karo ayrı sorgulanır ve
`data/library/state.json` ile kaldığı yerden devam eder. Overpass hız sınırı (429) için üstel bekleme uygulanır.

> **Dünya ölçeği için öneri:** Overpass yerine [planet extract](https://planet.openstreetmap.org/) indirip
> `osmium tags-filter` ile süzün, ardından `node tools/data-pipeline/cli.js import-osm-file --file filtered.osm.pbf`
> yerine `--geojson` çıktısını verin (`osmium export`). Bu yol hız sınırına takılmaz.

## Yerel disk

Tüm çıktılar `--out` dizinine yazılır; büyük diskinizi bağlayıp `--out /mnt/zirve-data/library` verin.
SQLite dosyası doğrudan uygulamaya (`expo-sqlite`) paketlenebilir ya da sunucuda PostGIS'e yüklenebilir:

```bash
psql zirve < tools/data-pipeline/schema.postgis.sql
node tools/data-pipeline/cli.js export-csv --db data/library/zirtan-library.sqlite --out data/library/places.csv
psql zirve -c "\copy places FROM 'data/library/places.csv' CSV HEADER"
```

## Test

```bash
node --test tools/data-pipeline/test
```
