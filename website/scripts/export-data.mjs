/**
 * Uygulama tohum verilerini (src/data/mock/seed*.ts, src/domain/pricing.ts) okuyup
 * website/src/data/generated/*.json dosyalarına yazar.
 *
 * TypeScript dosyaları Node 22'nin yerleşik tip silme desteğiyle (`--experimental-transform-types`)
 * ve `scripts/ts-loader.mjs` takma ad çözücüsüyle içe aktarılır; ek paket gerekmez.
 * Bir tohum yüklenemezse `src/data/fallback/*.json` kullanılır.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const ROOT = path.resolve(SITE, '..');
const OUT = path.join(SITE, 'src/data/generated');
const FALLBACK = path.join(SITE, 'src/data/fallback');
const CACHE = path.join(SITE, '.cache');

const FLAG = '--experimental-transform-types';
if (!process.execArgv.includes(FLAG)) {
  const registerImport = `import { register } from 'node:module'; register(${JSON.stringify(
    pathToFileURL(path.join(HERE, 'ts-loader.mjs')).href,
  )});`;
  const res = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      FLAG,
      '--import',
      `data:text/javascript,${encodeURIComponent(registerImport)}`,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit', env: { ...process.env, ZIRVE_ROOT: ROOT } },
  );
  process.exit(res.status ?? 1);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const report = [];
function note(name, count, source) {
  report.push({ name, count, source });
}

async function tryImport(file) {
  try {
    return await import(pathToFileURL(path.join(ROOT, file)).href);
  } catch (err) {
    console.warn(`⚠ ${file}: ${String(err.message).split('\n')[0]}`);
    return null;
  }
}

function fallback(name) {
  const file = path.join(FALLBACK, `${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/* -------------------------------------------------------------------------- */
/* Yardımcılar                                                                 */
/* -------------------------------------------------------------------------- */

const TR_MAP = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};
export function slugify(input) {
  return String(input)
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Deterministik yapay yükseklik profili (yalnızca profili olmayan basit rotalar için). */
function syntheticProfile(id, distanceKm, gainM, baseM, loop) {
  const n = 48;
  const seed = hash(id);
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const shape = loop ? Math.sin(Math.PI * t) : Math.pow(t, 0.85);
    const wobble = Math.sin(t * 17 + (seed % 7)) * 0.02 + Math.sin(t * 41 + (seed % 13)) * 0.01;
    const ele = baseM + gainM * Math.max(0, Math.min(1, shape + wobble));
    out.push([Math.round(t * distanceKm * 100) / 100, Math.round(ele)]);
  }
  return out;
}

function toblerMinutes(distanceKm, ascentM) {
  return Math.round((distanceKm / 4.2) * 60 + (ascentM / 550) * 60);
}

const CLEAN = (s) =>
  typeof s === 'string' ? s.replace(/\bZirve (Akademi|AI|Pro)\b/g, 'Zirtan $1') : s;
const lt = (v) => (v && typeof v === 'object' && 'tr' in v ? { tr: v.tr, en: v.en ?? v.tr } : v);

/* -------------------------------------------------------------------------- */
/* Destinasyonlar (yarım kalmış dosya için kurtarma yolu)                      */
/* -------------------------------------------------------------------------- */

