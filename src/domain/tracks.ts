import type { TranslationKey } from '@/core/i18n';

import { ROUTE_PROFILES, type AdventureType, type NavManeuver, type PoiKind } from './enums';
import { distanceKm } from './geo';
import { simplifyPoints } from './routing';
import type {
  CommunityTrail,
  GeoPoint,
  ID,
  ISODate,
  LiveStream,
  NavigationProgress,
  NavigationStep,
  Post,
  Story,
  Track,
  TrackFilter,
  TrackPoi,
  TrackPoiWithDistance,
  TrackPoint,
  TrailEdge,
  TrailGraph,
  TrailNode,
} from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Yükseklik gürültü filtresi eşiği (m) — bundan küçük dalgalanmalar tırmanışa sayılmaz */
export const ELEVATION_NOISE_M = 3;
/** Varsayılan sadeleştirme toleransı (m) */
export const DEFAULT_SIMPLIFY_M = 8;
/** Rotadan çıkış eşiği (m) */
export const OFF_ROUTE_M = 60;
/** Yakın POI eşiği (m) — adım metnine POI adı eklenir */
export const POI_NEAR_STEP_M = 60;
/** Medya POI tekilleştirme yarıçapı (m) */
export const POI_DEDUPE_M = 50;
/** Bir topluluk rotasının "doğrulanmış" sayılması için gereken doğrulama sayısı */
export const VERIFY_THRESHOLD = 3;
/** Gizlilik: yayınlanan parçalarda başlangıç/bitiş etrafında maskelenen yarıçap (m) */
export const HOME_MASK_M = 300;
/** Yatay yürüyüş hızı (km/sa) — ETA için */
export const NAV_BASE_SPEED_KMH = 4;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** İki nokta arası mesafe (m) */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  return distanceKm(a, b) * 1000;
}

/* ------------------------------------------------------------------ */
/* Geometri                                                            */
/* ------------------------------------------------------------------ */

/** a → b başlangıç yönü (0–360°, kuzeyden saat yönünde) */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Verilen yön ve mesafedeki (m) hedef nokta */
export function destinationPoint(origin: GeoPoint, bearingDeg: number, distM: number): GeoPoint {
  const δ = distM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin.latitude);
  const λ1 = toRad(origin.longitude);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { latitude: toDeg(φ2), longitude: ((toDeg(λ2) + 540) % 360) - 180 };
}

/** İki yön arasındaki işaretli fark (−180…180; pozitif = sağa dönüş) */
export function turnAngle(fromBearing: number, toBearing: number): number {
  let d = ((toBearing - fromBearing) % 360) + 360;
  d %= 360;
  return d > 180 ? d - 360 : d;
}

export interface TrackStats {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  durationMin: number;
  maxElevationM: number | null;
  minElevationM: number | null;
  /** Hareket hızı (km/sa) — süre bilinmiyorsa null */
  avgSpeedKmh: number | null;
}

/**
 * Parça istatistikleri. Tırmanış/iniş 3 m eşikli histerezisle hesaplanır: referans yükseklikten
 * en az 3 m sapmadıkça fark birikmez (GPS gürültüsü tırmanışa sayılmaz).
 */
export function trackStats(points: TrackPoint[]): TrackStats {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let maxE: number | null = null;
  let minE: number | null = null;
  let refE: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i > 0) distance += distanceKm(points[i - 1]!, p);
    const e = p.elevationM;
    if (e === null) continue;
    maxE = maxE === null ? e : Math.max(maxE, e);
    minE = minE === null ? e : Math.min(minE, e);
    if (refE === null) {
      refE = e;
      continue;
    }
    const delta = e - refE;
    if (Math.abs(delta) >= ELEVATION_NOISE_M) {
      if (delta > 0) ascent += delta;
      else descent -= delta;
      refE = e;
    }
  }
  const first = points.find((p) => p.t !== null)?.t ?? null;
  let last: number | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const t = points[i]!.t;
    if (t !== null) {
      last = t;
      break;
    }
  }
  const durationMin = first !== null && last !== null ? Math.max(0, (last - first) / 60_000) : 0;
  const avgSpeedKmh = durationMin > 0 ? round(distance / (durationMin / 60), 1) : null;
  return {
    distanceKm: round(distance),
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    durationMin: Math.round(durationMin),
    maxElevationM: maxE === null ? null : Math.round(maxE),
    minElevationM: minE === null ? null : Math.round(minE),
    avgSpeedKmh,
  };
}

/** Douglas–Peucker sadeleştirme; yükseklik ve zaman alanları korunur. */
export function simplifyTrack(points: TrackPoint[], toleranceM = DEFAULT_SIMPLIFY_M): TrackPoint[] {
  return simplifyPoints(points, toleranceM);
}

/** İki nokta arasında doğrusal ara değer (yükseklik/zaman null ise null kalır) */
function lerpPoint(a: TrackPoint, b: TrackPoint, f: number): TrackPoint {
  const lerp = (x: number | null, y: number | null) =>
    x === null || y === null ? (x ?? y) : x + (y - x) * f;
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * f,
    longitude: a.longitude + (b.longitude - a.longitude) * f,
    elevationM: lerp(a.elevationM, b.elevationM),
    t: lerp(a.t, b.t),
  };
}

