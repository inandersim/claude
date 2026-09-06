import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { HERITAGE_ERAS, heritageEraMeta, type HeritageEra } from '@/domain';

interface Props {
  value: HeritageEra | null;
  onChange: (era: HeritageEra | null) => void;
  /** Yalnızca bu dönemleri göster (seed'de kullanılanlar gibi) */
  eras?: readonly HeritageEra[];
}

/** Yatay kaydırılabilir dönem filtresi; "Tüm dönemler" ile başlar. */
export function EraChips({ value, onChange, eras = HERITAGE_ERAS }: Props) {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Chip
        label={t('heritage.allEras')}
        selected={value === null}
        onPress={() => onChange(null)}
        size="sm"
      />
      {eras.map((era) => {
        const m = heritageEraMeta[era];
        return (
          <Chip
            key={era}
            label={t(m.labelKey)}
            icon={m.icon}
            color={m.color}
            selected={value === era}
            onPress={() => onChange(value === era ? null : era)}
            size="sm"
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingRight: spacing.lg },
});
