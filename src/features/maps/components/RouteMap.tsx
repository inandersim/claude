import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import type { ID, TrailGraph, TrailNode } from '@/domain';

import { SURFACE_COLOR } from './meta';

interface Props {
  graph: TrailGraph;
  /** Planlanan rotanın düğüm sırası */
  routeNodeIds?: ID[];
  startId?: ID | null;
  endId?: ID | null;
  onNodePress?: (node: TrailNode) => void;
  height?: number;
  /** Düğüm adlarını göster */
  showLabels?: boolean;
}

interface Projected {
  x: number;
  y: number;
}

const PAD = 22;

/**
 * Patika grafını basit Mercator benzeri projeksiyonla (bbox → viewBox) çizer.
 * Düğümlere dokunarak başlangıç/bitiş seçilir; rota kalın primary çizgiyle vurgulanır.
 */
export function RouteMap({
  graph,
  routeNodeIds = [],
  startId = null,
  endId = null,
  onNodePress,
  height = 320,
  showLabels = true,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);

  const projected = useMemo(() => {
    const map = new Map<ID, Projected>();
    if (width === 0 || graph.nodes.length === 0) return map;
    const lats = graph.nodes.map((n) => n.coords.latitude);
    const lngs = graph.nodes.map((n) => n.coords.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    // Orta enlemde boylam sıkışması (Mercator benzeri) — en-boy oranı korunur
    const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLng - minLng) * cosLat || 0.001;
    const spanY = maxLat - minLat || 0.001;
    const innerW = width - PAD * 2;
    const innerH = height - PAD * 2;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    const offsetX = (innerW - spanX * scale) / 2;
    const offsetY = (innerH - spanY * scale) / 2;
    for (const n of graph.nodes) {
      map.set(n.id, {
        x: PAD + offsetX + (n.coords.longitude - minLng) * cosLat * scale,
        y: PAD + offsetY + (maxLat - n.coords.latitude) * scale,
      });
    }
    return map;
  }, [graph, width, height]);

  const routeSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 1; i < routeNodeIds.length; i++) {
      set.add(`${routeNodeIds[i - 1]}|${routeNodeIds[i]}`);
      set.add(`${routeNodeIds[i]}|${routeNodeIds[i - 1]}`);
    }
    return set;
  }, [routeNodeIds]);

  const routePoints = routeNodeIds
    .map((id) => projected.get(id))
    .filter((p): p is Projected => Boolean(p))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const gridLines = [0.25, 0.5, 0.75];
  const labelFill = isDark ? '#E4EEE8' : '#22302A';
  const haloFill = isDark ? '#0B1210' : '#FFFFFF';

  return (
    <View
      style={[
        styles.root,
        { height, backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={t('maps.mapOf', { name: graph.regionId })}
    >
      {width > 0 ? (
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

          {/* Kenarlar: yüzey rengi, teknik bölümler kesikli */}
          {graph.edges.map((e) => {
            const a = projected.get(e.from);
            const b = projected.get(e.to);
            if (!a || !b) return null;
            const onRoute = routeSet.has(`${e.from}|${e.to}`);
            return (
              <Line
                key={e.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={SURFACE_COLOR[e.surface]}
                strokeOpacity={onRoute ? 0.35 : 0.8}
                strokeWidth={onRoute ? 2 : 2.5}
                strokeLinecap="round"
                strokeDasharray={e.technical > 0.6 ? '5 5' : undefined}
              />
            );
          })}

          {/* Planlanan rota */}
          {routePoints ? (
            <>
              <Polyline
                points={routePoints}
                fill="none"
                stroke={haloFill}
                strokeWidth={8}
                strokeOpacity={0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={routePoints}
                fill="none"
                stroke={colors.primary}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {/* Düğümler */}
          {graph.nodes.map((n) => {
            const p = projected.get(n.id);
            if (!p) return null;
            const isStart = n.id === startId;
            const isEnd = n.id === endId;
            const onRoute = routeNodeIds.includes(n.id);
            const r = isStart || isEnd ? 9 : onRoute ? 5.5 : 5;
            const fill = isStart
              ? colors.success
              : isEnd
                ? colors.danger
                : onRoute
                  ? colors.primary
                  : colors.surface;
            return (
              <G key={n.id}>
                {/* Dokunma alanı: görünmez daha büyük daire */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  fill={colors.primary}
                  fillOpacity={0.001}
                  onPress={onNodePress ? () => onNodePress(n) : undefined}
                />
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={fill}
                  stroke={isStart || isEnd ? haloFill : colors.borderStrong}
                  strokeWidth={isStart || isEnd ? 3 : 1.5}
                  onPress={onNodePress ? () => onNodePress(n) : undefined}
                />
                {isStart || isEnd ? (
                  <SvgText
                    x={p.x}
                    y={p.y + 3.5}
                    fontSize={9}
                    fontWeight="bold"
                    fill={haloFill}
                    textAnchor="middle"
                  >
                    {isStart ? 'A' : 'B'}
                  </SvgText>
                ) : null}
                {showLabels && n.name ? (
                  <SvgText
                    x={p.x + r + 4}
                    y={p.y + 3.5}
                    fontSize={9.5}
                    fill={labelFill}
                    opacity={onRoute || isStart || isEnd ? 1 : 0.72}
                  >
                    {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
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
});