/** Parçayı sabit aralıklarla (m) yeniden örnekler; ilk ve son nokta korunur. */
export function resample(points: TrackPoint[], stepM: number): TrackPoint[] {
  if (points.length < 2 || stepM <= 0) return points.slice();
  const out: TrackPoint[] = [points[0]!];
  let carry = 0; // bir önceki segmentten devreden mesafe
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segLen = distanceM(a, b);
    if (segLen === 0) continue;
    let pos = stepM - carry;
    while (pos <= segLen) {
      out.push(lerpPoint(a, b, pos / segLen));
      pos += stepM;
    }
    carry = segLen - (pos - stepM);
  }
  const last = points[points.length - 1]!;
  const tail = out[out.length - 1]!;
  if (distanceM(tail, last) > stepM / 4) out.push(last);
  return out;
}

/** Koordinatı metre tabanlı ızgara hücresine oturtur ("satır:sütun") */
export function snapToGridKey(coords: GeoPoint, cellM = 25): string {
  const cell = gridCell(coords, cellM);
  return `${cell[0]}:${cell[1]}`;
}

function gridCell(coords: GeoPoint, cellM: number): [number, number] {
  const row = Math.floor((coords.latitude * 110_574) / cellM);
  // Boylam ölçeği hücre satırının enlemine göre sabitlenir (parçalar arası tutarlılık)
  const rowLat = ((row + 0.5) * cellM) / 110_574;
  const col = Math.floor((coords.longitude * 111_320 * Math.cos(toRad(rowLat))) / cellM);
  return [row, col];
}

/** [batı, güney, doğu, kuzey] */
export function bboxOf(points: GeoPoint[]): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.longitude);
    e = Math.max(e, p.longitude);
    s = Math.min(s, p.latitude);
    n = Math.max(n, p.latitude);
  }
  if (!Number.isFinite(w)) return [0, 0, 0, 0];
  return [round(w, 5), round(s, 5), round(e, 5), round(n, 5)];
}

/** Her noktanın rota başından kümülatif mesafesi (m) */
export function cumulativeM(points: GeoPoint[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1]! + distanceM(points[i - 1]!, points[i]!));
  return out;
}

export interface TrackProjection {
  /** Segment başlangıç indeksi */
  segmentIndex: number;
  /** Segment üzerindeki oran (0–1) */
  fraction: number;
  /** Rota başından mesafe (m) */
  alongM: number;
  /** Rotaya dik uzaklık (m) */
  offM: number;
  point: GeoPoint;
}

/** Konumu rotanın en yakın segmentine izdüşürür (eş-dikdörtgen yaklaşımı). */
export function projectOnTrack(points: GeoPoint[], position: GeoPoint): TrackProjection | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return {
      segmentIndex: 0,
      fraction: 0,
      alongM: 0,
      offM: distanceM(points[0]!, position),
      point: points[0]!,
    };
  }
  const ky = 110_574;
  const kx = 111_320 * Math.cos(toRad(position.latitude));
  let best: TrackProjection | null = null;
  let along = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const ax = 0;
    const ay = 0;
    const bx = (b.longitude - a.longitude) * kx;
    const by = (b.latitude - a.latitude) * ky;
    const px = (position.longitude - a.longitude) * kx;
    const py = (position.latitude - a.latitude) * ky;
    const len2 = bx * bx + by * by;
    const f = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2));
    const qx = ax + f * bx;
    const qy = ay + f * by;
    const off = Math.hypot(px - qx, py - qy);
    const segLen = Math.sqrt(len2);
    if (!best || off < best.offM) {
      best = {
        segmentIndex: i,
        fraction: f,
        alongM: along + f * segLen,
        offM: off,
        point: {
          latitude: a.latitude + (b.latitude - a.latitude) * f,
          longitude: a.longitude + (b.longitude - a.longitude) * f,
        },
      };
    }
    along += segLen;
  }
  return best;
}

/** Rota başından `alongM` metredeki nokta (sınırlar dışında uçlar döner) */
export function pointAtDistance(points: TrackPoint[], alongM: number): TrackPoint | null {
  if (points.length === 0) return null;
  if (alongM <= 0) return points[0]!;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = distanceM(points[i - 1]!, points[i]!);
    if (acc + seg >= alongM) {
      const f = seg === 0 ? 0 : (alongM - acc) / seg;
      return lerpPoint(points[i - 1]!, points[i]!, f);
    }
    acc += seg;
  }
  return points[points.length - 1]!;
}

/**
 * Gizlilik maskesi: yayınlanan parçalarda başlangıç ve bitişin `radiusM` içindeki noktaları
 * kırpar (ev/araç konumu açığa çıkmasın). Parça kısa ise dokunulmaz.
 */
export function maskStart(points: TrackPoint[], radiusM = HOME_MASK_M): TrackPoint[] {
  if (points.length < 4) return points.slice();
  const cum = cumulativeM(points);
  const total = cum[cum.length - 1]!;
  if (total < radiusM * 3) return points.slice();
  const kept = points.filter((_, i) => cum[i]! >= radiusM && total - cum[i]! >= radiusM);
  return kept.length >= 2 ? kept : points.slice();
}

/* ------------------------------------------------------------------ */
/* Kümeleme → topluluk rotası                                          */
/* ------------------------------------------------------------------ */

