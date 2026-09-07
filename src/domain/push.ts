/**
 * Anlık bildirim adreslerinin (push token) saf kuralları.
 *
 * `src/domain` altında çünkü hem veri katmanı (kaydetme) hem de özellik
 * katmanı (cihazdan token alma) aynı kuralı kullanıyor; veri katmanı
 * `expo-notifications` gibi yerel bir modüle bağımlı olamaz.
 */

/**
 * Kullanıcı başına saklanan en fazla adres sayısı.
 *
 * Neden sınır: kullanıcı telefon değiştirdikçe eski adresler birikir ve
 * dağıtım her turda ölü cihazlara da gönderim dener. Beş cihaz gerçek bir
 * kullanıcı için fazlasıyla yeterli.
 */
export const TOKEN_TAVANI = 5;

/**
 * Adres listesine yeni adres ekler: en yeni başa gelir, yinelenen ayıklanır,
 * liste tavanla kırpılır.
 *
 * En yeninin başta olması önemli: dağıtım listeyi sırayla deniyor ve en taze
 * cihaz en olası aktif cihazdır.
 */
export function tokenEkle(mevcut: readonly string[], yeni: string, tavan = TOKEN_TAVANI): string[] {
  const temiz = yeni.trim();
  if (!temiz) return [...mevcut];
  return [temiz, ...mevcut.filter((t) => t !== temiz)].slice(0, tavan);
}

/** Çıkışta ya da cihaz devredilirken adresi listeden düşürür. */
export function tokenCikar(mevcut: readonly string[], token: string): string[] {
  const temiz = token.trim();
  return mevcut.filter((t) => t !== temiz);
}

/**
 * Expo push adresi biçimi doğru mu?
 *
 * Sunucuya çöp yazmamak için: bozuk bir adres dağıtımda her turda hata üretir
 * ve kuyruğu yavaşlatır.
 */
export function gecerliToken(token: string): boolean {
  return /^ExponentPushToken\[[^\][\s]+\]$/.test(token.trim());
}

/** İki listenin içeriği aynı mı? (gereksiz yazmayı önler) */
export function tokenListesiAyni(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
