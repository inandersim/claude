import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  channelKindMeta,
  formatDurationLabel,
  isWatchInProgress,
  nextEpisode,
  programKindMeta,
  type TvProgramWithChannel,
} from '@/domain';
import { ProgramCard } from '@/features/tv/components/ProgramCard';
import { SeriesList } from '@/features/tv/components/SeriesList';
import { TvPlayer } from '@/features/tv/components/TvPlayer';
import {
  useFollowChannel,
  useToggleProgramLike,
  useToggleWatchLater,
  useTvProgram,
  useTvPrograms,
} from '@/features/tv/hooks';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const program = useTvProgram(id);
  const all = useTvPrograms({});
  const like = useToggleProgramLike();
  const watchLater = useToggleWatchLater();
  const follow = useFollowChannel();
  const [following, setFollowing] = useState(false);

  const data = program.data;
  // Oynatıcı `key={data.id}` ile bağlandığından bu değer yalnızca ilk montajda okunur.
  const initialPosition =
    data && isWatchInProgress(data.progress) ? data.progress * data.durationMin * 60 : 0;

  const episodes = data?.seriesTitle
    ? (all.data ?? [])
        .filter((p) => p.seriesTitle === data.seriesTitle)
        .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0))
    : [];
  const next = data ? nextEpisode(data, all.data ?? []) : null;
  const related = data
    ? (all.data ?? [])
        .filter(
          (p) =>
            p.id !== data.id &&
            p.seriesTitle !== data.seriesTitle &&
            (p.channelId === data.channelId ||
              p.adventureTypes.some((a) => data.adventureTypes.includes(a))),
        )
        .slice(0, 6)
    : [];

  const openProgram = (p: TvProgramWithChannel) =>
    router.replace({ pathname: '/tv/watch/[id]', params: { id: p.id } });

  const onShare = () => {
    if (!data) return;
    Share.share({
      message: `${t('tv.shareMessage', { title: data.title })}\n${data.videoUrl}`,
    }).catch(() => undefined);
  };

  const onFollow = () => {
    if (!data) return;
    follow.mutate(data.channelId, {
      onSuccess: (isFollowing) => {
        setFollowing(isFollowing);
        toast(t(isFollowing ? 'tv.followedToast' : 'tv.unfollowedToast'), 'success');
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={data?.channel.name ?? t('tv.title')} showBack />
      {program.isError ? (
        <View style={styles.content}>
          <ErrorState onRetry={() => program.refetch()} />
        </View>
      ) : program.isLoading ? (
        <View style={styles.content}>
          <Skeleton height={220} style={{ borderRadius: radius.xl }} />
          <Skeleton height={28} />
          <Skeleton height={60} />
        </View>
      ) : !data ? (
        <View style={styles.content}>
          <EmptyState icon="video-off" title={t('tv.programNotFound')} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.playerWrap}>
            <TvPlayer
              key={data.id}
              program={data}
              initialPositionSec={initialPosition}
              next={next}
              onNext={openProgram}
            />
          </View>

          <View style={styles.titleBlock}>
            <Text variant="h3">{data.title}</Text>
            <View style={styles.badges}>
              <Badge
                label={t(programKindMeta[data.kind].labelKey)}
                color={programKindMeta[data.kind].color}
                icon={programKindMeta[data.kind].icon}
              />
              {data.kidsFriendly ? (
                <Badge label={t('tv.kidsFriendly')} color="#D97706" icon="sparkle" />
              ) : null}
              {data.adventureTypes.map((a) => (
                <Badge
                  key={a}
                  label={t(ADVENTURE_TYPE_META[a].labelKey)}
                  color={ADVENTURE_TYPE_META[a].color}
                  icon={ADVENTURE_TYPE_META[a].icon}
                />
              ))}
            </View>
            <Text variant="caption" color="textMuted">
              {t('tv.views', { count: formatCompact(data.viewsCount, locale) })} ·{' '}
              {formatDurationLabel(data.durationMin, locale)} ·{' '}
              {formatDate(data.publishedAt, locale, 'd MMM yyyy')}
            </Text>
          </View>

          <View style={styles.channelRow}>
            <Tappable
              onPress={() =>
                router.push({ pathname: '/tv/channel/[id]', params: { id: data.channelId } })
              }
              style={styles.channelInfo}
              accessibilityRole="button"
              accessibilityLabel={data.channel.name}
            >
              <Avatar uri={data.channel.logoUrl} name={data.channel.name} size={40} />
              <View style={{ flex: 1 }}>
                <View style={styles.channelName}>
                  <Text variant="title" weight="bold" numberOfLines={1}>
                    {data.channel.name}
                  </Text>
                  {data.channel.isOfficial ? (
                    <Icon name="badge-check" size={14} color={colors.primary} />
                  ) : null}
                </View>
                <Text variant="caption" color="textMuted">
                  {t(channelKindMeta[data.channel.kind].labelKey)} ·{' '}
                  {t('tv.followers', { count: formatCompact(data.channel.followerCount, locale) })}
                </Text>
              </View>
            </Tappable>
            <Button
              label={following ? t('tv.following') : t('tv.follow')}
              icon={following ? 'check' : 'plus'}
              size="sm"
              variant={following ? 'secondary' : 'primary'}
              onPress={onFollow}
              loading={follow.isPending}
            />
          </View>

          <View style={styles.actions}>
            <Button
              label={`${data.likedByMe ? t('tv.liked') : t('tv.like')} · ${formatCompact(data.likesCount, locale)}`}
              icon="heart"
              size="sm"
              variant={data.likedByMe ? 'primary' : 'secondary'}
              onPress={() => like.mutate(data.id)}
              accessibilityLabel={t('tv.like')}
            />
            <Button
              label={t('tv.watchLater')}
              icon="bookmark"
              size="sm"
              variant={data.watchLater ? 'primary' : 'secondary'}
              onPress={() =>
                watchLater.mutate(data.id, {
                  onSuccess: (added) =>
                    toast(t(added ? 'tv.watchLaterAdded' : 'tv.watchLaterRemoved'), 'success'),
                })
              }
            />
            <Button
              label={t('tv.share')}
              icon="share-2"
              size="sm"
              variant="ghost"
              onPress={onShare}
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('tv.description')} />
            <Text variant="body" color="textMuted">
              {data.description}
            </Text>
            <View style={styles.metaGrid}>
              {data.languages.length > 0 ? (
                <Text variant="caption" color="textSubtle">
                  {t('tv.languages')}: {data.languages.map((l) => l.toUpperCase()).join(', ')}
                </Text>
              ) : null}
              {data.subtitles.length > 0 ? (
                <Text variant="caption" color="textSubtle">
                  {t('tv.subtitles')}: {data.subtitles.map((l) => l.toUpperCase()).join(', ')}
                </Text>
              ) : null}
            </View>
          </View>

          {episodes.length > 1 ? (
            <View style={styles.section}>
              <SectionHeader
                title={t('tv.seriesEpisodes')}
                subtitle={`${data.seriesTitle} · ${t('tv.episodes', { count: episodes.length })}`}
              />
              <SeriesList episodes={episodes} currentId={data.id} />
            </View>
          ) : null}

          {related.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('tv.related')} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hRow}
                style={styles.hScroll}
              >
                {related.map((p) => (
                  <ProgramCard key={p.id} program={p} width={232} compact />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={[styles.credits, { backgroundColor: colors.surfaceMuted }]}>
            <Icon name="info" size={14} color={colors.textSubtle} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="extrabold" color="textSubtle">
                {t('tv.credits').toLocaleUpperCase(locale)}
              </Text>
              <Text variant="caption" color="textMuted">
                {data.creditsNote}
              </Text>
            </View>
          </View>
        </View>
      )}
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
  playerWrap: { borderRadius: radius.xl, overflow: 'hidden' },
  titleBlock: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  channelName: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.sm },
  metaGrid: { gap: 2 },
  hScroll: { marginHorizontal: -spacing.lg },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  credits: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'flex-start',
  },
});
