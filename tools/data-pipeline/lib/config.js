// Kategori tanımları: OSM Overpass filtreleri ve uygulama macera türü eşlemesi.
export const USER_AGENT = 'ZirveDataPipeline/1.0 (+https://zirve.app; contact dev@zirve.app)';

/** @typedef {'campsite'|'climbing'|'diving'|'dive_centre'|'hiking_route'|'rafting'|'canoe'|'paragliding'|'ski'|'peak'|'cave'|'viewpoint'|'shelter'|'hospital'|'ambulance'|'mountain_rescue'|'pharmacy'} PlaceKind */

/** @type {Record<PlaceKind, { overpass: string[]; adventureTypes: string[]; group: 'place'|'emergency' }>} */
export const KINDS = {
  campsite: {
    overpass: ['nwr["tourism"="camp_site"]', 'nwr["tourism"="caravan_site"]'],
    adventureTypes: ['hiking'],
    group: 'place',
  },
  climbing: {
    overpass: ['nwr["sport"="climbing"]', 'nwr["climbing"]'],
    adventureTypes: ['climbing'],
    group: 'place',
  },
  diving: {
    overpass: ['nwr["sport"="scuba_diving"]', 'nwr["sport"="diving"]'],
    adventureTypes: ['diving'],
    group: 'place',
  },
  dive_centre: {
    overpass: ['nwr["amenity"="dive_centre"]', 'nwr["shop"="scuba_diving"]'],
    adventureTypes: ['diving'],
    group: 'place',
  },
  hiking_route: {
    overpass: [
      'relation["route"="hiking"]',
      'relation["route"="foot"]["network"~"^(iwn|nwn|rwn)$"]',
    ],
    adventureTypes: ['hiking'],
    group: 'place',
  },
  rafting: {
    overpass: ['nwr["sport"="rafting"]', 'nwr["whitewater"]'],
    adventureTypes: ['rafting'],
    group: 'place',
  },
  canoe: {
    overpass: ['nwr["sport"="canoe"]', 'nwr["sport"="kayak"]', 'nwr["canoe"="put_in"]'],
    adventureTypes: ['canoe'],
    group: 'place',
  },
  paragliding: {
    overpass: [
      'nwr["sport"="paragliding"]',
      'nwr["sport"="free_flying"]',
      'nwr["aeroway"="launchpad"]',
    ],
    adventureTypes: ['paragliding'],
    group: 'place',
  },
  ski: {
    overpass: [
      'nwr["sport"="skiing"]',
      'nwr["landuse"="winter_sports"]',
      'nwr["piste:type"="downhill"]["name"]',
    ],
    adventureTypes: ['skiing'],
    group: 'place',
  },
  peak: {
    overpass: ['node["natural"="peak"]["name"]'],
    adventureTypes: ['hiking', 'climbing'],
    group: 'place',
  },
  cave: {
    overpass: ['nwr["natural"="cave_entrance"]["name"]'],
    adventureTypes: ['hiking'],
    group: 'place',
  },
  viewpoint: {
    overpass: ['nwr["tourism"="viewpoint"]["name"]'],
    adventureTypes: ['hiking'],
    group: 'place',
  },
  shelter: {
    overpass: [
      'nwr["tourism"="alpine_hut"]',
      'nwr["tourism"="wilderness_hut"]',
      'nwr["amenity"="shelter"]["shelter_type"="basic_hut"]',
    ],
    adventureTypes: ['hiking', 'climbing', 'skiing'],
    group: 'place',
  },
  hospital: {
    overpass: ['nwr["amenity"="hospital"]', 'nwr["amenity"="clinic"]["emergency"="yes"]'],
    adventureTypes: [],
    group: 'emergency',
  },
  ambulance: {
    overpass: ['nwr["emergency"="ambulance_station"]'],
    adventureTypes: [],
    group: 'emergency',
  },
  mountain_rescue: {
    overpass: ['nwr["emergency"="mountain_rescue"]', 'nwr["emergency"="water_rescue"]'],
    adventureTypes: [],
    group: 'emergency',
  },
  pharmacy: {
    overpass: ['nwr["amenity"="pharmacy"]["name"]'],
    adventureTypes: [],
    group: 'emergency',
  },
};

export const DEFAULT_KINDS = [
  'campsite',
  'climbing',
  'diving',
  'dive_centre',
  'hiking_route',
  'rafting',
  'canoe',
  'paragliding',
  'ski',
  'peak',
  'cave',
  'shelter',
];

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const WIKIPEDIA_SUMMARY = (lang, title) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
