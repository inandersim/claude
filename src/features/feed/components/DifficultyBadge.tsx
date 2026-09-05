import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { DIFFICULTY_META, type DifficultyGrade } from '@/domain';

/** Zorluk derecesini 5 çubuklu göstergeyle sunar. */
export function DifficultyBadge({
  grade,
  showLabel = true,
}: {
  grade: DifficultyGrade;
  showLabel?: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const meta = DIFFICULTY_META[grade];
  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <View style={styles.bars}>
        {[1, 2, 3, 4, 5].map((level) => (
          <View
            key={level}
            style={[
              styles.bar,
              {
                height: 5 + level * 1.6,
                backgroundColor: level <= meta.level ? meta.color : colors.borderStrong,
              },
            ]}
          />
        ))}
      </View>
      {showLabel ? (
        <Text variant="label" weight="extrabold" color={meta.color}>
          {t(meta.labelKey).toLocaleUpperCase('tr-TR')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 3, borderRadius: 1.5 },
});
