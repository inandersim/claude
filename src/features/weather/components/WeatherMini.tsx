import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Skeleton, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { GeoPoint } from '@/domain';
import { useWeatherAt } from '@/features/weather/hooks';

interface Props {
  coords: GeoPoint;
  elevationM?: number | null;
  /** Yalnızca ikon + sıcaklık (metin yok) */
  compact?: boolean;
}

/**
 * Kart içi kompakt hava özeti: ikon + °C + uyarı noktası.
 * Diğer modüller (rota kartı, kamp, zirve sayfası) ekleyebilsin diye dışa aktarılır.
 */
export function WeatherMini({ coords, elevationM = null, compact = false }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const { summary, isLoading } = useWeatherAt(coords, elevationM);

  if (isLoading && !summary) {
    return <Skeleton height={26} style={{ width: 64, borderRadius: radius.full }} />;
  }
  if (!summary) return null;

  const alertTint =
    summary.alert?.level === 'danger'
      ? colors.danger
      : summary.alert?.level === 'warning'
        ? colors.warning
        : null;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityLabel={`${t('weather.now')}: ${Math.round(summary.temperatureC)}°, ${t(summary.meta.labelKey)}`}
    >
      <Icon
        name={summary.meta.icon}
        size={16}
        color={summary.meta.wet ? colors.info : colors.primary}
      />
      <Text variant="caption" weight="bold">
        {Math.round(summary.temperatureC)}°
      </Text>
      {!compact ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {t(summary.meta.labelKey)}
        </Text>
      ) : null}
      {alertTint ? <View style={[styles.dot, { backgroundColor: alertTint }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
