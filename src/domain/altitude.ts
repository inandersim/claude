/**
 * İrtifa fizyolojisi — sahada canlı değerlendirme.
 *
 * `destinations.ts` yolculuğu **önceden** planlar (etap etap tırmanış hızı,
 * aklimatizasyon günleri, Lake Louise öz-değerlendirmesi). Bu modül **o anda**
 * ne olduğuna bakar: bulunduğun irtifa, son 24 saatte ne kadar çıktın, dinlenme
 * nabzın kendi bazaline göre nerede, varsa SpO₂ kaç.
 *
 * ## Kan basıncı hakkında — kasıtlı eksik
 *
 * Bu modül **kan basıncı tahmin etmez** ve etmemelidir. Optik nabız sensörü
 * (akıllı saat, göğüs bandı) atım sayısı ölçer; kan basıncı manşon ya da
 * kullanıcıya özel kalibre edilmiş nabız geçiş süresi (EKG + PPG) yöntemi
 * gerektirir. Nabızdan tansiyon "tahmin etmek" klinik olarak geçersizdir ve
 * SOS taşıyan bir uygulamada kullanıcıyı yanlış güvene sokar.
 *
 * Bunun yerine **ölçülmüş** bir değer (gerçek manşondan) girdi olarak alınır ve
 * irtifa bağlamında yorumlanır — `kanBasinciYorumu`.
 *
 * ## Kapsam
 *
 * Çıktı bir **karar desteğidir, tanı değil.** Eşikler bilinçli olarak
 * temkinlidir: şüphede kalınca daha ağır sonucu verir. Kırmızı bayraklarda
 * (HACE/HAPE düşündüren belirtiler) sonuç her zaman "in ve yardım çağır"dır —
 * hiçbir girdi kombinasyonu bunu "iyisin"e çeviremez.
 */

/* ------------------------------------------------------------------ */
/* Atmosfer                                                            */
/* ------------------------------------------------------------------ */

/** Deniz seviyesi standart basınç (hPa). */
export const DENIZ_SEVIYESI_HPA = 1013.25;

/**
 * Uluslararası Standart Atmosfer'e göre basınç (hPa).
 *
 * Troposfer için geçerli (~11 km'ye kadar); daha yükseği bu uygulamanın konusu
 * değil. Hava durumuna göre gerçek basınç ±%3 sapar — mutlak değer değil,
 * irtifayla nasıl düştüğü önemli.
 */
export function basincHPa(irtifaM: number): number {
  const h = Math.max(0, irtifaM);
  return DENIZ_SEVIYESI_HPA * (1 - 2.25577e-5 * h) ** 5.25588;
}

/** Vücut sıcaklığında su buharı basıncı (mmHg) — akciğerde havayı seyreltir. */
const SU_BUHARI_MMHG = 47;
/** Kuru havada oksijen oranı (irtifadan bağımsız sabit). */
const OKSIJEN_ORANI = 0.2095;
const HPA_TO_MMHG = 0.750062;

/**
 * Solunan oksijen kısmi basıncı (mmHg).
 *
 * Havadaki oksijen **oranı** irtifayla değişmez; değişen toplam basınçtır.
 * "Yukarıda oksijen az" ifadesinin fiziksel karşılığı bu sayıdır.
 */
export function solunanOksijenMmHg(irtifaM: number): number {
  return OKSIJEN_ORANI * (basincHPa(irtifaM) * HPA_TO_MMHG - SU_BUHARI_MMHG);
}

/**
 * İrtifaya göre **beklenen** SpO₂ bandı (%).
 *
 * Saha ölçümlerinden türetilmiş tipik değerler; aklimatize olmuş sağlıklı
 * kişiler için. Kişiler arası fark büyük olduğu için nokta değer değil **bant**
 * dönüyor: bandın altına düşmek anlamlı, bant içinde oynamak değil.
 *
 * Ara irtifalar doğrusal aradeğerleme ile bulunur.
 */
const SPO2_TABLOSU: readonly (readonly [number, number])[] = [
  [0, 98],
  [1500, 96],
  [2500, 94],
  [3500, 90],
  [4500, 86],
  [5500, 81],
  [6500, 76],
];

/** Bandın yarı genişliği (yüzde puan). */
export const SPO2_BANT = 3;

