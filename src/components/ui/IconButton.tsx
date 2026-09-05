import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';
import { Text } from './Text';

export interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  variant?: 'filled' | 'outline' | 'ghost' | 'blur';
  badge?: number;
  fill?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 42,
  iconSize = 20,
  color,
  variant = 'filled',
  badge,
  fill,
  style,
  accessibilityLabel,
  disabled,
}: IconButtonProps) {
  const { colors } = useTheme();
  const background = {
    filled: colors.surfaceMuted,
    outline: 'transparent',
    ghost: 'transparent',
    blur: 'rgba(8, 14, 12, 0.45)',
  }[variant];

  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon
        name={icon}
        size={iconSize}
        color={color ?? (variant === 'blur' ? '#FFFFFF' : colors.text)}
        fill={fill}
      />
      {badge && badge > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}
        >
          <Text variant="label" color="#FFFFFF" weight="extrabold">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
