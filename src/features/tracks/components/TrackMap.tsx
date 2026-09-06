import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import type { GeoPoint, TrackPoi, TrackPoint } from '@/domain';

import { POI_COLOR, POI_ICON } from './meta';

interface Props {
  points: TrackPoint[];
  pois?: TrackPoi[];
  /** Mevcut konum (navigasyon / kayıt) */
  position?: GeoPoint | null;
  /** Ek vurgulu nokta (ör. sonraki adım) */
  highlight?: GeoPoint | null;
  onPoiPress?: (poi: TrackPoi) => void;
  height?: number;
  name?: string;
  /** Çizgi rengi (varsayılan primary) */
  strokeColor?: string;
  /** Konum rotadan çıktıysa kırmızı vurgu */
  offRoute?: boolean;
}

interface Projected {
  x: number;
  y: number;
}

const PAD = 18;
const HIT = 32;

/**
 * Parça çizgisi + POI ikonları + mevcut konum. bbox → viewBox projeksiyonu (Mercator benzeri).
 * SVG içinde onPress yok; POI dokunma alanları üstte mutlak konumlu Pressable'lardır.
 */
export function TrackMap({
  points,
  pois = [],
  position = null,
  highlight = null,
  onPoiPress,
  height = 280,
  name,
  strokeColor,
  offRoute = false,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);

  const project = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const all: GeoPoint[] = [...points, ...pois.map((p) => p.coords)];
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
    const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLng - minLng) * cosLat || 0.0005;
    const spanY = maxLat - minLat || 0.0005;
    const innerW = width - PAD * 2;
    const innerH = height - PAD * 2;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    const offsetX = (innerW - spanX * scale) / 2;
    const offsetY = (innerH - spanY * scale) / 2;
    return (p: GeoPoint): Projected => ({
      x: PAD + offsetX + (p.longitude - minLng) * cosLat * scale,
      y: PAD + offsetY + (maxLat - p.latitude) * scale,
    });
  }, [width, height, points, pois, position]);

  const linePoints = useMemo(() => {
    if (!project) return '';
    return points
      .map((p) => {
        const q = project(p);
        return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      })
      .join(' ');
  }, [project, points]);

  const halo = isDark ? '#0B1210' : '#FFFFFF';
  const line = strokeColor ?? colors.primary;
  const start = project && points[0] ? project(points[0]) : null;
  const end = project && points.length > 1 ? project(points[points.length - 1]!) : null;
  const pos = project && position ? project(position) : null;
  const hl = project && highlight ? project(highlight) : null;
  const gridLines = [0.25, 0.5, 0.75];

  return (
    <View
      style={[
        styles.root,
        { height, backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={t('tracks.mapOf', { name: name ?? '' })}
    >
      {width > 0 && project ? (
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill={colors.surfaceMuted} />
          {gridLines.map((f) => (
            <G key={f}>
              <Line
                x1={0}
                y1={height * f}
                x2={width}
                y2={height * f}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 7"
              />
              <Line
                x1={width * f}
                y1={0}
                x2={width * f}
                y2={height}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 7"
              />
            </G>
          ))}
          {linePoints ? (
            <>
              <Polyline
                points={linePoints}
                fill="none"
                stroke={halo}
                strokeWidth={7}
                strokeOpacity={0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={linePoints}
                fill="none"
                stroke={line}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}
          {start ? (
            <Circle
              cx={start.x}
              cy={start.y}
              r={6}
              fill={colors.success}
              stroke={halo}
              strokeWidth={2.5}
            />
          ) : null}
          {end ? (
            <Circle
              cx={end.x}
              cy={end.y}
              r={6}
              fill={colors.danger}
              stroke={halo}
              strokeWidth={2.5}
            />
          ) : null}
          {pois.map((poi) => {
            const q = project(poi.coords);
            return (
              <Circle
                key={poi.id}
                cx={q.x}
                cy={q.y}
                r={10}
                fill={POI_COLOR[poi.kind]}
                stroke={halo}
                strokeWidth={2}
              />
            );
          })}
          {hl ? (
            <Circle
              cx={hl.x}
              cy={hl.y}
              r={9}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2.5}
            />
          ) : null}
          {pos ? (
            <G>
              <Circle
                cx={pos.x}
                cy={pos.y}
                r={14}
                fill={offRoute ? colors.danger : colors.info}
                fillOpacity={0.25}
              />
              <Circle
                cx={pos.x}
                cy={pos.y}
                r={6.5}
                fill={offRoute ? colors.danger : colors.info}
                stroke={halo}
                strokeWidth={2.5}
              />
            </G>
          ) : null}
        </Svg>
      ) : null}
      {/* POI ikonları: SVG üstünde mutlak konumlu görünümler (dokunma web uyumlu) */}
      {width > 0 && project
        ? pois.map((poi) => {
            const q = project(poi.coords);
            const content = (
              <View style={styles.poiIcon}>
                <Icon
                  name={POI_ICON[poi.kind]}
                  size={12}
                  color={isDark ? '#06120B' : '#FFFFFF'}
                  strokeWidth={2.6}
                />
              </View>
            );
            return onPoiPress ? (
              <Pressable
                key={poi.id}
                onPress={() => onPoiPress(poi)}
                style={[styles.hit, { left: q.x - HIT / 2, top: q.y - HIT / 2 }]}
                accessibilityRole="button"
                accessibilityLabel={poi.name}
                hitSlop={4}
              >
                {content}
              </Pressable>
            ) : (
              <View
                key={poi.id}
                style={[styles.hit, styles.inert, { left: q.x - HIT / 2, top: q.y - HIT / 2 }]}
              >
                {content}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiIcon: { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  inert: { pointerEvents: 'none' },
});
