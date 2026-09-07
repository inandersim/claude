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

/* ==================================================================
 * Görsel boyutlandırma planı
 * ================================================================== */

/**
 * Neden burada bir "plan" var da doğrudan yeniden boyutlandırma yok:
 * boyutlandırmanın kendisi yerel bir modül (`expo-image-manipulator`) ister,
 * yani test edilemez. Oysa asıl karar — hangi ölçüye inileceği, ne zaman
 * hiç dokunulmayacağı — saf aritmetiktir. Kararı burada tutup yerel katmanı
 * ince bırakmak, davranışı testle sabitler.
 */

/** Bir görselin hangi amaçla üretildiği. */
export type MedyaBoyu = 'thumb' | 'full';

export interface BoyutPlani {
  /** Hedef genişlik (piksel). Kaynak zaten küçükse kaynağın kendi ölçüsü. */
  width: number;
  height: number;
  /** JPEG kalitesi 0–1. */
  quality: number;
  /**
   * Kaynak zaten hedeften küçük **ve** yeniden kodlamaya gerek yoksa `true`.
   * Yine de kodlanır (EXIF düşsün diye) ama ölçek değiştirilmez.
   */
  olcekDegismiyor: boolean;
}

/**
 * Uzun kenar üst sınırları.
 *
 * `full` için 1600 px: 3x yoğunluklu bir telefonda tam ekran görsel yaklaşık
 * 1200 px'e denk gelir; 1600 px kırpma/yakınlaştırma payı bırakır. Kameranın
 * ürettiği 4000 px'in ~%84'ü boşuna baytdır — ne ekranda görünür ne de
 * saklamaya değer.
 *
 * `thumb` için 400 px: akıştaki kart görseli en geniş telefonda ~400 px'tir.
 */
export const MEDYA_UZUN_KENAR: Record<MedyaBoyu, number> = {
  full: 1600,
  thumb: 400,
};

/**
 * JPEG kalitesi.
 *
 * `thumb` daha agresif sıkıştırılır: küçük ölçekte sıkıştırma bozulması zaten
 * görünmez, ama akışta 24 görselin toplamı doğrudan faturaya yazılır.
 */
export const MEDYA_KALITE: Record<MedyaBoyu, number> = {
  full: 0.82,
  thumb: 0.7,
};

/**
 * Kaynak ölçüsünden hedef ölçüyü hesaplar. En-boy oranı korunur; görsel
 * **büyütülmez** (küçük bir kaynağı 1600 px'e şişirmek bayt harcar, ayrıntı
 * eklemez).
 */
export function boyutPlani(
  kaynakGenislik: number,
  kaynakYukseklik: number,
  boy: MedyaBoyu,
): BoyutPlani {
  const kalite = MEDYA_KALITE[boy];
  const g = Math.max(0, Math.round(kaynakGenislik));
  const y = Math.max(0, Math.round(kaynakYukseklik));
  // Ölçü bilinmiyorsa (0 ya da bozuk) ölçeklemeye kalkışma: yanlış bir hedef
  // üretmektense yalnızca yeniden kodla (EXIF yine düşer).
  if (!g || !y) return { width: g, height: y, quality: kalite, olcekDegismiyor: true };

  const uzun = Math.max(g, y);
  const sinir = MEDYA_UZUN_KENAR[boy];
  if (uzun <= sinir) return { width: g, height: y, quality: kalite, olcekDegismiyor: true };

  const oran = sinir / uzun;
  return {
    width: Math.max(1, Math.round(g * oran)),
    height: Math.max(1, Math.round(y * oran)),
    quality: kalite,
    olcekDegismiyor: false,
  };
}

/**
 * Küçük boy dosya adı: `abc.jpg` → `abc_thumb.jpg`.
 *
 * Ayrı bir sütun yerine ad kuralı seçilmesinin sebebi: küçük boy adresini
 * saklamak `image_url` taşıyan her tabloya ikinci bir sütun demek. Ad kuralı
 * tek yerde durur. Karşılığında çizim tarafı, küçük boy yoksa (kural
 * öncesinden kalan görseller) tam boya düşmek zorundadır — `AdventureImage`
 * bunu `onError` ile yapar.
 */
export function kucukBoyYolu(yol: string): string {
  const nokta = yol.lastIndexOf('.');
  const egikCizgi = yol.lastIndexOf('/');
  if (nokta <= egikCizgi + 1) return `${yol}_thumb`;
  return `${yol.slice(0, nokta)}_thumb${yol.slice(nokta)}`;
}

/**
 * Adres cihazda mı duruyor?
 *
 * `expo-image-picker` seçilen fotoğrafı `file://…` (ya da Android'de
 * `content://…`, web'de `blob:`/`data:`) olarak verir. Bu adres **yalnızca
 * seçen cihazda** geçerlidir; veritabanına yazılırsa fotoğrafı gönderen
 * kişi dışında herkes kırık görsel görür.
 *
 * Yükleme kararı bu fonksiyondan çıkar: yerelse yüklenmeli, değilse (zaten
 * uzak bir adres, tohum verisi ya da dış bağlantı) dokunulmamalı.
 */
export function yerelMedyaMi(uri: string | null | undefined): boolean {
  const v = uri?.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return false;
  return /^(file:|content:|blob:|data:|ph:|assets-library:)/i.test(v) || v.startsWith('/');
}
