import type { RouteProfile, Surface } from './enums';
import { distanceKm } from './geo';
import type {
  GeoPoint,
  ID,
  MapPack,
  PlannedRoute,
  TrailEdge,
  TrailGraph,
  TrailNode,
} from './types';

/* ------------------------------------------------------------------ */
/* Tipler                                                              */
/* ------------------------------------------------------------------ */

export type RouteDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

/** GPX'ten okunan tek bir iz noktası */
export interface GpxTrackPoint extends GeoPoint {
  elevationM: number | null;
}

export interface GpxTrack {
  name: string | null;
  points: GpxTrackPoint[];
}

/** SVG üzerinde bir nokta */
export interface SvgPoint {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* Profil kuralları                                                    */
/* ------------------------------------------------------------------ */

/** Profil başına teknik eşik (üstü yasak) — null: sınır yok */
const TECHNICAL_LIMIT: Record<RouteProfile, number | null> = {
  hike: null,
  trail_run: 0.85,
  mtb: 0.6,
  gravel: 0.6,
  ski_tour: null,
};

/**
 * Yüzey çarpanları (süre ile çarpılır). `Infinity` = yasak.
 * Tüm çarpanlar ≥ 1 tutulur; böylece A* sezgiseli (en yüksek hız) kabul edilebilir kalır.
 */
const SURFACE_FACTOR: Record<RouteProfile, Record<Surface, number>> = {
  hike: { trail: 1, gravel: 1, paved: 1, rock: 1.25, scree: 1.35, snow: 1.5 },
  trail_run: { trail: 1, gravel: 1, paved: 1.1, rock: 1.6, scree: 1.8, snow: 2.2 },
  mtb: { trail: 1, gravel: 1, paved: 1, rock: 2, scree: Infinity, snow: Infinity },
  gravel: { gravel: 1, paved: 1, trail: 1.6, rock: Infinity, scree: Infinity, snow: Infinity },
  ski_tour: { snow: 1, scree: 1.4, rock: 1.6, trail: Infinity, gravel: Infinity, paved: Infinity },
};

/** Profil başına ulaşılabilir en yüksek hız (km/sa) — A* sezgiseli için */
const MAX_SPEED_KMH: Record<RouteProfile, number> = {
  hike: 6,
  trail_run: 9.6,
  mtb: 24,
  gravel: 28,
  ski_tour: 14,
};

/** Rota zorluğu sıralaması (UI rozet rengi vb. için) */
export const ROUTE_DIFFICULTIES: RouteDifficulty[] = ['easy', 'moderate', 'hard', 'expert'];

/* ------------------------------------------------------------------ */
/* Süre modeli                                                         */
/* ------------------------------------------------------------------ */

/**
 * Tobler yürüyüş fonksiyonu: hız (km/sa) = 6·e^(−3.5·|eğim + 0.05|).
 * Eğim = yükseklik farkı / yatay mesafe (ör. 0.1 = %10).
 */
export function toblerSpeedKmh(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

/** Bisiklet hız modeli: düz zeminde `base` km/sa, yokuşta yavaşlar, inişte hızlanır (sınırlı). */
function bikeSpeedKmh(slope: number, base: number): number {
  if (slope >= 0) return base / (1 + 12 * slope);
  return base * Math.min(1.6, 1 - slope * 4);
}

/** Kayak turu: çıkışta fok derisiyle Tobler'e yakın, inişte hızlı kayış. */
function skiSpeedKmh(slope: number): number {
  if (slope >= 0) return Math.max(2, toblerSpeedKmh(slope) * 0.85);
  return Math.min(14, 6 + -slope * 40);
}

/** Profil ve eğime göre temel hız (yüzey çarpanı hariç), km/sa. */
export function profileSpeedKmh(profile: RouteProfile, slope: number): number {
  switch (profile) {
    case 'hike':
      return toblerSpeedKmh(slope);
    case 'trail_run':
      return toblerSpeedKmh(slope) * 1.6;
    case 'mtb':
      return bikeSpeedKmh(slope, 15);
    case 'gravel':
      return bikeSpeedKmh(slope, 18);
    case 'ski_tour':
      return skiSpeedKmh(slope);
  }
}

/** Kenar için eğim: (bitiş − başlangıç yüksekliği) / yatay mesafe */
export function edgeSlope(edge: TrailEdge, from: TrailNode, to: TrailNode): number {
  const horizontalM = Math.max(1, edge.distanceKm * 1000);
  return (to.elevationM - from.elevationM) / horizontalM;
}

/**
 * Kenarı `from`→`to` yönünde geçmenin süresi (dakika); yüzey ve teknik çarpanlarını içerir.
 * Profil kenarı kullanamıyorsa `null`.
 */
export function edgeDurationMin(
  edge: TrailEdge,
  from: TrailNode,
  to: TrailNode,
  profile: RouteProfile,
): number | null {
  if (!isEdgeAllowed(edge, profile)) return null;
  const surfaceFactor = SURFACE_FACTOR[profile][edge.surface];
  const technicalFactor = 1 + edge.technical * (profile === 'hike' ? 0.4 : 0.8);
  const speed = profileSpeedKmh(profile, edgeSlope(edge, from, to));
  const baseMin = (edge.distanceKm / Math.max(0.3, speed)) * 60;
  return baseMin * surfaceFactor * technicalFactor;
}

/** Kenar bu profil tarafından kullanılabilir mi? (profil listesi + yüzey + teknik eşik) */
export function isEdgeAllowed(edge: TrailEdge, profile: RouteProfile): boolean {
  if (!edge.profiles.includes(profile)) return false;
  if (!Number.isFinite(SURFACE_FACTOR[profile][edge.surface])) return false;
  const limit = TECHNICAL_LIMIT[profile];
  if (limit !== null && edge.technical > limit) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Graf yardımcıları                                                   */
/* ------------------------------------------------------------------ */

function nodeMap(graph: TrailGraph): Map<ID, TrailNode> {
  const map = new Map<ID, TrailNode>();
  for (const n of graph.nodes) map.set(n.id, n);
  return map;
}

/** Yönsüz komşuluk listesi: her kenar iki yönde eklenir. */
function adjacency(graph: TrailGraph): Map<ID, { edge: TrailEdge; to: ID }[]> {
  const adj = new Map<ID, { edge: TrailEdge; to: ID }[]>();
  const push = (from: ID, to: ID, edge: TrailEdge) => {
    const list = adj.get(from);
    if (list) list.push({ edge, to });
    else adj.set(from, [{ edge, to }]);
  };
  for (const e of graph.edges) {
    push(e.from, e.to, e);
    push(e.to, e.from, e);
  }
  return adj;
}

/** İki düğüm arasındaki kenarı (yönden bağımsız) bulur. */
export function findEdge(graph: TrailGraph, a: ID, b: ID): TrailEdge | null {
  return (
    graph.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)) ?? null
  );
}

/** Koordinata en yakın düğüm (graf boşsa null). */
export function nearestNode(graph: TrailGraph, coords: GeoPoint): TrailNode | null {
  let best: TrailNode | null = null;
  let bestKm = Infinity;
  for (const n of graph.nodes) {
    const d = distanceKm(n.coords, coords);
    if (d < bestKm) {
      bestKm = d;
      best = n;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* A*                                                                  */
/* ------------------------------------------------------------------ */

/** Basit ikili yığın (min-heap) — küçük graflar için yeterli. */
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, value: T): void {
    this.items.push({ key, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]!.key <= this.items[i]!.key) break;
      [this.items[parent], this.items[i]] = [this.items[i]!, this.items[parent]!];
      i = parent;
    }
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (!top) return undefined;
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.items[l]!.key < this.items[m]!.key) m = l;
        if (r < this.items.length && this.items[r]!.key < this.items[m]!.key) m = r;
        if (m === i) break;
        [this.items[m], this.items[i]] = [this.items[i]!, this.items[m]!];
        i = m;
      }
    }
    return top.value;
  }
}

