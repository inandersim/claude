import type { AdventureType, AiIntent, HazardSeverity, PlaceKind } from './enums';
import { AI_INTENTS } from './enums';
import { emergencyNumber, nearestCenters } from './emergency';
import { DEFAULT_LOCATION, distanceKm, formatDistance } from './geo';
import { localizedPlaceName } from './library';
import type {
  AiAction,
  AiContext,
  Business,
  Crag,
  EmergencyCenter,
  GeoPoint,
  HazardZone,
  LibraryPlace,
  TripPlan,
  TripPlanDay,
} from './types';

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

/** Çevrimdışı asistanın cevap üretirken kullandığı yerel veri. */
export interface LocalKnowledge {
  places: LibraryPlace[];
  hazards: HazardZone[];
  emergencyCenters: EmergencyCenter[];
  /** Mevcut ilk yardım rehberi slug'ları (`/first-aid/<slug>`) */
  firstAidSlugs: string[];
  crags?: Crag[];
  businesses?: Business[];
}

/** Yerel (mock) cevap: düz metin + niyet + uygulama içi bağlantılar. */
export interface LocalAnswer {
  content: string;
  intent: AiIntent;
  actions: AiAction[];
}

export type TripLevel = 'easy' | 'moderate' | 'hard';

/** Serbest metinden ayrıştırılmış gezi isteği. */
export interface TripRequest {
  adventureType: AdventureType;
  days: number;
  level: TripLevel;
  /** İstemde adı geçen kütüphane yeri (varsa) */
  place: LibraryPlace | null;
}

/* ------------------------------------------------------------------ */
/* Metin yardımcıları                                                   */
/* ------------------------------------------------------------------ */

const FOLD: Record<string, string> = {
  ı: 'i',
  ğ: 'g',
  ş: 's',
  ç: 'c',
  ö: 'o',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  é: 'e',
  è: 'e',
  á: 'a',
  à: 'a',
  ñ: 'n',
};

