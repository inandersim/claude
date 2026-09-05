import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { TRAIL_CONDITION_META, type TrailCondition } from '@/domain';

export function TrailConditionBadge({ condition }: { condition: TrailCondition }) {
  const { t } = useT();
  const meta = TRAIL_CONDITION_META[condition];
  return (
    <View style={styles.root}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text variant="caption" weight="bold" color={meta.color}>
        {t(meta.labelKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
