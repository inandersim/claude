import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { BookingCard } from '@/features/instructors/components/BookingCard';
import { useMyBookings, useRespondBooking } from '@/features/instructors/hooks';

export default function BookingsScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const me = useCurrentUser();
  const bookings = useMyBookings();
  const respond = useRespondBooking();

  const incoming = bookings.data?.filter((b) => b.instructor.userId === me.id) ?? [];
  const mine = bookings.data?.filter((b) => b.studentId === me.id) ?? [];

  const onRespond = (bookingId: string, accept: boolean) =>
    respond.mutate(
      { bookingId, accept },
      {
        onSuccess: () =>
          toast(
            accept ? t('booking.confirmedToast') : t('booking.declinedToast'),
            accept ? 'success' : 'info',
          ),
      },
    );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('booking.title')} showBack />
      <View style={styles.content}>
        {bookings.isError ? (
          <ErrorState onRetry={() => bookings.refetch()} />
        ) : bookings.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={170} style={{ borderRadius: radius.xl }} />)
        ) : incoming.length === 0 && mine.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t('booking.empty')}
            description={t('booking.emptyDescription')}
            action={{
              label: t('instructors.title'),
              icon: 'graduation-cap',
              variant: 'secondary',
              onPress: () => router.push('/instructors'),
            }}
          />
        ) : (
          <>
            {incoming.length > 0 ? (
              <>
                <Text variant="label" color="textSubtle">
                  {t('booking.incoming').toLocaleUpperCase('tr-TR')} · {incoming.length}
                </Text>
                {incoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    meId={me.id}
                    onRespond={onRespond}
                    busy={respond.isPending && respond.variables?.bookingId === b.id}
                  />
                ))}
              </>
            ) : null}
            {mine.length > 0 ? (
              <>
                <Text
                  variant="label"
                  color="textSubtle"
                  style={{ marginTop: incoming.length ? spacing.sm : 0 }}
                >
                  {t('booking.title').toLocaleUpperCase('tr-TR')} · {mine.length}
                </Text>
                {mine.map((b) => (
                  <BookingCard key={b.id} booking={b} meId={me.id} />
                ))}
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
});
