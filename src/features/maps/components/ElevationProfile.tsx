import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import {
  elevationProfilePoints,
  formatDistance,
  svgPointsString,
  type PlannedRoute,
} from '@/domain';

interface Props {
  planned: PlannedRoute;
  height?: number;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 6;

/** SVG alan grafiği: rota boyunca yükseklik; min/max etiketleri. */
export function ElevationProfile({ planned, height = 140 }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [width, setWidth] = useState(0);

  const points =
    width > 0 ? elevationProfilePoints(planned, width, height - PAD_BOTTOM, PAD_TOP) : [];
  const line = svgPointsString(points);
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last
      ? `M${first.x},${height} L${points.map((p) => `${p.x},${p.y}`).join(' L')} L${last.x},${height} Z`
      : '';
  const maxIndex = planned.profile.reduce(
    (best, cur, i, arr) => (cur[1] > arr[best]![1] ? i : best),
    0,
  );
  const maxPoint = points[maxIndex];

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityLabel={`${t('maps.elevationProfile')}: ${formatAltitude(planned.minElevationM, locale)} – ${formatAltitude(planned.maxElevationM, locale)}`}
    >
      <View style={styles.header}>
        <Text variant="label" color="textSubtle">
          {t('maps.elevationProfile').toLocaleUpperCase('tr-TR')}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatAltitude(planned.minElevationM, locale)} →{' '}
          {formatAltitude(planned.maxElevationM, locale)}
        </Text>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && points.length > 1 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.45" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0.03" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#elev)" />
            <Polyline
              points={line}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {maxPoint ? (
              <SvgText
                x={Math.min(Math.max(maxPoint.x, 28), width - 28)}
                y={Math.max(10, maxPoint.y - 6)}
                fontSize={10}
                fontWeight="bold"
                fill={colors.text}
                textAnchor="middle"
              >
                {formatAltitude(planned.maxElevationM, locale)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text variant="caption" color="textSubtle">
          0 km
        </Text>
        <Text variant="caption" color="textSubtle">
          {formatDistance(planned.distanceKm, locale)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
