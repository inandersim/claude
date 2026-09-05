import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, NotificationWithSender } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useNotifications() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.notifications.list(me.id),
    queryFn: () => getDataProvider().notifications.list(me.id),
  });
}

export function useUnreadCount() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.notifications.unread(me.id),
    queryFn: () => getDataProvider().notifications.unreadCount(me.id),
    refetchInterval: 15_000,
  });
}

export function useMarkNotificationRead() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().notifications.markRead(me.id, id),
    onMutate: async (id) => {
      const key = queryKeys.notifications.list(me.id);
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<NotificationWithSender[]>(key, (list) =>
        list?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      qc.setQueryData<number>(queryKeys.notifications.unread(me.id), (c) =>
        Math.max(0, (c ?? 1) - 1),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().notifications.markAllRead(me.id),
    onMutate: async () => {
      const key = queryKeys.notifications.list(me.id);
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<NotificationWithSender[]>(key, (list) =>
        list?.map((n) => ({ ...n, isRead: true })),
      );
      qc.setQueryData<number>(queryKeys.notifications.unread(me.id), 0);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
