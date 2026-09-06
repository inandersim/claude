/**
 * OpenStreetMap yollarından yönlendirme (routing) grafı üretir.
 *
 * Çıktı `src/domain/types.ts` içindeki `TrailGraph` şekliyle birebir uyumludur:
 * `{ regionId, nodes: TrailNode[], edges: TrailEdge[] }`. Böylece uygulamadaki
 * A* rota planlayıcısı (`src/domain/maps.ts`) hiçbir dönüşüm olmadan tüketir.
 *
 * Veri kaynağı: OpenStreetMap (ODbL 1.0). Atıf zorunludur.
 */

/** Grafa dahil edilen yol türleri (Overpass filtresi). */
export const WAY_FILTERS = [
  'way["highway"~"^(path|track|footway|bridleway|steps|cycleway|unclassified|residential|service|tertiary|secondary)$"]',
  'way["route"="hiking"]',
  'way["highway"="via_ferrata"]',
];

/** OSM `surface`/`highway` etiketleri → uygulamanın `Surface` enum'u. */
const SURFACE_MAP = {
  asphalt: 'paved',
  paved: 'paved',
  concrete: 'paved',
  paving_stones: 'paved',
  sett: 'paved',
  cobblestone: 'paved',
  gravel: 'gravel',
  fine_gravel: 'gravel',
  compacted: 'gravel',
  pebblestone: 'gravel',
  unpaved: 'trail',
  ground: 'trail',
  dirt: 'trail',
  earth: 'trail',
  grass: 'trail',
  mud: 'trail',
  sand: 'trail',
  woodchips: 'trail',
  rock: 'rock',
  bare_rock: 'rock',
  stone: 'rock',
  scree: 'scree',
  shingle: 'scree',
  snow: 'snow',
  ice: 'snow',
};

/**
 * SAC ölçeği (İsviçre Alp Kulübü yürüyüş zorluğu) → teknik puan 0..1.
 * `technical` alanı A* maliyetinde ve profil erişiminde kullanılır.
 */
const SAC_TECHNICAL = {
  hiking: 0.05,
  mountain_hiking: 0.25,
  demanding_mountain_hiking: 0.45,
  alpine_hiking: 0.65,
  demanding_alpine_hiking: 0.85,
  difficult_alpine_hiking: 1,
};

/** Yol görünürlüğü → teknik puana eklenen pay. */
const VISIBILITY_PENALTY = {
  excellent: 0,
  good: 0.02,
  intermediate: 0.08,
  bad: 0.16,
  horrible: 0.26,
  no: 0.35,
};

/** Etiketlerden yüzey türetir. */
export function surfaceOf(tags = {}) {
  const direct = SURFACE_MAP[tags.surface];
  if (direct) return direct;
  if (tags.highway === 'via_ferrata') return 'rock';
  if (tags.highway === 'steps') return 'rock';
  if (SAC_TECHNICAL[tags.sac_scale] >= 0.65) return 'rock';
  if (tags.highway === 'track') return SURFACE_MAP[tags.tracktype === 'grade1' ? 'gravel' : 'ground'];
  if (['footway', 'path', 'bridleway'].includes(tags.highway)) return 'trail';
  if (['cycleway', 'unclassified', 'residential', 'service'].includes(tags.highway)) return 'gravel';
  if (['tertiary', 'secondary'].includes(tags.highway)) return 'paved';
  return 'trail';
}

/** Etiketlerden 0..1 teknik zorluk puanı. */
export function technicalOf(tags = {}) {
  let score = SAC_TECHNICAL[tags.sac_scale] ?? 0;
  if (!score) {
    if (tags.highway === 'via_ferrata') score = 0.95;
    else if (tags.highway === 'steps') score = 0.4;
    else if (tags.highway === 'path') score = 0.2;
    else if (tags.highway === 'track') score = 0.1;
    else score = 0.05;
  }
  score += VISIBILITY_PENALTY[tags.trail_visibility] ?? 0;
  if (tags.ladder === 'yes' || tags.via_ferrata_scale) score += 0.2;
  return Math.min(1, Number(score.toFixed(2)));
}

/**
 * Hangi rota profillerinin bu kenarı kullanabileceğini belirler.
 * `hike` neredeyse her yerde geçerli; tekerlekli profiller merdiven/kaya dışlar.
 */