export interface ClusterOptions {
  /** Izgara hücre boyu (m) */
  cellM?: number;
  /** Küme oluşturmak için gereken en az parça sayısı */
  minTracks?: number;
  /** Ortak hücre oranı eşiği (kısa parçanın hücrelerine göre) */
  minOverlap?: number;
  /** Oluşturma zamanı (ISO) */
  now?: ISODate;
  /** Deterministik id üretimi (varsayılan: parça id'lerinden hash) */
  idFor?: (trackIds: ID[]) => ID;
}

export interface TrackCluster {
  trail: CommunityTrail;
  trackIds: ID[];
}

function cellSet(points: TrackPoint[], cellM: number): Set<string> {
  const set = new Set<string>();
  for (const p of resample(points, cellM / 2)) set.add(snapToGridKey(p, cellM));
  return set;
}

/** Hücre ya da 8 komşusundan biri diğer kümede var mı? (sınır etkisine tolerans) */
function hasNeighbor(key: string, other: Set<string>): boolean {
  if (other.has(key)) return true;
  const [r, c] = key.split(':').map((v) => parseInt(v, 10)) as [number, number];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && other.has(`${r + dr}:${c + dc}`)) return true;
  return false;
}

/** İki parçanın ortak hücre oranı (0–1); kısa parçanın hücre sayısına göre. */
export function trackOverlap(a: TrackPoint[], b: TrackPoint[], cellM = 30): number {
  const sa = cellSet(a, cellM);
  const sb = cellSet(b, cellM);
  if (sa.size === 0 || sb.size === 0) return 0;
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let hit = 0;
  for (const key of small) if (hasNeighbor(key, big)) hit++;
  return hit / small.size;
}

/** Basit deterministik dize hash'i (base36) */
export function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

/**
 * Küme merkez hattı: en uzun parça omurga alınır, `cellM` aralıkla örneklenir ve her omurga
 * noktası, tüm parçaların 1,5·cellM içindeki noktalarının ortalamasıyla değiştirilir.
 */
export function medianCenterline(tracks: Track[], cellM = 30): TrackPoint[] {
  if (tracks.length === 0) return [];
  const spineTrack = tracks.reduce((best, t) => (t.distanceKm > best.distanceKm ? t : best));
  const spine = resample(spineTrack.points, cellM);
  const pool = tracks.flatMap((t) => resample(t.points, cellM / 2));
  const radius = cellM * 1.5;
  return spine.map((s) => {
    let lat = 0;
    let lng = 0;
    let ele = 0;
    let n = 0;
    let nEle = 0;
    for (const p of pool) {
      if (Math.abs(p.latitude - s.latitude) * 110_574 > radius) continue;
      if (distanceM(p, s) > radius) continue;
      lat += p.latitude;
      lng += p.longitude;
      n++;
      if (p.elevationM !== null) {
        ele += p.elevationM;
        nEle++;
      }
    }
    if (n === 0) return { ...s, t: null };
    return {
      latitude: round(lat / n, 6),
      longitude: round(lng / n, 6),
      elevationM: nEle > 0 ? Math.round(ele / nEle) : s.elevationM,
      t: null,
    };
  });
}

function modeOf<T>(values: T[]): T {
  const counts = new Map<T, number>();
  let best = values[0]!;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

function buildTrail(id: ID, tracks: Track[], cellM: number, now: ISODate): CommunityTrail {
  const points = medianCenterline(tracks, cellM);
  const stats = trackStats(points);
  const spine = tracks.reduce((best, t) => (t.distanceKm > best.distanceKm ? t : best));
  const likes = tracks.reduce((sum, t) => sum + t.likesCount, 0);
  return {
    id,
    name: spine.name,
    adventureType: modeOf(tracks.map((t) => t.adventureType)),
    points,
    distanceKm: stats.distanceKm,
    ascentM: stats.ascentM,
    descentM: stats.descentM,
    trackCount: tracks.length,
    verifiedCount: 0,
    popularity: tracks.length + likes,
    regionName: spine.regionName,
    countryCode: spine.countryCode,
    bbox: bboxOf(points),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Aynı güzergâhı paylaşan parçaları gruplar (birleşim-bul) ve her küme için sanal yol üretir.
 * Küme üyeliği: ortak hücre oranı ≥ `minOverlap` (varsayılan %60).
 */
export function clusterTracks(tracks: Track[], options: ClusterOptions = {}): TrackCluster[] {
  const cellM = options.cellM ?? 30;
  const minTracks = options.minTracks ?? 2;
  const minOverlap = options.minOverlap ?? 0.6;
  const now = options.now ?? new Date().toISOString();
  const idFor = options.idFor ?? ((ids: ID[]) => `ct_${hashId(ids.slice().sort().join('|'))}`);

  const usable = tracks.filter((t) => t.points.length >= 2);
  const sets = usable.map((t) => cellSet(t.points, cellM));
  const parent = usable.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const sa = sets[i]!;
      const sb = sets[j]!;
      const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
      let hit = 0;
      for (const key of small) if (hasNeighbor(key, big)) hit++;
      if (hit / small.size >= minOverlap) union(i, j);
    }
  }

  const groups = new Map<number, Track[]>();
  usable.forEach((t, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(t);
    else groups.set(root, [t]);
  });

  const clusters: TrackCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < minTracks) continue;
    const trackIds = members.map((t) => t.id);
    clusters.push({ trail: buildTrail(idFor(trackIds), members, cellM, now), trackIds });
  }
  return clusters.sort((a, b) => b.trail.popularity - a.trail.popularity);
}

