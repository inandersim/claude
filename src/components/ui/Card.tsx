import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, shadows, spacing, useTheme } from '@/core/theme';

import { Tappable } from './Tappable';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  onPress,
  padded = true,
  elevated = false,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, isDark } = useTheme();
  const base = [
    styles.base,
    {
      backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
      borderColor: colors.border,
      padding: padded ? spacing.lg : 0,
    },
    !isDark && elevated ? shadows.card : null,
    style,
  ];

  if (onPress) {
    return (
      <Tappable onPress={onPress} scaleTo={0.985} style={base} accessibilityRole="button" {...rest}>
        {children}
      </Tappable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
