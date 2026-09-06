import type { ConsultStatus, ConsultUrgency, DoctorSpecialty } from './enums';
import type { Consultation, ConsultMessage, Doctor, ID } from './types';

/**
 * Tele-tıp (çevrimiçi doktor) saf iş mantığı.
 *
 * - `localTriage`: anahtar kelime tabanlı ön triyaj (aciliyet + adımlar + rehber slug'ı).
 * - `matchDoctors`: uzmanlık / dil / ülke / yanıt süresine göre doktor sıralama.
 * - Danışma durumu, süre ve özet yardımcıları.
 *
 * Tıbbi içerik WMS (Wilderness Medical Society) ve ERC kılavuzlarına dayanır;
 * tavsiye niteliğindedir, acil servisin yerini tutmaz.
 */

export const TELEMED_MODULE = 'telemed';

/** i18n anahtarı: "Tele-tıp acil servisin yerini tutmaz; hayati tehlikede 112" */
export const DOCTOR_DISCLAIMER = 'telemed.disclaimer' as const;

/* ------------------------------------------------------------------ */
/* Triyaj                                                               */
/* ------------------------------------------------------------------ */

export const TRIAGE_KINDS = [
  'unconscious',
  'chest_pain',
  'anaphylaxis',
  'drowning',
  'dive',
  'altitude',
  'snakebite',
  'bleeding',
  'hypothermia',
  'heat',
  'burns',
  'fracture',
  'sting',
  'tick',
  'unknown',
] as const;
export type TriageKind = (typeof TRIAGE_KINDS)[number];

export interface TriageResult {
  kind: TriageKind;
  urgency: ConsultUrgency;
  steps: string[];
  firstAidSlug: string | null;
  /** critical/high → acil numarayı arama önerisi */
  callEmergency: boolean;
}

/** Tür bağlantısı için gereken asgari alanlar (t.species boş olabilir). */
export interface TriageSpeciesHint {
  firstAidSlug: string | null;
  danger?: string | null;
  commonName?: string | null;
}

