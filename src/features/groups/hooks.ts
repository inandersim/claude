import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { realtimeAralik, useRealtime } from '@/core/hooks/useRealtime';
import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  applyVote,
  type CreateGroupInput,
  type GroupFilter,
  type GroupMessageWithSender,
  type GroupRole,
  type GroupWithMembership,
  type ID,
  type SendGroupMessageInput,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Sohbet açıkken yeni mesajları yoklama aralığı (ms). */
const CHAT_POLL_MS = 4000;
/** Abonelik ayaktayken yalnızca kopmaya karşı yedek ağ. */
const CHAT_YEDEK_POLL_MS = 60_000;

/** Grup/kanal listesi (filtreli). Üye olunanlar aktiviteye göre önce gelir. */
export function useGroups(filter: GroupFilter = {}) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.groups.list(me.id, filter),
    queryFn: () => getDataProvider().groups.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useGroup(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.groups.detail(me.id, id),
    queryFn: () => getDataProvider().groups.getById(me.id, id),
    enabled: Boolean(id),
  });
}

function useInvalidateGroups() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.groups.all });
}

export function useCreateGroup() {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => getDataProvider().groups.create(me.id, input),
    onSuccess: invalidate,
  });
}

export function useJoinGroup() {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (groupId: ID) => getDataProvider().groups.join(me.id, groupId),
    onSuccess: invalidate,
  });
}

export function useJoinByCode() {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (code: string) => getDataProvider().groups.joinByCode(me.id, code),
    onSuccess: invalidate,
  });
}

export function useLeaveGroup() {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (groupId: ID) => getDataProvider().groups.leave(me.id, groupId),
    onSuccess: invalidate,
  });
}

export function useGroupMembers(groupId: ID) {
  return useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => getDataProvider().groups.members(groupId),
    enabled: Boolean(groupId),
  });
}

export function useSetRole(groupId: ID) {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: ID; role: GroupRole }) =>
      getDataProvider().groups.setRole(me.id, groupId, userId, role),
    onSuccess: invalidate,
  });
}

/**
 * Sohbet mesajları (eski → yeni).
 *
 * Gerçek arka uçta anlık abonelik güncellemeyi taşır; sorgulama yalnızca
 * abonelik koparsa devreye giren seyrek bir ağdır. Mock'ta abonelik yok, o
 * yüzden eski 4 saniyelik aralık korunur.
 *
 * Aradaki fark faturaya doğrudan yazıyor: sohbeti açık 1.000 kullanıcı 4
 * saniyelik sorgulamayla saatte 900.000 istek üretir; abonelikle yalnızca
 * gerçekten mesaj geldiğinde istek çıkar.
 */
export function useGroupMessages(groupId: ID) {
  const me = useCurrentUser();
  const key = queryKeys.groups.messages(me.id, groupId);
  useRealtime(
    groupId ? (api, tetikle) => api.groupMessages(groupId, tetikle) : null,
    key,
  );
  return useQuery({
    queryKey: key,
    queryFn: () => getDataProvider().groups.messages(me.id, groupId),
    enabled: Boolean(groupId),
    refetchInterval: realtimeAralik(CHAT_YEDEK_POLL_MS, CHAT_POLL_MS),
    refetchIntervalInBackground: false,
  });
}

