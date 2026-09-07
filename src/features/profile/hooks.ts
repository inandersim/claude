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
      // "Takip" sekmesi takip listesine göre süzülüyor: akış önbellekleri de tazelenmeli.
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
      refreshUser();
    },
  });
}

/**
 * Profil güncelleme.
 *
 * Sözleşmede (`users.updateProfile`) baştan beri vardı ama hiçbir yerden
 * çağrılmıyordu — profil düzenleme hattı hiç bağlanmamıştı. İlk çağıran,
 * irtifa değerlendirmesi için gereken bazal nabız alanı.
 *
 * Başarıda oturum kopyası da tazelenir: `useCurrentUser` bu kopyayı okuyor ve
 * güncellenmezse ekran eski değeri gösterirdi.
 */
export function useUpdateProfile() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const refreshUser = useSessionStore((s) => s.refreshUser);
  return useMutation({
    mutationFn: (patch: Parameters<ReturnType<typeof getDataProvider>['users']['updateProfile']>[1]) =>
      getDataProvider().users.updateProfile(me.id, patch),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(me.id) });
      await refreshUser();
    },
  });
}