export function beklenenSpo2(irtifaM: number): { alt: number; beklenen: number; ust: number } {
  const h = Math.max(0, irtifaM);
  const ilk = SPO2_TABLOSU[0]!;
  const son = SPO2_TABLOSU[SPO2_TABLOSU.length - 1]!;
  let beklenen: number;
  if (h <= ilk[0]) beklenen = ilk[1];
  else if (h >= son[0]) beklenen = son[1];
  else {
    let i = 0;
    while (i < SPO2_TABLOSU.length - 1 && SPO2_TABLOSU[i + 1]![0] < h) i += 1;
    const [h0, s0] = SPO2_TABLOSU[i]!;
    const [h1, s1] = SPO2_TABLOSU[i + 1]!;
    beklenen = s0 + ((s1 - s0) * (h - h0)) / (h1 - h0);
  }
  return {
    alt: Math.round((beklenen - SPO2_BANT) * 10) / 10,
    beklenen: Math.round(beklenen * 10) / 10,
    ust: Math.min(100, Math.round((beklenen + SPO2_BANT) * 10) / 10),
  };
}

/* ------------------------------------------------------------------ */
/* Nabız                                                               */
/* ------------------------------------------------------------------ */

/**
 * Dinlenme nabzının kendi bazaline göre yükselmesi (%).
 *
 * Mutlak nabız değil **kendi normaline göre sapma** ölçülüyor: 55 atımlık bir
 * sporcuda 70 anlamlıdır, 75 atımlık birinde değil. Bu yüzden bazal değer yoksa
 * `null` döner ve nabız değerlendirmeye hiç katılmaz — uydurma bir bazal
 * varsaymaktansa sinyali kullanmamak doğru.
 */
export function nabizYukselmesi(dinlenmeNabzi: number, bazalNabiz: number | null): number | null {
  if (!bazalNabiz || bazalNabiz <= 0 || dinlenmeNabzi <= 0) return null;
  return Math.round(((dinlenmeNabzi - bazalNabiz) / bazalNabiz) * 1000) / 10;
}

/** Aklimatizasyon sorununu düşündüren nabız yükselmesi eşiği (%). */
export const NABIZ_UYARI_YUZDE = 20;

/* ------------------------------------------------------------------ */
/* Kan basıncı — yalnızca ölçülmüş değerin yorumu                      */
/* ------------------------------------------------------------------ */

export interface KanBasinci {
  /** Büyük tansiyon (mmHg) */
  sistolik: number;
  /** Küçük tansiyon (mmHg) */
  diyastolik: number;
}

export type KanBasinciDurumu = 'dusuk' | 'normal' | 'yuksek' | 'cokYuksek' | 'gecersiz';

/**
 * **Ölçülmüş** kan basıncını yorumlar. Tahmin etmez — girdi gerçek bir
 * manşondan gelmelidir (bkz. modül başlığı).
 *
 * İrtifada sempatik uyarı nedeniyle tansiyon tipik olarak bir miktar yükselir;
 * bu beklenen bir tepkidir. Ama çok yüksek değerler irtifada da normal
 * sayılmaz, o yüzden eşikler irtifaya göre gevşetilmiyor.
 */
export function kanBasinciYorumu(bp: KanBasinci): KanBasinciDurumu {
  const { sistolik: s, diyastolik: d } = bp;
  if (!Number.isFinite(s) || !Number.isFinite(d) || s <= 0 || d <= 0 || d >= s) return 'gecersiz';
  if (s >= 180 || d >= 110) return 'cokYuksek';
  if (s >= 140 || d >= 90) return 'yuksek';
  if (s < 90 || d < 60) return 'dusuk';
  return 'normal';
}

/* ------------------------------------------------------------------ */
/* Değerlendirme                                                       */
/* ------------------------------------------------------------------ */

/** Şiddet sırası **artan**: karşılaştırma bu diziye göre yapılır. */
export const IRTIFA_RISKLERI = ['normal', 'izle', 'dinlen', 'in', 'acil'] as const;
export type IrtifaRiski = (typeof IRTIFA_RISKLERI)[number];

/** Tavsiye kodları — metin i18n'de, karar burada. */
export const TAVSIYELER = [
  'hemenIn',
  'yardimCagir',
  'inisYap',
  'dahaYukseriUyuma',
  'dinlenGunu',
  'yavaslat',
  'hidrasyon',
  'alkolSakinlestiriciYok',
  'spo2Olc',
  'nabizTakip',
  'tansiyonOlc',
  'hekimeDanis',
] as const;
export type TavsiyeKodu = (typeof TAVSIYELER)[number];

