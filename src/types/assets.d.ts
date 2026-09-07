/**
 * Harita yazı tipi paketleri (`.pbf`) Metro tarafından **varlık** olarak
 * paketlenir (bkz. `metro.config.js` → `assetExts`). `require` çağrısı bir
 * varlık kimliği (sayı) döndürür; `expo-asset` bunu cihazdaki gerçek dosyaya
 * çevirir. TypeScript bu uzantıyı tanımadığı için bildirim burada.
 */
declare module '*.pbf' {
  const asset: number;
  export default asset;
}