/**
 * A* ile en hızlı rota. Kenar maliyeti = süre (dk) × profil/yüzey/teknik cezaları;
 * sezgisel = kuş uçuşu mesafe / profilin azami hızı (kabul edilebilir).
 * Yol yoksa (ya da profil hiçbir kenarı kullanamıyorsa) `null`.
 */
export function planRoute(
  graph: TrailGraph,
  fromId: ID,
  toId: ID,
  profile: RouteProfile,
): PlannedRoute | null {
  const nodes = nodeMap(graph);
  const start = nodes.get(fromId);
  const goal = nodes.get(toId);
  if (!start || !goal) return null;
  if (fromId === toId) return routeStats(graph, [fromId], profile);

  const adj = adjacency(graph);
  const heuristic = (n: TrailNode) =>
    (distanceKm(n.coords, goal.coords) / MAX_SPEED_KMH[profile]) * 60;

  const gScore = new Map<ID, number>([[fromId, 0]]);
  const cameFrom = new Map<ID, ID>();
  const closed = new Set<ID>();
  const open = new MinHeap<ID>();
  open.push(heuristic(start), fromId);

  while (open.size > 0) {
    const currentId = open.pop()!;
    if (closed.has(currentId)) continue;
    if (currentId === toId) break;
    closed.add(currentId);
    const current = nodes.get(currentId)!;
    const g = gScore.get(currentId)!;

    for (const { edge, to } of adj.get(currentId) ?? []) {
      if (closed.has(to)) continue;
      const next = nodes.get(to);
      if (!next) continue;
      const cost = edgeDurationMin(edge, current, next, profile);
      if (cost === null) continue;
      const tentative = g + cost;
      const known = gScore.get(to);
      if (known !== undefined && tentative >= known) continue;
      gScore.set(to, tentative);
      cameFrom.set(to, currentId);
      open.push(tentative + heuristic(next), to);
    }
  }

  if (!gScore.has(toId)) return null;
  const path: ID[] = [toId];
  let cursor = toId;
  while (cursor !== fromId) {
    const prev = cameFrom.get(cursor);
    if (!prev) return null;
    path.push(prev);
    cursor = prev;
  }
  path.reverse();
  return routeStats(graph, path, profile);
}