async function loadDestinations() {
  const file = 'src/data/mock/seed.destinations.ts';
  let mod = await tryImport(file);
  let stages = mod?.seedDestinationStages ?? null;
  if (!mod || !stages) {
    // Dosya başka bir araç tarafından yazılıyor olabilir ya da etap dizisi henüz dışa aktarılmamış:
    // kapanmamış diziyi kapatıp etap sabitlerini toplayan bir kurtarma kopyası üzerinden dene.
    try {
      let src = readFileSync(path.join(ROOT, file), 'utf8');
      const start = src.indexOf('export const seedDestinations');
      if (
        start > -1 &&
        !/\];\s*$/.test(src.replace(/export const seedDestinationStages[\s\S]*$/, ''))
      ) {
        const lastClose = src.lastIndexOf('\n  },');
        if (lastClose > start) src = src.slice(0, lastClose + 5) + '\n];\n';
      }
      src = src.replace(/from '\.\/seed'/g, `from '${path.join(ROOT, 'src/data/mock/seed.ts')}'`);
      const stageConsts = [...src.matchAll(/^const (\w+Stages) = stagesOf\(/gm)].map((m) => m[1]);
      src += `\nexport const rescuedStages = [${stageConsts.join(', ')}].flat();\n`;
      const tmp = path.join(CACHE, 'seed.destinations.rescued.ts');
      writeFileSync(tmp, src);
      const rescued = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
      if (!mod) {
        mod = rescued;
        console.warn('ℹ seed.destinations.ts kurtarma kopyasından yüklendi');
      }
      stages = rescued.seedDestinationStages ?? rescued.rescuedStages ?? [];
    } catch (err) {
      console.warn(`⚠ destinasyon kurtarma başarısız: ${String(err.message).split('\n')[0]}`);
    }
  }
  if (mod?.seedDestinations?.length) {
    const byDest = new Map();
    for (const s of stages ?? []) {
      if (!byDest.has(s.destinationId)) byDest.set(s.destinationId, []);
      byDest.get(s.destinationId).push(s);
    }
    const list = mod.seedDestinations.map((d) => ({
      ...d,
      stages: (byDest.get(d.id) ?? []).sort((a, b) => a.order - b.order),
    }));
    note('destinations', list.length, 'seed');
    return list;
  }
  const fb = fallback('destinations') ?? [];
  note('destinations', fb.length, 'fallback');
  return fb;
}

/* -------------------------------------------------------------------------- */
/* Ana akış                                                                    */
/* -------------------------------------------------------------------------- */

const [seed, extra, climbing, maps, clubs, groups, pricing, rescue] = await Promise.all([
  tryImport('src/data/mock/seed.ts'),
  tryImport('src/data/mock/seed.extra.ts'),
  tryImport('src/data/mock/seed.climbing.ts'),
  tryImport('src/data/mock/seed.maps.ts'),
  tryImport('src/data/mock/seed.clubs.ts'),
  tryImport('src/data/mock/seed.groups.ts'),
  tryImport('src/domain/pricing.ts'),
  tryImport('src/domain/rescue.ts'),
]);
const rawDestinations = await loadDestinations();
const courses = (await tryImport('src/data/mock/seed.courses.ts'))?.seedCourses ?? [];

const users = new Map((seed?.seedUsers ?? []).map((u) => [u.id, u]));

/* --- Destinasyonlar --- */
const destinations = rawDestinations.map((d) => {
  const stages = d.stages ?? [];
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    region: d.region,
    countryCode: d.countryCode,
    type: d.type,
    adventureTypes: d.adventureTypes,
    coords: d.coords,
    summary: CLEAN(d.summary),
    guide: CLEAN(d.guide),
    maxElevationM: d.maxElevationM,
    typicalDays: d.typicalDays,
    totalDistanceKm: d.totalDistanceKm,
    difficulty: d.difficulty,
    bestMonths: d.bestMonths,
    transports: d.transports ?? [],
    permits: d.permits ?? [],
    budgetTry: d.budgetTry,
    risks: d.risks ?? [],
    gear: d.gear ?? [],
    rescueNote: d.rescueNote,
    insuranceRequired: d.insuranceRequired,
    stageCount: d.stageCount ?? stages.length,
    rating: d.rating,
    reviewCount: d.reviewCount,
    sources: d.sources ?? [],
    stages: stages.map((s) => ({
      order: s.order,
      name: s.name,
      kind: s.kind,
      coords: s.coords,
      elevationM: s.elevationM,
      distanceKm: s.distanceKm,
      durationMin: s.durationMin,
      sleeping: s.sleeping,
      facilities: s.facilities,
      waterAvailable: s.waterAvailable,
      connectivity: s.connectivity,
      note: s.note,
      restDayRecommended: s.restDayRecommended,
    })),
  };
});

