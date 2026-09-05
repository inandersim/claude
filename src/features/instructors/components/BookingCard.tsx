import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  BOOKING_STATUS_META,
  formatPriceTry,
  type BookingWithParties,
} from '@/domain';

interface Props {
  booking: BookingWithParties;
  meId: string;
  onRespond?: (id: string, accept: boolean) => void;
  busy?: boolean;
}

export function BookingCard({ booking, meId, onRespond, busy }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const asInstructor = booking.instructor.userId === meId;
  const other = asInstructor ? booking.student : booking.instructor.user;
  const status = BOOKING_STATUS_META[booking.status];
  const type = ADVENTURE_TYPE_META[booking.adventureType];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Avatar
          uri={other.avatarUrl}
          name={other.displayName}
          size={44}
          verified={other.isVerified}
        />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {other.displayName}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {asInstructor ? t('booking.incoming') : booking.instructor.headline}
          </Text>
        </View>
        <Badge label={t(status.labelKey)} color={status.color} />
      </View>
      {booking.message ? (
        <Text variant="bodySm" color="textMuted" numberOfLines={3}>
          “{booking.message}”
        </Text>
      ) : null}
      <View style={styles.details}>
        <View style={[styles.detail, { backgroundColor: type.softColor }]}>
          <Icon name={type.icon} size={12} color={type.color} strokeWidth={2.6} />
          <Text variant="caption" weight="bold" color={type.color}>
            {t(type.labelKey)}
          </Text>
        </View>
        <View style={styles.detail}>
          <Icon name="calendar" size={12} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted">
            {formatDate(booking.date, locale, 'd MMM yyyy')}
          </Text>
        </View>
        <View style={styles.detail}>
          <Icon name="banknote" size={12} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted">
            {formatPriceTry(booking.priceTry, locale)}
          </Text>
        </View>
      </View>
      {asInstructor && booking.status === 'pending' && onRespond ? (
        <View style={styles.actions}>
          <Button
            label={t('booking.decline')}
            variant="secondary"
            icon="x"
            style={{ flex: 1 }}
            onPress={() => onRespond(booking.id, false)}
            disabled={busy}
          />
          <Button
            label={t('booking.accept')}
            icon="check"
            style={{ flex: 1.3 }}
            onPress={() => onRespond(booking.id, true)}
            loading={busy}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 26,
    borderRadius: radius.full,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
