import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { budgetLabel, formatPriceTry } from '@/domain';

interface Props {
  budget: { low: number; high: number };
  typicalDays: number;
}

/** Bütçe kartı: düşük/yüksek aralık, gün başı tahmin ve uyarı notu. */
export function BudgetCard({ budget, typicalDays }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const perDayLow = Math.round(budget.low / Math.max(1, typicalDays));
  const perDayHigh = Math.round(budget.high / Math.max(1, typicalDays));
  const ratio = budget.high > 0 ? Math.min(1, budget.low / budget.high) : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name="wallet" size={18} color={colors.accent} strokeWidth={2.2} />
        <Text variant="title" style={{ flex: 1 }}>
          {t('destinations.budget.title')}
        </Text>
        <Text variant="caption" color="textSubtle">
          {t('destinations.budget.perPerson')}
        </Text>
      </View>
      <Text variant="h2" color="accent">
        {budgetLabel(budget, locale)}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: colors.accent, left: `${ratio * 100}%`, right: 0 },
          ]}
        />
      </View>
      <View style={styles.cols}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color="textSubtle">
            {t('destinations.budget.low')}
          </Text>
          <Text variant="body" weight="semibold">
            {formatPriceTry(perDayLow, locale, false)} /{' '}
            {t('destinations.stats.days').toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="label" color="textSubtle">
            {t('destinations.budget.high')}
          </Text>
          <Text variant="body" weight="semibold">
            {formatPriceTry(perDayHigh, locale, false)} /{' '}
            {t('destinations.stats.days').toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')}
          </Text>
        </View>
      </View>
      <Text variant="caption" color="textSubtle">
        {t('destinations.budget.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  cols: { flexDirection: 'row', gap: spacing.md },
});