interface TriageRule {
  kind: TriageKind;
  urgency: ConsultUrgency;
  firstAidSlug: string | null;
  /** Normalize edilmiş (küçük harf, Türkçe karaktersiz) anahtar kelimeler */
  keywords: string[];
  steps: { tr: string[]; en: string[] };
}

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir; eşleşme için. */
export function normalizeComplaint(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

/** Öncelik sırasına göre (ilk eşleşen kazanır) kurallar. */
const TRIAGE_RULES: TriageRule[] = [
  {
    kind: 'unconscious',
    urgency: 'critical',
    firstAidSlug: 'cpr',
    keywords: [
      'bilinc kayb',
      'bilinci kapali',
      'bilinci yok',
      'bayildi',
      'tepki vermiyor',
      'nefes almiyor',
      'nabiz yok',
      'unconscious',
      'not breathing',
      'no pulse',
      'unresponsive',
      'passed out',
      'collapsed',
    ],
    steps: {
      tr: [
        'Hemen 112’yi arayın; hoparlörü açın ve talimatları uygulayın.',
        'Omuzdan sarsıp seslenin; tepki ve normal solunum kontrol edin (10 sn).',
        'Solunum yoksa göğüs basısına başlayın: dakikada 100–120, 5–6 cm derinlik.',
        'Solunum varsa yan yatırın (kurtarma pozisyonu) ve sıcak tutun.',
        'Yalnız değilseniz biri yardımı yönlendirsin, biri basıya devam etsin.',
      ],
      en: [
        'Call the emergency number now; use speaker and follow instructions.',
        'Shake the shoulders and shout; check response and normal breathing (10 s).',
        'If not breathing, start chest compressions: 100–120/min, 5–6 cm deep.',
        'If breathing, place in the recovery position and keep warm.',
        'If not alone, one person guides help while the other continues compressions.',
      ],
    },
  },
  {
    kind: 'chest_pain',
    urgency: 'critical',
    firstAidSlug: 'cpr',
    keywords: [
      'gogus agri',
      'gogsum',
      'kalp kriz',
      'gogus sikis',
      'kolum uyus',
      'chest pain',
      'heart attack',
      'chest tight',
      'chest pressure',
    ],
    steps: {
      tr: [
        '112’yi arayın; yürümeyi ve tırmanmayı bırakın, oturun.',
        'Alerji yoksa 300 mg aspirini çiğnetin.',
        'Dar giysileri gevşetin, sakin kalmasını sağlayın.',
        'Bilinç kapanırsa göğüs basısına hazır olun.',
      ],
      en: [
        'Call emergency services; stop walking or climbing and sit down.',
        'If no allergy, chew 300 mg aspirin.',
        'Loosen tight clothing and keep the person calm.',
        'Be ready to start chest compressions if they lose consciousness.',
      ],
    },
  },
  {
    kind: 'anaphylaxis',
    urgency: 'critical',
    firstAidSlug: 'anaphylaxis',
    keywords: [
      'anafilaksi',
      'alerjik sok',
      'alerji',
      'dudak sis',
      'dil sis',
      'bogaz sis',
      'yuz sis',
      'kurdesen',
      'urtiker',
      'ari sok',
      'esek aris',
      'anaphyla',
      'allergic',
      'swollen lips',
      'swollen tongue',
      'throat swelling',
      'hives',
      'bee sting',
      'wasp sting',
    ],
    steps: {
      tr: [
        'Adrenalin oto-enjektör (EpiPen) varsa hemen uyluk dış yanına uygulayın.',
        '112’yi arayın; 5–15 dk içinde düzelme yoksa ikinci doz.',
        'Nefes darlığı varsa oturtun; baygınlık varsa ayakları yüksek yatırın.',
        'Antihistaminik yalnızca ek destektir, adrenalinin yerini tutmaz.',
        'İğne yerini soğuk tutun; sokan hayvanın iğnesini kazıyarak çıkarın.',
      ],
      en: [
        'If an adrenaline auto-injector (EpiPen) is available, inject into the outer thigh now.',
        'Call emergency services; give a second dose if no improvement in 5–15 min.',
        'Sit up if short of breath; lie down with legs raised if faint.',
        'Antihistamines are only supportive; they do not replace adrenaline.',
        'Cool the sting site; scrape out any stinger.',
      ],
    },
  },
  {
    kind: 'drowning',
    urgency: 'critical',
    firstAidSlug: 'drowning',
    keywords: [
      'bogulma',
      'bogul',
      'suya dus',
      'su yuttu',
      'drown',
      'fell in water',
      'swallowed water',
    ],
    steps: {
      tr: [
        'Kendinizi riske atmadan sudan çıkarın (uzat, at, sonra yüz).',
        'Tepki ve solunum yok ise 5 kurtarıcı soluk verip CPR’a başlayın.',
        '112’yi arayın; 30 bası / 2 soluk ile devam edin.',
        'Solunum varsa yan yatırın; ıslak giysileri çıkarıp ısıtın.',
        'Kurtulsa bile hastaneye gitmeli (geç boğulma riski).',
      ],
      en: [
        'Get them out of the water without risking yourself (reach, throw, then go).',
        'If no response and no breathing, give 5 rescue breaths, then start CPR.',
        'Call emergency services; continue 30 compressions / 2 breaths.',
        'If breathing, recovery position; remove wet clothing and warm up.',
        'Even if recovered, go to hospital (risk of delayed drowning).',
      ],
    },
  },
  {
    kind: 'dive',
    urgency: 'critical',
    firstAidSlug: null,
    keywords: [
      'dalis',
      'dekompresyon',
      'vurgun',
      'dalgic',
      'dalistan sonra',
      'decompression',
      'the bends',
      'after diving',
      'scuba',
    ],
    steps: {
      tr: [
        'Yatırın, %100 oksijen verin (varsa) — semptomlar geçse bile kesmeyin.',
        '112 ve en yakın basınç odasını (hiperbarik merkez) arayın.',
        'Bol su içirin; alkol ve sıcak duş yok.',
        'Yeniden suya girmeyin; uçuşu ve yükseklik değişimini erteleyin.',
        'Dalış bilgisayarı / profil verisini doktora iletin.',
      ],
      en: [
        'Lie down, give 100% oxygen if available — keep it on even if symptoms ease.',
        'Call emergency services and the nearest recompression (hyperbaric) chamber.',
        'Give plenty of water; no alcohol, no hot shower.',
        'Do not re-enter the water; avoid flying and altitude changes.',
        'Send the dive computer profile to the doctor.',
      ],
    },
  },
  {
    kind: 'altitude',
    urgency: 'high',
    firstAidSlug: 'altitude',
    keywords: [
      'irtifa',
      'yukseklik hast',
      'ams',
      'hape',
      'hace',
      'dag hastaligi',
      'akciger odem',
      'beyin odem',
      'altitude',
      'mountain sickness',
      'pulmonary edema',
      'cerebral edema',
    ],
    steps: {
      tr: [
        'İN! Belirti ilerliyorsa en az 500–1000 m alçalın; gecikmeyin.',
        'Yürüyememe, konuşma bozukluğu, köpüklü balgam → HACE/HAPE: acil iniş + 112.',
        'Varsa oksijen; ilaç: asetazolamid (AMS), deksametazon (HACE), nifedipin (HAPE).',
        'Hastayı yalnız bırakmayın; ısıtın, sıvı verin, uyutmayın (ağırsa).',
        'Belirtiler geçene kadar daha yükseğe çıkmayın.',
      ],
      en: [
        'DESCEND! If symptoms progress, go down at least 500–1000 m without delay.',
        'Cannot walk straight, confused speech, frothy sputum → HACE/HAPE: urgent descent + emergency call.',
        'Oxygen if available; drugs: acetazolamide (AMS), dexamethasone (HACE), nifedipine (HAPE).',
        'Never leave the patient alone; keep warm, hydrate.',
        'Do not go higher until symptoms fully resolve.',
      ],
    },
  },
  {
    kind: 'snakebite',
    urgency: 'high',
    firstAidSlug: 'snakebite',
    keywords: ['yilan', 'engerek', 'kobra', 'snake', 'viper', 'adder', 'cobra'],
    steps: {
      tr: [
        'Hareketsiz tutun; ısırılan uzvu kalp seviyesinin altında sabitleyin.',
        'Turnike YOK, kesme YOK, emme YOK, buz YOK.',
        'Isırık saatini not edin; şişliğin sınırını kalemle işaretleyin, fotoğraf çekin.',
        'Yüzük, saat ve dar giysileri çıkarın.',
        '112’yi arayın; en yakın antivenom bulunan hastaneye gidin. Yılanı yakalamaya çalışmayın.',
      ],
      en: [
        'Keep the person still; immobilize the bitten limb below heart level.',
        'NO tourniquet, NO cutting, NO sucking, NO ice.',
        'Note the time of the bite; mark the edge of swelling with a pen and take a photo.',
        'Remove rings, watches and tight clothing.',
        'Call emergency services; go to the nearest hospital with antivenom. Do not try to catch the snake.',
      ],
    },
  },
  {
    kind: 'bleeding',
    urgency: 'high',
    firstAidSlug: 'bleeding',
    keywords: [
      'kanama',
      'kan durm',
      'kaniyor',
      'derin kesik',
      'kesik',
      'yara',
      'fiskir',
      'bleed',
      'deep cut',
      'laceration',
      'wound',
      'spurting',
    ],
    steps: {
      tr: [
        'Temiz bez/gazlı bezle doğrudan ve sürekli bası uygulayın (en az 10 dk).',
        'Bez ıslanırsa üstüne yenisini ekleyin, kaldırmayın.',
        'Uzvu yükseltin; durmayan uzuv kanamasında turnike (saatini yazın).',
        'Baskılı sargı yapın; şok belirtilerinde (soğuk, solgun, hızlı nabız) yatırıp ayakları kaldırın.',
        'Durmayan kanama veya şok → 112.',
      ],
      en: [
        'Apply firm, continuous direct pressure with clean cloth/gauze (at least 10 min).',
        'If soaked, add more on top — do not remove.',
        'Elevate the limb; tourniquet for uncontrolled limb bleeding (write down the time).',
        'Apply a pressure bandage; if shock signs (cold, pale, fast pulse) lie down and raise legs.',
        'Uncontrolled bleeding or shock → call emergency services.',
      ],
    },
  },
  {
    kind: 'hypothermia',
    urgency: 'high',
    firstAidSlug: 'hypothermia',
    keywords: [
      'hipotermi',
      'donma',
      'donuyor',
      'titre',
      'cok usu',
      'soguk',
      'hypotherm',
      'freezing',
      'shiver',
      'frostbite',
      'too cold',
    ],
    steps: {
      tr: [
        'Rüzgâr ve ıslaklıktan koruyun; ıslak giysileri çıkarın, kuru katmanlarla sarın.',
        'Yerden yalıtın (mat, çanta); baş ve boynu örtün.',
        'Bilinç açıksa ılık, şekerli içecek; alkol yok.',
        'Sıcak paketleri koltuk altı, kasık ve göğse (deriye direkt değil).',
        'Titreme durdu, bilinç bulanık → ağır hipotermi: nazikçe taşıyın, 112.',
      ],
      en: [
        'Shelter from wind and wet; remove wet clothes, wrap in dry layers.',
        'Insulate from the ground (mat, pack); cover head and neck.',
        'If alert, give warm sweet drinks; no alcohol.',
        'Heat packs to armpits, groin and chest (not directly on skin).',
        'Shivering stopped, confused → severe hypothermia: handle gently, call emergency.',
      ],
    },
  },
  {
    kind: 'heat',
    urgency: 'high',
    firstAidSlug: 'heat',
    keywords: [
      'sicak carp',
      'gunes carp',
      'asiri sicak',
      'terlemiyor',
      'heat stroke',
      'heatstroke',
      'sunstroke',
      'heat exhaustion',
      'overheat',
    ],
    steps: {
      tr: [
        'Gölgeye alın; fazla giysileri çıkarın.',
        'Vücudu ıslatıp yelpazeleyin; boyun, koltuk altı ve kasığa soğuk uygulayın.',
        'Bilinç açıksa yudum yudum su / elektrolit.',
        'Bilinç bulanıklığı, kusma, terlemenin durması → sıcak çarpması: 112, hızla soğutun.',
      ],
      en: [
        'Move to shade; remove excess clothing.',
        'Wet the body and fan; cold packs to neck, armpits and groin.',
        'If alert, sip water / electrolytes.',
        'Confusion, vomiting, no sweating → heat stroke: call emergency, cool aggressively.',
      ],
    },
  },
  {
    kind: 'burns',
    urgency: 'medium',
    firstAidSlug: 'burns',
    keywords: ['yanik', 'yandi', 'haslan', 'ocak', 'burn', 'scald'],
    steps: {
      tr: [
        'Yanığı 20 dk boyunca ılık/soğuk akan suyla soğutun (buz yok).',
        'Takı ve gevşek giysileri çıkarın; yapışanı çekmeyin.',
        'Temiz, yapışmayan örtü veya streç film ile örtün; krem/diş macunu yok.',
        'Avuç içinden büyük, yüz/el/eklem yanığı veya kabarcıklar → doktor.',
      ],
      en: [
        'Cool the burn under cool running water for 20 min (no ice).',
        'Remove jewelry and loose clothing; do not pull off stuck fabric.',
        'Cover with a clean non-stick dressing or cling film; no creams or toothpaste.',
        'Larger than a palm, on face/hands/joints, or blistered → see a doctor.',
      ],
    },
  },
  {
    kind: 'fracture',
    urgency: 'medium',
    firstAidSlug: 'fracture',
    keywords: [
      'kirik',
      'kirildi',
      'cikik',
      'cikti',
      'burkul',
      'sekil bozuk',
      'basamiyor',
      'bilek',
      'fractur',
      'broken',
      'dislocat',
      'sprain',
      'deformed',
      'cannot bear weight',
      'ankle',
    ],
    steps: {
      tr: [
        'Uzvu bulduğunuz pozisyonda sabitleyin; düzeltmeye çalışmayın.',
        'Atel: baton, mat veya karton ile eklemin üstü ve altını kapsayacak şekilde.',
        'Şişlik için soğuk uygulayın (bez üstünden), yükseltin.',
        'Açık kırık (kemik görünüyor) veya uç bölge soğuk/mor → acil: 112.',
        'Ağrı kesici (parasetamol/ibuprofen) alınabilir.',
      ],
      en: [
        'Immobilize the limb in the position found; do not try to straighten.',
        'Splint with a pole, mat or cardboard covering the joint above and below.',
        'Cold pack (over cloth) for swelling; elevate.',
        'Open fracture (bone visible) or cold/blue extremity → emergency call.',
        'Painkillers (paracetamol/ibuprofen) may be taken.',
      ],
    },
  },
  {
    kind: 'sting',
    urgency: 'medium',
    firstAidSlug: 'anaphylaxis',
    keywords: ['akrep', 'orumcek', 'soktu', 'sokma', 'scorpion', 'spider', 'stung', 'sting'],
    steps: {
      tr: [
        'Sokulan bölgeyi sabunlu suyla yıkayın; soğuk uygulayın (bez üstünden).',
        'Uzvu hareketsiz ve kalp seviyesinde tutun.',
        'Ağrı kesici alınabilir; kesme, emme, turnike yok.',
        'Nefes darlığı, yaygın kızarıklık, kas kasılması, çocuk hasta → 112 (antivenom gerekebilir).',
        'Mümkünse hayvanın fotoğrafını çekin.',
      ],
      en: [
        'Wash the site with soap and water; apply cold (over cloth).',
        'Keep the limb still and at heart level.',
        'Painkillers are fine; no cutting, sucking or tourniquet.',
        'Shortness of breath, widespread rash, muscle spasms, or a child → emergency (antivenom may be needed).',
        'Photograph the animal if possible.',
      ],
    },
  },
  {
    kind: 'tick',
    urgency: 'low',
    firstAidSlug: null,
    keywords: ['kene', 'tick', 'lyme'],
    steps: {
      tr: [
        'İnce uçlu cımbızla deriye en yakın yerden tutup düz ve yavaşça çekin.',
        'Ezmeyin, yakmayın, üzerine yağ/alkol dökmeyin.',
        'Bölgeyi sabunla yıkayın; keneyi kapalı kapta saklayın, tarihi not edin.',
        'Sonraki 2 hafta ateş, halsizlik, yaygın kızarıklık (hedef tahtası) → doktor (KKKA riski).',
      ],
      en: [
        'Grip with fine-tipped tweezers close to the skin and pull straight out slowly.',
        'Do not crush, burn, or cover it with oil/alcohol.',
        'Wash the area; keep the tick in a sealed container, note the date.',
        'Fever, fatigue or a bull’s-eye rash within 2 weeks → see a doctor.',
      ],
    },
  },
];

const UNKNOWN_STEPS = {
  tr: [
    'Güvenli bir yere geçin; hastayı sakin ve sıcak tutun.',
    'Belirtileri, başlangıç saatini ve alerji/ilaç bilgisini not edin.',
    'Fotoğraf çekin ve konumunuzu paylaşın; doktor sizi yönlendirecek.',
    'Durum kötüleşirse (nefes darlığı, bilinç bulanıklığı) 112’yi arayın.',
  ],
  en: [
    'Move to a safe spot; keep the patient calm and warm.',
    'Note symptoms, onset time and any allergy/medication.',
    'Take a photo and share your location; the doctor will guide you.',
    'If things worsen (breathing trouble, confusion) call emergency services.',
  ],
};

/** Bu ifadeler herhangi bir durumu "critical"e yükseltir. */
const ESCALATORS = [
  'nefes dar',
  'nefes alam',
  'nefes almiyor',
  'bilinc kayb',
  'bilinci kapali',
  'bilinci yok',
  'bilinc bulan',
  'bayil',
  'dudak morar',
  'dudaklari mor',
  'sokta',
  'soka gir',
  'short of breath',
  'cannot breathe',
  "can't breathe",
  'unconscious',
  'fainted',
  'blue lips',
  'in shock',
];

const URGENCY_RANK: Record<ConsultUrgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function stepsFor(locale: string, steps: { tr: string[]; en: string[] }): string[] {
  return locale.startsWith('tr') ? steps.tr : steps.en;
}

function ruleFor(kind: TriageKind): TriageRule | null {
  return TRIAGE_RULES.find((r) => r.kind === kind) ?? null;
}

/** Tür rehber slug'ından triyaj türü çıkarımı (t.species bağlantısı). */
function kindFromSpecies(species: TriageSpeciesHint | null | undefined): TriageKind | null {
  if (!species) return null;
  if (species.firstAidSlug === 'snakebite') return 'snakebite';
  if (species.firstAidSlug === 'anaphylaxis') return 'sting';
  const name = normalizeComplaint(species.commonName ?? '');
  if (name.includes('kene') || name.includes('tick')) return 'tick';
  if (name.includes('akrep') || name.includes('orumcek') || name.includes('scorpion'))
    return 'sting';
  return null;
}

/**
 * Yerel, anahtar kelime tabanlı ön triyaj. Şikâyet metninden durum türünü,
 * aciliyeti, ilk adımları ve ilgili ilk yardım rehberini üretir.
 * Nefes darlığı / bilinç kaybı gibi ifadeler aciliyeti "critical"e yükseltir.
 */
export function localTriage(
  complaint: string,
  locale = 'tr',
  species?: TriageSpeciesHint | null,
): TriageResult {
  const text = normalizeComplaint(complaint);
  let rule = TRIAGE_RULES.find((r) => r.keywords.some((k) => text.includes(k))) ?? null;
  if (!rule) {
    const kind = kindFromSpecies(species);
    rule = kind ? ruleFor(kind) : null;
  }

  const escalate = ESCALATORS.some((k) => text.includes(k));
  const kind: TriageKind = rule?.kind ?? 'unknown';
  let urgency: ConsultUrgency = rule?.urgency ?? (escalate ? 'critical' : 'medium');
  if (escalate) urgency = 'critical';
  else if (kind === 'sting' && species?.danger && species.danger !== 'harmless')
    urgency = species.danger === 'deadly' ? 'critical' : 'high';
  else if (kind === 'unknown' && text.length < 4) urgency = 'low';

  const steps = rule ? stepsFor(locale, rule.steps) : stepsFor(locale, UNKNOWN_STEPS);
  return {
    kind,
    urgency,
    steps,
    firstAidSlug: rule?.firstAidSlug ?? species?.firstAidSlug ?? null,
    callEmergency: URGENCY_RANK[urgency] >= URGENCY_RANK.high,
  };
}

/** Triyaj türüne uygun doktor uzmanlığı. */
export function specialtyFor(triage: TriageResult | TriageKind): DoctorSpecialty {
  const kind = typeof triage === 'string' ? triage : triage.kind;
  switch (kind) {
    case 'snakebite':
    case 'sting':
    case 'tick':
      return 'toxicology';
    case 'altitude':
      return 'altitude_medicine';
    case 'dive':
      return 'dive_medicine';
    case 'fracture':
      return 'orthopedics';
    case 'burns':
      return 'dermatology';
    case 'hypothermia':
    case 'heat':
      return 'wilderness';
    case 'unknown':
      return 'general';
    default:
      return 'emergency';
  }
}

/** Şikâyet dilini kabaca tahmin eder (demo doktor yanıtları için). */
export function guessLocale(text: string): 'tr' | 'en' {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr';
  const en = /\b(the|and|is|my|i|have|pain|bite|bitten|help|please|can|not|after|leg|arm)\b/i;
  const tr = /\b(ve|bir|var|yok|beni|bana|sonra|bacak|kol|agri|isirdi|dustu|dustum)\b/i;
  if (en.test(text) && !tr.test(normalizeComplaint(text))) return 'en';
  return 'tr';
}

/* ------------------------------------------------------------------ */
/* Doktor eşleştirme                                                    */
/* ------------------------------------------------------------------ */

export interface MatchDoctorsOptions {
  /** Kullanıcı dili (ISO 639-1). Varsayılan 'tr'. */
  language?: string;
  /** Yalnızca çevrimiçi doktorlar (varsayılan true). */
  requireOnline?: boolean;
}

/** Doktor uygunluk puanı (yüksek = daha uygun). */
export function doctorMatchScore(
  doctor: Doctor,
  specialty: DoctorSpecialty | null,
  countryCode: string | null,
  language = 'tr',
): number {
  let score = 0;
  if (specialty && doctor.specialties.includes(specialty)) score += 40;
  else if (doctor.specialties.includes('emergency') || doctor.specialties.includes('wilderness'))
    score += 15;
  if (doctor.languages.includes(language)) score += 20;
  if (countryCode && doctor.countryCodes.includes(countryCode.toUpperCase())) score += 15;
  if (doctor.isVerified) score += 5;
  score += Math.min(10, doctor.rating * 2);
  score += Math.max(0, 10 - doctor.responseMin);
  return score;
}

/**
 * Uygun doktorları sıralar: çevrimiçi + uzmanlık + dil + ülke. Kritik durumda
 * en hızlı yanıt veren öne alınır; diğer durumlarda puan, sonra yanıt süresi.
 */
export function matchDoctors<T extends Doctor>(
  doctors: T[],
  specialty: DoctorSpecialty | null,
  urgency: ConsultUrgency,
  countryCode: string | null,
  options: MatchDoctorsOptions = {},
): T[] {
  const { language = 'tr', requireOnline = true } = options;
  const pool = requireOnline ? doctors.filter((d) => d.isOnline) : doctors.slice();
  const scored = pool.map((d) => ({
    d,
    score: doctorMatchScore(d, specialty, countryCode, language),
  }));
  scored.sort((a, b) => {
    if (a.d.isOnline !== b.d.isOnline) return a.d.isOnline ? -1 : 1;
    if (urgency === 'critical') {
      if (a.d.responseMin !== b.d.responseMin) return a.d.responseMin - b.d.responseMin;
      return b.score - a.score;
    }
    if (a.score !== b.score) return b.score - a.score;
    if (a.d.responseMin !== b.d.responseMin) return a.d.responseMin - b.d.responseMin;
    return b.d.rating - a.d.rating;
  });
  return scored.map((s) => s.d);
}

/** Uzmanlığa / çevrimiçi durumuna göre listeleme sırası (çevrimiçi önce, sonra puan). */
export function sortDoctorsForList<T extends Doctor>(doctors: T[]): T[] {
  return doctors.slice().sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    if (a.rating !== b.rating) return b.rating - a.rating;
    return a.responseMin - b.responseMin;
  });
}

