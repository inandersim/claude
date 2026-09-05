import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* Yerel veri (şimdilik örnek JSON; ileride uygulama API'si)            */
/* ------------------------------------------------------------------ */

interface SamplePlace {
  id: string;
  name: string;
  kind: string;
  adventureTypes: string[];
  lat: number;
  lng: number;
  elevationM: number | null;
  countryCode: string;
  description: string | null;
}

interface SampleEmergency {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  locationName: string;
  phone: string | null;
  open24h: boolean;
}

// ESM: __dirname yok; import.meta.url'den türet.
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;
}

const PLACES: SamplePlace[] = loadJson<SamplePlace[]>('places.sample.json');
const EMERGENCY: SampleEmergency[] = loadJson<SampleEmergency[]>('emergency.sample.json');

/** Haversine (km). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

/* ------------------------------------------------------------------ */
/* Araç tanımları                                                       */
/* ------------------------------------------------------------------ */

/** Sıra sabit tutulur: araç listesi prompt önbelleğinin parçasıdır. */
export const tools: Anthropic.Tool[] = [
  {
    name: 'search_places',
    description:
      'Zirve kütüphanesinde yer arar (kamp alanı, rota, zirve, tırmanış, dalış, kayak…). ' +
      'Metin, macera türü ve konuma göre süzer; mesafe (km) ile döner. Kullanıcıya somut yer önerirken kullan.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Serbest metin (yer adı, bölge, anahtar kelime)' },
        adventure_type: {
          type: 'string',
          enum: [
            'hiking',
            'climbing',
            'diving',
            'skiing',
            'cycling',
            'paragliding',
            'rafting',
            'canoe',
          ],
          description: 'İsteğe bağlı macera türü filtresi',
        },
        near: {
          type: 'object',
          description: 'Yakınlık sıralaması için merkez',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
          required: ['latitude', 'longitude'],
        },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Varsayılan 5' },
      },
      required: [],
    },
  },
  {
    name: 'nearest_emergency',
    description:
      'Verilen konuma en yakın acil merkezleri (hastane, 112, dağ kurtarma, sahil güvenlik) döner. ' +
      'İlk yardım ya da güvenlik sorularında konum biliniyorsa çağır.',
    input_schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['hospital', 'ambulance', 'mountain_rescue', 'coast_guard', 'pharmacy', 'ranger'],
          },
        },
        limit: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'plan_route',
    description:
      'İki nokta arasında kabaca rota metriği verir (mesafe, tırmanış, süre tahmini). ' +
      'Gerçek rota motoru henüz bağlı değil; stub sonuç döner, bunu kullanıcıya belirt.',
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
          required: ['latitude', 'longitude'],
        },
        to: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
          required: ['latitude', 'longitude'],
        },
        profile: { type: 'string', enum: ['hike', 'trail_run', 'mtb', 'gravel', 'ski_tour'] },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'weather',
    description:
      'Konum için hava özeti (stub). Canlı servis bağlı değil; mevsimsel tipik değerler döner. Kullanıcıya tahminin kesin olmadığını söyle.',
    input_schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        elevation_m: { type: 'number', description: 'Yükseklik düzeltmesi için (isteğe bağlı)' },
        date: { type: 'string', description: 'YYYY-MM-DD (isteğe bağlı, varsayılan bugün)' },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Araç yürütme                                                         */
/* ------------------------------------------------------------------ */

type Coords = { latitude: number; longitude: number };

function isCoords(v: unknown): v is Coords {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Coords).latitude === 'number' &&
    typeof (v as Coords).longitude === 'number'
  );
}

function searchPlaces(input: Record<string, unknown>): unknown {
  const q = typeof input.query === 'string' ? fold(input.query.trim()) : '';
  const type = typeof input.adventure_type === 'string' ? input.adventure_type : null;
  const near = isCoords(input.near)
    ? { lat: input.near.latitude, lng: input.near.longitude }
    : null;
  const limit =
    typeof input.limit === 'number' ? Math.min(10, Math.max(1, Math.floor(input.limit))) : 5;
  const words = q.split(/\s+/).filter((w) => w.length >= 3);

  const scored = PLACES.filter((p) => !type || p.adventureTypes.includes(type))
    .map((p) => {
      const hay = fold(`${p.name} ${p.description ?? ''} ${p.kind}`);
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      const d = near ? distanceKm(near, p) : null;
      return { p, score, d };
    })
    .filter((x) => words.length === 0 || x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.d !== null && b.d !== null) return a.d - b.d;
      return a.p.name.localeCompare(b.p.name, 'tr');
    })
    .slice(0, limit);

  return {
    count: scored.length,
    places: scored.map(({ p, d }) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      adventureTypes: p.adventureTypes,
      elevationM: p.elevationM,
      countryCode: p.countryCode,
      description: p.description,
      distanceKm: d === null ? null : Math.round(d * 10) / 10,
      href: `/library/${p.id}`,
    })),
  };
}