/** Türkçe karakterleri ASCII'ye indirger; küçük harfe çevirir (anahtar kelime eşleme için). */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[ığşçöüâîûéèáàñ]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/[’'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

function isTr(locale: string): boolean {
  return locale.toLowerCase().startsWith('tr');
}

/* ------------------------------------------------------------------ */
/* Niyet sınıflandırma                                                  */
/* ------------------------------------------------------------------ */

/** Anahtar kelimeler ASCII'ye indirgenmiş ve küçük harfli tutulur (foldText ile eşlenir). */
const INTENT_KEYWORDS: Record<Exclude<AiIntent, 'general'>, string[]> = {
  first_aid: [
    'ilk yardim',
    'kanama',
    'kaniyor',
    'kirik',
    'kirildi',
    'burkul',
    'cikik',
    'hipotermi',
    'donma',
    'sicak carpmasi',
    'gunes carpmasi',
    'irtifa hastaligi',
    'dag hastaligi',
    'yilan',
    'isirdi',
    'isirik',
    'akrep',
    'alerji',
    'anafilaksi',
    'bogul',
    'yanik',
    'yandi',
    'yildirim carp',
    'cig altinda',
    'kalbi dur',
    'nefes almiyor',
    'bilinci kapali',
    'bayildi',
    'cpr',
    'kalp masaji',
    'first aid',
    'bleeding',
    'fracture',
    'broken leg',
    'broken arm',
    'sprain',
    'hypothermia',
    'frostbite',
    'heat stroke',
    'heatstroke',
    'altitude sickness',
    'snake',
    'bite',
    'allergic',
    'anaphylaxis',
    'drowning',
    'burned',
    'burns',
    'struck by lightning',
    'buried in avalanche',
    'unconscious',
    'not breathing',
  ],
  safety_brief: [
    'guvenli mi',
    'guvenlik',
    'tehlike',
    'risk',
    'uyari',
    'cig riski',
    'kaya dusmesi',
    'kapali mi',
    'brifing',
    'dikkat etmeliyim',
    'nelere dikkat',
    'safety',
    'hazard',
    'danger',
    'warning',
    'avalanche risk',
    'rockfall',
    'closure',
    'is it safe',
    'what should i watch',
  ],
  plan_trip: [
    'planla',
    'plan yap',
    'plan hazirla',
    'gezi plani',
    'rota plani',
    'rota cikar',
    'program yap',
    'gunluk program',
    'hafta sonu',
    'tur plani',
    'itinerary',
    'plan a',
    'plan my',
    'trip plan',
    'route plan',
    'weekend',
    'schedule',
  ],
  packing_list: [
    'paketle',
    'cantama',
    'cantaya',
    'ne almaliyim',
    'ne goturmeliyim',
    'ne gotureyim',
    'yanima ne',
    'ekipman listesi',
    'malzeme listesi',
    'liste hazirla',
    'packing',
    'pack list',
    'what to bring',
    'what should i bring',
    'what should i pack',
    'checklist',
  ],
  weather: [
    'hava durumu',
    'hava nasil',
    'yagmur',
    'kar yagacak',
    'ruzgar',
    'firtina',
    'sicaklik',
    'derece',
    'tahmin',
    'weather',
    'forecast',
    'rain',
    'wind',
    'storm',
    'temperature',
    'snowing',
  ],
  gear_advice: [
    'ekipman',
    'malzeme',
    'ayakkabi',
    ' bot',
    'botu',
    'mont',
    'uyku tulumu',
    'cadir',
    ' ip ',
    'kask',
    'hangi marka',
    'almaliyim',
    'kiralik',
    'kiralayabilir',
    'gear',
    'equipment',
    'boots',
    'jacket',
    'sleeping bag',
    'tent',
    'rope',
    'helmet',
    'rental',
    'which brand',
    'should i buy',
  ],
  find_place: [
    'nerede',
    'nereye',
    'nereden',
    'yakin',
    'oner',
    'tavsiye',
    'en iyi',
    'en guzel',
    'kamp alani',
    'kamp yeri',
    'tirmanis alani',
    'dalis noktasi',
    'kayak merkezi',
    'zirve',
    'rota var mi',
    'where',
    'nearby',
    'near me',
    'recommend',
    'suggest',
    'best',
    'spot',
    'campsite',
    'crag',
    'dive site',
    'ski resort',
    'peak',
    'summit',
  ],
};

/** Öncelik sırası: eşit puanlarda önce gelen kazanır. */
const INTENT_PRIORITY: AiIntent[] = [
  'first_aid',
  'safety_brief',
  'packing_list',
  'plan_trip',
  'weather',
  'gear_advice',
  'find_place',
  'general',
];

// "3 gün", "3 günlük", "3-day", "3 days", "2 nights" — araya tire de girebilir.
const DAYS_PATTERN = /(\d{1,2})\s*[-–—]?\s*(gunluk|gun|gece|gecelik|days?|nights?)\b/;

/** Anahtar kelime tabanlı niyet sınıflandırması (TR + EN). */
export function classifyIntent(text: string, _locale: string = 'tr'): AiIntent {
  const folded = ` ${foldText(text)} `;
  if (!folded.trim()) return 'general';
  const scores = new Map<AiIntent, number>();
  for (const intent of AI_INTENTS) {
    if (intent === 'general') continue;
    let score = 0;
    for (const kw of INTENT_KEYWORDS[intent]) if (folded.includes(kw)) score += 1;
    if (intent === 'plan_trip' && DAYS_PATTERN.test(folded)) score += 2;
    scores.set(intent, score);
  }
  let best: AiIntent = 'general';
  let bestScore = 0;
  for (const intent of INTENT_PRIORITY) {
    const s = scores.get(intent) ?? 0;
    if (s > bestScore) {
      best = intent;
      bestScore = s;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Yerelleştirme (domain katmanı React'e bağımlı değildir)             */
/* ------------------------------------------------------------------ */

const ADVENTURE_LABEL: Record<'tr' | 'en', Record<AdventureType, string>> = {
  tr: {
    hiking: 'yürüyüş',
    climbing: 'tırmanış',
    diving: 'dalış',
    skiing: 'kayak',
    cycling: 'bisiklet',
    paragliding: 'yamaç paraşütü',
    rafting: 'rafting',
    canoe: 'kano',
  },
  en: {
    hiking: 'hiking',
    climbing: 'climbing',
    diving: 'diving',
    skiing: 'skiing',
    cycling: 'cycling',
    paragliding: 'paragliding',
    rafting: 'rafting',
    canoe: 'canoe',
  },
};

const KIND_LABEL: Record<'tr' | 'en', Record<PlaceKind, string>> = {
  tr: {
    campsite: 'kamp alanı',
    climbing: 'tırmanış alanı',
    diving: 'dalış noktası',
    dive_centre: 'dalış merkezi',
    hiking_route: 'yürüyüş rotası',
    rafting: 'rafting parkuru',
    canoe: 'kano rotası',
    paragliding: 'kalkış alanı',
    ski: 'kayak merkezi',
    peak: 'zirve',
    cave: 'mağara',
    viewpoint: 'seyir noktası',
    shelter: 'sığınak / kamp yeri',
  },
  en: {
    campsite: 'campsite',
    climbing: 'crag',
    diving: 'dive site',
    dive_centre: 'dive centre',
    hiking_route: 'hiking route',
    rafting: 'rafting run',
    canoe: 'paddling route',
    paragliding: 'launch site',
    ski: 'ski resort',
    peak: 'peak',
    cave: 'cave',
    viewpoint: 'viewpoint',
    shelter: 'hut / camp',
  },
};

const SEVERITY_LABEL: Record<'tr' | 'en', Record<HazardSeverity, string>> = {
  tr: { low: 'düşük', medium: 'orta', high: 'yüksek', critical: 'kritik' },
  en: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
};

/* ------------------------------------------------------------------ */
/* Gezi isteği ayrıştırma                                               */
/* ------------------------------------------------------------------ */

const TYPE_KEYWORDS: [AdventureType, string[]][] = [
  ['canoe', ['deniz kayagi', 'kano', 'canoe', 'kayaking', 'sea kayak', 'paddle']],
  ['rafting', ['rafting', 'raft', 'nehir']],
  ['paragliding', ['yamac parasutu', 'parasut', 'paraglid', 'tandem ucus']],
  ['diving', ['dalis', 'dalmak', 'scuba', 'dive', 'diving', 'tuplu']],
  ['climbing', ['tirman', 'kaya', 'boulder', 'climb', 'crag', 'spor tirmanis']],
  ['cycling', ['bisiklet', 'gravel', 'mtb', 'cycl', 'bike', 'pedal']],
  ['skiing', ['kayak', 'tur kayagi', 'snowboard', 'ski', 'freeride', 'pist']],
  ['hiking', ['yuruyus', 'trek', 'hike', 'hiking', 'zirve', 'dag', 'patika', 'trail', 'kamp']],
];

/** Yer adının anlamlı parçaları (≥ 4 harf) istemde geçiyor mu? Puan döner. */
function placeMatchScore(promptTokens: string[], place: LibraryPlace): number {
  const nameTokens = new Set<string>();
  for (const name of [place.name, ...Object.values(place.names)]) {
    if (!name) continue;
    for (const tk of tokens(name)) if (tk.length >= 4) nameTokens.add(tk);
  }
  let score = 0;
  for (const nt of nameTokens) {
    if (
      promptTokens.some(
        (pt) => pt === nt || (pt.length >= 4 && (pt.startsWith(nt) || nt.startsWith(pt))),
      )
    )
      score += 1;
  }
  return score;
}

/** İstemde adı geçen yerleri puanına göre sıralı döner (eşleşmeyenler elenir). */
export function matchPlaces(
  prompt: string,
  places: LibraryPlace[],
  origin?: GeoPoint | null,
): LibraryPlace[] {
  const pt = tokens(prompt);
  return places
    .map((p) => ({ p, s: placeMatchScore(pt, p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      if (!origin) return 0;
      return placeDistance(origin, a.p) - placeDistance(origin, b.p);
    })
    .map((x) => x.p);
}

function placeDistance(origin: GeoPoint, place: LibraryPlace): number {
  return distanceKm(origin, { latitude: place.lat, longitude: place.lng });
}

/** Serbest metinden tür / gün / seviye / yer ayrıştırır. */
export function parseTripRequest(
  prompt: string,
  ctx: AiContext,
  places: LibraryPlace[],
): TripRequest {
  const folded = ` ${foldText(prompt)} `;

  let days = 2;
  const m = DAYS_PATTERN.exec(folded);
  if (m?.[1]) {
    const n = Number.parseInt(m[1], 10);
    const unit = m[2] ?? '';
    days = /gece|night/.test(unit) ? n + 1 : n;
  } else if (/hafta sonu|weekend/.test(folded)) days = 2;
  else if (/bir hafta|1 hafta|one week|a week/.test(folded)) days = 7;
  else if (/gunubirlik|day trip|tek gun|one day/.test(folded)) days = 1;
  days = Math.min(14, Math.max(1, days));

  let level: TripLevel = 'moderate';
  if (
    /kolay|baslangic|yeni baslayan|rahat|aile|cocuk|easy|beginner|relaxed|family|gentle/.test(
      folded,
    )
  )
    level = 'easy';
  else if (
    /zor|ileri seviye|teknik|hizli|uzun etap|hard|advanced|technical|challenging|expert/.test(
      folded,
    )
  )
    level = 'hard';

  const matched = matchPlaces(prompt, places, ctx.coords);
  const place = matched[0] ?? null;

  let adventureType: AdventureType | null = null;
  for (const [type, kws] of TYPE_KEYWORDS) {
    if (kws.some((k) => folded.includes(k))) {
      adventureType = type;
      break;
    }
  }
  if (!adventureType && place) adventureType = place.adventureTypes[0] ?? null;
  if (!adventureType) adventureType = ctx.adventureTypes[0] ?? 'hiking';

  return { adventureType, days, level, place };
}

/* ------------------------------------------------------------------ */
/* Gezi planı üretimi                                                   */
/* ------------------------------------------------------------------ */

/** Tür ve seviyeye göre günlük mesafe (km) ve tırmanış (m) tabanı. */
const DAY_BASE: Record<AdventureType, Record<TripLevel, [number, number]>> = {
  hiking: { easy: [8, 350], moderate: [14, 750], hard: [21, 1250] },
  climbing: { easy: [3, 220], moderate: [4, 380], hard: [6, 600] },
  diving: { easy: [2, 25], moderate: [3, 40], hard: [4, 60] },
  skiing: { easy: [8, 450], moderate: [12, 800], hard: [18, 1300] },
  cycling: { easy: [35, 450], moderate: [60, 900], hard: [95, 1600] },
  paragliding: { easy: [4, 250], moderate: [6, 450], hard: [9, 700] },
  rafting: { easy: [12, 40], moderate: [18, 60], hard: [26, 90] },
  canoe: { easy: [10, 30], moderate: [16, 45], hard: [24, 70] },
};

function season(now: Date): 'winter' | 'spring' | 'summer' | 'autumn' {
  const m = now.getMonth() + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

function pickCluster(
  primary: LibraryPlace,
  pool: LibraryPlace[],
  type: AdventureType,
): LibraryPlace[] {
  const origin = { latitude: primary.lat, longitude: primary.lng };
  const near = pool
    .filter((p) => p.id !== primary.id && placeDistance(origin, p) <= 80)
    .sort((a, b) => {
      const ta = a.adventureTypes.includes(type) ? 0 : 1;
      const tb = b.adventureTypes.includes(type) ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return placeDistance(origin, a) - placeDistance(origin, b);
    });
  return [primary, ...near];
}

function dayTitle(
  tr: boolean,
  day: number,
  days: number,
  placeName: string,
  type: AdventureType,
): string {
  const phase =
    days === 1
      ? tr
        ? 'günübirlik tur'
        : 'day trip'
      : day === 1
        ? tr
          ? 'yaklaşım ve kamp'
          : 'approach and camp'
        : day === days
          ? tr
            ? type === 'hiking' || type === 'climbing' || type === 'skiing'
              ? 'zirve denemesi ve dönüş'
              : 'son etap ve dönüş'
            : type === 'hiking' || type === 'climbing' || type === 'skiing'
              ? 'summit push and return'
              : 'final leg and return'
          : tr
            ? 'ana etap'
            : 'main stage';
  return `${placeName} — ${phase}`;
}

function dayNotes(
  tr: boolean,
  day: number,
  days: number,
  place: LibraryPlace,
  type: AdventureType,
  level: TripLevel,
): string {
  const parts: string[] = [];
  const desc = place.description?.trim();
  if (desc) parts.push(desc.length > 110 ? `${desc.slice(0, 107)}…` : desc);
  if (place.elevationM !== null && place.elevationM >= 2500 && type !== 'diving')
    parts.push(
      tr
        ? `Yükseklik ${place.elevationM} m: yavaş çık, bol su iç, baş ağrısında yükselme.`
        : `Altitude ${place.elevationM} m: ascend slowly, hydrate, do not climb higher with a headache.`,
    );
  if (day === 1 && days > 1)
    parts.push(
      tr
        ? 'Erken yola çık; kampı hava kararmadan kur ve suyu doldur.'
        : 'Start early; pitch camp before dark and top up water.',
    );
  if (day === days && days > 1)
    parts.push(
      tr
        ? 'Dönüş için ışığı ve dizleri koru; iniş genellikle çıkıştan daha yorucudur.'
        : 'Save daylight and your knees for the descent; going down is often harder than up.',
    );
  if (level === 'hard')
    parts.push(
      tr
        ? 'Uzun etap: 05:30 kalkış, öğlen sonrası fırtına riskine göre geri dönüş saati belirle.'
        : 'Long stage: 05:30 start, set a turnaround time for afternoon storm risk.',
    );
  if (type === 'diving')
    parts.push(
      tr
        ? 'İki dalış, aralarında en az 1 saat yüzey molası; dalış sonrası 18 saat uçma.'
        : 'Two dives with at least a 1 h surface interval; no flying for 18 h after diving.',
    );
  if (parts.length === 0)
    parts.push(
      tr
        ? 'Rotayı çevrimdışı haritaya indir ve planı bir yakınınla paylaş.'
        : 'Download the route offline and share the plan with someone.',
    );
  return parts.join(' ');
}

function packingFor(
  tr: boolean,
  type: AdventureType,
  days: number,
  s: ReturnType<typeof season>,
  high: boolean,
): string[] {
  const list: string[] = tr
    ? [
        'Su (en az 2 L) ve filtre/tablet',
        'Yüksek enerjili atıştırmalık',
        'Kat kat giyim (baz + ara + kabuk)',
        'Kafa lambası + yedek pil',
        'İlk yardım kiti',
        'Telefon + powerbank, çevrimdışı harita',
        'Güneş kremi, şapka, güneş gözlüğü',
      ]
    : [
        'Water (2 L min) + filter/tablets',
        'High-energy snacks',
        'Layers (base + mid + shell)',
        'Headlamp + spare batteries',
        'First aid kit',
        'Phone + power bank, offline map',
        'Sunscreen, hat, sunglasses',
      ];
  const byType: Record<AdventureType, string[]> = tr
    ? {
        hiking: ['Bilek destekli bot', 'Baton', 'Yağmurluk'],
        climbing: [
          'Kask',
          'Emniyet kemeri + emniyet aleti',
          'Tırmanış ayakkabısı, ip, ekspres seti',
        ],
        diving: [
          'Dalış sertifikası ve logbook',
          'Maske, palet, dalgıç bilgisayarı',
          'Yüzey işaret şamandırası (SMB)',
        ],
        skiing: ['Çığ üçlüsü: transceiver, kürek, sonda', 'Foka + tur bağlaması', 'Kar gözlüğü'],
        cycling: ['Kask', 'Yedek iç lastik + mini pompa', 'Zincir yağı, multitool'],
        paragliding: ['Kanat + yedek paraşüt', 'Kask ve telsiz', 'Varyometre'],
        rafting: ['Can yeleği + kask', 'Su geçirmez çanta', 'Neopren bot'],
        canoe: ['Can yeleği', 'Su geçirmez çanta', 'Yedek kürek'],
      }
    : {
        hiking: ['Ankle-support boots', 'Trekking poles', 'Rain shell'],
        climbing: ['Helmet', 'Harness + belay device', 'Climbing shoes, rope, quickdraws'],
        diving: [
          'Certification card and logbook',
          'Mask, fins, dive computer',
          'Surface marker buoy (SMB)',
        ],
        skiing: [
          'Avalanche kit: transceiver, shovel, probe',
          'Skins + touring bindings',
          'Goggles',
        ],
        cycling: ['Helmet', 'Spare tube + mini pump', 'Chain lube, multitool'],
        paragliding: ['Wing + reserve parachute', 'Helmet and radio', 'Variometer'],
        rafting: ['PFD + helmet', 'Dry bag', 'Neoprene boots'],
        canoe: ['PFD', 'Dry bag', 'Spare paddle'],
      };
  list.push(...byType[type]);
  if (days > 1 && type !== 'diving')
    list.push(
      ...(tr
        ? [
            'Çadır / tarp',
            'Uyku tulumu (mevsime uygun) + mat',
            'Ocak, gaz, çakmak',
            `${days} günlük yemek`,
          ]
        : [
            'Tent / tarp',
            'Season-rated sleeping bag + pad',
            'Stove, gas, lighter',
            `${days} days of food`,
          ]),
    );
  if (s === 'winter' || high)
    list.push(
      ...(tr
        ? ['Kalın eldiven + bere', 'Krampon / kar zinciri', 'Termos']
        : ['Insulated gloves + beanie', 'Crampons / microspikes', 'Thermos']),
    );
  if (s === 'summer') list.push(tr ? 'Elektrolit + ekstra su' : 'Electrolytes + extra water');
  return list;
}

function safetyFor(
  tr: boolean,
  type: AdventureType,
  s: ReturnType<typeof season>,
  high: boolean,
  countryCode: string | null,
): string[] {
  const num = emergencyNumber(countryCode).general;
  const list: string[] = tr
    ? [
        `Acil numara: ${num}. Planı ve dönüş saatini bir yakınınla paylaş.`,
        'Yola çıkmadan tehlike bölgelerini ve hava tahminini kontrol et.',
      ]
    : [
        `Emergency number: ${num}. Share your plan and return time with someone.`,
        'Check hazard zones and the forecast before you leave.',
      ];
  const byType: Record<AdventureType, string> = tr
    ? {
        hiking: 'Patikadan ayrılma; sis veya karanlıkta ilerleme, geri dön.',
        climbing: 'Düğümleri ve emniyeti karşılıklı kontrol et; kask takmadan yaklaşım bile yapma.',
        diving: 'Asla yalnız dalma; maksimum derinlik ve hava yönetimini eşinle önceden anlaş.',
        skiing: 'Çığ bültenine bak; 30°+ yamaçlarda tek tek geç, transceiver kontrolü yap.',
        cycling: 'Trafikte görünür ol; inişlerde fren ısınmasına dikkat et.',
        paragliding: 'Kalkış rüzgârı 25 km/s üstündeyse uçma; termik saatlerini bilmeden çıkma.',
        rafting: 'Rehbersiz 3+ derece parkura girme; su seviyesi yağmurla hızla yükselir.',
        canoe: 'Kıyıya paralel kal; rüzgâr ve akıntı tahminini kontrol et.',
      }
    : {
        hiking: 'Stay on the trail; if fog or darkness closes in, turn back.',
        climbing: 'Partner-check knots and belay; wear a helmet even on the approach.',
        diving: 'Never dive alone; agree on max depth and gas plan with your buddy.',
        skiing: 'Read the avalanche bulletin; cross 30°+ slopes one at a time, check transceivers.',
        cycling: 'Be visible in traffic; watch brake heat on long descents.',
        paragliding: 'Do not launch above 25 km/h wind; know the thermal hours.',
        rafting: 'No grade 3+ runs without a guide; water rises fast after rain.',
        canoe: 'Stay parallel to shore; check wind and current forecasts.',
      };
  list.push(byType[type]);
  if (high)
    list.push(
      tr
        ? 'Yüksek irtifa: günde 300–500 m üstünde kamp yükseltme; baş ağrısı, bulantı = in.'
        : 'High altitude: gain no more than 300–500 m of sleeping height a day; headache or nausea = descend.',
    );
  if (s === 'winter')
    list.push(
      tr
        ? 'Kısa gün ışığı: 15:30 sonrası dönüşü planla; hipotermi belirtilerini bil.'
        : 'Short daylight: plan to be back by 15:30; know the hypothermia signs.',
    );
  if (s === 'summer')
    list.push(
      tr
        ? 'Sıcak çarpması riski: 11:00–16:00 arası gölgede kal, saatte 500 ml iç.'
        : 'Heat stroke risk: stay in shade 11:00–16:00, drink 500 ml an hour.',
    );
  return list;
}

/**
 * Kütüphane yerlerinden gerçekçi günlük plan üretir.
 * `now` mevsim (paketleme/güvenlik) için kullanılır; render içinde Date.now() çağrılmaz.
 */
export function buildTripPlan(
  prompt: string,
  ctx: AiContext,
  places: LibraryPlace[],
  now: Date,
): TripPlan {
  const tr = isTr(ctx.locale);
  const req = parseTripRequest(prompt, ctx, places);
  const origin = ctx.coords ?? DEFAULT_LOCATION;

  const typed = places.filter((p) => p.adventureTypes.includes(req.adventureType));
  const pool = typed.length > 0 ? typed : places;
  const primary =
    req.place ??
    [...pool].sort((a, b) => placeDistance(origin, a) - placeDistance(origin, b))[0] ??
    null;

  const cluster = primary ? pickCluster(primary, places, req.adventureType) : [];
  const [baseKm, baseAscent] = DAY_BASE[req.adventureType][req.level];
  const s = season(now);
  const high = cluster.some((p) => (p.elevationM ?? 0) >= 2500) && req.adventureType !== 'diving';

  const days: TripPlanDay[] = [];
  for (let day = 1; day <= req.days; day += 1) {
    const anchor = cluster[(day - 1) % Math.max(1, cluster.length)] ?? null;
    const factor =
      req.days === 1 ? 1 : day === 1 ? 0.8 : day === req.days ? 0.9 : 1 + (day % 2) * 0.1;
    const placeName = anchor ? localizedPlaceName(anchor, ctx.locale) : tr ? 'Bölge' : 'Area';
    days.push({
      day,
      title: dayTitle(tr, day, req.days, placeName, req.adventureType),
      distanceKm: Math.max(1, Math.round(baseKm * factor)),
      ascentM: Math.max(10, Math.round((baseAscent * factor) / 10) * 10),
      notes: anchor
        ? dayNotes(tr, day, req.days, anchor, req.adventureType, req.level)
        : tr
          ? 'Kütüphanede uygun yer bulunamadı; rotayı harita planlayıcıda çiz.'
          : 'No matching place in the library; draw the route in the map planner.',
    });
  }

  const typeLabel = ADVENTURE_LABEL[tr ? 'tr' : 'en'][req.adventureType];
  const primaryName = primary
    ? localizedPlaceName(primary, ctx.locale)
    : tr
      ? 'Yakın çevre'
      : 'Nearby';
  const title = tr
    ? `${primaryName} — ${req.days} günlük ${typeLabel} planı`
    : `${req.days}-day ${typeLabel} plan — ${primaryName}`;

  return {
    title,
    adventureType: req.adventureType,
    days,
    packing: packingFor(tr, req.adventureType, req.days, s, high),
    safety: safetyFor(tr, req.adventureType, s, high, primary?.countryCode ?? null),
  };
}

/* ------------------------------------------------------------------ */
/* Yerel cevap                                                          */
/* ------------------------------------------------------------------ */

const FIRST_AID_KEYWORDS: [string, string[]][] = [
  ['bleeding', ['kanama', 'kaniyor', 'kesik', 'bleed', 'cut', 'wound']],
  ['fracture', ['kirik', 'kirildi', 'burkul', 'cikik', 'fracture', 'broken', 'sprain']],
  [
    'hypothermia',
    ['hipotermi', 'donma', 'usudu', 'titriyor', 'hypothermia', 'frostbite', 'freezing'],
  ],
  ['heat', ['sicak carpmasi', 'gunes carpmasi', 'heat stroke', 'heatstroke', 'overheat']],
  ['altitude', ['irtifa', 'dag hastaligi', 'altitude', 'ams']],
  ['snakebite', ['yilan', 'akrep', 'isirdi', 'isirik', 'snake', 'bite', 'scorpion']],
  ['anaphylaxis', ['alerji', 'anafilaksi', 'ari sok', 'allerg', 'anaphylaxis', 'epipen']],
  ['drowning', ['bogul', 'suda', 'drown', 'water rescue']],
  ['burns', ['yanik', 'yandi', 'haslan', 'burn', 'scald']],
  ['lightning', ['yildirim', 'simsek', 'lightning']],
  ['avalanche', ['cig', 'avalanche', 'buried']],
  [
    'cpr',
    [
      'kalp',
      'nefes',
      'bilinc',
      'bayil',
      'cpr',
      'unconscious',
      'breathing',
      'pulse',
      'ilk yardim',
      'first aid',
    ],
  ],
];

const GEAR_TIPS: [string[], string, string][] = [
  [
    ['bot', 'ayakkabi', 'boots', 'shoe'],
    'Bot: bilek destekli, Vibram benzeri taban; yeni botu uzun tura götürmeden en az 30 km yürü. Yaz için hafif yaklaşım ayakkabısı yeterli.',
    'Boots: ankle support and a grippy sole; break new boots in for at least 30 km before a long trip. Light approach shoes are fine for summer.',
  ],
  [
    ['cadir', 'tent'],
    'Çadır: 3 mevsim çift katlı, 2 kişi için ≤ 2,5 kg; yüksek yerlerde rüzgâra dayanıklı geometri seç.',
    'Tent: 3-season double-wall, ≤ 2.5 kg for two; pick a wind-stable geometry for high camps.',
  ],
  [
    ['uyku tulumu', 'tulum', 'sleeping bag'],
    'Uyku tulumu: konfor sıcaklığı beklenen gece sıcaklığının 5 °C altında olsun; nemli iklimde sentetik, kuru soğukta kaz tüyü.',
    'Sleeping bag: comfort rating 5 °C below the expected night low; synthetic for damp climates, down for dry cold.',
  ],
  [
    ['ip', 'halat', 'rope'],
    'İp: spor tırmanış için 70 m tek ip (9,5–9,8 mm); çok uzunluklu rotalarda çift ip düşün.',
    'Rope: 70 m single (9.5–9.8 mm) for sport; consider half ropes for multi-pitch.',
  ],
  [
    ['kask', 'helmet'],
    'Kask: tırmanış, bisiklet ve kayak için ayrı standartlar var; darbe alan kaskı değiştir.',
    'Helmet: climbing, cycling and ski helmets use different standards; replace after any impact.',
  ],
  [
    ['mont', 'kabuk', 'jacket', 'shell'],
    'Mont: 3 katman sistemi — nem atan baz, izolasyon (polar/şişme) ve su geçirmez kabuk (≥ 10.000 mm).',
    'Jacket: 3-layer system — wicking base, insulation (fleece/puffy), waterproof shell (≥ 10,000 mm).',
  ],
  [
    ['canta', 'sirt cantasi', 'backpack', 'pack'],
    'Çanta: günübirlik 20–30 L, 2–3 gün 45–55 L; bel kemeri ağırlığın %70’ini taşımalı.',
    'Pack: 20–30 L for day trips, 45–55 L for 2–3 days; the hip belt should carry ~70% of the load.',
  ],
];

function fmtKm(km: number, locale: string): string {
  return formatDistance(km, locale);
}

function action(label: string, href: string, icon: string): AiAction {
  return { label, href, icon };
}

/**
 * Yerel veriden (kütüphane, tehlikeler, acil merkezler, ilk yardım rehberleri) cevap üretir.
 * Ağ yokken ya da gateway yapılandırılmamışken kullanılır.
 */
export function answerLocally(text: string, ctx: AiContext, kb: LocalKnowledge): LocalAnswer {
  const tr = isTr(ctx.locale);
  const L = tr ? 'tr' : 'en';
  const intent = classifyIntent(text, ctx.locale);
  const origin = ctx.coords ?? DEFAULT_LOCATION;
  const folded = ` ${foldText(text)} `;
  const actions: AiAction[] = [];
  const lines: string[] = [];

  switch (intent) {
    case 'plan_trip': {
      const plan = buildTripPlan(text, ctx, kb.places, new Date(0));
      lines.push(plan.title, '');
      for (const d of plan.days)
        lines.push(
          `${tr ? 'Gün' : 'Day'} ${d.day}: ${d.title} — ${fmtKm(d.distanceKm, ctx.locale)} / +${d.ascentM} m`,
        );
      lines.push(
        '',
        tr
          ? 'Paketleme listesi ve güvenlik notları için "Gezi planla" kartını aç.'
          : 'Open the "Plan trip" card for the packing list and safety notes.',
      );
      const req = parseTripRequest(text, ctx, kb.places);
      if (req.place)
        actions.push(
          action(localizedPlaceName(req.place, ctx.locale), `/library/${req.place.id}`, 'map-pin'),
        );
      actions.push(action(tr ? 'Rota planlayıcı' : 'Route planner', '/maps/planner', 'route'));
      actions.push(action(tr ? 'Tehlike bölgeleri' : 'Hazard zones', '/hazards', 'triangle-alert'));
      break;
    }
    case 'find_place': {
      const req = parseTripRequest(text, ctx, kb.places);
      let found = matchPlaces(text, kb.places, origin);
      if (found.length === 0) {
        const typed = kb.places.filter((p) => p.adventureTypes.includes(req.adventureType));
        found = (typed.length > 0 ? typed : kb.places).sort(
          (a, b) => placeDistance(origin, a) - placeDistance(origin, b),
        );
      }
      const top = found.slice(0, 3);
      lines.push(
        tr
          ? `Kütüphaneden ${ADVENTURE_LABEL.tr[req.adventureType].toLocaleLowerCase('tr-TR')} önerilerim:`
          : `My ${ADVENTURE_LABEL.en[req.adventureType]} picks from the library:`,
        '',
      );
      top.forEach((p, i) => {
        const name = localizedPlaceName(p, ctx.locale);
        const bits = [KIND_LABEL[L][p.kind], fmtKm(placeDistance(origin, p), ctx.locale)];
        if (p.elevationM !== null && p.elevationM > 0) bits.push(`${p.elevationM} m`);
        lines.push(`${i + 1}. ${name} (${bits.join(' · ')})`);
        if (p.description) lines.push(`   ${p.description}`);
        actions.push(action(name, `/library/${p.id}`, 'map-pin'));
      });
      if (req.adventureType === 'climbing' && kb.crags && kb.crags.length > 0) {
        const crag = [...kb.crags].sort(
          (a, b) => distanceKm(origin, a.coords) - distanceKm(origin, b.coords),
        )[0];
        if (crag) actions.push(action(crag.name, `/climbing/${crag.id}`, 'mountain'));
      }
      actions.push(action(tr ? 'Kütüphanede ara' : 'Search the library', '/library', 'search'));
      break;
    }
    case 'safety_brief': {
      const active = kb.hazards.filter((h) => h.status === 'active');
      const mentioned = active.filter((h) => {
        const ht = tokens(`${h.title} ${h.locationName}`).filter((w) => w.length >= 4);
        const pt = tokens(text);
        return ht.some((w) => pt.some((p) => p.startsWith(w) || w.startsWith(p)));
      });
      const list = (mentioned.length > 0 ? mentioned : active)
        .map((h) => ({ h, d: distanceKm(origin, h.coords) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      if (list.length === 0)
        lines.push(
          tr ? 'Yakınında kayıtlı aktif tehlike yok.' : 'No active hazards recorded near you.',
        );
      else {
        lines.push(
          tr ? 'Güvenlik brifingi — aktif tehlikeler:' : 'Safety brief — active hazards:',
          '',
        );
        for (const { h, d } of list) {
          lines.push(
            `• ${h.title} (${SEVERITY_LABEL[L][h.severity]}, ${fmtKm(d, ctx.locale)})`,
            `  ${h.description}`,
          );
          actions.push(action(h.locationName, `/hazards/${h.id}`, 'triangle-alert'));
        }
      }
      lines.push(
        '',
        tr ? 'Genel kurallar:' : 'General rules:',
        tr
          ? '• Planını ve dönüş saatini bir yakınına bildir.'
          : '• Tell someone your plan and return time.',
        tr
          ? '• Hava tahminini ve gün ışığı süresini kontrol et.'
          : '• Check the forecast and daylight hours.',
        tr
          ? `• Acil numara: ${emergencyNumber('TR').general}; şebeke yoksa uydu mesajı kullan.`
          : `• Emergency number: ${emergencyNumber('TR').general}; use satellite messaging without signal.`,
      );
      actions.push(action(tr ? 'Tüm tehlikeler' : 'All hazards', '/hazards', 'shield-alert'));
      actions.push(action(tr ? 'Uydu mesajları' : 'Satellite messages', '/satellite', 'satellite'));
      break;
    }
    case 'first_aid': {
      let slug: string | null = null;
      for (const [s, kws] of FIRST_AID_KEYWORDS) {
        if (kws.some((k) => folded.includes(k)) && kb.firstAidSlugs.includes(s)) {
          slug = s;
          break;
        }
      }
      const centers = nearestCenters(kb.emergencyCenters, origin, { limit: 2 });
      lines.push(
        tr
          ? `Önce güvenliğini sağla, sonra ${emergencyNumber('TR').general}'yi ara. Kişiyi hareket ettirmeden önce durumu değerlendir.`
          : `Secure the scene first, then call ${emergencyNumber('TR').general}. Assess before moving the casualty.`,
      );
      if (slug) {
        lines.push(
          '',
          tr
            ? 'İlgili adım adım rehberi aşağıdan aç; adımları yüksek sesle oku.'
            : 'Open the step-by-step guide below and read the steps aloud.',
        );
        actions.push(
          action(tr ? `Rehber: ${slug}` : `Guide: ${slug}`, `/first-aid/${slug}`, 'heart-pulse'),
        );
      } else {
        lines.push(
          '',
          tr
            ? 'Durumu tam anlayamadım; en yakın rehberler:'
            : 'I could not pin the situation down; closest guides:',
        );
        for (const s of kb.firstAidSlugs.slice(0, 4))
          actions.push(action(s, `/first-aid/${s}`, 'heart-pulse'));
      }
      if (centers.length > 0) {
        lines.push('', tr ? 'En yakın acil merkezler:' : 'Nearest emergency centres:');
        for (const c of centers)
          lines.push(
            `• ${c.name} — ${fmtKm(c.distanceKm, ctx.locale)}${c.phone ? ` · ${c.phone}` : ''}`,
          );
      }
      actions.push(
        action(tr ? 'Acil merkezler' : 'Emergency contacts', '/first-aid/contacts', 'phone'),
      );
      actions.push(action(tr ? 'İlk yardım' : 'First aid', '/first-aid', 'cross'));
      break;
    }
    case 'weather': {
      const weatherHazards = kb.hazards
        .filter(
          (h) =>
            h.status === 'active' &&
            (h.type === 'weather' || h.type === 'avalanche' || h.type === 'flood'),
        )
        .map((h) => ({ h, d: distanceKm(origin, h.coords) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      lines.push(
        tr
          ? 'Çevrimdışı modda canlı tahmin çekemiyorum. Yola çıkmadan MGM/mountain-forecast tahminine bak; dağda öğleden sonra fırtına ve rüzgâr riski her zaman yüksektir.'
          : 'I cannot pull a live forecast offline. Check a mountain forecast before you leave; afternoon storms and wind are always a risk in the hills.',
      );
      if (weatherHazards.length > 0) {
        lines.push('', tr ? 'Hava kaynaklı aktif uyarılar:' : 'Active weather-related warnings:');
        for (const { h, d } of weatherHazards) {
          lines.push(`• ${h.title} (${fmtKm(d, ctx.locale)})`);
          actions.push(action(h.locationName, `/hazards/${h.id}`, 'cloud-lightning'));
        }
      }
      lines.push(
        '',
        tr
          ? 'Kural: rüzgâr 40 km/s üstü ya da görüş 100 m altındaysa zirveyi bırak.'
          : 'Rule: wind above 40 km/h or visibility under 100 m means skip the summit.',
      );
      actions.push(action(tr ? 'Tehlike bölgeleri' : 'Hazard zones', '/hazards', 'triangle-alert'));
      actions.push(
        action(tr ? 'Uydu ile hava al' : 'Weather via satellite', '/satellite', 'satellite'),
      );
      break;
    }
    case 'packing_list': {
      const plan = buildTripPlan(text, ctx, kb.places, new Date(0));
      lines.push(
        tr ? `${plan.title} için paketleme listesi:` : `Packing list for ${plan.title}:`,
        '',
      );
      for (const item of plan.packing) lines.push(`• ${item}`);
      const req = parseTripRequest(text, ctx, kb.places);
      if (req.place)
        actions.push(
          action(localizedPlaceName(req.place, ctx.locale), `/library/${req.place.id}`, 'map-pin'),
        );
      actions.push(action(tr ? 'Pazar yeri' : 'Marketplace', '/market', 'shopping-bag'));
      actions.push(action(tr ? 'Rota planlayıcı' : 'Route planner', '/maps/planner', 'route'));
      break;
    }
    case 'gear_advice': {
      const tips = GEAR_TIPS.filter(([kws]) =>
        kws.some((k) => folded.includes(` ${k}`) || folded.includes(k)),
      ).map(([, trTip, enTip]) => (tr ? trTip : enTip));
      const req = parseTripRequest(text, ctx, kb.places);
      if (tips.length === 0)
        tips.push(
          tr
            ? `${ADVENTURE_LABEL.tr[req.adventureType]} için temel kural: önce güvenlik ekipmanı (kask, emniyet, çığ seti), sonra konfor. Kiralayarak dene, sonra satın al.`
            : `Rule for ${ADVENTURE_LABEL.en[req.adventureType]}: safety gear first (helmet, harness, avalanche kit), comfort second. Rent to try, then buy.`,
        );
      lines.push(...tips.map((tip) => `• ${tip}`));
      const shops = (kb.businesses ?? [])
        .filter((b) => b.type === 'shop' || b.type === 'rental')
        .map((b) => ({ b, d: distanceKm(origin, b.coords) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      if (shops.length > 0) {
        lines.push('', tr ? 'Yakındaki mağaza / kiralama:' : 'Nearby shops / rentals:');
        for (const { b, d } of shops) {
          lines.push(`• ${b.name} — ${fmtKm(d, ctx.locale)}`);
          actions.push(action(b.name, `/stays/${b.id}`, 'store'));
        }
      }
      actions.push(
        action(tr ? 'İkinci el pazar' : 'Second-hand market', '/market', 'shopping-bag'),
      );
      break;
    }
    default: {
      lines.push(
        tr
          ? 'Merhaba! Ben Zirtan AI. Sana şu konularda yardımcı olabilirim:'
          : "Hi! I'm Zirtan AI. Here is what I can help with:",
        tr
          ? '• Gezi planı: "Kaçkar için 3 günlük plan yap"'
          : '• Trip plans: "Plan a 3-day trip to Kaçkar"',
        tr
          ? '• Yer önerisi: "Yakınımda kamp alanı öner"'
          : '• Places: "Recommend a campsite near me"',
        tr ? '• Güvenlik brifingi ve tehlike bölgeleri' : '• Safety briefs and hazard zones',
        tr ? '• Paketleme listesi ve ekipman tavsiyesi' : '• Packing lists and gear advice',
        tr ? '• İlk yardım adımları ve acil merkezler' : '• First aid steps and emergency contacts',
      );
      actions.push(action(tr ? 'Rota planlayıcı' : 'Route planner', '/maps/planner', 'route'));
      actions.push(action(tr ? 'Kütüphane' : 'Library', '/library', 'book-open'));
      actions.push(action(tr ? 'İlk yardım' : 'First aid', '/first-aid', 'cross'));
    }
  }

  return { content: lines.join('\n').trim(), intent, actions };
}

/* ------------------------------------------------------------------ */
/* Hızlı komutlar ve başlık                                             */
/* ------------------------------------------------------------------ */

/** Karşılama ekranı için hızlı komut önerileri (en fazla 6). */
export function suggestPrompts(ctx: AiContext, locale: string = ctx.locale): string[] {
  const tr = isTr(locale);
  const base = tr
    ? [
        'Yakınımda kamp alanı öner',
        'Hafta sonu için 2 günlük plan yap',
        'Bölgemdeki tehlikeler neler?',
        'Çantama ne koymalıyım?',
      ]
    : [
        'Recommend a campsite near me',
        'Plan a 2-day weekend trip',
        'What hazards are around me?',
        'What should I pack?',
      ];
  const byType: Record<AdventureType, string> = tr
    ? {
        hiking: 'Kaçkar için 3 günlük yürüyüş planla',
        climbing: 'Geyikbayırı için tırmanış ekipmanı listesi',
        diving: 'Kaş’ta dalış noktası öner',
        skiing: 'Erciyes’te çığ riski var mı?',
        cycling: 'Kapadokya gravel rotası planla',
        paragliding: 'Babadağ kalkış için hava kuralları',
        rafting: 'Köprülü Kanyon rafting güvenli mi?',
        canoe: 'Deniz kayağı için ne götürmeliyim?',
      }
    : {
        hiking: 'Plan a 3-day hike in Kaçkar',
        climbing: 'Climbing gear list for Geyikbayırı',
        diving: 'Recommend a dive site in Kaş',
        skiing: 'Is there avalanche risk at Erciyes?',
        cycling: 'Plan a Cappadocia gravel route',
        paragliding: 'Wind rules for launching at Babadağ',
        rafting: 'Is Köprülü Canyon rafting safe?',
        canoe: 'What to bring for sea kayaking?',
      };
  const extra = ctx.adventureTypes.slice(0, 2).map((t) => byType[t]);
  if (extra.length === 0) extra.push(byType.hiking);
  return [...extra, ...base].slice(0, 6);
}

/** İlk mesajdan kısa sohbet başlığı üretir (≤ 48 karakter). */
export function summarizeThreadTitle(firstMessage: string, locale = 'tr'): string {
  const clean = firstMessage
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.…]+$/g, '');
  if (!clean) return isTr(locale) ? 'Sohbet' : 'Chat';
  const capped = clean.charAt(0).toLocaleUpperCase(locale) + clean.slice(1);
  if (capped.length <= 48) return capped;
  const cut = capped.slice(0, 48);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
