import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { heritageKindMeta, type GeoPoint, type HeritageSite } from '@/domain';

interface Props {
  sites: HeritageSite[];
  /** Vurgulanan (merkez) alan */
  focusId?: string | null;
  /** Kullanıcı konumu */
  position?: GeoPoint | null;
  height?: number;
  onSitePress?: (site: HeritageSite) => void;
  onExpand?: () => void;
}

interface Projected {
  x: number;
  y: number;
}

const PAD = 22;
const HIT = 36;

/**
 * Birkaç alanın konumunu gösteren mini harita (react-native-svg).
 * SVG içinde onPress yok; dokunma alanları üstte mutlak konumlu Pressable'lardır.
 */
export function SiteMapMini({
  sites,
  focusId = null,
  position = null,
  height = 200,
  onSitePress,
  onExpand,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);

  const project = useMemo(() => {
    if (width === 0 || sites.length === 0) return null;
    const all: GeoPoint[] = sites.map((s) => s.coords);
    if (position) all.push(position);
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of all) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    // Tek nokta ya da çok dar kutu → en az 0.2° genişlik
    const spanLat = Math.max(maxLat - minLat, 0.2);
    const spanLng = Math.max(maxLng - minLng, 0.2);
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    const cos = Math.cos((cLat * Math.PI) / 180) || 1;
    const scale = Math.min((width - PAD * 2) / (spanLng * cos), (height - PAD * 2) / spanLat);
    return (p: GeoPoint): Projected => ({
      x: width / 2 + (p.longitude - cLng) * cos * scale,
      y: height / 2 - (p.latitude - cLat) * scale,
    });
  }, [width, height, sites, position]);

  const points = useMemo(
    () => (project ? sites.map((s) => ({ site: s, p: project(s.coords) })) : []),
    [project, sites],
  );
  const me = project && position ? project(position) : null;
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const bg = isDark ? '#0F1A15' : '#EEF4F0';

  return (
    <View
      style={[styles.root, { height, borderColor: colors.border, backgroundColor: bg }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={t('heritage.mapMini', { count: sites.length })}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill={bg} />
          {[0.25, 0.5, 0.75].map((f) => (
            <G key={f}>
              <Line
                x1={0}
                y1={height * f}
                x2={width}
                y2={height * f}
                stroke={grid}
                strokeWidth={1}
              />
              <Line
                x1={width * f}
                y1={0}
                x2={width * f}
                y2={height}
                stroke={grid}
                strokeWidth={1}
              />
            </G>
          ))}
          {me ? (
            <G>
              <Circle cx={me.x} cy={me.y} r={10} fill={colors.info} opacity={0.25} />
              <Circle
                cx={me.x}
                cy={me.y}
                r={5}
                fill={colors.info}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </G>
          ) : null}
          {points.map(({ site, p }, i) => {
            const focus = site.id === focusId;
            const color = heritageKindMeta[site.kind].color;
            return (
              <G key={site.id}>
                {focus ? <Circle cx={p.x} cy={p.y} r={14} fill={color} opacity={0.25} /> : null}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={focus ? 8 : 6}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <SvgText
                  x={p.x}
                  y={p.y + (focus ? 22 : 18)}
                  fontSize={10}
                  fontWeight={focus ? '700' : '500'}
                  fill={colors.text}
                  textAnchor="middle"
                >
                  {site.name.length > 18 ? `${site.name.slice(0, 17)}…` : site.name}
                </SvgText>
                {i === 0 && focus ? null : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
      {onSitePress
        ? points.map(({ site, p }) => (
            <Pressable
              key={`hit-${site.id}`}
              onPress={() => onSitePress(site)}
              accessibilityRole="button"
              accessibilityLabel={site.name}
              style={[styles.hit, { left: p.x - HIT / 2, top: p.y - HIT / 2 }]}
            />
          ))
        : null}
      {onExpand ? (
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel={t('heritage.mapOpen')}
          style={[styles.expand, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="map-pinned" size={14} color={colors.primary} />
          <Text variant="label" color="primary">
            {t('heritage.mapOpen')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  hit: { position: 'absolute', width: HIT, height: HIT },
  expand: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
