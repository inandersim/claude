import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { EmergencyContact, GeoPoint } from '@/domain';
import { useCurrentUser, useSessionStore } from '@/features/auth/session.store';

export function useEmergencyCenters(origin: GeoPoint) {
  return useQuery({
    queryKey: queryKeys.emergency.centers(origin),
    queryFn: () => getDataProvider().emergency.centers(origin, 6),
  });
}

export function useActiveSos() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.emergency.sos(me.id),
    queryFn: () => getDataProvider().emergency.activeSos(me.id),
  });
}

export function useTriggerSos() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coords: GeoPoint) => getDataProvider().emergency.triggerSos(me.id, coords),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.emergency.sos(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.presence.all });
    },
  });
}

export function useResolveSos() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().emergency.resolveSos(me.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.emergency.sos(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.presence.all });
    },
  });
}

export function useUpdateEmergencyContacts() {
  const me = useCurrentUser();
  const setUser = useSessionStore((s) => s.setUser);
  return useMutation({
    mutationFn: (contacts: EmergencyContact[]) =>
      getDataProvider().emergency.updateContacts(me.id, contacts),
    onSuccess: (user) => setUser(user),
  });
}
