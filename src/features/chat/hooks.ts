import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, Message } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useThread(otherId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.messages.thread(me.id, otherId),
    queryFn: () => getDataProvider().messages.thread(me.id, otherId),
    refetchInterval: 8_000,
  });
}

export function useSendMessage(otherId: ID, matchId: ID | null) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      getDataProvider().messages.send(me.id, otherId, content, matchId),
    onMutate: async (content) => {
      const key = queryKeys.messages.thread(me.id, otherId);
      await qc.cancelQueries({ queryKey: key });
      const optimistic: Message = {
        id: `tmp_${Date.now()}`,
        senderId: me.id,
        receiverId: otherId,
        content,
        matchId,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      qc.setQueryData<Message[]>(key, (list) => [...(list ?? []), optimistic]);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.messages.thread(me.id, otherId) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
