import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useT } from '@/core/i18n';
import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { AiContext, AiMessage, AiThreadWithMessages, ID, TripPlan } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Asistana gönderilen kullanıcı bağlamı (dil, konum, ilgi alanları, plan). */
export function useAiContext(): AiContext {
  const me = useCurrentUser();
  const { locale } = useT();
  return {
    locale,
    coords: me.coords,
    adventureTypes: me.favoriteTypes,
    plan: me.plan,
  };
}

export function useAiThreads() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.ai.threads(me.id),
    queryFn: () => getDataProvider().ai.threads(me.id),
  });
}

/** `threadId` null ise (yeni sohbet) sorgu çalışmaz; iyimser mesajlar önbellekten okunur. */
export function useAiThread(threadId: ID | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.ai.thread(me.id, threadId),
    queryFn: () => (threadId ? getDataProvider().ai.thread(me.id, threadId) : null),
    enabled: Boolean(threadId),
  });
}

interface SendContext {
  key: ReturnType<typeof queryKeys.ai.thread>;
  previous: AiThreadWithMessages | null | undefined;
  optimistic: AiMessage;
}

/**
 * Mesaj gönderir; kullanıcı mesajını hemen gösterir (optimistic), yanıt gelince
 * gerçek sohbeti önbelleğe yazar. `threadId` null → yeni sohbet açılır.
 */
export function useSendAiMessage(threadId: ID | null) {
  const me = useCurrentUser();
  const ctx = useAiContext();
  const qc = useQueryClient();
  const key = queryKeys.ai.thread(me.id, threadId);

  return useMutation<AiMessage, Error, string, SendContext>({
    mutationFn: (content) => getDataProvider().ai.send(me.id, threadId, content, ctx),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AiThreadWithMessages | null>(key);
      const nowIso = new Date().toISOString();
      const optimistic: AiMessage = {
        id: `tmp_${Date.now()}`,
        threadId: threadId ?? 'new',
        role: 'user',
        content,
        intent: null,
        actions: [],
        createdAt: nowIso,
      };
      qc.setQueryData<AiThreadWithMessages | null>(key, (old) =>
        old
          ? { ...old, messages: [...old.messages, optimistic] }
          : {
              id: threadId ?? 'new',
              userId: me.id,
              title: '',
              createdAt: nowIso,
              updatedAt: nowIso,
              messages: [optimistic],
            },
      );
      return { key, previous, optimistic };
    },
    onError: (_error, _content, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSuccess: (reply, _content, context) => {
      const realKey = queryKeys.ai.thread(me.id, reply.threadId);
      const current = qc.getQueryData<AiThreadWithMessages | null>(key);
      const userMessage: AiMessage = {
        ...context.optimistic,
        id: `${context.optimistic.id}_sent`,
        threadId: reply.threadId,
      };
      const messages = [
        ...(current?.messages ?? []).filter((m) => m.id !== context.optimistic.id),
        userMessage,
        reply,
      ];
      qc.setQueryData<AiThreadWithMessages | null>(realKey, (old) => ({
        id: reply.threadId,
        userId: me.id,
        title: old?.title ?? current?.title ?? '',
        createdAt: old?.createdAt ?? current?.createdAt ?? reply.createdAt,
        updatedAt: reply.createdAt,
        messages: old
          ? [...old.messages.filter((m) => m.id !== context.optimistic.id), userMessage, reply]
          : messages,
      }));
      qc.invalidateQueries({ queryKey: realKey });
      qc.invalidateQueries({ queryKey: queryKeys.ai.threads(me.id) });
    },
  });
}

export function usePlanTrip() {
  const me = useCurrentUser();
  const ctx = useAiContext();
  return useMutation<TripPlan, Error, string>({
    mutationFn: (prompt) => getDataProvider().ai.planTrip(me.id, prompt, ctx),
  });
}

export function useDeleteThread() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<void, Error, ID>({
    mutationFn: (threadId) => getDataProvider().ai.deleteThread(me.id, threadId),
    onSuccess: (_void, threadId) => {
      qc.removeQueries({ queryKey: queryKeys.ai.thread(me.id, threadId), exact: true });
      qc.invalidateQueries({ queryKey: queryKeys.ai.threads(me.id) });
    },
  });
}
