import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { GeoPoint, HazardZoneWithReporter, ID, ReportHazardInput } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useHazards(origin: GeoPoint | null, radiusKm?: number, includeResolved = false) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.hazards.list(me.id, origin, radiusKm ?? null, includeResolved),
    queryFn: () => getDataProvider().hazards.list(me.id, origin, radiusKm, includeResolved),
    placeholderData: (prev) => prev,
  });
}

export function useHazard(id: ID, origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.hazards.detail(me.id, id),
    queryFn: () => getDataProvider().hazards.getById(me.id, id, origin),
  });
}

export function useReportHazard() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportHazardInput) => getDataProvider().hazards.report(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hazards.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useConfirmHazard() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().hazards.confirm(me.id, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.hazards.all });
      qc.setQueriesData<HazardZoneWithReporter[] | HazardZoneWithReporter | null>(
        { queryKey: queryKeys.hazards.all },
        (data) => {
          const patch = (h: HazardZoneWithReporter) =>
            h.id === id && !h.confirmedByMe
              ? { ...h, confirmedByMe: true, confirmations: h.confirmations + 1 }
              : h;
          if (!data) return data;
          return Array.isArray(data) ? data.map(patch) : patch(data);
        },
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.hazards.all }),
  });
}

export function useResolveHazard() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().hazards.resolve(me.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.hazards.all }),
  });
}
