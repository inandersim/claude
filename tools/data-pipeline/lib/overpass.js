import { KINDS, OVERPASS_ENDPOINTS } from './config.js';
import { fetchWithRetry } from './http.js';

/** Overpass QL sorgusu üretir. */
export function buildQuery(kinds, [s, w, n, e], timeout = 180) {
  const filters = kinds.flatMap((kind) => {
    const def = KINDS[kind];
    if (!def) throw new Error(`Bilinmeyen kategori: ${kind}`);
    return def.overpass.map((f) => `${f}(${s},${w},${n},${e});`);
  });
  return `[out:json][timeout:${timeout}][maxsize:536870912];\n(\n  ${filters.join('\n  ')}\n);\nout center tags qt;`;
}

/**
 * Bir karo için Overpass'tan öğeleri çeker; uç noktalar arasında sırayla dener.
 * @returns {Promise<any[]>}
 */
export async function fetchTile(
  kinds,
  bbox,
  { endpoints = OVERPASS_ENDPOINTS, fetchImpl = fetchWithRetry } = {},
) {
  const query = buildQuery(kinds, bbox);
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const json = await res.json();
      if (json.remark && /timed out|error/i.test(json.remark)) throw new Error(json.remark);
      return json.elements ?? [];
    } catch (error) {
      lastError = error;
      console.warn(`  ✗ ${endpoint}: ${error.message}`);
    }
  }
  throw lastError;
}

/** Bir OSM öğesinin hangi kategoriye girdiğini etiketlerinden belirler. */
export function detectKind(tags = {}) {
  if (tags.tourism === 'camp_site' || tags.tourism === 'caravan_site') return 'campsite';
  if (tags.sport === 'climbing' || tags.climbing) return 'climbing';
  if (tags.amenity === 'dive_centre' || tags.shop === 'scuba_diving') return 'dive_centre';
  if (tags.sport === 'scuba_diving' || tags.sport === 'diving') return 'diving';
  if (tags.route === 'hiking' || tags.route === 'foot') return 'hiking_route';
  if (tags.sport === 'rafting' || tags.whitewater) return 'rafting';
  if (tags.sport === 'canoe' || tags.sport === 'kayak' || tags.canoe) return 'canoe';
  if (tags.sport === 'paragliding' || tags.sport === 'free_flying' || tags.aeroway === 'launchpad')
    return 'paragliding';
  if (tags.sport === 'skiing' || tags.landuse === 'winter_sports' || tags['piste:type'])
    return 'ski';
  if (tags.natural === 'peak') return 'peak';
  if (tags.natural === 'cave_entrance') return 'cave';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (
    tags.tourism === 'alpine_hut' ||
    tags.tourism === 'wilderness_hut' ||
    tags.shelter_type === 'basic_hut'
  )
    return 'shelter';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'hospital';
  if (tags.emergency === 'ambulance_station') return 'ambulance';
  if (tags.emergency === 'mountain_rescue' || tags.emergency === 'water_rescue')
    return 'mountain_rescue';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  return null;
}
