import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressRing, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { trustLabel } from '@/domain';

export interface TrustScoreRingProps {
  /** 0..100 */
  score: number;
  size?: number;
  /** Etiketi halkanın altına yaz */
  showLabel?: boolean;
}

/** Ev sahibi güven skoru halkası + etiket. */
export function TrustScoreRing({ score, size = 64, showLabel = true }: TrustScoreRingProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const label = trustLabel(score);
  const color =
    label === 'superhost' || label === 'excellent'
      ? colors.primary
      : label === 'good'
        ? colors.warning
        : colors.danger;
  return (
    <View style={styles.root} accessibilityLabel={`${t('inventory.trust.title')} ${score}`}>
      <ProgressRing value={score} size={size} strokeWidth={Math.max(4, size / 12)} color={color}>
        <Text variant={size >= 72 ? 'h3' : 'title'} weight="extrabold">
          {score}
        </Text>
      </ProgressRing>
      {showLabel ? (
        <Text variant="label" weight="bold" color={color} align="center">
          {t(`inventory.trust.${label}`)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.xs },
});
