import type { GeoPoint } from './types';

/* ------------------------------------------------------------------ */
/* Tipler                                                              */
/* ------------------------------------------------------------------ */

/** Kurtarma örgütünün kapsamı. */
export type RescueScope = 'mountain' | 'sea' | 'cave' | 'medical' | 'general';

/** Helikopterle kurtarmanın ücret politikası. */
export type HelicopterRescuePolicy = 'free' | 'paid' | 'insurance_required' | 'limited';

/** Ülke verilerinde tutulan iki dilli metin (diğer diller İngilizceye düşer). */
export interface LocalizedText {
  tr: string;
  en: string;
}

export interface RescueOrganization {
  name: string;
  /** Uluslararası biçimde ya da yerel kısa numara; yoksa null (acil numara üzerinden ulaşılır). */
  phone: string | null;
  scope: RescueScope;
  note: LocalizedText;
  url?: string;
}

export interface RescueEmergencyNumbers {
  /** Uygulamanın "Ara" düğmesinde kullandığı ana numara. */
  general: string;
  police: string;
  ambulance: string;
  fire: string;
  /** Dağ kurtarma için ayrı hat varsa. */
  mountain?: string;
  /** Deniz / sahil güvenlik hattı varsa. */
  sea?: string;
  /** Turist polisi gibi yabancılar için özel hat. */
  tourist?: string;
}

export interface TurkishEmbassy {
  city: string;
  phone: string;
}

export interface RescueProfile {
  countryCode: string;
  emergency: RescueEmergencyNumbers;
  organizations: RescueOrganization[];
  insuranceNote: LocalizedText;
  helicopterRescue: HelicopterRescuePolicy;
  /** ISO 639-1 dil kodları (acil çağrıda hangi dille anlaşılır). */
  languages: string[];
  turkishEmbassy: TurkishEmbassy | null;
  notes: LocalizedText[];
}

