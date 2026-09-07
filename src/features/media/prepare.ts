import * as ImageManipulator from 'expo-image-manipulator';

import { MEDYA_KALITE, boyutPlani, type MedyaBoyu } from '@/domain/media';

/**
 * Seçilen fotoğrafı yüklemeye hazırlar: **küçültür ve EXIF'ini düşürür.**
 *
 * ## Neden yeniden kodlamak EXIF'i düşürür
 * `expo-image-manipulator` görseli çözüp yeniden kodlar; çıktı yalnızca
 * piksel verisidir, kaynaktaki EXIF/GPS blokları taşınmaz. Bu, fotoğrafın
 * çekildiği yeri — çoğu zaman kullanıcının evini — paylaşmamanın tek
 * güvenilir yolu. Ölçek değişmese bile **her zaman** yeniden kodlanır:
 * "zaten küçük" bir fotoğrafın EXIF'i de aynı ölçüde mahremdir.
 *
 * ## Neden burada, `src/data` içinde değil
 * Yerel modül bağımlılığı taşır; veri katmanı bunu `MedyaYukleyici`
 * arayüzü üzerinden alır (bkz. `src/data/remote/context.ts`). Karar
 * (hangi ölçü, hangi kalite) `src/domain/media.ts` içinde saf ve testlidir;
 * burada yalnızca o kararın uygulanması var.
 */

export interface HazirMedya {
  uri: string;
  width: number;
  height: number;
}

/** Çıktı biçimi: JPEG. Fotoğraf için PNG'den küçük, WebP'den yaygın. */
export const HAZIR_MIME = 'image/jpeg';

export async function hazirlaGorsel(localUri: string, boy: MedyaBoyu): Promise<HazirMedya> {
  // Ölçüyü öğrenmek için önce boş bir işlemle aç: kaynak ölçüsü bilinmeden
  // hedef hesaplanamaz ve büyütme kaçınılmaz olur.
  const olcu = await ImageManipulator.manipulateAsync(localUri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const plan = boyutPlani(olcu.width, olcu.height, boy);
  if (plan.olcekDegismiyor) {
    // Ölçek değişmiyor ama kalite uygulanmalı — ve bu adım EXIF'i düşürür.
    const sonuc = await ImageManipulator.manipulateAsync(localUri, [], {
      compress: MEDYA_KALITE[boy],
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: sonuc.uri, width: sonuc.width, height: sonuc.height };
  }

  const sonuc = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: plan.width, height: plan.height } }],
    { compress: plan.quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: sonuc.uri, width: sonuc.width, height: sonuc.height };
}
