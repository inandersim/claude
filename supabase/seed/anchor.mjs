/**
 * Dışa aktarım çapası — mock modüllerinden **önce** okunur.
 *
 * Mock tohum dosyaları yüklenirken kendi `Date.now()` tabanlarını alır.
 * Çapa aynı anı yakalasın diye bu modül `export-seed.mjs` içinde ilk sırada
 * içe aktarılır; ESM bağımlılıkları bildirim sırasına göre değerlendirdiği
 * için burada okunan zaman mock tabanlarıyla aynı milisaniyeye düşer ve
 * üretilen aralıklar (86400 saniye gibi) tam sayıya oturur.
 */
export const ANCHOR = Date.now();
