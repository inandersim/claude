import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import { GRADE_BUCKETS, type GradeBucket } from '@/domain';

export interface GradeHistogramProps {
  histogram: Record<GradeBucket, number>;
  height?: number;
}

const BUCKET_COLORS: Record<GradeBucket, string> = {
  beginner: '#22C55E',
  intermediate: '#EAB308',
  advanced: '#EF4444',
  elite: '#A855F7',
};

/** Kova bazlı derece histogramı (SVG çubuklar). */
export function GradeHistogram({ histogram, height = 120 }: GradeHistogramProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...GRADE_BUCKETS.map((b) => histogram[b]));
  const total = GRADE_BUCKETS.reduce((sum, b) => sum + histogram[b], 0);
  const gap = spacing.md;
  const barW = width > 0 ? (width - gap * (GRADE_BUCKETS.length - 1)) / GRADE_BUCKETS.length : 0;
  const labelH = 18;
  const chartH = height - labelH;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={GRADE_BUCKETS.map(
        (b) => `${t(`climbing.bucket.${b}`)}: ${histogram[b]}`,
      ).join(', ')}
    >
      <View style={styles.head}>
        <Text variant="title">{t('climbing.gradeDistribution')}</Text>
        <Text variant="caption" color="textSubtle">
          {t('climbing.routesCount', { count: total })}
        </Text>
      </View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {GRADE_BUCKETS.map((bucket, i) => {
              const value = histogram[bucket];
              const barH = Math.max(value > 0 ? 6 : 2, (value / max) * (chartH - 18));
              const x = i * (barW + gap);
              const y = chartH - barH;
              return (
                <React.Fragment key={bucket}>
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={6}
                    fill={value > 0 ? BUCKET_COLORS[bucket] : colors.surfaceMuted}
                  />
                  <SvgText
                    x={x + barW / 2}
                    y={y - 5}
                    fontSize={12}
                    fontFamily={fontFamily.bold}
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    {value}
                  </SvgText>
                  <SvgText
                    x={x + barW / 2}
                    y={height - 3}
                    fontSize={10}
                    fontFamily={fontFamily.semibold}
                    fill={colors.textSubtle}
                    textAnchor="middle"
                  >
                    {t(`climbing.bucket.${bucket}`)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