export interface IrtifaGirdisi {
  /** Şu anki irtifa (m) */
  irtifaM: number;
  /** Bu gece uyunacak irtifa (m); bilinmiyorsa `null` */
  uykuIrtifaM?: number | null;
  /** Son 24 saatte uyku irtifası kazancı (m); bilinmiyorsa `null` */
  son24saatKazancM?: number | null;
  /** Dinlenme nabzı (atım/dk); bilinmiyorsa `null` */
  dinlenmeNabzi?: number | null;
  /** Kullanıcının deniz seviyesindeki bazal dinlenme nabzı */
  bazalNabiz?: number | null;
  /** Ölçülen SpO₂ (%); bilinmiyorsa `null` */
  spo2?: number | null;
  /** **Ölçülmüş** kan basıncı (manşon); tahmin değil */
  kanBasinci?: KanBasinci | null;
  /** Lake Louise öz-değerlendirme şiddeti; yapılmadıysa `null` */
  amsSiddeti?: 'none' | 'mild' | 'moderate' | 'severe' | null;
  /** Dengesizlik / sendeleme — HACE düşündürür */
  ataksi?: boolean;
  /** Bilinç bulanıklığı — HACE düşündürür */
  bilincBulanikligi?: boolean;
  /** İstirahatte nefes darlığı — HAPE düşündürür */
  istirahatteNefesDarligi?: boolean;
}

export interface IrtifaDegerlendirmesi {
  risk: IrtifaRiski;
  /** Öneriler, **aciliyet sırasına göre** */
  tavsiyeler: TavsiyeKodu[];
  basincHPa: number;
  solunanOksijenMmHg: number;
  spo2Beklenen: { alt: number; beklenen: number; ust: number };
  /** Ölçülen SpO₂ beklenen bandın altında mı */
  spo2Dusuk: boolean;
  nabizYukselmeYuzde: number | null;
  kanBasinciDurumu: KanBasinciDurumu | null;
  /** Değerlendirmeyi bu girdiler sürükledi (şeffaflık için) */
  nedenler: string[];
}

const daha = (a: IrtifaRiski, b: IrtifaRiski): IrtifaRiski =>
  IRTIFA_RISKLERI.indexOf(a) >= IRTIFA_RISKLERI.indexOf(b) ? a : b;

/** Bu irtifanın altında irtifa hastalığı riski pratik olarak yok. */
export const RISK_ESIGI_M = 2500;
/** 3.000 m üzerinde günlük uyku irtifası kazanç sınırı (m). */
export const GUNLUK_KAZANC_SINIRI_M = 500;

/**
 * Girdileri tek bir değerlendirmeye indirger.
 *
 * Kural: risk yalnızca **yükselir**. Her kontrol kendi sonucunu ekler ve en
 * ağırı kazanır; hiçbir olumlu sinyal bir kırmızı bayrağı hafifletemez.
 */
export function irtifaDegerlendir(girdi: IrtifaGirdisi): IrtifaDegerlendirmesi {
  const irtifa = Math.max(0, girdi.irtifaM);
  const nedenler: string[] = [];
  const tavsiyeSeti = new Set<TavsiyeKodu>();
  let risk: IrtifaRiski = 'normal';

  const spo2Beklenen = beklenenSpo2(irtifa);
  const nabizYuzde = girdi.dinlenmeNabzi
    ? nabizYukselmesi(girdi.dinlenmeNabzi, girdi.bazalNabiz ?? null)
    : null;
  const bpDurumu = girdi.kanBasinci ? kanBasinciYorumu(girdi.kanBasinci) : null;
  const spo2Dusuk = typeof girdi.spo2 === 'number' && girdi.spo2 < spo2Beklenen.alt;

  /* --- Kırmızı bayraklar: hiçbir şey bunları hafifletemez --- */
  if (girdi.ataksi || girdi.bilincBulanikligi) {
    risk = 'acil';
    nedenler.push(girdi.ataksi ? 'ataksi' : 'bilinc');
    tavsiyeSeti.add('hemenIn').add('yardimCagir');
  }
  if (girdi.istirahatteNefesDarligi) {
    risk = 'acil';
    nedenler.push('istirahatteNefesDarligi');
    tavsiyeSeti.add('hemenIn').add('yardimCagir');
  }
  if (girdi.amsSiddeti === 'severe') {
    risk = 'acil';
    nedenler.push('amsSiddetli');
    tavsiyeSeti.add('hemenIn').add('yardimCagir');
  }

  /* --- Orta düzey --- */
  if (girdi.amsSiddeti === 'moderate') {
    risk = daha(risk, 'in');
    nedenler.push('amsOrta');
    tavsiyeSeti.add('inisYap').add('dahaYukseriUyuma');
  }
  if (girdi.amsSiddeti === 'mild') {
    risk = daha(risk, 'dinlen');
    nedenler.push('amsHafif');
    tavsiyeSeti.add('dahaYukseriUyuma').add('hidrasyon');
  }

  // SpO₂ bandın çok altındaysa (5 puandan fazla) inişe, azsa izlemeye.
  if (spo2Dusuk) {
    const fark = spo2Beklenen.alt - (girdi.spo2 as number);
    risk = daha(risk, fark > 5 ? 'in' : 'izle');
    nedenler.push('spo2Dusuk');
    if (fark > 5) tavsiyeSeti.add('inisYap');
    tavsiyeSeti.add('dahaYukseriUyuma');
  }

  if (nabizYuzde !== null && nabizYuzde >= NABIZ_UYARI_YUZDE && irtifa >= RISK_ESIGI_M) {
    risk = daha(risk, 'dinlen');
    nedenler.push('nabizYuksek');
    tavsiyeSeti.add('dinlenGunu').add('hidrasyon');
  }

  const kazanc = girdi.son24saatKazancM ?? null;
  if (kazanc !== null && kazanc > GUNLUK_KAZANC_SINIRI_M && irtifa >= RISK_ESIGI_M) {
    risk = daha(risk, 'dinlen');
    nedenler.push('hizliTirmanis');
    tavsiyeSeti.add('yavaslat').add('dahaYukseriUyuma');
  }

  if (bpDurumu === 'cokYuksek') {
    risk = daha(risk, 'in');
    nedenler.push('tansiyonCokYuksek');
    tavsiyeSeti.add('inisYap').add('hekimeDanis');
  } else if (bpDurumu === 'yuksek') {
    risk = daha(risk, 'izle');
    nedenler.push('tansiyonYuksek');
    tavsiyeSeti.add('hekimeDanis');
  }

  /* --- Ölçüm eksikleri: risk yükseltmez, öneri üretir --- */
  if (irtifa >= RISK_ESIGI_M) {
    tavsiyeSeti.add('hidrasyon').add('alkolSakinlestiriciYok');
    if (typeof girdi.spo2 !== 'number') tavsiyeSeti.add('spo2Olc');
    if (!girdi.dinlenmeNabzi || !girdi.bazalNabiz) tavsiyeSeti.add('nabizTakip');
    if (!girdi.kanBasinci && bpDurumu === null && risk !== 'normal') {
      tavsiyeSeti.add('tansiyonOlc');
    }
  }

  // Aciliyet sırası: TAVSIYELER dizisinin sırası.
  const tavsiyeler = TAVSIYELER.filter((k) => tavsiyeSeti.has(k));

  return {
    risk,
    tavsiyeler,
    basincHPa: Math.round(basincHPa(irtifa) * 10) / 10,
    solunanOksijenMmHg: Math.round(solunanOksijenMmHg(irtifa) * 10) / 10,
    spo2Beklenen,
    spo2Dusuk,
    nabizYukselmeYuzde: nabizYuzde,
    kanBasinciDurumu: bpDurumu,
    nedenler,
  };
}

