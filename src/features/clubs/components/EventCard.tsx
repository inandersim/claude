import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatTime } from '@/core/utils/time';
import {
  eventCapacityLeft,
  formatPriceTry,
  rsvpBlocker,
  type ClubEventWithClub,
  type MembershipStatus,
} from '@/domain';

import { EVENT_KIND_ICON } from './meta';

interface Props {
  event: ClubEventWithClub;
  membership: MembershipStatus;
  now: number;
  onRsvp?: (eventId: string) => void;
  rsvpPending?: boolean;
  showClub?: boolean;
}

/**
 * Etkinlik kartı. Dış sarmalayıcı `View`; kartın kendisi ve RSVP butonu ayrı
 * dokunma hedefleri (iç içe buton yok).
 */
export function EventCard({
  event,
  membership,
  now,
  onRsvp,
  rsvpPending = false,
  showClub = true,
}: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const blocker = rsvpBlocker(event, membership, now, event.rsvped);
  const left = eventCapacityLeft(event);
  const isPast = blocker === 'past';
  const dateLocale = locale === 'tr' ? 'tr' : 'en';

  const rsvpLabel = event.rsvped
    ? t('clubs.rsvped')
    : blocker === 'full'
      ? t('clubs.full')
      : blocker === 'members_only'
        ? t('clubs.membersOnly')
        : t('clubs.rsvp');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: event.rsvped ? colors.primary : colors.border,
          opacity: isPast ? 0.7 : 1,
        },
      ]}
    >
      <Tappable
        onPress={() => router.push({ pathname: '/clubs/event/[id]', params: { id: event.id } })}
        scaleTo={0.985}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={event.title}
      >
        <View style={[styles.dateBox, { backgroundColor: colors.primarySoft }]}>
          <Text variant="h3" color="primary" style={{ lineHeight: 22 }}>
            {formatDate(event.startsAt, dateLocale, 'd')}
          </Text>
          <Text variant="label" weight="extrabold" color="primary">
            {formatDate(event.startsAt, dateLocale, 'MMM').toLocaleUpperCase(locale)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.kindRow}>
            <Icon name={EVENT_KIND_ICON[event.kind]} size={12} color={colors.textSubtle} />
            <Text variant="label" color="textSubtle">
              {t(`clubs.eventKind.${event.kind}`).toLocaleUpperCase(locale)}
            </Text>
            {isPast ? (
              <Text variant="label" color="textSubtle">
                · {t('clubs.past').toLocaleUpperCase(locale)}
              </Text>
            ) : null}
            {event.openToAll ? (
              <Text variant="label" color="success">
                · {t('clubs.openToAll').toLocaleUpperCase(locale)}
              </Text>
            ) : null}
          </View>
          <Text variant="title" numberOfLines={2}>
            {event.title}
          </Text>
          {showClub ? (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {event.club.name}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Icon name="clock" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {formatTime(event.startsAt)}
            </Text>
            <Icon name="map-pin" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {event.locationName}
            </Text>
          </View>
        </View>
      </Tappable>
      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <View style={styles.metaRow}>
          <Icon name="users" size={13} color={colors.textSubtle} />
          <Text variant="caption" weight="bold" color="textMuted">
            {event.capacity !== null
              ? `${event.attendeeCount}/${event.capacity}`
              : event.attendeeCount}
          </Text>
          {left !== null && left > 0 && left <= 5 && !isPast ? (
            <Text variant="caption" weight="bold" color="warning">
              · {t('clubs.capacityLeft', { count: left })}
            </Text>
          ) : null}
          <Text variant="caption" color="textSubtle">
            ·
          </Text>
          <Text
            variant="caption"
            weight="extrabold"
            color={event.priceTry === 0 ? 'success' : 'text'}
          >
            {event.priceTry === 0 ? t('clubs.free') : formatPriceTry(event.priceTry, locale)}
          </Text>
        </View>
        {onRsvp && !isPast ? (
          <Button
            label={rsvpLabel}
            size="sm"
            variant={event.rsvped ? 'primary' : 'secondary'}
            icon={event.rsvped ? 'check' : undefined}
            disabled={blocker !== null}
            loading={rsvpPending}
            onPress={() => onRsvp(event.id)}
            accessibilityLabel={`${rsvpLabel}: ${event.title}`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  main: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  dateBox: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
