import { KINDS } from './config.js';
import { detectKind } from './overpass.js';

/**
 * Birleşik yer şeması.
 * @typedef {object} Place
 * @property {string} id            'osm:node:123' | 'wd:Q123'
 * @property {'osm'|'wikidata'} source
 * @property {string} kind
 * @property {'place'|'emergency'} group
 * @property {string} name
 * @property {Record<string,string>} names   dil koduna göre adlar
 * @property {string[]} adventureTypes
 * @property {number} lat
 * @property {number} lng
 * @property {number|null} elevationM
 * @property {string|null} description
 * @property {string|null} website
 * @property {string|null} phone
 * @property {string|null} openingHours
 * @property {string|null} countryCode
 * @property {Record<string,string>} tags
 * @property {string|null} wikidataId
 * @property {string|null} commonsFile
 * @property {{url:string; thumbUrl:string; license:string; author:string; attribution:string}|null} image
 * @property {string} license
 * @property {string} attribution
 * @property {string} updatedAt
 */

const NAME_LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'ja', 'pt', 'ru'];

function namesFromTags(tags) {
  const names = {};
  for (const lang of NAME_LANGS) {
    if (tags[`name:${lang}`]) names[lang] = tags[`name:${lang}`];
  }
  return names;
}

function toNumber(value) {
  if (value === undefined || value === null) return null;
  const n = parseFloat(
    String(value)
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(n) ? n : null;
}

/** OSM öğesini Place'e çevirir; adı veya konumu yoksa null döner. */
export function normalizeOsmElement(el, now = new Date().toISOString()) {
  const tags = el.tags ?? {};
  const kind = detectKind(tags);
  if (!kind) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const name = tags.name ?? tags['name:en'] ?? tags['name:tr'] ?? tags.ref ?? null;
  if (!name && kind !== 'campsite' && kind !== 'dive_centre') return null;

  const def = KINDS[kind];
  return {
    id: `osm:${el.type}:${el.id}`,
    source: 'osm',
    kind,
    group: def.group,
    name: name ?? (kind === 'campsite' ? 'Kamp alanı' : 'Dalış merkezi'),
    names: namesFromTags(tags),
    adventureTypes: def.adventureTypes,
    lat,
    lng,
    elevationM: toNumber(tags.ele),
    description: tags.description ?? tags.note ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    phone: tags.phone ?? tags['contact:phone'] ?? tags['emergency:phone'] ?? null,
    openingHours: tags.opening_hours ?? null,
    countryCode: tags['addr:country'] ?? tags['is_in:country_code'] ?? null,
    tags: pickTags(tags),
    wikidataId: tags.wikidata ?? null,
    commonsFile: tags.image?.startsWith('File:')
      ? tags.image.slice(5)
      : tags.wikimedia_commons?.startsWith('File:')
        ? tags.wikimedia_commons.slice(5)
        : null,
    image: null,
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap katkıcıları',
    updatedAt: now,
  };
}

const KEEP_TAG_PREFIXES = [
  'climbing',
  'piste',
  'route',
  'sport',
  'tourism',
  'amenity',
  'emergency',
  'natural',
  'capacity',
  'fee',
  'drinking_water',
  'toilets',
  'shower',
  'power_supply',
  'internet_access',
  'tents',
  'caravans',
  'backcountry',
  'distance',
  'ascent',
  'descent',
  'osmc:symbol',
  'network',
  'whitewater',
  'canoe',
  'operator',
  'dive',
  'depth',
  'scuba',
];

function pickTags(tags) {
  const out = {};
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith('name') || k.startsWith('addr:')) continue;
    if (KEEP_TAG_PREFIXES.some((p) => k === p || k.startsWith(`${p}:`))) out[k] = v;
  }
  return out;
}

/** Wikidata SPARQL satırını Place'e çevirir. */
export function normalizeWikidataRow(row, kind, now = new Date().toISOString()) {
  const coord = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord?.value ?? '');
  if (!coord) return null;
  const qid = row.item.value.split('/').pop();
  const def = KINDS[kind];
  const names = {};
  for (const lang of NAME_LANGS)
    if (row[`label_${lang}`]?.value) names[lang] = row[`label_${lang}`].value;
  return {
    id: `wd:${qid}`,
    source: 'wikidata',
    kind,
    group: def.group,
    name: row.label_tr?.value ?? row.label_en?.value ?? row.itemLabel?.value ?? qid,
    names,
    adventureTypes: def.adventureTypes,
    lat: parseFloat(coord[2]),
    lng: parseFloat(coord[1]),
    elevationM: row.elevation ? parseFloat(row.elevation.value) : null,
    description: row.description?.value ?? null,
    website: row.website?.value ?? null,
    phone: null,
    openingHours: null,
    countryCode: row.countryCode?.value ?? null,
    tags: {},
    wikidataId: qid,
    commonsFile: row.image ? decodeURIComponent(row.image.value.split('/').pop()) : null,
    image: null,
    license: 'CC0-1.0',
    attribution: 'Wikidata',
    updatedAt: now,
  };
}

/** Aynı konum + benzer ad → tekilleştirme anahtarı (100 m ızgara). */
export function dedupeKey(place) {
  const slug = place.name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/g, '');
  return `${place.kind}:${slug}:${place.lat.toFixed(3)}:${place.lng.toFixed(3)}`;
}
