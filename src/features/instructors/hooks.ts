import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { CreateBookingInput, GeoPoint, ID, InstructorFilter } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useInstructors(origin: GeoPoint | null, filter: InstructorFilter = {}) {
  return useQuery({
    queryKey: queryKeys.instructors.list(origin, filter),
    queryFn: () => getDataProvider().instructors.list(origin, filter),
    placeholderData: (prev) => prev,
  });
}

export function useInstructor(id: ID, origin: GeoPoint | null) {
  return useQuery({
    queryKey: queryKeys.instructors.detail(id),
    queryFn: () => getDataProvider().instructors.getById(id, origin),
  });
}

export function useInstructorByUser(userId: ID) {
  return useQuery({
    queryKey: queryKeys.instructors.byUser(userId),
    queryFn: () => getDataProvider().instructors.getByUserId(userId),
  });
}

export function useInstructorReviews(id: ID) {
  return useQuery({
    queryKey: queryKeys.instructors.reviews(id),
    queryFn: () => getDataProvider().instructors.reviews(id),
  });
}

export function useBook() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => getDataProvider().instructors.book(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instructors.bookings(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMyBookings() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.instructors.bookings(me.id),
    queryFn: () => getDataProvider().instructors.myBookings(me.id),
  });
}

export function useRespondBooking() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, accept }: { bookingId: ID; accept: boolean }) =>
      getDataProvider().instructors.respondBooking(me.id, bookingId, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instructors.bookings(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
