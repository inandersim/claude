import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatMonths, monthShort } from '@/domain';

interface Props {
  months: number[];
  /** Vurgulanacak ay (1–12), örn. şu anki ay */
  currentMonth?: number | null;
  /** Küçük (kart) ya da etiketli (detay) görünüm */
  compact?: boolean;
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 12 aylık mini çubuk: en iyi aylar dolu, diğerleri soluk. */
export function MonthBar({ months, currentMonth = null, compact = false }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const set = new Set(months);
  return (
    <View
      style={styles.root}
      accessibilityLabel={`${t('destinations.stats.bestMonths')}: ${formatMonths(months, locale)}`}
    >
      <View style={styles.bars}>
        {ALL_MONTHS.map((m) => {
          const active = set.has(m);
          const isNow = currentMonth === m;
          return (
            <View key={m} style={styles.col}>
              <View
                style={[
                  styles.bar,
                  compact && styles.barCompact,
                  {
                    backgroundColor: active ? colors.primary : colors.border,
                    opacity: active ? 1 : 0.6,
                    borderColor: isNow ? colors.text : 'transparent',
                    borderWidth: isNow ? 1.5 : 0,
                  },
                ]}
              />
              {!compact ? (
                <Text
                  variant="label"
                  color={active ? 'text' : 'textSubtle'}
                  style={styles.monthLabel}
                >
                  {monthShort(m, locale).slice(0, 1)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {!compact ? (
        <Text variant="caption" color="textMuted">
          {formatMonths(months, locale)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  bar: { width: '100%', height: 14, borderRadius: 3 },
  barCompact: { height: 6, borderRadius: 2 },
  monthLabel: { fontSize: 9, lineHeight: 11 },
});
