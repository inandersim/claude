import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { BookStayInput, HostProfile, ID, ISODate, QuoteInput, StayUnit } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

const inv = () => getDataProvider().inventory;

/** İşletmenin birimleri */
export function useUnits(businessId: ID | null | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.units(businessId ?? ''),
    queryFn: () => inv().units(businessId!),
    enabled: !!businessId,
  });
}

/** Birimin [from, to) aralığındaki günlük müsaitliği ve fiyatı */
export function useAvailability(unitId: ID | null | undefined, from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: queryKeys.inventory.availability(unitId ?? '', from, to),
    queryFn: () => inv().availability(unitId!, from, to),
    enabled: !!unitId,
    placeholderData: (prev) => prev,
  });
}

/** Seçilen birim/tarih/misafir için fiyat teklifi */
export function useQuote(input: QuoteInput | null) {
  return useQuery({
    queryKey: queryKeys.inventory.quote(
      input?.unitId ?? '',
      input?.checkIn ?? '',
      input?.checkOut ?? '',
      input?.guests ?? 0,
    ),
    queryFn: () => inv().quote(input!),
    enabled: !!input && !!input.unitId && !!input.checkIn && !!input.checkOut,
    placeholderData: (prev) => prev,
  });
}

/** Emanetle rezervasyon oluştur */
export function useBookStay() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookStayInput) => inv().book(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      qc.invalidateQueries({ queryKey: queryKeys.businesses.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useBookingDetail(bookingId: ID | null | undefined) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.inventory.booking(me.id, bookingId ?? ''),
    queryFn: () => inv().booking(me.id, bookingId!),
    enabled: !!bookingId,
  });
}

/** Kullanıcının rezervasyonları, ödeme kaydıyla birlikte */
export function useMyBookingsWithPayment() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.inventory.bookings(me.id),
    queryFn: () => inv().myBookings(me.id),
  });
}

/** İptal öncesi iade önizlemesi (yalnızca istendiğinde) */
export function useRefundPreview(bookingId: ID | null | undefined, enabled: boolean) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: [...queryKeys.inventory.booking(me.id, bookingId ?? ''), 'refund'] as const,
    queryFn: () => inv().refundPreview(me.id, bookingId!),
    enabled: enabled && !!bookingId,
    staleTime: 0,
  });
}

function useBookingMutation<TArgs>(fn: (meId: ID, args: TArgs) => Promise<unknown>) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(me.id, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      qc.invalidateQueries({ queryKey: queryKeys.businesses.all });
    },
  });
}

export function useCancelBooking() {
  return useBookingMutation((meId, bookingId: ID) => inv().cancel(meId, bookingId));
}

export function useCheckIn() {
  return useBookingMutation((meId, bookingId: ID) => inv().checkIn(meId, bookingId));
}

export function useStayReviews(businessId: ID | null | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.reviews(businessId ?? ''),
    queryFn: () => inv().reviews(businessId!),
    enabled: !!businessId,
  });
}

export function useWriteReview() {
  return useBookingMutation((meId, args: { bookingId: ID; rating: number; text: string }) =>
    inv().review(meId, args.bookingId, args.rating, args.text),
  );
}

export function useHostProfile(businessId: ID | null | undefined) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.inventory.host(me.id, businessId ?? ''),
    queryFn: () => inv().host(me.id, businessId!),
    enabled: !!businessId,
  });
}

export function useHostBookings(businessId: ID | null | undefined) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.inventory.hostBookings(me.id, businessId ?? ''),
    queryFn: () => inv().hostBookings(me.id, businessId!),
    enabled: !!businessId,
  });
}

export function useBlockDates() {
  return useBookingMutation((meId, args: { unitId: ID; from: ISODate; to: ISODate }) =>
    inv().blockDates(meId, args.unitId, args.from, args.to),
  );
}

export function useUpsertUnit() {
  return useBookingMutation((meId, unit: Omit<StayUnit, 'id'> & { id?: ID }) =>
    inv().upsertUnit(meId, unit),
  );
}

export function useVerifyHost() {
  return useBookingMutation((meId, args: { businessId: ID; level: HostProfile['verification'] }) =>
    inv().verifyHost(meId, args.businessId, args.level),
  );
}
