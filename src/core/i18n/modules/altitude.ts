import { localeSet } from './shared';

const tr = {
  title: 'İrtifa durumu',
  subtitle: 'Bulunduğun yükseklikte vücudun ne yaşıyor',

  risk: {
    normal: 'Belirti yok',
    izle: 'İzle',
    dinlen: 'Dinlen, daha yükseğe çıkma',
    in: 'Aşağı in',
    acil: 'Acil: hemen in ve yardım çağır',
  },

  advice: {
    hemenIn: 'Hemen aşağı in — beklemeden, en az 500–1.000 m.',
    yardimCagir: 'Yardım çağır (112). Yanındakiler durumu bilsin, seni yalnız bırakmasınlar.',
    inisYap: 'Bugün 300–1.000 m aşağı in ve orada kal.',
    dahaYukseriUyuma: 'Bu gece dünkünden daha yüksekte uyuma.',
    dinlenGunu: 'Bir dinlenme günü ver; aynı irtifada kal.',
    yavaslat: 'Tırmanış hızını düşür: 3.000 m üstünde uyku irtifasını günde 500 m’den fazla artırma.',
    hidrasyon: 'Sık sık su iç. Kuru ve soğuk hava sıvı kaybını fark ettirmez.',
    alkolSakinlestiriciYok: 'Alkol ve uyku ilacı alma — solunumu baskılar, belirtileri gizler.',
    spo2Olc: 'Varsa parmak oksimetresiyle SpO₂ ölç; ölçüm tahminden iyidir.',
    nabizTakip: 'Deniz seviyesindeki dinlenme nabzını kaydet — sapma ancak kendi normalinle anlam kazanır.',
    tansiyonOlc: 'Tansiyonunu gerçek bir manşonla ölç. Nabız sensörü tansiyon ölçmez.',
    hekimeDanis: 'Bir hekime danış. İlaç kararını (asetazolamid vb.) kendi başına verme.',
  },

  reason: {
    ataksi: 'Denge kaybı / sendeleme',
    bilinc: 'Bilinç bulanıklığı',
    istirahatteNefesDarligi: 'İstirahatte nefes darlığı',
    amsSiddetli: 'Şiddetli AMS belirtileri',
    amsOrta: 'Orta düzey AMS belirtileri',
    amsHafif: 'Hafif AMS belirtileri',
    spo2Dusuk: 'SpO₂ bu irtifa için beklenenin altında',
    nabizYuksek: 'Dinlenme nabzı kendi bazalinin belirgin üstünde',
    hizliTirmanis: 'Son 24 saatte uyku irtifası çok arttı',
    tansiyonCokYuksek: 'Ölçülen tansiyon çok yüksek',
    tansiyonYuksek: 'Ölçülen tansiyon yüksek',
  },

  bp: {
    label: 'Tansiyon (ölçülen)',
    dusuk: 'Düşük',
    normal: 'Normal',
    yuksek: 'Yüksek',
    cokYuksek: 'Çok yüksek',
    gecersiz: 'Ölçüm anlamsız görünüyor — tekrar ölç',
    /** Kullanıcıya neden tahmin göstermediğimizi açıkça söyleyen metin. */
    noEstimate:
      'Tansiyon tahmin edilmez. Akıllı saat ve nabız bantları atım sayısı ölçer; tansiyon için manşon gerekir. Ölçtüğün değeri girersen irtifa bağlamında yorumlarız.',
  },

  metric: {
    pressure: 'Hava basıncı',
    inspiredO2: 'Solunan oksijen',
    expectedSpo2: 'Bu irtifada beklenen SpO₂',
    hrRise: 'Nabız yükselmesi',
    vsSeaLevel: 'deniz seviyesinin %{{percent}}’i',
  },

  disclaimer:
    'Bu bir karar desteğidir, tanı değildir. Belirtiler kötüleşiyorsa ya da şüphedeysen: in ve yardım çağır.',
};

const en: typeof tr = {
  title: 'Altitude status',
  subtitle: 'What your body is dealing with at this elevation',

  risk: {
    normal: 'No symptoms',
    izle: 'Watch',
    dinlen: 'Rest, do not go higher',
    in: 'Descend',
    acil: 'Emergency: descend now and call for help',
  },

  advice: {
    hemenIn: 'Descend now — without waiting, at least 500–1,000 m.',
    yardimCagir: 'Call for help (112). Make sure others know and do not leave you alone.',
    inisYap: 'Descend 300–1,000 m today and stay there.',
    dahaYukseriUyuma: 'Do not sleep higher tonight than you did last night.',
    dinlenGunu: 'Take a rest day; stay at the same elevation.',
    yavaslat: 'Slow down: above 3,000 m, raise sleeping altitude by no more than 500 m per day.',
    hidrasyon: 'Drink often. Cold, dry air hides how much fluid you are losing.',
    alkolSakinlestiriciYok: 'No alcohol or sleeping pills — they suppress breathing and mask symptoms.',
    spo2Olc: 'Measure SpO₂ with a finger oximeter if you have one; a reading beats a guess.',
    nabizTakip: 'Record your resting heart rate at sea level — a rise only means something against your own baseline.',
    tansiyonOlc: 'Measure your blood pressure with a real cuff. A pulse sensor does not measure blood pressure.',
    hekimeDanis: 'Talk to a doctor. Do not decide on medication (acetazolamide and similar) by yourself.',
  },

  reason: {
    ataksi: 'Loss of balance / stumbling',
    bilinc: 'Confusion',
    istirahatteNefesDarligi: 'Breathlessness at rest',
    amsSiddetli: 'Severe AMS symptoms',
    amsOrta: 'Moderate AMS symptoms',
    amsHafif: 'Mild AMS symptoms',
    spo2Dusuk: 'SpO₂ below what is expected at this elevation',
    nabizYuksek: 'Resting heart rate clearly above your own baseline',
    hizliTirmanis: 'Sleeping altitude rose too much in the last 24 hours',
    tansiyonCokYuksek: 'Measured blood pressure is very high',
    tansiyonYuksek: 'Measured blood pressure is high',
  },

  bp: {
    label: 'Blood pressure (measured)',
    dusuk: 'Low',
    normal: 'Normal',
    yuksek: 'High',
    cokYuksek: 'Very high',
    gecersiz: 'That reading looks wrong — measure again',
    noEstimate:
      'Blood pressure is not estimated. Smartwatches and chest straps measure pulse rate; blood pressure needs a cuff. Enter a value you measured and we will read it in altitude context.',
  },

  metric: {
    pressure: 'Air pressure',
    inspiredO2: 'Inspired oxygen',
    expectedSpo2: 'Expected SpO₂ here',
    hrRise: 'Heart rate rise',
    vsSeaLevel: '{{percent}}% of sea level',
  },

  disclaimer:
    'This is decision support, not a diagnosis. If symptoms worsen or you are unsure: descend and call for help.',
};

/**
 * İrtifa fizyolojisi metinleri.
 *
 * tr kaynak, en zorunlu; **diğer 21 dil bilinçli olarak İngilizceye düşer.**
 * Bunlar tıbbi tavsiye metinleri: 21 dilde gözden geçirilmemiş çeviri,
 * İngilizceye düşmekten daha risklidir. Bir dil, o dili konuşan biri metni
 * okuyup onayladığında eklenir.
 */
export const altitudeI18n = localeSet(tr, en);
