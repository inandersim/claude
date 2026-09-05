import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { Plan } from '@/domain';
import { useCurrentUser, useSessionStore } from '@/features/auth/session.store';

/**
 * Abonelik satın alma. Üretimde RevenueCat `Purchases.purchasePackage` çağrısı ile
 * değiştirilir; mock sağlayıcı planı doğrudan kullanıcıya yazar.
 */
export function useSubscribe() {
  const me = useCurrentUser();
  const setUser = useSessionStore((s) => s.setUser);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plan, period }: { plan: Plan; period: 'monthly' | 'yearly' }) =>
      getDataProvider().billing.subscribe(me.id, plan, period),
    onSuccess: (user) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.billing.earnings(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.businesses.all });
    },
  });
}

export function useEarnings() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.billing.earnings(me.id),
    queryFn: () => getDataProvider().billing.earnings(me.id),
  });
}
