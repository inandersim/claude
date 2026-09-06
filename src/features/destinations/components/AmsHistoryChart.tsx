import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { sortAmsChecks, type AmsCheck } from '@/domain';

import { amsSeverityColor } from './meta';

interface Props {
  checks: AmsCheck[];
  height?: number;
}

const PAD_L = 26;
const PAD_R = 40;
const PAD_T = 14;
const PAD_B = 22;
const MAX_SCORE = 12;

/**
 * İki eksenli çizgi grafiği: skor (sol, 0–12, şiddet renkli noktalar) ve irtifa (sağ, kesikli).
 */
export function AmsHistoryChart({ checks, height = 170 }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [width, setWidth] = useState(0);
  const sorted = sortAmsChecks(checks);
  const n = sorted.length;
  const innerW = Math.max(1, width - PAD_L - PAD_R);
  const innerH = height - PAD_T - PAD_B;
  const elevs = sorted.map((c) => c.elevationM);
  const minE = n ? Math.min(...elevs) : 0;
  const maxE = n ? Math.max(...elevs) : 1;
  const spanE = Math.max(1, maxE - minE);

  const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yScore = (s: number) => PAD_T + innerH - (Math.min(MAX_SCORE, s) / MAX_SCORE) * innerH;
  const yElev = (e: number) => PAD_T + innerH - ((e - minE) / spanE) * innerH;

  const scoreLine = sorted.map((c, i) => `${x(i)},${yScore(c.score)}`).join(' ');
  const elevLine = sorted.map((c, i) => `${x(i)},${yElev(c.elevationM)}`).join(' ');

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityLabel={`${t('destinations.ams.history')}: ${n}`}
    >
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text variant="caption" color="textMuted">
            {t('destinations.ams.chartScore')} (0–12)
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.dashed, { borderColor: colors.accent }]} />
          <Text variant="caption" color="textMuted">
            {t('destinations.ams.chartElevation')}
          </Text>
        </View>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && n > 0 ? (
          <Svg width={width} height={height}>
            {[0, 3, 6, 10].map((s) => (
              <Line
                key={s}
                x1={PAD_L}
                x2={width - PAD_R}
                y1={yScore(s)}
                y2={yScore(s)}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray={s === 0 ? undefined : '3 4'}
              />
            ))}
            {[0, 3, 6, 10].map((s) => (
              <SvgText
                key={`l${s}`}
                x={PAD_L - 6}
                y={yScore(s) + 3.5}
                fontSize={9}
                fill={colors.textSubtle}
                textAnchor="end"
              >
                {s}
              </SvgText>
            ))}
            <SvgText x={width - PAD_R + 6} y={yElev(maxE) + 3.5} fontSize={9} fill={colors.accent}>
              {formatAltitude(maxE, locale)}
            </SvgText>
            <SvgText x={width - PAD_R + 6} y={yElev(minE) + 3.5} fontSize={9} fill={colors.accent}>
              {formatAltitude(minE, locale)}
            </SvgText>
            {n > 1 ? (
              <Polyline
                points={elevLine}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            ) : null}
            {n > 1 ? (
              <Polyline
                points={scoreLine}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {sorted.map((c, i) => (
              <Circle
                key={c.id}
                cx={x(i)}
                cy={yScore(c.score)}
                r={5}
                fill={amsSeverityColor(c.severity, colors)}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ))}
            {sorted.map((c, i) => (
              <SvgText
                key={`d${c.id}`}
                x={x(i)}
                y={height - 6}
                fontSize={9}
                fill={colors.textSubtle}
                textAnchor="middle"
              >
                {formatDate(c.createdAt, locale, 'd MMM')}
              </SvgText>
            ))}
          </Svg>
        ) : null}
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
  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 4, borderRadius: 2 },
  dashed: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', height: 0 },
});