/** Mesaj gönderme — iyimser ekleme; hata durumunda önceki liste geri yüklenir. */
export function useSendGroupMessage(groupId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.groups.messages(me.id, groupId);
  return useMutation({
    mutationFn: (input: SendGroupMessageInput) =>
      getDataProvider().groups.send(me.id, groupId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GroupMessageWithSender[]>(key);
      const tempId = `tmp_${Date.now()}`;
      const replyTo = previous?.find((m) => m.id === input.replyToId) ?? null;
      const optimistic: GroupMessageWithSender = {
        id: tempId,
        groupId,
        senderId: me.id,
        type: input.type,
        text: input.text,
        imageUrl: input.imageUri ?? null,
        coords: input.coords ?? null,
        routeId: input.routeId ?? null,
        poll: input.poll
          ? {
              question: input.poll.question,
              multi: input.poll.multi,
              options: input.poll.options.map((text, i) => ({ id: `o${i + 1}`, text, votes: 0 })),
            }
          : null,
        replyToId: input.replyToId ?? null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        sender: me,
        myVote: null,
        replyTo: replyTo ? { ...replyTo, sender: replyTo.sender } : null,
      };
      qc.setQueryData<GroupMessageWithSender[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (message, _v, ctx) => {
      qc.setQueryData<GroupMessageWithSender[]>(key, (old) =>
        (old ?? []).map((m) => (m.id === ctx?.tempId ? message : m)),
      );
      qc.invalidateQueries({ queryKey: queryKeys.groups.all, exact: false, refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['groups', 'list'] });
    },
  });
}

/** Anket oyu — iyimser; hata durumunda geri alınır. */
export function useVote(groupId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.groups.messages(me.id, groupId);
  return useMutation({
    mutationFn: ({ messageId, optionIds }: { messageId: ID; optionIds: ID[] }) =>
      getDataProvider().groups.vote(me.id, groupId, messageId, optionIds),
    onMutate: async ({ messageId, optionIds }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GroupMessageWithSender[]>(key);
      qc.setQueryData<GroupMessageWithSender[]>(key, (old) =>
        (old ?? []).map((m) => {
          if (m.id !== messageId || !m.poll) return m;
          const result = applyVote(m.poll, m.myVote, optionIds);
          return { ...m, poll: result.poll, myVote: result.vote };
        }),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (message) => {
      qc.setQueryData<GroupMessageWithSender[]>(key, (old) =>
        (old ?? []).map((m) => (m.id === message.id ? message : m)),
      );
    },
  });
}

export function usePin(groupId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: ID | null) => getDataProvider().groups.pin(me.id, groupId, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.detail(me.id, groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groups.messages(me.id, groupId) });
    },
  });
}

/** Ekrana girince okundu işaretler; listeyi (rozetleri) yeniler. */
export function useMarkRead(groupId: ID, enabled = true) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  useEffect(() => {
    if (!groupId || !enabled) return;
    let cancelled = false;
    getDataProvider()
      .groups.markRead(me.id, groupId)
      .then(() => {
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ['groups', 'list'] });
        qc.invalidateQueries({ queryKey: queryKeys.groups.detail(me.id, groupId) });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled, me.id, qc]);
}

export function useToggleMute(groupId: ID) {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: () => getDataProvider().groups.toggleMute(me.id, groupId),
    onSuccess: invalidate,
  });
}

export function useInviteToGroup(groupId: ID) {
  const me = useCurrentUser();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (userId: ID) => getDataProvider().groups.invite(me.id, groupId, userId),
    onSuccess: invalidate,
  });
}

/** Davet için kullanıcı arama (ad/kullanıcı adı); giriş yapan kullanıcı hariç. */
export function useInviteCandidates(query: string) {
  const me = useCurrentUser();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['groups', 'inviteSearch', trimmed] as const,
    queryFn: () => getDataProvider().users.search(trimmed),
    enabled: trimmed.length >= 2,
    select: (users) => users.filter((u) => u.id !== me.id),
    placeholderData: (prev) => prev,
  });
}

/** Tüm gruplardaki toplam okunmamış mesaj — sekme rozeti için. */
export function useTotalUnread(): number {
  const groups = useGroups({ mineOnly: true });
  return useMemo(
    () => (groups.data ?? []).reduce((sum, g) => sum + g.unreadCount, 0),
    [groups.data],
  );
}

/** Üyelik durumuna göre yazma izni özeti (ekranların ortak kullanımı için). */
export function postingState(group: GroupWithMembership | null | undefined) {
  if (!group) return 'loading' as const;
  if (!group.membership) return 'notMember' as const;
  if (group.kind === 'channel' && group.membership === 'member') return 'readOnly' as const;
  return 'canPost' as const;
}