/* --- Rotalar --- */
const PROFILE_TO_TYPE = {
  hike: 'hiking',
  trail_run: 'hiking',
  mtb: 'cycling',
  gravel: 'cycling',
  ski_tour: 'skiing',
};
const regions = new Map((maps?.seedMapRegions ?? []).map((r) => [r.id, r]));
const routes = [];

for (const r of seed?.seedRoutes ?? []) {
  const loop = r.path.length > 2 && haversineKm(r.path[0], r.path[r.path.length - 1]) < 0.5;
  const baseM =
    { r_kackar: 2300, r_likya: 5, r_geyik: 320, r_erciyes: 2200, r_kapadokya: 1050 }[r.id] ?? 100;
  const profile = syntheticProfile(r.id, r.distanceKm, r.elevationGainM, baseM, loop);
  routes.push({
    id: r.id,
    slug: slugify(r.name),
    name: r.name,
    kind: 'community',
    activity: r.adventureType,
    adventureType: r.adventureType,
    difficulty: r.difficulty,
    locationName: r.locationName,
    countryCode: 'TR',
    distanceKm: r.distanceKm,
    ascentM: r.elevationGainM,
    descentM: loop ? r.elevationGainM : Math.round(r.elevationGainM * 0.15),
    durationMin: toblerMinutes(r.distanceKm, r.elevationGainM),
    maxElevationM: Math.max(...profile.map((p) => p[1])),
    minElevationM: Math.min(...profile.map((p) => p[1])),
    points: r.path,
    profile,
    profileSynthetic: true,
    loop,
    days: null,
    destinationSlug: null,
    surfaces: null,
  });
}

for (const s of maps?.seedSavedRoutes ?? []) {
  const p = s.planned;
  const region = regions.get(s.regionId);
  routes.push({
    id: s.id,
    slug: slugify(s.name),
    name: s.name,
    kind: 'planned',
    activity: s.routeProfile,
    adventureType: PROFILE_TO_TYPE[s.routeProfile] ?? 'hiking',
    difficulty: p.ascentM > 1200 ? 'hard' : p.ascentM > 500 ? 'moderate' : 'easy',
    locationName: region ? `${region.name}, ${region.countryCode}` : s.regionId,
    countryCode: region?.countryCode ?? 'TR',
    distanceKm: Math.round(p.distanceKm * 10) / 10,
    ascentM: p.ascentM,
    descentM: p.descentM,
    durationMin: p.durationMin,
    maxElevationM: p.maxElevationM,
    minElevationM: p.minElevationM,
    points: p.points,
    profile: p.profile.map(([km, m]) => [Math.round(km * 100) / 100, Math.round(m)]),
    profileSynthetic: false,
    loop: false,
    days: null,
    destinationSlug: null,
    surfaces: p.surfaces ?? null,
  });
}

for (const d of destinations) {
  if (!d.stages.length) continue;
  let km = 0;
  let ascent = 0;
  let descent = 0;
  const profile = [];
  d.stages.forEach((s, i) => {
    km += s.distanceKm;
    if (i > 0) {
      const delta = s.elevationM - d.stages[i - 1].elevationM;
      if (delta > 0) ascent += delta;
      else descent -= delta;
    }
    profile.push([Math.round(km * 10) / 10, s.elevationM]);
  });
  routes.push({
    id: `dr_${d.id}`,
    slug: d.slug,
    name: d.name,
    kind: 'destination',
    activity: d.adventureTypes[0] ?? 'hiking',
    adventureType: d.adventureTypes[0] ?? 'hiking',
    difficulty: d.difficulty,
    locationName: `${d.region}, ${d.countryCode}`,
    countryCode: d.countryCode,
    distanceKm: d.totalDistanceKm,
    ascentM: ascent,
    descentM: descent,
    durationMin: d.stages.reduce((a, s) => a + s.durationMin, 0),
    maxElevationM: Math.max(...d.stages.map((s) => s.elevationM)),
    minElevationM: Math.min(...d.stages.map((s) => s.elevationM)),
    points: d.stages.map((s) => s.coords),
    profile,
    profileSynthetic: false,
    loop: false,
    days: d.typicalDays,
    destinationSlug: d.slug,
    surfaces: null,
    stages: d.stages.map((s) => ({
      name: s.name,
      kind: s.kind,
      elevationM: s.elevationM,
      distanceKm: s.distanceKm,
      durationMin: s.durationMin,
      sleeping: s.sleeping,
    })),
  });
}
note('routes', routes.length, 'seed+derived');

