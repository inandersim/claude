/**
 * Harita performans ölçümünün saf kısmı: ham kare süreleri ve sayaçlardan
 * özet çıkarma, bütçeyle karşılaştırma.
 *
 * Neden ayrı dosya: tarayıcı sürücüsü (Playwright) test edilemez, hesap
 * edilebilir. Bütün karar mantığı burada, sürücüde yalnızca ölçüm var.
 *
 * **Ölçümün sınırı bilinçli olarak kodlanmıştır.** Başsız Chromium yazılım
 * GL'i (SwiftShader) kullanır; kare süreleri gerçek telefon GPU'sunu temsil
 * etmez. Bu yüzden metrikler ikiye ayrılır:
 *
 *   · `kesin`  — donanımdan bağımsız (karo sayısı, bayt, katman sayısı).
 *                Bütçe aşımı **bulgu** üretir.
 *   · `gosterge`— zamanlar. Yalnızca raporlanır ve koşumlar arasında
 *                karşılaştırılır; tek başına kapı değildir.
 */

/** 60 fps hedefi. */
export const KARE_BUTCESI_MS = 1000 / 60;

/**
 * "Düşen kare" eşiği: kare bütçesinin **1,5 katı**.
 *
 * Neden 1× değil: kusursuz 60 fps'te ölçülen aralıklar 16,6–16,8 ms arasında
 * salınır. Eşik tam 16,67 olursa akıcı bir haritada bile karelerin yarısı
 * "düşmüş" görünür — ilk ölçümde %61 çıktı ve fps aynı anda 60'tı. 1,5 kat,
 * "en az bir kare atlandı" demenin ölçülebilir karşılığıdır.
 */
export const DUSEN_KARE_CARPANI = 1.5;

/** Sıralı diziden yüzdelik (doğrusal aradeğerleme, NIST/Excel `PERCENTILE.INC`). */
export function yuzdelik(sirali, p) {
  if (!sirali.length) return 0;
  if (sirali.length === 1) return sirali[0];
  const konum = (sirali.length - 1) * p;
  const alt = Math.floor(konum);
  const ust = Math.ceil(konum);
  if (alt === ust) return sirali[alt];
  return sirali[alt] + (konum - alt) * (sirali[ust] - sirali[alt]);
}

/**
 * Kare sürelerinden özet.
 *
 * İlk kare **atılır**: kamera hareketi başlarken ölçülen ilk aralık, bir önceki
 * boşta geçen süreyi de taşır (rAF durur ve yeniden başlar); bu, ölçümü
 * sistematik olarak kötü gösterir.
 */
export function kareOzeti(deltalar, kareButcesi = KARE_BUTCESI_MS * DUSEN_KARE_CARPANI) {
  const temiz = deltalar.slice(1).filter((d) => Number.isFinite(d) && d > 0);
  if (!temiz.length) {
    return { kare: 0, p50: 0, p95: 0, enUzun: 0, dusen: 0, dusenYuzde: 0, fps: 0 };
  }
  const sirali = [...temiz].sort((a, b) => a - b);
  const dusen = temiz.filter((d) => d > kareButcesi).length;
  const toplam = temiz.reduce((a, b) => a + b, 0);
  return {
    kare: temiz.length,
    p50: yuzdelik(sirali, 0.5),
    p95: yuzdelik(sirali, 0.95),
    enUzun: sirali[sirali.length - 1],
    dusen,
    dusenYuzde: (dusen / temiz.length) * 100,
    fps: (temiz.length / toplam) * 1000,
  };
}

/** Ağ yanıtlarından karo sayacı (yalnızca harita kaynakları). */
export function karoOzeti(yanitlar) {
  const ozet = { istek: 0, bayt: 0, pmtiles: 0, glyph: 0, dem: 0 };
  for (const { url, bayt } of yanitlar) {
    if (!/\.pmtiles|\/glyphs\//.test(url)) continue;
    ozet.istek += 1;
    ozet.bayt += bayt || 0;
    if (/-dem\.pmtiles/.test(url)) ozet.dem += 1;
    else if (/\.pmtiles/.test(url)) ozet.pmtiles += 1;
    else ozet.glyph += 1;
  }
  return ozet;
}

/**
 * Katman gruplarının maliyeti: her grup kapalıyken ve açıkken ölçülen
 * değerin farkı. Fark negatifse (gürültü) sıfıra çekilmez — olduğu gibi
 * raporlanır; yuvarlamak, ölçümün gürültülü olduğunu gizlerdi.
 */
export function katmanMaliyeti(temel, acik) {
  return {
    kareP95Ms: acik.p95 - temel.p95,
    dusenYuzde: acik.dusenYuzde - temel.dusenYuzde,
  };
}

/**
 * Bütçe karşılaştırması. Yalnızca `kesin` metrikler kapı üretir;
 * zamanlar `gosterge` olarak döner.
 *
 * @returns {{ bulgular: {anahtar:string, olculen:number, butce:number, mesaj:string}[],
 *             gostergeler: {anahtar:string, deger:number}[] }}
 */
export function butceKarsilastir(olcum, butce) {
  const bulgular = [];
  const gostergeler = [];
  const kesin = butce?.kesin ?? {};
  for (const [anahtar, sinir] of Object.entries(kesin)) {
    const deger = olcum[anahtar];
    if (typeof deger !== 'number') continue;
    if (deger > sinir) {
      bulgular.push({
        anahtar,
        olculen: deger,
        butce: sinir,
        mesaj: `${anahtar}: ${deger} > ${sinir} (bütçe aşıldı)`,
      });
    }
  }
  for (const anahtar of butce?.gosterge ?? []) {
    if (typeof olcum[anahtar] === 'number') gostergeler.push({ anahtar, deger: olcum[anahtar] });
  }
  return { bulgular, gostergeler };
}

/** İki koşum arasındaki değişim yüzdesi; önceki yoksa `null`. */
export function gerilemeYuzdesi(onceki, simdi) {
  if (typeof onceki !== 'number' || onceki <= 0) return null;
  return ((simdi - onceki) / onceki) * 100;
}
