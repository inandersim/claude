import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { formatPriceTry, sessionAvailability, type CourseSession } from '@/domain';

interface Props {
  session: CourseSession;
  now: number;
  /** Seçilebilir modda (kayıt öncesi) seçili oturum vurgulanır */
  selected?: boolean;
  /** Kullanıcı bu oturuma kayıtlı */
  enrolled?: boolean;
  onSelect?: (session: CourseSession) => void;
  pending?: boolean;
  actionLabel?: string;
}

/** Oturum kartı: tarih kutusu, konum, kontenjan, fiyat ve "Kaydol" butonu. */
export function SessionCard({
  session,
  now,
  selected = false,
  enrolled = false,
  onSelect,
  pending = false,
  actionLabel,
}: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const availability = sessionAvailability(session, now);
  const start = new Date(session.startsAt);
  const day = start.getDate();
  const month = formatDate(session.startsAt, locale, 'MMM').toLocaleUpperCase(locale);
  const sameDay = session.startsAt.slice(0, 10) === session.endsAt.slice(0, 10);
  const range = sameDay
    ? formatDate(session.startsAt, locale, 'd MMMM yyyy')
    : `${formatDate(session.startsAt, locale, 'd MMM')} – ${formatDate(session.endsAt, locale, 'd MMM yyyy')}`;

  const seatsColor =
    availability === 'full' || availability === 'past'
      ? colors.danger
      : availability === 'few'
        ? colors.warning
        : colors.success;
  const seatsLabel =
    availability === 'past'
      ? t('courses.past')
      : availability === 'full'
        ? t('courses.full')
        : t('courses.seatsLeft', { count: session.seatsLeft });
  const disabled = enrolled || availability === 'full' || availability === 'past';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected || enrolled ? colors.primary : colors.border,
          borderWidth: selected || enrolled ? 2 : 1,
        },
      ]}
      accessibilityLabel={`${range}, ${session.locationName}, ${seatsLabel}`}
    >
      <View style={[styles.dateBox, { backgroundColor: colors.primarySoft }]}>
        <Text variant="h2" weight="extrabold" color="primary">
          {day}
        </Text>
        <Text variant="label" weight="bold" color="primary">
          {month}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodySm" weight="semibold">
          {range}
        </Text>
        <View style={styles.meta}>
          <Icon name="map-pin" size={12} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {session.locationName}
          </Text>
        </View>
        <View style={styles.meta}>
          <Icon name="users" size={12} color={seatsColor} />
          <Text variant="caption" weight="bold" color={seatsColor}>
            {seatsLabel}
          </Text>
          <Text variant="caption" color="textSubtle">
            · {t('courses.seats', { count: session.seats })}
          </Text>
        </View>
        <View style={styles.actions}>
          <Text variant="title" weight="extrabold">
            {formatPriceTry(session.priceTry, locale)}
          </Text>
          {onSelect ? (
            <Button
              label={enrolled ? t('courses.enrolled') : (actionLabel ?? t('courses.enroll'))}
              size="sm"
              variant={selected || enrolled ? 'primary' : 'secondary'}
              icon={enrolled ? 'check' : selected ? 'check' : 'calendar-check'}
              disabled={disabled}
              loading={pending}
              onPress={() => onSelect(session)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  dateBox: {
    width: 56,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