export interface CountryBBox {
  code: string;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface NearbyCountry {
  countryCode: string;
  /** Kutu kenarına yaklaşık uzaklık (km). */
  distanceKm: number;
  profile: RescueProfile;
}

/** T.C. Dışişleri Bakanlığı Konsolosluk Çağrı Merkezi (7/24). */
export const FOREIGN_MINISTRY_CALL_CENTER = '+90 312 292 29 29';

/** Bilinmeyen ülke için kullanılan profil kodu. */
export const UNKNOWN_COUNTRY = 'XX';

/** Komşu ülke uyarısı için kutu kenarına azami uzaklık (km). */
export const NEARBY_THRESHOLD_KM = 30;

function lt(tr: string, en: string): LocalizedText {
  return { tr, en };
}

/** İki dilli metni yerel ayara göre döner (tr dışındaki diller İngilizce). */
export function localizedText(text: LocalizedText, locale: string): string {
  return locale === 'tr' ? text.tr : text.en;
}

/* ------------------------------------------------------------------ */
/* Kaba sınır kutuları                                                 */
/* ------------------------------------------------------------------ */

type BBoxTuple = [code: string, minLat: number, minLng: number, maxLat: number, maxLng: number];

/**
 * Kaba sınır kutuları. Büyük ülkelerin komşularıyla çakışması normaldir;
 * `detectCountry` alanı küçük olanı öne alır. Bazı ülkeler birden çok kutuyla
 * (örn. CH/IT Alp sınırı, ABD/Alaska) temsil edilir.
 */
const BBOX_TUPLES: BBoxTuple[] = [
  ['TR', 35.8, 25.7, 42.1, 44.8],
  ['NP', 26.3, 80.0, 30.5, 88.2],
  ['BT', 26.7, 88.7, 28.4, 92.1],
  ['IN', 6.5, 68.1, 35.5, 97.4],
  ['LK', 5.9, 79.6, 9.9, 81.9],
  ['PK', 23.6, 60.9, 37.1, 77.8],
  ['CN', 18.1, 73.5, 53.6, 135.1],
  ['TW', 21.9, 120.0, 25.3, 122.0],
  ['JP', 24.0, 122.9, 45.6, 146.0],
  ['KR', 33.1, 124.6, 38.7, 131.9],
  ['TH', 5.6, 97.3, 20.5, 105.7],
  ['MM', 9.8, 92.2, 28.5, 101.2],
  ['KH', 10.4, 102.3, 14.7, 107.6],
  ['LA', 13.9, 100.1, 22.5, 107.7],
  ['VN', 8.5, 102.1, 23.4, 109.5],
  ['MY', 0.8, 99.6, 7.4, 119.3],
  ['SG', 1.2, 103.6, 1.5, 104.1],
  ['ID', -11.0, 95.0, 6.1, 141.0],
  ['PH', 4.6, 116.9, 21.2, 126.6],
  ['PG', -11.7, 140.8, -1.3, 155.9],
  ['AU', -43.7, 112.9, -10.6, 153.7],
  ['NZ', -47.3, 166.4, -34.4, 178.6],
  ['US', 24.4, -125.0, 49.4, -66.9],
  ['US', 51.0, -179.2, 71.5, -129.9],
  ['CA', 41.7, -141.0, 83.1, -52.6],
  ['MX', 14.5, -118.4, 32.7, -86.7],
  ['GT', 13.7, -92.2, 17.8, -88.2],
  ['CR', 8.0, -85.9, 11.2, -82.6],
  ['PA', 7.2, -83.1, 9.6, -77.2],
  ['CU', 19.8, -85.0, 23.3, -74.1],
  ['CO', -4.2, -79.0, 13.4, -66.9],
  ['VE', 0.6, -73.4, 12.2, -59.8],
  ['EC', -5.0, -81.1, 1.7, -75.2],
  ['PE', -18.4, -81.4, -0.03, -68.7],
  ['BO', -22.9, -69.6, -9.7, -57.5],
  ['CL', -55.9, -75.7, -17.5, -66.4],
  ['AR', -55.1, -73.6, -21.8, -53.6],
  ['UY', -35.0, -58.4, -30.1, -53.1],
  ['PY', -27.6, -62.6, -19.3, -54.3],
  ['BR', -33.8, -73.9, 5.3, -34.8],
  ['ZA', -34.9, 16.4, -22.1, 32.9],
  ['NA', -28.97, 11.7, -16.96, 25.3],
  ['BW', -26.9, 20.0, -17.8, 29.4],
  ['MG', -25.6, 43.2, -11.9, 50.5],
  ['TZ', -11.8, 29.3, -1.0, 40.5],
  ['KE', -4.7, 33.9, 5.0, 41.9],
  ['UG', -1.5, 29.6, 4.2, 35.0],
  ['RW', -2.9, 28.9, -1.0, 30.9],
  ['ET', 3.4, 33.0, 14.9, 48.0],
  ['MA', 27.7, -13.2, 35.9, -1.0],
  ['EG', 22.0, 24.7, 31.7, 36.9],
  ['GE', 41.0, 40.0, 43.6, 46.7],
  ['AM', 38.8, 43.4, 41.3, 46.6],
  ['AZ', 38.4, 44.8, 41.9, 50.4],
  ['IR', 25.1, 44.0, 39.8, 63.3],
  ['SA', 16.4, 34.5, 32.2, 55.7],
  ['JO', 29.2, 34.9, 33.4, 39.3],
  ['IL', 29.5, 34.3, 33.3, 35.9],
  ['LB', 33.05, 35.1, 34.7, 36.6],
  ['CY', 34.5, 32.2, 35.7, 34.6],
  ['AE', 22.6, 51.5, 26.1, 56.4],
  ['OM', 16.6, 52.0, 26.4, 59.9],
  ['GB', 49.9, -8.6, 60.9, 1.8],
  ['IE', 51.4, -10.5, 55.4, -5.4],
  ['FR', 41.3, -5.2, 51.1, 9.6],
  ['ES', 36.0, -9.3, 43.8, 3.4],
  ['ES', 27.6, -18.2, 29.5, -13.4],
  ['PT', 36.9, -9.6, 42.2, -6.2],
  // İtalya: güney gövde + Alp şeridi (Chamonix/Cenevre gibi sınır noktalarıyla çakışmasın)
  ['IT', 36.6, 6.6, 45.85, 18.5],
  ['IT', 45.85, 7.0, 47.1, 13.9],
  // İsviçre: Cenevre–Jura–Bern kuşağı + Valais/Ticino güney kuşağı
  ['CH', 46.12, 5.95, 47.82, 10.5],
  ['CH', 45.82, 6.95, 46.12, 9.3],
  ['AT', 46.4, 9.5, 49.0, 17.2],
  ['DE', 47.3, 5.9, 55.1, 15.0],
  ['NL', 50.75, 3.3, 53.6, 7.2],
  ['BE', 49.5, 2.5, 51.5, 6.4],
  ['DK', 54.5, 8.0, 57.8, 12.7],
  ['NO', 57.9, 4.6, 71.2, 31.1],
  ['SE', 55.3, 11.0, 69.1, 24.2],
  ['FI', 59.8, 20.5, 70.1, 31.6],
  ['IS', 63.3, -24.6, 66.6, -13.4],
  ['PL', 49.0, 14.1, 54.9, 24.2],
  ['CZ', 48.5, 12.1, 51.1, 18.9],
  ['SK', 47.7, 16.8, 49.6, 22.6],
  ['HU', 45.7, 16.1, 48.6, 22.9],
  ['SI', 45.4, 13.4, 46.9, 16.6],
  ['HR', 42.4, 13.5, 46.6, 19.4],
  ['BA', 42.5, 15.7, 45.3, 19.6],
  ['RS', 42.2, 18.8, 46.2, 23.0],
  ['ME', 41.8, 18.4, 43.6, 20.4],
  ['AL', 39.6, 19.3, 42.7, 21.1],
  ['MK', 40.8, 20.4, 42.4, 23.0],
  ['GR', 34.8, 19.4, 41.8, 28.3],
  ['BG', 41.2, 22.4, 44.2, 28.6],
  ['RO', 43.6, 20.3, 48.3, 29.7],
  ['UA', 44.4, 22.1, 52.4, 40.2],
  ['RU', 41.2, 27.3, 81.9, 180.0],
  ['RU', 54.3, 19.6, 55.3, 22.9],
  ['KZ', 40.6, 46.5, 55.4, 87.3],
  ['KG', 39.2, 69.3, 43.3, 80.3],
  ['TJ', 36.7, 67.4, 41.0, 75.2],
  ['UZ', 37.2, 56.0, 45.6, 73.2],
  ['MN', 41.6, 87.7, 52.2, 119.9],
];

function bboxArea(b: CountryBBox): number {
  return (b.maxLat - b.minLat) * (b.maxLng - b.minLng);
}

/** Kaba sınır kutuları; alanı küçükten büyüğe sıralı (çakışmada küçük olan kazanır). */
export const COUNTRY_BBOXES: CountryBBox[] = BBOX_TUPLES.map(
  ([code, minLat, minLng, maxLat, maxLng]) => ({ code, minLat, minLng, maxLat, maxLng }),
).sort((a, b) => bboxArea(a) - bboxArea(b));

function inBox(p: GeoPoint, b: CountryBBox): boolean {
  return (
    p.latitude >= b.minLat &&
    p.latitude <= b.maxLat &&
    p.longitude >= b.minLng &&
    p.longitude <= b.maxLng
  );
}

/**
 * Koordinattan ülke kodu tahmini. Önce küçük kutular denenir; hiçbiri
 * eşleşmezse (okyanus vb.) `null` döner.
 */
export function detectCountry(coords: GeoPoint): string | null {
  for (const box of COUNTRY_BBOXES) {
    if (inBox(coords, box)) return box.code;
  }
  return null;
}

const KM_PER_DEG_LAT = 111.32;

/** Noktanın kutunun en yakın kenarına km uzaklığı (içerideyse de kenara olan mesafe). */
function distanceToBoxEdgeKm(p: GeoPoint, b: CountryBBox): number {
  const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((p.latitude * Math.PI) / 180);
  if (inBox(p, b)) {
    return Math.min(
      (p.latitude - b.minLat) * KM_PER_DEG_LAT,
      (b.maxLat - p.latitude) * KM_PER_DEG_LAT,
      (p.longitude - b.minLng) * kmPerDegLng,
      (b.maxLng - p.longitude) * kmPerDegLng,
    );
  }
  const dLat = Math.max(b.minLat - p.latitude, 0, p.latitude - b.maxLat) * KM_PER_DEG_LAT;
  const dLng = Math.max(b.minLng - p.longitude, 0, p.longitude - b.maxLng) * kmPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Sınıra yakınken (kutu kenarına < 30 km) komşu ülke profillerini döner —
 * telefon dolaşımı komşu şebekeye düşebilir ve acil numara değişebilir.
 */
export function nearbyCountries(
  coords: GeoPoint,
  thresholdKm: number = NEARBY_THRESHOLD_KM,
): NearbyCountry[] {
  const current = detectCountry(coords);
  const best = new Map<string, number>();
  for (const box of COUNTRY_BBOXES) {
    if (box.code === current) continue;
    const d = distanceToBoxEdgeKm(coords, box);
    if (d >= thresholdKm) continue;
    const prev = best.get(box.code);
    if (prev === undefined || d < prev) best.set(box.code, d);
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([countryCode, distanceKm]) => ({
      countryCode,
      distanceKm: Math.round(distanceKm),
      profile: rescueProfileFor(countryCode),
    }));
}

/* ------------------------------------------------------------------ */
/* Kurtarma dizini                                                     */
/* ------------------------------------------------------------------ */

const FOREIGN_MINISTRY_NOTE = lt(
  `Yurt dışında konsolosluk yardımı: Dışişleri Konsolosluk Çağrı Merkezi ${FOREIGN_MINISTRY_CALL_CENTER} (7/24).`,
  `Consular help abroad: Turkish Foreign Ministry Consular Call Centre ${FOREIGN_MINISTRY_CALL_CENTER} (24/7).`,
);

const GSM_112_NOTE = lt(
  '112, GSM standardı gereği kilitli ekrandan ve SIM kartsız da çoğu şebekede çalışır.',
  '112 works on most GSM networks even from a locked screen or without a SIM card.',
);

/** Ülke koduna göre acil numaralar ve kurtarma örgütleri. */
export const RESCUE_DIRECTORY: Record<string, RescueProfile> = {
  TR: {
    countryCode: 'TR',
    emergency: { general: '112', police: '155', ambulance: '112', fire: '110', mountain: '112' },
    organizations: [
      {
        name: 'AKUT Arama Kurtarma Derneği',
        phone: '+90 212 217 04 10',
        scope: 'mountain',
        note: lt(
          'Gönüllü dağ ve doğa arama kurtarma; acil durumda önce 112, AKUT ekipleri 112 üzerinden yönlendirilir.',
          'Volunteer mountain and wilderness SAR; call 112 first, AKUT teams are dispatched via 112.',
        ),
        url: 'https://www.akut.org.tr',
      },
      {
        name: 'JAK — Jandarma Arama Kurtarma',
        phone: '156',
        scope: 'mountain',
        note: lt(
          'Kırsal ve dağlık alanlarda jandarma sorumluluk bölgesi; helikopter desteği verebilir.',
          'Gendarmerie SAR for rural and mountain areas; can provide helicopter support.',
        ),
      },
      {
        name: 'UMKE — Ulusal Medikal Kurtarma Ekibi',
        phone: '112',
        scope: 'medical',
        note: lt(
          'Sağlık Bakanlığı medikal kurtarma ekipleri; 112 üzerinden görevlendirilir.',
          'Ministry of Health medical rescue teams, dispatched via 112.',
        ),
      },
      {
        name: 'Sahil Güvenlik',
        phone: '158',
        scope: 'sea',
        note: lt('Deniz ve kıyı acil durumları.', 'Sea and coastal emergencies.'),
      },
    ],
    insuranceNote: lt(
      'Devlet kurtarması ücretsizdir; özel dağ sporları sigortası (TDF lisansı vb.) tedavi ve nakil için önerilir.',
      'State rescue is free; a personal mountain-sports policy is recommended for treatment and repatriation.',
    ),
    helicopterRescue: 'free',
    languages: ['tr'],
    turkishEmbassy: null,
    notes: [
      lt(
        '112 tek numara: polis, ambulans, itfaiye ve jandarma aynı merkezden yönlendirilir.',
        '112 is the single number: police, ambulance, fire and gendarmerie are dispatched from one centre.',
      ),
      GSM_112_NOTE,
    ],
  },
  NP: {
    countryCode: 'NP',
    emergency: {
      general: '102',
      police: '100',
      ambulance: '102',
      fire: '101',
      mountain: '+977 1 4440292',
      tourist: '1144',
    },
    organizations: [
      {
        name: 'Himalayan Rescue Association (HRA)',
        phone: '+977 1 4440292',
        scope: 'medical',
        note: lt(
          'Katmandu merkez; Pheriche (Everest) ve Manang (Annapurna) yükseklik klinikleri.',
          'Kathmandu office; altitude clinics at Pheriche (Everest) and Manang (Annapurna).',
        ),
        url: 'https://www.himalayanrescue.org.np',
      },
      {
        name: 'Nepal Tourist Police',
        phone: '1144',
        scope: 'general',
        note: lt(
          'İngilizce konuşan turist polisi; kayıp trekker ve acil yönlendirme.',
          'English-speaking tourist police; missing trekkers and emergency routing.',
        ),
      },
      {
        name: 'Nepal Police',
        phone: '100',
        scope: 'general',
        note: lt(
          'Genel acil ve arama koordinasyonu.',
          'General emergency and search coordination.',
        ),
      },
    ],
    insuranceNote: lt(
      'Helikopter tahliyesi 5.000–10.000 USD; helikopter şirketleri ödeme garantisi ister. 6.000 m’ye kadar heli-tahliye kapsayan sigorta ZORUNLU sayılmalı.',
      'Helicopter evacuation costs USD 5,000–10,000 and operators demand a payment guarantee. Treat insurance covering heli-evacuation up to 6,000 m as MANDATORY.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['ne', 'en'],
    turkishEmbassy: null,
    notes: [
      lt(
        'Tek bir acil numara yok: 100 polis, 102 ambulans, 101 itfaiye. Trekking izni (TIMS) ve rehber bilgilerini yanında tut.',
        'No single emergency number: 100 police, 102 ambulance, 101 fire. Keep your TIMS permit and guide details handy.',
      ),
      lt(
        'Yüksek irtifada (AMS/HAPE) ilk kural aşağı inmektir; heli için hava aydınlık olmalı.',
        'At altitude (AMS/HAPE) descend first; helicopters only fly in daylight and clear weather.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  IN: {
    countryCode: 'IN',
    emergency: { general: '112', police: '100', ambulance: '102', fire: '101' },
    organizations: [
      {
        name: 'Indian Mountaineering Foundation (IMF)',
        phone: '+91 11 2411 1211',
        scope: 'mountain',
        note: lt(
          'Delhi; Himalaya tırmanış izinleri ve kurtarma koordinasyonu.',
          'Delhi; Himalayan climbing permits and rescue coordination.',
        ),
        url: 'https://www.indmount.org',
      },
      {
        name: 'SDRF / NDRF (Uttarakhand, Himachal)',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Eyalet afet kurtarma ekipleri; trek bölgelerinde 112 üzerinden.',
          'State disaster response teams; reach via 112 in trekking regions.',
        ),
      },
    ],
    insuranceNote: lt(
      'Askeri/özel helikopter tahliyesi ücretlidir; yüksek irtifa kapsayan sigorta şart.',
      'Military/private helicopter evacuation is charged; carry insurance with high-altitude cover.',
    ),
    helicopterRescue: 'paid',
    languages: ['hi', 'en'],
    turkishEmbassy: { city: 'New Delhi', phone: '+91 11 2688 9053' },
    notes: [
      lt(
        'Ladakh ve Sikkim’de kurtarma büyük ölçüde ordu (ITBP) eliyle.',
        'In Ladakh and Sikkim rescue is mostly run by the army (ITBP).',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  PK: {
    countryCode: 'PK',
    emergency: { general: '1122', police: '15', ambulance: '1122', fire: '16' },
    organizations: [
      {
        name: 'Rescue 1122',
        phone: '1122',
        scope: 'general',
        note: lt(
          'Pencap, KP ve Gilgit-Baltistan’da devlet acil servisi.',
          'State emergency service in Punjab, KP and Gilgit-Baltistan.',
        ),
      },
      {
        name: 'Edhi Foundation Ambulance',
        phone: '115',
        scope: 'medical',
        note: lt('Ülke çapında gönüllü ambulans ağı.', 'Nationwide volunteer ambulance network.'),
      },
      {
        name: 'Alpine Club of Pakistan',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Karakurum tırmanış izinleri; heli-kurtarma Askari Aviation üzerinden, ön ödeme garantisi ister.',
          'Karakoram permits; heli-rescue via Askari Aviation, which requires a payment guarantee.',
        ),
      },
    ],
    insuranceNote: lt(
      'Karakurum’da helikopter kurtarması yalnızca depozito/garanti ile; 7.000 m+ kapsayan sigorta zorunlu.',
      'Karakoram helicopter rescue only with a deposit/guarantee; insurance covering 7,000 m+ is mandatory.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['ur', 'en'],
    turkishEmbassy: null,
    notes: [
      lt(
        'Kırsalda şebeke çok sınırlı; uydu haberleşme cihazı taşı.',
        'Rural coverage is very limited; carry a satellite messenger.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  CN: {
    countryCode: 'CN',
    emergency: { general: '120', police: '110', ambulance: '120', fire: '119', sea: '12395' },
    organizations: [
      {
        name: 'Chinese Mountaineering Association',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Tırmanış izinleri ve kurtarma koordinasyonu (Tibet/Xinjiang için ayrı izin).',
          'Climbing permits and rescue coordination (separate permits for Tibet/Xinjiang).',
        ),
      },
      {
        name: 'China Maritime Search & Rescue',
        phone: '12395',
        scope: 'sea',
        note: lt('Deniz arama kurtarma hattı.', 'Maritime SAR hotline.'),
      },
    ],
    insuranceNote: lt(
      'Devlet kurtarması yaygın ama uzak bölgelerde yavaş; İngilizce nadiren konuşulur.',
      'State rescue exists but is slow in remote regions; English is rarely spoken.',
    ),
    helicopterRescue: 'limited',
    languages: ['zh'],
    turkishEmbassy: { city: 'Pekin', phone: '+86 10 6532 2650' },
    notes: [
      lt(
        '110 polis, 120 ambulans, 119 itfaiye. Çince adres kartı taşı.',
        '110 police, 120 ambulance, 119 fire. Carry an address card in Chinese.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  JP: {
    countryCode: 'JP',
    emergency: {
      general: '119',
      police: '110',
      ambulance: '119',
      fire: '119',
      mountain: '110',
      sea: '118',
    },
    organizations: [
      {
        name: 'Japan Coast Guard',
        phone: '118',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
      {
        name: 'Prefecture Police Mountain Rescue',
        phone: '110',
        scope: 'mountain',
        note: lt(
          'Dağ kurtarma il polisinden (110); Nagano/Gifu ekipleri deneyimli.',
          'Mountain rescue is run by prefectural police (110); Nagano/Gifu teams are experienced.',
        ),
      },
    ],
    insuranceNote: lt(
      'Kamu heli çoğunlukla ücretsiz; Saitama ücret alır, özel heli pahalı. Kısa süreli "yama-hoken" dağ sigortası önerilir.',
      'Public helicopters are mostly free; Saitama charges, private helis are costly. Short-term "yama-hoken" mountain insurance is recommended.',
    ),
    helicopterRescue: 'free',
    languages: ['ja'],
    turkishEmbassy: { city: 'Tokyo', phone: '+81 3 6439 5700' },
    notes: [
      lt(
        'Dağa çıkmadan "tozan-todoke" (tırmanış planı) bırak.',
        'File a "tozan-todoke" (climbing plan) before setting out.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  KR: {
    countryCode: 'KR',
    emergency: {
      general: '119',
      police: '112',
      ambulance: '119',
      fire: '119',
      mountain: '119',
      sea: '122',
    },
    organizations: [
      {
        name: '119 Rescue (Fire Service)',
        phone: '119',
        scope: 'mountain',
        note: lt(
          'Dağ kurtarma ve ambulans aynı numara; helikopter dahil.',
          'Mountain rescue and ambulance share 119, including helicopter.',
        ),
      },
      {
        name: 'Korea Coast Guard',
        phone: '122',
        scope: 'sea',
        note: lt(
          'Deniz acil hattı (119 da yönlendirir).',
          'Maritime emergency line (119 also routes).',
        ),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; tedavi için seyahat sigortası.',
      'Rescue is free; travel insurance covers treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['ko'],
    turkishEmbassy: { city: 'Seul', phone: '+82 2 3780 1600' },
    notes: [
      lt(
        'Milli parklarda kurtarma noktaları numaralı tabelalarla işaretlidir; numarayı 119’a söyle.',
        'National parks mark rescue points with numbered signs; read the number to 119.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  TH: {
    countryCode: 'TH',
    emergency: {
      general: '1669',
      police: '191',
      ambulance: '1669',
      fire: '199',
      sea: '1196',
      tourist: '1155',
    },
    organizations: [
      {
        name: 'Tourist Police',
        phone: '1155',
        scope: 'general',
        note: lt('İngilizce turist polisi, 7/24.', 'English-speaking tourist police, 24/7.'),
      },
      {
        name: 'Narenthorn EMS',
        phone: '1669',
        scope: 'medical',
        note: lt('Ulusal ambulans hattı.', 'National ambulance line.'),
      },
      {
        name: 'Marine Police',
        phone: '1196',
        scope: 'sea',
        note: lt('Deniz ve ada acil durumları.', 'Sea and island emergencies.'),
      },
    ],
    insuranceNote: lt(
      'Özel hastaneler peşin ister; sigorta şart.',
      'Private hospitals demand upfront payment; carry insurance.',
    ),
    helicopterRescue: 'limited',
    languages: ['th', 'en'],
    turkishEmbassy: { city: 'Bangkok', phone: '+66 2 274 7262' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  ID: {
    countryCode: 'ID',
    emergency: { general: '112', police: '110', ambulance: '118', fire: '113', sea: '115' },
    organizations: [
      {
        name: 'BASARNAS',
        phone: '115',
        scope: 'general',
        note: lt(
          'Ulusal arama kurtarma ajansı; volkan ve deniz operasyonları.',
          'National SAR agency; volcano and maritime operations.',
        ),
        url: 'https://basarnas.go.id',
      },
    ],
    insuranceNote: lt(
      'Adalar arası tahliye pahalı; sigorta şart.',
      'Inter-island evacuation is costly; carry insurance.',
    ),
    helicopterRescue: 'limited',
    languages: ['id'],
    turkishEmbassy: { city: 'Cakarta', phone: '+62 21 525 6250' },
    notes: [
      lt(
        '112 büyük şehirlerde çalışır; kırsalda 110/118 dene.',
        '112 works in major cities; try 110/118 in rural areas.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  AU: {
    countryCode: 'AU',
    emergency: { general: '000', police: '000', ambulance: '000', fire: '000', sea: '000' },
    organizations: [
      {
        name: 'AMSA Rescue Coordination Centre',
        phone: '+61 2 6230 6811',
        scope: 'sea',
        note: lt('Deniz ve PLB/EPIRB sinyalleri.', 'Maritime SAR and PLB/EPIRB alerts.'),
      },
      {
        name: 'State Emergency Service (SES)',
        phone: '132 500',
        scope: 'general',
        note: lt(
          'Fırtına/sel yardımı; arazi araması polis üzerinden 000.',
          'Storm/flood help; bush search via police on 000.',
        ),
      },
    ],
    insuranceNote: lt(
      'Arama kurtarma ücretsiz; ambulans ve hava ambulansı ziyaretçilere faturalanabilir — sigorta şart.',
      'Search and rescue is free; ambulance and air ambulance can be billed to visitors — carry insurance.',
    ),
    helicopterRescue: 'free',
    languages: ['en'],
    turkishEmbassy: { city: 'Canberra', phone: '+61 2 6234 0000' },
    notes: [
      lt(
        '112 cep telefonundan da çalışır. Uzak bölgelerde PLB taşı.',
        '112 also works from mobiles. Carry a PLB in remote areas.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  NZ: {
    countryCode: 'NZ',
    emergency: {
      general: '111',
      police: '111',
      ambulance: '111',
      fire: '111',
      mountain: '111',
      sea: '*500',
    },
    organizations: [
      {
        name: 'LandSAR New Zealand',
        phone: '111',
        scope: 'mountain',
        note: lt(
          'Gönüllü arazi kurtarma; polis 111 üzerinden görevlendirir.',
          'Volunteer land SAR, tasked by police via 111.',
        ),
      },
      {
        name: 'RCCNZ',
        phone: '+64 4 577 8030',
        scope: 'sea',
        note: lt(
          'Ulusal kurtarma koordinasyon merkezi; PLB sinyalleri.',
          'National rescue coordination centre; PLB alerts.',
        ),
      },
      {
        name: 'Coastguard NZ',
        phone: '*500',
        scope: 'sea',
        note: lt('Cep telefonundan *500.', 'Dial *500 from a mobile.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; ACC kazalarda ziyaretçilerin tedavisini karşılar.',
      'Rescue is free; ACC covers visitors’ accident treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['en', 'mi'],
    turkishEmbassy: null,
    notes: [
      lt(
        'Rotanı ve dönüş saatini bir "trusted contact" ile paylaş (AdventureSmart).',
        'Share your route and return time with a trusted contact (AdventureSmart).',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  US: {
    countryCode: 'US',
    emergency: { general: '911', police: '911', ambulance: '911', fire: '911', sea: '911' },
    organizations: [
      {
        name: 'National Park Service (park dispatch)',
        phone: '911',
        scope: 'mountain',
        note: lt(
          'Milli parklarda 911 park merkezine düşer; SAR park korucuları yürütür.',
          'In national parks 911 reaches park dispatch; rangers run SAR.',
        ),
      },
      {
        name: 'Mountain Rescue Association teams',
        phone: '911',
        scope: 'mountain',
        note: lt(
          'Gönüllü ekipler; ilçe şerifi 911 üzerinden görevlendirir.',
          'Volunteer teams tasked by the county sheriff via 911.',
        ),
      },
      {
        name: 'US Coast Guard',
        phone: '911',
        scope: 'sea',
        note: lt('VHF 16 ya da 911.', 'VHF channel 16 or 911.'),
      },
    ],
    insuranceNote: lt(
      'Arama genelde ücretsiz, ancak hava ambulansı 20.000 USD+ olabilir; sağlık sigortası şart.',
      'Search is usually free, but air-ambulance transport can exceed USD 20,000; health insurance is essential.',
    ),
    helicopterRescue: 'paid',
    languages: ['en', 'es'],
    turkishEmbassy: { city: 'Washington DC', phone: '+1 202 612 6700' },
    notes: [
      lt(
        'Bazı eyaletlerde (NH, CO) ihmal kaynaklı kurtarma faturalanır.',
        'Some states (NH, CO) bill rescues caused by negligence.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  CA: {
    countryCode: 'CA',
    emergency: { general: '911', police: '911', ambulance: '911', fire: '911', sea: '*16' },
    organizations: [
      {
        name: 'Parks Canada Visitor Safety',
        phone: '911',
        scope: 'mountain',
        note: lt(
          'Banff/Jasper gibi parklarda 911 park dispatch’e bağlanır.',
          'In parks like Banff/Jasper, 911 connects to park dispatch.',
        ),
      },
      {
        name: 'Canadian Coast Guard',
        phone: '*16',
        scope: 'sea',
        note: lt('Cep telefonundan *16 ya da VHF 16.', 'Dial *16 from a mobile or VHF 16.'),
      },
    ],
    insuranceNote: lt(
      'SAR ücretsiz; tıbbi nakil ve tedavi ziyaretçilere faturalanır.',
      'SAR is free; medical transport and treatment are billed to visitors.',
    ),
    helicopterRescue: 'free',
    languages: ['en', 'fr'],
    turkishEmbassy: { city: 'Ottawa', phone: '+1 613 244 2470' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  MX: {
    countryCode: 'MX',
    emergency: { general: '911', police: '911', ambulance: '911', fire: '911' },
    organizations: [
      {
        name: 'Ángeles Verdes',
        phone: '078',
        scope: 'general',
        note: lt(
          'Karayolu yardımı ve turist destek hattı.',
          'Roadside assistance and tourist help line.',
        ),
      },
      {
        name: 'Socorro Alpino de México',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Gönüllü dağ kurtarma (Iztaccíhuatl, Pico de Orizaba); 911 üzerinden.',
          'Volunteer mountain rescue (Iztaccíhuatl, Pico de Orizaba); via 911.',
        ),
      },
    ],
    insuranceNote: lt(
      'Özel hastaneler peşin ister; sigorta şart.',
      'Private hospitals require upfront payment; carry insurance.',
    ),
    helicopterRescue: 'limited',
    languages: ['es'],
    turkishEmbassy: { city: 'Meksiko', phone: '+52 55 5282 5446' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  PE: {
    countryCode: 'PE',
    emergency: { general: '105', police: '105', ambulance: '106', fire: '116' },
    organizations: [
      {
        name: 'Policía de Alta Montaña (Huaraz / Cusco)',
        phone: '105',
        scope: 'mountain',
        note: lt(
          'Cordillera Blanca ve Cusco dağ kurtarma birimleri; 105 üzerinden.',
          'Mountain rescue units in Cordillera Blanca and Cusco; via 105.',
        ),
      },
      {
        name: 'Casa de Guías de Huaraz',
        phone: '+51 43 421811',
        scope: 'mountain',
        note: lt(
          'Dağ rehberleri derneği; kurtarma koordinasyonuna yardım eder.',
          'Mountain guides association; assists rescue coordination.',
        ),
      },
    ],
    insuranceNote: lt(
      'Helikopter yok denecek kadar az; sigorta ve uydu cihazı şart.',
      'Helicopters are scarce; insurance and a satellite device are essential.',
    ),
    helicopterRescue: 'limited',
    languages: ['es', 'qu'],
    turkishEmbassy: null,
    notes: [
      lt('105 polis, 106 SAMU ambulans, 116 itfaiye.', '105 police, 106 SAMU ambulance, 116 fire.'),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  CL: {
    countryCode: 'CL',
    emergency: { general: '131', police: '133', ambulance: '131', fire: '132', sea: '137' },
    organizations: [
      {
        name: 'CONAF (orman yangını / park)',
        phone: '130',
        scope: 'general',
        note: lt(
          'Milli park korucuları ve yangın hattı.',
          'National park rangers and wildfire line.',
        ),
      },
      {
        name: 'Cuerpo de Socorro Andino',
        phone: '133',
        scope: 'mountain',
        note: lt(
          'Gönüllü dağ kurtarma; Carabineros (133) görevlendirir.',
          'Volunteer mountain rescue tasked by Carabineros (133).',
        ),
      },
      {
        name: 'Armada — Salvamento Marítimo',
        phone: '137',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
    ],
    insuranceNote: lt(
      'Torres del Paine gibi parklarda kurtarma faturalanabilir; sigorta önerilir.',
      'Rescues in parks like Torres del Paine may be billed; insurance recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['es'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  AR: {
    countryCode: 'AR',
    emergency: { general: '911', police: '911', ambulance: '107', fire: '100', sea: '106' },
    organizations: [
      {
        name: 'Parque Provincial Aconcagua — Patrulla de Rescate',
        phone: '911',
        scope: 'mountain',
        note: lt(
          'Tırmanış izni park içi kurtarmayı kapsar; heli yalnızca kamp seviyesine kadar.',
          'The climbing permit covers in-park rescue; helicopter only down to base camp.',
        ),
      },
      {
        name: 'Prefectura Naval',
        phone: '106',
        scope: 'sea',
        note: lt('Deniz ve göl acil hattı.', 'Sea and lake emergency line.'),
      },
    ],
    insuranceNote: lt(
      'Park dışı tahliye ve tedavi sigortaya bağlı.',
      'Evacuation beyond the park and treatment depend on your insurance.',
    ),
    helicopterRescue: 'limited',
    languages: ['es'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  BO: {
    countryCode: 'BO',
    emergency: { general: '118', police: '110', ambulance: '118', fire: '119' },
    organizations: [
      {
        name: 'Socorro Andino Boliviano',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Gönüllü; La Paz’dan ajans/rehber aracılığıyla ulaşılır.',
          'Volunteer; reached via agencies/guides in La Paz.',
        ),
      },
    ],
    insuranceNote: lt(
      'Helikopter kurtarma pratikte yok; yüksek irtifa sigortası ve rehber şart.',
      'Helicopter rescue is practically unavailable; carry altitude insurance and hire a guide.',
    ),
    helicopterRescue: 'limited',
    languages: ['es', 'ay', 'qu'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  CO: {
    countryCode: 'CO',
    emergency: { general: '123', police: '123', ambulance: '125', fire: '119' },
    organizations: [
      {
        name: 'Cruz Roja Colombiana',
        phone: '132',
        scope: 'medical',
        note: lt('Ambulans ve arama kurtarma gönüllüleri.', 'Ambulance and SAR volunteers.'),
      },
      {
        name: 'Defensa Civil',
        phone: '144',
        scope: 'general',
        note: lt('Sivil savunma arama kurtarma.', 'Civil defence search and rescue.'),
      },
    ],
    insuranceNote: lt(
      'Sigorta önerilir; uzak bölgelerde tahliye uzun sürer.',
      'Insurance recommended; evacuation from remote areas is slow.',
    ),
    helicopterRescue: 'limited',
    languages: ['es'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  BR: {
    countryCode: 'BR',
    emergency: { general: '192', police: '190', ambulance: '192', fire: '193', sea: '185' },
    organizations: [
      {
        name: 'Corpo de Bombeiros',
        phone: '193',
        scope: 'mountain',
        note: lt(
          'Dağ ve şelale kurtarmalarını itfaiye yürütür.',
          'Fire brigade runs mountain and waterfall rescues.',
        ),
      },
      {
        name: 'Marinha — Salvamar',
        phone: '185',
        scope: 'sea',
        note: lt('Deniz kurtarma.', 'Maritime rescue.'),
      },
    ],
    insuranceNote: lt(
      'SUS acil tedavisi ücretsiz; özel tahliye için sigorta.',
      'SUS emergency care is free; insurance for private evacuation.',
    ),
    helicopterRescue: 'limited',
    languages: ['pt'],
    turkishEmbassy: { city: 'Brasília', phone: '+55 61 3242 1850' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  ZA: {
    countryCode: 'ZA',
    emergency: {
      general: '10177',
      police: '10111',
      ambulance: '10177',
      fire: '10177',
      sea: '087 094 9774',
    },
    organizations: [
      {
        name: 'Wilderness Search & Rescue (MCSA, Western Cape)',
        phone: '+27 21 937 0300',
        scope: 'mountain',
        note: lt(
          'Table Mountain ve Cape dağları; 7/24 kurtarma hattı.',
          'Table Mountain and Cape ranges; 24/7 rescue line.',
        ),
      },
      {
        name: 'NSRI',
        phone: '087 094 9774',
        scope: 'sea',
        note: lt('Gönüllü deniz kurtarma.', 'Volunteer sea rescue.'),
        url: 'https://www.nsri.org.za',
      },
    ],
    insuranceNote: lt(
      'Devlet kurtarması ücretsiz; özel ambulans/hastane için sigorta.',
      'State rescue is free; insurance for private ambulance/hospital.',
    ),
    helicopterRescue: 'free',
    languages: ['en', 'af', 'zu'],
    turkishEmbassy: { city: 'Pretoria', phone: '+27 12 342 6053' },
    notes: [
      lt('Cep telefonundan 112 de çalışır.', '112 also works from mobiles.'),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  TZ: {
    countryCode: 'TZ',
    emergency: { general: '112', police: '112', ambulance: '114', fire: '115' },
    organizations: [
      {
        name: 'KINAPA — Kilimanjaro National Park',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Park korucuları kapıya kadar sedye tahliyesi yapar (park ücretine dahil).',
          'Park rangers evacuate by stretcher to the gate (included in park fee).',
        ),
      },
      {
        name: 'Kilimanjaro SAR (özel heli)',
        phone: null,
        scope: 'medical',
        note: lt(
          'Özel helikopter kurtarma; sigorta ya da ön ödeme gerekir.',
          'Private helicopter rescue; requires insurance or upfront payment.',
        ),
      },
    ],
    insuranceNote: lt(
      'Helikopter yalnızca sigorta/ön ödeme ile; 6.000 m kapsayan poliçe şart.',
      'Helicopter only with insurance/prepayment; policy must cover 6,000 m.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['sw', 'en'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  KE: {
    countryCode: 'KE',
    emergency: { general: '999', police: '999', ambulance: '999', fire: '999' },
    organizations: [
      {
        name: 'Kenya Wildlife Service (KWS)',
        phone: '0800 597 000',
        scope: 'general',
        note: lt(
          'Mount Kenya ve milli parklar; ücretsiz acil hat.',
          'Mount Kenya and national parks; toll-free emergency line.',
        ),
      },
      {
        name: 'AMREF Flying Doctors',
        phone: '+254 20 699 2000',
        scope: 'medical',
        note: lt(
          'Hava ambulansı; üyelik ya da sigorta ile.',
          'Air ambulance; with membership or insurance.',
        ),
        url: 'https://flydoc.org',
      },
    ],
    insuranceNote: lt(
      'Hava tahliyesi sigorta/AMREF üyeliği ister.',
      'Air evacuation requires insurance or AMREF membership.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['sw', 'en'],
    turkishEmbassy: null,
    notes: [
      lt('999, 112 ve 911 aynı merkeze düşer.', '999, 112 and 911 all reach the same centre.'),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  MA: {
    countryCode: 'MA',
    emergency: { general: '150', police: '19', ambulance: '150', fire: '15', mountain: '177' },
    organizations: [
      {
        name: 'Gendarmerie Royale',
        phone: '177',
        scope: 'mountain',
        note: lt(
          'Toubkal ve kırsalda yetkili kolluk; kurtarmayı koordine eder.',
          'Responsible in Toubkal and rural areas; coordinates rescue.',
        ),
      },
      {
        name: 'Protection Civile',
        phone: '15',
        scope: 'general',
        note: lt('İtfaiye ve ambulans.', 'Fire and ambulance.'),
      },
    ],
    insuranceNote: lt(
      'Helikopter sınırlı; sigorta ve yerel rehber önerilir.',
      'Helicopters are limited; insurance and a local guide are recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['ar', 'fr'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  EG: {
    countryCode: 'EG',
    emergency: { general: '123', police: '122', ambulance: '123', fire: '180', tourist: '126' },
    organizations: [
      {
        name: 'Tourist Police',
        phone: '126',
        scope: 'general',
        note: lt(
          'Sina ve Kızıldeniz bölgelerinde turist polisi.',
          'Tourist police in Sinai and Red Sea regions.',
        ),
      },
    ],
    insuranceNote: lt(
      'Özel hastaneler peşin ister; dalış için DAN benzeri sigorta.',
      'Private hospitals demand upfront payment; DAN-style cover for diving.',
    ),
    helicopterRescue: 'limited',
    languages: ['ar', 'en'],
    turkishEmbassy: { city: 'Kahire', phone: '+20 2 2796 3318' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  GE: {
    countryCode: 'GE',
    emergency: { general: '112', police: '112', ambulance: '112', fire: '112', mountain: '112' },
    organizations: [
      {
        name: 'Emergency Management Service — Mountain Rescue',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Kazbek/Svaneti; Sınır Polisi helikopterleri 112 ile.',
          'Kazbek/Svaneti; Border Police helicopters via 112.',
        ),
      },
    ],
    insuranceNote: lt(
      'Devlet kurtarması ücretsiz; tedavi için sigorta.',
      'State rescue is free; insurance for treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['ka', 'ru', 'en'],
    turkishEmbassy: { city: 'Tiflis', phone: '+995 32 225 20 72' },
    notes: [GSM_112_NOTE, FOREIGN_MINISTRY_NOTE],
  },
  AM: {
    countryCode: 'AM',
    emergency: { general: '911', police: '102', ambulance: '103', fire: '101' },
    organizations: [
      {
        name: 'Armenian Rescue Service (MES)',
        phone: '911',
        scope: 'general',
        note: lt(
          'Aragats ve kırsal kurtarma; 112 de yönlendirir.',
          'Aragats and rural rescue; 112 also routes.',
        ),
      },
    ],
    insuranceNote: lt('Sigorta önerilir.', 'Insurance recommended.'),
    helicopterRescue: 'limited',
    languages: ['hy', 'ru'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  IR: {
    countryCode: 'IR',
    emergency: { general: '115', police: '110', ambulance: '115', fire: '125', mountain: '112' },
    organizations: [
      {
        name: 'Helal Ahmar (Kızılay) Kurtarma',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Damavand ve Alborz dağ kurtarma ekipleri.',
          'Damavand and Alborz mountain rescue teams.',
        ),
      },
    ],
    insuranceNote: lt(
      'Uluslararası sigorta çoğu zaman geçmez; yerel poliçe al.',
      'International insurance often is not accepted; buy a local policy.',
    ),
    helicopterRescue: 'limited',
    languages: ['fa'],
    turkishEmbassy: { city: 'Tahran', phone: '+98 21 3311 5299' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  GB: {
    countryCode: 'GB',
    emergency: {
      general: '999',
      police: '999',
      ambulance: '999',
      fire: '999',
      mountain: '999',
      sea: '999',
    },
    organizations: [
      {
        name: 'Mountain Rescue England & Wales',
        phone: '999',
        scope: 'mountain',
        note: lt(
          '999 → "police" → "mountain rescue" de.',
          'Dial 999, ask for police, then mountain rescue.',
        ),
        url: 'https://www.mountain.rescue.org.uk',
      },
      {
        name: 'Scottish Mountain Rescue',
        phone: '999',
        scope: 'mountain',
        note: lt('İskoçya; aynı yol 999 → polis.', 'Scotland; same route, 999 then police.'),
      },
      {
        name: 'HM Coastguard / RNLI',
        phone: '999',
        scope: 'sea',
        note: lt('999 → "coastguard".', 'Dial 999 and ask for the coastguard.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ve NHS acil ücretsiz; geri dönüş için sigorta.',
      'Rescue and NHS emergency care are free; insurance for repatriation.',
    ),
    helicopterRescue: 'free',
    languages: ['en'],
    turkishEmbassy: { city: 'Londra', phone: '+44 20 7393 0202' },
    notes: [
      lt(
        'Kayıt olursan 999’a SMS de atabilirsin (emergencySMS).',
        'Register to text 999 (emergencySMS).',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  IE: {
    countryCode: 'IE',
    emergency: {
      general: '999',
      police: '999',
      ambulance: '999',
      fire: '999',
      mountain: '999',
      sea: '999',
    },
    organizations: [
      {
        name: 'Mountain Rescue Ireland',
        phone: '999',
        scope: 'mountain',
        note: lt(
          '999/112 → Garda → mountain rescue.',
          'Dial 999/112, ask for Gardaí, then mountain rescue.',
        ),
      },
      {
        name: 'Irish Coast Guard',
        phone: '999',
        scope: 'sea',
        note: lt(
          'Kıyı ve deniz; helikopterleri dağ kurtarmada da kullanılır.',
          'Coast and sea; its helicopters also serve mountain rescue.',
        ),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; tedavi için EHIC/sigorta.',
      'Rescue is free; EHIC/insurance for treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['en', 'ga'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  FR: {
    countryCode: 'FR',
    emergency: {
      general: '112',
      police: '17',
      ambulance: '15',
      fire: '18',
      mountain: '+33 4 50 53 16 89',
      sea: '196',
    },
    organizations: [
      {
        name: 'PGHM Chamonix',
        phone: '+33 4 50 53 16 89',
        scope: 'mountain',
        note: lt(
          'Mont Blanc masifi jandarma dağ kurtarma; başka bölgelerde 112.',
          'Gendarmerie mountain rescue for the Mont Blanc massif; elsewhere call 112.',
        ),
      },
      {
        name: 'CROSS (deniz kurtarma)',
        phone: '196',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
      {
        name: 'Spéléo Secours Français',
        phone: '112',
        scope: 'cave',
        note: lt('Mağara kurtarma; 112 üzerinden görevlendirilir.', 'Cave rescue, tasked via 112.'),
      },
    ],
    insuranceNote: lt(
      'Dağ kurtarma devlet eliyle ücretsiz; kayak pistlerinde ücretlidir. Nakil ve tedavi için sigorta.',
      'State mountain rescue is free; piste rescue in ski areas is charged. Insurance for transport and treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['fr'],
    turkishEmbassy: { city: 'Paris', phone: '+33 1 53 92 71 12' },
    notes: [
      lt(
        '15 SAMU, 17 polis, 18 itfaiye; 114 SMS (işitme engelli).',
        '15 SAMU, 17 police, 18 fire; 114 by SMS (hearing-impaired).',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  ES: {
    countryCode: 'ES',
    emergency: {
      general: '112',
      police: '091',
      ambulance: '061',
      fire: '080',
      mountain: '062',
      sea: '900 202 202',
    },
    organizations: [
      {
        name: 'GREIM — Guardia Civil de Montaña',
        phone: '062',
        scope: 'mountain',
        note: lt(
          'Pireneler, Picos de Europa, Sierra Nevada dağ kurtarma.',
          'Mountain rescue in the Pyrenees, Picos de Europa, Sierra Nevada.',
        ),
      },
      {
        name: 'Salvamento Marítimo',
        phone: '900 202 202',
        scope: 'sea',
        note: lt('Ücretsiz deniz kurtarma hattı.', 'Toll-free maritime rescue line.'),
      },
    ],
    insuranceNote: lt(
      'Bazı bölgelerde (Asturias, Cantabria, Navarra, Katalonya) ihmalde kurtarma faturalanır; FEDME lisansı/sigorta önerilir.',
      'Some regions (Asturias, Cantabria, Navarre, Catalonia) bill negligent rescues; FEDME licence/insurance recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['es', 'ca', 'eu', 'gl'],
    turkishEmbassy: { city: 'Madrid', phone: '+34 91 319 80 64' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  PT: {
    countryCode: 'PT',
    emergency: {
      general: '112',
      police: '112',
      ambulance: '112',
      fire: '112',
      sea: '+351 214 401 919',
    },
    organizations: [
      {
        name: 'GNR / Proteção Civil',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Serra da Estrela ve Madeira kırsalında 112.',
          'Serra da Estrela and rural Madeira via 112.',
        ),
      },
      {
        name: 'MRCC Lisboa',
        phone: '+351 214 401 919',
        scope: 'sea',
        note: lt('Deniz kurtarma koordinasyon merkezi.', 'Maritime rescue coordination centre.'),
      },
    ],
    insuranceNote: lt(
      'INEM acil ücretsiz; sigorta önerilir.',
      'INEM emergency care is free; insurance recommended.',
    ),
    helicopterRescue: 'free',
    languages: ['pt'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  IT: {
    countryCode: 'IT',
    emergency: {
      general: '112',
      police: '113',
      ambulance: '118',
      fire: '115',
      mountain: '118',
      sea: '1530',
    },
    organizations: [
      {
        name: 'CNSAS — Soccorso Alpino e Speleologico',
        phone: '118',
        scope: 'mountain',
        note: lt(
          'Dağ ve mağara kurtarma; 112/118 üzerinden.',
          'Mountain and cave rescue; via 112/118.',
        ),
        url: 'https://www.cnsas.it',
      },
      {
        name: 'Guardia Costiera',
        phone: '1530',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
    ],
    insuranceNote: lt(
      'Bazı bölgelerde (Veneto, Trentino, Lombardia) yaralanma yoksa ya da ihmalde kurtarma faturalanır; CAI/sigorta önerilir.',
      'Some regions (Veneto, Trentino, Lombardy) bill rescues without injury or due to negligence; CAI membership/insurance recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['it'],
    turkishEmbassy: { city: 'Roma', phone: '+39 06 445 941' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  CH: {
    countryCode: 'CH',
    emergency: {
      general: '112',
      police: '117',
      ambulance: '144',
      fire: '118',
      mountain: '1414',
      sea: '117',
    },
    organizations: [
      {
        name: 'REGA',
        phone: '1414',
        scope: 'mountain',
        note: lt(
          'Hava kurtarma (yurt dışından +41 333 333 333); Valais dışında.',
          'Air rescue (from abroad +41 333 333 333); outside Valais.',
        ),
        url: 'https://www.rega.ch',
      },
      {
        name: 'Air-Glaciers / OCVS (Valais)',
        phone: '1415',
        scope: 'mountain',
        note: lt(
          'Valais kantonu hava kurtarma; 144 de yönlendirir.',
          'Air rescue in canton Valais; 144 also routes.',
        ),
      },
      {
        name: 'Air Zermatt',
        phone: '+41 27 966 86 86',
        scope: 'mountain',
        note: lt('Zermatt bölgesi helikopter kurtarma.', 'Helicopter rescue around Zermatt.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretlidir (CHF 3.000–10.000+); REGA destekçiliği ya da kurtarma kapsayan sigorta şart.',
      'Rescue is charged (CHF 3,000–10,000+); REGA patronage or insurance with rescue cover is essential.',
    ),
    helicopterRescue: 'paid',
    languages: ['de', 'fr', 'it', 'rm'],
    turkishEmbassy: { city: 'Bern', phone: '+41 31 359 70 70' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  AT: {
    countryCode: 'AT',
    emergency: { general: '112', police: '133', ambulance: '144', fire: '122', mountain: '140' },
    organizations: [
      {
        name: 'Österreichischer Bergrettungsdienst',
        phone: '140',
        scope: 'mountain',
        note: lt(
          'Alpin acil çağrı; Vorarlberg ve Tirol’de de 140.',
          'Alpine emergency number; also 140 in Vorarlberg and Tyrol.',
        ),
        url: 'https://www.bergrettung.at',
      },
      {
        name: 'ÖAMTC Christophorus (hava kurtarma)',
        phone: '144',
        scope: 'medical',
        note: lt('Helikopter ambulans; 144 üzerinden.', 'Helicopter ambulance, via 144.'),
      },
    ],
    insuranceNote: lt(
      'Dağ kurtarma ve helikopter ücretlidir; Alpenverein üyeliği ya da kurtarma sigortası şart.',
      'Mountain rescue and helicopters are charged; Alpenverein membership or rescue insurance is essential.',
    ),
    helicopterRescue: 'paid',
    languages: ['de'],
    turkishEmbassy: { city: 'Viyana', phone: '+43 1 505 73 38' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  DE: {
    countryCode: 'DE',
    emergency: {
      general: '112',
      police: '110',
      ambulance: '112',
      fire: '112',
      mountain: '112',
      sea: '124 124',
    },
    organizations: [
      {
        name: 'Bergwacht (DRK)',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Bavyera Alpleri ve orta dağlar; 112 üzerinden.',
          'Bavarian Alps and low mountain ranges; via 112.',
        ),
      },
      {
        name: 'DGzRS — Deniz Kurtarma',
        phone: '124 124',
        scope: 'sea',
        note: lt(
          'Kuzey ve Baltık denizi; cepten 124 124.',
          'North Sea and Baltic; 124 124 from a mobile.',
        ),
      },
      {
        name: 'DAV (Alpenverein)',
        phone: null,
        scope: 'mountain',
        note: lt(
          'Üyelik dünya çapında kurtarma sigortası içerir.',
          'Membership includes worldwide rescue insurance.',
        ),
        url: 'https://www.alpenverein.de',
      },
    ],
    insuranceNote: lt(
      'Kurtarma sağlık sigortasına faturalanır; sigortasız ziyaretçiler öder.',
      'Rescue is billed to health insurance; uninsured visitors pay.',
    ),
    helicopterRescue: 'free',
    languages: ['de'],
    turkishEmbassy: { city: 'Berlin', phone: '+49 30 275 850' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  NL: {
    countryCode: 'NL',
    emergency: { general: '112', police: '112', ambulance: '112', fire: '112', sea: '0900 0111' },
    organizations: [
      {
        name: 'Kustwacht / KNRM',
        phone: '0900 0111',
        scope: 'sea',
        note: lt(
          'Sahil güvenlik ve gönüllü deniz kurtarma.',
          'Coast guard and volunteer sea rescue.',
        ),
      },
    ],
    insuranceNote: lt(
      'Acil ücretsiz değildir; sigorta gerekir.',
      'Emergency care is not free; insurance required.',
    ),
    helicopterRescue: 'free',
    languages: ['nl', 'en'],
    turkishEmbassy: { city: 'Lahey', phone: '+31 70 360 49 12' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  BE: {
    countryCode: 'BE',
    emergency: {
      general: '112',
      police: '101',
      ambulance: '112',
      fire: '112',
      sea: '+32 59 70 10 00',
    },
    organizations: [
      {
        name: 'MRCC Oostende',
        phone: '+32 59 70 10 00',
        scope: 'sea',
        note: lt('Deniz kurtarma koordinasyon merkezi.', 'Maritime rescue coordination centre.'),
      },
      {
        name: 'Spéléo Secours',
        phone: '112',
        scope: 'cave',
        note: lt('Ardenler mağara kurtarma; 112 üzerinden.', 'Ardennes cave rescue via 112.'),
      },
    ],
    insuranceNote: lt('Sigorta önerilir.', 'Insurance recommended.'),
    helicopterRescue: 'free',
    languages: ['nl', 'fr', 'de'],
    turkishEmbassy: { city: 'Brüksel', phone: '+32 2 513 40 95' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  NO: {
    countryCode: 'NO',
    emergency: {
      general: '113',
      police: '112',
      ambulance: '113',
      fire: '110',
      mountain: '112',
      sea: '120',
    },
    organizations: [
      {
        name: 'Røde Kors Hjelpekorps',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Gönüllü dağ kurtarma; polis 112 görevlendirir.',
          'Volunteer mountain rescue tasked by police via 112.',
        ),
      },
      {
        name: 'Hovedredningssentralen (JRCC)',
        phone: '+47 51 51 70 00',
        scope: 'sea',
        note: lt(
          'Ana kurtarma koordinasyon merkezi (Sør-Norge).',
          'Joint rescue coordination centre (South Norway).',
        ),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; tedavi için sigorta.',
      'Rescue is free; insurance for treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['no', 'en'],
    turkishEmbassy: null,
    notes: [
      lt(
        '113 ambulans, 112 polis (dağ kurtarma), 110 itfaiye.',
        '113 ambulance, 112 police (mountain rescue), 110 fire.',
      ),
      FOREIGN_MINISTRY_NOTE,
    ],
  },
  SE: {
    countryCode: 'SE',
    emergency: {
      general: '112',
      police: '112',
      ambulance: '112',
      fire: '112',
      mountain: '112',
      sea: '112',
    },
    organizations: [
      {
        name: 'Fjällräddningen (Polis)',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Polis dağ kurtarma; Kebnekaise, Sarek.',
          'Police mountain rescue; Kebnekaise, Sarek.',
        ),
      },
      {
        name: 'Sjöräddningssällskapet',
        phone: '112',
        scope: 'sea',
        note: lt('Gönüllü deniz kurtarma.', 'Volunteer sea rescue.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; 1177 sağlık danışma.',
      'Rescue is free; 1177 for medical advice.',
    ),
    helicopterRescue: 'free',
    languages: ['sv', 'en'],
    turkishEmbassy: { city: 'Stockholm', phone: '+46 8 23 08 40' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  FI: {
    countryCode: 'FI',
    emergency: { general: '112', police: '112', ambulance: '112', fire: '112', sea: '0294 1000' },
    organizations: [
      {
        name: 'Vapepa (gönüllü kurtarma)',
        phone: '112',
        scope: 'general',
        note: lt(
          'Laponya ve ormanlarda arama; 112 üzerinden.',
          'Search in Lapland and forests via 112.',
        ),
      },
      {
        name: 'Meripelastuskeskus (MRCC Turku)',
        phone: '0294 1000',
        scope: 'sea',
        note: lt('Deniz kurtarma.', 'Maritime rescue.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; 112 Suomi uygulaması konum gönderir.',
      'Rescue is free; the 112 Suomi app sends your location.',
    ),
    helicopterRescue: 'free',
    languages: ['fi', 'sv', 'en'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  IS: {
    countryCode: 'IS',
    emergency: {
      general: '112',
      police: '112',
      ambulance: '112',
      fire: '112',
      mountain: '112',
      sea: '112',
    },
    organizations: [
      {
        name: 'ICE-SAR (Landsbjörg)',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Gönüllü arama kurtarma; SafeTravel.is’e seyahat planı bırak.',
          'Volunteer SAR; file a travel plan on SafeTravel.is.',
        ),
        url: 'https://safetravel.is',
      },
      {
        name: 'Icelandic Coast Guard',
        phone: '112',
        scope: 'sea',
        note: lt('Helikopter ve deniz kurtarma.', 'Helicopter and maritime rescue.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; "112 Iceland" uygulaması konumunu paylaşır.',
      'Rescue is free; the "112 Iceland" app shares your location.',
    ),
    helicopterRescue: 'free',
    languages: ['is', 'en'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  PL: {
    countryCode: 'PL',
    emergency: {
      general: '112',
      police: '997',
      ambulance: '999',
      fire: '998',
      mountain: '601 100 300',
      sea: '601 100 100',
    },
    organizations: [
      {
        name: 'TOPR (Tatra)',
        phone: '601 100 300',
        scope: 'mountain',
        note: lt(
          'Tatra dağ kurtarma; Ratunek uygulaması konum yollar.',
          'Tatra mountain rescue; the Ratunek app sends your location.',
        ),
        url: 'https://topr.pl',
      },
      {
        name: 'GOPR (diğer dağlar)',
        phone: '985',
        scope: 'mountain',
        note: lt('Karkonosze, Beskidy, Bieszczady.', 'Karkonosze, Beskids, Bieszczady.'),
      },
      {
        name: 'WOPR (su kurtarma)',
        phone: '601 100 100',
        scope: 'sea',
        note: lt('Göl ve deniz kıyısı.', 'Lakes and coast.'),
      },
    ],
    insuranceNote: lt(
      'Polonya tarafında kurtarma ücretsiz; Slovak Tatra’sında ücretli.',
      'Rescue is free on the Polish side; charged in the Slovak Tatras.',
    ),
    helicopterRescue: 'free',
    languages: ['pl'],
    turkishEmbassy: { city: 'Varşova', phone: '+48 22 854 61 10' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  CZ: {
    countryCode: 'CZ',
    emergency: { general: '112', police: '158', ambulance: '155', fire: '150', mountain: '1210' },
    organizations: [
      {
        name: 'Horská služba ČR',
        phone: '1210',
        scope: 'mountain',
        note: lt(
          'Krkonoše, Šumava, Jeseníky dağ kurtarma.',
          'Mountain rescue in Krkonoše, Šumava, Jeseníky.',
        ),
        url: 'https://www.horskasluzba.cz',
      },
    ],
    insuranceNote: lt(
      'Kurtarma sağlık sigortasına faturalanır; sigorta şart.',
      'Rescue is billed to health insurance; carry insurance.',
    ),
    helicopterRescue: 'free',
    languages: ['cs'],
    turkishEmbassy: { city: 'Prag', phone: '+420 224 311 402' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  SK: {
    countryCode: 'SK',
    emergency: { general: '112', police: '158', ambulance: '155', fire: '150', mountain: '18 300' },
    organizations: [
      {
        name: 'Horská záchranná služba (HZS)',
        phone: '18 300',
        scope: 'mountain',
        note: lt(
          'Yüksek Tatra; kurtarma sigortasız kişiye faturalanır.',
          'High Tatras; rescue is billed to the uninsured.',
        ),
        url: 'https://www.hzs.sk',
      },
    ],
    insuranceNote: lt(
      'Dağ kurtarma ÜCRETLİ; günlük dağ sigortası (HZS/Alpenverein) zorunlu sayılmalı.',
      'Mountain rescue is CHARGED; treat daily mountain insurance (HZS/Alpenverein) as mandatory.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['sk'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  SI: {
    countryCode: 'SI',
    emergency: { general: '112', police: '113', ambulance: '112', fire: '112', mountain: '112' },
    organizations: [
      {
        name: 'GRZS — Gorska reševalna zveza',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Julian Alpleri/Triglav dağ kurtarma.',
          'Mountain rescue in the Julian Alps/Triglav.',
        ),
        url: 'https://www.grzs.si',
      },
    ],
    insuranceNote: lt(
      'Kaza durumunda ücretsiz; ihmalde faturalanır. PZS/Alpenverein önerilir.',
      'Free after an accident; billed for negligence. PZS/Alpenverein recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['sl'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  HR: {
    countryCode: 'HR',
    emergency: {
      general: '112',
      police: '192',
      ambulance: '194',
      fire: '193',
      mountain: '112',
      sea: '195',
    },
    organizations: [
      {
        name: 'HGSS — Hrvatska gorska služba spašavanja',
        phone: '112',
        scope: 'mountain',
        note: lt('Dağ, kanyon ve mağara kurtarma.', 'Mountain, canyon and cave rescue.'),
        url: 'https://www.hgss.hr',
      },
      {
        name: 'MRCC Rijeka',
        phone: '195',
        scope: 'sea',
        note: lt('Deniz kurtarma.', 'Maritime rescue.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; tedavi için sigorta.',
      'Rescue is free; insurance for treatment.',
    ),
    helicopterRescue: 'free',
    languages: ['hr'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  GR: {
    countryCode: 'GR',
    emergency: {
      general: '112',
      police: '100',
      ambulance: '166',
      fire: '199',
      mountain: '199',
      sea: '108',
      tourist: '1571',
    },
    organizations: [
      {
        name: 'EKAB (ambulans)',
        phone: '166',
        scope: 'medical',
        note: lt('Ulusal ambulans.', 'National ambulance.'),
      },
      {
        name: 'EMAK / Hellenic Rescue Team',
        phone: '199',
        scope: 'mountain',
        note: lt(
          'İtfaiye özel birimleri + gönüllü ekip; Olympos, Girit kanyonları.',
          'Fire brigade special units + volunteer team; Olympus, Cretan gorges.',
        ),
      },
      {
        name: 'Limeniko (Sahil Güvenlik)',
        phone: '108',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz ama sınırlı; sigorta önerilir.',
      'Rescue is free but limited; insurance recommended.',
    ),
    helicopterRescue: 'limited',
    languages: ['el', 'en'],
    turkishEmbassy: { city: 'Atina', phone: '+30 210 726 3000' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  BG: {
    countryCode: 'BG',
    emergency: { general: '112', police: '166', ambulance: '150', fire: '160', mountain: '1470' },
    organizations: [
      {
        name: 'PSS — Planinska spasitelna sluzhba',
        phone: '1470',
        scope: 'mountain',
        note: lt(
          'Rila, Pirin, Balkan dağ kurtarma (cepten 1470).',
          'Mountain rescue in Rila, Pirin, Balkan (1470 from a mobile).',
        ),
        url: 'https://www.pss-bg.bg',
      },
    ],
    insuranceNote: lt(
      'Kurtarma faturalanabilir; PSS günlük sigortası çok ucuz.',
      'Rescue may be billed; PSS daily insurance is very cheap.',
    ),
    helicopterRescue: 'limited',
    languages: ['bg'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  RO: {
    countryCode: 'RO',
    emergency: {
      general: '112',
      police: '112',
      ambulance: '112',
      fire: '112',
      mountain: '0725 826 668',
    },
    organizations: [
      {
        name: 'Salvamont',
        phone: '0725 826 668',
        scope: 'mountain',
        note: lt(
          '0-SALVAMONT; Karpatlar dağ kurtarma.',
          '0-SALVAMONT; Carpathian mountain rescue.',
        ),
        url: 'https://www.salvamont.org',
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; SMURD helikopteri 112 ile.',
      'Rescue is free; SMURD helicopter via 112.',
    ),
    helicopterRescue: 'free',
    languages: ['ro'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  RU: {
    countryCode: 'RU',
    emergency: { general: '112', police: '102', ambulance: '103', fire: '101', mountain: '112' },
    organizations: [
      {
        name: 'MChS (EMERCOM) arama kurtarma',
        phone: '112',
        scope: 'mountain',
        note: lt(
          'Elbrus/Altay öncesi rotayı MChS’e kaydettir.',
          'Register your route with MChS before Elbrus/Altai.',
        ),
      },
    ],
    insuranceNote: lt(
      'Sigorta şart; helikopter ücretli ve sınırlı.',
      'Insurance essential; helicopters are charged and limited.',
    ),
    helicopterRescue: 'limited',
    languages: ['ru'],
    turkishEmbassy: { city: 'Moskova', phone: '+7 495 994 43 60' },
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  KZ: {
    countryCode: 'KZ',
    emergency: { general: '112', police: '102', ambulance: '103', fire: '101', mountain: '112' },
    organizations: [
      {
        name: 'MChS Kazakistan — dağ kurtarma',
        phone: '112',
        scope: 'mountain',
        note: lt('Almatı Tien Shan; rotayı kaydettir.', 'Almaty Tien Shan; register your route.'),
      },
    ],
    insuranceNote: lt(
      'Sigorta şart; helikopter sınırlı.',
      'Insurance essential; helicopters are limited.',
    ),
    helicopterRescue: 'limited',
    languages: ['kk', 'ru'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  KG: {
    countryCode: 'KG',
    emergency: { general: '112', police: '102', ambulance: '103', fire: '101', mountain: '161' },
    organizations: [
      {
        name: 'MChS Kırgızistan',
        phone: '161',
        scope: 'mountain',
        note: lt(
          'Devlet kurtarma; Han Tengri/Pobeda için özel heli gerekir.',
          'State rescue; Khan Tengri/Pobeda need private helicopters.',
        ),
      },
    ],
    insuranceNote: lt(
      'Özel helikopter tahliyesi ön ödeme ister; 7.000 m kapsayan sigorta şart.',
      'Private helicopter evacuation needs prepayment; insurance to 7,000 m is essential.',
    ),
    helicopterRescue: 'insurance_required',
    languages: ['ky', 'ru'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  UZ: {
    countryCode: 'UZ',
    emergency: { general: '112', police: '102', ambulance: '103', fire: '101' },
    organizations: [
      {
        name: 'MChS Özbekistan',
        phone: '1050',
        scope: 'general',
        note: lt(
          'Acil durumlar bakanlığı; Chimgan dağları.',
          'Emergency ministry; Chimgan mountains.',
        ),
      },
    ],
    insuranceNote: lt('Sigorta şart.', 'Insurance essential.'),
    helicopterRescue: 'limited',
    languages: ['uz', 'ru'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  MN: {
    countryCode: 'MN',
    emergency: { general: '103', police: '102', ambulance: '103', fire: '101' },
    organizations: [
      {
        name: 'NEMA — Ulusal Acil Yönetim Ajansı',
        phone: '105',
        scope: 'general',
        note: lt('Arama kurtarma; Altay Tavan Bogd.', 'Search and rescue; Altai Tavan Bogd.'),
      },
    ],
    insuranceNote: lt(
      'Uzaklıklar çok büyük; uydu cihazı ve sigorta şart.',
      'Distances are vast; satellite device and insurance are essential.',
    ),
    helicopterRescue: 'limited',
    languages: ['mn'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  AE: {
    countryCode: 'AE',
    emergency: { general: '999', police: '999', ambulance: '998', fire: '997', sea: '996' },
    organizations: [
      {
        name: 'Police Search & Rescue (RAK / Fujairah)',
        phone: '999',
        scope: 'mountain',
        note: lt('Hacar dağları; polis helikopterleri.', 'Hajar mountains; police helicopters.'),
      },
      {
        name: 'Coast Guard',
        phone: '996',
        scope: 'sea',
        note: lt('Deniz acil hattı.', 'Maritime emergency line.'),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; hastane için sigorta.',
      'Rescue is free; insurance for hospital care.',
    ),
    helicopterRescue: 'free',
    languages: ['ar', 'en'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
  OM: {
    countryCode: 'OM',
    emergency: { general: '9999', police: '9999', ambulance: '9999', fire: '9999' },
    organizations: [
      {
        name: 'Royal Oman Police — SAR',
        phone: '9999',
        scope: 'mountain',
        note: lt(
          'Cebel Şems / Cebel Ahdar; polis helikopterleri.',
          'Jebel Shams / Jebel Akhdar; police helicopters.',
        ),
      },
    ],
    insuranceNote: lt(
      'Kurtarma ücretsiz; hastane için sigorta.',
      'Rescue is free; insurance for hospital care.',
    ),
    helicopterRescue: 'free',
    languages: ['ar', 'en'],
    turkishEmbassy: null,
    notes: [FOREIGN_MINISTRY_NOTE],
  },
};

/** Bilinmeyen ülke için 112 tabanlı genel profil. */
export const FALLBACK_PROFILE: RescueProfile = {
  countryCode: UNKNOWN_COUNTRY,
  emergency: { general: '112', police: '112', ambulance: '112', fire: '112' },
  organizations: [],
  insuranceNote: lt(
    'Ülke tespit edilemedi; kurtarma ücreti bilinmiyor. Sigorta poliçenin acil hattını ara.',
    'Country not detected; rescue costs are unknown. Call your insurer’s emergency line.',
  ),
  helicopterRescue: 'limited',
  languages: ['en'],
  turkishEmbassy: null,
  notes: [GSM_112_NOTE, FOREIGN_MINISTRY_NOTE],
};

/** Dizindeki ülke kodları (alfabetik). */
export const RESCUE_COUNTRY_CODES: string[] = Object.keys(RESCUE_DIRECTORY).sort();

/** Ülke koduna göre profil; yoksa 112 tabanlı genel profil. */
export function rescueProfileFor(countryCode: string | null | undefined): RescueProfile {
  if (!countryCode) return FALLBACK_PROFILE;
  return RESCUE_DIRECTORY[countryCode.toUpperCase()] ?? FALLBACK_PROFILE;
}

export type RescueNumberKind = 'general' | 'mountain' | 'sea' | 'medical';

/**
 * Amaca göre aranacak numara: özel hat varsa o, yoksa ilgili örgütün telefonu,
 * o da yoksa genel acil numara.
 */
export function primaryNumber(profile: RescueProfile, kind: RescueNumberKind): string {
  const orgPhone = (scope: RescueScope) =>
    profile.organizations.find((o) => o.scope === scope && o.phone)?.phone ?? null;
  switch (kind) {
    case 'mountain':
      return profile.emergency.mountain ?? orgPhone('mountain') ?? profile.emergency.general;
    case 'sea':
      return profile.emergency.sea ?? orgPhone('sea') ?? profile.emergency.general;
    case 'medical':
      return profile.emergency.ambulance ?? orgPhone('medical') ?? profile.emergency.general;
    default:
      return profile.emergency.general;
  }
}

/** Dağ kurtarma için genel numaradan farklı bir hat varsa döner. */
export function mountainNumber(profile: RescueProfile): string | null {
  const n = primaryNumber(profile, 'mountain');
  return n !== profile.emergency.general ? n : null;
}

/** `tel:` bağlantısı; boşluk, tire, parantez ve noktaları temizler (`*500` gibi kısa kodlar korunur). */
export function dialUrl(number: string): string {
  const cleaned = number.replace(/[\s\-().]/g, '');
  return `tel:${cleaned}`;
}

/** Bayrak emojisi (bölgesel gösterge harfleri); bilinmeyen kod için 🏳️. */
export function rescueCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2 || countryCode === UNKNOWN_COUNTRY) return '🏳️';
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

/** `Intl.DisplayNames` yoksa kullanılan kısa yedek tablo. */
const COUNTRY_NAME_FALLBACK: Record<string, LocalizedText> = {
  TR: lt('Türkiye', 'Türkiye'),
  NP: lt('Nepal', 'Nepal'),
  IN: lt('Hindistan', 'India'),
  PK: lt('Pakistan', 'Pakistan'),
  CN: lt('Çin', 'China'),
  JP: lt('Japonya', 'Japan'),
  KR: lt('Güney Kore', 'South Korea'),
  TH: lt('Tayland', 'Thailand'),
  ID: lt('Endonezya', 'Indonesia'),
  AU: lt('Avustralya', 'Australia'),
  NZ: lt('Yeni Zelanda', 'New Zealand'),
  US: lt('ABD', 'United States'),
  CA: lt('Kanada', 'Canada'),
  MX: lt('Meksika', 'Mexico'),
  PE: lt('Peru', 'Peru'),
  CL: lt('Şili', 'Chile'),
  AR: lt('Arjantin', 'Argentina'),
  BO: lt('Bolivya', 'Bolivia'),
  CO: lt('Kolombiya', 'Colombia'),
  BR: lt('Brezilya', 'Brazil'),
  ZA: lt('Güney Afrika', 'South Africa'),
  TZ: lt('Tanzanya', 'Tanzania'),
  KE: lt('Kenya', 'Kenya'),
  MA: lt('Fas', 'Morocco'),
  EG: lt('Mısır', 'Egypt'),
  GE: lt('Gürcistan', 'Georgia'),
  AM: lt('Ermenistan', 'Armenia'),
  IR: lt('İran', 'Iran'),
  GB: lt('Birleşik Krallık', 'United Kingdom'),
  IE: lt('İrlanda', 'Ireland'),
  FR: lt('Fransa', 'France'),
  ES: lt('İspanya', 'Spain'),
  PT: lt('Portekiz', 'Portugal'),
  IT: lt('İtalya', 'Italy'),
  CH: lt('İsviçre', 'Switzerland'),
  AT: lt('Avusturya', 'Austria'),
  DE: lt('Almanya', 'Germany'),
  NL: lt('Hollanda', 'Netherlands'),
  BE: lt('Belçika', 'Belgium'),
  NO: lt('Norveç', 'Norway'),
  SE: lt('İsveç', 'Sweden'),
  FI: lt('Finlandiya', 'Finland'),
  IS: lt('İzlanda', 'Iceland'),
  PL: lt('Polonya', 'Poland'),
  CZ: lt('Çekya', 'Czechia'),
  SK: lt('Slovakya', 'Slovakia'),
  SI: lt('Slovenya', 'Slovenia'),
  HR: lt('Hırvatistan', 'Croatia'),
  GR: lt('Yunanistan', 'Greece'),
  BG: lt('Bulgaristan', 'Bulgaria'),
  RO: lt('Romanya', 'Romania'),
  RU: lt('Rusya', 'Russia'),
  KZ: lt('Kazakistan', 'Kazakhstan'),
  KG: lt('Kırgızistan', 'Kyrgyzstan'),
  UZ: lt('Özbekistan', 'Uzbekistan'),
  MN: lt('Moğolistan', 'Mongolia'),
  AE: lt('BAE', 'United Arab Emirates'),
  OM: lt('Umman', 'Oman'),
};

type DisplayNamesCtor = new (
  locales: string | string[],
  options: { type: 'region' | 'language' },
) => { of(code: string): string | undefined };

function displayNames(
  locale: string,
  type: 'region' | 'language',
): ((code: string) => string | undefined) | null {
  const ctor = (Intl as unknown as { DisplayNames?: DisplayNamesCtor }).DisplayNames;
  if (!ctor) return null;
  try {
    const dn = new ctor(locale, { type });
    return (code) => {
      try {
        return dn.of(code);
      } catch {
        return undefined;
      }
    };
  } catch {
    return null;
  }
}

/** Ülke adı: `Intl.DisplayNames` (Hermes destekler), yoksa yedek tablo, o da yoksa kod. */
export function countryName(countryCode: string | null | undefined, locale: string): string {
  if (!countryCode || countryCode === UNKNOWN_COUNTRY)
    return locale === 'tr' ? 'Bilinmeyen ülke' : 'Unknown country';
  const code = countryCode.toUpperCase();
  const fallback = COUNTRY_NAME_FALLBACK[code];
  const viaIntl = displayNames(locale, 'region')?.(code);
  if (viaIntl && viaIntl !== code) return viaIntl;
  return fallback ? localizedText(fallback, locale) : code;
}

/** Dil adı (`Intl.DisplayNames`), yoksa kodun büyük harfi. */
export function languageName(languageCode: string, locale: string): string {
  return displayNames(locale, 'language')?.(languageCode) ?? languageCode.toUpperCase();
}

/** Tek satırlık özet: "Acil 112 · Polis 155 · Ambulans 112 · Dağ 140". */
export function rescueSummary(profile: RescueProfile, locale: string): string {
  const tr = locale === 'tr';
  const e = profile.emergency;
  const parts = [`${tr ? 'Acil' : 'Emergency'} ${e.general}`];
  if (e.police !== e.general) parts.push(`${tr ? 'Polis' : 'Police'} ${e.police}`);
  if (e.ambulance !== e.general) parts.push(`${tr ? 'Ambulans' : 'Ambulance'} ${e.ambulance}`);
  if (e.mountain && e.mountain !== e.general)
    parts.push(`${tr ? 'Dağ' : 'Mountain'} ${e.mountain}`);
  if (e.sea && e.sea !== e.general) parts.push(`${tr ? 'Deniz' : 'Sea'} ${e.sea}`);
  if (e.tourist) parts.push(`${tr ? 'Turist polisi' : 'Tourist police'} ${e.tourist}`);
  return parts.join(' · ');
}
