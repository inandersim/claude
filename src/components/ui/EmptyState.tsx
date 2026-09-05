import React from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/core/theme';

import { Button, type ButtonProps } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: Pick<ButtonProps, 'label' | 'onPress' | 'icon' | 'variant'>;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="bodySm" color="textMuted" align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {action ? <Button {...action} size="md" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  compact: { paddingVertical: spacing.xxl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  description: { maxWidth: 280 },
  action: { marginTop: spacing.md },
});
