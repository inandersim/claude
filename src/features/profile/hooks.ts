import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, User } from '@/domain';
import { useCurrentUser, useSessionStore } from '@/features/auth/session.store';

export function useUser(id: ID) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => getDataProvider().users.getById(id),
  });
}

export function useIsFollowing(otherId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.users.following(me.id, otherId),
    queryFn: () => getDataProvider().users.isFollowing(me.id, otherId),
    enabled: me.id !== otherId,
  });
}

export function useToggleFollow(otherId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const refreshUser = useSessionStore((s) => s.refreshUser);

  return useMutation({
    mutationFn: () => getDataProvider().users.toggleFollow(me.id, otherId),
    onMutate: async () => {
      const key = queryKeys.users.following(me.id, otherId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<boolean>(key);
      qc.setQueryData<boolean>(key, !previous);
      qc.setQueryData<User | null>(queryKeys.users.detail(otherId), (user) =>
        user ? { ...user, followersCount: user.followersCount + (previous ? -1 : 1) } : user,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(queryKeys.users.following(me.id, otherId), ctx?.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(otherId) });
      qc.invalidateQueries({ queryKey: queryKeys.users.following(me.id, otherId) });
      refreshUser();
    },
  });
}
