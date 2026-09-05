import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import type { CancellationPolicy } from '@/domain';

import { POLICY_META } from './meta';

export interface PolicyBadgeProps {
  policy: CancellationPolicy;
  /** Açıklama satırını da göster */
  description?: boolean;
}

/** İptal politikası rozeti (+ isteğe bağlı açıklama). */
export function PolicyBadge({ policy, description = false }: PolicyBadgeProps) {
  const { t } = useT();
  const meta = POLICY_META[policy];
  return (
    <View style={styles.root}>
      <Badge
        label={`${t('inventory.policy.title')}: ${t(`inventory.policy.${policy}`)}`}
        color={meta.color}
        icon={meta.icon}
      />
      {description ? (
        <Text variant="caption" color="textMuted">
          {t(`inventory.policy.desc.${policy}`)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs, alignItems: 'flex-start' },
});
