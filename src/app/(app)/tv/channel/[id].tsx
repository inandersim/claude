import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { channelKindMeta } from '@/domain';
import { ProgramCard } from '@/features/tv/components/ProgramCard';
import { ScheduleRow } from '@/features/tv/components/ScheduleRow';
import {
  useFollowChannel,
  useTodayKey,
  useTvChannels,
  useTvPrograms,
  useTvSchedule,
} from '@/features/tv/hooks';

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const today = useTodayKey();
  const tomorrow = useTodayKey(1);
  const channels = useTvChannels();
  const programs = useTvPrograms({ channelId: id });
  const scheduleToday = useTvSchedule(today);
  const scheduleTomorrow = useTvSchedule(tomorrow);
  const follow = useFollowChannel();

  const channel = channels.data?.find((c) => c.id === id) ?? null;
  const meta = channel ? channelKindMeta[channel.kind] : null;
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const schedule = [...(scheduleToday.data ?? []), ...(scheduleTomorrow.data ?? [])].filter(
    (s) => s.channelId === id,
  );

  const onFollow = () => {
    if (!channel) return;
    follow.mutate(channel.id, {
      onSuccess: (isFollowing) => {
        setFollowing(isFollowing);
        toast(t(isFollowing ? 'tv.followedToast' : 'tv.unfollowedToast'), 'success');
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={channel?.name ?? t('tv.channels')} showBack />
      <View style={styles.content}>
        {channels.isError ? (
          <ErrorState onRetry={() => channels.refetch()} />
        ) : channels.isLoading ? (
          <Skeleton height={160} style={{ borderRadius: radius.xl }} />
        ) : !channel || !meta ? (
          <EmptyState icon="video-off" title={t('tv.channelNotFound')} />
        ) : (
          <Card style={styles.profile}>
            <View style={[styles.accent, { backgroundColor: channel.color }]} />
            <View style={styles.profileRow}>
              <Avatar uri={channel.logoUrl} name={channel.name} size={64} />
              <View style={styles.profileText}>
                <View style={styles.nameRow}>
                  <Text variant="h3" numberOfLines={1} style={styles.name}>
                    {channel.name}
                  </Text>
                  {channel.isOfficial ? (
                    <Icon name="badge-check" size={18} color={colors.primary} />
                  ) : null}
                </View>
                <View style={styles.badges}>
                  <Badge label={t(meta.labelKey)} color={channel.color} icon={meta.icon} />
                  {channel.isOfficial ? (
                    <Badge label={t('tv.official')} color={colors.primary} icon="shield-check" />
                  ) : null}
                </View>
                <Text variant="caption" color="textMuted">
                  {t('tv.followers', { count: formatCompact(channel.followerCount, locale) })}
                  {programs.data ? ` · ${t('tv.programs', { count: programs.data.length })}` : ''}
                </Text>
              </View>
            </View>
            <Text variant="body" color="textMuted">
              {channel.description}
            </Text>
            <Button
              label={following ? t('tv.following') : t('tv.follow')}
              icon={following ? 'check' : 'plus'}
              variant={following ? 'secondary' : 'primary'}
              onPress={onFollow}
              loading={follow.isPending}
              fullWidth
            />
          </Card>
        )}

        {channel ? (
          <View style={styles.section}>
            <SectionHeader title={t('tv.schedule')} />
            {scheduleToday.isLoading ? (
              [0, 1].map((i) => (
                <Skeleton key={i} height={60} style={{ borderRadius: radius.lg }} />
              ))
            ) : schedule.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                {schedule.map((s) => (
                  <ScheduleRow key={s.id} item={s} now={now} showChannel={false} />
                ))}
              </View>
            ) : (
              <Text variant="caption" color="textSubtle">
                {t('tv.scheduleEmpty')}
              </Text>
            )}
          </View>
        ) : null}

        {channel ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('tv.grid')}
              subtitle={
                programs.data ? t('tv.results', { count: programs.data.length }) : undefined
              }
              actionLabel={channel.kind === 'live' ? t('tv.liveNow') : undefined}
              onAction={channel.kind === 'live' ? () => router.push('/live') : undefined}
            />
            {programs.isError ? (
              <ErrorState onRetry={() => programs.refetch()} />
            ) : programs.isLoading ? (
              [0, 1].map((i) => (
                <Skeleton key={i} height={240} style={{ borderRadius: radius.xl }} />
              ))
            ) : programs.data && programs.data.length > 0 ? (
              <View style={styles.grid}>
                {programs.data.map((p) => (
                  <View
                    key={p.id}
                    style={{ width: columns === 1 ? '100%' : `${100 / columns - 1.5}%` }}
                  >
                    <ProgramCard program={p} showChannel={false} />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="video" title={t('tv.empty')} compact />
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  profile: { gap: spacing.md, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
  profileRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  profileText: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { gap: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