/* --- Kütüphane yerleri --- */
const places = (extra?.seedLibrary ?? []).map((p) => ({
  id: p.id,
  slug: slugify(p.name),
  kind: p.kind,
  name: p.name,
  names: p.names ?? {},
  adventureTypes: p.adventureTypes,
  lat: p.lat,
  lng: p.lng,
  elevationM: p.elevationM,
  description: CLEAN(p.description),
  website: p.website,
  countryCode: p.countryCode,
  tags: p.tags ?? {},
  license: p.license,
  attribution: p.attribution,
  source: p.source,
}));
note('places', places.length, extra ? 'seed' : 'missing');

/* --- Tırmanış --- */
const cragRoutes = climbing?.seedClimbingRoutes ?? [];
const crags = (climbing?.seedCrags ?? []).map((c) => ({
  id: c.id,
  slug: slugify(c.name),
  name: c.name,
  locationName: c.locationName,
  countryCode: c.countryCode,
  coords: c.coords,
  rockType: c.rockType,
  description: CLEAN(c.description),
  climbTypes: c.climbTypes,
  routeCount: c.routeCount,
  verification: c.verification,
  seasons: c.seasons,
  approachMin: c.approachMin,
  sectors: (climbing?.seedSectors ?? [])
    .filter((s) => s.cragId === c.id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      orientation: s.orientation,
      routes: cragRoutes
        .filter((r) => r.sectorId === s.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          grade: r.grade,
          gradeSystem: r.gradeSystem,
          lengthM: r.lengthM,
          pitches: r.pitches,
          bolts: r.bolts,
          stars: r.stars,
          firstAscent: r.firstAscent,
          description: CLEAN(r.description),
          verification: r.verification,
          ascentCount: r.ascentCount,
        })),
    })),
}));
note('crags', crags.length, climbing ? 'seed' : 'missing');

/* --- Kulüpler & gruplar --- */
const clubList = (clubs?.seedClubs ?? []).map((c) => ({
  id: c.id,
  name: c.name,
  university: c.university,
  city: c.city,
  countryCode: c.countryCode,
  description: CLEAN(c.description),
  adventureTypes: c.adventureTypes,
  memberCount: c.memberCount,
  foundedYear: c.foundedYear,
  isVerified: c.isVerified,
  seasonXp: c.seasonXp,
  instagram: c.instagram,
}));
const groupList = (groups?.seedGroups ?? [])
  .filter((g) => g.privacy === 'public')
  .map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    description: CLEAN(g.description),
    adventureTypes: g.adventureTypes,
    city: g.city,
    countryCode: g.countryCode,
    memberCount: g.memberCount,
  }));
note('clubs', clubList.length, clubs ? 'seed' : 'missing');
note('groups', groupList.length, groups ? 'seed' : 'missing');

