import type { GeoPoint, ID, MapPack, SavedRoute, TrailGraph } from '@/domain';

export const seedMapRegions: { id: ID; name: string; countryCode: string; center: GeoPoint }[] = [];
export const seedTrailGraphs: TrailGraph[] = [];
export const seedMapPacks: MapPack[] = [];
export const seedSavedRoutes: SavedRoute[] = [];
