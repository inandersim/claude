import type { AvalancheBulletin, AvalancheLevel } from '@/domain';
import { eawsRegionFor } from '@/domain';

/* ------------------------------------------------------------------ */
/* EAWS / avalanche.report — CAAML v6 JSON bülteni                      */
/* Lisans: CC BY 4.0 — https://avalanche.report                         */
/* ------------------------------------------------------------------ */

export const EAWS_TIMEOUT_MS = 8_000;
export const EAWS_PORTAL_URL = 'https://avalanche.report';

/** CAAML v6 JSON'un kullandığımız alt kümesi. */
export interface CaamlElevation {
  lowerBound?: string | number;
  upperBound?: string | number;
}

export interface CaamlDangerRating {
  mainValue?: string;
  elevation?: CaamlElevation;
  validTimePeriod?: string;
}

export interface CaamlProblem {
  problemType?: string;
  elevation?: CaamlElevation;
  aspects?: string[];
  validTimePeriod?: string;
}

export interface CaamlBulletin {
  bulletinID?: string;
  lang?: string;
  publicationTime?: string;
  validTime?: { startTime?: string; endTime?: string };
  regions?: { regionID?: string; name?: string }[];
  dangerRatings?: CaamlDangerRating[];
  avalancheProblems?: CaamlProblem[];
  highlights?: string;
  avalancheActivity?: { highlights?: string; comment?: string };
  snowpackStructure?: { highlights?: string; comment?: string };
}

export interface CaamlDocument {
  bulletins?: CaamlBulletin[];
}

const DANGER_VALUE: Record<string, AvalancheLevel> = {
  low: 1,
  moderate: 2,
  considerable: 3,
  high: 4,
  very_high: 5,
  'very high': 5,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
};

/** CAAML tehlike değerini 1–5'e çevirir; bilinmeyen → null. */
export function parseDangerValue(value: string | undefined): AvalancheLevel | null {
  if (!value) return null;
  return DANGER_VALUE[value.trim().toLowerCase()] ?? null;
}

function toElevation(value: string | number | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Bültenin bölge kodu/adı eşleşiyor mu (prefix eşleşmesi). */
function bulletinMatches(b: CaamlBulletin, regionCode: string): boolean {
  const needle = regionCode.toUpperCase();
  return (b.regions ?? []).some((r) => {
    const id = (r.regionID ?? '').toUpperCase();
    return id === needle || id.startsWith(`${needle}-`) || needle.startsWith(id);
  });
}

/**
 * CAAML v6 dokümanını `AvalancheBulletin`'e indirger. Bölge kodu ile eşleşen bülten
 * seçilir (yoksa ilk bülten). Saf fonksiyon; bülten yoksa null.
 *
 * Tehlike seviyesi: alt bant (üst sınırı olan / sınırsız) → `dangerLevel`;
 * alt sınırı olan bant → `dangerAbove`. Tek bant varsa `dangerAbove` null.
 */
export function parseCaaml(
  json: CaamlDocument,
  regionCode: string,
  regionName?: string,
): AvalancheBulletin | null {
  const bulletins = json.bulletins ?? [];
  if (bulletins.length === 0) return null;
  const chosen = bulletins.find((b) => bulletinMatches(b, regionCode)) ?? bulletins[0]!;

  const ratings = (chosen.dangerRatings ?? [])
    .map((r) => ({
      level: parseDangerValue(r.mainValue),
      lower: toElevation(r.elevation?.lowerBound),
      upper: toElevation(r.elevation?.upperBound),
    }))
    .filter(
      (r): r is { level: AvalancheLevel; lower: number | null; upper: number | null } =>
        r.level != null,
    );
  if (ratings.length === 0) return null;

  const lowerBand = ratings.find((r) => r.lower == null);
  const upperBand = ratings
    .filter((r) => r.lower != null)
    .sort((a, b) => (b.level as number) - (a.level as number))[0];

  const dangerLevel: AvalancheLevel =
    lowerBand?.level ?? (Math.min(...ratings.map((r) => r.level)) as AvalancheLevel);
  const dangerAbove =
    upperBand && upperBand.lower != null && upperBand.level !== dangerLevel
      ? { elevationM: upperBand.lower, level: upperBand.level }
      : null;

  const problems = Array.from(
    new Set(
      (chosen.avalancheProblems ?? [])
        .map((p) => (p.problemType ?? '').trim())
        .filter((p) => p.length > 0),
    ),
  );

  const summary = [
    chosen.highlights,
    chosen.avalancheActivity?.highlights !== chosen.highlights
      ? chosen.avalancheActivity?.highlights
      : null,
    chosen.avalancheActivity?.comment,
  ]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' ')
    .trim();

  const firstRegion = chosen.regions?.[0];
  const validFrom =
    chosen.validTime?.startTime ?? chosen.publicationTime ?? new Date(0).toISOString();
  const validTo =
    chosen.validTime?.endTime ?? new Date(new Date(validFrom).getTime() + 86_400_000).toISOString();

  return {
    regionCode,
    regionName: regionName ?? firstRegion?.name ?? regionCode,
    validFrom: new Date(validFrom).toISOString(),
    validTo: new Date(validTo).toISOString(),
    dangerLevel,
    dangerAbove,
    problems,
    summary,
    source: 'eaws',
    url: chosen.bulletinID
      ? `${EAWS_PORTAL_URL}/bulletin/latest?region=${encodeURIComponent(firstRegion?.regionID ?? '')}`
      : EAWS_PORTAL_URL,
  };
}

/**
 * EAWS bültenini indirir. Yalnızca CAAML uç noktası bilinen bölgeler (EUREGIO) için gerçek
 * istek atılır; diğer resmi bölgeler için uç nokta yoksa hata fırlatılır (çağıran mock'a düşer).
 */
export async function fetchEawsBulletin(regionCode: string): Promise<AvalancheBulletin> {
  const region = findRegionByCode(regionCode);
  if (!region?.caamlUrl) throw new Error(`EAWS: ${regionCode} için CAAML uç noktası yok`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EAWS_TIMEOUT_MS);
  try {
    const res = await fetch(region.caamlUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`EAWS HTTP ${res.status}`);
    const json = (await res.json()) as CaamlDocument;
    const bulletin = parseCaaml(json, regionCode, region.name);
    if (!bulletin) throw new Error('EAWS: bülten ayrıştırılamadı');
    return { ...bulletin, url: bulletin.url ?? region.url };
  } finally {
    clearTimeout(timer);
  }
}

/** Bölge kodundan bölge meta verisi (kaba kutu merkezleri üzerinden). */
function findRegionByCode(code: string) {
  // Kutuları domain'de tutuyoruz; kod → bölge için temsilci koordinatlar
  const probes: Record<string, { latitude: number; longitude: number }> = {
    EUREGIO: { latitude: 46.8, longitude: 11.3 },
    AT: { latitude: 47.3, longitude: 13.5 },
    CH: { latitude: 46.6, longitude: 8.0 },
    IT: { latitude: 45.5, longitude: 7.5 },
    FR: { latitude: 45.2, longitude: 6.3 },
    DE: { latitude: 47.5, longitude: 11.0 },
    SI: { latitude: 46.3, longitude: 14.0 },
    PYR: { latitude: 42.7, longitude: 1.0 },
    NO: { latitude: 61.0, longitude: 8.0 },
    SCT: { latitude: 57.0, longitude: -4.0 },
    IS: { latitude: 65.0, longitude: -18.0 },
    'TR-unofficial': { latitude: 39.0, longitude: 35.0 },
  };
  const probe = probes[code];
  return probe ? eawsRegionFor(probe) : null;
}
