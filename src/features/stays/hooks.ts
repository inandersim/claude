import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type {
  BusinessFilter,
  CreateStayInput,
  GeoPoint,
  ID,
  RegisterBusinessInput,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useBusinesses(filter: BusinessFilter) {
  return useQuery({
    queryKey: queryKeys.businesses.list(filter),
    queryFn: () => getDataProvider().businesses.list(filter),
    placeholderData: (prev) => prev,
  });
}

export function useBusiness(id: ID, origin: GeoPoint | null) {
  return useQuery({
    queryKey: queryKeys.businesses.detail(id),
    queryFn: () => getDataProvider().businesses.getById(id, origin),
  });
}

export function useRegisterBusiness() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterBusinessInput) =>
      getDataProvider().businesses.register(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.businesses.all }),
  });
}

export function useReserveStay() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStayInput) => getDataProvider().businesses.reserve(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.businesses.stays(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMyStays() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.businesses.stays(me.id),
    queryFn: () => getDataProvider().businesses.myStays(me.id),
  });
}