/**
 * Yeni bir parçayı mevcut sanal yola karıştırır: merkez hattı ağırlıklı ortalama ile yeni
 * parçaya doğru kaydırılır (ağırlık 1/(n+1)), sayaçlar ve bbox güncellenir.
 */
export function mergeIntoExisting(
  existing: CommunityTrail,
  newTrack: Track,
  now: ISODate = new Date().toISOString(),
): CommunityTrail {
  const weight = 1 / (existing.trackCount + 1);
  const points = existing.points.map((p) => {
    const proj = projectOnTrack(newTrack.points, p);
    if (!proj || proj.offM > 45) return p;
    return {
      latitude: round(p.latitude + (proj.point.latitude - p.latitude) * weight, 6),
      longitude: round(p.longitude + (proj.point.longitude - p.longitude) * weight, 6),
      elevationM: p.elevationM,
      t: null,
    };
  });
  const stats = trackStats(points);
  return {
    ...existing,
    points,
    distanceKm: stats.distanceKm,
    ascentM: stats.ascentM,
    descentM: stats.descentM,
    trackCount: existing.trackCount + 1,
    popularity: existing.popularity + 1 + newTrack.likesCount,
    bbox: bboxOf(points),
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* POI türetme                                                         */
/* ------------------------------------------------------------------ */

/** Anahtar kelime listeleri (küçük harf, tr+en) — sıra: öncelik */
const POI_KEYWORDS: [PoiKind, string[]][] = [
  ['danger', ['tehlike', 'çığ', 'düşen kaya', 'kaya düşme', 'uçurum', 'dikkat', 'danger', 'avalanche', 'rockfall']],
  ['water', ['pınar', 'çeşme', 'kaynak suyu', 'su kaynağı', 'içme suyu', 'su var', 'dere', 'spring', 'water source', 'stream']],
  ['summit', ['zirve', 'summit', 'tepe noktası', 'doruk', 'peak']],
  ['viewpoint', ['manzara', 'viewpoint', 'panorama', 'gün batımı', 'gündoğumu', 'gün doğumu', 'seyir', 'view']],
  ['shelter', ['barınak', 'sığınak', 'kulübe', 'dağ evi', 'refuge', 'shelter', 'hut', 'bothy']],
  ['campsite', ['kamp', 'çadır', 'camp', 'tent', '⛺', 'bivak', 'bivouac', 'konakla', 'gece burada']],
  ['food', ['kahvaltı', 'lokanta', 'yemek', 'çay molası', 'restoran', 'food', 'restaurant', 'cafe']],
  ['parking', ['otopark', 'park et', 'arabayı bırak', 'parking', 'park yeri']],
  ['trailhead', ['patika başı', 'başlangıç noktası', 'trailhead', 'start point', 'rota başı']],
  ['junction', ['kavşak', 'yol ayrımı', 'ayrım', 'junction', 'fork']],
];

/** Gece saati mi? (20:00–06:00) */
export function isNightHour(hour: number): boolean {
  return hour >= 20 || hour < 6;
}

/**
 * Metin + saatten POI türü çıkarımı. Anahtar kelime öncelikli; gece paylaşımları
 * (20:00–06:00) başka ipucu yoksa kamp sayılır. Eşleşme yoksa null.
 */
export function poiHeuristics(text: string, hour: number): PoiKind | null {
  const lower = text.toLocaleLowerCase('tr-TR');
  for (const [kind, words] of POI_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return kind;
  }
  return isNightHour(hour) ? 'campsite' : null;
}

export interface MediaPoiOptions {
  /** ISO tarihten yerel saat (test edilebilirlik için enjekte edilebilir) */
  hourOf?: (iso: ISODate) => number;
  /** Tekilleştirme yarıçapı (m) */
  dedupeM?: number;
  /** Bu kullanıcının medyası öne alınır */
  preferUserId?: ID | null;
  limit?: number;
}

const defaultHourOf = (iso: ISODate) => new Date(iso).getHours();

function shortName(locationName: string, kind: PoiKind): string {
  const base = locationName.split(',')[0]?.trim() || locationName.trim();
  return base || kind;
}

/**
 * Konumlu anlar/yayınlar/gönderilerden POI adayları türetir. Mevcut POI'lerin
 * `dedupeM` (50 m) içindekiler ve kendi aralarında çakışanlar atlanır.
 */
export function poisFromMedia(
  stories: Story[],
  streams: LiveStream[],
  posts: Post[],
  existingPois: TrackPoi[],
  options: MediaPoiOptions = {},
): TrackPoi[] {
  const hourOf = options.hourOf ?? defaultHourOf;
  const dedupeM = options.dedupeM ?? POI_DEDUPE_M;
  const limit = options.limit ?? 20;

  interface Candidate {
    id: ID;
    userId: ID;
    coords: GeoPoint;
    text: string;
    locationName: string;
    elevationM: number | null;
    photoUrl: string | null;
    source: 'story' | 'stream' | 'post';
    createdAt: ISODate;
  }
  const candidates: Candidate[] = [
    ...stories.map<Candidate>((s) => ({
      id: s.id,
      userId: s.authorId,
      coords: s.coords,
      text: s.caption,
      locationName: s.locationName,
      elevationM: s.altitudeM,
      photoUrl: s.mediaType === 'image' ? s.mediaUrl : null,
      source: 'story',
      createdAt: s.createdAt,
    })),
    ...streams.map<Candidate>((s) => ({
      id: s.id,
      userId: s.hostId,
      coords: s.coords,
      text: `${s.title} ${s.description}`,
      locationName: s.locationName,
      elevationM: s.altitudeM,
      photoUrl: s.thumbnailUrl,
      source: 'stream',
      createdAt: s.startedAt ?? s.scheduledAt ?? new Date(0).toISOString(),
    })),
    ...posts.map<Candidate>((p) => ({
      id: p.id,
      userId: p.authorId,
      coords: p.coords,
      text: p.caption,
      locationName: p.locationName,
      elevationM: p.altitudeM || null,
      photoUrl: p.imageUrl,
      source: 'post',
      createdAt: p.createdAt,
    })),
  ];

  const preferred = options.preferUserId ?? null;
  candidates.sort((a, b) => {
    const pa = a.userId === preferred ? 0 : 1;
    const pb = b.userId === preferred ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const taken: GeoPoint[] = existingPois.map((p) => p.coords);
  const existingMedia = new Set(existingPois.map((p) => p.mediaId).filter(Boolean));
  const out: TrackPoi[] = [];
  for (const c of candidates) {
    if (out.length >= limit) break;
    if (existingMedia.has(c.id)) continue;
    if (!Number.isFinite(c.coords.latitude) || !Number.isFinite(c.coords.longitude)) continue;
    const kind = poiHeuristics(c.text, hourOf(c.createdAt));
    if (!kind) continue;
    if (taken.some((t) => distanceM(t, c.coords) <= dedupeM)) continue;
    taken.push(c.coords);
    out.push({
      id: `poi_${c.source}_${c.id}`,
      trackId: null,
      communityTrailId: null,
      userId: c.userId,
      kind,
      coords: c.coords,
      elevationM: c.elevationM,
      name: shortName(c.locationName, kind),
      note: c.text.trim().slice(0, 140),
      photoUrl: c.photoUrl,
      source: c.source,
      mediaId: c.id,
      confirmations: 0,
      createdAt: c.createdAt,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Navigasyon                                                          */
/* ------------------------------------------------------------------ */

/** Dönüş açısından manevra (pozitif = sağ) */
export function maneuverFor(angle: number): NavManeuver {
  const abs = Math.abs(angle);
  if (abs < 20) return 'continue';
  if (abs >= 160) return 'uturn';
  const side = angle > 0 ? 'right' : 'left';
  if (abs < 60) return `slight_${side}`;
  if (abs < 120) return side;
  return `sharp_${side}`;
}

export interface NavigationOptions {
  /** Köşe tespiti için sadeleştirme toleransı (m) */
  cornerToleranceM?: number;
  /** Bundan kısa adımlar bir öncekiyle birleştirilir (m) */
  minStepM?: number;
  /** POI'nin adıma bağlanma yarıçapı (m) */
  poiRadiusM?: number;
}

/**
 * Parçadan adım adım yönergeler üretir. Köşeler sadeleştirilmiş çizgi üzerinde bulunur;
 * düz gidişler adım oluşturmaz, 25 m'den kısa adımlar birleştirilir, 60 m içindeki POI'ler
 * adıma bağlanır; adıma bağlanmayan POI'ler kendi `waypoint` adımını alır.
 */
export function buildNavigation(
  points: TrackPoint[],
  pois: TrackPoi[] = [],
  options: NavigationOptions = {},
): NavigationStep[] {
  if (points.length < 2) return [];
  const tol = options.cornerToleranceM ?? 12;
  const minStep = options.minStepM ?? 25;
  const poiRadius = options.poiRadiusM ?? POI_NEAR_STEP_M;

  const corners = simplifyTrack(points, tol);
  const cum = cumulativeM(corners);
  const total = cum[cum.length - 1]!;

  interface Draft {
    coords: GeoPoint;
    maneuver: NavManeuver;
    cumulativeM: number;
    bearingDeg: number;
    poiName: string | null;
  }
  const drafts: Draft[] = [
    {
      coords: corners[0]!,
      maneuver: 'start',
      cumulativeM: 0,
      bearingDeg: bearing(corners[0]!, corners[1]!),
      poiName: null,
    },
  ];
  for (let i = 1; i < corners.length - 1; i++) {
    const inB = bearing(corners[i - 1]!, corners[i]!);
    const outB = bearing(corners[i]!, corners[i + 1]!);
    const maneuver = maneuverFor(turnAngle(inB, outB));
    if (maneuver === 'continue') continue;
    const prev = drafts[drafts.length - 1]!;
    if (cum[i]! - prev.cumulativeM < minStep && prev.maneuver !== 'start') {
      // Kısa adım: önceki adımın manevrası korunur, yön güncellenir
      prev.bearingDeg = outB;
      continue;
    }
    drafts.push({ coords: corners[i]!, maneuver, cumulativeM: cum[i]!, bearingDeg: outB, poiName: null });
  }
  drafts.push({
    coords: corners[corners.length - 1]!,
    maneuver: 'arrive',
    cumulativeM: total,
    bearingDeg: drafts[drafts.length - 1]!.bearingDeg,
    poiName: null,
  });

  // POI bağlama: adıma yakınsa adı eklenir; değilse rota üzerinde waypoint adımı oluşur
  for (const poi of pois) {
    const near = drafts.find((d) => !d.poiName && distanceM(d.coords, poi.coords) <= poiRadius);
    if (near) {
      near.poiName = poi.name;
      continue;
    }
    const proj = projectOnTrack(corners, poi.coords);
    if (!proj || proj.offM > poiRadius * 2) continue;
    const tooClose = drafts.some((d) => Math.abs(d.cumulativeM - proj.alongM) < minStep);
    if (tooClose) continue;
    drafts.push({
      coords: proj.point,
      maneuver: 'waypoint',
      cumulativeM: proj.alongM,
      bearingDeg: bearing(corners[proj.segmentIndex]!, corners[proj.segmentIndex + 1]!),
      poiName: poi.name,
    });
  }
  drafts.sort((a, b) => a.cumulativeM - b.cumulativeM);

  return drafts.map((d, index) => ({
    index,
    coords: { latitude: round(d.coords.latitude, 6), longitude: round(d.coords.longitude, 6) },
    maneuver: d.maneuver,
    distanceM: Math.round((drafts[index + 1]?.cumulativeM ?? d.cumulativeM) - d.cumulativeM),
    bearingDeg: Math.round(d.bearingDeg),
    poiName: d.poiName,
    cumulativeM: Math.round(d.cumulativeM),
  }));
}

/** Konumdan sonraki kalan tırmanış (m) — Naismith ETA düzeltmesi için */
function remainingAscent(points: TrackPoint[], fromSegment: number): number {
  let ascent = 0;
  let ref: number | null = null;
  for (let i = fromSegment; i < points.length; i++) {
    const e = points[i]!.elevationM;
    if (e === null) continue;
    if (ref === null) {
      ref = e;
      continue;
    }
    if (e - ref >= ELEVATION_NOISE_M) ascent += e - ref;
    if (Math.abs(e - ref) >= ELEVATION_NOISE_M) ref = e;
  }
  return ascent;
}

/**
 * Konumu rotaya izdüşürüp ilerlemeyi hesaplar. Adım indeksi yalnızca ileri gider (geri
 * sıçrama yok). ETA: Naismith benzeri — `speedKmh` yatay + her 100 m tırmanış için 10 dk.
 */
export function progressAlong(
  points: TrackPoint[],
  steps: NavigationStep[],
  position: GeoPoint,
  stepIndex: number,
  speedKmh: number = NAV_BASE_SPEED_KMH,
): NavigationProgress {
  const proj = projectOnTrack(points, position);
  const total = cumulativeM(points)[points.length - 1] ?? 0;
  if (!proj) {
    return { stepIndex, distanceToNextM: 0, remainingM: 0, offRouteM: 0, isOffRoute: false, etaMin: 0 };
  }
  const along = proj.alongM;
  let idx = stepIndex;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]!.cumulativeM <= along + 15) {
      idx = Math.max(idx, i);
      break;
    }
  }
  idx = Math.min(idx, Math.max(0, steps.length - 1));
  const next = steps[idx + 1] ?? steps[steps.length - 1] ?? null;
  const distanceToNextM = next ? Math.max(0, next.cumulativeM - along) : 0;
  const remainingM = Math.max(0, total - along);
  const ascent = remainingAscent(points, proj.segmentIndex + 1);
  const etaMin = (remainingM / 1000 / Math.max(0.5, speedKmh)) * 60 + ascent / 10;
  return {
    stepIndex: idx,
    distanceToNextM: Math.round(distanceToNextM),
    remainingM: Math.round(remainingM),
    offRouteM: Math.round(proj.offM),
    isOffRoute: proj.offM > OFF_ROUTE_M,
    etaMin: Math.round(etaMin),
  };
}

export interface Instruction {
  key: TranslationKey;
  params: Record<string, string | number>;
}

/** Mesafeyi sesli/okunur biçime yuvarlar: 1.240 m → "1,2 km", 340 m → "350 m" */
export function roundedDistanceLabel(distM: number, locale: string): string {
  if (distM >= 1000) {
    const km = (Math.round(distM / 100) / 10).toFixed(1);
    return `${locale === 'tr' ? km.replace('.', ',') : km} km`;
  }
  const step = distM >= 100 ? 50 : 10;
  return `${Math.max(step, Math.round(distM / step) * step)} m`;
}

/** Adım için i18n anahtarı + parametreler (`t(key, params)` ile çevrilir). */
export function instructionText(
  step: NavigationStep,
  locale: string,
  distM: number = step.distanceM,
): Instruction {
  const key = (
    step.poiName ? `tracks.nav.withPoi.${step.maneuver}` : `tracks.nav.maneuver.${step.maneuver}`
  ) as TranslationKey;
  return {
    key,
    params: { distance: roundedDistanceLabel(distM, locale), poi: step.poiName ?? '' },
  };
}

const VOICE: Record<'tr' | 'en', Record<NavManeuver, string>> = {
  tr: {
    start: 'Rota başlıyor, {distance} boyunca ilerleyin',
    continue: '{distance} boyunca düz devam edin',
    slight_left: '{distance} sonra hafif sola',
    left: '{distance} sonra sola dönün',
    sharp_left: '{distance} sonra keskin sola dönün',
    slight_right: '{distance} sonra hafif sağa',
    right: '{distance} sonra sağa dönün',
    sharp_right: '{distance} sonra keskin sağa dönün',
    uturn: '{distance} sonra geri dönün',
    waypoint: '{distance} sonra {poi}',
    arrive: '{distance} sonra hedefe varıyorsunuz',
  },
  en: {
    start: 'Route starts, continue for {distance}',
    continue: 'Continue straight for {distance}',
    slight_left: 'In {distance}, bear left',
    left: 'In {distance}, turn left',
    sharp_left: 'In {distance}, turn sharp left',
    slight_right: 'In {distance}, bear right',
    right: 'In {distance}, turn right',
    sharp_right: 'In {distance}, turn sharp right',
    uturn: 'In {distance}, make a U-turn',
    waypoint: 'In {distance}, {poi}',
    arrive: 'In {distance}, you arrive at your destination',
  },
};

/** Sesli yönerge metni (TTS için; çeviri katmanından bağımsız kısa cümle). */
export function voiceLine(step: NavigationStep, distM: number, locale: string): string {
  const lang = locale === 'tr' ? 'tr' : 'en';
  const template = VOICE[lang][step.maneuver];
  const line = template
    .replace('{distance}', roundedDistanceLabel(distM, lang))
    .replace('{poi}', step.poiName ?? '');
  return step.poiName && step.maneuver !== 'waypoint' ? `${line} — ${step.poiName}` : line;
}

/* ------------------------------------------------------------------ */
/* GPX / Strava                                                        */
/* ------------------------------------------------------------------ */

export interface GpxWaypoint {
  name: string;
  coords: GeoPoint;
  elevationM: number | null;
  description: string;
  kind: PoiKind;
}

export interface ParsedGpx {
  name: string | null;
  points: TrackPoint[];
  waypoints: GpxWaypoint[];
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function innerTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return m ? unescapeXml(m[1]!.trim()) : null;
}

/**
 * GPX ayrıştırıcı: tüm `trkseg`'lerdeki `trkpt` (yoksa `rtept`) noktalarını lat/lon/ele/time ile
 * birleştirir; `wpt` elemanları POI adayı olarak döner. Tam XML doğrulaması yapmaz.
 */
export function parseGpxTrack(xml: string): ParsedGpx {
  const trkName = innerTag(innerTag(xml, 'trk') ?? '', 'name');
  const metaName = innerTag(innerTag(xml, 'metadata') ?? '', 'name');
  const name = trkName ?? metaName ?? null;

  const points: TrackPoint[] = [];
  const tag = /<trkpt\b/i.test(xml) ? 'trkpt' : 'rtept';
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tag}>)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const lat = parseFloat(/lat="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    const lon = parseFloat(/lon="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ele = parseFloat(/<ele>([^<]+)<\/ele>/i.exec(inner)?.[1] ?? '');
    const timeRaw = /<time>([^<]+)<\/time>/i.exec(inner)?.[1];
    const t = timeRaw ? Date.parse(timeRaw.trim()) : NaN;
    points.push({
      latitude: lat,
      longitude: lon,
      elevationM: Number.isFinite(ele) ? Math.round(ele * 10) / 10 : null,
      t: Number.isFinite(t) ? t : null,
    });
  }

  const waypoints: GpxWaypoint[] = [];
  const wre = /<wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/wpt>)/gi;
  while ((m = wre.exec(xml)) !== null) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const lat = parseFloat(/lat="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    const lon = parseFloat(/lon="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ele = parseFloat(/<ele>([^<]+)<\/ele>/i.exec(inner)?.[1] ?? '');
    const wname = innerTag(inner, 'name') ?? '';
    const desc = innerTag(inner, 'desc') ?? innerTag(inner, 'cmt') ?? '';
    const sym = innerTag(inner, 'sym') ?? '';
    const timeRaw = /<time>([^<]+)<\/time>/i.exec(inner)?.[1];
    const hour = timeRaw ? new Date(timeRaw).getHours() : 12;
    waypoints.push({
      name: wname || `WPT ${waypoints.length + 1}`,
      coords: { latitude: lat, longitude: lon },
      elevationM: Number.isFinite(ele) ? Math.round(ele) : null,
      description: desc,
      kind: poiHeuristics(`${wname} ${desc} ${sym}`, hour) ?? 'other',
    });
  }
  return { name, points, waypoints };
}

/**
 * Strava akışlarını (`latlng`, `altitude`, `time` — saniye ofseti) TrackPoint dizisine çevirir.
 * `startEpoch` ms cinsinden etkinlik başlangıcıdır.
 */
export function stravaStreamsToPoints(
  latlng: [number, number][],
  altitude: number[] | null,
  time: number[] | null,
  startEpoch: number,
): TrackPoint[] {
  const out: TrackPoint[] = [];
  latlng.forEach(([lat, lng], i) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const ele = altitude?.[i];
    const sec = time?.[i];
    out.push({
      latitude: lat,
      longitude: lng,
      elevationM: ele !== undefined && Number.isFinite(ele) ? Math.round(ele * 10) / 10 : null,
      t: sec !== undefined && Number.isFinite(sec) ? startEpoch + sec * 1000 : null,
    });
  });
  return out;
}

/**
 * Hız ve eğim profilinden macera türü tahmini: >12 km/sa bisiklet; çok hızlı + net iniş
 * yamaç paraşütü; km başına >250 m tırmanış ve >1.500 m irtifa tırmanış; kar mevsiminde
 * yüksek irtifa iniş ağırlıklı ise kayak; aksi hâlde yürüyüş.
 */
export function detectAdventureType(points: TrackPoint[], stats: TrackStats): AdventureType {
  const speed = stats.avgSpeedKmh;
  const netDrop = stats.descentM - stats.ascentM;
  if (speed !== null && speed > 30 && netDrop > 500) return 'paragliding';
  if (speed !== null && speed > 12) return 'cycling';
  const perKm = stats.distanceKm > 0 ? stats.ascentM / stats.distanceKm : 0;
  const first = points.find((p) => p.t !== null)?.t ?? null;
  const month = first !== null ? new Date(first).getMonth() : -1;
  const winter = month >= 0 && (month <= 2 || month === 11);
  if (winter && (stats.maxElevationM ?? 0) > 2000 && stats.descentM > 400) return 'skiing';
  if (perKm > 250 && (stats.maxElevationM ?? 0) > 1500) return 'climbing';
  return 'hiking';
}

/** Parça/rota noktalarını planlayıcı grafına çevirir (ardışık düğüm/kenar, yüzey `trail`). */
export function trackToGraph(trail: Pick<CommunityTrail, 'id' | 'points'>): TrailGraph {
  const nodes: TrailNode[] = [];
  const edges: TrailEdge[] = [];
  let lastKnownEle = trail.points.find((p) => p.elevationM !== null)?.elevationM ?? 0;
  trail.points.forEach((p, i) => {
    if (p.elevationM !== null) lastKnownEle = p.elevationM;
    const id = `${trail.id}_n${i}`;
    nodes.push({
      id,
      coords: { latitude: p.latitude, longitude: p.longitude },
      elevationM: Math.round(lastKnownEle),
      name: i === 0 ? 'Start' : i === trail.points.length - 1 ? 'End' : null,
    });
    if (i > 0) {
      edges.push({
        id: `${trail.id}_e${i}`,
        from: `${trail.id}_n${i - 1}`,
        to: id,
        distanceKm: round(distanceKm(trail.points[i - 1]!, p), 4),
        surface: 'trail',
        profiles: [...ROUTE_PROFILES],
        technical: 0.1,
      });
    }
  });
  return { regionId: trail.id, nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Filtre / yakınlık / doğrulama                                       */
/* ------------------------------------------------------------------ */

/** Parça listesini metin, tür, sahiplik ve yarıçapa göre süzer. */
export function filterTracks<T extends Track>(tracks: T[], filter: TrackFilter, meId: ID): T[] {
  const q = filter.query?.trim().toLocaleLowerCase('tr-TR') ?? '';
  return tracks.filter((t) => {
    if (filter.mineOnly && t.userId !== meId) return false;
    if (!filter.mineOnly && t.userId !== meId && !t.isPublic) return false;
    if (filter.adventureType && t.adventureType !== filter.adventureType) return false;
    if (q && !`${t.name} ${t.regionName}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
    if (filter.origin && filter.radiusKm && t.points[0]) {
      if (distanceKm(filter.origin, t.points[0]) > filter.radiusKm) return false;
    }
    return true;
  });
}

/** Yarıçap içindeki POI'ler, mesafeye göre sıralı. */
export function nearbyPois(
  pois: TrackPoi[],
  origin: GeoPoint,
  radiusKm: number,
  kind: PoiKind | null = null,
  confirmedIds: Set<ID> = new Set(),
): TrackPoiWithDistance[] {
  return pois
    .filter((p) => !kind || p.kind === kind)
    .map((p) => ({ ...p, distanceKm: round(distanceKm(origin, p.coords)), confirmedByMe: confirmedIds.has(p.id) }))
    .filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/** Çizginin `radiusM` koridorundaki POI'ler (rota boyunca sıralı). */
export function poisAlong(points: TrackPoint[], pois: TrackPoi[], radiusM = 120): TrackPoi[] {
  return pois
    .map((p) => ({ p, proj: projectOnTrack(points, p.coords) }))
    .filter((x) => x.proj && x.proj.offM <= radiusM)
    .sort((a, b) => a.proj!.alongM - b.proj!.alongM)
    .map((x) => x.p);
}

/** Doğrulama sayısı eşiğe ulaştı mı? */
export function verifyThreshold(verifiedCount: number): boolean {
  return verifiedCount >= VERIFY_THRESHOLD;
}

/** Parçanın durumu: 3+ doğrulamalı topluluk rotasına bağlıysa `verified` */
export function statusFor(track: Pick<Track, 'status'>, trail: CommunityTrail | null): Track['status'] {
  if (track.status === 'draft') return 'draft';
  return trail && verifyThreshold(trail.verifiedCount) ? 'verified' : 'published';
}