export function profilesOf(tags = {}) {
  // Genel erişim yasağı her profili kapatır.
  if (tags.access === 'private' || tags.access === 'no') return [];

  const surface = surfaceOf(tags);
  const technical = technicalOf(tags);
  const isSteps = tags.highway === 'steps';
  const isFerrata = tags.highway === 'via_ferrata';
  const footAllowed = tags.foot !== 'no';
  // `foot=no` bisikleti kendiliğinden açmaz; ancak `bicycle=yes` açıkça verilmişse geçerlidir.
  const bikeAllowed =
    tags.bicycle !== 'no' &&
    (footAllowed || tags.bicycle === 'yes' || tags.bicycle === 'designated') &&
    !isSteps &&
    !isFerrata &&
    technical <= 0.5 &&
    surface !== 'scree';

  const profiles = [];
  if (footAllowed) profiles.push('hike');
  if (footAllowed && technical <= 0.5 && !isFerrata) profiles.push('trail_run');
  if (bikeAllowed && surface !== 'snow') profiles.push('mtb');
  if (bikeAllowed && ['gravel', 'paved'].includes(surface)) profiles.push('gravel');
  // Kayak turu: kar tutan, aşırı teknik olmayan patikalar ve açık araziler.
  if (footAllowed && technical <= 0.7 && !isSteps) profiles.push('ski_tour');
  return profiles;
}

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** İki nokta arası büyük daire mesafesi (km). */
export function distanceKm(a, b) {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Koordinatı ~1 m çözünürlüğe yuvarlayıp düğüm kimliği üretir (kavşak birleştirme). */
export function nodeKey(coords) {
  return `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
}

/**
 * Overpass `out geom` çıktısındaki yolları grafa çevirir.
 *
 * @param {{ type: string; id: number; tags?: Record<string,string>; geometry?: {lat:number;lon:number}[] }[]} elements
 * @param {{ regionId: string }} options
 * @returns {{ regionId: string; nodes: any[]; edges: any[] }}
 */
export function buildGraph(elements, { regionId }) {
  const nodeIndex = new Map(); // key → { id, coords, degree, name }
  const edges = [];
  let edgeSeq = 0;

  const ensureNode = (lat, lon, name) => {
    const coords = { latitude: lat, longitude: lon };
    const key = nodeKey(coords);
    let node = nodeIndex.get(key);
    if (!node) {
      node = { id: `n_${nodeIndex.size + 1}`, coords, elevationM: 0, name: name ?? null, degree: 0 };
      nodeIndex.set(key, node);
    } else if (!node.name && name) {
      node.name = name;
    }
    return node;
  };

  for (const el of elements) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    if (tags.area === 'yes') continue;
    const profiles = profilesOf(tags);
    if (profiles.length === 0) continue;

    const surface = surfaceOf(tags);
    const technical = technicalOf(tags);
    const name = tags.name ?? null;

    let prev = ensureNode(el.geometry[0].lat, el.geometry[0].lon, name);
    for (let i = 1; i < el.geometry.length; i += 1) {
      const g = el.geometry[i];
      const node = ensureNode(g.lat, g.lon, i === el.geometry.length - 1 ? name : null);
      if (node.id === prev.id) continue;
      const d = distanceKm(prev.coords, node.coords);
      if (d === 0) continue;
      edgeSeq += 1;
      edges.push({
        id: `e_${edgeSeq}`,
        from: prev.id,
        to: node.id,
        distanceKm: Number(d.toFixed(4)),
        surface,
        profiles,
        technical,
      });
      prev.degree += 1;
      node.degree += 1;
      prev = node;
    }
  }

  const nodes = [...nodeIndex.values()].map(({ degree, ...n }) => ({ ...n, degree }));
  return { regionId, nodes, edges };
}

/**
 * Derecesi 2 olan ara düğümleri kaldırıp kenarları birleştirir.
 * Kavşaklar, isimli düğümler ve yüzey/profil değişim noktaları korunur.
 * Graf boyutunu tipik olarak %60–80 küçültür; A* çok daha hızlı çalışır.
 */
export function simplifyGraph(graph) {
  const byNode = new Map();
  for (const e of graph.edges) {
    if (!byNode.has(e.from)) byNode.set(e.from, []);
    if (!byNode.has(e.to)) byNode.set(e.to, []);
    byNode.get(e.from).push(e);
    byNode.get(e.to).push(e);
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const removed = new Set();
  const edges = new Map(graph.edges.map((e) => [e.id, { ...e }]));

  const sameClass = (a, b) =>
    a.surface === b.surface &&
    a.technical === b.technical &&
    a.profiles.length === b.profiles.length &&
    a.profiles.every((p) => b.profiles.includes(p));

  for (const [nodeId, incident] of byNode) {
    const live = incident.filter((e) => edges.has(e.id));
    if (live.length !== 2) continue;
    const node = nodeById.get(nodeId);
    if (node?.name) continue;
    const [a, b] = live.map((e) => edges.get(e.id));
    if (!a || !b || a.id === b.id) continue;
    if (!sameClass(a, b)) continue;

    // a: … → nodeId, b: nodeId → … olacak şekilde uçları hizala.
    const aOther = a.from === nodeId ? a.to : a.from;
    const bOther = b.from === nodeId ? b.to : b.from;
    if (aOther === bOther) continue; // kendine dönen halka: dokunma

    edges.delete(b.id);
    a.from = aOther;
    a.to = bOther;
    a.distanceKm = Number((a.distanceKm + b.distanceKm).toFixed(4));
    removed.add(nodeId);

    // Komşuluk listesini güncelle ki zincirleme sadeleştirme sürsün.
    for (const key of [aOther, bOther]) {
      const list = byNode.get(key) ?? [];
      byNode.set(key, [...list.filter((e) => e.id !== b.id && e.id !== a.id), a]);
    }
  }

  const keptEdges = [...edges.values()];
  const used = new Set(keptEdges.flatMap((e) => [e.from, e.to]));
  const nodes = graph.nodes
    .filter((n) => used.has(n.id) && !removed.has(n.id))
    .map(({ degree, ...n }) => n);
  return { regionId: graph.regionId, nodes, edges: keptEdges };
}

/** Grafın tek parça olup olmadığını ve en büyük bileşeni raporlar. */
export function componentStats(graph) {
  const adj = new Map();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  }
  const seen = new Set();
  const sizes = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    let size = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop();
      size += 1;
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  sizes.sort((a, b) => b - a);
  return { components: sizes.length, largest: sizes[0] ?? 0, sizes: sizes.slice(0, 5) };
}

/** Yalnızca en büyük bağlı bileşeni tutar (kopuk ada patikaları rotayı bozar). */
export function largestComponent(graph) {
  const adj = new Map();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  }
  let best = new Set();
  const seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const comp = new Set([start]);
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop();
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          comp.add(next);
          stack.push(next);
        }
      }
    }
    if (comp.size > best.size) best = comp;
  }
  return {
    regionId: graph.regionId,
    nodes: graph.nodes.filter((n) => best.has(n.id)),
    edges: graph.edges.filter((e) => best.has(e.from) && best.has(e.to)),
  };
}
