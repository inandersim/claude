import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  isConsultOpen,
  type ConsultationWithDetails,
  type ConsultMessage,
  type DoctorSpecialty,
  type ID,
  type RequestConsultInput,
  type User,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Aktif danışmada mesajlar 2 sn'de bir yenilenir (mock doktor yanıtları için). */
const ACTIVE_POLL_MS = 2000;

export function useDoctors(specialty: DoctorSpecialty | null, onlineOnly: boolean) {
  return useQuery({
    queryKey: queryKeys.telemed.doctors(specialty, onlineOnly),
    queryFn: () => getDataProvider().telemed.doctors(specialty, onlineOnly),
    placeholderData: (prev) => prev,
  });
}

export function useDoctor(id: ID) {
  return useQuery({
    queryKey: queryKeys.telemed.doctor(id),
    queryFn: () => getDataProvider().telemed.doctor(id),
    enabled: Boolean(id),
  });
}

/** Ön triyaj (mutation: şikâyet değiştikçe debounce ile çağrılır). */
export function useTriage() {
  return useMutation({
    mutationFn: (input: { complaint: string; speciesId?: ID | null; locale: string }) =>
      getDataProvider().telemed.triage(input),
  });
}

export function useRequestConsult() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestConsultInput) => getDataProvider().telemed.request(me.id, input),
    onSuccess: (consultation) => {
      qc.setQueryData(queryKeys.telemed.consultation(me.id, consultation.id), consultation);
      qc.invalidateQueries({ queryKey: queryKeys.telemed.mine(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useConsultation(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.telemed.consultation(me.id, id),
    queryFn: () => getDataProvider().telemed.consultation(me.id, id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && isConsultOpen(data.status) ? ACTIVE_POLL_MS : false;
    },
  });
}

export function useMyConsultations() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.telemed.mine(me.id),
    queryFn: () => getDataProvider().telemed.myConsultations(me.id),
  });
}

type SendInput = { content: string; imageUri?: string | null };
type Cached = ConsultationWithDetails | null | undefined;

/** İyimser güncelleme ile mesaj gönderimi. */
export function useSendConsultMessage(consultationId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.telemed.consultation(me.id, consultationId);
  return useMutation({
    mutationFn: ({ content, imageUri = null }: SendInput) =>
      getDataProvider().telemed.send(me.id, consultationId, content, imageUri),
    onMutate: async ({ content, imageUri = null }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Cached>(key);
      if (previous) {
        const optimistic: ConsultMessage & { sender: User } = {
          id: `tmp_${previous.messages.length}_${content.length}`,
          consultationId,
          senderId: me.id,
          content,
          imageUrl: imageUri,
          isInstruction: false,
          createdAt: new Date().toISOString(),
          sender: me,
        };
        qc.setQueryData<ConsultationWithDetails>(key, {
          ...previous,
          messages: [...previous.messages, optimistic],
        });
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useEndConsult(consultationId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (summary?: string | null) =>
      getDataProvider().telemed.end(me.id, consultationId, summary ?? null),
    onSuccess: (consultation) => {
      qc.setQueryData(queryKeys.telemed.consultation(me.id, consultationId), consultation);
      qc.invalidateQueries({ queryKey: queryKeys.telemed.mine(me.id) });
    },
  });
}

export function useCancelConsult(consultationId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().telemed.cancel(me.id, consultationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.telemed.consultation(me.id, consultationId) });
      qc.invalidateQueries({ queryKey: queryKeys.telemed.mine(me.id) });
    },
  });
}
