import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  bearingDeg,
  HAZARD_SEVERITY_META,
  type GeoPoint,
  type HazardZoneWithReporter,
} from '@/domain';

interface Props {
  origin: GeoPoint;
  hazards: HazardZoneWithReporter[];
  /** Radarın dış halkasının temsil ettiği mesafe (km) */
  rangeKm: number;
  height?: number;
}

/**
 * Harita SDK'sı gerektirmeyen radar görünümü: kullanıcı merkezde, tehlikeler
 * yön ve mesafeye göre yerleşir. Şiddet renkle, etki yarıçapı daire boyutuyla gösterilir.
 */
export function HazardRadar({ origin, hazards, rangeKm, height = 300 }: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [width, setWidth] = useState(0);
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const outer = size / 2 - 18;

  const dots = useMemo(() => {
    return hazards
      .filter((h) => h.distanceKm !== null && h.distanceKm <= rangeKm)
      .map((h) => {
        const d = (h.distanceKm ?? 0) / rangeKm; // 0..1
        const angle = ((bearingDeg(origin, h.coords) - 90) * Math.PI) / 180;
        const r = Math.max(d * outer, 14);
        const dotR = Math.min(22, Math.max(7, (h.radiusM / 1000) * (outer / rangeKm) * 3));
        return {
          h,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          dotR,
          color: HAZARD_SEVERITY_META[h.severity].color,
        };
      });
  }, [hazards, origin, rangeKm, outer, cx, cy]);

  const rings = [0.33, 0.66, 1];

  return (
    <View
      style={[styles.root, { height, backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="sweep" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.16" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={outer} fill="url(#sweep)" />
          {rings.map((f) => (
            <Circle
              key={f}
              cx={cx}
              cy={cy}
              r={outer * f}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
              strokeDasharray={f === 1 ? undefined : '3 5'}
            />
          ))}
          <Line
            x1={cx - outer}
            y1={cy}
            x2={cx + outer}
            y2={cy}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Line
            x1={cx}
            y1={cy - outer}
            x2={cx}
            y2={cy + outer}
            stroke={colors.border}
            strokeWidth={1}
          />
          {rings.map((f) => (
            <SvgText
              key={`l${f}`}
              x={cx + outer * f - 4}
              y={cy - 5}
              fontSize={10}
              fill={colors.textSubtle}
              textAnchor="end"
            >
              {Math.round(rangeKm * f)} km
            </SvgText>
          ))}
          <SvgText
            x={cx}
            y={cy - outer - 6}
            fontSize={10}
            fill={colors.textSubtle}
            textAnchor="middle"
            fontWeight="bold"
          >
            K
          </SvgText>
          {dots.map(({ h, x, y, dotR, color }) => (
            <G key={h.id}>
              <Circle cx={x} cy={y} r={dotR + 6} fill={color} opacity={0.18} />
              <Circle
                cx={x}
                cy={y}
                r={dotR}
                fill={color}
                opacity={0.85}
                stroke={colors.surface}
                strokeWidth={2}
              />
            </G>
          ))}
          <Circle
            cx={cx}
            cy={cy}
            r={9}
            fill={colors.primary}
            stroke={colors.surface}
            strokeWidth={3}
          />
        </Svg>
      ) : null}
      {/* Dokunma hedefleri (SVG üstünde) */}
      {dots.map(({ h, x, y, dotR }) => (
        <Tappable
          key={`t-${h.id}`}
          onPress={() => router.push({ pathname: '/hazards/[id]', params: { id: h.id } })}
          haptic="selection"
          scaleTo={0.9}
          style={{
            position: 'absolute',
            left: x - dotR - 8,
            top: y - dotR - 8,
            width: (dotR + 8) * 2,
            height: (dotR + 8) * 2,
            borderRadius: dotR + 8,
          }}
          accessibilityRole="button"
          accessibilityLabel={h.title}
        />
      ))}
      <View style={[styles.legend, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <Text variant="label" color="textMuted">
          {t('hazards.youAreHere')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  legend: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
