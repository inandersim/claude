import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import { isNewsActive, isWatchCompleted, programKindMeta, recommendPrograms } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { StreamCard } from '@/features/live/components/StreamCard';
import { ChannelChip } from '@/features/tv/components/ChannelChip';
import { ContinueRow } from '@/features/tv/components/ContinueRow';
import { HeroProgram } from '@/features/tv/components/HeroProgram';
import { NewsTicker } from '@/features/tv/components/NewsTicker';
import { ProgramCard } from '@/features/tv/components/ProgramCard';
import { ScheduleRow } from '@/features/tv/components/ScheduleRow';
import {
  useContinueWatching,
  useLiveNow,
  useNews,
  useTodayKey,
  useTvChannels,
  useTvPrograms,
  useTvSchedule,
  useWatchLater,
} from '@/features/tv/hooks';

const KIND_TABS = ['all', 'documentary', 'news', 'series', 'short', 'tutorial'] as const;
type KindTab = (typeof KIND_TABS)[number];

export default function TvScreen() {
  const router = useRouter();
  const { t } = useT();
  const me = useCurrentUser();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindTab>('all');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const today = useTodayKey();
  const channels = useTvChannels();
  const all = useTvPrograms({});
  const grid = useTvPrograms({ query, channelId, kind: kind === 'all' ? null : kind });
  const continueWatching = useContinueWatching();
  const news = useNews();
  const watchLater = useWatchLater();
  const live = useLiveNow();
  const schedule = useTvSchedule(today);

  const activeNews = (news.data ?? []).filter((n) => isNewsActive(n, now));
  const watchedIds = (all.data ?? []).filter((p) => isWatchCompleted(p.progress)).map((p) => p.id);
  const hero = all.data
    ? (recommendPrograms(all.data, me.favoriteTypes, watchedIds, 1, now)[0] ?? null)
    : null;
  const hasFilter = Boolean(query || channelId || kind !== 'all');
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('tv.title')}
        subtitle={t('tv.subtitle')}
        showBack
        right={
          <Button
            label={t('tv.submit.action')}
            icon="upload"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/tv/submit')}
          />
        }
      />
      <View style={styles.content}>
        {news.isLoading ? (
          <Skeleton height={56} style={{ borderRadius: radius.lg }} />
        ) : activeNews.length > 0 ? (
          <NewsTicker news={activeNews} />
        ) : null}

        {all.isLoading ? (
          <Skeleton height={280} style={{ borderRadius: radius.xxl }} />
        ) : hero ? (
          <HeroProgram program={hero} eyebrow={t('tv.recommended')} />
        ) : null}

        {continueWatching.data && continueWatching.data.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('tv.continueWatching')} />
            <ContinueRow programs={continueWatching.data} />
          </View>
        ) : null}

        {watchLater.data && watchLater.data.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('tv.watchLater')}
              subtitle={t('tv.results', { count: watchLater.data.length })}
            />
            <ContinueRow programs={watchLater.data} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={t('tv.channels')} />
          {channels.isLoading ? (
            <View style={styles.chipRowStatic}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={30} style={{ width: 110, borderRadius: radius.full }} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.chipScroll}
            >
              <Chip
                label={t('tv.allChannels')}
                size="sm"
                selected={channelId === null}
                onPress={() => setChannelId(null)}
              />
              {(channels.data ?? []).map((c) => (
                <ChannelChip
                  key={c.id}
                  channel={c}
                  selected={channelId === c.id}
                  onPress={() =>
                    channelId === c.id
                      ? router.push({ pathname: '/tv/channel/[id]', params: { id: c.id } })
                      : setChannelId(c.id)
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>

        {live.data && live.data.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('tv.liveNow')}
              subtitle={t('tv.liveNowSubtitle')}
              actionLabel={t('tv.live')}
              onAction={() => router.push('/live')}
            />
            <View style={{ gap: spacing.sm }}>
              {live.data.slice(0, 3).map((s) => (
                <StreamCard key={s.id} stream={s} row />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={t('tv.schedule')} subtitle={t('tv.scheduleToday')} />
          {schedule.isError ? (
            <ErrorState onRetry={() => schedule.refetch()} />
          ) : schedule.isLoading ? (
            [0, 1, 2].map((i) => (
              <Skeleton key={i} height={60} style={{ borderRadius: radius.lg }} />
            ))
          ) : schedule.data && schedule.data.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {schedule.data.map((s) => (
                <ScheduleRow key={s.id} item={s} now={now} />
              ))}
            </View>
          ) : (
            <Text variant="caption" color="textSubtle">
              {t('tv.scheduleEmpty')}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={t('tv.grid')}
            subtitle={grid.data ? t('tv.results', { count: grid.data.length }) : undefined}
          />
          <SearchBar value={query} onChange={setQuery} placeholder={t('tv.search')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {KIND_TABS.map((k) => (
              <Chip
                key={k}
                label={t(`tv.tabs.${k}`)}
                icon={k === 'all' ? undefined : programKindMeta[k].icon}
                color={k === 'all' ? undefined : programKindMeta[k].color}
                size="sm"
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </ScrollView>
          {grid.isError ? (
            <ErrorState onRetry={() => grid.refetch()} />
          ) : grid.isLoading ? (
            [0, 1, 2].map((i) => (
              <Skeleton key={i} height={240} style={{ borderRadius: radius.xl }} />
            ))
          ) : grid.data && grid.data.length > 0 ? (
            <View style={styles.grid}>
              {grid.data.map((p) => (
                <View
                  key={p.id}
                  style={{ width: columns === 1 ? '100%' : `${100 / columns - 1.5}%` }}
                >
                  <ProgramCard program={p} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="video"
              title={t('tv.empty')}
              description={t('tv.emptyDescription')}
              action={
                hasFilter
                  ? {
                      label: t('tv.tabs.all'),
                      icon: 'x',
                      variant: 'secondary',
                      onPress: () => {
                        setQuery('');
                        setChannelId(null);
                        setKind('all');
                      },
                    }
                  : undefined
              }
            />
          )}
        </View>
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
  section: { gap: spacing.sm },
  chipScroll: { marginHorizontal: -spacing.lg },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  chipRowStatic: { flexDirection: 'row', gap: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
