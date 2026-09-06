import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { shortDayName, wmoCodeMeta, type WeatherDay } from '@/domain';

interface Props {
  daily: WeatherDay[];
  /** Bugünün YYYY-MM-DD anahtarı (UTC) — "Bugün/Yarın" etiketi için */
  todayKey?: string;
}

/** 7 günlük liste: gün, ikon, min/max, yağış, rüzgâr. */
export function DailyList({ daily, todayKey }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const minAll = Math.min(...daily.map((d) => d.minC));
  const maxAll = Math.max(...daily.map((d) => d.maxC));
  const span = Math.max(1, maxAll - minAll);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {daily.map((d, i) => {
        const meta = wmoCodeMeta(d.weatherCode);
        const key = d.date.slice(0, 10);
        const tomorrowKey = todayKey
          ? new Date(new Date(`${todayKey}T00:00:00Z`).getTime() + 86_400_000)
              .toISOString()
              .slice(0, 10)
          : null;
        const label =
          key === todayKey
            ? t('weather.day.today')
            : key === tomorrowKey
              ? t('weather.day.tomorrow')
              : shortDayName(d.date, locale);
        const left = ((d.minC - minAll) / span) * 100;
        const width = Math.max(6, ((d.maxC - d.minC) / span) * 100);
        const tint = d.maxC < 0 ? colors.info : d.maxC > 30 ? colors.danger : colors.primary;
        return (
          <View
            key={d.date}
            style={[
              styles.row,
              i < daily.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
            accessibilityLabel={`${label}: ${t(meta.labelKey)}, ${Math.round(d.minC)}° – ${Math.round(d.maxC)}°, ${t('weather.precipitation')} ${Math.round(d.precipitationProbability)}%, ${t('weather.wind')} ${Math.round(d.windMaxKmh)} ${t('weather.units.kmh')}`}
          >
            <Text variant="body" weight="semibold" style={styles.day} numberOfLines={1}>
              {label}
            </Text>
            <Icon name={meta.icon} size={20} color={meta.wet ? colors.info : colors.primary} />
            <View style={styles.rain}>
              <Icon name="droplets" size={10} color={colors.info} />
              <Text variant="caption" color="textMuted">
                {Math.round(d.precipitationProbability)}%
              </Text>
            </View>
            <Text variant="bodySm" color="textMuted" style={styles.temp}>
              {Math.round(d.minC)}°
            </Text>
            <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]} accessible={false}>
              <View
                style={[
                  styles.barFill,
                  { left: `${left}%`, width: `${width}%`, backgroundColor: tint },
                ]}
              />
            </View>
            <Text variant="bodySm" weight="bold" style={styles.temp}>
              {Math.round(d.maxC)}°
            </Text>
            <View style={styles.wind}>
              <Icon name="wind" size={11} color={colors.textSubtle} />
              <Text variant="caption" color="textSubtle">
                {Math.round(d.windMaxKmh)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  day: { width: 48 },
  rain: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 44 },
  temp: { width: 34, textAlign: 'right' },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  wind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 40,
    justifyContent: 'flex-end',
  },
});
