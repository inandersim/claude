import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { AmsCheck, CreateReturnPlanInput, DestinationFilter, GeoPoint, ID } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useDestinations(filter: DestinationFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.destinations.list(me.id, filter),
    queryFn: () => getDataProvider().destinations.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useDestination(id: ID, origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.destinations.detail(me.id, id),
    queryFn: () => getDataProvider().destinations.getById(me.id, id, origin),
    enabled: Boolean(id),
  });
}

export function useDestinationStages(id: ID) {
  return useQuery({
    queryKey: queryKeys.destinations.stages(id),
    queryFn: () => getDataProvider().destinations.stages(id),
    enabled: Boolean(id),
  });
}

export function useToggleSaveDestination() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (destinationId: ID) =>
      getDataProvider().destinations.toggleSave(me.id, destinationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations.all }),
  });
}

export function useSavedDestinations() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.destinations.saved(me.id),
    queryFn: () => getDataProvider().destinations.saved(me.id),
  });
}

export function useAmsChecks() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.destinations.ams(me.id),
    queryFn: () => getDataProvider().destinations.amsChecks(me.id),
  });
}

export type LogAmsInput = Omit<AmsCheck, 'id' | 'userId' | 'score' | 'severity' | 'createdAt'>;

export function useLogAms() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogAmsInput) => getDataProvider().destinations.logAms(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations.ams(me.id) }),
  });
}

export function useReturnPlans() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.destinations.plans(me.id),
    queryFn: () => getDataProvider().destinations.returnPlans(me.id),
  });
}

export function useCreateReturnPlan() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReturnPlanInput) =>
      getDataProvider().destinations.createReturnPlan(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations.plans(me.id) }),
  });
}

export function useMarkReturned() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: ID) => getDataProvider().destinations.markReturned(me.id, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations.plans(me.id) }),
  });
}

export function useCancelReturnPlan() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: ID) => getDataProvider().destinations.cancelReturnPlan(me.id, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations.plans(me.id) }),
  });
}

/** Gecikme kontrolü aralığı (ms). */
const OVERDUE_INTERVAL_MS = 60_000;

/**
 * Uygulama açıkken 60 sn'de bir `checkOverdue` çağırır; süresi dolan planları overdue yapar
 * ve acil kişilere bildirim gönderilmesini tetikler. Bir plan güncellenirse ilgili sorguları yeniler.
 */
export function useOverdueCheck(enabled = true) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const updated = await getDataProvider().destinations.checkOverdue(
          me.id,
          new Date().toISOString(),
        );
        if (!cancelled && updated.length > 0) {
          qc.invalidateQueries({ queryKey: queryKeys.destinations.plans(me.id) });
          qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
        }
      } catch {
        // sessizce geç; bir sonraki turda tekrar dener
      } finally {
        busy.current = false;
      }
    };
    run();
    const timer = setInterval(run, OVERDUE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, me.id, qc]);
}
