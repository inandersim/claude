import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StatTile, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDuration } from '@/core/utils/time';
import { formatDistance, type PlannedRoute, type Surface } from '@/domain';

import { SURFACE_COLOR } from './meta';

interface Props {
  planned: PlannedRoute;
  /** Yüzey dağılımı çubuğunu göster */
  showSurfaces?: boolean;
}

/** Mesafe / tırmanış / iniş / süre / en yüksek nokta satırı + yüzey dağılımı. */
export function RouteStats({ planned, showSurfaces = true }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const surfaces = (Object.entries(planned.surfaces) as [Surface, number][])
    .filter(([, km]) => km > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = surfaces.reduce((acc, [, km]) => acc + km, 0) || 1;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <StatTile
          icon="ruler"
          label={t('maps.stats.distance')}
          value={formatDistance(planned.distanceKm, locale)}
          compact
          style={styles.tile}
        />
        <StatTile
          icon="trending-up"
          label={t('maps.stats.ascent')}
          value={formatAltitude(planned.ascentM, locale)}
          color={colors.accent}
          compact
          style={styles.tile}
        />
        <StatTile
          icon="arrow-right"
          label={t('maps.stats.descent')}
          value={formatAltitude(planned.descentM, locale)}
          color={colors.info}
          compact
          style={styles.tile}
        />
      </View>
      <View style={styles.row}>
        <StatTile
          icon="timer"
          label={t('maps.stats.duration')}
          value={formatDuration(planned.durationMin, locale)}
          compact
          style={styles.tile}
        />
        <StatTile
          icon="mountain"
          label={t('maps.stats.maxAlt')}
          value={formatAltitude(planned.maxElevationM, locale)}
          color={colors.warning}
          compact
          style={styles.tile}
        />
      </View>

      {showSurfaces && surfaces.length > 0 ? (
        <View style={styles.surfaces}>
          <Text variant="label" color="textSubtle">
            {t('maps.surfaceBreakdown').toLocaleUpperCase(locale)}
          </Text>
          <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
            {surfaces.map(([surface, km]) => (
              <View
                key={surface}
                style={{ flex: km / total, backgroundColor: SURFACE_COLOR[surface] }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {surfaces.map(([surface, km]) => (
              <View key={surface} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: SURFACE_COLOR[surface] }]} />
                <Text variant="caption" color="textMuted">
                  {t(`maps.surfaces.${surface}`)} · {formatDistance(km, locale)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1 },
  surfaces: { gap: spacing.xs + 2, marginTop: spacing.xs },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
