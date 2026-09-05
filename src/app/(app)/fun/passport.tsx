import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, passportSummary, type AdventureType } from '@/domain';
import { StampCard } from '@/features/fun/components/StampCard';
import { useStamps } from '@/features/fun/hooks';

export default function PassportScreen() {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const stamps = useStamps();

  const columns = width >= 700 ? 3 : 2;
  const contentWidth = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const tileWidth = (contentWidth - spacing.sm * (columns - 1)) / columns;

  const list = stamps.data ?? [];
  const summary = passportSummary(list);
  const types = Object.entries(summary.byType) as [AdventureType, number][];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('fun.passport.title')} subtitle={t('fun.passport.subtitle')} showBack />
      <View style={styles.content}>
        {stamps.isError ? (
          <ErrorState onRetry={() => stamps.refetch()} />
        ) : stamps.isLoading ? (
          <>
            <View style={styles.statRow}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={68} style={{ flex: 1, borderRadius: radius.lg }} />
              ))}
            </View>
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  height={156}
                  width={tileWidth}
                  style={{ borderRadius: radius.xl }}
                />
              ))}
            </View>
          </>
        ) : list.length === 0 ? (
          <EmptyState
            icon="stamp"
            title={t('fun.passport.empty')}
            description={t('fun.passport.emptyDescription')}
          />
        ) : (
          <>
            <View style={styles.statRow}>
              <StatTile
                icon="stamp"
                label={t('fun.passport.stamps')}
                value={String(summary.total)}
                style={{ flex: 1 }}
                compact
              />
              <StatTile
                icon="globe"
                label={t('fun.passport.countries')}
                value={String(summary.countries)}
                color={colors.info}
                style={{ flex: 1 }}
                compact
              />
              <StatTile
                icon="mountain-snow"
                label={t('fun.passport.highest')}
                value={summary.highestM !== null ? formatAltitude(summary.highestM, locale) : '—'}
                color={colors.accent}
                style={{ flex: 1 }}
                compact
              />
            </View>

            <View
              style={[
                styles.typesRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {types.map(([type, count]) => {
                const meta = ADVENTURE_TYPE_META[type];
                return (
                  <View key={type} style={[styles.typePill, { backgroundColor: meta.softColor }]}>
                    <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.4} />
                    <Text variant="label" color={meta.color}>
                      {t(meta.labelKey)} · {count}
                    </Text>
                  </View>
                );
              })}
              {summary.latestAt ? (
                <Text variant="caption" color="textMuted" style={{ width: '100%' }}>
                  {t('fun.passport.latest')}: {formatDate(summary.latestAt, locale)}
                </Text>
              ) : null}
            </View>

            <View style={styles.grid}>
              {list.map((s) => (
                <StampCard key={s.id} stamp={s} width={tileWidth} />
              ))}
            </View>
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
  statRow: { flexDirection: 'row', gap: spacing.sm },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
});
