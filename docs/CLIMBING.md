# Tırmanış veritabanı (climbing)

theCrag / Mountain Project kalitesinde **kaya → sektör → rota** hiyerarşisi, derece dönüşümü,
kişisel logbook ve topluluk doğrulama akışı.

## Veri modeli

| Varlık               | Alanlar (özet)                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Crag`               | ad, konum, ülke kodu, koordinat, kaya tipi, tırmanış türleri, `routeCount`, `verification`, en iyi aylar (`seasons`, 1–12), yaklaşım süresi                                                                                |
| `CragSector`         | kaya kimliği, ad, yön (`orientation`), `routeCount`                                                                                                                                                                        |
| `ClimbingRoute`      | sektör/kaya kimliği, ad, tür (`sport/trad/boulder/multipitch/ice/alpine`), `grade` + `gradeSystem`, uzunluk, pitch, bolt, yıldız (0–5), ilk çıkış, açıklama, `verification`, `confirmations`, `ascentCount`, `submittedBy` |
| `Ascent`             | rota, kullanıcı, stil (`onsight/flash/redpoint/toprope/attempt`), tarih, not, hissedilen derece                                                                                                                            |
| `routeConfirmations` | `{ userId, routeId }` — bir kullanıcı bir rotayı yalnızca bir kez onaylar                                                                                                                                                  |

Rota dereceleri kaynak sistemde saklanır (spor/çok uzun için Fransız, boulder için Fontainebleau,
ABD verisi için YDS/V-scale). Görüntüleme sırasında kullanıcının tercih ettiği sisteme çevrilir
(`useGradeSystem`, AsyncStorage'da kalıcı).

## Derece dönüşümü

`src/domain/climbing.ts` her dereceyi 10–66 arası ortak bir **zorluk puanına** eşler; sistemler
arası dönüşüm en yakın puanlı dereceyi seçer (eşitlikte kolay olan). İki aile vardır:

- Rota: Fransız (3–9b) · YDS (5.4–5.15b) · UIAA (III–XII+)
- Boulder: Fontainebleau (3–8C+) · V-scale (VB–V17)

Aileler arası dönüşüm (`6a → V?`) tanımsızdır ve `null` döner; `effectiveSystem()` tercih edilen
sistemi rotanın ailesine uyarlar (ör. tercih YDS ise boulder için V-scale).

## Doğrulama kuralları

| Durum        | Koşul                                                  |
| ------------ | ------------------------------------------------------ |
| `unverified` | Yeni kullanıcı gönderimi                               |
| `community`  | ≥ 3 bağımsız onay (`COMMUNITY_CONFIRMATION_THRESHOLD`) |
| `verified`   | Moderatör onayı veya doğrulanmış kulüp gönderimi       |

- Kullanıcı kendi gönderdiği rotayı onaylayamaz; her rota için tek onay hakkı vardır;
  `verified` rotalar için onay gerekmez (`canConfirm`).
- Kayanın doğrulama durumu rota çoğunluğundan türetilir (`cragVerificationOf`): yarıdan fazlası
  `verified` ise verified; `verified + community` yarıdan fazlaysa community; aksi halde unverified.
- Onay ve rota gönderimi kaya/sektör `routeCount` ve `updatedAt` alanlarını günceller.

## İçe aktarma planı

Mock veriler `src/data/mock/seed.climbing.ts` içindedir (10 kaya, 30 sektör, ~60 rota). Gerçek
veriye geçişte iki kaynak hedeflenir:

1. **OpenBeta** (CC BY-SA 4.0) — GraphQL API'sinden alan/sektör/rota ağacı ve YDS/Font dereceleri
   çekilir; `Crag.id` olarak OpenBeta UUID'si korunur, lisans atfı kaya detayında gösterilir.
   Paylaşımlı lisans gereği türetilen düzeltmeler (derece/açıklama) aynı lisansla geri paylaşılır.
2. **theCrag** — yalnızca lisans anlaşması yapılmış bölgeler için (Türkiye kayaları). Dereceler
   theCrag'ın iç puanına yakın olduğu için `gradeScore` tablosu ile eşleştirilir; ithal kayıtlar
   `verified` olarak işaretlenir, topluluk gönderimleri `unverified` başlar.

İçe aktarma sırasında: aynı isim + 200 m yarıçap içindeki kayalar birleştirilir, koordinatı
olmayan rotalar sektörün koordinatını devralır, derece normalize edilemeyen rotalar `unverified`
kalır.
