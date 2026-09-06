/**
 * Graf düğümlerini yükseklik verisiyle zenginleştirir.
 *
 * Kaynak: Open-Meteo Elevation API (Copernicus DEM GLO-90, ücretsiz, anahtarsız).
 * Uygulamada da aynı sağlayıcı kullanılıyor (`src/data/external/openMeteo.ts`),
 * böylece cihazdaki ve sunucudaki yükseklikler tutarlı olur.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';
/** API tek istekte en çok 100 koordinat kabul eder. */
export const BATCH_SIZE = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Koordinat dizisini toplu olarak yüksekliğe çevirir.
 *
 * @param {{latitude:number;longitude:number}[]} points
 * @param {{ fetchImpl?: typeof fetch; delayMs?: number; onProgress?: (done:number,total:number)=>void }} [options]
 * @returns {Promise<number[]>} girdiyle aynı sıradaki metre cinsinden yükseklikler
 */
export async function fetchElevations(points, options = {}) {
  const { fetchImpl = fetch, delayMs = 250, onProgress } = options;
  const out = [];
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const url =
      `${ENDPOINT}?latitude=${batch.map((p) => p.latitude.toFixed(5)).join(',')}` +
      `&longitude=${batch.map((p) => p.longitude.toFixed(5)).join(',')}`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Yükseklik API'si ${res.status}`);
    const json = await res.json();
    const values = json.elevation;
    if (!Array.isArray(values) || values.length !== batch.length) {
      throw new Error(`Beklenmeyen yükseklik yanıtı: ${batch.length} istendi, ${values?.length} geldi`);
    }
    out.push(...values.map((v) => (typeof v === 'number' ? Math.round(v) : 0)));
    onProgress?.(Math.min(i + BATCH_SIZE, points.length), points.length);
    if (i + BATCH_SIZE < points.length && delayMs) await sleep(delayMs);
  }
  return out;
}

/**
 * Grafın düğümlerine yükseklik yazar (yerinde değil, yeni nesne döner).
 * Zaten yüksekliği olan düğümler `force` verilmedikçe atlanır.
 */
export async function enrichGraphElevation(graph, options = {}) {
  const { force = false, ...rest } = options;
  const targets = graph.nodes.filter((n) => force || !n.elevationM);
  if (targets.length === 0) return graph;
  const values = await fetchElevations(
    targets.map((n) => n.coords),
    rest,
  );
  const byId = new Map(targets.map((n, i) => [n.id, values[i]]));
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (byId.has(n.id) ? { ...n, elevationM: byId.get(n.id) } : n)),
  };
}

/**
 * Kenarlara yükseklik farkı ekler (tırmanış/iniş).
 * `TrailEdge` şemasını bozmamak için ayrı bir profil nesnesi döner;
 * A* zaten düğüm yüksekliklerinden hesaplıyor, bu yalnızca doğrulama içindir.
 */
export function elevationProfile(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let ascent = 0;
  let descent = 0;
  for (const e of graph.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const d = b.elevationM - a.elevationM;
    if (d > 0) ascent += d;
    else descent -= d;
  }
  const elevations = graph.nodes.map((n) => n.elevationM).filter((v) => Number.isFinite(v));
  return {
    ascentM: ascent,
    descentM: descent,
    minElevationM: elevations.length ? Math.min(...elevations) : 0,
    maxElevationM: elevations.length ? Math.max(...elevations) : 0,
  };
}