/* --- Eğitmenler & kurslar --- */
const instructors = (seed?.seedInstructors ?? []).map((i) => ({
  id: i.id,
  name: users.get(i.userId)?.displayName ?? users.get(i.userId)?.name ?? i.userId,
  headline: i.headline,
  bio: CLEAN(i.bio),
  specialties: i.specialties,
  certifications: i.certifications,
  rating: i.rating,
  reviewCount: i.reviewCount,
  pricePerSessionTry: i.pricePerSessionTry,
  sessionDurationMin: i.sessionDurationMin,
  languages: i.languages,
  yearsExperience: i.yearsExperience,
  locationName: i.locationName,
  coords: i.coords,
  studentsCount: i.studentsCount,
}));
note('instructors', instructors.length, seed ? 'seed' : 'missing');

let courseList = courses.map((c) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  category: c.category,
  level: c.level,
  format: c.format,
  summary: CLEAN(c.summary),
  provider: c.provider,
  certificateName: c.certificateName,
  priceTry: c.priceTry,
  durationHours: c.durationHours,
  lessonCount: c.lessonCount,
  rating: c.rating,
  reviewCount: c.reviewCount,
  languages: c.languages,
  outcomes: c.outcomes,
  adventureTypes: c.adventureTypes,
}));
if (!courseList.length) {
  courseList = fallback('courses') ?? [];
  note('courses', courseList.length, 'fallback');
} else note('courses', courseList.length, 'seed');

/* --- Planlar --- */
const plans = pricing
  ? Object.values(pricing.PLAN_SPECS).map((p) => ({
      id: p.id,
      monthlyTry: p.monthlyTry,
      yearlyTry: p.yearlyTry,
      commissionRate: p.commissionRate,
      features: p.featureKeys.map((k) => k.replace('plans.f.', '')),
      forProviders: p.forProviders,
      yearlySavings: pricing.yearlySavings(p.id),
    }))
  : (fallback('plans') ?? []);
note('plans', plans.length, pricing ? 'seed' : 'fallback');

/* --- Harita bölgeleri & paketler --- */
const mapRegions = (maps?.seedMapRegions ?? []).map((r) => ({ ...r }));
const mapPacks = (maps?.seedMapPacks ?? []).map((p) => ({
  id: p.id,
  name: p.name,
  countryCode: p.countryCode,
  bbox: p.bbox,
  sizeMb: p.sizeMb,
  version: p.version,
}));
const trailGraphs = (maps?.seedTrailGraphs ?? []).map((g) => ({
  regionId: g.regionId,
  nodes: g.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    lat: n.coords.latitude,
    lng: n.coords.longitude,
    ele: n.elevationM,
  })),
  edges: g.edges.map((e) => [e.from, e.to]),
}));
note('mapRegions', mapRegions.length, maps ? 'seed' : 'missing');

/* --- Kurtarma dizini --- */
const rescueDir = rescue
  ? Object.values(rescue.RESCUE_DIRECTORY).map((p) => ({
      countryCode: p.countryCode,
      emergency: p.emergency,
      organizations: (p.organizations ?? [])
        .slice(0, 3)
        .map((o) => ({ name: o.name, phone: o.phone ?? null, scope: o.scope, url: o.url ?? null })),
      notes: (p.notes ?? []).map(lt),
    }))
  : [];
note('rescue', rescueDir.length, rescue ? 'seed' : 'missing');

/* --- Yaz --- */
const files = {
  destinations,
  routes,
  places,
  crags,
  clubs: clubList,
  groups: groupList,
  instructors,
  courses: courseList,
  plans,
  maps: { regions: mapRegions, packs: mapPacks, graphs: trailGraphs },
  rescue: rescueDir,
  meta: {
    generatedAt: new Date().toISOString(),
    report,
    counts: {
      destinations: destinations.length,
      routes: routes.length,
      places: places.length,
      crags: crags.length,
      climbingRoutes: cragRoutes.length,
      clubs: clubList.length,
      groups: groupList.length,
      instructors: instructors.length,
      courses: courseList.length,
      rescueCountries: rescueDir.length,
    },
  },
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
}
console.log('✔ veri dışa aktarıldı:');
for (const r of report)
  console.log(`  ${r.name.padEnd(14)} ${String(r.count).padStart(4)}  (${r.source})`);
