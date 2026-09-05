import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
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
  type IconName,
} from '@/components/ui';
import { useT, type TranslationKey } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { dayNumber, type XpSource } from '@/domain';
import { LevelCard } from '@/features/fun/components/LevelCard';
import { useFunSummary, useXpHistory } from '@/features/fun/hooks';

type FunRoute =
  | '/fun/challenges'
  | '/fun/leaderboard'
  | '/fun/badges'
  | '/fun/quiz'
  | '/fun/roulette'
  | '/fun/passport';

const SOURCE_ICONS: Record<XpSource, IconName> = {
  post: 'image',
  route: 'route',
  ascent: 'mountain',
  hazard_report: 'shield-alert',
  challenge: 'target',
  quiz: 'brain',
  event: 'users',
  streak: 'flame',
};

export default function FunHubScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const summary = useFunSummary();
  const history = useXpHistory();
  const [now] = useState(() => new Date());

  const columns = width >= 700 ? 3 : 2;
  const contentWidth = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const tileWidth = (contentWidth - spacing.md * (columns - 1)) / columns;

  const today = dayNumber(now);
  const quizDoneToday =
    history.data?.some((e) => e.source === 'quiz' && dayNumber(e.createdAt) === today) ?? false;

  const s = summary.data;
  const tiles: {
    key: string;
    icon: IconName;
    label: string;
    value: string;
    href: FunRoute;
    color: string;
  }[] = s
    ? [
        {
          key: 'challenges',
          icon: 'target',
          label: t('fun.hub.challenges'),
          value: t('fun.hub.activeCount', { count: s.activeChallenges }),
          href: '/fun/challenges',
          color: colors.primary,
        },
        {
          key: 'leaderboard',
          icon: 'trophy',
          label: t('fun.hub.leaderboard'),
          value: s.weeklyRank
            ? t('fun.hub.rankValue', { rank: s.weeklyRank })
            : t('fun.hub.noRank'),
          href: '/fun/leaderboard',
          color: '#F2C14E',
        },
        {
          key: 'badges',
          icon: 'award',
          label: t('fun.hub.badges'),
          value: t('fun.hub.earnedOf', { earned: s.badgesEarned, total: s.badgesTotal }),
          href: '/fun/badges',
          color: '#B388FF',
        },
        {
          key: 'quiz',
          icon: 'brain',
          label: t('fun.hub.quiz'),
          value: quizDoneToday ? t('fun.dailyDone') : t('fun.hub.daily'),
          href: '/fun/quiz',
          color: colors.info,
        },
        {
          key: 'roulette',
          icon: 'compass',
          label: t('fun.hub.roulette'),
          value: t('fun.roulette.spin'),
          href: '/fun/roulette',
          color: '#FF8A5B',
        },
        {
          key: 'passport',
          icon: 'stamp',
          label: t('fun.hub.passport'),
          value: t('fun.hub.stampsCount', { count: s.stamps }),
          href: '/fun/passport',
          color: colors.success,
        },
      ]
    : [];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('fun.title')} subtitle={t('fun.subtitle')} showBack />
      <View style={styles.content}>
        {summary.isError ? (
          <ErrorState onRetry={() => summary.refetch()} />
        ) : summary.isLoading || !s ? (
          <>
            <Skeleton height={124} style={{ borderRadius: radius.xl }} />
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  height={104}
                  width={tileWidth}
                  style={{ borderRadius: radius.lg }}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <LevelCard level={s.level} streakDays={s.streakDays} />

            <View style={styles.grid}>
              {tiles.map((tile) => (
                <Tappable
                  key={tile.key}
                  onPress={() => router.push(tile.href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.label}, ${tile.value}`}
                  style={[
                    styles.tile,
                    {
                      width: tileWidth,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: `${tile.color}22` }]}>
                    <Icon name={tile.icon} size={20} color={tile.color} strokeWidth={2.2} />
                  </View>
                  <Text variant="title" weight="bold" numberOfLines={1}>
                    {tile.label}
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {tile.value}
                  </Text>
                </Tappable>
              ))}
            </View>

            <View
              style={[
                styles.cta,
                {
                  backgroundColor: quizDoneToday ? colors.surfaceMuted : colors.infoSoft,
                  borderColor: quizDoneToday ? colors.border : colors.info,
                },
              ]}
            >
              <Icon
                name={quizDoneToday ? 'circle-check' : 'brain'}
                size={22}
                color={quizDoneToday ? colors.success : colors.info}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" weight="bold">
                  {t('fun.hub.todayQuiz')}
                </Text>
                <Text variant="bodySm" color="textMuted">
                  {quizDoneToday ? t('fun.hub.todayQuizDone') : t('fun.hub.todayQuizHint')}
                </Text>
              </View>
              {!quizDoneToday ? (
                <Button
                  label={t('fun.hub.play')}
                  size="sm"
                  icon="play"
                  onPress={() => router.push('/fun/quiz')}
                />
              ) : null}
            </View>

            <SectionHeader title={t('fun.hub.recentXp')} />
            {history.isError ? (
              <ErrorState onRetry={() => history.refetch()} />
            ) : history.isLoading ? (
              [0, 1, 2].map((i) => (
                <Skeleton key={i} height={56} style={{ borderRadius: radius.lg }} />
              ))
            ) : history.data && history.data.length > 0 ? (
              history.data.slice(0, 6).map((e) => (
                <View
                  key={e.id}
                  style={[
                    styles.xpRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.xpIcon, { backgroundColor: colors.surfaceMuted }]}>
                    <Icon name={SOURCE_ICONS[e.source]} size={16} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="semibold" numberOfLines={1}>
                      {e.note || t(`fun.source.${e.source}` as TranslationKey)}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {t(`fun.source.${e.source}` as TranslationKey)} ·{' '}
                      {formatRelative(e.createdAt, now, locale)}
                    </Text>
                  </View>
                  <Text variant="title" weight="extrabold" color="accent">
                    +{e.amount}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState
                icon="zap"
                title={t('fun.hub.noXp')}
                description={t('fun.hub.noXpDescription')}
                compact
              />
            )}
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
    paddingBottom: spacing.xxl,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  xpIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
