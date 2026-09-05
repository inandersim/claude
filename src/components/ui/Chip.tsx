import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Seçili durumda kullanılacak renk (varsayılan: primary) */
  color?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  color,
  size = 'md',
  style,
}: ChipProps) {
  const { colors, isDark } = useTheme();
  const activeColor = color ?? colors.primary;
  const fg = selected ? (isDark ? '#06120B' : '#FFFFFF') : colors.textMuted;
  const height = size === 'sm' ? 30 : 36;

  const content = (
    <View
      style={[styles.row, { height, paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg }]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={size === 'sm' ? 14 : 16}
          color={selected ? fg : activeColor}
          strokeWidth={2.4}
        />
      ) : null}
      <Text variant={size === 'sm' ? 'caption' : 'bodySm'} weight="bold" color={fg}>
        {label}
      </Text>
    </View>
  );

  const containerStyle = [
    styles.base,
    {
      backgroundColor: selected ? activeColor : colors.surfaceMuted,
      borderColor: selected ? activeColor : colors.border,
    },
    style,
  ];

  if (!onPress) return <View style={containerStyle}>{content}</View>;

  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={containerStyle}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
});
