import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Chip, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import { BADGE_TIERS, type BadgeTier } from '@/domain';
import { BadgeTile, TIER_COLORS } from '@/features/fun/components/BadgeTile';
import { useBadges } from '@/features/fun/hooks';

export default function BadgesScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const [tier, setTier] = useState<BadgeTier | null>(null);
  const badges = useBadges();

  const columns = width >= 700 ? 4 : 3;
  const contentWidth = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const tileWidth = (contentWidth - spacing.sm * (columns - 1)) / columns;

  const all = badges.data ?? [];
  const earned = all.filter((b) => b.earnedAt !== null).length;
  const list = (tier ? all.filter((b) => b.tier === tier) : all)
    .slice()
    .sort((a, b) => Number(b.earnedAt !== null) - Number(a.earnedAt !== null));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('fun.badges.title')}
        subtitle={all.length ? t('fun.badges.subtitle', { earned, total: all.length }) : undefined}
        showBack
      />
      <View style={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <Chip label={t('fun.tier.all')} selected={tier === null} onPress={() => setTier(null)} />
          {BADGE_TIERS.map((tr) => (
            <Chip
              key={tr}
              label={t(`fun.tier.${tr}`)}
              selected={tier === tr}
              color={TIER_COLORS[tr]}
              onPress={() => setTier(tier === tr ? null : tr)}
            />
          ))}
        </ScrollView>

        {badges.isError ? (
          <ErrorState onRetry={() => badges.refetch()} />
        ) : badges.isLoading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                height={132}
                width={tileWidth}
                style={{ borderRadius: radius.lg }}
              />
            ))}
          </View>
        ) : list.length > 0 ? (
          <>
            <Text variant="caption" color="textMuted">
              {t('fun.badges.subtitle', {
                earned: list.filter((b) => b.earnedAt !== null).length,
                total: list.length,
              })}
            </Text>
            <View style={styles.grid}>
              {list.map((b) => (
                <BadgeTile key={b.id} badge={b} width={tileWidth} />
              ))}
            </View>
          </>
        ) : (
          <EmptyState icon="award" title={t('fun.badges.empty')} />
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
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
