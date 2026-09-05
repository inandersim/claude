import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { CHECKIN_PRESETS, type CheckinPresetId } from '@/domain';

interface Props {
  onSelect: (id: CheckinPresetId) => void;
  disabled?: boolean;
  /** Gönderim sürerken vurgulanan şablon */
  busyId?: CheckinPresetId | null;
}

/** Tek dokunuşla gönderilen check-in şablonları (yatay kaydırılabilir). */
export function CheckinPresetChips({ onSelect, disabled = false, busyId = null }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('satellite.quickCheckin')}
    >
      {CHECKIN_PRESETS.map((p) => (
        <Chip
          key={p.id}
          label={t(p.labelKey)}
          icon={p.icon as IconName}
          selected={busyId === p.id}
          color={p.id === 'need_pickup' ? colors.warning : colors.primary}
          onPress={disabled ? undefined : () => onSelect(p.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
});
