import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme';
import { useT } from '@/core/i18n';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  /** Büyük başlık düzeni (sekme ekranları) */
  large?: boolean;
  onBack?: () => void;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  right,
  large = false,
  onBack,
}: HeaderProps) {
  const router = useRouter();
  const { t } = useT();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (large) {
    return (
      <View style={styles.large}>
        <View style={{ flex: 1 }}>
          {subtitle ? (
            <Text variant="caption" color="textMuted" style={{ marginBottom: 2 }}>
              {subtitle}
            </Text>
          ) : null}
          {title ? <Text variant="h1">{title}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {showBack ? (
          <IconButton
            icon="chevron-left"
            onPress={handleBack}
            accessibilityLabel={t('common.back')}
            variant="filled"
          />
        ) : null}
      </View>
      <View style={styles.center}>
        {title ? (
          <Text variant="h3" numberOfLines={1} align="center">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1} align="center">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 58,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  side: { width: 84, flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center' },
  right: {
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
