import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/core/theme';

function Dot({ delay, color }: { delay: number; color: string }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 260 }),
          ),
          -1,
          false,
        ),
      ),
    );
  }, [delay, offset]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * offset.get() }],
    opacity: 0.45 + 0.55 * offset.get(),
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animated]} />;
}

/** Asistan yanıt üretirken gösterilen üç nokta animasyonu. */
export function TypingDots({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={label} accessibilityRole="progressbar">
      <View
        style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Dot delay={0} color={colors.primary} />
        <Dot delay={150} color={colors.primary} />
        <Dot delay={300} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginVertical: 4 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
