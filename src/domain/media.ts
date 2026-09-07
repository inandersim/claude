/**
 * Medya adreslerinin CDN'e yönlendirilmesi ve önbellek politikası.
 *
 * **Neden var — ölçülmüş fatura.** Kullanıcı fotoğrafları Supabase Storage'dan
 * servis edilirse her okuma faturalı çıkıştır. Akışta ~24 görsel, görsel başına
 * ~400 KB, günde 4 açılış ve yerelde %50 önbellek varsayımıyla:
 *
 *     1.000 kullanıcı    →    549 GB/ay  →  ~$27
 *    10.000 kullanıcı    →  5.493 GB/ay  →  ~$472
 *   100.000 kullanıcı    → 54.932 GB/ay  →  ~$4.921
 *
 * Bu, JSON trafiğinin 60 katı; sistemin en büyük kalemi.
 *
 * **Çözüm neden proxy, neden ayrı bir depo değil:** dosyaları R2'ye taşımak
 * S3 imzalama istemcisi, ayrı yükleme yolu ve göç işi demek. Oysa maliyetin
 * tamamı **okumada**. Depolamayı olduğu yerde bırakıp okumayı çıkışı ücretsiz
 * bir CDN'in (Cloudflare) arkasına almak aynı sonucu üçte bir işle veriyor:
 * ilk okuma Supabase'e gider, gerisi CDN önbelleğinden.
 *
 * Adres yazımı **çizim anında** yapılıyor, kaydederken değil: veritabanında
 * hâlihazırda duran adresler de yönlenir ve CDN kapatılırsa uygulama hiçbir
 * göç gerektirmeden eski davranışına döner.
 */

/**
 * Yüklenen dosyaların önbellek ömrü.
 *
 * Dosya adları her yüklemede benzersiz üretiliyor, yani içerik **değişmez**.
 * Değişmeyen içerik için bir saat (eski değer) CDN'in işe yaramasını
 * engelliyordu: her saat başı kaynağa geri dönülüyordu. Bir yıl + `immutable`
 * doğrusu.
 */
export const MEDYA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Supabase Storage genel adresinin gövdesi. */
const SUPABASE_PUBLIC = '/storage/v1/object/public/';

/**
 * Genel medya adresini CDN'e yönlendirir.
 *
 * Dokunulmayanlar (olduğu gibi döner):
 *   · CDN tanımlı değilse
 *   · adres Supabase Storage genel adresi değilse (dış görsel, `data:`, yerel dosya)
 *   · adres zaten CDN'deyse
 *
 * @param url     veritabanındaki ya da yüklemeden dönen adres
 * @param cdnBase `https://cdn.ornek.app` (sondaki `/` önemsiz)
 */
export function medyaUrl(url: string | null | undefined, cdnBase?: string | null): string | null {
  // Boş adres `null`'a normalleşir: `{ uri: '' }` görsel bileşenine boşuna bir
  // yükleme denemesi yaptırır, yedek görsel zaten `null`'da devreye giriyor.
  if (!url?.trim()) return null;
  const taban = cdnBase?.trim().replace(/\/+$/, '');
  if (!taban) return url;
  if (url.startsWith(`${taban}/`)) return url;

  const i = url.indexOf(SUPABASE_PUBLIC);
  if (i === -1) return url;
  // Yalnızca http(s) adresleri yönlendirilir; `file://` ya da `data:` değil.
  if (!/^https?:\/\//i.test(url)) return url;

  const yol = url.slice(i + SUPABASE_PUBLIC.length);
  if (!yol) return url;
  return `${taban}/${yol}`;
}

/** Yapılandırılmış CDN tabanı; tanımsızsa `null`. */
export function medyaCdnTabani(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const v = env.EXPO_PUBLIC_MEDIA_CDN_URL?.trim();
  return v ? v.replace(/\/+$/, '') : null;
}
