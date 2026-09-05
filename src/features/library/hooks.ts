import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { GeoPoint, ID, LibraryFilter, PlaceKind } from '@/domain';

export function useLibrarySearch(filter: LibraryFilter) {
  return useQuery({
    queryKey: queryKeys.library.search(filter),
    queryFn: () => getDataProvider().library.search(filter),
    placeholderData: (prev) => prev,
  });
}

export function useLibraryPlace(id: ID, origin: GeoPoint | null) {
  return useQuery({
    queryKey: queryKeys.library.detail(id),
    queryFn: () => getDataProvider().library.getById(id, origin),
  });
}

export function useNearbyPlaces(
  origin: GeoPoint | null,
  radiusKm: number,
  kind: PlaceKind | null = null,
  limit = 10,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.library.all,
      'nearby',
      origin ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}` : '-',
      radiusKm,
      kind,
      limit,
    ],
    queryFn: () =>
      origin
        ? getDataProvider().library.nearby(origin, radiusKm, kind, limit)
        : Promise.resolve([]),
    enabled: Boolean(origin),
  });
}

export function useLibraryCountries() {
  return useQuery({
    queryKey: queryKeys.library.countries,
    queryFn: () => getDataProvider().library.countries(),
  });
}