/* ------------------------------------------------------------------ */
/* İstatistikler                                                       */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Düğüm dizisi için rota istatistiklerini hesaplar. Ardışık düğümler arasında kenar
 * bulunamazsa kuş uçuşu mesafe ve `trail` yüzeyi varsayılır (GPX içe aktarma için tolerans).
 */
export function routeStats(graph: TrailGraph, nodeIds: ID[], profile: RouteProfile): PlannedRoute {
  const nodes = nodeMap(graph);
  const path = nodeIds.map((id) => nodes.get(id)).filter((n): n is TrailNode => Boolean(n));

  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let duration = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  const profilePoints: [number, number][] = [];
  const surfaces: Partial<Record<Surface, number>> = {};

  path.forEach((node, index) => {
    minElevation = Math.min(minElevation, node.elevationM);
    maxElevation = Math.max(maxElevation, node.elevationM);
    if (index === 0) {
      profilePoints.push([0, node.elevationM]);
      return;
    }
    const prev = path[index - 1]!;
    const edge: TrailEdge = findEdge(graph, prev.id, node.id) ?? {
      id: `virtual_${prev.id}_${node.id}`,
      from: prev.id,
      to: node.id,
      distanceKm: distanceKm(prev.coords, node.coords),
      surface: 'trail',
      profiles: [profile],
      technical: 0,
    };
    const delta = node.elevationM - prev.elevationM;
    if (delta > 0) ascent += delta;
    else descent -= delta;
    distance += edge.distanceKm;
    duration +=
      edgeDurationMin(edge, prev, node, profile) ?? edgeDurationMin(edge, prev, node, 'hike') ?? 0;
    surfaces[edge.surface] = (surfaces[edge.surface] ?? 0) + edge.distanceKm;
    profilePoints.push([round(distance, 3), node.elevationM]);
  });

  for (const key of Object.keys(surfaces) as Surface[]) surfaces[key] = round(surfaces[key]!, 2);

  return {
    nodeIds: path.map((n) => n.id),
    points: path.map((n) => ({ latitude: n.coords.latitude, longitude: n.coords.longitude })),
    distanceKm: round(distance),
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    durationMin: Math.round(duration),
    maxElevationM: path.length ? maxElevation : 0,
    minElevationM: path.length ? minElevation : 0,
    profile: profilePoints,
    surfaces,
  };
}

/**
 * Zorluk: efor = km + tırmanış/100 (Naismith benzeri "eşdeğer km"); teknik yüzey payı
 * (kaya/moloz/kar) yüksekse bir kademe artar.
 */
export function difficultyOf(planned: PlannedRoute): RouteDifficulty {
  const effort = planned.distanceKm + planned.ascentM / 100;
  const technicalKm =
    (planned.surfaces.rock ?? 0) + (planned.surfaces.scree ?? 0) + (planned.surfaces.snow ?? 0);
  const technicalShare = planned.distanceKm > 0 ? technicalKm / planned.distanceKm : 0;
  let level = effort < 8 ? 0 : effort < 16 ? 1 : effort < 28 ? 2 : 3;
  if (technicalShare > 0.5 || planned.maxElevationM >= 3500) level += 1;
  return ROUTE_DIFFICULTIES[Math.min(3, level)]!;
}

/* ------------------------------------------------------------------ */
/* Yükseklik profili → SVG                                             */
/* ------------------------------------------------------------------ */

/**
 * Yükseklik profilini verilen genişlik/yüksekliğe sığdırır; `padding` üst/alt boşluk (px).
 * Sonuç, SVG `Polyline`/`Path` için `{x, y}` noktalarıdır.
 */
export function elevationProfilePoints(
  planned: PlannedRoute,
  width: number,
  height: number,
  padding = 0,
): SvgPoint[] {
  const pts = planned.profile;
  if (pts.length === 0 || width <= 0 || height <= 0) return [];
  const totalKm = pts[pts.length - 1]![0] || 1;
  const minE = planned.minElevationM;
  const span = Math.max(1, planned.maxElevationM - minE);
  const innerH = Math.max(1, height - padding * 2);
  return pts.map(([km, ele]) => ({
    x: round((km / totalKm) * width, 1),
    y: round(padding + innerH - ((ele - minE) / span) * innerH, 1),
  }));
}

