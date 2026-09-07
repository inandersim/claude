/**
 * Paketlenmiş SDF glyph'leri — varsayılan (web ve test) uygulama.
 *
 * Web'de glyph'ler `public/glyphs/` altından HTTP ile okunur; uygulama paketine
 * gömmenin bir anlamı yok. iOS/Android'de ise ağ olmayabilir: orada glyph'ler
 * uygulamayla birlikte gelir ve cihaz diskine açılır — `glyphs.native.ts`.
 *
 * Metro platform dosyasını kendisi seçer; bu dosya aynı zamanda TypeScript'in
 * gördüğü sözleşmedir, iki uygulamanın imzası birebir aynı olmak zorunda.
 */

/** Uygulamayla gelen kod noktası blokları (yerel derlemede doludur). */
export const BUNDLED_RANGES: readonly string[] = [];

/**
 * Cihaz diskine açılmış glyph'lerin `{fontstack}/{range}.pbf` şablonu.
 * Web'de paketlenmiş glyph yok — çağıran uzak adrese düşer.
 */
export async function bundledGlyphsUrl(): Promise<string | null> {
  return null;
}

/** Test/geliştirme için önbelleği sıfırlar. */
export function resetBundledGlyphs(): void {}
