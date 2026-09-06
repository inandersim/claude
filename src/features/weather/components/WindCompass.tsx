import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { compassDirection } from '@/domain';

interface Props {
  /** Rüzgârın GELDİĞİ yön (derece, 0 = kuzey) */
  directionDeg: number;
  speedKmh: number;
  gustKmh?: number;
  size?: number;
}

/** SVG rüzgâr pusulası: ok rüzgârın estiği yöne (geldiği yönün tersi) bakar. */
export function WindCompass({ directionDeg, speedKmh, gustKmh, size = 150 }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const c = size / 2;
  const r = c - 12;
  const dir = compassDirection(directionDeg);
  const towards = (directionDeg + 180) % 360;
  const tint = speedKmh > 80 ? colors.danger : speedKmh > 50 ? colors.warning : colors.primary;

  const ticks = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const labels: { key: 'N' | 'E' | 'S' | 'W'; deg: number }[] = [
    { key: 'N', deg: 0 },
    { key: 'E', deg: 90 },
    { key: 'S', deg: 180 },
    { key: 'W', deg: 270 },
  ];
  const polar = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: c + radius * Math.cos(rad), y: c + radius * Math.sin(rad) };
  };
  const tip = polar(towards, r - 18);
  const tail = polar(directionDeg, r - 26);
  const wingL = polar(towards - 150, 14);
  const wingR = polar(towards + 150, 14);
  const arrowHead = `M ${tip.x} ${tip.y} L ${tip.x + (wingL.x - c)} ${tip.y + (wingL.y - c)} L ${tip.x + (wingR.x - c)} ${tip.y + (wingR.y - c)} Z`;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="image"
      accessibilityLabel={`${t('weather.windCompass')}: ${Math.round(speedKmh)} ${t('weather.units.kmh')} ${t('weather.windFrom', { dir: t(`weather.direction.${dir}`) })}`}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.border}
          strokeWidth={1.5}
          fill={colors.surfaceMuted}
        />
        <G>
          {ticks.map((deg) => {
            const major = deg % 90 === 0;
            const a = polar(deg, r);
            const b = polar(deg, r - (major ? 10 : 5));
            return (
              <Line
                key={deg}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={major ? colors.textMuted : colors.borderStrong}
                strokeWidth={major ? 2 : 1}
              />
            );
          })}
        </G>
        {labels.map((l) => {
          const p = polar(l.deg, r - 20);
          return (
            <SvgText
              key={l.key}
              x={p.x}
              y={p.y + 4}
              fontSize={11}
              fontWeight="700"
              fill={l.key === 'N' ? colors.danger : colors.textMuted}
              textAnchor="middle"
            >
              {t(`weather.direction.${l.key}`)}
            </SvgText>
          );
        })}
        <Line
          x1={tail.x}
          y1={tail.y}
          x2={tip.x}
          y2={tip.y}
          stroke={tint}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Path d={arrowHead} fill={tint} />
        <Circle cx={c} cy={c} r={22} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
        <SvgText
          x={c}
          y={c + 1}
          fontSize={13}
          fontWeight="800"
          fill={colors.text}
          textAnchor="middle"
        >
          {Math.round(speedKmh)}
        </SvgText>
        <SvgText x={c} y={c + 12} fontSize={8} fill={colors.textMuted} textAnchor="middle">
          {t('weather.units.kmh')}
        </SvgText>
      </Svg>
      <View style={{ gap: 2, flex: 1 }}>
        <Text variant="title">{t('weather.windCompass')}</Text>
        <Text variant="body" weight="bold" color={tint}>
          {t('weather.windFrom', { dir: t(`weather.direction.${dir}`) })} ·{' '}
          {Math.round(directionDeg)}°
        </Text>
        {gustKmh != null ? (
          <Text variant="caption" color="textMuted">
            {t('weather.gust')} {Math.round(gustKmh)} {t('weather.units.kmh')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
});
