import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, PlannedRoute, RouteProfile } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Paket listesi; bir paket indiriliyorsa ilerlemeyi 500 ms'de bir tazeler. */
export function useMapPacks() {
  return useQuery({
    queryKey: queryKeys.maps.packs,
    queryFn: () => getDataProvider().maps.packs(),
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === 'downloading') ? 500 : false,
  });
}

export function useDownloadPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: ID) => getDataProvider().maps.download(packId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.packs }),
  });
}

export function useRemovePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: ID) => getDataProvider().maps.remove(packId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.packs }),
  });
}

export function useRegions() {
  return useQuery({
    queryKey: queryKeys.maps.regions,
    queryFn: () => getDataProvider().maps.regions(),
    staleTime: Infinity,
  });
}

export function useTrailGraph(regionId: ID | null) {
  return useQuery({
    queryKey: queryKeys.maps.graph(regionId ?? '-'),
    queryFn: () => getDataProvider().maps.graph(regionId!),
    enabled: Boolean(regionId),
    staleTime: Infinity,
  });
}

/** Başlangıç ve bitiş seçilince rota hesaplar; bulunamazsa `isError`. */
export function usePlanRoute(
  regionId: ID | null,
  from: ID | null,
  to: ID | null,
  profile: RouteProfile,
) {
  return useQuery({
    queryKey: queryKeys.maps.plan(regionId ?? '-', from, to, profile),
    queryFn: () => getDataProvider().maps.plan(regionId!, from!, to!, profile),
    enabled: Boolean(regionId && from && to),
    retry: false,
    staleTime: Infinity,
  });
}

export function useSavedRoutes() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.maps.saved(me.id),
    queryFn: () => getDataProvider().maps.savedRoutes(me.id),
  });
}

export function useSaveRoute() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      regionId: ID;
      name: string;
      routeProfile: RouteProfile;
      planned: PlannedRoute;
    }) => getDataProvider().maps.saveRoute(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.saved(me.id) }),
  });
}

export function useDeleteRoute() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: ID) => getDataProvider().maps.deleteRoute(me.id, routeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.saved(me.id) }),
  });
}
