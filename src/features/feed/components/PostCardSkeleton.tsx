import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

export function PostCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width={40} height={40} round />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={10} />
        </View>
      </View>
      <Skeleton height={220} style={{ borderRadius: radius.lg, marginHorizontal: spacing.sm }} />
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Skeleton height={12} />
        <Skeleton width="80%" height={12} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <Skeleton height={40} style={{ flex: 1 }} />
          <Skeleton height={40} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: spacing.md },
});
