import { nearestCenters } from './emergency';
import type { RiskLevel, VisionSituation } from './enums';
import { RISK_LEVELS, VISION_SITUATIONS } from './enums';
import { distanceKm, formatDistance } from './geo';
import type { AiAction, EmergencyCenter, HazardZone, VisionAdvice, VisionRequest } from './types';

/* ------------------------------------------------------------------ */
/* Tipler ve sabitler                                                   */
/* ------------------------------------------------------------------ */

/** Çevrimdışı görüntü tavsiyesinin dayandığı yerel veri. */
export interface VisionKnowledge {
  hazards: HazardZone[];
  emergencyCenters: EmergencyCenter[];
  /** Mevcut ilk yardım rehberi slug'ları (`/first-aid/<slug>`) */
  firstAidSlugs: string[];
  /** Bilinen irtifa (m); yoksa null — `input.altitudeM` ile birleştirilir */
  altitudeM: number | null;
}

/** Gateway'e gönderilebilecek en büyük görüntü (ham bayt). */
export const VISION_MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Geçmişte tutulan en fazla kayıt. */
export const VISION_HISTORY_LIMIT = 50;

/** Model yanıtında / yerel tavsiyede izin verilen uygulama içi rota önekleri. */
export const VISION_ALLOWED_ROUTE_PREFIXES = [
  '/first-aid',
  '/hazards',
  '/satellite',
  '/destinations',
  '/maps/planner',
  '/library',
] as const;

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, extreme: 3 };

/** Yüksek irtifa eşikleri (m). */
const ALTITUDE_CAUTION_M = 2500;
const ALTITUDE_HIGH_M = 3500;

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
  İ: 'i',
  Ğ: 'g',
  Ş: 's',
  Ç: 'c',
  Ö: 'o',
  Ü: 'u',
};

