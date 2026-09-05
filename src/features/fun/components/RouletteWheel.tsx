import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';

export interface RouletteWheelProps {
  size?: number;
  /** Null: boşta; değer verilince çark bu dilime dönüp durur */
  target: AdventureType | null;
  /** Çark her çevirmede yeniden dönsün diye artan sayaç */
  spinId: number;
  onSettled?: () => void;
}

const SLICES = ADVENTURE_TYPES.length;
const SLICE_DEG = 360 / SLICES;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
}

/** Reanimated ile dönen 8 dilimli macera çarkı. Dilimler tür renkleriyle boyanır. */
export function RouletteWheel({ size = 280, target, spinId, onSettled }: RouletteWheelProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const c = size / 2;
  const r = c - 6;

  useEffect(() => {
    if (!target) return;
    const index = ADVENTURE_TYPES.indexOf(target);
    // Dilim merkezi işaretçinin (üst) altına gelsin: 4 tam tur + hedef açısı
    const centerDeg = index * SLICE_DEG + SLICE_DEG / 2;
    const current = rotation.get() % 360;
    const destination = rotation.get() - current + 360 * 4 + (360 - centerDeg);
    rotation.set(
      withTiming(destination, { duration: 2800, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onSettled) runOnJS(onSettled)();
      }),
    );
  }, [target, spinId, rotation, onSettled]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <View
      style={{ width: size, height: size + 16, alignItems: 'center' }}
      accessibilityLabel={t('fun.a11y.wheel')}
    >
      <View style={[styles.pointer, { borderTopColor: colors.text }]} />
      <Animated.View style={[{ width: size, height: size }, animated]}>
        <Svg width={size} height={size}>
          <Circle
            cx={c}
            cy={c}
            r={r + 4}
            fill={colors.surface}
            stroke={colors.borderStrong}
            strokeWidth={2}
          />
          {ADVENTURE_TYPES.map((type, i) => (
            <Path
              key={type}
              d={slicePath(c, c, r, i * SLICE_DEG, (i + 1) * SLICE_DEG)}
              fill={ADVENTURE_TYPE_META[type].color}
              stroke={colors.surface}
              strokeWidth={2}
              opacity={target && target !== type ? 0.55 : 1}
            />
          ))}
          <Circle
            cx={c}
            cy={c}
            r={size * 0.11}
            fill={colors.surface}
            stroke={colors.borderStrong}
            strokeWidth={2}
          />
        </Svg>
        {ADVENTURE_TYPES.map((type, i) => {
          const p = polar(c, c, r * 0.66, i * SLICE_DEG + SLICE_DEG / 2);
          return (
            <View
              key={type}
              pointerEvents="none"
              style={[styles.icon, { left: p.x - 14, top: p.y - 14 }]}
            >
              <Icon
                name={ADVENTURE_TYPE_META[type].icon}
                size={20}
                color="#0B1410"
                strokeWidth={2.4}
              />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -6,
    zIndex: 2,
  },
  icon: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
