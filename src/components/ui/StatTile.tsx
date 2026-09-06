import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { currentLocale } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StatTileProps {
  icon: IconName;
  label: string;
  value: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function StatTile({ icon, label, value, color, style, compact = false }: StatTileProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        compact && styles.compact,
        style,
      ]}
    >
      <Icon name={icon} size={compact ? 14 : 16} color={tint} strokeWidth={2.4} />
      <View style={{ flex: 1 }}>
        <Text variant={compact ? 'caption' : 'title'} weight="extrabold" numberOfLines={1}>
          {value}
        </Text>
        <Text variant="label" color="textSubtle" numberOfLines={1}>
          {label.toLocaleUpperCase(currentLocale())}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 0,
  },
  compact: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.xs + 2,
  },
});
