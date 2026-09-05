import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { canAcceptPaidBookings, formatPriceTry } from '@/domain';
import { useEarnings } from '@/features/plans/hooks';
import { useCurrentUser } from '@/features/auth/session.store';
import { BookingCard } from '@/features/instructors/components/BookingCard';
import { useMyBookings, useRespondBooking } from '@/features/instructors/hooks';

export default function BookingsScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const toast = useToast();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const earnings = useEarnings();
  const paidMode = canAcceptPaidBookings(me.plan);
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
      <Header
        title={t('booking.title')}
        showBack
        right={
          <Button
            label={paidMode ? t('plans.earnings') : t('plans.upgrade')}
            icon="sparkles"
            size="sm"
            variant={paidMode ? 'secondary' : 'accent'}
            onPress={() => router.push('/plans')}
          />
        }
      />
      <View style={styles.content}>
        {!paidMode && incoming.length > 0 ? (
          <View
            style={[
              styles.gate,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <Icon name="graduation-cap" size={18} color={colors.accent} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t('plans.upgradeToAccept')}
            </Text>
            <Button
              label={t('plans.upgrade')}
              size="sm"
              variant="accent"
              onPress={() => router.push('/plans')}
            />
          </View>
        ) : null}
        {paidMode && earnings.data ? (
          <View
            style={[
              styles.earnings,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text variant="label" color="textSubtle">
                {t('plans.gross').toLocaleUpperCase('tr-TR')}
              </Text>
              <Text variant="h3">{formatPriceTry(earnings.data.grossTry, locale, false)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label" color="textSubtle">
                {t('plans.net').toLocaleUpperCase('tr-TR')}
              </Text>
              <Text variant="h3" color="primary">
                {formatPriceTry(earnings.data.netTry, locale, false)}
              </Text>
            </View>
          </View>
        ) : null}
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
  gate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  earnings: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
});