/** "Dr. Ayşe Kurt" biçiminde ad. */
export function doctorDisplayName(doctor: Doctor, displayName: string): string {
  return `${doctor.title} ${displayName}`.trim();
}

/* ------------------------------------------------------------------ */
/* Durum / aciliyet meta                                                */
/* ------------------------------------------------------------------ */

export type PaletteKey = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'textMuted';

export interface StatusMeta {
  labelKey: `telemed.status.${ConsultStatus}`;
  color: PaletteKey;
  icon: 'hourglass' | 'activity' | 'circle-check' | 'circle-x';
  isOpen: boolean;
}

export function consultStatusMeta(status: ConsultStatus): StatusMeta {
  switch (status) {
    case 'requested':
      return {
        labelKey: 'telemed.status.requested',
        color: 'warning',
        icon: 'hourglass',
        isOpen: true,
      };
    case 'active':
      return {
        labelKey: 'telemed.status.active',
        color: 'success',
        icon: 'activity',
        isOpen: true,
      };
    case 'completed':
      return {
        labelKey: 'telemed.status.completed',
        color: 'primary',
        icon: 'circle-check',
        isOpen: false,
      };
    default:
      return {
        labelKey: 'telemed.status.cancelled',
        color: 'textMuted',
        icon: 'circle-x',
        isOpen: false,
      };
  }
}

