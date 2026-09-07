/**
 * Renk kontrastı — WCAG 2.1 oranı ve okunur renk üretimi.
 *
 * ## Neden var
 * `ADVENTURE_TYPE_META`, `DIFFICULTY_META` gibi tablolar tek bir sabit palet
 * tutuyor ve o palet koyu tema için seçilmiş: parlak, doygun renkler. Aynı
 * renkler açık temanın krem/beyaz zemininde etiket metni olarak kullanılınca
 * kontrast 1.35–2.44 arasına düşüyor — ikon için gereken 3.0'ın, normal metin
 * için gereken 4.5'in altında. Tarayıcıda ölçüldü.
 *
 * ## Neden 40 tane açık-tema rengi elle yazılmadı
 * Her etiket için ikinci bir renk tanımlamak, listeye eklenen 41'inci türün
 * sessizce eski davranışa dönmesi demek. Kontrast bir tasarım tercihi değil
 * ölçülebilir bir eşik: eşiği tutturana kadar rengi **koyulaştırmak** hem
 * mevcut hem gelecekteki her rengi kapsar ve rengin kimliğini (ton) korur.
 *
 * ## Ne yapmıyor
 * Fotoğraf üzerindeki gradyan ve beyaz metin gibi zemini temadan bağımsız
 * yerlere dokunulmaz — orada renk zaten doğru ve bu modül çağrılmaz.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#RGB` / `#RRGGBB` → bileşenler. Tanınmayan biçimde `null`. */
export function hexToRgb(hex: string): Rgb | null {
  const v = hex.trim().replace(/^#/, '');
  if (v.length === 3) {
    const [r, g, b] = v.split('').map((c) => parseInt(c + c, 16));
    return Number.isNaN(r! + g! + b!) ? null : { r: r!, g: g!, b: b! };
  }
  if (v.length !== 6 || !/^[0-9a-f]{6}$/i.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const k = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${k(r)}${k(g)}${k(b)}`.toUpperCase();
}

/** WCAG göreli parlaklık (0–1). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** İki renk arasındaki WCAG kontrast oranı (1–21). */
export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA eşikleri: büyük metin/ikon 3.0, normal metin 4.5. */
export const AA_BUYUK = 3;
export const AA_NORMAL = 4.5;

/**
 * Rengi, verilen zemine karşı eşiği tutturana kadar zemine göre koyulaştırır
 * ya da açar; ton (hue) korunur, yalnızca parlaklık değişir.
 *
 * Karışım siyaha/beyaza doğru yapılır çünkü bu, tonu bozmadan parlaklığı
 * değiştirmenin en ucuz ve en öngörülebilir yolu — HSL üzerinden gitmek aynı
 * adımda doygunluğu da kaydırabiliyor.
 *
 * Eşik hiç tutturulamazsa (kuramsal olarak olmamalı) en iyi deneme döner:
 * hiç renk döndürmemek, okunmayan bir renkten daha kötüdür.
 */
export function okunurRenk(renk: string, zemin: string, esik: number = AA_BUYUK): string {
  const kaynak = hexToRgb(renk);
  const arka = hexToRgb(zemin);
  if (!kaynak || !arka) return renk;
  if (contrastRatio(renk, zemin) >= esik) return renk;

  // Zemin açıksa rengi karartmak gerekir, koyuysa açmak.
  const hedef: Rgb = relativeLuminance(arka) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

  let enIyi = renk;
  let enIyiOran = contrastRatio(renk, zemin);
  // %2'lik adımlarla karıştır; 50 adım kaynaktan hedefe tam geçiş demek.
  for (let i = 1; i <= 50; i++) {
    const t = i / 50;
    const karisim = rgbToHex({
      r: kaynak.r + (hedef.r - kaynak.r) * t,
      g: kaynak.g + (hedef.g - kaynak.g) * t,
      b: kaynak.b + (hedef.b - kaynak.b) * t,
    });
    const oran = contrastRatio(karisim, zemin);
    if (oran > enIyiOran) {
      enIyiOran = oran;
      enIyi = karisim;
    }
    if (oran >= esik) return karisim;
  }
  return enIyi;
}
