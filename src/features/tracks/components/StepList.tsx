import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { NavigationStep } from '@/domain';
import { instructionText, roundedDistanceLabel } from '@/domain/tracks';

import { MANEUVER_ICON } from './meta';

interface Props {
  steps: NavigationStep[];
  activeIndex?: number;
  /** Gösterilecek en fazla adım (0 = tümü) */
  limit?: number;
}

/** Adım listesi: manevra ikonu, talimat, kümülatif mesafe; etkin adım vurgulu */
export function StepList({ steps, activeIndex = -1, limit = 0 }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const visible = limit > 0 ? steps.slice(0, limit) : steps;

  return (
    <View style={styles.list}>
      {visible.map((step) => {
        const active = step.index === activeIndex;
        const done = step.index < activeIndex;
        const icon = MANEUVER_ICON[step.maneuver];
        const instruction = instructionText(step, locale);
        return (
          <View
            key={step.index}
            style={[
              styles.row,
              {
                backgroundColor: active ? colors.surfaceMuted : 'transparent',
                borderColor: active ? colors.primary : colors.border,
                opacity: done ? 0.55 : 1,
              },
            ]}
            accessibilityLabel={t(instruction.key, instruction.params)}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: active ? colors.primary : colors.surfaceMuted },
              ]}
            >
              <View style={{ transform: [{ rotate: `${icon.rotate}deg` }] }}>
                <Icon
                  name={icon.icon}
                  size={16}
                  color={active ? colors.onPrimary : colors.text}
                  strokeWidth={2.4}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" weight={active ? 'bold' : 'medium'} numberOfLines={2}>
                {t(instruction.key, instruction.params)}
              </Text>
              <Text variant="caption" color="textSubtle">
                {roundedDistanceLabel(step.cumulativeM, locale)}
                {step.poiName ? ` · ${step.poiName}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
