import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { realtimeAralik, useRealtime } from '@/core/hooks/useRealtime';
import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ID, LiveStreamWithHost, StartStreamInput, StreamMessageWithAuthor } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useStreams() {
  return useQuery({
    queryKey: queryKeys.live.list,
    queryFn: () => getDataProvider().live.list(),
    refetchInterval: 20_000,
  });
}

export function useStream(id: ID) {
  return useQuery({
    queryKey: queryKeys.live.detail(id),
    queryFn: () => getDataProvider().live.getById(id),
    refetchInterval: 10_000,
  });
}

/** Yayın ekranı açıkken izleyici sayacına katılır, kapanınca ayrılır. */
export function useJoinStream(id: ID, enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const provider = getDataProvider();
    provider.live
      .join(id)
      .then(() => qc.invalidateQueries({ queryKey: queryKeys.live.detail(id) }));
    return () => {
      provider.live.leave(id).then(() => qc.invalidateQueries({ queryKey: queryKeys.live.all }));
    };
  }, [id, enabled, qc]);
}

/**
 * Yayın sohbeti. Canlı yayında 5 saniyelik gecikme sohbeti akıcı olmaktan
 * çıkarıyordu; anlık abonelik varken mesaj geldiği anda görünür.
 */
export function useStreamMessages(streamId: ID) {
  const key = queryKeys.live.messages(streamId);
  useRealtime(
    streamId ? (api, tetikle) => api.streamMessages(streamId, tetikle) : null,
    key,
  );
  return useQuery({
    queryKey: key,
    queryFn: () => getDataProvider().live.messages(streamId),
    refetchInterval: realtimeAralik(30_000, 5_000),
  });
}

export function useSendStreamMessage(streamId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => getDataProvider().live.sendMessage(me.id, streamId, content),
    onMutate: async (content) => {
      const key = queryKeys.live.messages(streamId);
      await qc.cancelQueries({ queryKey: key });
      const optimistic: StreamMessageWithAuthor = {
        id: `tmp_${Date.now()}`,
        streamId,
        authorId: me.id,
        content,
        createdAt: new Date().toISOString(),
        author: me,
      };
      qc.setQueryData<StreamMessageWithAuthor[]>(key, (list) => [...(list ?? []), optimistic]);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.live.messages(streamId) }),
  });
}

export function useStartStream() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartStreamInput) => getDataProvider().live.start(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.live.all }),
  });
}

export function useEndStream() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().live.end(me.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.live.all }),
  });
}

export function useLikeStream(id: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().live.like(id),
    onMutate: async () => {
      const key = queryKeys.live.detail(id);
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<LiveStreamWithHost | null>(key, (s) =>
        s ? { ...s, likesCount: s.likesCount + 1 } : s,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.live.detail(id) }),
  });
}
