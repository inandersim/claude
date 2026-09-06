import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { LEADERBOARD_SCOPES, type LeaderboardScope } from '@/domain';
import { LeaderboardRow } from '@/features/fun/components/LeaderboardRow';
import { useLeaderboard } from '@/features/fun/hooks';

export default function LeaderboardScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<LeaderboardScope>('friends');
  const board = useLeaderboard(scope);

  const rows = board.data ?? [];
  const me = rows.find((r) => r.isMe) ?? null;
  const showPinned = me !== null && rows.length > 5;

  return (
    <Screen edges={['top']}>
      <Header
        title={t('fun.leaderboard.title')}
        subtitle={t('fun.leaderboard.subtitle')}
        showBack
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedControl
          segments={LEADERBOARD_SCOPES.map((s) => ({ value: s, label: t(`fun.scope.${s}`) }))}
          value={scope}
          onChange={setScope}
        />
        {board.isError ? (
          <ErrorState onRetry={() => board.refetch()} />
        ) : board.isLoading ? (
          [0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={60} style={{ borderRadius: radius.lg }} />
          ))
        ) : rows.length > 1 ? (
          rows.map((entry) => <LeaderboardRow key={entry.user.id} entry={entry} />)
        ) : (
          <EmptyState
            icon="users"
            title={t('fun.leaderboard.empty')}
            description={t('fun.leaderboard.emptyDescription')}
          />
        )}
        <View style={{ height: showPinned ? 96 : spacing.xxl }} />
      </ScrollView>
      {showPinned && me ? (
        <View
          style={[
            styles.pinned,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Text variant="label" color="textMuted" style={{ marginBottom: spacing.xs }}>
            {t('fun.leaderboard.yourRank').toLocaleUpperCase(currentLocale())}
          </Text>
          <LeaderboardRow entry={me} pinned />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  pinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
