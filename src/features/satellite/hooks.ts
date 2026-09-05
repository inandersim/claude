import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { GeoPoint, ID, LinkType, PairDeviceInput, SendSatMessageInput } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useSatDevices() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.satellite.devices(me.id),
    queryFn: () => getDataProvider().satellite.devices(me.id),
  });
}

export function usePairDevice() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PairDeviceInput) => getDataProvider().satellite.pair(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.satellite.devices(me.id) }),
  });
}

export function useUnpairDevice() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: ID) => getDataProvider().satellite.unpair(me.id, deviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.satellite.devices(me.id) }),
  });
}

/** Bağlantı durumu; 5 sn'de bir yenilenir (sinyal dalgalanması). */
export function useLinkStatus() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.satellite.link(me.id),
    queryFn: () => getDataProvider().satellite.linkStatus(me.id),
    refetchInterval: 5000,
  });
}

export function useSetLink() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (link: LinkType) => getDataProvider().satellite.setLink(me.id, link),
    onSuccess: (status) => qc.setQueryData(queryKeys.satellite.link(me.id), status),
  });
}

/** Mesajlar; gönderilenlerin "iletildi"ye geçişini görmek için kısa aralıkla yenilenir. */
export function useSatMessages() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.satellite.messages(me.id),
    queryFn: () => getDataProvider().satellite.messages(me.id),
    refetchInterval: (query) =>
      query.state.data?.some((m) => m.status === 'sent' || m.status === 'sending') ? 2000 : false,
  });
}

export function useSendSatMessage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendSatMessageInput) => getDataProvider().satellite.send(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.satellite.messages(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.satellite.devices(me.id) });
    },
  });
}

export function useFlushQueue() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().satellite.flush(me.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.satellite.messages(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.satellite.devices(me.id) });
    },
  });
}

export function useSos() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.satellite.sos(me.id),
    queryFn: () => getDataProvider().satellite.sos(me.id),
  });
}

function useInvalidateSos() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.satellite.sos(me.id) });
    qc.invalidateQueries({ queryKey: queryKeys.satellite.messages(me.id) });
    qc.invalidateQueries({ queryKey: ['emergency'] });
    qc.invalidateQueries({ queryKey: queryKeys.presence.all });
    qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
  };
}

export function useStartSos() {
  const me = useCurrentUser();
  const invalidate = useInvalidateSos();
  return useMutation({
    mutationFn: (coords: GeoPoint) => getDataProvider().satellite.startSos(me.id, coords),
    onSuccess: invalidate,
  });
}

export function useAdvanceSos() {
  const me = useCurrentUser();
  const invalidate = useInvalidateSos();
  return useMutation({
    mutationFn: () => getDataProvider().satellite.advanceSos(me.id),
    onSuccess: invalidate,
  });
}

export function useCancelSos() {
  const me = useCurrentUser();
  const invalidate = useInvalidateSos();
  return useMutation({
    mutationFn: () => getDataProvider().satellite.cancelSos(me.id),
    onSuccess: invalidate,
  });
}
