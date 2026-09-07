-- =====================================================================
-- Zirtan — 0038 · Bazal dinlenme nabzı
--
-- Sözleşme: User.baselineRestingHr (src/domain/types.ts),
--           nabizYukselmesi (src/domain/altitude.ts)
--
-- İrtifada dinlenme nabzının yükselmesi aklimatizasyon sinyalidir — ama
-- **mutlak değer anlamsızdır**: 55 atımlık bir sporcuda 70 ciddi bir sapma,
-- 75 atımlık birinde değil. Sapma ancak kişinin kendi bazaline göre okunur.
--
-- Bu yüzden bazal, kontrol kaydına değil **profile** ait: kişisel bir sabit,
-- ölçüm anına ait bir veri değil.
--
-- Nullable: bilmeyen kullanıcı için motor nabız sinyalini hiç kullanmıyor
-- (uydurma bir bazal varsaymaktansa sinyali atlamak doğru).
-- =====================================================================

ALTER TABLE profiles
  ADD COLUMN baseline_resting_hr smallint
    CHECK (baseline_resting_hr BETWEEN 30 AND 220);

COMMENT ON COLUMN profiles.baseline_resting_hr IS
  'Deniz seviyesindeki dinlenme nabzı. İrtifadaki sapma buna göre ölçülür.';
