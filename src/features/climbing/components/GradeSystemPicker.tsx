import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { GRADE_SYSTEMS, gradeFamily, type GradeSystem } from '@/domain';

import { GRADE_SYSTEM_LABEL_KEY } from '../meta';

export interface GradeSystemPickerProps {
  value: GradeSystem;
  onChange: (system: GradeSystem) => void;
  /** Yalnızca belirli aileyi göster (ör. boulder formu için 'boulder') */
  family?: 'route' | 'boulder';
  showLabel?: boolean;
}

/** Derece sistemi seçici: Chip satırı. */
export function GradeSystemPicker({
  value,
  onChange,
  family,
  showLabel = true,
}: GradeSystemPickerProps) {
  const { t } = useT();
  const systems = GRADE_SYSTEMS.filter((s) => !family || gradeFamily(s) === family);
  return (
    <View style={styles.root}>
      {showLabel ? (
        <Text variant="caption" color="textMuted" style={styles.label}>
          {t('climbing.gradeSystemLabel')}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {systems.map((system) => (
          <Chip
            key={system}
            size="sm"
            label={t(GRADE_SYSTEM_LABEL_KEY[system])}
            selected={value === system}
            onPress={() => onChange(system)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs + 2 },
  label: { marginLeft: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
});
