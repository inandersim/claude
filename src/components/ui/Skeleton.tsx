import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, useTheme } from '@/core/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Yumuşak nabız animasyonlu yer tutucu. */
export function Skeleton({ width = '100%', height = 16, round = false, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.set(
      withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: round ? height / 2 : radius.sm,
          backgroundColor: colors.skeleton,
        },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { gap: 10 },
});
