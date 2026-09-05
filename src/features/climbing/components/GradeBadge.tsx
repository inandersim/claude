import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { radius } from '@/core/theme';
import { gradeColor, type GradeSystem } from '@/domain';

export interface GradeBadgeProps {
  grade: string;
  system: GradeSystem;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/** Zorluğa göre renklenen derece rozeti (yeşil → mor). */
export function GradeBadge({ grade, system, size = 'md', style }: GradeBadgeProps) {
  const color = gradeColor(grade, system);
  const minWidth = size === 'lg' ? 64 : size === 'md' ? 48 : 40;
  const variant = size === 'lg' ? 'h3' : size === 'md' ? 'bodySm' : 'caption';
  return (
    <View
      style={[styles.base, { backgroundColor: color, minWidth }, style]}
      accessibilityLabel={`${grade} ${system}`}
    >
      <Text variant={variant} weight="extrabold" color="#FFFFFF" align="center">
        {grade}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