function nearestEmergency(input: Record<string, unknown>): unknown {
  if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number')
    return { error: 'latitude/longitude gerekli' };
  const origin = { lat: input.latitude, lng: input.longitude };
  const types = Array.isArray(input.types)
    ? input.types.filter((t): t is string => typeof t === 'string')
    : null;
  const limit =
    typeof input.limit === 'number' ? Math.min(5, Math.max(1, Math.floor(input.limit))) : 3;
  const list = EMERGENCY.filter((c) => !types || types.length === 0 || types.includes(c.type))
    .map((c) => ({ c, d: distanceKm(origin, c) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ c, d }) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      locationName: c.locationName,
      phone: c.phone,
      open24h: c.open24h,
      distanceKm: Math.round(d * 10) / 10,
      etaMin: Math.max(3, Math.round((d * 1.4) / (50 / 60))),
    }));
  return { emergencyNumber: '112', centers: list, href: '/first-aid/contacts' };
}

function planRoute(input: Record<string, unknown>): unknown {
  if (!isCoords(input.from) || !isCoords(input.to))
    return { error: 'from/to koordinatları gerekli' };
  const profile = typeof input.profile === 'string' ? input.profile : 'hike';
  const straight = distanceKm(
    { lat: input.from.latitude, lng: input.from.longitude },
    { lat: input.to.latitude, lng: input.to.longitude },
  );
  // Kuş uçuşu × dolambaç katsayısı; profil hızları (km/s) ve tırmanış tahmini kaba stub.
  const factor = profile === 'gravel' ? 1.25 : profile === 'mtb' ? 1.35 : 1.45;
  const speed = { hike: 4, trail_run: 8, mtb: 14, gravel: 20, ski_tour: 3.5 }[profile] ?? 4;
  const distance = Math.round(straight * factor * 10) / 10;
  const ascent = Math.round(distance * (profile === 'ski_tour' ? 90 : 55));
  const durationMin = Math.round((distance / speed) * 60 + ascent / 10);
  return {
    stub: true,
    note: 'Gerçek rota motoru bağlı değil; tahmini değerler.',
    profile,
    distanceKm: distance,
    ascentM: ascent,
    durationMin,
    href: '/maps/planner',
  };
}

function weather(input: Record<string, unknown>): unknown {
  if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number')
    return { error: 'latitude/longitude gerekli' };
  const date =
    typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? new Date(input.date)
      : new Date();
  const month = date.getUTCMonth() + 1;
  const elevation = typeof input.elevation_m === 'number' ? input.elevation_m : 0;
  // Türkiye için kaba mevsimsel taban; her 1000 m için −6,5 °C.
  const base = [4, 5, 9, 14, 19, 24, 27, 27, 23, 17, 11, 6][month - 1] ?? 15;
  const temp = Math.round(base - (elevation / 1000) * 6.5);
  const windy = month >= 11 || month <= 3;
  return {
    stub: true,
    note: 'Canlı tahmin servisi bağlı değil; mevsimsel tipik değerler.',
    date: date.toISOString().slice(0, 10),
    tempC: { min: temp - 6, max: temp + 4 },
    windKmh: windy ? 35 : 18,
    precipitationChance: month >= 11 || month <= 4 ? 0.45 : 0.15,
    afternoonStormRisk: month >= 5 && month <= 9 ? 'moderate' : 'low',
    href: '/hazards',
  };
}

/** Araç çağrısını çalıştırır; sonuç `tool_result` içeriği olarak JSON metin döner. */
export async function executeTool(name: string, rawInput: unknown): Promise<string> {
  const input = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {}) as Record<
    string,
    unknown
  >;
  let result: unknown;
  switch (name) {
    case 'search_places':
      result = searchPlaces(input);
      break;
    case 'nearest_emergency':
      result = nearestEmergency(input);
      break;
    case 'plan_route':
      result = planRoute(input);
      break;
    case 'weather':
      result = weather(input);
      break;
    default:
      result = { error: `Bilinmeyen araç: ${name}` };
  }
  return JSON.stringify(result);
}
