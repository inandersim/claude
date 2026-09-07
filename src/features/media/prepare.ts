import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { MEDYA_KALITE, boyutPlani, type MedyaBoyu } from '@/domain/media';

/**
 * Seçilen fotoğrafı yüklemeye hazırlar: **küçültür ve EXIF'ini düşürür.**
 *
 * ## Neden yeniden kodlamak EXIF'i düşürür
 * Görsel çözülüp yeniden kodlanır; çıktı yalnızca piksel verisidir, kaynaktaki
 * EXIF/GPS blokları taşınmaz. Bu, fotoğrafın çekildiği yeri — çoğu zaman
 * kullanıcının evini — paylaşmamanın tek güvenilir yolu. Ölçek değişmese bile
 * **her zaman** yeniden kodlanır: "zaten küçük" bir fotoğrafın EXIF'i de aynı
 * ölçüde mahremdir.
 *
 * ## Neden `manipulateAsync` değil
 * O işlev SDK 57'de kullanımdan kaldırıldı; yerine bağlam tabanlı
 * `ImageManipulator.manipulate()` geldi. Bağlam ayrıca ölçüyü **ayrı bir
 * kodlama turu olmadan** verir: `renderAsync()` sonucu genişlik/yükseklik
 * taşır, yani kaynağı iki kez kodlamak gerekmez.
 *
 * ## Neden burada, `src/data` içinde değil
 * Yerel modül bağımlılığı taşır; veri katmanı bunu `MedyaYukleyici` arayüzü
 * üzerinden alır (bkz. `src/data/remote/context.ts`). Karar (hangi ölçü,
 * hangi kalite) `src/domain/media.ts` içinde saf ve testlidir; burada
 * yalnızca o kararın uygulanması var.
 */

export interface HazirMedya {
  uri: string;
  width: number;
  height: number;
}

/** Çıktı biçimi: JPEG. Fotoğraf için PNG'den küçük, WebP'den yaygın. */
export const HAZIR_MIME = 'image/jpeg';

export async function hazirlaGorsel(localUri: string, boy: MedyaBoyu): Promise<HazirMedya> {
  const baglam = ImageManipulator.manipulate(localUri);

  // Ölçüyü öğrenmek için önce dönüştürmesiz bir tur: hedef, kaynak ölçüsü
  // bilinmeden hesaplanamaz ve küçük bir görseli büyütmek kaçınılmaz olur.
  const ham = await baglam.renderAsync();
  const plan = boyutPlani(ham.width, ham.height, boy);

  if (plan.olcekDegismiyor) {
    // Ölçek değişmiyor ama kalite uygulanmalı — ve bu kaydetme EXIF'i düşürür.
    const sonuc = await ham.saveAsync({ compress: MEDYA_KALITE[boy], format: SaveFormat.JPEG });
    return { uri: sonuc.uri, width: sonuc.width, height: sonuc.height };
  }

  const olcekli = await baglam
    .reset()
    .resize({ width: plan.width, height: plan.height })
    .renderAsync();
  const sonuc = await olcekli.saveAsync({ compress: plan.quality, format: SaveFormat.JPEG });
  return { uri: sonuc.uri, width: sonuc.width, height: sonuc.height };
}
