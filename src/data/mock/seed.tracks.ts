import type {
  AdventureType,
  CommunityTrail,
  Track,
  TrackPoi,
  TrackPoint,
  TrackSource,
  TrackStatus,
} from '@/domain';
import { toblerSpeedKmh } from '@/domain/routing';
import {
  bearing,
  clusterTracks,
  destinationPoint,
  distanceM,
  pointAtDistance,
  trackStats,
} from '@/domain/tracks';

/* ------------------------------------------------------------------ */
/* Üreteç yardımcıları (deterministik)                                 */
/* ------------------------------------------------------------------ */

/** mulberry32 — tohumlu sözde rastgele üreteç; seed verisi her yüklemede aynı kalır */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [enlem, boylam, yükseklik] çapa noktaları */
type Anchor = [number, number, number];

interface TrackSpec {
  id: string;
  userId: string;
  name: string;
  adventureType: AdventureType;
  source: TrackSource;
  status: TrackStatus;
  anchors: Anchor[];
  /** Başlangıç zamanı (ISO) */
  startedAt: string;
  seed: number;
  pointCount: number;
  /** Tobler hızına çarpan (1 = ortalama yürüyüşçü) */
  speedFactor: number;
  /** Duraklama: kaç dakika mola (orta noktada) */
  breakMin?: number;
  regionName: string;
  countryCode: string;
  isPublic: boolean;
  likesCount: number;
  jitterM?: number;
}

/**
 * Çapa noktaları arasında yürüyen, patika kıvrımı (sinüs) + GPS gürültüsü (tohumlu) ekleyen
 * ve Tobler hız modeliyle zaman damgası üreten nokta üreteci.
 */
function generatePoints(spec: TrackSpec): TrackPoint[] {
  const rand = rng(spec.seed);
  const anchors = spec.anchors.map(([latitude, longitude, elevationM]) => ({
    latitude,
    longitude,
    elevationM,
    t: null,
  }));
  const segLens = anchors.slice(1).map((a, i) => distanceM(anchors[i]!, a));
  const total = segLens.reduce((s, v) => s + v, 0);
  const jitter = spec.jitterM ?? 6;
  const start = Date.parse(spec.startedAt);
  const out: TrackPoint[] = [];
  let clock = start;
  let prev: TrackPoint | null = null;

  for (let i = 0; i < spec.pointCount; i++) {
    const along = (total * i) / (spec.pointCount - 1);
    const base = pointAtDistance(anchors, along)!;
    // Segment yönü → dik yönde patika kıvrımı ve gürültü
    const ahead = pointAtDistance(anchors, Math.min(total, along + 20))!;
    const behind = pointAtDistance(anchors, Math.max(0, along - 20))!;
    const dir = bearing(behind, ahead);
    const wiggle = Math.sin(along / 70) * 14 + Math.sin(along / 230) * 22;
    const noise = (rand() - 0.5) * 2 * jitter;
    const shifted = destinationPoint(base, dir + 90, wiggle + noise);
    const elevation = Math.round(((base.elevationM ?? 0) + (rand() - 0.5) * 4) * 10) / 10;
    const point: TrackPoint = {
      latitude: Math.round(shifted.latitude * 1e6) / 1e6,
      longitude: Math.round(shifted.longitude * 1e6) / 1e6,
      elevationM: elevation,
      t: clock,
    };
    if (prev) {
      const d = distanceM(prev, point);
      const slope = ((point.elevationM ?? 0) - (prev.elevationM ?? 0)) / Math.max(1, d);
      const speed = Math.max(0.6, toblerSpeedKmh(slope) * spec.speedFactor);
      clock += (d / 1000 / speed) * 3_600_000 * (0.9 + rand() * 0.2);
      if (spec.breakMin && i === Math.floor(spec.pointCount / 2)) clock += spec.breakMin * 60_000;
      point.t = Math.round(clock);
    }
    out.push(point);
    prev = point;
  }
  return out;
}

