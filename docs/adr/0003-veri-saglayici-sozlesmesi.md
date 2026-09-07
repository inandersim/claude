# ADR-0003 — Repository sözleşmesi: aynı arayüzün mock ve remote uygulaması

**Durum:** kabul · **Tarih:** 2026-08 · **İlgili:** `docs/REMOTE_PROVIDER.md`, `src/data/repositories/index.ts`

## Bağlam

Uygulama, gerçek sunucu hazır olmadan aylarca geliştirildi. Tipik çözüm (ekranın
içine sahte veri gömmek) sunucu geldiğinde her ekranın yeniden yazılması
demektir. Ayrıca sunucusuz bir demo modu kalıcı bir ihtiyaç: yatırımcı sunumu,
mağaza incelemesi ve çevrimdışı geliştirme.

## Karar

Tek bir sözleşme: `src/data/repositories/index.ts` içindeki repository
arayüzleri. **İki uygulama** vardır ve aynı sözleşmeyi uygular:

- `src/data/mock/` — cihaz üzerinde çalışan sahte veritabanı
- `src/data/remote/` — Supabase/Postgres

Seçim ortam değişkeniyle yapılır (`EXPO_PUBLIC_SUPABASE_URL` tanımlıysa remote).
Ekranlar ve hook'lar hangisinin etkin olduğunu **bilmez**.

## Alternatifler

- **Doğrudan Supabase istemcisi çağırmak:** daha az kod ama demo modu imkânsız,
  test için gerçek sunucu şart.
- **GraphQL katmanı:** esnek; fazladan bir sunucu ve şema bakımı getirir.

## Gerekçe

Sözleşme, iki uygulamanın davranışını karşılaştırılabilir kılar: aynı senaryo
kümesi (`src/data/__tests__/contract/scenarios.ts`) her iki sağlayıcıya da
uygulanır. Bu, "mock'ta çalışıyordu" sınıfı hataları geliştirme sırasında
yakalar.

## Sonuçlar

- Yeni bir özellik **önce sözleşmeye** eklenir; iki uygulama da güncellenmeden
  tip denetimi geçmez.
- Sözleşme testleri gerçek Postgres ister; sunucu yoksa paketler **atlanır**
  (Windows'ta ve CI'nın veritabanısız işlerinde normal davranış).
- Sözleşme genişledikçe yük artar; bu, bilinçli olarak ödenen bedeldir.
