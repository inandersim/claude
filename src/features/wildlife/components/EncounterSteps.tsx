import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

export interface EncounterStepsProps {
  steps: string[];
  /** İlk adım vurgulanır (en acil) */
  highlightFirst?: boolean;
}

/** Numaralı karşılaşma adımları; ilki kırmızı vurgulu olabilir. */
export function EncounterSteps({ steps, highlightFirst = false }: EncounterStepsProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      {steps.map((step, i) => {
        const hot = highlightFirst && i === 0;
        return (
          <View
            key={i}
            style={[
              styles.row,
              {
                backgroundColor: hot ? colors.dangerSoft : colors.surface,
                borderColor: hot ? colors.danger : colors.border,
              },
            ]}
          >
            <View style={[styles.num, { backgroundColor: hot ? colors.danger : colors.primary }]}>
              <Text variant="caption" weight="extrabold" color="#FFFFFF">
                {i + 1}
              </Text>
            </View>
            <Text variant="bodySm" weight={hot ? 'bold' : 'regular'} style={styles.flex}>
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
