import { File } from 'expo-file-system';

import type { MedyaYukleyici } from '@/data/remote/context';
import type { SupabaseLike } from '@/data/remote/postgrest';
import { BUCKETS, uploadMedia, type BucketId } from '@/data/remote/storage';
import { kucukBoyYolu } from '@/domain/media';

import { HAZIR_MIME, hazirlaGorsel } from './prepare';

/**
 * `MedyaYukleyici` uygulaması: cihazdaki bir fotoğrafı **iki boyda** yükler
 * ve tam boyun genel adresini döner.
 *
 * ## Neden iki boy
 * Aynı ~400 KB dosya hem akıştaki 400 px'lik kartta hem tam ekranda
 * kullanılıyordu. Akışta 24 görselin tamamı tam boyda inince hem fatura hem
 * kaydırma performansı bundan zarar görür. Küçük boy ~%90 daha az bayttır.
 *
 * ## Neden ayrı bir sütun değil, ad kuralı
 * Küçük boyun adresini saklamak `image_url` taşıyan **her** tabloya ikinci
 * bir sütun demek. Ad kuralı (`abc.jpg` → `abc_thumb.jpg`) tek yerde durur.
 * Karşılığında çizim tarafı, küçük boy yoksa (bu kuraldan önce yüklenmiş
 * görseller) tam boya düşmek zorundadır.
 *
 * ## Küçük boy başarısız olursa
 * Yükleme **başarısız sayılmaz**: tam boy zaten yüklenmiştir ve çizim tarafı
 * küçük boy 404'ünde tam boya düşer. Kullanıcının gönderisini bir küçük
 * resim yüzünden kaybetmek, biraz fazla bayt harcamaktan kötüdür.
 */
export function createMedyaYukleyici(client: SupabaseLike): MedyaYukleyici {
  return async ({ bucket, userId, localUri }) => {
    const kova = bucket as BucketId;
    if (!BUCKETS[kova]) throw new Error(`Bilinmeyen kova: ${bucket}`);

    const tam = await hazirlaGorsel(localUri, 'full');
    const sonuc = await uploadMedia(client, {
      bucket: kova,
      userId,
      bytes: await baytlar(tam.uri),
      contentType: HAZIR_MIME,
    });

    try {
      const kucuk = await hazirlaGorsel(localUri, 'thumb');
      await uploadMedia(client, {
        bucket: kova,
        userId,
        bytes: await baytlar(kucuk.uri),
        contentType: HAZIR_MIME,
        // Kullanıcı klasörü `buildPath` tarafından ekleniyor; burada yalnızca
        // dosya adı verilir.
        fileName: kucukBoyYolu(sonuc.path.split('/').pop() ?? 'foto.jpg'),
        upsert: true,
      });
    } catch {
      // Küçük boy yoksa çizim tarafı tam boya düşer; gönderiyi düşürmeyiz.
    }

    // Kapalı kovada genel adres yoktur; imzalı adres okuma anında istenir.
    return sonuc.publicUrl ?? `${sonuc.bucket}/${sonuc.path}`;
  };
}

/** Yerel dosyayı baytlara çevirir (yeni `expo-file-system` API'si). */
async function baytlar(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
