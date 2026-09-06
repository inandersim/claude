import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { compassDirection, wmoCodeMeta, type WeatherHour } from '@/domain';

interface Props {
  hour: WeatherHour;
  elevationM: number | null;
  /** Konum adı (ekran başlığı için) */
  placeName?: string | null;
}

/** Şimdiki koşullar: büyük ikon, sıcaklık, hissedilen, rüzgâr ve yön oku. */
export function WeatherNow({ hour, elevationM, placeName }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = wmoCodeMeta(hour.weatherCode);
  const dir = compassDirection(hour.windDirectionDeg);
  const temp = Math.round(hour.temperatureC);
  const feels = Math.round(hour.apparentC);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t('weather.now')}: ${temp}°, ${t(meta.labelKey)}, ${t('weather.wind')} ${Math.round(hour.windKmh)} ${t('weather.units.kmh')} ${t('weather.windFrom', { dir: t(`weather.direction.${dir}`) })}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={meta.icon} size={44} color={colors.primary} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textMuted">
            {placeName ? `${t('weather.now')} · ${placeName}` : t('weather.now')}
          </Text>
          <View style={styles.tempRow}>
            <Text variant="display" weight="extrabold">
              {temp}°
            </Text>
            <Text variant="body" color="textMuted" style={{ marginBottom: 6 }}>
              {t(meta.labelKey)}
            </Text>
          </View>
          <Text variant="bodySm" color="textMuted">
            {t('weather.feelsLike')} {feels}°
            {elevationM != null ? ` · ${formatAltitude(elevationM, locale)}` : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.stats, { borderTopColor: colors.border }]}>
        <Stat
          icon="wind"
          label={t('weather.wind')}
          value={`${Math.round(hour.windKmh)} ${t('weather.units.kmh')}`}
          extra={
            <View
              style={{ transform: [{ rotate: `${(hour.windDirectionDeg + 180) % 360}deg` }] }}
              accessible={false}
            >
              <Icon name="navigation" size={14} color={colors.textMuted} />
            </View>
          }
          hint={t(`weather.direction.${dir}`)}
        />
        <Stat
          icon="gauge"
          label={t('weather.gust')}
          value={`${Math.round(hour.windGustKmh)} ${t('weather.units.kmh')}`}
        />
        <Stat
          icon="droplets"
          label={t('weather.precipitation')}
          value={`${Math.round(hour.precipitationProbability)}%`}
          hint={
            hour.precipitationMm > 0
              ? `${hour.precipitationMm.toFixed(1)} ${t('weather.units.mm')}`
              : undefined
          }
        />
        <Stat
          icon="cloud"
          label={t('weather.cloud')}
          value={`${Math.round(hour.cloudCoverPct)}%`}
        />
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  extra,
}: {
  icon: 'wind' | 'gauge' | 'droplets' | 'cloud';
  label: string;
  value: string;
  hint?: string;
  extra?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Icon name={icon} size={13} color={colors.textSubtle} />
        <Text variant="label" color="textSubtle" numberOfLines={1}>
          {label.toLocaleUpperCase()}
        </Text>
      </View>
      <View style={styles.statValue}>
        <Text variant="title" weight="bold" numberOfLines={1}>
          {value}
        </Text>
        {extra}
      </View>
      {hint ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  stat: { flexBasis: '46%', flexGrow: 1, gap: 2 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