export interface UrgencyMeta {
  labelKey: `telemed.urgency.${ConsultUrgency}`;
  color: PaletteKey;
  icon: 'info' | 'circle-alert' | 'triangle-alert' | 'siren';
  rank: number;
}

export function urgencyMeta(urgency: ConsultUrgency): UrgencyMeta {
  switch (urgency) {
    case 'critical':
      return { labelKey: 'telemed.urgency.critical', color: 'danger', icon: 'siren', rank: 3 };
    case 'high':
      return { labelKey: 'telemed.urgency.high', color: 'danger', icon: 'triangle-alert', rank: 2 };
    case 'medium':
      return {
        labelKey: 'telemed.urgency.medium',
        color: 'warning',
        icon: 'circle-alert',
        rank: 1,
      };
    default:
      return { labelKey: 'telemed.urgency.low', color: 'info', icon: 'info', rank: 0 };
  }
}

/** Danışma hâlâ açık mı (bekliyor / aktif)? */
export function isConsultOpen(status: ConsultStatus): boolean {
  return status === 'requested' || status === 'active';
}

/** Açık danışmalar arasından en yenisi (banner için). */
export function activeConsultation<T extends Pick<Consultation, 'status' | 'createdAt'>>(
  list: T[],
): T | null {
  return (
    list
      .filter((c) => isConsultOpen(c.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Mesajlaşma kuralları                                                 */
/* ------------------------------------------------------------------ */

export type CanSendInput = Pick<Consultation, 'status' | 'patientId'> & {
  doctor?: { userId: ID } | null;
  /** Doktor kullanıcı kimliği (doctor nesnesi yoksa) */
  doctorUserId?: ID | null;
};

/** Yalnızca taraflar ve yalnızca danışma açıkken mesaj gönderebilir. */
export function canSend(consultation: CanSendInput, meId: ID): boolean {
  if (!isConsultOpen(consultation.status)) return false;
  if (consultation.patientId === meId) return true;
  const doctorUserId = consultation.doctor?.userId ?? consultation.doctorUserId ?? null;
  return doctorUserId !== null && doctorUserId === meId;
}

/** Kabulden bitişe (ya da şimdiye) kadar geçen dakika. */
export function consultDurationMin(
  consultation: Pick<Consultation, 'acceptedAt' | 'endedAt' | 'createdAt'>,
  now: Date = new Date(),
): number {
  const start = consultation.acceptedAt ?? consultation.createdAt;
  const end = consultation.endedAt ? new Date(consultation.endedAt) : now;
  const diff = end.getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

/** Doktor talimatlarını madde madde özetler; talimat yoksa doktor mesajlarının son üçü. */
export function buildConsultSummary(
  messages: Pick<ConsultMessage, 'content' | 'isInstruction' | 'senderId'>[],
  locale = 'tr',
  patientId?: ID,
): string {
  const tr = locale.startsWith('tr');
  const instructions = messages.filter((m) => m.isInstruction && m.content.trim());
  let lines = instructions.map((m) => m.content.trim());
  if (lines.length === 0 && patientId) {
    lines = messages
      .filter((m) => m.senderId !== patientId && m.content.trim())
      .slice(-3)
      .map((m) => m.content.trim());
  }
  if (lines.length === 0) return tr ? 'Talimat kaydedilmedi.' : 'No instructions recorded.';
  const head = tr ? 'Doktor talimatları:' : 'Doctor instructions:';
  return [head, ...lines.map((l) => `• ${l}`)].join('\n');
}

/* ------------------------------------------------------------------ */
/* Demo doktor yanıtları (mock simülasyonu)                             */
/* ------------------------------------------------------------------ */

/** İlk doktor mesajı: "Merhaba, ben Dr. … Şikâyetinizi okudum. Şu an nefes darlığı var mı?" */
export function doctorGreeting(doctorName: string, locale = 'tr'): string {
  return locale.startsWith('tr')
    ? `Merhaba, ben ${doctorName}. Şikâyetinizi okudum. Şu an nefes darlığı var mı?`
    : `Hello, I'm ${doctorName}. I've read your complaint. Are you short of breath right now?`;
}

interface ReplyRule {
  keywords: string[];
  tr: string;
  en: string;
}

const REPLY_RULES: ReplyRule[] = [
  {
    keywords: [
      'nefes dar',
      'nefes alam',
      'zor nefes',
      'short of breath',
      'cannot breathe',
      'hard to breathe',
    ],
    tr: 'Nefes darlığı ciddi bir uyarıdır. Hemen 112’yi arayın ve hastayı oturur pozisyona alın. Varsa adrenalin oto-enjektörü uygulayın; ben hatta kalıyorum.',
    en: 'Shortness of breath is a serious warning sign. Call emergency services now and keep the patient sitting up. Use an adrenaline auto-injector if available; I am staying on the line.',
  },
  {
    keywords: ['sis', 'sisti', 'sisiyor', 'morar', 'swell', 'swollen', 'bruis'],
    tr: 'Şişlik ilerliyor. Uzvu kalp seviyesinin altında, hareketsiz tutun; yüzük ve saatleri çıkarın. Turnike, kesme veya emme uygulamayın. En yakın hastaneye doğru yola çıkın.',
    en: 'Swelling is progressing. Keep the limb still and below heart level; remove rings and watches. No tourniquet, cutting or sucking. Start moving towards the nearest hospital.',
  },
  {
    keywords: ['kanama', 'kaniyor', 'bleed'],
    tr: 'Temiz bir bezle doğrudan bası uygulayın ve 10 dakika boyunca bırakmayın. Bez ıslanırsa üstüne yenisini ekleyin. Kanama durmuyorsa 112’yi arayın.',
    en: 'Apply direct pressure with a clean cloth and hold for 10 minutes without lifting. If soaked, add more on top. If it does not stop, call emergency services.',
  },
  {
    keywords: ['agri', 'aci', 'pain', 'hurt'],
    tr: 'Ağrı için parasetamol alabilirsiniz (aspirin ve ibuprofen kanamayı artırabilir, almayın). Bölgeyi soğuk kompresle değil, oda sıcaklığında tutun.',
    en: 'You may take paracetamol for pain (avoid aspirin and ibuprofen; they can worsen bleeding). Keep the area at room temperature, no ice.',
  },
  {
    keywords: ['foto', 'resim', 'gorsel', 'photo', 'picture', 'image'],
    tr: 'Fotoğrafı aldım, teşekkürler. Kızarıklık sınırı belirgin; 15 dakika sonra aynı açıdan bir daha çekin. Bu arada hastaya su içirin, yiyecek vermeyin.',
    en: 'Got the photo, thank you. The redness border is visible; take another from the same angle in 15 minutes. Meanwhile give water, no food.',
  },
  {
    keywords: ['hastane', 'ulas', 'uzak', 'saat', 'km', 'hospital', 'far', 'hour', 'reach'],
    tr: 'Mesafeyi not ettim. Hastayı yürütmeyin; taşıyarak götürün. Yolda 30 dakikada bir nabız ve nefesi kontrol edin. Hastaneye vardığınızda bu sohbeti acil doktoruna gösterin.',
    en: 'Noted the distance. Do not let the patient walk; carry them. Check pulse and breathing every 30 minutes on the way. Show this chat to the ER doctor on arrival.',
  },
  {
    keywords: ['ilac', 'hap', 'alerji', 'medic', 'pill', 'allerg'],
    tr: 'Bilinen alerji ve düzenli ilaçları not edin; hastaneye ileteceğiz. Antihistaminik yalnızca hafif kaşıntı için; nefes darlığında adrenalin şarttır.',
    en: 'Note known allergies and regular medication; we will pass them to the hospital. Antihistamines only for mild itching; adrenaline is essential for breathing trouble.',
  },
  {
    keywords: ['tesekkur', 'sagol', 'thank', 'thanks'],
    tr: 'Rica ederim. Durumu 15 dakikada bir bana yazın; kötüleşme olursa beklemeden 112’yi arayın. Geçmiş olsun.',
    en: 'You are welcome. Update me every 15 minutes; if anything worsens, call emergency services without waiting. Get well soon.',
  },
  {
    keywords: [
      'yok',
      'hayir',
      'iyiyim',
      'normal',
      'rahat',
      'no,',
      'no.',
      'not really',
      'fine',
      'okay',
    ],
    tr: 'Güzel, nefes normal olduğuna göre panik yapmayın. Isırık/yara bölgesini hareketsiz tutun ve ısırık saatini not edin. Şişlik sınırını kalemle işaretleyip 15 dakikada bir fotoğraf gönderin.',
    en: 'Good — breathing is normal, so stay calm. Keep the affected area still and note the time. Mark the edge of the swelling with a pen and send me a photo every 15 minutes.',
  },
  {
    keywords: ['evet', 'var', 'yes', 'i do', 'a bit', 'biraz'],
    tr: 'Anladım. Hastayı yarı oturur pozisyonda tutun, dar giysileri gevşetin. Dudakta morarma, ses kısıklığı veya yutma güçlüğü olursa hemen 112’yi arayın.',
    en: 'Understood. Keep the patient half-sitting and loosen tight clothing. If lips turn blue, voice becomes hoarse or swallowing is hard, call emergency services immediately.',
  },
];

const REPLY_FALLBACK = {
  tr: 'Anladım. Hastayı sakin ve sıcak tutun, hareket ettirmeyin. Belirtiler değişirse (nefes, bilinç, şişlik) hemen yazın; kötüleşme olursa 112’yi arayın.',
  en: 'Understood. Keep the patient calm, warm and still. Write to me if anything changes (breathing, consciousness, swelling); if it worsens, call emergency services.',
};

/**
 * Hasta mesajına kural tabanlı doktor yanıtı (demo). 2–3 cümlelik talimat.
 * Gerçek uygulamada bu, doktorun kendi yanıtıdır.
 */
export function doctorReplyFor(patientText: string, locale = 'tr'): string {
  const text = normalizeComplaint(patientText);
  const tr = locale.startsWith('tr');
  const rule = REPLY_RULES.find((r) => r.keywords.some((k) => text.includes(k)));
  if (rule) return tr ? rule.tr : rule.en;
  return tr ? REPLY_FALLBACK.tr : REPLY_FALLBACK.en;
}
