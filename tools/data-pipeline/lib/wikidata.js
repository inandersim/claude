import { WIKIDATA_SPARQL } from './config.js';
import { fetchWithRetry } from './http.js';
import { normalizeWikidataRow } from './normalize.js';

/** Wikidata sınıfları → kategori */
export const WIKIDATA_CLASSES = {
  peak: 'Q8502', // dağ
  cave: 'Q35509', // mağara
  ski: 'Q130003', // kayak merkezi
  diving: 'Q1064239', // dalış noktası (dive site)
  campsite: 'Q832778', // kamp alanı
};

const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'ja', 'pt', 'ru'];

export function buildSparql(kind, countryQid, limit = 5000, offset = 0) {
  const cls = WIKIDATA_CLASSES[kind];
  if (!cls) throw new Error(`Wikidata sınıfı yok: ${kind}`);
  const labels = LANGS.map(
    (l) => `OPTIONAL { ?item rdfs:label ?label_${l} FILTER(LANG(?label_${l}) = "${l}") }`,
  ).join('\n  ');
  const countryFilter = countryQid ? `?item wdt:P17 wd:${countryQid} .` : '';
  return `SELECT ?item ?coord ?elevation ?image ?website ?countryCode ?description ${LANGS.map((l) => `?label_${l}`).join(' ')} WHERE {
  ?item wdt:P31/wdt:P279* wd:${cls} .
  ?item wdt:P625 ?coord .
  ${countryFilter}
  OPTIONAL { ?item wdt:P2044 ?elevation }
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P297 ?countryCode }
  OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "en") }
  ${labels}
} LIMIT ${limit} OFFSET ${offset}`;
}

/** Ülke ISO kodu → Wikidata QID (sık kullanılanlar) */
export const COUNTRY_QID = {
  TR: 'Q43',
  GR: 'Q41',
  GE: 'Q230',
  DE: 'Q183',
  AT: 'Q40',
  CH: 'Q39',
  FR: 'Q142',
  ES: 'Q29',
  IT: 'Q38',
  GB: 'Q145',
  NO: 'Q20',
  US: 'Q30',
  CA: 'Q16',
  JP: 'Q17',
  NZ: 'Q664',
  AU: 'Q408',
  NP: 'Q837',
  BR: 'Q155',
  EG: 'Q79',
  TH: 'Q869',
  ID: 'Q252',
  MX: 'Q96',
  AR: 'Q414',
  CL: 'Q298',
  ZA: 'Q258',
  IS: 'Q189',
  PT: 'Q45',
  HR: 'Q224',
  SI: 'Q215',
  MA: 'Q1028',
};

export async function fetchWikidata(
  kind,
  countryCode,
  { fetchImpl = fetchWithRetry, pageSize = 2000 } = {},
) {
  const qid =
    countryCode && countryCode !== 'world' ? COUNTRY_QID[countryCode.toUpperCase()] : null;
  if (countryCode && countryCode !== 'world' && !qid)
    throw new Error(`Ülke QID bilinmiyor: ${countryCode}`);
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildSparql(kind, qid, pageSize, offset))}`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/sparql-results+json' } });
    const json = await res.json();
    const rows = json.results?.bindings ?? [];
    for (const row of rows) {
      const place = normalizeWikidataRow(row, kind);
      if (place) out.push(place);
    }
    console.log(`  wikidata ${kind}: +${rows.length} (toplam ${out.length})`);
    if (rows.length < pageSize) break;
  }
  return out;
}