function fold(text: string): string {
  return text
    .replace(/[ığşçöüİĞŞÇÖÜ]/g, (ch) => FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isTr(locale: string): boolean {
  return locale.toLowerCase().startsWith('tr');
}

function isSituation(value: unknown): value is VisionSituation {
  return typeof value === 'string' && (VISION_SITUATIONS as readonly string[]).includes(value);
}

function isRisk(value: unknown): value is RiskLevel {
  return typeof value === 'string' && (RISK_LEVELS as readonly string[]).includes(value);
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function bumpRisk(risk: RiskLevel): RiskLevel {
  return RISK_LEVELS[Math.min(RISK_ORDER[risk] + 1, RISK_LEVELS.length - 1)] ?? risk;
}

function action(label: string, href: string, icon: string): AiAction {
  return { label, href, icon };
}

function hasAny(folded: string, words: string[]): boolean {
  return words.some((w) => folded.includes(fold(w)));
}

/* ------------------------------------------------------------------ */
/* Anahtar kelimeden risk                                               */
/* ------------------------------------------------------------------ */

const RISK_KEYWORDS: { level: RiskLevel; words: string[] }[] = [
  {
    level: 'extreme',
    words: [
      'çığ',
      'avalanche',
      'yıldırım',
      'lightning',
      'bilinç',
      'unconscious',
      'nefes almıyor',
      'not breathing',
      'şiddetli kanama',
      'severe bleeding',
      'zehirlen',
      'poison',
      ' sel ',
      'sel bas',
      'flash flood',
      'düştü',
      ' fell ',
      'mahsur',
      'stranded',
      'kayıp',
      ' lost ',
    ],
  },
  {
    level: 'high',
    words: [
      'kaya düş',
      'rockfall',
      ' dik ',
      'dik yamac',
      'steep',
      'fırtına',
      'storm',
      'kırık',
      'fracture',
      'broken',
      ' ayi ',
      ' bear ',
      'yılan',
      'snake',
      'kanama',
      'bleed',
      'buz',
      ' ice ',
      'icy',
      'uçurum',
      'cliff',
      ' kar ',
      'karli',
      'snow',
      'hipotermi',
      'hypothermia',
      'donma',
      'frostbite',
      'yaban domuzu',
      'boar',
    ],
  },
  {
    level: 'moderate',
    words: [
      'bulut',
      'cloud',
      'yağmur',
      'rain',
      'kaygan',
      'slippery',
      'yorgun',
      'tired',
      'karanlık',
      'dark',
      'sis',
      'fog',
      'rüzgar',
      'wind',
      'ısırgan',
      'nettle',
      'mantar',
      'mushroom',
      'çamur',
      'mud',
      'sıcak',
      'heat',
      'baş ağrısı',
      'headache',
      'burkul',
      'sprain',
    ],
  },
];

/** Serbest metindeki anahtar kelimelerden en yüksek risk seviyesini çıkarır. */
export function riskFromKeywords(text: string): RiskLevel {
  const folded = ` ${fold(text)} `;
  for (const { level, words } of RISK_KEYWORDS) if (hasAny(folded, words)) return level;
  return 'low';
}

/* ------------------------------------------------------------------ */
/* Görüntü boyutu                                                       */
/* ------------------------------------------------------------------ */

export interface ImageSizeGuardResult {
  /** Yaklaşık ham bayt (base64 çözülmüş) */
  bytes: number;
  ok: boolean;
  /** Üst sınırı aşıyor; istemci küçültmeli ya da kalite düşürmeli */
  needsResize: boolean;
}

/** `data:` önekini atar; saf base64 verisini döner. */
export function stripDataUrl(base64: string): { data: string; mediaType: string | null } {
  const match = /^data:([a-z0-9.+/-]+);base64,/i.exec(base64);
  if (!match) return { data: base64.trim(), mediaType: null };
  return { data: base64.slice(match[0].length).trim(), mediaType: match[1]?.toLowerCase() ?? null };
}

/** Base64 uzunluğundan ham boyutu hesaplar ve üst sınırla karşılaştırır. */
export function imageSizeGuard(
  base64: string | null | undefined,
  maxBytes: number = VISION_MAX_IMAGE_BYTES,
): ImageSizeGuardResult {
  if (!base64) return { bytes: 0, ok: false, needsResize: false };
  const { data } = stripDataUrl(base64);
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor((data.length * 3) / 4) - padding);
  if (bytes === 0) return { bytes: 0, ok: false, needsResize: false };
  const needsResize = bytes > maxBytes;
  return { bytes, ok: !needsResize, needsResize };
}

/* ------------------------------------------------------------------ */
/* Durum metinleri                                                      */
/* ------------------------------------------------------------------ */

const SITUATION_PROMPTS: Record<VisionSituation, [string, string]> = {
  terrain: [
    'Bu arazi fotoğrafını değerlendir: eğim, kaya düşmesi, çığ riski ve geçiş zorluğu. Burada ne yapmalıyım?',
    'Assess this terrain photo: slope, rockfall, avalanche risk and passability. What should I do here?',
  ],
  weather: [
    'Gökyüzündeki bulutlara bak: yaklaşan hava nasıl, fırtına ya da yıldırım riski var mı?',
    'Look at the clouds: what weather is coming, is there a storm or lightning risk?',
  ],
  gear: [
    'Bu ekipmanı kontrol et: yıpranma, doğru kullanım ve eksik parça var mı?',
    'Check this gear: wear, correct setup and anything missing?',
  ],
  injury: [
    'Bu yaralanmayı değerlendir: ilk yardım adımları ne olmalı, ne zaman yardım çağırmalıyım?',
    'Assess this injury: what first-aid steps should I take and when should I call for help?',
  ],
  wildlife: [
    'Bu hayvan hangi tür olabilir ve nasıl davranmalıyım?',
    'What animal could this be and how should I behave?',
  ],
  plant: [
    'Bu bitki/mantar tehlikeli mi? Dokunmak ya da yemek güvenli mi?',
    'Is this plant/mushroom dangerous? Is it safe to touch or eat?',
  ],
  map: [
    'Bu harita ve pusulaya göre nerede olabilirim ve hangi yöne gitmeliyim?',
    'Based on this map and compass, where might I be and which way should I go?',
  ],
  water: [
    'Bu su kaynağı içmek için güvenli mi, nasıl arıtmalıyım?',
    'Is this water source safe to drink, how should I treat it?',
  ],
  camp: [
    'Bu kamp yeri güvenli mi? Rüzgâr, su, ağaç ve çığ riskini değerlendir.',
    'Is this campsite safe? Assess wind, water, tree and avalanche risk.',
  ],
  other: [
    'Bu fotoğrafta gördüğün duruma göre ne yapmalıyım?',
    'Based on what you see in this photo, what should I do?',
  ],
};

/** Duruma göre modele/sohbete verilecek varsayılan soru metni. */
export function situationPrompt(situation: VisionSituation, locale: string): string {
  const pair = SITUATION_PROMPTS[situation] ?? SITUATION_PROMPTS.other;
  return isTr(locale) ? pair[0] : pair[1];
}

const QUICK_QUESTIONS: Record<VisionSituation, [string[], string[]]> = {
  terrain: [
    ['Buradan geçebilir miyim?', 'Kaya düşme riski var mı?', 'Eğim çığ için tehlikeli mi?'],
    ['Can I cross here?', 'Is there rockfall risk?', 'Is this slope avalanche-prone?'],
  ],
  weather: [
    ['Fırtına yaklaşıyor mu?', 'Yıldırım riski var mı?', 'Kaç saatim var?'],
    ['Is a storm coming?', 'Is there lightning risk?', 'How many hours do I have?'],
  ],
  gear: [
    ['Bu ip hâlâ güvenli mi?', 'Emniyet doğru bağlanmış mı?', 'Kask yıpranmış mı?'],
    ['Is this rope still safe?', 'Is the belay set up correctly?', 'Is the helmet worn out?'],
  ],
  injury: [
    ['Kanamayı nasıl durdururum?', 'Kırık olabilir mi?', 'Yardım çağırmalı mıyım?'],
    ['How do I stop the bleeding?', 'Could it be a fracture?', 'Should I call for help?'],
  ],
  wildlife: [
    ['Bu hayvan tehlikeli mi?', 'Nasıl uzaklaşmalıyım?', 'Bu izler neye ait?'],
    ['Is this animal dangerous?', 'How should I back away?', 'Whose tracks are these?'],
  ],
  plant: [
    ['Bu bitki zehirli mi?', 'Bu mantar yenir mi?', 'Dokundum, ne yapmalıyım?'],
    ['Is this plant poisonous?', 'Is this mushroom edible?', 'I touched it, what now?'],
  ],
  map: [
    ['Neredeyim?', 'Hangi yöne gitmeliyim?', 'Bu sembol ne anlama geliyor?'],
    ['Where am I?', 'Which way should I go?', 'What does this symbol mean?'],
  ],
  water: [
    ['Bu su içilir mi?', 'Nasıl arıtırım?', 'Kaynatmak yeterli mi?'],
    ['Is this water drinkable?', 'How do I purify it?', 'Is boiling enough?'],
  ],
  camp: [
    ['Çadırı buraya kurabilir miyim?', 'Rüzgâr riski var mı?', 'Gece soğuk olur mu?'],
    ['Can I pitch here?', 'Is there wind risk?', 'Will it get cold tonight?'],
  ],
  other: [
    ['Burada ne yapmalıyım?', 'Bu tehlikeli mi?', 'Devam etmeli miyim?'],
    ['What should I do here?', 'Is this dangerous?', 'Should I continue?'],
  ],
};

/** Ekranda deklanşörün üstünde gösterilen hızlı soru önerileri. */
export function visionQuickQuestions(situation: VisionSituation, locale: string): string[] {
  const pair = QUICK_QUESTIONS[situation] ?? QUICK_QUESTIONS.other;
  return [...(isTr(locale) ? pair[0] : pair[1])];
}

/* ------------------------------------------------------------------ */
/* Model yanıtını ayrıştırma                                            */
/* ------------------------------------------------------------------ */

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Model/yerel aksiyonlarını süzer: yalnızca izinli rotalar, en fazla 6 öğe. */
export function sanitizeVisionActions(value: unknown): AiAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: AiAction[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const a = raw as { label?: unknown; href?: unknown; icon?: unknown };
    if (typeof a.label !== 'string' || typeof a.href !== 'string') continue;
    const href = a.href.trim();
    if (!VISION_ALLOWED_ROUTE_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`)))
      continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({
      label: a.label.trim().slice(0, 40),
      href,
      icon: typeof a.icon === 'string' && a.icon ? a.icon : 'arrow-up-right',
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Gateway'in JSON yanıtını `VisionAdvice`'e çevirir. Eksik/bozuk alanları tolere eder:
 * boş listeler, `risk` yoksa metinden türetilir, `confidence` 0–1 aralığına sıkıştırılır.
 */
export function parseVisionResponse(
  json: unknown,
  situation: VisionSituation = 'other',
  now: Date = new Date(),
): VisionAdvice {
  const obj = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const observations = stringList(obj.observations, 8);
  const advice = stringList(obj.advice, 10);
  const avoid = stringList(obj.avoid, 8);
  const risk = isRisk(obj.risk)
    ? obj.risk
    : riskFromKeywords([...observations, ...advice, ...avoid].join(' '));
  const rawConfidence = typeof obj.confidence === 'number' ? obj.confidence : 0.6;
  const confidence = Math.min(1, Math.max(0, Number.isFinite(rawConfidence) ? rawConfidence : 0.6));
  const id =
    typeof obj.id === 'string' && obj.id
      ? obj.id
      : `vis_${now.getTime().toString(36)}${Math.floor(confidence * 1000).toString(36)}`;
  return {
    id,
    situation: isSituation(obj.situation) ? obj.situation : situation,
    observations,
    risk,
    advice,
    avoid,
    actions: sanitizeVisionActions(obj.actions),
    source: 'remote',
    confidence,
    createdAt: now.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Yerel (çevrimdışı) tavsiye                                           */
/* ------------------------------------------------------------------ */

interface Ctx {
  tr: boolean;
  locale: string;
  folded: string;
  altitudeM: number | null;
  coords: VisionRequest['coords'];
  hour: number;
  kb: VisionKnowledge;
}

type Bag = { observations: string[]; advice: string[]; avoid: string[]; actions: AiAction[] };

function L(c: Ctx, tr: string, en: string): string {
  return c.tr ? tr : en;
}

function firstAidAction(c: Ctx, slug: string, labelTr: string, labelEn: string): AiAction | null {
  if (c.kb.firstAidSlugs.length > 0 && !c.kb.firstAidSlugs.includes(slug)) return null;
  return action(L(c, labelTr, labelEn), `/first-aid/${slug}`, 'heart-pulse');
}

function pushAction(bag: Bag, a: AiAction | null): void {
  if (!a) return;
  if (bag.actions.some((x) => x.href === a.href)) return;
  bag.actions.push(a);
}

function hazardsAction(c: Ctx): AiAction {
  return action(L(c, 'Tehlike bölgeleri', 'Hazard zones'), '/hazards', 'triangle-alert');
}

function sosAction(c: Ctx): AiAction {
  return action(L(c, 'Uydu SOS', 'Satellite SOS'), '/satellite/sos', 'satellite');
}

function plannerAction(c: Ctx): AiAction {
  return action(L(c, 'Rota planlayıcı', 'Route planner'), '/maps/planner', 'route');
}

function amsAction(c: Ctx): AiAction {
  return action(L(c, 'İrtifa hastalığı', 'Altitude sickness'), '/destinations/ams', 'mountain');
}

/** İlk yardım ihtiyacını sorudaki kelimelerden tahmin eder. */
function guessFirstAidSlug(folded: string): { slug: string; tr: string; en: string } {
  const table: { words: string[]; slug: string; tr: string; en: string }[] = [
    {
      words: ['kanama', 'kesik', 'bleed', 'cut', 'kan '],
      slug: 'bleeding',
      tr: 'Kanama',
      en: 'Bleeding',
    },
    {
      words: ['kırık', 'burkul', 'fracture', 'broken', 'sprain'],
      slug: 'fracture',
      tr: 'Kırık',
      en: 'Fracture',
    },
    { words: ['yanık', 'burn'], slug: 'burns', tr: 'Yanık', en: 'Burns' },
    {
      words: ['yılan', 'snake', 'ısır', 'bite'],
      slug: 'snakebite',
      tr: 'Yılan ısırığı',
      en: 'Snakebite',
    },
    {
      words: ['soğuk', 'donma', 'hipotermi', 'cold', 'hypotherm', 'frost'],
      slug: 'hypothermia',
      tr: 'Hipotermi',
      en: 'Hypothermia',
    },
    {
      words: ['sıcak', 'güneş', 'heat', 'sun'],
      slug: 'heat',
      tr: 'Sıcak çarpması',
      en: 'Heat illness',
    },
    {
      words: ['baş ağrısı', 'bulantı', 'irtifa', 'altitude', 'headache', 'nausea'],
      slug: 'altitude',
      tr: 'İrtifa hastalığı',
      en: 'Altitude',
    },
    {
      words: ['alerji', 'şiş', 'allerg', 'swell', 'anafil', 'anaphyl'],
      slug: 'anaphylaxis',
      tr: 'Anafilaksi',
      en: 'Anaphylaxis',
    },
    {
      words: ['bilinç', 'nefes', 'unconscious', 'breath', 'kalp', 'heart'],
      slug: 'cpr',
      tr: 'Temel yaşam desteği',
      en: 'CPR',
    },
  ];
  for (const row of table) if (hasAny(folded, row.words)) return row;
  return { slug: 'bleeding', tr: 'Kanama kontrolü', en: 'Bleeding control' };
}

function addCommon(c: Ctx, bag: Bag, situation: VisionSituation): void {
  // İrtifa
  if (c.altitudeM !== null && c.altitudeM >= ALTITUDE_CAUTION_M) {
    bag.observations.push(
      L(
        c,
        `İrtifa yaklaşık ${Math.round(c.altitudeM)} m: ince hava, hızlı hava değişimi ve irtifa hastalığı belirtilerine dikkat.`,
        `Altitude about ${Math.round(c.altitudeM)} m: thin air, rapid weather changes and altitude sickness symptoms.`,
      ),
    );
    if (c.altitudeM >= ALTITUDE_HIGH_M)
      bag.advice.push(
        L(
          c,
          'Baş ağrısı, bulantı ya da sersemlik varsa daha yükseğe çıkma; en az 300–500 m alçal.',
          'If you have headache, nausea or dizziness do not go higher; descend at least 300–500 m.',
        ),
      );
    pushAction(bag, amsAction(c));
  }

  // Saat
  if (c.hour >= 17 || c.hour < 6)
    bag.advice.push(
      L(
        c,
        'Karanlık yakın ya da gece: kafa lambanı ve yedek pilini hazırla, yeni geçişlere başlama.',
        'Dusk or night: get your headlamp and spare batteries ready; do not start new passages.',
      ),
    );

  // Yakın tehlikeler
  if (c.coords) {
    const near = c.kb.hazards
      .filter((h) => h.status === 'active')
      .map((h) => ({ h, km: distanceKm(c.coords!, h.coords) }))
      .filter(({ h, km }) => km <= h.radiusM / 1000 + 5)
      .sort((a, b) => a.km - b.km)
      .slice(0, 2);
    for (const { h, km } of near) {
      bag.observations.push(
        L(
          c,
          `Yakında bildirilmiş tehlike: ${h.title} (${formatDistance(km, c.locale)}).`,
          `Reported hazard nearby: ${h.title} (${formatDistance(km, c.locale)}).`,
        ),
      );
      pushAction(bag, action(h.title.slice(0, 40), `/hazards/${h.id}`, 'triangle-alert'));
    }
  }

  if (situation === 'injury' || situation === 'terrain' || situation === 'weather')
    pushAction(bag, hazardsAction(c));
}

function terrainAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Görüntü analizi olmadan eğim ve zemin tahmin edilemez; aşağıdaki kontrol listesini sahada uygula.',
      'Slope and surface cannot be judged without image analysis; apply the checklist below on site.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Eğimi tahmin et: 30–45° arası kar yamaçları çığ için en tehlikeli aralıktır; kar varsa tek tek ve hızlı geç.',
      'Estimate the slope: 30–45° snow slopes are the most avalanche-prone; if there is snow cross one at a time, quickly.',
    ),
    L(
      c,
      'Kaya düşmesi belirtileri: taze kırık izleri, dibe birikmiş moloz, çatlak yüzeyler. Kaskını tak, yamaç altında durma.',
      'Rockfall signs: fresh fracture marks, debris at the base, cracked faces. Wear your helmet; do not linger below the slope.',
    ),
    L(
      c,
      'Gevşek kayalık ve kaygan zeminde adımı kısalt, üç temas noktası kuralını uygula.',
      'On loose scree and slippery ground shorten your steps and keep three points of contact.',
    ),
    L(
      c,
      'Görüş kapanıyorsa ya da geri dönüş zorlaşıyorsa dönüş kararını erken ver.',
      'If visibility is dropping or retreat is getting harder, decide to turn back early.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Islak kaya, buzlu geçiş ve karnisli sırtlara yalnız girme.',
      'Do not enter wet rock, icy passages or corniced ridges alone.',
    ),
    L(c, 'Çığ yamaçlarının altında mola verme.', 'Do not rest below avalanche slopes.'),
  );
  pushAction(bag, plannerAction(c));
}

function weatherAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Bulut tipine bak: kule gibi büyüyen kümülonimbus fırtına, örs şekli yıldırım işaretidir; hızla alçalan mercek bulutlar güçlü rüzgâr getirir.',
      'Look at the cloud type: towering cumulonimbus means storms, an anvil top means lightning; fast lenticular clouds bring strong winds.',
    ),
  );
  bag.advice.push(
    L(
      c,
      '30/30 kuralı: şimşek ile gök gürültüsü arası 30 saniyeden kısaysa hemen sığın; son gök gürültüsünden 30 dakika sonra devam et.',
      '30/30 rule: if the gap between flash and thunder is under 30 seconds, take shelter now; resume 30 minutes after the last thunder.',
    ),
    L(
      c,
      'Yıldırım riskinde sırt ve zirvelerden in, metal ekipmandan uzaklaş, çömel ve grup halinde 15 m aralık bırak.',
      'In lightning risk get off ridges and summits, move away from metal gear, crouch and keep 15 m spacing in a group.',
    ),
    L(
      c,
      'Sıcaklık düşüşü ve rüzgâr artışı cephe geçişi demektir; katmanlarını ve yağmurluğunu hazırla.',
      'A temperature drop and rising wind means a front is passing; ready your layers and rain shell.',
    ),
    L(
      c,
      'Öğleden sonra fırtınaları yaygındır; zirve hedefini erken saate planla.',
      'Afternoon storms are common; plan summit pushes for early hours.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Tek ağaç altına ya da mağara ağzına sığınma.',
      'Do not shelter under a lone tree or at a cave mouth.',
    ),
    L(c, 'Şimşek görünce yürüyüşe devam etme.', 'Do not keep walking after seeing lightning.'),
  );
  pushAction(bag, firstAidAction(c, 'lightning', 'Yıldırım çarpması', 'Lightning strike'));
}

function gearAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Ekipman kontrolü görüntü olmadan yapılamaz; aşağıdaki listeyi elle uygula.',
      'Gear cannot be inspected without image analysis; run the checklist by hand.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Kask: çatlak, ezik ya da gevşek kayış varsa kullanma; darbe almış kask değiştirilir.',
      'Helmet: do not use if cracked, dented or with loose straps; replace a helmet that took an impact.',
    ),
    L(
      c,
      'Emniyet kemeri: kayışlar çift geçirilmiş mi, bağlantı halkası aşınmış mı? Ortak kontrol yap.',
      'Harness: are the straps double-backed, is the belay loop frayed? Do a partner check.',
    ),
    L(
      c,
      'İp: kılıfta kesik, çekirdeğin görünmesi ya da sert/yumuşak bölgeler varsa emekliye ayır.',
      'Rope: retire it if the sheath is cut, the core shows, or there are stiff/soft spots.',
    ),
    L(
      c,
      'Karabina kapısı serbestçe kapanmalı, kilitli karabinaların kilidi tam dönmeli.',
      'Carabiner gates must close freely; locking gates must turn fully.',
    ),
    L(
      c,
      'Bot bağcıkları, çanta tokaları ve baton kilitlerini yola çıkmadan kontrol et.',
      'Check boot laces, pack buckles and pole locks before setting off.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Düşme yükü almış ipi ya da yıpranmış perlonu kullanma.',
      'Do not use a rope that held a hard fall or worn slings.',
    ),
    L(
      c,
      'Kimyasal ya da UV’ye uzun süre maruz kalmış tekstil ekipmana güvenme.',
      'Do not trust textile gear long exposed to chemicals or UV.',
    ),
  );
  pushAction(bag, plannerAction(c));
}

function injuryAdvice(c: Ctx, bag: Bag): void {
  const guess = guessFirstAidSlug(c.folded);
  bag.observations.push(
    L(
      c,
      'Yaralanma görüntü olmadan değerlendirilemez; ABC sırasını uygula ve ilk yardım rehberini aç.',
      'The injury cannot be assessed without the image; follow ABC and open the first-aid guide.',
    ),
  );
  if (c.coords && c.kb.emergencyCenters.length > 0) {
    const [nearest] = nearestCenters(c.kb.emergencyCenters, c.coords, { limit: 1 });
    if (nearest)
      bag.observations.push(
        L(
          c,
          `En yakın acil merkez: ${nearest.name} (${formatDistance(nearest.distanceKm, c.locale)})${nearest.phone ? `, ${nearest.phone}` : ''}.`,
          `Nearest emergency center: ${nearest.name} (${formatDistance(nearest.distanceKm, c.locale)})${nearest.phone ? `, ${nearest.phone}` : ''}.`,
        ),
      );
  }
  bag.advice.push(
    L(
      c,
      'ABC: hava yolu açık mı, nefes alıyor mu, dolaşım (nabız, kanama) kontrol.',
      'ABC: is the airway open, is the person breathing, check circulation (pulse, bleeding).',
    ),
    L(
      c,
      'Kanama varsa temiz bezle doğrudan bası uygula, 10 dakika bırakma.',
      'For bleeding apply direct pressure with a clean cloth and hold for 10 minutes.',
    ),
    L(
      c,
      'Kırık şüphesinde hareket ettirme, olduğu konumda sabitle, soğuk uygula.',
      'If a fracture is suspected do not move it; splint in place and apply cold.',
    ),
    L(
      c,
      'Yaralıyı sıcak tut ve şoka karşı bacakları hafif yükselt; bilinç değişirse 112’yi ara ya da uydu SOS gönder.',
      'Keep the casualty warm and slightly raise the legs against shock; if consciousness changes call 112 or send a satellite SOS.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Omurga şüphesinde boynu ve sırtı hareket ettirme.',
      'Do not move the neck or back if spinal injury is suspected.',
    ),
    L(
      c,
      'Derin yaralardan saplanan cismi çıkarma.',
      'Do not pull out an impaled object from a deep wound.',
    ),
  );
  pushAction(bag, firstAidAction(c, guess.slug, guess.tr, guess.en));
  pushAction(bag, firstAidAction(c, 'bleeding', 'Kanama', 'Bleeding'));
  pushAction(bag, firstAidAction(c, 'fracture', 'Kırık', 'Fracture'));
  pushAction(bag, sosAction(c));
}

function wildlifeAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Tür tespiti görüntü olmadan yapılamaz; en yaygın karşılaşmalar için davranış kuralları aşağıda.',
      'Species cannot be identified without the image; behaviour rules for the most common encounters are below.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Ayı: koşma, göz temasını kesmeden yavaşça geri çekil, kendini büyük göster ve sakin konuş; yavrunun yanına asla yaklaşma.',
      'Bear: do not run, back away slowly without breaking eye contact, look big and talk calmly; never approach a cub.',
    ),
    L(
      c,
      'Yılan: en az 2 m mesafe bırak, dokunma; ısırıkta uzvu kalp seviyesinin altında sabit tut, turnike yapma.',
      'Snake: keep at least 2 m away, do not touch; if bitten keep the limb still below heart level, no tourniquet.',
    ),
    L(
      c,
      'Yaban domuzu: yolunu kesme, ağaç ya da kaya arkasına geç, yavrulu dişiden uzak dur.',
      'Wild boar: do not block its path, get behind a tree or rock, stay away from a sow with piglets.',
    ),
    L(
      c,
      'Çoban köpekleri: durup batonlarını indir, sürüden uzaklaş, koşma.',
      'Livestock guardian dogs: stop, lower your poles, move away from the flock, do not run.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Hayvanı besleme, fotoğraf için yaklaşma.',
      'Do not feed the animal or approach it for a photo.',
    ),
    L(c, 'Yiyecekleri çadırda tutma.', 'Do not keep food inside the tent.'),
  );
  pushAction(bag, firstAidAction(c, 'snakebite', 'Yılan ısırığı', 'Snakebite'));
  pushAction(bag, hazardsAction(c));
}

function plantAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Bitki ve mantar tanımı görüntü olmadan yapılamaz; emin olmadığın hiçbir şeyi yeme.',
      'Plants and mushrooms cannot be identified without the image; never eat anything you are not sure about.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Isırgan: yakıcı tüyler kızarıklık yapar; soğuk suyla yıka, kaşıma.',
      'Nettle: stinging hairs cause a rash; rinse with cold water, do not scratch.',
    ),
    L(
      c,
      'Zehirli sarmaşık / sumak: üç yapraklı sürgünlere dokunma, temas ettiysen 10 dakika içinde sabunla yıka.',
      'Poison ivy / sumac: do not touch three-leaf shoots; if exposed wash with soap within 10 minutes.',
    ),
    L(
      c,
      'Mantar: yabani mantarları YEMEYİN; uzman onayı olmadan hiçbir tür güvenli sayılmaz.',
      'Mushrooms: DO NOT eat wild mushrooms; no species is safe without expert confirmation.',
    ),
    L(
      c,
      'Meyve ve tohumlarda parlak renk, süt gibi öz su ya da acı tat uyarı işaretidir.',
      'Bright colour, milky sap or a bitter taste in berries and seeds is a warning sign.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Bilinmeyen bitkiyi tatma, çiğ yeme ya da çay yapma.',
      'Do not taste, eat raw or brew an unknown plant.',
    ),
    L(
      c,
      'Gözüne ve ağzına dokunmadan önce ellerini yıka.',
      'Do not touch your eyes or mouth before washing your hands.',
    ),
  );
  pushAction(bag, firstAidAction(c, 'anaphylaxis', 'Alerjik reaksiyon', 'Allergic reaction'));
}

function mapAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Harita okuma görüntü olmadan yapılamaz; temel oryantasyon adımları aşağıda.',
      'Map reading is not possible without the image; basic orientation steps are below.',
    ),
  );
  if (c.coords)
    bag.observations.push(
      L(
        c,
        `Cihaz konumu: ${c.coords.latitude.toFixed(4)}, ${c.coords.longitude.toFixed(4)}.`,
        `Device position: ${c.coords.latitude.toFixed(4)}, ${c.coords.longitude.toFixed(4)}.`,
      ),
    );
  bag.advice.push(
    L(
      c,
      'Haritayı kuzeye yönelt: pusula ibresini haritanın kuzey çizgilerine hizala; manyetik sapmayı ekle.',
      'Orient the map to north: align the compass needle with the map’s north lines; add magnetic declination.',
    ),
    L(
      c,
      'Üç belirgin nokta (zirve, vadi, dere kavşağı) seç ve kesişimle konumunu bul.',
      'Pick three obvious features (peak, valley, stream junction) and triangulate your position.',
    ),
    L(
      c,
      'Kontur çizgileri sıkışıyorsa dik yamaç; rota planlayıcıda profili kontrol et.',
      'Tight contour lines mean a steep slope; check the profile in the route planner.',
    ),
    L(
      c,
      'Hedef yönü seç, ara hedefler belirle ve adım sayarak ilerle.',
      'Set a bearing, pick intermediate targets and pace-count.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Pusulayı telefon ya da metal yanında okuma.',
      'Do not read the compass next to a phone or metal.',
    ),
    L(
      c,
      'Emin olmadan dere yataklarını izleyerek inme.',
      'Do not descend by following gullies unless you are sure.',
    ),
  );
  pushAction(bag, plannerAction(c));
}

function waterAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Berrak su güvenli su demek değildir; yukarı akışta hayvan ya da yerleşim varsa kirlenmiş varsay.',
      'Clear water is not safe water; assume contamination if there is livestock or settlement upstream.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Kaynat: 1 dakika fokur fokur (3000 m üstünde 3 dakika).',
      'Boil: a rolling boil for 1 minute (3 minutes above 3000 m).',
    ),
    L(
      c,
      'Filtre: 0,2 mikron filtre bakteri ve parazitleri tutar; virüs için tablet ya da UV ekle.',
      'Filter: a 0.2 micron filter removes bacteria and parasites; add tablets or UV for viruses.',
    ),
    L(
      c,
      'Klor/iyot tableti: bekleme süresine uy (genelde 30 dk; soğuk suda 60 dk).',
      'Chlorine/iodine tablets: respect the wait time (usually 30 min; 60 min in cold water).',
    ),
    L(
      c,
      'Akan, gölgede kalan ve kaynağa yakın suyu tercih et; bulanık suyu önce bezden süz.',
      'Prefer flowing, shaded water close to the spring; pre-filter turbid water through cloth.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Durgun, köpüklü ya da yosunlu suyu içme.',
      'Do not drink stagnant, foamy or algae-covered water.',
    ),
    L(c, 'Kar suyunu arıtmadan içme.', 'Do not drink melted snow without treatment.'),
  );
  pushAction(bag, plannerAction(c));
}

function campAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Kamp yeri görüntü olmadan değerlendirilemez; dört tehlikeyi sahada kontrol et: rüzgâr, su, çığ, ağaç.',
      'The campsite cannot be assessed without the image; check four hazards on site: wind, water, avalanche, trees.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Rüzgâr: çadırın dar yüzünü rüzgâra ver, kaya ya da çalı siperi kullan, sırt çizgisinden uzak dur.',
      'Wind: point the tent’s narrow end into the wind, use a rock or shrub windbreak, stay off ridgelines.',
    ),
    L(
      c,
      'Su: dere yatağı ve taşkın izlerinden en az 60 m uzak, hafif yüksek zemin seç.',
      'Water: choose slightly raised ground at least 60 m from stream beds and flood marks.',
    ),
    L(
      c,
      'Çığ: 30°’den dik yamaçların ve çığ koridorlarının çıkış alanında kurma.',
      'Avalanche: do not pitch in the runout of slopes steeper than 30° or avalanche paths.',
    ),
    L(
      c,
      'Ağaç: kuru dal ve ölü ağaçların ("dul yapan") altında kalma; yıldırım için en yüksek ağaçtan uzak dur.',
      'Trees: avoid dead branches and standing dead trees ("widowmakers"); stay away from the tallest tree for lightning.',
    ),
    L(
      c,
      'Yiyecekleri çadırdan en az 50 m uzağa as; pişirme alanını ayrı tut.',
      'Hang food at least 50 m from the tent; keep the cooking area separate.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Vadi tabanına (soğuk hava gölü) ya da çukura kurma.',
      'Do not pitch on the valley floor (cold air pool) or in a hollow.',
    ),
    L(c, 'Çadır içinde ocak yakma.', 'Do not run a stove inside the tent.'),
  );
  pushAction(bag, plannerAction(c));
  pushAction(bag, hazardsAction(c));
}

function otherAdvice(c: Ctx, bag: Bag): void {
  bag.observations.push(
    L(
      c,
      'Görüntü analizi çevrimdışı yapılamıyor; genel saha güvenliği listesi aşağıda.',
      'Image analysis is unavailable offline; the general field-safety list is below.',
    ),
  );
  bag.advice.push(
    L(
      c,
      'Dur, nefes al, çevreyi 360° tara: nereden geldin, nereye gidiyorsun, en yakın güvenli yer neresi?',
      'Stop, breathe, scan 360°: where did you come from, where are you going, where is the nearest safe spot?',
    ),
    L(
      c,
      'Grup halindeysen herkesi say, en zayıf kişiye göre karar ver.',
      'If in a group, head-count and decide based on the weakest member.',
    ),
    L(
      c,
      'Su, gıda, katman ve pil durumunu kontrol et; dönüş saatini belirle.',
      'Check water, food, layers and battery; set a turnaround time.',
    ),
    L(
      c,
      'Şüphede kaldığında Zirtan AI sohbetinde durumu yazarak sor.',
      'If in doubt, describe the situation in the Zirtan AI chat.',
    ),
  );
  bag.avoid.push(
    L(
      c,
      'Tek başına ve haber vermeden rotadan ayrılma.',
      'Do not leave the route alone without telling anyone.',
    ),
  );
  pushAction(bag, plannerAction(c));
  pushAction(bag, hazardsAction(c));
}

const BASE_RISK: Record<VisionSituation, RiskLevel> = {
  terrain: 'moderate',
  weather: 'moderate',
  gear: 'low',
  injury: 'high',
  wildlife: 'moderate',
  plant: 'moderate',
  map: 'low',
  water: 'moderate',
  camp: 'low',
  other: 'low',
};

const BUILDERS: Record<VisionSituation, (c: Ctx, bag: Bag) => void> = {
  terrain: terrainAdvice,
  weather: weatherAdvice,
  gear: gearAdvice,
  injury: injuryAdvice,
  wildlife: wildlifeAdvice,
  plant: plantAdvice,
  map: mapAdvice,
  water: waterAdvice,
  camp: campAdvice,
  other: otherAdvice,
};

/**
 * Görüntü analizi olmadan, duruma / irtifaya / konuma / saate göre kontrol listesi üretir.
 * Gateway yapılandırılmamışken ya da ağ hatasında kullanılır (`source: 'local'`).
 */
export function localVisionAdvice(
  input: VisionRequest,
  kb: VisionKnowledge,
  now: Date = new Date(),
): VisionAdvice {
  const situation = isSituation(input.situation) ? input.situation : 'other';
  const altitudeM = kb.altitudeM ?? input.altitudeM;
  const c: Ctx = {
    tr: isTr(input.locale),
    locale: input.locale,
    folded: ` ${fold(input.question ?? '')} `,
    altitudeM,
    coords: input.coords,
    hour: now.getHours(),
    kb,
  };
  const bag: Bag = { observations: [], advice: [], avoid: [], actions: [] };

  BUILDERS[situation](c, bag);
  addCommon(c, bag, situation);

  // Risk: durum tabanı + soru anahtar kelimeleri + irtifa/tehlike yükseltmeleri
  let risk = maxRisk(BASE_RISK[situation], riskFromKeywords(input.question ?? ''));
  if (
    altitudeM !== null &&
    altitudeM >= ALTITUDE_HIGH_M &&
    (situation === 'terrain' || situation === 'weather' || situation === 'injury')
  )
    risk = bumpRisk(risk);
  if (c.coords) {
    const critical = kb.hazards.some(
      (h) =>
        h.status === 'active' &&
        (h.severity === 'high' || h.severity === 'critical') &&
        distanceKm(c.coords!, h.coords) <= h.radiusM / 1000 + 2,
    );
    if (critical) risk = bumpRisk(risk);
  }

  // Güven: 0,3–0,5 arası; bağlam arttıkça artar
  let confidence = 0.3;
  if (input.coords) confidence += 0.05;
  if (altitudeM !== null) confidence += 0.05;
  if (input.question && input.question.trim().length > 0) confidence += 0.05;
  if (input.imageBase64 || input.imageUri) confidence += 0.05;
  confidence = Math.min(0.5, confidence);

  return {
    id: `vis_${now.getTime().toString(36)}_${situation}`,
    situation,
    observations: bag.observations,
    risk,
    advice: bag.advice,
    avoid: bag.avoid,
    actions: sanitizeVisionActions(bag.actions),
    source: 'local',
    confidence,
    createdAt: now.toISOString(),
  };
}
