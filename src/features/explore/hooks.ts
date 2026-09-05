import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID } from '@/domain';

export function useTrendingLocations() {
  return useQuery({
    queryKey: queryKeys.explore.trending,
    queryFn: () => getDataProvider().explore.trendingLocations(),
  });
}

export function useLocationDetail(id: ID) {
  return useQuery({
    queryKey: queryKeys.explore.location(id),
    queryFn: () => getDataProvider().explore.getLocation(id),
  });
}

export function usePopularRoutes() {
  return useQuery({
    queryKey: queryKeys.explore.routes,
    queryFn: () => getDataProvider().explore.popularRoutes(),
  });
}

export function useExploreSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.explore.search(trimmed),
    queryFn: () => getDataProvider().explore.search(trimmed),
    enabled: trimmed.length >= 2,
    placeholderData: (prev) => prev,
  });
}
