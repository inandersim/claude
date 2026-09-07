# ADR-0007 — Kendi arka uç platformumuzu yazmıyoruz

**Durum:** kabul · **Tarih:** 2026-09 · **İlgili:** `docs/SCALE.md`, `docs/REMOTE_PROVIDER.md`, `ADR-0003`

## Bağlam

Soru şuydu: supabase.com'da veri tutmak yerine **Supabase/Firebase benzeri
kendi altyapımızı** yazsak daha iyi olmaz mı?

Soru meşru. Aylık fatura ölçüldü (`docs/SCALE.md`) ve sağlayıcıya bağımlılık
tek kişilik bir ekip için gerçek bir risk.

## Karar

**Platform yazmıyoruz.** Supabase yönetilen hizmet olarak kullanılıyor;
karşılığında **taşınabilirlik ölçülüyor ve korunuyor.**

## Gerekçe

### 1. Zor kısım zaten bizim

Supabase = Postgres + PostgREST + GoTrue + Realtime + Storage + Deno çalışma
zamanı + panel. Bunların hepsi açık kaynak. Supabase bize **kod** satmıyor,
**işletim** satıyor.

138 tablo, 383 indeks, RLS politikaları ve 38 migration düz Postgres'tir;
içinde Supabase'e özgü tek satır yok.

### 2. Kilitlenme yüzeyi ölçüldü: dört dosya

| Dosya | Satır | Ne bağlıyor |
| --- | ---: | --- |
| `src/data/remote/postgrest.ts` | 241 | PostgREST arayüz tanımı (açık standart) |
| `src/data/remote/client.ts` | 66 | istemci kurulumu |
| `src/data/remote/storage.ts` | 238 | dosya yükleme |
| `src/data/remote/realtime.ts` | 156 | canlı abonelik |

`@supabase/supabase-js` yalnızca **iki** dosyada içe aktarılıyor. 39 modül,
145 ekran ve 26 repository'nin hiçbiri sağlayıcıyı görmüyor.

### 3. İkinci uygulama zaten var ve çalışıyor

`src/data/__tests__/contract/pgPostgrest.ts` (890 satır) aynı `SupabaseLike`
yüzeyini **doğrudan Postgres'e** karşı uyguluyor ve sözleşme testleri her
koşumda bunu gerçek bir veritabanında çalıştırıyor.

Yani "Supabase'den çıkabilir miyiz" sorusunun cevabı teorik değil: **en büyük
adaptörün çalışan bir alternatifi depoda duruyor ve test ediliyor.**

### 4. Asıl maliyet para değil, nöbet

Kendi altyapını işletmek: yedekleme, sürüm yükseltme, güvenlik yaması, kesinti,
gece 3'te uyanmak. Tek kişilik ekipte bunun karşılığı yok — ve **SOS taşıyan
bir uygulamada kesinti ticari değil güvenlik sorunudur.** Aylık $25 esasen
bunun sigortası.

### 5. Firebase karşılaştırması konu dışı

Firebase'in ilişkisel olmayan modeli PostGIS'li coğrafi sorgular, RLS ve
migration disiplini için zaten kötü bir seçim. O yarışa girmeye gerek yok.

## Sonuç

- Sağlayıcıdan çıkmak **dört adaptör dosyasını değiştirmek** demek; biri zaten
  yazılmış durumda.
- Kilitlenme yüzeyinin büyümemesi bir testle korunuyor
  (`src/data/__tests__/vendorSurface.test.ts`).
- Kendi sunucusunda barındırma (Hetzner'de ~$6/ay) **hacim büyüdüğünde ve
  işletecek biri olduğunda** yeniden değerlendirilir. Bugün değil.

## Alternatifler

- **Kendi platformunu yaz:** yıllar sürer, çekirdek ürünle ilgisiz, tek kişilik
  ekiple işletilemez.
- **Supabase'i kendi sunucunda barındır:** faturayı düşürür, egress'i sıfırlar;
  ama nöbet borcunu bugün ödeyemiyoruz. Karar ertelendi, kapı açık.
- **Firebase:** veri modeli uyumsuz, kilitlenme daha derin.
