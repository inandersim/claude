import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, MapPack, PlannedRoute, RouteProfile } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

import { getPackManager, packReducer, tilesBaseUrl } from './pack-manager';
import { matchServerPack, useTileServerPacks, type ServerPack } from './vector/source';

/** Paket listesindeki tek bir paketi önbellekte günceller. */
function patchPack(qc: QueryClient, packId: ID, update: (pack: MapPack) => MapPack) {
  qc.setQueryData<MapPack[]>(queryKeys.maps.packs, (list) =>
    list?.map((p) => (p.id === packId ? update(p) : p)),
  );
}

/**
 * Karo sunucusu tanımlıysa gerçek indirmeyi (expo-file-system) kullanır;
 * tanımlı değilse demo sağlayıcısının benzetimine düşer.
 */
async function downloadPack(
  qc: QueryClient,
  packId: ID,
  serverPacks: ServerPack[],
): Promise<MapPack> {
  const list = qc.getQueryData<MapPack[]>(queryKeys.maps.packs) ?? [];
  const pack = list.find((p) => p.id === packId) ?? null;
  const remote = pack && tilesBaseUrl() ? matchServerPack(serverPacks, pack) : null;
  if (!pack || !remote) return getDataProvider().maps.download(packId);

  patchPack(qc, packId, (p) => packReducer(p, { type: 'download' }));
  const result = await getPackManager().download(pack, {
    version: remote.version,
    url: `${tilesBaseUrl()}${remote.url}`,
    // Sunucu yükseklik dosyası sunuyorsa onu da indir: kabartma ve 3B arazi
    // çevrimdışı da çalışsın (uygulamanın asıl kullanım senaryosu bu).
    demUrl: remote.demUrl ? `${tilesBaseUrl()}${remote.demUrl}` : null,
    tileBytes: remote.sizeBytes,
    demBytes: remote.demSizeBytes ?? undefined,
  });
  patchPack(qc, packId, () => result);
  return result;
}

/**
 * Paket listesi. Karo sunucusu tanımlıysa liste **diskteki gerçekle** uzlaştırılır:
 * katalog sunucudan/demo verisinden gelir, "indirilmiş mi / sürümü eski mi" sorusunu
 * paket yöneticisi cevaplar. Sunucu tanımlı değilse demo verisi olduğu gibi kullanılır.
 */
export function useMapPacks() {
  return useQuery({
    queryKey: queryKeys.maps.packs,
    queryFn: () => getDataProvider().maps.packs(),
    select: (packs) =>
      tilesBaseUrl()
        ? packs.map((p) =>
            p.status === 'downloading' ? p : getPackManager().reconcile(p, p.version),
          )
        : packs,
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === 'downloading') ? 500 : false,
  });
}

export function useDownloadPack() {
  const qc = useQueryClient();
  const server = useTileServerPacks();
  const serverPacks = server.data ?? [];

  // Gerçek indirmenin ilerlemesi doğrudan paket önbelleğine yazılır.
  useEffect(() => {
    return getPackManager().addProgressListener((packId, progress) => {
      qc.setQueryData<MapPack[]>(queryKeys.maps.packs, (list) =>
        list?.map((p) => (p.id === packId ? packReducer(p, { type: 'progress', progress }) : p)),
      );
    });
  }, [qc]);

  return useMutation({
    mutationFn: (packId: ID) => downloadPack(qc, packId, serverPacks),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.packs }),
  });
}

/** Süren indirmeyi durdurur; gerçek indirme yoksa `false` döner. */
export function useCancelDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: ID) => {
      const cancelled = getPackManager().cancel(packId);
      await getDataProvider().maps.remove(packId);
      return cancelled;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.maps.packs }),
  });
}

export function useRemovePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: ID) => {
      const list = qc.getQueryData<MapPack[]>(queryKeys.maps.packs) ?? [];
      const pack = list.find((p) => p.id === packId);
      if (pack) await getPackManager().remove(pack);
      return getDataProvider().maps.remove(packId);
    },
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
