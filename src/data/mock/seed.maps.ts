import type {
  GeoPoint,
  ID,
  MapPack,
  RouteProfile,
  SavedRoute,
  Surface,
  TrailEdge,
  TrailGraph,
  TrailNode,
} from '@/domain';
import { distanceKm } from '@/domain/geo';
import { planRoute } from '@/domain/routing';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const FOOT: RouteProfile[] = ['hike', 'trail_run'];
const FOOT_MTB: RouteProfile[] = ['hike', 'trail_run', 'mtb'];
const WHEELS: RouteProfile[] = ['hike', 'trail_run', 'mtb', 'gravel'];
const ALPINE: RouteProfile[] = ['hike', 'ski_tour'];

function node(
  id: ID,
  name: string | null,
  lat: number,
  lng: number,
  elevationM: number,
): TrailNode {
  return { id, name, coords: { latitude: lat, longitude: lng }, elevationM };
}

interface EdgeSpec {
  from: ID;
  to: ID;
  surface: Surface;
  technical: number;
  profiles: RouteProfile[];
  /** Patika kıvrım katsayısı (kuş uçuşu × katsayı) */
  winding?: number;
}

/** Kenar mesafelerini düğüm koordinatlarından türetir; böylece graf tutarlı kalır. */
function buildGraph(regionId: ID, nodes: TrailNode[], specs: EdgeSpec[]): TrailGraph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: TrailEdge[] = specs.map((s, i) => {
    const a = byId.get(s.from);
    const b = byId.get(s.to);
    if (!a || !b) throw new Error(`seed.maps: bilinmeyen düğüm ${s.from}/${s.to}`);
    const straight = distanceKm(a.coords, b.coords);
    return {
      id: `${regionId}_e${i + 1}`,
      from: s.from,
      to: s.to,
      distanceKm: Math.round(straight * (s.winding ?? 1.3) * 100) / 100,
      surface: s.surface,
      technical: s.technical,
      profiles: s.profiles,
    };
  });
  return { regionId, nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Bölgeler                                                            */
/* ------------------------------------------------------------------ */

export const seedMapRegions: { id: ID; name: string; countryCode: string; center: GeoPoint }[] = [
  {
    id: 'reg_kackar',
    name: 'Kaçkar Dağları',
    countryCode: 'TR',
    center: { latitude: 40.88, longitude: 41.13 },
  },
  {
    id: 'reg_likya',
    name: 'Likya Yolu',
    countryCode: 'TR',
    center: { latitude: 36.49, longitude: 29.14 },
  },
  {
    id: 'reg_kapadokya',
    name: 'Kapadokya',
    countryCode: 'TR',
    center: { latitude: 38.65, longitude: 34.84 },
  },
  {
    id: 'reg_aladaglar',
    name: 'Aladağlar',
    countryCode: 'TR',
    center: { latitude: 37.79, longitude: 35.15 },
  },
];

/* ------------------------------------------------------------------ */
/* Kaçkar — Ayder / Kavrun / Dilberdüzü / Zirve                        */
/* ------------------------------------------------------------------ */

const kackar = buildGraph(
  'reg_kackar',
  [
    node('kc_ayder', 'Ayder Yaylası', 40.9506, 41.1006, 1350),
    node('kc_galer', 'Galer Düzü', 40.943, 41.11, 1650),
    node('kc_huser', 'Huser Yaylası', 40.968, 41.055, 2150),
    node('kc_pokut', 'Pokut Yaylası', 40.97, 41.02, 2000),
    node('kc_sal', 'Sal Yaylası', 40.962, 41.036, 1950),
    node('kc_elevit', 'Elevit Yaylası', 40.928, 41.105, 1800),
    node('kc_asagi_kavrun', 'Aşağı Kavrun', 40.905, 41.132, 2000),
    node('kc_kavrun', 'Yukarı Kavrun Yaylası', 40.8865, 41.142, 2300),
    node('kc_avusor', 'Avusor Yaylası', 40.905, 41.165, 2350),
    node('kc_kus_golu', 'Avusor Kuş Gölü', 40.894, 41.185, 2850),
    node('kc_gecit', 'Kavrun Geçidi', 40.862, 41.148, 3120),
    node('kc_dilberduzu', 'Dilberdüzü', 40.851, 41.1665, 2930),
    node('kc_deniz_golu', 'Deniz Gölü', 40.842, 41.162, 3410),
    node('kc_zirve', 'Kaçkar Zirvesi', 40.8355, 41.1583, 3937),
    node('kc_olgunlar', 'Olgunlar', 40.826, 41.196, 2130),
    node('kc_yaylalar', 'Yaylalar (Hevek)', 40.815, 41.22, 2020),
  ],
  [
    {
      from: 'kc_ayder',
      to: 'kc_galer',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.5,
    },
    {
      from: 'kc_ayder',
      to: 'kc_huser',
      surface: 'gravel',
      technical: 0.15,
      profiles: WHEELS,
      winding: 1.8,
    },
    {
      from: 'kc_huser',
      to: 'kc_sal',
      surface: 'trail',
      technical: 0.2,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'kc_sal',
      to: 'kc_pokut',
      surface: 'trail',
      technical: 0.15,
      profiles: FOOT_MTB,
      winding: 1.2,
    },
    {
      from: 'kc_galer',
      to: 'kc_elevit',
      surface: 'gravel',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'kc_elevit',
      to: 'kc_asagi_kavrun',
      surface: 'gravel',
      technical: 0.25,
      profiles: WHEELS,
      winding: 1.5,
    },
    {
      from: 'kc_galer',
      to: 'kc_asagi_kavrun',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.3,
    },
    {
      from: 'kc_asagi_kavrun',
      to: 'kc_kavrun',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'kc_asagi_kavrun',
      to: 'kc_avusor',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT,
      winding: 1.3,
    },
    {
      from: 'kc_avusor',
      to: 'kc_kus_golu',
      surface: 'rock',
      technical: 0.55,
      profiles: FOOT,
      winding: 1.35,
    },
    {
      from: 'kc_kavrun',
      to: 'kc_gecit',
      surface: 'scree',
      technical: 0.65,
      profiles: ALPINE,
      winding: 1.35,
    },
    {
      from: 'kc_gecit',
      to: 'kc_dilberduzu',
      surface: 'scree',
      technical: 0.6,
      profiles: ALPINE,
      winding: 1.3,
    },
    {
      from: 'kc_dilberduzu',
      to: 'kc_deniz_golu',
      surface: 'rock',
      technical: 0.7,
      profiles: ALPINE,
      winding: 1.4,
    },
    {
      from: 'kc_deniz_golu',
      to: 'kc_zirve',
      surface: 'snow',
      technical: 0.9,
      profiles: ALPINE,
      winding: 1.5,
    },
    {
      from: 'kc_dilberduzu',
      to: 'kc_olgunlar',
      surface: 'trail',
      technical: 0.4,
      profiles: FOOT,
      winding: 1.6,
    },
    {
      from: 'kc_olgunlar',
      to: 'kc_yaylalar',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'kc_kus_golu',
      to: 'kc_dilberduzu',
      surface: 'scree',
      technical: 0.75,
      profiles: ['hike'],
      winding: 1.5,
    },
    {
      from: 'kc_avusor',
      to: 'kc_kavrun',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.3,
    },
    {
      from: 'kc_kavrun',
      to: 'kc_dilberduzu',
      surface: 'rock',
      technical: 0.8,
      profiles: ['hike'],
      winding: 1.5,
    },
  ],
);

/* ------------------------------------------------------------------ */
/* Likya Yolu — Ölüdeniz / Faralya / Kabak / Alınca                    */
/* ------------------------------------------------------------------ */

const likya = buildGraph(
  'reg_likya',
  [
    node('ly_ovacik', 'Ovacık (Likya Yolu başlangıcı)', 36.565, 29.145, 200),
    node('ly_oludeniz', 'Ölüdeniz', 36.55, 29.115, 10),
    node('ly_kidrak', 'Kıdrak Koyu', 36.535, 29.118, 15),
    node('ly_kozagac', 'Kozağaç', 36.545, 29.16, 650),
    node('ly_kirme', 'Kirme', 36.52, 29.135, 520),
    node('ly_babadag', 'Babadağ Yamacı', 36.53, 29.19, 1250),
    node('ly_faralya', 'Faralya', 36.5, 29.13, 380),
    node('ly_kelebekler', 'Kelebekler Vadisi', 36.507, 29.118, 5),
    node('ly_kabak_koy', 'Kabak Köyü', 36.482, 29.136, 380),
    node('ly_kabak_plaj', 'Kabak Koyu', 36.474, 29.128, 20),
    node('ly_alinca', 'Alınca', 36.455, 29.152, 760),
    node('ly_gey', 'Gey', 36.437, 29.185, 830),
    node('ly_bel', 'Bel', 36.428, 29.21, 720),
    node('ly_sidyma', 'Sidyma (Dodurga)', 36.41, 29.235, 640),
  ],
  [
    {
      from: 'ly_ovacik',
      to: 'ly_kozagac',
      surface: 'gravel',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.5,
    },
    {
      from: 'ly_ovacik',
      to: 'ly_oludeniz',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.2,
    },
    {
      from: 'ly_oludeniz',
      to: 'ly_kidrak',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'ly_kozagac',
      to: 'ly_kirme',
      surface: 'gravel',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'ly_kozagac',
      to: 'ly_babadag',
      surface: 'trail',
      technical: 0.4,
      profiles: FOOT_MTB,
      winding: 1.5,
    },
    {
      from: 'ly_kidrak',
      to: 'ly_kirme',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'ly_kirme',
      to: 'ly_faralya',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'ly_faralya',
      to: 'ly_kelebekler',
      surface: 'rock',
      technical: 0.85,
      profiles: ['hike'],
      winding: 1.6,
    },
    {
      from: 'ly_faralya',
      to: 'ly_kabak_koy',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'ly_kirme',
      to: 'ly_kabak_koy',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.6,
    },
    {
      from: 'ly_kabak_koy',
      to: 'ly_kabak_plaj',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'ly_kabak_koy',
      to: 'ly_alinca',
      surface: 'gravel',
      technical: 0.3,
      profiles: WHEELS,
      winding: 1.6,
    },
    {
      from: 'ly_kabak_plaj',
      to: 'ly_alinca',
      surface: 'rock',
      technical: 0.6,
      profiles: FOOT,
      winding: 1.6,
    },
    {
      from: 'ly_alinca',
      to: 'ly_gey',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.4,
    },
    {
      from: 'ly_gey',
      to: 'ly_bel',
      surface: 'gravel',
      technical: 0.15,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'ly_bel',
      to: 'ly_sidyma',
      surface: 'trail',
      technical: 0.25,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'ly_babadag',
      to: 'ly_faralya',
      surface: 'trail',
      technical: 0.5,
      profiles: FOOT,
      winding: 1.5,
    },
    {
      from: 'ly_alinca',
      to: 'ly_bel',
      surface: 'gravel',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.7,
    },
  ],
);

/* ------------------------------------------------------------------ */
/* Kapadokya — Göreme / Kızılçukur / Çavuşin / Uçhisar                 */
/* ------------------------------------------------------------------ */

const kapadokya = buildGraph(
  'reg_kapadokya',
  [
    node('kp_goreme', 'Göreme', 38.643, 34.828, 1100),
    node('kp_acikhava', 'Göreme Açık Hava Müzesi', 38.641, 34.845, 1150),
    node('kp_meskendir', 'Meskendir Vadisi', 38.655, 34.85, 1120),
    node('kp_kizilcukur', 'Kızılçukur Seyir Tepesi', 38.667, 34.847, 1230),
    node('kp_gulludere', 'Güllüdere Vadisi', 38.665, 34.838, 1130),
    node('kp_cavusin', 'Çavuşin', 38.667, 34.834, 1080),
    node('kp_pasabag', 'Paşabağ', 38.675, 34.85, 1060),
    node('kp_zelve', 'Zelve', 38.675, 34.865, 1100),
    node('kp_ask', 'Aşk Vadisi', 38.66, 34.815, 1160),
    node('kp_guvercinlik', 'Güvercinlik Vadisi', 38.636, 34.815, 1180),
    node('kp_uchisar', 'Uçhisar Kalesi', 38.63, 34.805, 1350),
    node('kp_kiliclar', 'Kılıçlar Vadisi', 38.65, 34.84, 1110),
    node('kp_ortahisar', 'Ortahisar', 38.625, 34.86, 1200),
    node('kp_avanos', 'Avanos', 38.715, 34.848, 920),
  ],
  [
    {
      from: 'kp_goreme',
      to: 'kp_acikhava',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.2,
    },
    {
      from: 'kp_acikhava',
      to: 'kp_meskendir',
      surface: 'trail',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'kp_goreme',
      to: 'kp_kiliclar',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.4,
    },
    {
      from: 'kp_kiliclar',
      to: 'kp_meskendir',
      surface: 'trail',
      technical: 0.25,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'kp_meskendir',
      to: 'kp_kizilcukur',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT_MTB,
      winding: 1.5,
    },
    {
      from: 'kp_kizilcukur',
      to: 'kp_gulludere',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'kp_gulludere',
      to: 'kp_cavusin',
      surface: 'trail',
      technical: 0.2,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_cavusin',
      to: 'kp_pasabag',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_pasabag',
      to: 'kp_zelve',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_goreme',
      to: 'kp_ask',
      surface: 'trail',
      technical: 0.25,
      profiles: FOOT_MTB,
      winding: 1.4,
    },
    {
      from: 'kp_ask',
      to: 'kp_cavusin',
      surface: 'trail',
      technical: 0.25,
      profiles: FOOT_MTB,
      winding: 1.3,
    },
    {
      from: 'kp_goreme',
      to: 'kp_guvercinlik',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'kp_guvercinlik',
      to: 'kp_uchisar',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'kp_goreme',
      to: 'kp_uchisar',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_acikhava',
      to: 'kp_ortahisar',
      surface: 'gravel',
      technical: 0.15,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'kp_kizilcukur',
      to: 'kp_pasabag',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.4,
    },
    {
      from: 'kp_zelve',
      to: 'kp_avanos',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_cavusin',
      to: 'kp_avanos',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'kp_ask',
      to: 'kp_uchisar',
      surface: 'trail',
      technical: 0.4,
      profiles: FOOT,
      winding: 1.4,
    },
  ],
);

/* ------------------------------------------------------------------ */
/* Aladağlar — Demirkazık / Yedigöller                                 */
/* ------------------------------------------------------------------ */

const aladaglar = buildGraph(
  'reg_aladaglar',
  [
    node('al_cukurbag', 'Çukurbağ', 37.8, 35.09, 1350),
    node('al_demirkazik_koy', 'Demirkazık Köyü', 37.83, 35.1, 1500),
    node('al_pinarbasi', 'Pınarbaşı', 37.822, 35.12, 1650),
    node('al_sokullupinar', 'Sokullupınar Kampı', 37.815, 35.135, 2050),
    node('al_narpiz', 'Narpız Boğazı', 37.812, 35.15, 2700),
    node('al_demirkazik', 'Demirkazık Zirvesi', 37.826, 35.153, 3756),
    node('al_celikbuyduran', 'Çelikbuyduran Geçidi', 37.8, 35.168, 3450),
    node('al_yedigoller', 'Yedigöller', 37.775, 35.18, 3100),
    node('al_dipsiz', 'Dipsiz Göl', 37.77, 35.192, 3050),
    node('al_emli', 'Emli Vadisi', 37.762, 35.112, 1750),
    node('al_kaldi', 'Kaldı Geçidi', 37.78, 35.16, 3250),
    node('al_direktas', 'Direktaş', 37.77, 35.135, 2350),
    node('al_hacer', 'Hacer Ormanı', 37.745, 35.24, 1700),
    node('al_kapuzbasi', 'Kapuzbaşı Şelaleleri', 37.72, 35.32, 950),
  ],
  [
    {
      from: 'al_cukurbag',
      to: 'al_demirkazik_koy',
      surface: 'paved',
      technical: 0.05,
      profiles: WHEELS,
      winding: 1.3,
    },
    {
      from: 'al_demirkazik_koy',
      to: 'al_pinarbasi',
      surface: 'gravel',
      technical: 0.1,
      profiles: WHEELS,
      winding: 1.4,
    },
    {
      from: 'al_pinarbasi',
      to: 'al_sokullupinar',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.5,
    },
    {
      from: 'al_sokullupinar',
      to: 'al_narpiz',
      surface: 'scree',
      technical: 0.55,
      profiles: ALPINE,
      winding: 1.4,
    },
    {
      from: 'al_narpiz',
      to: 'al_demirkazik',
      surface: 'rock',
      technical: 0.95,
      profiles: ['hike'],
      winding: 1.6,
    },
    {
      from: 'al_narpiz',
      to: 'al_celikbuyduran',
      surface: 'scree',
      technical: 0.65,
      profiles: ALPINE,
      winding: 1.4,
    },
    {
      from: 'al_celikbuyduran',
      to: 'al_yedigoller',
      surface: 'scree',
      technical: 0.5,
      profiles: ALPINE,
      winding: 1.4,
    },
    {
      from: 'al_yedigoller',
      to: 'al_dipsiz',
      surface: 'trail',
      technical: 0.3,
      profiles: ALPINE,
      winding: 1.3,
    },
    {
      from: 'al_cukurbag',
      to: 'al_emli',
      surface: 'gravel',
      technical: 0.15,
      profiles: WHEELS,
      winding: 1.5,
    },
    {
      from: 'al_emli',
      to: 'al_direktas',
      surface: 'trail',
      technical: 0.35,
      profiles: FOOT,
      winding: 1.4,
    },
    {
      from: 'al_direktas',
      to: 'al_kaldi',
      surface: 'scree',
      technical: 0.6,
      profiles: ALPINE,
      winding: 1.5,
    },
    {
      from: 'al_kaldi',
      to: 'al_yedigoller',
      surface: 'scree',
      technical: 0.55,
      profiles: ALPINE,
      winding: 1.4,
    },
    {
      from: 'al_yedigoller',
      to: 'al_hacer',
      surface: 'trail',
      technical: 0.4,
      profiles: FOOT,
      winding: 1.6,
    },
    {
      from: 'al_hacer',
      to: 'al_kapuzbasi',
      surface: 'gravel',
      technical: 0.15,
      profiles: WHEELS,
      winding: 1.5,
    },
    {
      from: 'al_sokullupinar',
      to: 'al_direktas',
      surface: 'trail',
      technical: 0.4,
      profiles: FOOT,
      winding: 1.5,
    },
    {
      from: 'al_pinarbasi',
      to: 'al_emli',
      surface: 'trail',
      technical: 0.3,
      profiles: FOOT_MTB,
      winding: 1.5,
    },
  ],
);

export const seedTrailGraphs: TrailGraph[] = [kackar, likya, kapadokya, aladaglar];

/* ------------------------------------------------------------------ */
/* Harita paketleri                                                    */
/* ------------------------------------------------------------------ */

export const seedMapPacks: MapPack[] = [
  {
    id: 'pack_dogu_karadeniz',
    name: 'Doğu Karadeniz & Kaçkarlar',
    countryCode: 'TR',
    bbox: [40.3, 40.55, 42.1, 41.35],
    sizeMb: 184,
    version: '2026.08',
    format: 'pmtiles',
    status: 'downloaded',
    progress: 1,
    updatedAt: '2026-08-14T09:12:00.000Z',
    localPath: 'file:///maps/pack_dogu_karadeniz.pmtiles',
  },
  {
    id: 'pack_likya',
    name: 'Likya Yolu & Batı Akdeniz',
    countryCode: 'TR',
    bbox: [28.9, 36.1, 30.9, 36.95],
    sizeMb: 212,
    version: '2026.05',
    format: 'pmtiles',
    status: 'update_available',
    progress: 1,
    updatedAt: '2026-05-20T07:40:00.000Z',
    localPath: 'file:///maps/pack_likya.pmtiles',
  },
  {
    id: 'pack_kapadokya',
    name: 'Kapadokya',
    countryCode: 'TR',
    bbox: [34.4, 38.35, 35.2, 38.95],
    sizeMb: 68,
    version: '2026.08',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-08-14T09:12:00.000Z',
    localPath: null,
  },
  {
    id: 'pack_toroslar',
    name: 'Aladağlar & Orta Toroslar',
    countryCode: 'TR',
    bbox: [34.6, 37.3, 35.8, 38.2],
    sizeMb: 143,
    version: '2026.08',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-08-14T09:12:00.000Z',
    localPath: null,
  },
  {
    id: 'pack_alpler',
    name: 'Alpler — İsviçre & Avusturya',
    countryCode: 'CH',
    bbox: [6.0, 45.8, 13.0, 47.8],
    sizeMb: 1240,
    version: '2026.07',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-07-30T12:00:00.000Z',
    localPath: null,
  },
  {
    id: 'pack_dolomitler',
    name: 'Dolomitler',
    countryCode: 'IT',
    bbox: [11.4, 46.1, 12.6, 46.85],
    sizeMb: 310,
    version: '2026.07',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-07-30T12:00:00.000Z',
    localPath: null,
  },
  {
    id: 'pack_annapurna',
    name: 'Nepal — Annapurna Turu',
    countryCode: 'NP',
    bbox: [83.4, 28.2, 84.6, 28.95],
    sizeMb: 156,
    version: '2026.06',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-06-18T05:30:00.000Z',
    localPath: null,
  },
  {
    id: 'pack_nz_guney_alpler',
    name: 'Yeni Zelanda — Güney Alpler',
    countryCode: 'NZ',
    bbox: [167.5, -45.6, 171.5, -42.8],
    sizeMb: 890,
    version: '2026.06',
    format: 'pmtiles',
    status: 'available',
    progress: 0,
    updatedAt: '2026-06-18T05:30:00.000Z',
    localPath: null,
  },
];

/* ------------------------------------------------------------------ */
/* Kayıtlı rotalar                                                     */
/* ------------------------------------------------------------------ */

function savedRoute(
  id: ID,
  graph: TrailGraph,
  name: string,
  from: ID,
  to: ID,
  routeProfile: RouteProfile,
  createdAt: string,
): SavedRoute {
  const planned = planRoute(graph, from, to, routeProfile);
  if (!planned) throw new Error(`seed.maps: rota planlanamadı ${from}→${to}`);
  return { id, userId: 'u_me', regionId: graph.regionId, name, routeProfile, planned, createdAt };
}

export const seedSavedRoutes: SavedRoute[] = [
  savedRoute(
    'sr_kackar_zirve',
    kackar,
    'Olgunlar → Kaçkar Zirvesi',
    'kc_olgunlar',
    'kc_zirve',
    'hike',
    '2026-08-02T18:20:00.000Z',
  ),
  savedRoute(
    'sr_likya_kabak',
    likya,
    'Faralya → Kabak Koyu (kıyı)',
    'ly_faralya',
    'ly_kabak_plaj',
    'trail_run',
    '2026-08-21T06:45:00.000Z',
  ),
];
