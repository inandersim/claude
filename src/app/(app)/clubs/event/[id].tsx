import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { initials } from '@/core/utils/format';
import { formatDate, formatTime } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  eventCapacityLeft,
  formatPriceTry,
  mapsUrl,
  rsvpBlocker,
} from '@/domain';
import { EVENT_KIND_ICON } from '@/features/clubs/components/meta';
import { useClub, useClubEvent, useRsvp } from '@/features/clubs/hooks';

export default function ClubEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const event = useClubEvent(id);
  const data = event.data;
  const club = useClub(data?.clubId ?? '');
  const rsvp = useRsvp();
  const membership = club.data?.membership ?? 'none';
  const dateLocale = locale === 'tr' ? 'tr' : 'en';

  const blocker = data ? rsvpBlocker(data, membership, now, data.rsvped) : null;
  const left = data ? eventCapacityLeft(data) : null;
  const sameDay = data ? data.startsAt.slice(0, 10) === data.endsAt.slice(0, 10) : true;

  const onRsvp = () => {
    if (!data) return;
    rsvp.mutate(data.id, {
      onSuccess: (e) => toast(e.rsvped ? t('clubs.rsvpDone') : t('clubs.rsvpCancelled'), 'success'),
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });
  };

  const rsvpLabel = !data
    ? ''
    : data.rsvped
      ? t('clubs.rsvpCancel')
      : blocker === 'past'
        ? t('clubs.past')
        : blocker === 'full'
          ? t('clubs.full')
          : blocker === 'members_only'
            ? t('clubs.membersOnly')
            : t('clubs.rsvp');

  return (
    <Screen edges={['top']}>
      <Header
        title={data ? t(`clubs.eventKind.${data.kind}`) : t('clubs.events')}
        subtitle={data?.club.name}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/clubs'))}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {event.isError ? (
          <ErrorState onRetry={() => event.refetch()} />
        ) : event.isLoading ? (
          <>
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </>
        ) : data ? (
          <>
            <View style={styles.chips}>
              <Badge
                label={t(`clubs.eventKind.${data.kind}`)}
                color={colors.primary}
                icon={EVENT_KIND_ICON[data.kind]}
              />
              <Badge
                label={t(ADVENTURE_TYPE_META[data.adventureType].labelKey)}
                color={ADVENTURE_TYPE_META[data.adventureType].color}
                icon={ADVENTURE_TYPE_META[data.adventureType].icon}
              />
              {data.openToAll ? (
                <Badge label={t('clubs.openToAll')} color={colors.success} icon="globe" />
              ) : (
                <Badge label={t('clubs.membersOnly')} color={colors.textMuted} icon="lock" />
              )}
              {blocker === 'past' ? (
                <Badge label={t('clubs.past')} color={colors.textSubtle} icon="clock" />
              ) : null}
            </View>
            <Text variant="h1">{data.title}</Text>

            <Tappable
              onPress={() => router.push({ pathname: '/clubs/[id]', params: { id: data.clubId } })}
              haptic="selection"
              style={[
                styles.clubRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={data.club.name}
            >
              <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
                <Text variant="caption" weight="extrabold" color="primary">
                  {initials(data.club.university)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSubtle">
                  {t('clubs.organizer')}
                </Text>
                <Text variant="title" numberOfLines={1}>
                  {data.club.name}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textSubtle} />
            </Tappable>

            <View
              style={[
                styles.infoCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <InfoRow
                icon="calendar-days"
                label={t('clubs.dateTime')}
                value={
                  sameDay
                    ? `${formatDate(data.startsAt, dateLocale, 'd MMMM yyyy, EEEE')} · ${formatTime(data.startsAt)}–${formatTime(data.endsAt)}`
                    : `${formatDate(data.startsAt, dateLocale, 'd MMM HH:mm')} → ${formatDate(data.endsAt, dateLocale, 'd MMM HH:mm')}`
                }
              />
              <InfoRow
                icon="map-pin"
                label={t('clubs.location')}
                value={data.locationName}
                action={
                  data.coords
                    ? {
                        label: t('clubs.openInMaps'),
                        onPress: () =>
                          Linking.openURL(
                            mapsUrl(
                              data.coords!.latitude,
                              data.coords!.longitude,
                              data.locationName,
                            ),
                          ),
                      }
                    : undefined
                }
              />
              <InfoRow
                icon="users"
                label={t('clubs.capacity')}
                value={
                  data.capacity !== null
                    ? `${data.attendeeCount} / ${data.capacity}${left !== null && left > 0 ? ` · ${t('clubs.capacityLeft', { count: left })}` : left === 0 ? ` · ${t('clubs.full')}` : ''}`
                    : `${t('clubs.attendees', { count: data.attendeeCount })} · ${t('clubs.noCapacity')}`
                }
              />
              <InfoRow
                icon="banknote"
                label={t('clubs.price')}
                value={
                  data.priceTry === 0 ? t('clubs.free') : formatPriceTry(data.priceTry, locale)
                }
                last
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text variant="h3">{t('clubs.description')}</Text>
              <Text variant="body" color="textMuted">
                {data.description}
              </Text>
            </View>
          </>
        ) : (
          <EmptyState
            icon="calendar"
            title={t('clubs.eventNotFound')}
            description={t('notFound.contentDescription')}
          />
        )}
      </ScrollView>

      {data ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSubtle">
              {t('clubs.attendees', { count: data.attendeeCount })}
            </Text>
            <Text variant="h3" color={data.rsvped ? 'success' : 'text'}>
              {data.rsvped
                ? t('clubs.rsvped')
                : data.priceTry === 0
                  ? t('clubs.free')
                  : formatPriceTry(data.priceTry, locale)}
            </Text>
          </View>
          <Button
            label={rsvpLabel}
            icon={data.rsvped ? 'x' : 'check'}
            size="lg"
            variant={data.rsvped ? 'secondary' : 'primary'}
            disabled={blocker !== null}
            loading={rsvp.isPending}
            onPress={onRsvp}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  action,
  last = false,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  action?: { label: string; onPress: () => void };
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        !last
          ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
          : null,
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" color="textSubtle">
          {label}
        </Text>
        <Text variant="body" weight="semibold">
          {value}
        </Text>
      </View>
      {action ? (
        <Button
          label={action.label}
          size="sm"
          variant="ghost"
          icon="map"
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
