import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { dayKey } from '@/domain';

/** Sohbette gün ayracı: Bugün / Dün / 12 Eylül. */
export function DayDivider({ date, now }: { date: string; now: number }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const key = dayKey(date);
  const today = dayKey(new Date(now).toISOString());
  const yesterday = dayKey(new Date(now - 86_400_000).toISOString());
  const label =
    key === today
      ? t('groups.today')
      : key === yesterday
        ? t('groups.yesterday')
        : formatDate(date, locale, 'd MMMM');

  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="label" weight="bold" color="textMuted">
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', marginVertical: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
});
