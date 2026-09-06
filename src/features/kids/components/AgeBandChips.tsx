import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { KID_AGE_BANDS, kidAgeBandMeta, type KidAgeBand } from '@/domain';

interface Props {
  value: KidAgeBand | null;
  onChange: (value: KidAgeBand | null) => void;
  /** "Tüm yaşlar" çipini göster */
  allowAll?: boolean;
  size?: 'sm' | 'md';
  /** Yatay kaydırma yerine satır içine sar */
  wrap?: boolean;
}

/** Yaş bandı seçim çipleri (tekli seçim; tekrar basınca temizlenir). */
export function AgeBandChips({ value, onChange, allowAll = true, size = 'md', wrap }: Props) {
  const { t } = useT();
  const chips = (
    <>
      {allowAll ? (
        <Chip
          label={t('kids.ageBand.all')}
          icon="users"
          size={size}
          selected={value === null}
          onPress={() => onChange(null)}
        />
      ) : null}
      {KID_AGE_BANDS.map((b) => (
        <Chip
          key={b}
          label={t(kidAgeBandMeta[b].labelKey)}
          icon={kidAgeBandMeta[b].icon as IconName}
          color={kidAgeBandMeta[b].color}
          size={size}
          selected={value === b}
          onPress={() => onChange(value === b && allowAll ? null : b)}
        />
      ))}
    </>
  );
  if (wrap)
    return (
      <ScrollView horizontal={false} contentContainerStyle={styles.wrap}>
        {chips}
      </ScrollView>
    );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ marginHorizontal: -spacing.lg }}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
