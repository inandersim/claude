import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import { isLightningCode, wmoCodeMeta, type WeatherHour } from '@/domain';

interface Props {
  hourly: WeatherHour[];
  /** Bu andan itibaren gösterilecek saat sayısı */
  count?: number;
  /** "Şimdi" kabul edilecek an (ms) — ekran `fetchedAt`'i verir */
  nowMs?: number;
}

/** Yatay saatlik şerit: saat, ikon, °C, yağış olasılığı. */
export function HourlyStrip({ hourly, count = 24, nowMs }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const startIdx = nowMs
    ? Math.max(
        0,
        hourly.findIndex((h) => new Date(h.time).getTime() + 3_600_000 > nowMs),
      )
    : 0;
  const items = hourly.slice(startIdx, startIdx + count);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('weather.hourly')}
    >
      {items.map((h, i) => {
        const meta = wmoCodeMeta(h.weatherCode);
        const danger = isLightningCode(h.weatherCode) || Math.max(h.windKmh, h.windGustKmh) > 80;
        const tint = danger ? colors.danger : meta.wet ? colors.info : colors.primary;
        return (
          <View
            key={h.time}
            style={[
              styles.cell,
              {
                backgroundColor: i === 0 ? colors.primarySoft : colors.surface,
                borderColor: i === 0 ? colors.primary : colors.border,
              },
            ]}
            accessibilityLabel={`${formatTime(h.time)}: ${Math.round(h.temperatureC)}°, ${t(meta.labelKey)}, ${t('weather.probability')} ${Math.round(h.precipitationProbability)}%`}
          >
            <Text variant="caption" color={i === 0 ? 'primary' : 'textMuted'} weight="semibold">
              {i === 0 ? t('weather.now') : formatTime(h.time)}
            </Text>
            <Icon name={meta.icon} size={22} color={tint} />
            <Text variant="title" weight="bold">
              {Math.round(h.temperatureC)}°
            </Text>
            <View style={styles.rain}>
              <Icon name="droplets" size={10} color={colors.info} />
              <Text variant="caption" color="textMuted">
                {Math.round(h.precipitationProbability)}%
              </Text>
            </View>
            {h.snowfallCm > 0 ? (
              <Text variant="caption" color="textSubtle">
                {h.snowfallCm.toFixed(1)} {t('weather.units.cm')}
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  cell: {
    width: 68,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rain: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
