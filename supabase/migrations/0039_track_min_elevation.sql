-- =====================================================================
-- 0039 — parçanın en düşük yüksekliği
--
-- `trackStats` bu değeri kayıt anında zaten hesaplıyordu (max ile aynı
-- döngüde), ama saklanacak bir sütun olmadığı için atılıyordu. Oysa
-- yükseklik aralığı tek başına maksimumdan daha bilgilendiricidir:
-- 2.000 m'de başlayıp 2.400 m'ye çıkan bir yürüyüş ile deniz seviyesinden
-- 2.400 m'ye tırmanan bir rota aynı "maks. 2.400 m" değerini gösterir.
--
-- Nokta dizisinden okuyup türetmek yerine sütun açılmasının sebebi:
-- `points` sadeleştirilmiş (Douglas–Peucker) dizidir — en düşük nokta
-- sadeleştirmede elenmiş olabilir — ve liste ekranları `points` alanını
-- hiç çekmez. Maksimum da aynı sebeple sütunda tutuluyor; simetri korunur.
--
-- NULL "bilinmiyor" demektir: yüksekliksiz içe aktarılmış GPX'ler için.
-- =====================================================================
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS min_elevation_m integer;

COMMENT ON COLUMN tracks.min_elevation_m IS
  'Parçanın en düşük yüksekliği (m). NULL = yükseklik verisi yok.';
