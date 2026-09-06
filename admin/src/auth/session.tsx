import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { adminApi } from '../data';
import type { AdminAccount } from '../data/adminApi';
import { can, type Permission } from './roles';

interface SessionValue {
  account: AdminAccount | null;
  accounts: AdminAccount[];
  loading: boolean;
  switchAccount: (id: string) => Promise<void>;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['admin', 'me'], queryFn: () => adminApi.auth.me() });
  const accountsQuery = useQuery({ queryKey: ['admin', 'accounts'], queryFn: () => adminApi.auth.accounts() });

  const switchAccount = useCallback(
    async (id: string) => {
      await adminApi.auth.signInAs(id);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const account = meQuery.data ?? null;

  const value = useMemo<SessionValue>(
    () => ({
      account,
      accounts: accountsQuery.data ?? [],
      loading: meQuery.isLoading,
      switchAccount,
      can: (permission: Permission) => can(account?.role ?? null, permission),
    }),
    [account, accountsQuery.data, meQuery.isLoading, switchAccount],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return context;
}

/** Kısayol: `const can = useCan(); can('users.moderate')` */
export function useCan(): (permission: Permission) => boolean {
  return useSession().can;
}
