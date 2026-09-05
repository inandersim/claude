import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  color: string;
  icon?: IconName;
  /** Koyu arka plan üzerinde yumuşak versiyon */
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}

function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Badge({ label, color, icon, soft = true, style }: BadgeProps) {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: soft ? withAlpha(color, 0.16) : color,
          borderColor: withAlpha(color, soft ? 0.3 : 0),
        },
        style,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={12} color={soft ? color : '#06120B'} strokeWidth={2.6} />
      ) : null}
      <Text variant="label" weight="extrabold" color={soft ? color : '#06120B'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
