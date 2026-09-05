import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTheme } from '@/core/theme';
import type { GeoPoint } from '@/domain';

interface Props {
  path: GeoPoint[];
  color: string;
  height?: number;
}

/** Rota koordinatlarını basit bir çizgi haritası olarak çizer (harita SDK'sı gerektirmez). */
export function RoutePreview({ path, color, height = 120 }: Props) {
  const { colors } = useTheme();
  const [size, setSize] = React.useState({ width: 0, height });

  const points = React.useMemo(() => {
    if (path.length === 0 || size.width === 0) return [];
    const lats = path.map((p) => p.latitude);
    const lngs = path.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 16;
    const w = size.width - pad * 2;
    const h = size.height - pad * 2;
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    // En-boy oranını koru
    const scale = Math.min(w / spanLng, h / spanLat);
    const offsetX = (w - spanLng * scale) / 2;
    const offsetY = (h - spanLat * scale) / 2;
    return path.map((p) => ({
      x: pad + offsetX + (p.longitude - minLng) * scale,
      y: pad + offsetY + (maxLat - p.latitude) * scale,
    }));
  }, [path, size]);

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View
      style={[styles.root, { height, backgroundColor: colors.surfaceMuted }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height })}
    >
      {size.width > 0 ? (
        <Svg width={size.width} height={height}>
          <Defs>
            <SvgGradient id="grid" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.14" />
              <Stop offset="1" stopColor={color} stopOpacity="0.02" />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={height} fill="url(#grid)" />
          {[0.25, 0.5, 0.75].map((f) => (
            <Path
              key={`h${f}`}
              d={`M0 ${height * f} H${size.width}`}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 6"
            />
          ))}
          {d ? (
            <Path
              d={d}
              stroke={color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {first ? (
            <Circle
              cx={first.x}
              cy={first.y}
              r={5}
              fill={colors.surface}
              stroke={color}
              strokeWidth={3}
            />
          ) : null}
          {last ? (
            <Circle
              cx={last.x}
              cy={last.y}
              r={5}
              fill={color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },
});
