import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import {
  formatDistance,
  sortStages,
  stageProfile,
  totalAscent,
  type DestinationStage,
} from '@/domain';

interface Props {
  stages: DestinationStage[];
  height?: number;
}

const PAD_TOP = 22;
const PAD_BOTTOM = 8;

/**
 * Etaplara göre SVG alan grafiği (kümülatif km × irtifa). Konaklanan etaplar nokta,
 * en yüksek nokta etiketle gösterilir. maps/ElevationProfile'dan bağımsızdır.
 */
export function StageElevationChart({ stages, height = 150 }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [width, setWidth] = useState(0);

  const sorted = sortStages(stages);
  const profile = stageProfile(sorted);
  const maxKm = profile[profile.length - 1]?.[0] ?? 0;
  const elevations = profile.map((p) => p[1]);
  const minE = elevations.length ? Math.min(...elevations) : 0;
  const maxE = elevations.length ? Math.max(...elevations) : 0;
  const span = Math.max(1, maxE - minE);
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const points =
    width > 0 && profile.length > 1
      ? profile.map(([km, m]) => ({
          x: (km / Math.max(maxKm, 0.001)) * width,
          y: PAD_TOP + innerH - ((m - minE) / span) * innerH,
        }))
      : [];
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last
      ? `M${first.x},${height} L${points.map((p) => `${p.x},${p.y}`).join(' L')} L${last.x},${height} Z`
      : '';
  const maxIndex = elevations.reduce((best, cur, i, arr) => (cur > arr[best]! ? i : best), 0);
  const maxPoint = points[maxIndex];

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityLabel={`${t('destinations.stages.profile')}: ${formatAltitude(minE, locale)} – ${formatAltitude(maxE, locale)}`}
    >
      <View style={styles.header}>
        <Text variant="label" color="textSubtle">
          {t('destinations.stages.profile').toLocaleUpperCase(locale === 'tr' ? 'tr-TR' : 'en-US')}
        </Text>
        <Text variant="caption" color="textMuted">
          ↑ {formatAltitude(totalAscent(sorted), locale)} · {formatAltitude(minE, locale)} →{' '}
          {formatAltitude(maxE, locale)}
        </Text>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && points.length > 1 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="stageElev" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.4" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0.03" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#stageElev)" />
            <Polyline
              points={line}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => {
              const s = sorted[i]!;
              if (!s.sleeping && i !== maxIndex) return null;
              return (
                <Circle
                  key={s.id}
                  cx={p.x}
                  cy={p.y}
                  r={i === maxIndex ? 4.5 : 3.5}
                  fill={
                    i === maxIndex
                      ? colors.accent
                      : s.restDayRecommended
                        ? colors.success
                        : colors.surface
                  }
                  stroke={i === maxIndex ? colors.accent : colors.primary}
                  strokeWidth={2}
                />
              );
            })}
            {maxPoint ? (
              <SvgText
                x={Math.min(Math.max(maxPoint.x, 32), width - 32)}
                y={Math.max(11, maxPoint.y - 9)}
                fontSize={10}
                fontWeight="bold"
                fill={colors.text}
                textAnchor="middle"
              >
                {formatAltitude(maxE, locale)}
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
          {formatDistance(maxKm, locale)}
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
