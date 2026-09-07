# ADR-0004 — Rota veri modeli ve planlama motoru

**Durum:** kabul · **Tarih:** 2026-09 · **İlgili:** `docs/MAPS_PIPELINE.md`, `src/domain/routing.ts`

## Bağlam

"Şuradan şuraya yürüyüş rotası öner" isteği, uygulamanın en ayırt edici
özelliği. Ticari yönlendirme servisleri araç odaklıdır; patika, SAC zorluk
derecesi, yüzey ve mevsimsel geçilebilirlik gibi doğa verilerini ya taşımaz ya
da ücretlendirir. Ayrıca çevrimdışı çalışmalıdır.

## Karar

OpenStreetMap yürüyüş/bisiklet yolları kendi hattımızla **TrailGraph**'a
çevrilir (`tools/tiles/lib/osm-graph.mjs`): düğümler kavşaklar, kenarlar patika
parçaları; her kenarda yüzey, SAC teknik derecesi, erişim kuralları ve yükselti
profili taşınır. Derece-2 düğümler sadeleştirilir (~%75 küçülme).

Planlama **A\*** ile yapılır (`src/domain/routing.ts`); maliyet fonksiyonu
**Tobler yürüyüş hızı** bağıntısını kullanır, yani eğim yönü ve şiddeti süreye
yansır.

## Alternatifler

- **OSRM / GraphHopper sunucusu:** güçlü; ayakta sunucu ister, çevrimdışı yok.
- **Düz çizgi + mesafe tahmini:** ucuz ama dağda tehlikeli derecede yanıltıcı.
- **Ticari rota API'si:** doğa verisi zayıf, maliyet kullanıcıyla doğru orantılı.

## Gerekçe

Graf küçük ve dosya olarak taşınabilir; karo paketiyle birlikte cihaza iner ve
telefon kendi başına rota hesaplar. Tobler bağıntısı, "5 km düz" ile "5 km 800 m
tırmanış" arasındaki farkı süreye yansıtır — doğada tek anlamlı ölçü budur.

## Sonuçlar

- A\* sezgiselinin **kabul edilebilir** kalması zorunlu: hız üst sınırı gerçek
  en yüksek hızın altına düşerse motor en kısa rotayı bulamaz. (Bir kez
  yaşandı: `gravel` üst sınırı 28 km/s iken yokuş aşağı 28,8 km/s'ye
  ulaşıyordu.)
- Graf üretimi OSM güncellemelerine bağlı; bölge paketleri periyodik yenilenmeli.
- Kapalı/yasaklı yol bilgisi OSM'nin doğruluğu kadar iyidir; kullanıcıya kaynak
  ve tazelik gösterilmeli (`docs/AI_CTO.md` §12).
