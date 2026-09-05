import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';

interface Props {
  value: AdventureType | null;
  onChange: (value: AdventureType | null) => void;
  includeAll?: boolean;
}

export function AdventureTypeFilter({ value, onChange, includeAll = true }: Props) {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {includeAll ? (
        <Chip
          label={t('common.all')}
          selected={value === null}
          onPress={() => onChange(null)}
          icon="sparkles"
        />
      ) : null}
      {ADVENTURE_TYPES.map((type) => {
        const meta = ADVENTURE_TYPE_META[type];
        return (
          <Chip
            key={type}
            label={t(meta.labelKey)}
            icon={meta.icon}
            color={meta.color}
            selected={value === type}
            onPress={() => onChange(value === type ? null : type)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
});
