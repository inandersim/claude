/**
 * Çıkışta bildirim adresinin silinmesi için küçük bir kayıt defteri.
 *
 * Neden böyle: adres silme işi `expo-notifications`'a bağlı; oturum deposunun
 * (`session.store`) yerel bir modüle bağımlı olması katmanları kirletirdi.
 * Bunun yerine bağımlılık ters çevriliyor — bildirim katmanı temizlik işini
 * buraya bırakır, oturum deposu yalnızca "çıkmadan önce temizle" der.
 *
 * Neden çıkıştan **önce**: adres cihaza aittir, oturuma değil. Silinmezse
 * çıkış yapan kullanıcının telefonu eski hesabın bildirimlerini almaya devam
 * eder — başka birine devredilen bir telefonda bu bir gizlilik sorunudur.
 * Silme oturum kapandıktan sonra denenirse RLS reddeder.
 */

let temizlik: (() => Promise<void>) | null = null;

export function pushTemizligiAyarla(fn: (() => Promise<void>) | null): void {
  temizlik = fn;
}

/** Kayıtlı temizliği çalıştırır; yoksa ya da hata verirse sessizce geçer. */
export async function pushTemizligiCalistir(): Promise<void> {
  try {
    await temizlik?.();
  } catch {
    // Ağ yoksa adres sunucuda kalır; dağıtım "DeviceNotRegistered" alınca
    // ayıklar. Çıkışı bu yüzden engellemeyiz.
  }
}
