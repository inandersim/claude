import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/core/theme';

import { Icon } from './Icon';
import { Tappable } from './Tappable';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Tappable
          onPress={onAction}
          haptic="selection"
          style={styles.action}
          accessibilityRole="button"
        >
          <Text variant="caption" weight="bold" color="primary">
            {actionLabel}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.primary} strokeWidth={2.6} />
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
});
