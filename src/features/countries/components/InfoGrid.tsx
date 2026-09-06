import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { bestMonthsLabel, formatPriceTry, languageName, type CountryGuide } from '@/domain';

interface Props {
  guide: CountryGuide;
}

/** Para birimi, saat dilimi, priz tipi, diller ve en iyi aylar. */
export function InfoGrid({ guide }: Props) {
  const { t, locale } = useT();
  const rate =
    guide.tryRate !== null
      ? t('countries.info.rate', {
          currency: guide.currency,
          // Küçük kurlarda (1 NPR ≈ 0,25 ₺) yuvarlama sıfır göstermesin
          try:
            guide.tryRate < 1
              ? `₺${guide.tryRate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
              : formatPriceTry(guide.tryRate, locale),
        })
      : guide.currency;
  const languages = guide.languages.map((l) => languageName(l, locale)).join(', ');

  return (
    <View style={styles.grid}>
      <StatTile
        compact
        icon="banknote"
        label={t('countries.info.currency')}
        value={rate}
        style={styles.tile}
      />
      <StatTile
        compact
        icon="clock"
        label={t('countries.info.timezone')}
        value={guide.timezone}
        style={styles.tile}
      />
      <StatTile
        compact
        icon="zap"
        label={t('countries.info.plugs')}
        value={guide.plugTypes.join(' / ')}
        style={styles.tile}
      />
      <StatTile
        compact
        icon="languages"
        label={t('countries.info.languages')}
        value={languages}
        style={styles.tile}
      />
      <StatTile
        compact
        icon="calendar-days"
        label={t('countries.info.bestMonths')}
        value={bestMonthsLabel(guide.bestMonths, locale)}
        style={styles.tileWide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  tileWide: { flexBasis: '100%' },
});
