/**
 * Telemetri temizleyicisi — olay gönderilmeden önce kişisel veriyi çıkarır.
 *
 * Bu dosya güvenlik sınırıdır: buradan geçmeyen hiçbir metin ağa çıkmaz.
 * Kural basittir — **şüpheliyse gizle**. Yanlışlıkla gizlenen bir dize hata
 * ayıklamayı biraz zorlaştırır; sızan bir e-posta ise KVKK ihlalidir.
 */

/** Gerçek kimlikleri rota şablonuna çeviren desenler. */
const ROUTE_ID_PATTERNS: [RegExp, string][] = [
  // Bilinen önekli kimlikler: her_gobeklitepe, crs_tdf_basic, u_elif …
  [/\/(?:[a-z]{1,6}_)[A-Za-z0-9_-]{2,}/g, '/[id]'],
  // UUID
  [/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[id]'],
  // Salt sayı ya da kısa kimlik: /post/p1, /hazards/h12
  // (`/v1` gibi API sürüm ekleri kimlik değildir, dışarıda bırakılır)
  [/\/(?!v\d+(?:\/|$))[a-z]{0,3}\d+(?=\/|$)/g, '/[id]'],
  // Slug (üç tireden fazla) — makale/ilk yardım
  [/\/[a-z0-9]+(?:-[a-z0-9]+){2,}/g, '/[slug]'],
  // Ülke kodu dışındaki büyük harfli kimlikler
  [/\/[A-Z0-9_]{6,}/g, '/[id]'],
];

/** Serbest metinde gizlenecek kişisel veri desenleri. */
const PII_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[eposta]'],

  // Koordinat çifti: 41.0082, 28.9784
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, '[konum]'],
  // Taşıyıcı jeton / anahtar
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}=*/gi, '[jeton]'],
  [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[jwt]'],
  [/\b(?:sk|pk|api[_-]?key|token|secret|password|şifre)["'\s:=]+[^\s"',;]{6,}/gi, '[gizli]'],
  // Kart numarası benzeri 13–19 haneli diziler
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g, '[kart]'],
  // TC kimlik benzeri 11 hane
  [/\b\d{11}\b/g, '[kimlik]'],
  // Uluslararası telefon: +90 5xx …, 10+ rakam
  [/\+?\d[\d\s()-]{8,}\d/g, '[telefon]'],
];

/** Yığın izinde kullanıcıya özgü dosya yollarını kısaltır. */
const PATH_PATTERNS: [RegExp, string][] = [
  [/(?:file:\/\/)?\/(?:Users|home)\/[^/\s)]+/g, '~'],
  [/https?:\/\/(?:localhost|\d+\.\d+\.\d+\.\d+)(?::\d+)?/g, '[yerel]'],
  [/\/data\/(?:user|data)\/\d+\/[\w.]+/g, '[uygulama]'],
];

/**
 * Rotayı şablona çevirir: `/heritage/her_gobeklitepe` → `/heritage/[id]`.
 * Kimlikler kullanıcıya özgü olabildiği için ham hâliyle gönderilmez.
 */
export function scrubRoute(route: string | null | undefined): string | undefined {
  if (!route) return undefined;
  let out = route.split('?')[0]?.split('#')[0] ?? '';
  if (!out) return undefined;
  for (const [pattern, replacement] of ROUTE_ID_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.slice(0, 120);
}

/** Serbest metinden kişisel veriyi çıkarır ve uzunluğu sınırlar. */
export function scrubText(text: string | null | undefined, maxLength = 500): string {
  if (!text) return '';
  let out = String(text);
  for (const [pattern, replacement] of PATH_PATTERNS) out = out.replace(pattern, replacement);
  for (const [pattern, replacement] of PII_PATTERNS) out = out.replace(pattern, replacement);
  return out.slice(0, maxLength).trim();
}

/** Yığın izini temizler ve ilk N kareyle sınırlar. */
export function scrubStack(stack: string | null | undefined, maxFrames = 12): string | undefined {
  if (!stack) return undefined;
  const frames = String(stack)
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, maxFrames)
    .map((line) => scrubText(line, 200));
  return frames.length ? frames.join('\n') : undefined;
}

/** İstek yolunu şablona çevirir; sorgu dizesi tamamen atılır. */
export function scrubEndpoint(url: string | null | undefined): string {
  if (!url) return '[bilinmiyor]';
  let path = String(url);
  try {
    // Mutlak adreste yalnızca yol tutulur; ana bilgisayar adı da bilgi sızdırabilir.
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    // Ayrıştırılamıyorsa ham dizeyi temizleyerek kullan.
  }
  return scrubRoute(path) ?? '[bilinmiyor]';
}

/**
 * Oturum için geri döndürülemez özet üretir.
 *
 * Kriptografik olmayan ama tek yönlü bir karma (FNV-1a) yeterlidir: amaç
 * kimlik doğrulamak değil, aynı oturumun olaylarını gruplamaktır. Girdi
 * asla saklanmaz, yalnızca 8 haneli onaltılık çıktı taşınır.
 */
export function sessionHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Aynı hatanın tekrarlarını birleştirmek için kararlı imza üretir.
 * Aynı tür + rota + mesaj → aynı kimlik, böylece cihazda toplulaştırılır.
 */
export function eventSignature(kind: string, route: string | undefined, key: string): string {
  return `${kind}:${sessionHash(`${kind}|${route ?? ''}|${key}`)}`;
}
