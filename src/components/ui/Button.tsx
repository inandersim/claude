import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const heights: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
const iconSizes: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
    accent: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: colors.surfaceMuted, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Tappable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      haptic={variant === 'ghost' ? 'selection' : 'light'}
      style={[
        styles.base,
        {
          height: heights[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon name={icon} size={iconSizes[size]} color={palette.fg} strokeWidth={2.4} />
          ) : null}
          <Text variant={size === 'sm' ? 'caption' : 'title'} weight="bold" color={palette.fg}>
            {label}
          </Text>
          {iconRight ? (
            <Icon name={iconRight} size={iconSizes[size]} color={palette.fg} strokeWidth={2.4} />
          ) : null}
        </View>
      )}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
