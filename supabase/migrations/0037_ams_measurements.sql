-- =====================================================================
-- Zirtan — 0037 · AMS kontrolüne ölçüm alanları
--
-- Sözleşme: AmsCheck (src/domain/types.ts), src/domain/altitude.ts
--
-- Bir AMS kontrolü zaten sahadaki sağlık anlık görüntüsüdür; irtifa
-- değerlendirmesinin ihtiyaç duyduğu ölçümler de doğal olarak buraya ait.
-- Ayrı tablo açmak, aynı ana ait iki kaydı birbirine bağlama işi çıkarırdı.
--
-- Hepsi **nullable**: ölçüm cihazı olmayan kullanıcı kontrolü yine yapabilir.
-- Değerlendirme motoru eksik ölçümü "bilinmiyor" sayar, sıfır saymaz.
--
-- CHECK sınırları fizyolojik olarak mümkün aralıklar: amaç doğruluk değil,
-- **saçma girdiyi durdurmak**. Bozuk bir ölçüm, ölçüm olmamasından kötüdür —
-- kullanıcıyı yanlış güvene sokar.
--
-- Tablo KİŞİSEL SAĞLIK VERİSİ taşıyor ve RLS ile yalnızca sahibine açık
-- (0100_rls.sql); bu migration o özelliği değiştirmiyor.
-- =====================================================================

ALTER TABLE ams_checks
  -- Parmak oksimetresi ölçümü (%). 50'nin altı bilinçli bir insanda
  -- beklenmez; böyle bir değer sensör hatasıdır.
  ADD COLUMN spo2       smallint CHECK (spo2       BETWEEN 50 AND 100),
  -- Dinlenme nabzı (atım/dk).
  ADD COLUMN resting_hr smallint CHECK (resting_hr BETWEEN 30 AND 220),
  -- **Manşonla ölçülmüş** kan basıncı. Nabız sensöründen türetilmez;
  -- bkz. src/domain/altitude.ts modül başlığı.
  ADD COLUMN systolic   smallint CHECK (systolic   BETWEEN 60 AND 260),
  ADD COLUMN diastolic  smallint CHECK (diastolic  BETWEEN 30 AND 160),
  -- Büyük tansiyon küçüğünden büyük olmalı; ters girilen ölçüm kabul edilmez.
  ADD CONSTRAINT ams_checks_bp_order CHECK (
    systolic IS NULL OR diastolic IS NULL OR systolic > diastolic
  );

COMMENT ON COLUMN ams_checks.systolic IS
  'Manşonla ölçülen büyük tansiyon. Nabız sensöründen tahmin edilmez.';
