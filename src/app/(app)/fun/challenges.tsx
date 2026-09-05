import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  Skeleton,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import { CHALLENGE_PERIODS, type ChallengePeriod } from '@/domain';
import { ChallengeCard } from '@/features/fun/components/ChallengeCard';
import { useChallenges, useJoinChallenge } from '@/features/fun/hooks';

export default function ChallengesScreen() {
  const { t } = useT();
  const toast = useToast();
  const [period, setPeriod] = useState<ChallengePeriod>('weekly');
  const [now] = useState(() => Date.now());
  const challenges = useChallenges();
  const join = useJoinChallenge();

  const list = (challenges.data ?? []).filter((c) => c.period === period);
  const counts = Object.fromEntries(
    CHALLENGE_PERIODS.map((p) => [p, (challenges.data ?? []).filter((c) => c.period === p).length]),
  ) as Record<ChallengePeriod, number>;

  const handleJoin = (id: string) => {
    join.mutate(id, {
      onSuccess: () => toast(t('fun.challenges.joinedToast'), 'success'),
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('fun.challenges.title')} subtitle={t('fun.challenges.subtitle')} showBack />
      <View style={styles.content}>
        <SegmentedControl
          segments={CHALLENGE_PERIODS.map((p) => ({
            value: p,
            label: t(`fun.period.${p}`),
            badge: counts[p] || undefined,
          }))}
          value={period}
          onChange={setPeriod}
        />
        {challenges.isError ? (
          <ErrorState onRetry={() => challenges.refetch()} />
        ) : challenges.isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} height={180} style={{ borderRadius: radius.xl }} />
          ))
        ) : list.length > 0 ? (
          list.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              now={now}
              onJoin={handleJoin}
              joining={join.isPending && join.variables === c.id}
            />
          ))
        ) : (
          <EmptyState
            icon="target"
            title={t('fun.challenges.empty')}
            description={t('fun.challenges.emptyDescription')}
          />
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
});
