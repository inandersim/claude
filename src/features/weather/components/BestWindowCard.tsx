import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatNumber } from '@/core/utils/format';
import { formatTime } from '@/core/utils/time';
import { shortDayName, wmoCodeMeta, type BestWindow } from '@/domain';

interface Props {
  window: BestWindow | null;
  hours?: number;
}

/** "En uygun pencere: Cts 06:00–12:00" kartı; risk puanı ve pencerenin özeti. */
export function BestWindowCard({ window: win, hours = 6 }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  if (!win) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="calendar-check" size={22} color={colors.textSubtle} />
        <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
          {t('weather.bestWindowNone')}
        </Text>
      </View>
    );
  }
  const tint = win.score < 0.8 ? colors.success : win.score < 1.6 ? colors.warning : colors.danger;
  const range = t('weather.bestWindowRange', {
    day: shortDayName(win.from, locale),
    from: formatTime(win.from),
    to: formatTime(win.to),
  });
  const temps = win.hours.map((h) => h.temperatureC);
  const minT = Math.round(Math.min(...temps));
  const maxT = Math.round(Math.max(...temps));
  const maxWind = Math.round(Math.max(...win.hours.map((h) => h.windGustKmh)));
  const maxProb = Math.round(Math.max(...win.hours.map((h) => h.precipitationProbability)));
  const midMeta = wmoCodeMeta(win.hours[Math.floor(win.hours.length / 2)]!.weatherCode);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: tint }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t('weather.bestWindow')}: ${range}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
        <Icon name="calendar-check" size={22} color={tint} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" color="textMuted">
          {t('weather.bestWindow')}
        </Text>
        <Text variant="title" weight="extrabold">
          {range}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {t(midMeta.labelKey)} · {minT}°–{maxT}° · {t('weather.gust')} {maxWind}{' '}
          {t('weather.units.kmh')} · {t('weather.precipitation')} {maxProb}%
        </Text>
        <Text variant="caption" color="textSubtle" numberOfLines={2}>
          {t('weather.bestWindowHint', { hours })}
        </Text>
      </View>
      <View style={styles.score}>
        <Text variant="label" color="textSubtle">
          {t('weather.riskScore').toLocaleUpperCase(locale === 'tr' ? 'tr-TR' : 'en-US')}
        </Text>
        <Text variant="h3" weight="extrabold" color={tint}>
          {formatNumber(win.score, locale, 1)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: { alignItems: 'center', minWidth: 44 },
});
