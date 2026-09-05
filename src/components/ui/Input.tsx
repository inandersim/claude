import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { fontFamily, radius, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Şifre alanı için göster/gizle düğmesi */
  secure?: boolean;
  right?: React.ReactNode;
}

export function Input({
  label,
  icon,
  error,
  hint,
  containerStyle,
  secure,
  right,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secure));

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="caption" color="textMuted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { backgroundColor: colors.surfaceMuted, borderColor }]}>
        {icon ? (
          <Icon name={icon} size={18} color={focused ? colors.primary : colors.textSubtle} />
        ) : null}
        <TextInput
          {...rest}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textSubtle}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }, style]}
        />
        {secure ? (
          <IconButton
            icon={hidden ? 'eye' : 'eye-off'}
            size={32}
            iconSize={18}
            variant="ghost"
            color={colors.textSubtle}
            onPress={() => setHidden((v) => !v)}
            accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}
          />
        ) : null}
        {right}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSubtle" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs + 2, marginLeft: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing.md },
  helper: { marginTop: spacing.xs + 2, marginLeft: spacing.xs },
});
