import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { ClubEventWithClub, ClubFilter, CreateClubEventInput, ID } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Kulüp listesi (filtreli). */
export function useClubs(filter: ClubFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.list(me.id, filter),
    queryFn: () => getDataProvider().clubs.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useClub(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.detail(me.id, id),
    queryFn: () => getDataProvider().clubs.getById(me.id, id),
    enabled: Boolean(id),
  });
}

export function useClubMembers(clubId: ID) {
  return useQuery({
    queryKey: queryKeys.clubs.members(clubId),
    queryFn: () => getDataProvider().clubs.members(clubId),
    enabled: Boolean(clubId),
  });
}

function useInvalidateClubs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.clubs.all });
}

export function useJoinClub() {
  const me = useCurrentUser();
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: (clubId: ID) => getDataProvider().clubs.join(me.id, clubId),
    onSuccess: invalidate,
  });
}

export function useLeaveClub() {
  const me = useCurrentUser();
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: (clubId: ID) => getDataProvider().clubs.leave(me.id, clubId),
    onSuccess: invalidate,
  });
}

/** Etkinlikler; `clubId` verilmezse tüm kulüplerin etkinlikleri (başlangıca göre artan). */
export function useClubEvents(clubId: ID | null = null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.events(me.id, clubId),
    queryFn: () => getDataProvider().clubs.events(me.id, clubId),
  });
}

export function useClubEvent(eventId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.event(me.id, eventId),
    queryFn: () => getDataProvider().clubs.event(me.id, eventId),
    enabled: Boolean(eventId),
  });
}

/** RSVP aç/kapat — iyimser güncelleme; hata durumunda geri alınır. */
export function useRsvp() {
  const me = useCurrentUser();
  const qc = useQueryClient();

  const patch = (eventId: ID, toggle: (e: ClubEventWithClub) => ClubEventWithClub) => {
    qc.setQueriesData<ClubEventWithClub[]>({ queryKey: ['clubs', 'events', me.id] }, (list) =>
      list ? list.map((e) => (e.id === eventId ? toggle(e) : e)) : list,
    );
    qc.setQueryData<ClubEventWithClub | null>(queryKeys.clubs.event(me.id, eventId), (e) =>
      e ? toggle(e) : e,
    );
  };

  return useMutation({
    mutationFn: (eventId: ID) => getDataProvider().clubs.rsvp(me.id, eventId),
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: ['clubs', 'events', me.id] });
      await qc.cancelQueries({ queryKey: queryKeys.clubs.event(me.id, eventId) });
      patch(eventId, (e) => ({
        ...e,
        rsvped: !e.rsvped,
        attendeeCount: Math.max(0, e.attendeeCount + (e.rsvped ? -1 : 1)),
      }));
    },
    onError: (_err, eventId) => {
      patch(eventId, (e) => ({
        ...e,
        rsvped: !e.rsvped,
        attendeeCount: Math.max(0, e.attendeeCount + (e.rsvped ? -1 : 1)),
      }));
    },
    onSettled: (_data, _err, eventId) => {
      qc.invalidateQueries({ queryKey: ['clubs', 'events', me.id] });
      qc.invalidateQueries({ queryKey: queryKeys.clubs.event(me.id, eventId) });
      qc.invalidateQueries({ queryKey: queryKeys.clubs.ranking });
    },
  });
}

export function useCreateClubEvent() {
  const me = useCurrentUser();
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: (input: CreateClubEventInput) => getDataProvider().clubs.createEvent(me.id, input),
    onSuccess: invalidate,
  });
}

export function useClubRanking() {
  return useQuery({
    queryKey: queryKeys.clubs.ranking,
    queryFn: () => getDataProvider().clubs.ranking(),
  });
}

export function useStudentVerification() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.student(me.id),
    queryFn: () => getDataProvider().clubs.studentVerification(me.id),
  });
}

export function useVerifyStudent() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => getDataProvider().clubs.verifyStudent(me.id, email),
    onSuccess: (record) => {
      qc.setQueryData(queryKeys.clubs.student(me.id), record);
      qc.invalidateQueries({ queryKey: queryKeys.clubs.student(me.id) });
    },
  });
}

export function useMyClubs() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.clubs.mine(me.id),
    queryFn: () => getDataProvider().clubs.myClubs(me.id),
  });
}
