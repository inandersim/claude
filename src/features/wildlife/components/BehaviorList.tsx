import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

export interface BehaviorListProps {
  doList: string[];
  dontList: string[];
}

/** Yap / yapma listeleri; geniş ekranda iki sütun. */
export function BehaviorList({ doList, dontList }: BehaviorListProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const twoColumns = width >= 520;

  const column = (title: string, items: string[], color: string, icon: 'check' | 'x') => (
    <View style={[styles.col, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name={icon} size={16} color={color} strokeWidth={2.6} />
        <Text variant="title" color={color}>
          {title}
        </Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="bodySm" style={styles.flex}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.root, twoColumns ? styles.twoCols : null]}>
      {column(t('wildlife.behavior.do'), doList, colors.success, 'check')}
      {column(t('wildlife.behavior.dont'), dontList, colors.danger, 'x')}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  twoCols: { flexDirection: 'row' },
  col: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  flex: { flex: 1 },
});
