import type { DangerLevel, DeterrentAnimal, DeterrentSound, SpeciesGroup } from './enums';
import { DANGER_LEVELS, DETERRENT_ANIMALS, DETERRENT_SOUNDS } from './enums';
import { countryFromCoords } from './satellite';
import type {
  DeterrentProfile,
  GeoPoint,
  Species,
  SpeciesFilter,
  SpeciesIdentification,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

export const WILDLIFE_MODULE = 'wildlife';

/** Yerel tanımlamada üretilen en fazla aday. */
export const IDENTIFY_MAX_CANDIDATES = 5;
/** Yerel tanımlama güven aralığı (uzak model daha kesin konuşabilir). */
export const LOCAL_CONFIDENCE_MIN = 0.2;
export const LOCAL_CONFIDENCE_MAX = 0.6;
/** Kullanıcı başına tutulan tanımlama geçmişi. */
export const IDENTIFICATION_HISTORY_LIMIT = 30;

const DANGER_RANK: Record<DangerLevel, number> = {
  harmless: 0,
  caution: 1,
  dangerous: 2,
  deadly: 3,
};

/** Tehlike düzeyinin sıralama ağırlığı (deadly en yüksek). */
export function dangerRank(level: DangerLevel): number {
  return DANGER_RANK[level];
}

export function isDangerLevel(value: unknown): value is DangerLevel {
  return typeof value === 'string' && (DANGER_LEVELS as readonly string[]).includes(value);
}

export function isDeterrentAnimal(value: unknown): value is DeterrentAnimal {
  return typeof value === 'string' && (DETERRENT_ANIMALS as readonly string[]).includes(value);
}

export function isDeterrentSound(value: unknown): value is DeterrentSound {
  return typeof value === 'string' && (DETERRENT_SOUNDS as readonly string[]).includes(value);
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
  İ: 'i',
  Ğ: 'g',
  Ş: 's',
  Ç: 'c',
  Ö: 'o',
  Ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** Türkçe karakterleri sadeleştirir, küçük harfe çevirir, boşlukları tekler. */
export function foldWildlifeText(text: string): string {
  return text
    .replace(/[ığşçöüİĞŞÇÖÜâîû]/g, (ch) => FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(folded: string, words: readonly string[]): boolean {
  return words.some((w) => folded.includes(foldWildlifeText(w)));
}

/* ------------------------------------------------------------------ */
/* Tehlike / grup meta                                                  */
/* ------------------------------------------------------------------ */

export interface DangerMeta {
  level: DangerLevel;
  /** Tema paleti anahtarı */
  colorKey: 'success' | 'info' | 'warning' | 'danger';
  icon: string;
  labelKey: `wildlife.danger.${DangerLevel}`;
  rank: number;
}

/** Tehlike düzeyinin rengi, ikonu ve çeviri anahtarı. */
export function dangerMeta(level: DangerLevel): DangerMeta {
  switch (level) {
    case 'harmless':
      return {
        level,
        colorKey: 'success',
        icon: 'circle-check',
        labelKey: 'wildlife.danger.harmless',
        rank: 0,
      };
    case 'caution':
      return {
        level,
        colorKey: 'info',
        icon: 'circle-alert',
        labelKey: 'wildlife.danger.caution',
        rank: 1,
      };
    case 'dangerous':
      return {
        level,
        colorKey: 'warning',
        icon: 'triangle-alert',
        labelKey: 'wildlife.danger.dangerous',
        rank: 2,
      };
    case 'deadly':
      return {
        level,
        colorKey: 'danger',
        icon: 'shield-alert',
        labelKey: 'wildlife.danger.deadly',
        rank: 3,
      };
  }
}

/** Tür grubunun ikon adı (mevcut ikon kayıtlarından). */
export function groupIcon(group: SpeciesGroup): string {
  switch (group) {
    case 'snake':
      return 'activity';
    case 'mammal':
      return 'paw-print';
    case 'insect':
      return 'bug';
    case 'arachnid':
      return 'bug';
    case 'marine':
      return 'fish';
    case 'bird':
      return 'bird';
    case 'plant':
      return 'tree-pine';
    case 'fungus':
      return 'hexagon';
  }
}

/** Grup emojisi (kart ve liste görselleri için). */
export function groupEmoji(group: SpeciesGroup): string {
  switch (group) {
    case 'snake':
      return '🐍';
    case 'mammal':
      return '🐾';
    case 'insect':
      return '🐝';
    case 'arachnid':
      return '🕷️';
    case 'marine':
      return '🪼';
    case 'bird':
      return '🦅';
    case 'plant':
      return '🌿';
    case 'fungus':
      return '🍄';
  }
}

/* ------------------------------------------------------------------ */
/* Filtreleme                                                           */
/* ------------------------------------------------------------------ */

function speciesHaystack(s: Species): string {
  return foldWildlifeText(
    [
      s.commonName,
      s.scientificName,
      s.description,
      ...s.identification,
      ...s.lookalikes,
      ...s.habitats,
    ].join(' '),
  );
}

/** Ad/latince/açıklama araması + grup + tehlike + ülke filtresi; tehlikeliler önce. */
export function filterSpecies(list: Species[], filter: SpeciesFilter = {}): Species[] {
  const q = foldWildlifeText(filter.query ?? '');
  const tokens = q.split(' ').filter((t) => t.length > 1);
  return list
    .filter((s) => {
      if (filter.group && s.group !== filter.group) return false;
      if (filter.danger && s.danger !== filter.danger) return false;
      if (filter.countryCode && !s.countryCodes.includes(filter.countryCode.toUpperCase()))
        return false;
      if (tokens.length === 0) return true;
      const hay = speciesHaystack(s);
      return tokens.every((tok) => hay.includes(tok));
    })
    .sort(
      (a, b) =>
        dangerRank(b.danger) - dangerRank(a.danger) ||
        a.commonName.localeCompare(b.commonName, 'tr'),
    );
}

/** Bir ülkede görülen türler; tehlikeliler önce. */
export function speciesForCountry(list: Species[], code: string | null | undefined): Species[] {
  if (!code) return [...list].sort((a, b) => dangerRank(b.danger) - dangerRank(a.danger));
  return filterSpecies(list, { countryCode: code });
}

/* ------------------------------------------------------------------ */
/* Ülke tahmini (koordinattan)                                          */
/* ------------------------------------------------------------------ */

interface CountryBox {
  code: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Uydu modülündeki kutulara ek olarak yaban hayatı için önemli bölgeler. */
const EXTRA_COUNTRY_BOXES: CountryBox[] = [
  { code: 'NP', minLat: 26.3, maxLat: 30.5, minLon: 80, maxLon: 88.3 },
  { code: 'IN', minLat: 6.5, maxLat: 35.5, minLon: 68, maxLon: 97.5 },
  { code: 'BR', minLat: -33.8, maxLat: 5.3, minLon: -74, maxLon: -34.7 },
  { code: 'GE', minLat: 41, maxLat: 43.6, minLon: 40, maxLon: 46.8 },
  { code: 'KE', minLat: -4.7, maxLat: 5.1, minLon: 33.9, maxLon: 41.9 },
  { code: 'TZ', minLat: -11.8, maxLat: -1, minLon: 29.3, maxLon: 40.5 },
  { code: 'ZA', minLat: -34.9, maxLat: -22.1, minLon: 16.4, maxLon: 32.9 },
  { code: 'TH', minLat: 5.6, maxLat: 20.5, minLon: 97.3, maxLon: 105.7 },
  { code: 'ID', minLat: -11, maxLat: 6, minLon: 95, maxLon: 141 },
  { code: 'MX', minLat: 14.5, maxLat: 32.7, minLon: -118.4, maxLon: -86.7 },
];

/** Koordinattan ülke kodu (önce yaban hayatı kutuları, sonra uydu modülü). */
export function wildlifeCountryFromCoords(coords: GeoPoint | null): string | null {
  if (!coords) return null;
  const extra = EXTRA_COUNTRY_BOXES.find(
    (b) =>
      coords.latitude >= b.minLat &&
      coords.latitude <= b.maxLat &&
      coords.longitude >= b.minLon &&
      coords.longitude <= b.maxLon,
  );
  if (extra) return extra.code;
  const base = countryFromCoords(coords);
  // Uydu modülü Avrupa'yı "EU" olarak toplar; tür veritabanında ülke kodu bekleniyor.
  return base === 'EU' ? null : base;
}

/* ------------------------------------------------------------------ */
/* Yerel tanımlama (anahtar kelime tabanlı)                             */
/* ------------------------------------------------------------------ */

export type IdentificationCandidate = SpeciesIdentification['candidates'][number];

export interface LocalIdentification {
  candidates: IdentificationCandidate[];
  advice: string[];
  source: 'local';
}

/** Genus listesi: engerekgiller ve çukur engerekler. */
const VIPER_GENERA = [
  'vipera',
  'montivipera',
  'macrovipera',
  'daboia',
  'crotalus',
  'bothrops',
  'echis',
];

interface KeywordRule {
  words: string[];
  /** Kural eşleşince hangi türlere puan verilir */
  match: (s: Species) => boolean;
  weight: number;
}

function genusOf(s: Species): string {
  return foldWildlifeText(s.scientificName).split(' ')[0] ?? '';
}

const KEYWORD_RULES: KeywordRule[] = [
  // Engerek işaretleri
  {
    words: [
      'zigzag',
      'zig zag',
      'ucgen kafa',
      'üçgen kafa',
      'triangular head',
      'dikey pupil',
      'vertical pupil',
      'kalin govde',
      'kalın gövde',
      'boynuz',
      'horn',
      'engerek',
      'viper',
      'kisa kuyruk',
      'kısa kuyruk',
    ],
    match: (s) => VIPER_GENERA.includes(genusOf(s)),
    weight: 4,
  },
  {
    words: ['cingirak', 'çıngırak', 'rattle'],
    match: (s) => genusOf(s) === 'crotalus',
    weight: 5,
  },
  {
    words: ['kukuleta', 'baslik', 'başlık', 'hood', 'kobra', 'cobra'],
    match: (s) => genusOf(s) === 'naja',
    weight: 5,
  },
  {
    words: [
      'siyah uzun',
      'siyah ince',
      'uzun siyah',
      'black long',
      'long black',
      'kara yilan',
      'kara yılan',
      'hizli kacti',
      'hızlı kaçtı',
    ],
    match: (s) => genusOf(s) === 'dolichophis',
    weight: 4,
  },
  {
    words: ['halka', 'band', 'bantli', 'bantlı', 'siyah beyaz', 'siyah sari', 'siyah sarı'],
    match: (s) => genusOf(s) === 'bungarus' || genusOf(s) === 'pseudonaja',
    weight: 3,
  },
  {
    words: [
      'suda',
      'derede',
      'gol',
      'göl',
      'su kenari',
      'su kenarı',
      'in water',
      'yuzuyor',
      'yüzüyor',
    ],
    match: (s) =>
      genusOf(s) === 'natrix' || s.habitats.some((h) => foldWildlifeText(h).includes('su')),
    weight: 3,
  },
  {
    words: ['kum', 'sand', 'kisa', 'kısa', 'kalin kisa', 'boa'],
    match: (s) => genusOf(s) === 'eryx',
    weight: 3,
  },
  // Memeliler
  {
    words: [
      'kahverengi buyuk',
      'kahverengi büyük',
      'buyuk memeli',
      'büyük memeli',
      'ayi',
      'ayı',
      'bear',
      'iri govde',
      'iri gövde',
      'kambur',
    ],
    match: (s) => genusOf(s) === 'ursus',
    weight: 5,
  },
  {
    words: ['boz', 'grizzly', 'kahverengi ayi', 'kahverengi ayı', 'brown bear'],
    match: (s) => foldWildlifeText(s.scientificName).includes('arctos'),
    weight: 2,
  },
  {
    words: ['siyah ayi', 'siyah ayı', 'black bear'],
    match: (s) => foldWildlifeText(s.scientificName).includes('americanus'),
    weight: 3,
  },
  {
    words: ['kurt', 'wolf', 'suru', 'sürü', 'uluma', 'howl'],
    match: (s) => genusOf(s) === 'canis' && foldWildlifeText(s.scientificName).includes('lupus'),
    weight: 5,
  },
  {
    words: ['cakal', 'çakal', 'jackal'],
    match: (s) => genusOf(s) === 'canis' && foldWildlifeText(s.scientificName).includes('aureus'),
    weight: 5,
  },
  {
    words: ['domuz', 'boar', 'yaban domuzu', 'yavrulu domuz', 'dis', 'diş', 'tusk'],
    match: (s) => genusOf(s) === 'sus',
    weight: 5,
  },
  {
    words: ['tilki', 'fox', 'kizil', 'kızıl', 'kabarik kuyruk', 'kabarık kuyruk'],
    match: (s) => genusOf(s) === 'vulpes',
    weight: 4,
  },
  {
    words: ['vasak', 'vaşak', 'lynx', 'kulak pusku', 'kulak püskü', 'kedi'],
    match: (s) => genusOf(s) === 'lynx',
    weight: 4,
  },
  // Eklembacaklılar
  {
    words: ['akrep', 'scorpion', 'kiskac', 'kıskaç', 'igneli kuyruk', 'iğneli kuyruk'],
    match: (s) => genusOf(s) === 'androctonus' || genusOf(s) === 'mesobuthus',
    weight: 5,
  },
  {
    words: [
      'orumcek',
      'örümcek',
      'spider',
      'kirmizi kum saati',
      'kırmızı kum saati',
      'karadul',
      'widow',
    ],
    match: (s) => genusOf(s) === 'latrodectus',
    weight: 5,
  },
  {
    words: ['ciyan', 'çıyan', 'centipede', 'cok bacakli', 'çok bacaklı', 'sarikiz', 'sarıkız'],
    match: (s) => genusOf(s) === 'scolopendra',
    weight: 5,
  },
  {
    words: ['kene', 'tick', 'deriye yapismis', 'deriye yapışmış', 'yapisik', 'yapışık'],
    match: (s) => genusOf(s) === 'hyalomma',
    weight: 5,
  },
  {
    words: [
      'ari',
      'arı',
      'bee',
      'esek arisi',
      'eşek arısı',
      'wasp',
      'hornet',
      'sari siyah',
      'sarı siyah',
      'vizildayan',
      'vızıldayan',
    ],
    match: (s) => genusOf(s) === 'apis' || genusOf(s) === 'vespa',
    weight: 4,
  },
  {
    words: ['sivrisinek', 'mosquito', 'sinek'],
    match: (s) => genusOf(s) === 'anopheles',
    weight: 5,
  },
  // Deniz
  {
    words: ['denizanasi', 'denizanası', 'jellyfish', 'saydam', 'jelly'],
    match: (s) => genusOf(s) === 'pelagia',
    weight: 5,
  },
  {
    words: ['trakonya', 'weever', 'kuma gomulu', 'kuma gömülü', 'dikenli balik', 'dikenli balık'],
    match: (s) => genusOf(s) === 'trachinus',
    weight: 5,
  },
  {
    words: ['vatoz', 'stingray', 'ray', 'yassi', 'yassı'],
    match: (s) => genusOf(s) === 'dasyatis',
    weight: 5,
  },
  {
    words: ['ahtapot', 'octopus', 'mavi halkali', 'mavi halkalı', 'murekkep', 'mürekkep'],
    match: (s) => genusOf(s) === 'hapalochlaena',
    weight: 5,
  },
  {
    words: ['tasbaligi', 'taşbalığı', 'stonefish', 'tasa benziyor', 'taşa benziyor'],
    match: (s) => genusOf(s) === 'synanceia',
    weight: 5,
  },
  {
    words: ['kopekbaligi', 'köpekbalığı', 'shark', 'yuzgec', 'yüzgeç'],
    match: (s) => genusOf(s) === 'carcharodon',
    weight: 5,
  },
  // Kuş / bitki / mantar
  {
    words: ['kartal', 'eagle', 'yirtici kus', 'yırtıcı kuş', 'kanat'],
    match: (s) => s.group === 'bird',
    weight: 4,
  },
  {
    words: ['isirgan', 'ısırgan', 'nettle', 'yakan yaprak', 'kasinti', 'kaşıntı'],
    match: (s) => genusOf(s) === 'urtica',
    weight: 5,
  },
  {
    words: ['sarmasik', 'sarmaşık', 'ivy', 'uc yaprak', 'üç yaprak', 'three leaves'],
    match: (s) => genusOf(s) === 'toxicodendron',
    weight: 5,
  },
  {
    words: [
      'baldiran',
      'baldıran',
      'hemlock',
      'beyaz semsiye',
      'beyaz şemsiye',
      'mor lekeli govde',
      'mor lekeli gövde',
    ],
    match: (s) => genusOf(s) === 'conium',
    weight: 5,
  },
  {
    words: ['deli bal', 'ormangulu', 'ormangülü', 'rhododendron', 'mad honey'],
    match: (s) => genusOf(s) === 'rhododendron',
    weight: 5,
  },
  {
    words: ['mantar', 'mushroom', 'sapka', 'şapka', 'lamel'],
    match: (s) => s.group === 'fungus',
    weight: 3,
  },
  {
    words: [
      'kirmizi sapka',
      'kırmızı şapka',
      'beyaz benek',
      'red cap',
      'white spots',
      'sinek mantari',
      'sinek mantarı',
    ],
    match: (s) => foldWildlifeText(s.scientificName).includes('muscaria'),
    weight: 4,
  },
  {
    words: [
      'yesilimsi sapka',
      'yeşilimsi şapka',
      'beyaz lamel',
      'olum',
      'ölüm',
      'death cap',
      'kose',
      'köse',
    ],
    match: (s) => foldWildlifeText(s.scientificName).includes('phalloides'),
    weight: 4,
  },
  // Genel grup kelimeleri
  {
    words: ['yilan', 'yılan', 'snake', 'surungen', 'sürüngen'],
    match: (s) => s.group === 'snake',
    weight: 2,
  },
  {
    words: ['memeli', 'mammal', 'tuylu', 'tüylü', 'furry'],
    match: (s) => s.group === 'mammal',
    weight: 2,
  },
  {
    words: ['bocek', 'böcek', 'insect', 'kanatli', 'kanatlı'],
    match: (s) => s.group === 'insect',
    weight: 2,
  },
  {
    words: ['deniz', 'sea', 'plaj', 'beach', 'dalis', 'dalış'],
    match: (s) => s.group === 'marine',
    weight: 2,
  },
  {
    words: ['bitki', 'plant', 'yaprak', 'leaf', 'cicek', 'çiçek'],
    match: (s) => s.group === 'plant',
    weight: 2,
  },
];

/** Renk/desen kelimeleri: tür tanımlama maddelerinde geçiyorsa puan. */
const DESCRIPTOR_WORDS = [
  'siyah',
  'kahverengi',
  'gri',
  'sari',
  'sarı',
  'kirmizi',
  'kırmızı',
  'yesil',
  'yeşil',
  'beyaz',
  'turuncu',
  'mavi',
  'benek',
  'cizgi',
  'çizgi',
  'halka',
  'zigzag',
  'desen',
  'parlak',
  'mat',
  'kalin',
  'kalın',
  'ince',
  'uzun',
  'kisa',
  'kısa',
  'buyuk',
  'büyük',
  'kucuk',
  'küçük',
  'black',
  'brown',
  'grey',
  'gray',
  'yellow',
  'red',
  'green',
  'white',
  'orange',
  'blue',
  'spotted',
  'striped',
  'banded',
  'pattern',
  'thick',
  'thin',
  'long',
  'short',
  'large',
  'small',
];

const HABITAT_WORDS: { words: string[]; habitat: string[] }[] = [
  { words: ['kaya', 'kayalik', 'kayalık', 'rock', 'tas', 'taş'], habitat: ['kaya', 'taş'] },
  { words: ['orman', 'agac', 'ağaç', 'forest', 'wood'], habitat: ['orman'] },
  {
    words: ['cayir', 'çayır', 'ot', 'meadow', 'grass', 'tarla'],
    habitat: ['çayır', 'tarla', 'ot'],
  },
  { words: ['deniz', 'sahil', 'plaj', 'sea', 'beach', 'coast'], habitat: ['deniz', 'sahil'] },
  {
    words: ['dere', 'gol', 'göl', 'nehir', 'su', 'river', 'lake', 'stream'],
    habitat: ['su', 'dere', 'göl'],
  },
  { words: ['cadir', 'çadır', 'kamp', 'camp', 'tent'], habitat: ['kamp'] },
  { words: ['yayla', 'alpin', 'yuksek', 'yüksek', 'alpine', 'high'], habitat: ['yayla', 'alpin'] },
  {
    words: ['kum', 'col', 'çöl', 'desert', 'sand', 'bozkir', 'bozkır'],
    habitat: ['kum', 'çöl', 'bozkır', 'step'],
  },
  {
    words: ['koy', 'köy', 'ahir', 'ahır', 'village', 'suru', 'sürü', 'coban', 'çoban'],
    habitat: ['köy', 'sürü'],
  },
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Anahtar kelime + ülke + habitat + renk/desen eşleşmesiyle aday sıralaması.
 * Güven değeri 0.2–0.6 aralığındadır; kesin tanı iddiası taşımaz.
 */
export function localIdentify(
  description: string,
  coords: GeoPoint | null,
  list: Species[],
): LocalIdentification {
  const folded = foldWildlifeText(description);
  const country = wildlifeCountryFromCoords(coords);
  const scored = list.map((s) => {
    let score = 0;
    for (const rule of KEYWORD_RULES)
      if (hasAny(folded, rule.words) && rule.match(s)) score += rule.weight;
    const hay = speciesHaystack(s);
    for (const word of DESCRIPTOR_WORDS) {
      const w = foldWildlifeText(word);
      if (folded.includes(w) && hay.includes(w)) score += 0.75;
    }
    for (const h of HABITAT_WORDS)
      if (
        hasAny(folded, h.words) &&
        s.habitats.some((sh) => hasAny(foldWildlifeText(sh), h.habitat))
      )
        score += 1;
    if (country) score += s.countryCodes.includes(country) ? 1.5 : -2;
    // Doğrudan ad geçiyorsa güçlü işaret
    if (folded.includes(foldWildlifeText(s.commonName))) score += 6;
    if (folded.includes(foldWildlifeText(s.scientificName))) score += 8;
    return { species: s, score };
  });

  const positives = folded
    ? scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
    : [];
  let picked = positives.slice(0, IDENTIFY_MAX_CANDIDATES);
  if (picked.length === 0) {
    // Hiç ipucu yoksa: ülkedeki (ya da tümündeki) en tehlikeli türleri düşük güvenle öner
    picked = speciesForCountry(list, country)
      .slice(0, 3)
      .map((species) => ({ species, score: 0 }));
  }
  const top = picked[0]?.score ?? 0;
  const candidates: IdentificationCandidate[] = picked.map(({ species, score }) => {
    const ratio = top > 0 ? clamp01(score / Math.max(top, 8)) : 0;
    const confidence = LOCAL_CONFIDENCE_MIN + (LOCAL_CONFIDENCE_MAX - LOCAL_CONFIDENCE_MIN) * ratio;
    return {
      speciesId: species.id,
      name: species.commonName,
      confidence: Math.round(confidence * 100) / 100,
      danger: species.danger,
    };
  });

  const advice: string[] = [];
  const first = picked[0]?.species;
  if (!folded) advice.push('Renk, boy, desen ve bulunduğu yeri yazarsan tahmin iyileşir.');
  if (first) {
    const meta = dangerMeta(first.danger);
    if (meta.rank >= 2) advice.push('En olası aday tehlikeli: mesafeni koru, dokunma, yaklaşma.');
    advice.push(...first.encounterDo.slice(0, 3));
    if (first.firstAidSlug && meta.rank >= 1)
      advice.push('Isırık/sokma olduysa ilk yardım rehberine bak.');
  }
  advice.push('Bu çevrimdışı tahmindir; kesin tanı için topluluğa ya da uzmana sor.');
  return { candidates, advice: advice.slice(0, 8), source: 'local' };
}

/* ------------------------------------------------------------------ */
/* Gateway yanıtı → yerel tür eşleme                                    */
/* ------------------------------------------------------------------ */

export interface RemoteIdentification {
  candidates: IdentificationCandidate[];
  advice: string[];
  source: 'remote';
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
        .slice(0, max)
    : [];
}

/** Latince adı (genus + species) ya da yaygın adı yerel listeyle eşler. */
export function matchSpecies(
  list: Species[],
  scientificName: string | null | undefined,
  commonName: string | null | undefined,
): Species | null {
  const sci = foldWildlifeText(scientificName ?? '');
  if (sci) {
    const exact = list.find((s) => foldWildlifeText(s.scientificName) === sci);
    if (exact) return exact;
    const genusSpecies = sci.split(' ').slice(0, 2).join(' ');
    const partial = list.find(
      (s) =>
        foldWildlifeText(s.scientificName).startsWith(genusSpecies) && genusSpecies.includes(' '),
    );
    if (partial) return partial;
  }
  const common = foldWildlifeText(commonName ?? '');
  if (common) {
    const byName = list.find(
      (s) =>
        foldWildlifeText(s.commonName) === common ||
        common.includes(foldWildlifeText(s.commonName)) ||
        foldWildlifeText(s.commonName).includes(common),
    );
    if (byName) return byName;
    const byLookalike = list.find((s) => s.lookalikes.some((l) => foldWildlifeText(l) === common));
    if (byLookalike) return byLookalike;
  }
  return null;
}

/**
 * `POST /v1/species` yanıtını (`candidates[{name, scientificName, confidence, danger}]`, `advice[]`)
 * yerel tür kimlikleriyle eşler. Eşleşen türde yerel (küratörlü) tehlike düzeyi esas alınır.
 */
export function parseSpeciesResponse(json: unknown, list: Species[]): RemoteIdentification {
  const obj = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const rawCandidates = Array.isArray(obj.candidates) ? obj.candidates : [];
  const candidates: IdentificationCandidate[] = [];
  for (const raw of rawCandidates) {
    if (typeof raw !== 'object' || raw === null) continue;
    const c = raw as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    const scientificName = typeof c.scientificName === 'string' ? c.scientificName.trim() : '';
    if (!name && !scientificName) continue;
    const conf =
      typeof c.confidence === 'number' && Number.isFinite(c.confidence)
        ? clamp01(c.confidence)
        : 0.4;
    const local = matchSpecies(list, scientificName, name);
    const danger: DangerLevel = local
      ? local.danger
      : isDangerLevel(c.danger)
        ? c.danger
        : 'caution';
    candidates.push({
      speciesId: local?.id ?? null,
      name: local ? local.commonName : name || scientificName,
      confidence: Math.round(conf * 100) / 100,
      danger,
    });
    if (candidates.length >= IDENTIFY_MAX_CANDIDATES) break;
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return { candidates, advice: stringList(obj.advice, 10), source: 'remote' };
}

/* ------------------------------------------------------------------ */
/* Karşılaşma tavsiyesi ve aciliyet                                     */
/* ------------------------------------------------------------------ */

const GROUP_GENERIC_DO: Record<SpeciesGroup, string[]> = {
  snake: ['Hareketsiz kal, sonra yavaşça geri çekil.', 'Yolunu kes(me), geçmesine izin ver.'],
  mammal: ['Sakin ve büyük görün; ani hareket yapma.', 'Geri geri uzaklaş, sırtını dönme.'],
  insect: ['Sakin uzaklaş; kolunu sallama.', 'Alerji geçmişin varsa adrenalin kalemini hazır tut.'],
  arachnid: [
    'Ayakkabı ve uyku tulumunu silkeleyerek kontrol et.',
    'Dokunma; bir kapla üstünü kapatıp uzaklaştır.',
  ],
  marine: [
    'Sudan sakin çık; suda ayağını sürüyerek yürü.',
    'Yaralanmada sıcak su (40–45 °C) ile ağrıyı azalt.',
  ],
  bird: ['Yuvadan uzaklaş; kafanı koru.', 'Yavrulara dokunma.'],
  plant: ['Temas eden bölgeyi bol suyla yıka.', 'Bilinmeyen bitkiyi asla tatma.'],
  fungus: [
    'Yabani mantarı yeme; tanımlama görselle yapılmaz.',
    'Yenildiyse hemen 112 / zehir danışma: 114.',
  ],
};

/** Karşılaşma adımları: en acil olan ilk sırada; türün kendi yap-listesi + grup genel tavsiyeleri. */
export function encounterAdvice(species: Species): string[] {
  const steps: string[] = [];
  const rank = dangerRank(species.danger);
  if (rank >= 3)
    steps.push('HAYATİ TEHLİKE: yaklaşma, dokunma, uzaklaş; gerekirse 112 / uydu SOS.');
  else if (rank === 2) steps.push('Tehlikeli tür: mesafeni koru ve yolunu kes(me).');
  steps.push(...species.encounterDo);
  for (const generic of GROUP_GENERIC_DO[species.group])
    if (!steps.includes(generic)) steps.push(generic);
  if (!species.firstAidSlug) return steps.slice(0, 8);
  return [...steps.slice(0, 7), 'Isırık/sokma/temas olduysa ilk yardım rehberini aç.'];
}

export type QuestionUrgency = 'none' | 'watch' | 'urgent';

const URGENT_WORDS = [
  'isirdi',
  'ısırdı',
  'isirik',
  'ısırık',
  'soktu',
  'sokma',
  'bit me',
  'bitten',
  'stung',
  'sisti',
  'şişti',
  'sisiyor',
  'şişiyor',
  'nefes',
  'breath',
  'bayild',
  'bayıld',
  'baygin',
  'baygın',
  'unconscious',
  'kanama',
  'bleeding',
  'kustu',
  'kusuyor',
  'vomit',
  'uyusma',
  'uyuşma',
  'numb',
  'acil',
  'urgent',
  'yedi',
  'yedik',
  'ate it',
  'swallow',
  'yuttu',
  'zehirlen',
  'poison',
];

const WATCH_WORDS = [
  'su an',
  'şu an',
  'karsimda',
  'karşımda',
  'cadirin',
  'çadırın',
  'kampta',
  'yaklas',
  'yaklaş',
  'takip ediyor',
  'following',
  'right now',
  'next to',
  'yanimda',
  'yanımda',
  'cok yakin',
  'çok yakın',
];

/** Soru metni + (varsa) tür tahmininden aciliyet: ısırık/sokma/belirti → urgent; canlı karşılaşma → watch. */
export function questionUrgency(text: string, species: Species | null = null): QuestionUrgency {
  const folded = foldWildlifeText(text);
  const rank = species ? dangerRank(species.danger) : 0;
  if (hasAny(folded, URGENT_WORDS)) return 'urgent';
  if (hasAny(folded, WATCH_WORDS)) return rank >= 3 ? 'urgent' : 'watch';
  if (rank >= 3) return 'watch';
  return 'none';
}

/* ------------------------------------------------------------------ */
/* Kaçırma sesleri bilgi tabanı                                         */
/* ------------------------------------------------------------------ */

const EVIDENCE = 'Bilimsel kanıt sınırlı; ses garanti değil, mesafe ve davranış esastır.';

/** Hayvan başına ses/davranış profili; sesler etkinlik sırasına göre. */
export const DETERRENT_PROFILES: DeterrentProfile[] = [
  {
    animal: 'bear',
    sounds: [
      {
        sound: 'shout',
        effectiveness: 0.8,
        note: 'Yüksek, sakin ama güçlü insan sesi en etkili sinyal: "Hey ayı!"',
      },
      {
        sound: 'air_horn',
        effectiveness: 0.7,
        note: 'Hava kornası uzaktan farkındalık yaratır; yaklaşan ayıyı çoğu kez durdurur.',
      },
      {
        sound: 'metal_clang',
        effectiveness: 0.6,
        note: 'Tencere-tava metal sesi kamp alanında caydırıcı.',
      },
      {
        sound: 'clap',
        effectiveness: 0.4,
        note: 'El çırpma: yürüyüşte sürpriz karşılaşmayı önlemek için.',
      },
      {
        sound: 'whistle',
        effectiveness: 0.3,
        note: 'Zil/düdük tartışmalı: bazı çalışmalar ayıları meraklandırdığını gösteriyor.',
      },
    ],
    behaviorDo: [
      'Sakin konuş, ellerini kaldırarak büyük görün.',
      'Yavaşça, yan yan geri çekil; kaçış yolu bırak.',
      'Ayı spreyi varsa 8–10 m menzilde kullan.',
      'Yavru görürsen hemen ters yöne uzaklaş.',
      'Boz ayı saldırısında yüzüstü yat, ense-boynu koru (ölü taklidi).',
      'Kara ayı saldırısında karşı koy: yüz ve buruna vur.',
    ],
    behaviorDont: [
      'Asla koşma; ayı 50 km/s hıza ulaşır.',
      'Ağaca tırmanma; ayılar tırmanır.',
      'Göz teması ile meydan okuma.',
      'Yiyeceğini bırakıp teslim etme alışkanlığı yaratma.',
      'Ölü taklidini kara ayı ya da avcı davranışlı ayıda yapma.',
    ],
    warnings: [
      'Yavrulu dişi ve leş başındaki ayı en tehlikelisidir.',
      'Gece kampında yiyeceği çadırdan en az 100 m uzağa, asılı tut.',
      'Sonbaharda (hiperfaji) ayılar daha aktif ve cesurdur.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'wolf',
    sounds: [
      {
        sound: 'shout',
        effectiveness: 0.75,
        note: 'Bağırma ve kol sallama; kurt insan sesinden çekinir.',
      },
      { sound: 'air_horn', effectiveness: 0.65, note: 'Ani yüksek ses sürüyü duraklatır.' },
      { sound: 'metal_clang', effectiveness: 0.5, note: 'Metal ses kamp çevresinde caydırıcı.' },
      { sound: 'siren', effectiveness: 0.4, note: 'Siren yeni bir uyaran; kısa süre etkili.' },
    ],
    behaviorDo: [
      'Büyük görün, bağır, taş/dal at.',
      'Sürü ise sırtını bir kayaya/ağaca ver, geri çekil.',
      'Grup halindeyseniz bir arada durun.',
      'Ateş ya da baton varsa öne tut.',
    ],
    behaviorDont: [
      'Koşma ya da sırtını dönme.',
      'Yalnız kurdu köşeye sıkıştırma.',
      'Kurt yavrusuna yaklaşma.',
    ],
    warnings: [
      'Sağlıklı kurt insandan kaçınır; yaklaşan kurt kuduz ya da alışmış olabilir.',
      'Çoban köpekleri kurttan sık karıştırılır; sürü yakınında dikkat.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'boar',
    sounds: [
      { sound: 'clap', effectiveness: 0.6, note: 'Alkış ve gürültü; domuz genelde kaçar.' },
      { sound: 'shout', effectiveness: 0.6, note: 'Yüksek ses; sürüyü uzaklaştırır.' },
      {
        sound: 'air_horn',
        effectiveness: 0.55,
        note: 'Ani ses yavrulu dişiyi paniğe sokabilir; mesafede kullan.',
      },
      { sound: 'metal_clang', effectiveness: 0.45, note: 'Kamp çevresinde metal ses.' },
    ],
    behaviorDo: [
      'Ağaç ya da kaya arkasına geç; domuz dik tırmanamaz.',
      'Yavaşça geri çekil, yol ver.',
      'Yaralı domuza asla yaklaşma.',
    ],
    behaviorDont: [
      'Yavrulu dişinin yavruları ile arasına girme.',
      'Köşeye sıkıştırma.',
      'Koşarak kaçma (düz zeminde seni yakalar).',
    ],
    warnings: [
      'Şafak ve alacakaranlıkta en aktif.',
      'Diş yarası derin olur; kanamayı hemen kontrol et.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'dog',
    sounds: [
      { sound: 'shout', effectiveness: 0.7, note: 'Sert, düşük tonlu "Hayır!" komutu.' },
      { sound: 'air_horn', effectiveness: 0.55, note: 'Sürü köpeklerini duraklatır.' },
      {
        sound: 'ultrasonic',
        effectiveness: 0.5,
        note: '20 kHz köpek kulağını rahatsız eder; telefon hoparlörü sınırlıdır.',
      },
      { sound: 'whistle', effectiveness: 0.35, note: 'Düdük dikkat dağıtır.' },
    ],
    behaviorDo: [
      'Dur, yan dön, kollarını gövdene yakın tut.',
      'Göz temasından kaçın, yavaşça geri çekil.',
      'Bisikletteysen in, bisikleti aranıza koy.',
      'Batonu ya da çantayı öne siper et.',
      'Isırıkta yarayı 15 dk sabunlu suyla yıka; kuduz aşısı için sağlık kuruluşuna git.',
    ],
    behaviorDont: [
      'Koşma; kovalama refleksini tetikler.',
      'Çoban köpeğinin sürüsüne girme.',
      'Köpeğe vurma; sürü saldırıya geçer.',
    ],
    warnings: [
      'Çoban köpekleri (Kangal) sürüyü korur; sürüden uzak geç.',
      'Kuduz riski: her ısırık tıbbi değerlendirme gerektirir.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'snake',
    sounds: [
      {
        sound: 'stomp',
        effectiveness: 0.6,
        note: 'Yılan havadan ses duymaz; yere vurma titreşimi hisseder.',
      },
      {
        sound: 'clap',
        effectiveness: 0.15,
        note: 'Alkış çoğunlukla etkisizdir; yalnızca insanları uyarır.',
      },
    ],
    behaviorDo: [
      'Dur, mesafeni koru (en az 2 m), yavaşça geri çekil.',
      'Yere ayakla vur; titreşim yılanı uzaklaştırır.',
      'Isırıkta: sakin kal, uzvu hareketsiz ve kalp seviyesinde tut, 112.',
      'Isırık saatini ve yılanın görünümünü not et / fotoğrafla.',
    ],
    behaviorDont: [
      'Dokunma, öldürmeye çalışma (ısırıkların çoğu bu sırada olur).',
      'Yarayı kesme, emme, turnike uygulama, buz koyma.',
      '"Ölü" yılanın kafasına dokunma; refleksle ısırabilir.',
    ],
    warnings: [
      'Yaz gecelerinde ve ilkbaharda en aktif.',
      'Kayalık, odun yığını ve uzun otlarda adımını gör.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'jackal',
    sounds: [
      { sound: 'shout', effectiveness: 0.7, note: 'Çakal ürkektir; insan sesi yeter.' },
      { sound: 'clap', effectiveness: 0.6, note: 'Alkış ve gürültü.' },
      { sound: 'air_horn', effectiveness: 0.5, note: 'Kamp alanından uzaklaştırır.' },
    ],
    behaviorDo: [
      'Yiyeceği ve çöpü kapalı tut.',
      'Büyük görün, bağır.',
      'Kuduz şüphesinde ısırıkta hemen sağlık kuruluşu.',
    ],
    behaviorDont: ['Besleme.', 'Yavrulu inin yanına yaklaşma.'],
    warnings: ['Gece kamp çevresinde ulur; genelde tehlikesizdir.', 'Kuduz taşıyıcısı olabilir.'],
    evidence: EVIDENCE,
  },
  {
    animal: 'monkey',
    sounds: [
      { sound: 'clap', effectiveness: 0.5, note: 'Alkış ve sert ses gruplarını uzaklaştırır.' },
      { sound: 'shout', effectiveness: 0.45, note: 'Bağırma; gözlerini dikme.' },
      { sound: 'air_horn', effectiveness: 0.4, note: 'Ani ses; kısa süreli.' },
    ],
    behaviorDo: [
      'Gıdayı çantada ve görünmez tut.',
      'Göz temasından kaçın, dişlerini gösterme (gülümseme tehdit sayılır).',
      'Bir şey kaptıysa bırak; peşinden gitme.',
      'Isırık/tırmıkta yarayı yıka, kuduz ve tetanoz için sağlık kuruluşu.',
    ],
    behaviorDont: ['Besleme.', 'Yavrusuna dokunma.', 'Sırıtma ya da göz göze meydan okuma.'],
    warnings: ['Tapınak ve turistik alanlarda alışmış gruplar saldırgan olabilir.'],
    evidence: EVIDENCE,
  },
  {
    animal: 'elephant',
    sounds: [
      {
        sound: 'air_horn',
        effectiveness: 0.35,
        note: 'Yalnızca araçtan/uzaktan; yakın mesafede öfkelendirebilir.',
      },
      {
        sound: 'shout',
        effectiveness: 0.3,
        note: 'Sürüyü uzaklaştırmak için köylülerin kullandığı yöntem; risklidir.',
      },
      {
        sound: 'metal_clang',
        effectiveness: 0.25,
        note: 'Tarla koruma yöntemi; sahada güvenilir değil.',
      },
    ],
    behaviorDo: [
      'Asla yaklaşma; en az 100 m mesafe.',
      'Rüzgâr yönünü kontrol et; kokunu almasın.',
      'Sahte hücumda (kulaklar açık) sakin, yavaş geri çekil.',
      'Gerçek hücumda (kulaklar yatık, hortum kıvrık) zikzak koşup ağaç/araç arkasına geç.',
    ],
    behaviorDont: [
      'Yavrulu sürüye yaklaşma.',
      'Erkek fil (musth) görürsen bölgeyi terk et.',
      'Düz çizgide koşma.',
    ],
    warnings: [
      'Kulaklar geniş açık ve hortum sallanıyorsa sahte hücum; sessiz ve yatık kulak gerçek tehlike.',
    ],
    evidence: EVIDENCE,
  },
  {
    animal: 'big_cat',
    sounds: [
      {
        sound: 'shout',
        effectiveness: 0.7,
        note: 'Yüksek sesle bağır; kendini büyük ve tehlikeli göster.',
      },
      { sound: 'air_horn', effectiveness: 0.6, note: 'Ani yüksek ses puma/leoparı duraklatır.' },
      { sound: 'metal_clang', effectiveness: 0.4, note: 'Kamp çevresinde metal ses.' },
    ],
    behaviorDo: [
      'Büyük görün: ceket aç, kollarını kaldır.',
      'Göz temasını koru, geri geri git.',
      'Saldırıda karşı koy; taş, baton, çanta kullan.',
      'Çocukları kucağa al.',
    ],
    behaviorDont: [
      'Koşma, çömelme, sırtını dönme.',
      'Ölü taklidi yapma.',
      'Tek başına alacakaranlıkta koşuya çıkma.',
    ],
    warnings: ['Puma ve leopar arkadan, alçak profilde yaklaşır; şafak/alacakaranlıkta dikkat.'],
    evidence: EVIDENCE,
  },
];

/** Hayvanın profili (her hayvan için tanımlı). */
export function deterrentProfile(animal: DeterrentAnimal): DeterrentProfile {
  const profile = DETERRENT_PROFILES.find((p) => p.animal === animal);
  if (!profile) throw new Error(`Kaçırma profili yok: ${animal}`);
  return profile;
}

/** Hayvan emojisi (büyük ikonlu ızgara). */
export function animalEmoji(animal: DeterrentAnimal): string {
  switch (animal) {
    case 'bear':
      return '🐻';
    case 'wolf':
      return '🐺';
    case 'boar':
      return '🐗';
    case 'dog':
      return '🐕';
    case 'snake':
      return '🐍';
    case 'jackal':
      return '🦊';
    case 'monkey':
      return '🐒';
    case 'elephant':
      return '🐘';
    case 'big_cat':
      return '🐆';
  }
}

/** Hayvan ikonu (mevcut ikon kayıtlarından). */
export function animalIcon(animal: DeterrentAnimal): string {
  switch (animal) {
    case 'bear':
      return 'paw-print';
    case 'wolf':
      return 'footprints';
    case 'boar':
      return 'bone';
    case 'dog':
      return 'paw-print';
    case 'snake':
      return 'activity';
    case 'jackal':
      return 'moon';
    case 'monkey':
      return 'trees';
    case 'elephant':
      return 'mountain';
    case 'big_cat':
      return 'eye';
  }
}

/* ------------------------------------------------------------------ */
/* Ses meta ve çalma planı                                              */
/* ------------------------------------------------------------------ */

export interface SoundMeta {
  sound: DeterrentSound;
  labelKey: `wildlife.sound.${DeterrentSound}`;
  /** `assets/sounds/` altındaki dosya adı */
  file: string;
  durationS: number;
  icon: string;
  /** Telefon hoparlöründe fiziksel sınır varsa not anahtarı */
  limited: boolean;
}

const SOUND_META: Record<DeterrentSound, Omit<SoundMeta, 'sound' | 'labelKey'>> = {
  air_horn: { file: 'air_horn.wav', durationS: 3, icon: 'siren', limited: false },
  siren: { file: 'siren.wav', durationS: 4, icon: 'radio', limited: false },
  whistle: { file: 'whistle.wav', durationS: 2, icon: 'wind', limited: false },
  shout: { file: 'shout.wav', durationS: 2, icon: 'mic', limited: false },
  clap: { file: 'clap.wav', durationS: 2, icon: 'handshake', limited: false },
  metal_clang: { file: 'metal_clang.wav', durationS: 2, icon: 'hexagon', limited: false },
  ultrasonic: { file: 'ultrasonic.wav', durationS: 3, icon: 'signal', limited: true },
  stomp: { file: 'stomp.wav', durationS: 2, icon: 'footprints', limited: false },
};

/** Sesin adı (i18n anahtarı), dosya adı, süresi ve ikonu. */
export function soundMeta(sound: DeterrentSound): SoundMeta {
  return { sound, labelKey: `wildlife.sound.${sound}`, ...SOUND_META[sound] };
}

export interface PlayPlan {
  animal: DeterrentAnimal;
  /** Önerilen ses */
  sound: DeterrentSound;
  alternatives: DeterrentSound[];
  /** Tek seferde kaç saniye çalınır (döngü) */
  durationS: number;
  /** Otomatik tekrar sayısı; toplam ≈ durationS × repeat */
  repeat: number;
  loop: boolean;
  /** Titreşim döngüsü önerilir mi (yılan: evet — yere iletilen titreşim değil ama kullanıcı ritmi için) */
  vibrate: boolean;
  /** Fener yanıp sönmesi önerilir mi (gece memelileri) */
  flash: boolean;
  /** Yılan gibi sesi duymayan hayvanlar için not anahtarı */
  noteKey: 'wildlife.panic.noteSnake' | 'wildlife.panic.noteLimited' | 'wildlife.panic.noteGeneral';
}

/** Hayvana göre hangi ses, kaç saniye, tekrarlı mı; flaş/titreşim önerisi. */
export function playPlan(animal: DeterrentAnimal): PlayPlan {
  const profile = deterrentProfile(animal);
  const [primary, ...rest] = profile.sounds;
  const sound = primary?.sound ?? 'air_horn';
  const meta = soundMeta(sound);
  const nightMammal =
    animal === 'bear' ||
    animal === 'wolf' ||
    animal === 'boar' ||
    animal === 'big_cat' ||
    animal === 'jackal';
  const repeat = animal === 'snake' ? 5 : animal === 'elephant' ? 2 : 4;
  return {
    animal,
    sound,
    alternatives: rest.map((s) => s.sound),
    durationS: meta.durationS,
    repeat,
    loop: true,
    vibrate: true,
    flash: nightMammal || animal === 'dog',
    noteKey:
      animal === 'snake'
        ? 'wildlife.panic.noteSnake'
        : meta.limited
          ? 'wildlife.panic.noteLimited'
          : 'wildlife.panic.noteGeneral',
  };
}

/* ------------------------------------------------------------------ */
/* Çevrimiçi yardımcı tahmini (mock presence)                            */
/* ------------------------------------------------------------------ */

/** Saat başına taban değerler (04:00 en düşük, 20:00 en yüksek). */
const HOURLY_HELPERS = [
  24, 18, 14, 12, 12, 16, 26, 40, 56, 66, 74, 80, 84, 82, 80, 84, 92, 104, 116, 126, 130, 118, 84,
  48,
];

/** Saate göre 12–140 arası deterministik tahmin: saatler arası doğrusal geçiş; hafta sonu +%8. */
export function onlineHelperEstimate(now: Date | number = Date.now()): number {
  const d = typeof now === 'number' ? new Date(now) : now;
  const h = d.getHours();
  const frac = d.getMinutes() / 60;
  const a = HOURLY_HELPERS[h] ?? 40;
  const b = HOURLY_HELPERS[(h + 1) % 24] ?? 40;
  const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.08 : 1;
  const value = Math.round((a + (b - a) * frac) * weekend);
  return Math.min(140, Math.max(12, value));
}
