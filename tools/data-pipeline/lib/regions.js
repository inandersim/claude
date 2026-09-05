// Ülke sınır kutuları (güney, batı, kuzey, doğu) ve dünya karolama.
export const COUNTRY_BBOX = {
  TR: [35.8, 25.6, 42.2, 44.9],
  GR: [34.8, 19.3, 41.8, 29.7],
  GE: [41.0, 40.0, 43.6, 46.8],
  DE: [47.2, 5.8, 55.1, 15.1],
  AT: [46.3, 9.5, 49.1, 17.2],
  CH: [45.8, 5.9, 47.9, 10.5],
  FR: [41.3, -5.2, 51.1, 9.6],
  ES: [27.6, -18.2, 43.8, 4.4],
  IT: [35.4, 6.6, 47.1, 18.6],
  GB: [49.8, -8.7, 60.9, 1.8],
  NO: [57.9, 4.5, 71.2, 31.2],
  US: [24.4, -125.0, 49.4, -66.9],
  CA: [41.6, -141.0, 83.2, -52.6],
  JP: [24.0, 122.9, 45.6, 146.0],
  NZ: [-47.4, 166.3, -34.3, 178.6],
  AU: [-43.7, 112.9, -10.6, 153.7],
  NP: [26.3, 80.0, 30.5, 88.2],
  BR: [-33.8, -73.9, 5.3, -34.7],
  EG: [22.0, 24.7, 31.7, 36.9],
  TH: [5.6, 97.3, 20.5, 105.6],
  ID: [-11.0, 95.0, 6.1, 141.0],
  MX: [14.5, -118.4, 32.7, -86.7],
  AR: [-55.1, -73.6, -21.8, -53.6],
  CL: [-56.0, -75.7, -17.5, -66.4],
  ZA: [-34.9, 16.4, -22.1, 32.9],
  IS: [63.3, -24.6, 66.6, -13.4],
  PT: [36.9, -9.6, 42.2, -6.2],
  HR: [42.4, 13.5, 46.6, 19.5],
  SI: [45.4, 13.4, 46.9, 16.6],
  MA: [27.6, -13.2, 35.9, -1.0],
};

/** Bir sınır kutusunu en fazla `step` derecelik karolara böler. */
export function tileBbox([s, w, n, e], step = 2) {
  const tiles = [];
  for (let lat = s; lat < n; lat += step) {
    for (let lng = w; lng < e; lng += step) {
      tiles.push([lat, lng, Math.min(lat + step, n), Math.min(lng + step, e)]);
    }
  }
  return tiles;
}

/** Dünya: kutuplar hariç 10° karolar. */
export function worldTiles(step = 10) {
  return tileBbox([-60, -180, 84, 180], step);
}

export function regionTiles(region, step) {
  if (region === 'world') return worldTiles(step ?? 10);
  const bbox = COUNTRY_BBOX[region.toUpperCase()];
  if (!bbox)
    throw new Error(
      `Bilinmeyen bölge: ${region}. Desteklenenler: world, ${Object.keys(COUNTRY_BBOX).join(', ')}`,
    );
  return tileBbox(bbox, step ?? 2);
}