/* ------------------------------------------------------------------ */
/* Ölçüm doğrulama                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fizyolojik olarak mümkün aralıklar. Amaç doğruluk değil **saçma girdiyi
 * durdurmak**: bozuk bir ölçüm, ölçüm olmamasından kötüdür çünkü kullanıcıyı
 * yanlış güvene sokar. Sınırlar migration 0037'deki CHECK'lerle aynı.
 */
export const OLCUM_SINIRLARI = {
  spo2: [50, 100],
  restingHr: [30, 220],
  systolic: [60, 260],
  diastolic: [30, 160],
} as const;

export type OlcumAlani = keyof typeof OLCUM_SINIRLARI;

/**
 * Değeri sınırlar içindeyse döndürür, değilse `null`.
 *
 * `null` "ölçüm yok" demektir ve motor bunu sessizce yok sayar — kırpmak
 * (clamp) yanlış olurdu: 300'lük bir tansiyonu 260'a çekmek uydurma bir
 * ölçüm üretirdi.
 */
export function gecerliOlcum(alan: OlcumAlani, deger: unknown): number | null {
  if (typeof deger !== 'number' || !Number.isFinite(deger)) return null;
  const [alt, ust] = OLCUM_SINIRLARI[alan];
  const yuvarlak = Math.round(deger);
  return yuvarlak >= alt && yuvarlak <= ust ? yuvarlak : null;
}

/** Bir AMS kaydındaki ham ölçümleri temizler; geçersizler `null` olur. */
export function olcumleriTemizle(girdi: {
  spo2?: number | null;
  restingHr?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
}): { spo2: number | null; restingHr: number | null; systolic: number | null; diastolic: number | null } {
  const systolic = gecerliOlcum('systolic', girdi.systolic);
  const diastolic = gecerliOlcum('diastolic', girdi.diastolic);
  // Tansiyon bir çift: biri geçersizse ya da ters girildiyse ikisi de düşer.
  const ciftGecerli = systolic !== null && diastolic !== null && systolic > diastolic;
  return {
    spo2: gecerliOlcum('spo2', girdi.spo2),
    restingHr: gecerliOlcum('restingHr', girdi.restingHr),
    systolic: ciftGecerli ? systolic : null,
    diastolic: ciftGecerli ? diastolic : null,
  };
}
