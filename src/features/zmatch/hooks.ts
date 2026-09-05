import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { AdventureType, CreateMatchInput, GeoPoint, ID } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useMatchCandidates(origin: GeoPoint, radiusKm: number, type: AdventureType | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.matches.candidates(me.id, origin, radiusKm, type),
    queryFn: () => getDataProvider().matches.candidates(me.id, origin, radiusKm, type),
    placeholderData: (prev) => prev,
  });
}

export function useMyMatches() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.matches.mine(me.id),
    queryFn: () => getDataProvider().matches.listMine(me.id),
  });
}

export function useMatch(id: ID) {
  return useQuery({
    queryKey: queryKeys.matches.detail(id),
    queryFn: () => getDataProvider().matches.getById(id),
  });
}

export function useRequestMatch() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMatchInput) => getDataProvider().matches.request(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.matches.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useRespondMatch() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, accept }: { matchId: ID; accept: boolean }) =>
      getDataProvider().matches.respond(me.id, matchId, accept),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.matches.all });
      qc.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(me.id) });
    },
  });
}
