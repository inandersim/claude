import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { DOCTOR_SPECIALTIES, type DoctorSpecialty } from '@/domain';

interface Props {
  value: DoctorSpecialty | null;
  onChange: (value: DoctorSpecialty | null) => void;
  /** Otomatik seçenek etiketi (request formunda "Otomatik", listede "Tümü") */
  allLabel?: string;
}

/** Yatay kaydırılabilir uzmanlık filtresi. */
export function SpecialtyChips({ value, onChange, allLabel }: Props) {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Chip
        label={allLabel ?? t('telemed.allSpecialties')}
        selected={value === null}
        onPress={() => onChange(null)}
        size="sm"
      />
      {DOCTOR_SPECIALTIES.map((s) => (
        <Chip
          key={s}
          label={t(`telemed.specialty.${s}`)}
          selected={value === s}
          onPress={() => onChange(value === s ? null : s)}
          size="sm"
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