function makeTrack(spec: TrackSpec): Track {
  const points = generatePoints(spec);
  const stats = trackStats(points);
  return {
    id: spec.id,
    userId: spec.userId,
    name: spec.name,
    adventureType: spec.adventureType,
    source: spec.source,
    status: spec.status,
    points,
    distanceKm: stats.distanceKm,
    ascentM: stats.ascentM,
    descentM: stats.descentM,
    durationMin: stats.durationMin,
    maxElevationM: stats.maxElevationM,
    startedAt: spec.startedAt,
    regionName: spec.regionName,
    countryCode: spec.countryCode,
    isPublic: spec.isPublic,
    likesCount: spec.likesCount,
    communityTrailId: null,
    createdAt: new Date(
      Date.parse(spec.startedAt) + stats.durationMin * 60_000 + 3_600_000,
    ).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Güzergâhlar                                                         */
/* ------------------------------------------------------------------ */

const AYDER_KAVRUN: Anchor[] = [
  [40.9503, 41.1042, 1310],
  [40.9441, 41.1108, 1420],
  [40.9368, 41.1196, 1540],
  [40.9296, 41.1274, 1690],
  [40.9214, 41.1352, 1830],
  [40.9127, 41.1428, 1960],
  [40.9036, 41.1512, 2080],
  [40.8944, 41.1578, 2150],
  [40.8878, 41.1604, 2190],
];

const KABAK_ALINCA: Anchor[] = [
  [36.4998, 29.1382, 62],
  [36.4961, 29.1338, 165],
  [36.4924, 29.1298, 300],
  [36.4878, 29.1262, 455],
  [36.4822, 29.1236, 560],
  [36.4762, 29.1218, 660],
  [36.4706, 29.1204, 735],
];

const KIZILCUKUR: Anchor[] = [
  [38.6702, 34.8398, 1052],
  [38.6668, 34.8471, 1085],
  [38.6631, 34.8548, 1132],
  [38.6588, 34.8631, 1176],
  [38.6562, 34.8704, 1198],
  [38.6604, 34.8762, 1150],
  [38.6664, 34.8712, 1104],
  [38.6698, 34.8622, 1078],
  [38.6724, 34.8489, 1060],
];

const AYDOS: Anchor[] = [
  [40.9382, 29.2418, 188],
  [40.9346, 29.2466, 262],
  [40.9304, 29.2518, 384],
  [40.9271, 29.2562, 522],
  [40.9252, 29.2604, 498],
  [40.9288, 29.2652, 376],
  [40.9338, 29.2604, 258],
  [40.9382, 29.2502, 204],
];

const BELGRAD: Anchor[] = [
  [41.1822, 28.9882, 118],
  [41.1868, 28.9924, 142],
  [41.1922, 28.9992, 161],
  [41.1948, 29.0072, 152],
  [41.1902, 29.0124, 136],
  [41.1852, 29.0062, 124],
  [41.1818, 28.9962, 117],
];

const ULUDAG: Anchor[] = [
  [40.1004, 29.1502, 1648],
  [40.0952, 29.1652, 1798],
  [40.0902, 29.1804, 1952],
  [40.0852, 29.1952, 2148],
  [40.0792, 29.2054, 2322],
  [40.0732, 29.2152, 2461],
  [40.0702, 29.2222, 2543],
];

const YEDIGOLLER: Anchor[] = [
  [40.9412, 31.7472, 792],
  [40.9448, 31.7512, 812],
  [40.9486, 31.7566, 836],
  [40.9502, 31.7632, 852],
  [40.9472, 31.7688, 828],
  [40.9432, 31.7642, 806],
  [40.9406, 31.7562, 798],
  [40.9412, 31.7472, 792],
];

const GEYIKBAYIRI: Anchor[] = [
  [36.9352, 30.5148, 298],
  [36.9378, 30.5176, 338],
  [36.9402, 30.5202, 382],
  [36.9422, 30.5224, 424],
];

const KAS_SAHIL: Anchor[] = [
  [36.2002, 29.6404, 8],
  [36.1972, 29.6448, 34],
  [36.1944, 29.6502, 58],
  [36.1922, 29.6556, 46],
  [36.1904, 29.6604, 22],
];

const ERCIYES: Anchor[] = [
  [38.5502, 35.4802, 2152],
  [38.5452, 35.4702, 2498],
  [38.5402, 35.4602, 2896],
  [38.5352, 35.4522, 3248],
  [38.5322, 35.4472, 3496],
  [38.5352, 35.4522, 3248],
  [38.5402, 35.4602, 2896],
  [38.5452, 35.4702, 2498],
  [38.5502, 35.4802, 2152],
];

/* ------------------------------------------------------------------ */
/* Parçalar                                                            */
/* ------------------------------------------------------------------ */

const specs: TrackSpec[] = [
  {
    id: 'trk_ayder_kavrun_me',
    userId: 'u_me',
    name: 'Ayder – Kavrun Yaylası',
    adventureType: 'hiking',
    source: 'recorded',
    status: 'published',
    anchors: AYDER_KAVRUN,
    startedAt: '2026-08-15T05:40:00.000Z',
    seed: 11,
    pointCount: 118,
    speedFactor: 0.95,
    breakMin: 25,
    regionName: 'Kaçkar Dağları, Rize',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 24,
  },
  {
    id: 'trk_ayder_kavrun_elif',
    userId: 'u_elif',
    name: 'Kavrun çıkışı (Strava)',
    adventureType: 'hiking',
    source: 'strava',
    status: 'published',
    anchors: AYDER_KAVRUN,
    startedAt: '2026-07-28T04:55:00.000Z',
    seed: 23,
    pointCount: 96,
    speedFactor: 1.15,
    regionName: 'Kaçkar Dağları, Rize',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 61,
    jitterM: 8,
  },
  {
    id: 'trk_kabak_alinca_can',
    userId: 'u_can',
    name: 'Kabak – Alınca (Likya Yolu)',
    adventureType: 'hiking',
    source: 'komoot',
    status: 'published',
    anchors: KABAK_ALINCA,
    startedAt: '2026-05-03T06:10:00.000Z',
    seed: 37,
    pointCount: 72,
    speedFactor: 0.9,
    regionName: 'Likya Yolu, Fethiye',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 38,
  },
  {
    id: 'trk_kabak_alinca_zeynep',
    userId: 'u_zeynep',
    name: 'Alınca tırmanışı',
    adventureType: 'hiking',
    source: 'wikiloc',
    status: 'published',
    anchors: KABAK_ALINCA,
    startedAt: '2026-04-19T07:20:00.000Z',
    seed: 41,
    pointCount: 64,
    speedFactor: 1.0,
    regionName: 'Likya Yolu, Fethiye',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 17,
    jitterM: 7,
  },
  {
    id: 'trk_kizilcukur_me',
    userId: 'u_me',
    name: 'Kızılçukur gün batımı turu',
    adventureType: 'hiking',
    source: 'gpx',
    status: 'published',
    anchors: KIZILCUKUR,
    startedAt: '2026-06-21T14:30:00.000Z',
    seed: 53,
    pointCount: 88,
    speedFactor: 1.05,
    breakMin: 20,
    regionName: 'Kapadokya, Nevşehir',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 45,
  },
  {
    id: 'trk_kizilcukur_mert',
    userId: 'u_mert',
    name: 'Rose Valley loop',
    adventureType: 'hiking',
    source: 'alltrails',
    status: 'published',
    anchors: KIZILCUKUR,
    startedAt: '2026-05-30T15:05:00.000Z',
    seed: 59,
    pointCount: 74,
    speedFactor: 1.1,
    regionName: 'Kapadokya, Nevşehir',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 29,
    jitterM: 9,
  },
  {
    id: 'trk_aydos_me',
    userId: 'u_me',
    name: 'Aydos Ormanı tepe turu',
    adventureType: 'hiking',
    source: 'recorded',
    status: 'draft',
    anchors: AYDOS,
    startedAt: '2026-09-01T06:05:00.000Z',
    seed: 67,
    pointCount: 60,
    speedFactor: 1.1,
    regionName: 'Aydos Ormanı, İstanbul',
    countryCode: 'TR',
    isPublic: false,
    likesCount: 0,
  },
  {
    id: 'trk_belgrad_baris',
    userId: 'u_baris',
    name: 'Belgrad Ormanı sabah turu',
    adventureType: 'hiking',
    source: 'recorded',
    status: 'published',
    anchors: BELGRAD,
    startedAt: '2026-08-30T05:30:00.000Z',
    seed: 71,
    pointCount: 52,
    speedFactor: 1.3,
    regionName: 'Belgrad Ormanı, İstanbul',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 12,
  },
  {
    id: 'trk_uludag_selin',
    userId: 'u_selin',
    name: 'Sarıalan – Uludağ zirve',
    adventureType: 'hiking',
    source: 'gpx',
    status: 'published',
    anchors: ULUDAG,
    startedAt: '2026-07-12T04:15:00.000Z',
    seed: 79,
    pointCount: 104,
    speedFactor: 0.85,
    breakMin: 30,
    regionName: 'Uludağ, Bursa',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 53,
  },
  {
    id: 'trk_yedigoller_ayse',
    userId: 'u_ayse',
    name: 'Yedigöller göl turu',
    adventureType: 'hiking',
    source: 'recorded',
    status: 'published',
    anchors: YEDIGOLLER,
    startedAt: '2026-08-08T07:00:00.000Z',
    seed: 83,
    pointCount: 66,
    speedFactor: 1.0,
    regionName: 'Yedigöller, Bolu',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 21,
  },
  {
    id: 'trk_geyikbayiri_emre',
    userId: 'u_emre',
    name: 'Trebenna yaklaşımı',
    adventureType: 'climbing',
    source: 'recorded',
    status: 'published',
    anchors: GEYIKBAYIRI,
    startedAt: '2026-03-14T06:40:00.000Z',
    seed: 89,
    pointCount: 42,
    speedFactor: 0.9,
    regionName: 'Geyikbayırı, Antalya',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 9,
  },
  {
    id: 'trk_kas_lale',
    userId: 'u_lale',
    name: 'Kaş – Limanağzı sahil yürüyüşü',
    adventureType: 'hiking',
    source: 'strava',
    status: 'published',
    anchors: KAS_SAHIL,
    startedAt: '2026-06-02T15:45:00.000Z',
    seed: 97,
    pointCount: 48,
    speedFactor: 1.05,
    regionName: 'Kaş, Antalya',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 15,
  },
  {
    id: 'trk_erciyes_kerem',
    userId: 'u_kerem',
    name: 'Erciyes tur kayağı — Tekir Kapı',
    adventureType: 'skiing',
    source: 'garmin',
    status: 'published',
    anchors: ERCIYES,
    startedAt: '2026-02-21T05:00:00.000Z',
    seed: 101,
    pointCount: 112,
    speedFactor: 1.2,
    breakMin: 35,
    regionName: 'Erciyes, Kayseri',
    countryCode: 'TR',
    isPublic: true,
    likesCount: 77,
  },
];

export const seedTracks: Track[] = specs.map(makeTrack);

/* ------------------------------------------------------------------ */
/* Topluluk rotaları (clusterTracks ile tutarlı)                       */
/* ------------------------------------------------------------------ */

const SEED_NOW = '2026-09-03T09:00:00.000Z';

/** Küme → sabit id/ad/doğrulama sayısı (parça id'sine göre eşleme) */
const TRAIL_META: { anchorTrack: string; id: string; name: string; verifiedCount: number }[] = [
  {
    anchorTrack: 'trk_ayder_kavrun_me',
    id: 'ct_ayder_kavrun',
    name: 'Ayder – Kavrun Yaylası',
    verifiedCount: 4,
  },
  {
    anchorTrack: 'trk_kabak_alinca_can',
    id: 'ct_kabak_alinca',
    name: 'Kabak – Alınca (Likya Yolu)',
    verifiedCount: 2,
  },
  {
    anchorTrack: 'trk_kizilcukur_me',
    id: 'ct_kizilcukur',
    name: 'Kızılçukur – Güllüdere turu',
    verifiedCount: 3,
  },
];

export const seedCommunityTrails: CommunityTrail[] = clusterTracks(
  seedTracks.filter((t) => t.status !== 'draft' && t.isPublic),
  { now: SEED_NOW },
).flatMap(({ trail, trackIds }) => {
  const meta = TRAIL_META.find((m) => trackIds.includes(m.anchorTrack));
  if (!meta) return [];
  for (const track of seedTracks) if (trackIds.includes(track.id)) track.communityTrailId = meta.id;
  return [
    {
      ...trail,
      id: meta.id,
      name: meta.name,
      verifiedCount: meta.verifiedCount,
      createdAt: '2026-06-01T10:00:00.000Z',
    },
  ];
});

/* ------------------------------------------------------------------ */
/* POI'ler                                                             */
/* ------------------------------------------------------------------ */

/** Parçanın uzunluğunun `fraction` oranındaki koordinat (rota üzerinde) */
function along(trackId: string, fraction: number) {
  const track = seedTracks.find((t) => t.id === trackId)!;
  const p = pointAtDistance(track.points, track.distanceKm * 1000 * fraction)!;
  return {
    coords: { latitude: p.latitude, longitude: p.longitude },
    elevationM: p.elevationM === null ? null : Math.round(p.elevationM),
  };
}

const trailIdOf = (trackId: string) =>
  seedTracks.find((t) => t.id === trackId)?.communityTrailId ?? null;

type PoiSeed = Omit<TrackPoi, 'coords' | 'elevationM' | 'communityTrailId'> & {
  at?: [string, number];
  coords?: TrackPoi['coords'];
  elevationM?: number | null;
};

function poi(input: PoiSeed): TrackPoi {
  const { at, ...rest } = input;
  const pos = at
    ? along(at[0], at[1])
    : { coords: input.coords!, elevationM: input.elevationM ?? null };
  return {
    ...rest,
    coords: pos.coords,
    elevationM: pos.elevationM,
    communityTrailId: rest.trackId ? trailIdOf(rest.trackId) : null,
  };
}

export const seedTrackPois: TrackPoi[] = [
  poi({
    id: 'poi_kavrun_camp',
    trackId: 'trk_ayder_kavrun_me',
    userId: 'u_me',
    kind: 'campsite',
    at: ['trk_ayder_kavrun_me', 0.97],
    name: 'Kavrun Yaylası kamp alanı',
    note: 'Düz çayır, yayla evlerinin 200 m yukarısı. Gece rüzgâr alır, kazıkları sağlam çakın.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 5,
    createdAt: '2026-08-15T14:20:00.000Z',
  }),
  poi({
    id: 'poi_hazindak_water',
    trackId: 'trk_ayder_kavrun_me',
    userId: 'u_elif',
    kind: 'water',
    at: ['trk_ayder_kavrun_me', 0.42],
    name: 'Hazindak çeşmesi',
    note: 'Yol kenarında akan pınar, yaz sonu bile kurumuyor.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 7,
    createdAt: '2026-07-28T08:10:00.000Z',
  }),
  poi({
    id: 'poi_ayder_view',
    trackId: 'trk_ayder_kavrun_me',
    userId: 'u_elif',
    kind: 'viewpoint',
    at: ['trk_ayder_kavrun_me', 0.68],
    name: 'Kaçkar manzara noktası',
    note: 'Açık havada Kaçkar zirvesi tam karşıda.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 3,
    createdAt: '2026-07-28T09:30:00.000Z',
  }),
  poi({
    id: 'poi_ayder_junction',
    trackId: 'trk_ayder_kavrun_elif',
    userId: 'u_elif',
    kind: 'junction',
    at: ['trk_ayder_kavrun_elif', 0.22],
    name: 'Hazindak / Yukarı Kavrun ayrımı',
    note: 'Sağdaki patika Hazindak yaylasına gider; Kavrun için sola.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 2,
    createdAt: '2026-07-28T06:40:00.000Z',
  }),
  poi({
    id: 'poi_kabak_camp',
    trackId: 'trk_kabak_alinca_can',
    userId: 'u_can',
    kind: 'campsite',
    at: ['trk_kabak_alinca_can', 0.03],
    name: 'Kabak Koyu kamp',
    note: 'Sahilde çadır alanı; işletmelerde duş ve tuvalet ücretli.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 4,
    createdAt: '2026-05-03T06:15:00.000Z',
  }),
  poi({
    id: 'poi_kabak_water',
    trackId: 'trk_kabak_alinca_can',
    userId: 'u_zeynep',
    kind: 'water',
    at: ['trk_kabak_alinca_can', 0.55],
    name: 'Alınca yolu çeşmesi',
    note: 'Taş çeşme, yazın akış zayıf.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 2,
    createdAt: '2026-04-19T09:00:00.000Z',
  }),
  poi({
    id: 'poi_alinca_view',
    trackId: 'trk_kabak_alinca_zeynep',
    userId: 'u_zeynep',
    kind: 'viewpoint',
    at: ['trk_kabak_alinca_zeynep', 0.98],
    name: 'Alınca köyü terası',
    note: 'Kabak Koyu ve Yediburunlar ayak altında; köy kahvesinde çay.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 6,
    createdAt: '2026-04-19T10:20:00.000Z',
  }),
  poi({
    id: 'poi_kizilcukur_sunset',
    trackId: 'trk_kizilcukur_me',
    userId: 'u_me',
    kind: 'viewpoint',
    at: ['trk_kizilcukur_me', 0.48],
    name: 'Kızılçukur gün batımı terası',
    note: 'Kayalar kırmızıya döner; 30 dk önce gelin.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 8,
    createdAt: '2026-06-21T17:40:00.000Z',
  }),
  poi({
    id: 'poi_kizilcukur_junction',
    trackId: 'trk_kizilcukur_mert',
    userId: 'u_mert',
    kind: 'junction',
    at: ['trk_kizilcukur_mert', 0.3],
    name: 'Güllüdere ayrımı',
    note: 'Tabelasız ayrım — vadi tabanı yerine sağdaki yükselen patika.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 1,
    createdAt: '2026-05-30T15:50:00.000Z',
  }),
  poi({
    id: 'poi_kizilcukur_food',
    trackId: 'trk_kizilcukur_me',
    userId: 'u_me',
    kind: 'food',
    at: ['trk_kizilcukur_me', 0.62],
    name: 'Vadi içi çay bahçesi',
    note: 'Taze sıkılmış nar suyu ve gözleme; nakit.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 3,
    createdAt: '2026-06-21T18:10:00.000Z',
  }),
  poi({
    id: 'poi_aydos_parking',
    trackId: 'trk_aydos_me',
    userId: 'u_me',
    kind: 'parking',
    at: ['trk_aydos_me', 0.0],
    name: 'Aydos Ormanı otoparkı',
    note: 'Ücretsiz, hafta sonu 09:00 sonrası dolar.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 0,
    createdAt: '2026-09-01T06:05:00.000Z',
  }),
  poi({
    id: 'poi_aydos_summit',
    trackId: 'trk_aydos_me',
    userId: 'u_me',
    kind: 'summit',
    at: ['trk_aydos_me', 0.45],
    name: 'Aydos Tepesi (537 m)',
    note: 'İstanbul’un en yüksek noktası; kale kalıntıları.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 0,
    createdAt: '2026-09-01T07:20:00.000Z',
  }),
  poi({
    id: 'poi_belgrad_water',
    trackId: 'trk_belgrad_baris',
    userId: 'u_baris',
    kind: 'water',
    at: ['trk_belgrad_baris', 0.36],
    name: 'Neşetsuyu çeşmesi',
    note: 'Tarihî çeşme; suyu içilebilir.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 9,
    createdAt: '2026-08-30T06:20:00.000Z',
  }),
  poi({
    id: 'poi_uludag_shelter',
    trackId: 'trk_uludag_selin',
    userId: 'u_selin',
    kind: 'shelter',
    at: ['trk_uludag_selin', 0.66],
    name: 'Kirazlıyayla dağ evi',
    note: 'Kapalı taş barınak; fırtınada sığınak.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 4,
    createdAt: '2026-07-12T08:40:00.000Z',
  }),
  poi({
    id: 'poi_uludag_danger',
    trackId: 'trk_uludag_selin',
    userId: 'u_selin',
    kind: 'danger',
    at: ['trk_uludag_selin', 0.88],
    name: 'Zirve öncesi kaya düşmesi',
    note: 'Gevşek moloz; kask önerilir, arka arkaya yürümeyin.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 2,
    createdAt: '2026-07-12T10:05:00.000Z',
  }),
  poi({
    id: 'poi_yedigoller_camp',
    trackId: 'trk_yedigoller_ayse',
    userId: 'u_ayse',
    kind: 'campsite',
    at: ['trk_yedigoller_ayse', 0.52],
    name: 'Büyükgöl kamp alanı',
    note: 'Millî park kamp alanı; ücretli, masa-ocak var.',
    photoUrl: null,
    source: 'user',
    mediaId: null,
    confirmations: 5,
    createdAt: '2026-08-08T09:30:00.000Z',
  }),
  poi({
    id: 'poi_agri_camp_stream',
    trackId: null,
    userId: 'u_kerem',
    kind: 'campsite',
    coords: { latitude: 39.7, longitude: 44.3 },
    elevationM: 4200,
    name: 'Ağrı Dağı 4.200 m kampı',
    note: 'Canlı yayından türetildi: gece çıkışı öncesi yüksek kamp.',
    photoUrl: null,
    source: 'stream',
    mediaId: 's1',
    confirmations: 2,
    createdAt: '2026-09-02T22:10:00.000Z',
  }),
  poi({
    id: 'poi_erciyes_summit_stream',
    trackId: 'trk_erciyes_kerem',
    userId: 'u_selin',
    kind: 'summit',
    at: ['trk_erciyes_kerem', 0.5],
    name: 'Erciyes zirve platosu',
    note: 'Canlı yayından türetildi: Tekir Kapı’dan zirveye tur kayağı.',
    photoUrl: null,
    source: 'stream',
    mediaId: 's6',
    confirmations: 3,
    createdAt: '2026-02-21T09:40:00.000Z',
  }),
];

/* ------------------------------------------------------------------ */
/* POI onayları                                                        */
/* ------------------------------------------------------------------ */

export const seedPoiConfirmations: { userId: string; poiId: string }[] = [
  { userId: 'u_me', poiId: 'poi_hazindak_water' },
  { userId: 'u_me', poiId: 'poi_ayder_view' },
  { userId: 'u_elif', poiId: 'poi_kavrun_camp' },
  { userId: 'u_can', poiId: 'poi_alinca_view' },
  { userId: 'u_zeynep', poiId: 'poi_kabak_camp' },
  { userId: 'u_mert', poiId: 'poi_kizilcukur_sunset' },
];