/** SVG `points` niteliği için "x,y x,y" dizesi */
export function svgPointsString(points: SvgPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/* ------------------------------------------------------------------ */
/* GPX                                                                 */
/* ------------------------------------------------------------------ */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Planlanan rotayı GPX 1.1 belgesine çevirir (trk/trkseg/trkpt + ele). */
export function toGpx(planned: PlannedRoute, name: string, creator = 'Zirtan'): string {
  const trkpts = planned.points
    .map((p, i) => {
      const ele = planned.profile[i]?.[1];
      const eleTag = ele !== undefined ? `<ele>${ele}</ele>` : '';
      return `      <trkpt lat="${p.latitude.toFixed(6)}" lon="${p.longitude.toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">`,
    '  <metadata>',
    `    <name>${escapeXml(name)}</name>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    '    <trkseg>',
    trkpts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/**
 * Basit GPX ayrıştırıcı: `trkpt` (yoksa `rtept`) elemanlarından lat/lon/ele okur.
 * Tam XML doğrulaması yapmaz; bozuk değerler atlanır.
 */
export function fromGpx(xml: string): GpxTrack {
  const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(xml);
  const name = nameMatch ? unescapeXml(nameMatch[1]!.trim()) : null;
  const points: GpxTrackPoint[] = [];
  const tag = /<trkpt\b/i.test(xml) ? 'trkpt' : 'rtept';
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tag}>)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const lat = parseFloat(/lat="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    const lon = parseFloat(/lon="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleRaw = /<ele>([^<]+)<\/ele>/i.exec(inner)?.[1];
    const ele = eleRaw !== undefined ? parseFloat(eleRaw) : NaN;
    points.push({ latitude: lat, longitude: lon, elevationM: Number.isFinite(ele) ? ele : null });
  }
  return { name, points };
}

/* ------------------------------------------------------------------ */
/* Douglas–Peucker                                                     */
/* ------------------------------------------------------------------ */

/** Noktanın a–b doğru parçasına dik uzaklığı (metre, eş-dikdörtgen yaklaşımı). */
function perpendicularDistanceM(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const kx = 111_320 * Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  const ky = 110_574;
  const ax = 0;
  const ay = 0;
  const bx = (b.longitude - a.longitude) * kx;
  const by = (b.latitude - a.latitude) * ky;
  const px = (p.longitude - a.longitude) * kx;
  const py = (p.latitude - a.latitude) * ky;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const tRaw = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2;
  const t = Math.max(0, Math.min(1, tRaw));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

/** Douglas–Peucker sadeleştirme; uç noktalar korunur. Tolerans metre cinsindendir. */
export function simplifyPoints<T extends GeoPoint>(points: T[], toleranceM: number): T[] {
  if (points.length <= 2) return points.slice();
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistanceM(points[i]!, points[s]!, points[e]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/* ------------------------------------------------------------------ */
/* Harita paketleri                                                    */
/* ------------------------------------------------------------------ */

/** bbox: [batı, güney, doğu, kuzey] (GeoJSON sırası) */
export type BBox = [number, number, number, number];

/** bbox alanı (km²) — orta enlemde eş-dikdörtgen yaklaşımı */
export function bboxAreaKm2(bbox: BBox): number {
  const [w, s, e, n] = bbox;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(e - w) * 111.32 * Math.cos(midLat);
  const heightKm = Math.abs(n - s) * 110.574;
  return widthKm * heightKm;
}

/**
 * Vektör karo paketi boyut tahmini (MB). Kalibrasyon: ~41.000 km² (İsviçre) z14 ≈ 150 MB;
 * her ek zoom kademesi ≈ ×2,5. Alt sınır 1 MB.
 */
export function packSizeEstimateMb(bbox: BBox, zoomMax: number): number {
  const area = bboxAreaKm2(bbox);
  const perKm2AtZ14 = 0.0036;
  const zoomFactor = 2.5 ** (zoomMax - 14);
  return Math.max(1, round(area * perKm2AtZ14 * zoomFactor, 1));
}

/** Koordinat paketin sınır kutusu içinde mi? */
export function packCoversPoint(pack: Pick<MapPack, 'bbox'>, coords: GeoPoint): boolean {
  const [w, s, e, n] = pack.bbox;
  return (
    coords.longitude >= w && coords.longitude <= e && coords.latitude >= s && coords.latitude <= n
  );
}

/** Bir grafın tamamını kapsayan indirilmiş paket var mı? */
export function offlinePackFor(packs: MapPack[], center: GeoPoint): MapPack | null {
  return packs.find((p) => p.status === 'downloaded' && packCoversPoint(p, center)) ?? null;
}
