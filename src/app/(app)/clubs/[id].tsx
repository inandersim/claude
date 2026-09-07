import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact, initials } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, canManage, pastEvents, upcomingEvents } from '@/domain';
import { EventCard } from '@/features/clubs/components/EventCard';
import { MemberRow } from '@/features/clubs/components/MemberRow';
import {
  useClub,
  useClubEvents,
  useClubMembers,
  useJoinClub,
  useLeaveClub,
  useRsvp,
} from '@/features/clubs/hooks';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [showAllMembers, setShowAllMembers] = useState(false);

  const club = useClub(id);
  const members = useClubMembers(id);
  const events = useClubEvents(id);
  const join = useJoinClub();
  const leave = useLeaveClub();
  const rsvp = useRsvp();
  const data = club.data;

  const upcoming = useMemo(() => upcomingEvents(events.data ?? [], now), [events.data, now]);
  const past = useMemo(() => pastEvents(events.data ?? [], now).slice(0, 3), [events.data, now]);
  const visibleMembers = showAllMembers ? (members.data ?? []) : (members.data ?? []).slice(0, 5);

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');
  const onJoin = () =>
    join.mutate(id, {
      onSuccess: (c) =>
        toast(c.membership === 'member' ? t('clubs.joined') : t('clubs.requestSent'), 'success'),
      onError,
    });
  const onLeave = () =>
    leave.mutate(id, { onSuccess: () => toast(t('clubs.left'), 'info'), onError });
  const onRsvp = (eventId: string) =>
    rsvp.mutate(eventId, {
      onSuccess: (e) => toast(e.rsvped ? t('clubs.rsvpDone') : t('clubs.rsvpCancelled'), 'success'),
      onError,
    });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/clubs'));

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={back}
          accessibilityLabel={t('common.back')}
        />
        {data?.instagram ? (
          <IconButton
            icon="camera"
            variant="blur"
            onPress={() => Linking.openURL(`https://instagram.com/${data.instagram}`)}
            accessibilityLabel={t('clubs.instagram')}
          />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {club.isError ? (
          <ErrorState onRetry={() => club.refetch()} />
        ) : club.isLoading ? (
          <View style={{ padding: spacing.lg, paddingTop: insets.top + 60, gap: spacing.md }}>
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
            <Skeleton height={80} style={{ borderRadius: radius.xl }} />
          </View>
        ) : data ? (
          <>
            <AdventureImage
              uri={data.coverUrl}
              adventureType={data.adventureTypes[0] ?? 'hiking'}
              style={styles.hero}
              overlay
            >
              <View style={styles.heroContent}>
                <View style={styles.chips}>
                  {data.isVerified ? (
                    <Badge label={t('clubs.verified')} color={colors.primary} icon="badge-check" />
                  ) : null}
                  {data.membership === 'member' ? (
                    <Badge
                      label={
                        data.role && data.role !== 'member'
                          ? t(`clubs.role.${data.role}`)
                          : t('clubs.member')
                      }
                      color={colors.success}
                      icon="user-check"
                      soft={false}
                    />
                  ) : data.membership === 'requested' ? (
                    <Badge label={t('clubs.requested')} color={colors.warning} icon="hourglass" />
                  ) : null}
                </View>
                <View style={styles.titleRow}>
                  <View style={[styles.logo, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                    <Text variant="h3" weight="extrabold" color="#0B1410">
                      {initials(data.university)}
                    </Text>
                  </View>
                  <Text variant="h2" color="#FFFFFF" style={{ flex: 1 }}>
                    {data.name}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="school" size={12} color="rgba(255,255,255,0.85)" />
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    {data.university} · {data.city}
                  </Text>
                </View>
              </View>
            </AdventureImage>

            <View style={styles.body}>
              <View style={styles.stats}>
                <Stat
                  icon="users"
                  value={formatCompact(data.memberCount, locale)}
                  label={t('clubs.membersShort')}
                />
                <Stat
                  icon="calendar"
                  value={String(data.upcomingEventCount)}
                  label={t('clubs.events')}
                />
                <Stat
                  icon="zap"
                  value={formatCompact(data.seasonXp, locale)}
                  label={t('clubs.xp')}
                  color={colors.accent}
                />
                {data.foundedYear ? (
                  <Stat icon="flag" value={String(data.foundedYear)} label={t('clubs.founded')} />
                ) : null}
              </View>

              {data.membership === 'requested' ? (
                <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
                  <Icon name="hourglass" size={16} color={colors.warning} />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {t('clubs.requestedHint')}
                  </Text>
                </View>
              ) : null}
              {canManage(data.role) ? (
                <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="shield-check" size={16} color={colors.accent} />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {t('clubs.youAreManager')}
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: spacing.xs }}>
                <Text variant="h3">{t('clubs.about')}</Text>
                <Text variant="body" color="textMuted">
                  {data.description}
                </Text>
                {data.foundedYear ? (
                  <Text variant="caption" color="textSubtle">
                    {t('clubs.foundedIn', { year: data.foundedYear })}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text variant="h3">{t('clubs.activities')}</Text>
                <View style={styles.chips}>
                  {data.adventureTypes.map((type) => (
                    <Badge
                      key={type}
                      label={t(ADVENTURE_TYPE_META[type].labelKey)}
                      color={ADVENTURE_TYPE_META[type].color}
                      icon={ADVENTURE_TYPE_META[type].icon}
                    />
                  ))}
                </View>
              </View>

              {data.instagram || data.contactEmail ? (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="h3">{t('clubs.contact')}</Text>
                  <View style={styles.chips}>
                    {data.instagram ? (
                      <Button
                        label={`@${data.instagram}`}
                        icon="camera"
                        variant="secondary"
                        size="sm"
                        onPress={() => Linking.openURL(`https://instagram.com/${data.instagram}`)}
                      />
                    ) : null}
                    {data.contactEmail ? (
                      <Button
                        label={t('clubs.contactEmail')}
                        icon="mail"
                        variant="secondary"
                        size="sm"
                        onPress={() => Linking.openURL(`mailto:${data.contactEmail}`)}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: spacing.xs }}>
                <SectionHeader
                  title={t('clubs.members')}
                  subtitle={t('clubs.memberCount', {
                    count: formatCompact(data.memberCount, locale),
                  })}
                  actionLabel={
                    (members.data?.length ?? 0) > 5 && !showAllMembers
                      ? t('clubs.seeAllMembers')
                      : undefined
                  }
                  onAction={() => setShowAllMembers(true)}
                />
                {members.isLoading ? (
                  <Skeleton height={56} style={{ borderRadius: radius.lg }} />
                ) : members.data && members.data.length > 0 ? (
                  <>
                    <View style={styles.avatarStrip}>
                      {members.data.slice(0, 8).map((m, i) => (
                        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                          <Avatar uri={m.avatarUrl} name={m.displayName} size={32} ring />
                        </View>
                      ))}
                    </View>
                    <View
                      style={[
                        styles.memberList,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      {visibleMembers.map((m) => (
                        <MemberRow key={m.id} member={m} />
                      ))}
                    </View>
                  </>
                ) : null}
              </View>

              <View style={{ gap: spacing.sm }}>
                <SectionHeader
                  title={t('clubs.upcomingEvents')}
                  actionLabel={data.membership === 'member' ? t('clubs.createEvent') : undefined}
                  onAction={() =>
                    router.push({ pathname: '/clubs/event/new', params: { clubId: data.id } })
                  }
                />
                {events.isError ? (
                  <ErrorState onRetry={() => events.refetch()} />
                ) : events.isLoading ? (
                  <Skeleton height={140} style={{ borderRadius: radius.xl }} />
                ) : upcoming.length > 0 ? (
                  upcoming.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      now={now}
                      membership={data.membership}
                      showClub={false}
                      onRsvp={onRsvp}
                      rsvpPending={rsvp.isPending && rsvp.variables === e.id}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon="calendar"
                    title={t('clubs.emptyEvents')}
                    description={t('clubs.emptyEventsDescription')}
                    compact
                  />
                )}
              </View>

              {past.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <SectionHeader title={t('clubs.pastEvents')} />
                  {past.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      now={now}
                      membership={data.membership}
                      showClub={false}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <EmptyState
            icon="school"
            title={t('clubs.notFound')}
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
          {data.membership === 'member' ? (
            <>
              <Button
                label={t('clubs.createEvent')}
                icon="calendar-plus"
                variant="secondary"
                size="lg"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({ pathname: '/clubs/event/new', params: { clubId: data.id } })
                }
              />
              <Button
                label={t('clubs.leave')}
                icon="log-out"
                variant="ghost"
                size="lg"
                loading={leave.isPending}
                onPress={onLeave}
              />
            </>
          ) : data.membership === 'requested' ? (
            <Button
              label={t('clubs.cancelRequest')}
              icon="x"
              variant="secondary"
              size="lg"
              fullWidth
              loading={leave.isPending}
              onPress={onLeave}
            />
          ) : (
            <Button
              label={data.isVerified ? t('clubs.requestJoin') : t('clubs.join')}
              icon={data.isVerified ? 'send' : 'user-plus'}
              size="lg"
              fullWidth
              loading={join.isPending}
              onPress={onJoin}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  value: string;
  label: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={16} color={color ?? colors.primary} />
      <Text variant="title" weight="extrabold">
        {value}
      </Text>
      <Text variant="label" color="textSubtle" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: { width: '100%', height: 320 },
  heroContent: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  avatarStrip: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  memberList: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
