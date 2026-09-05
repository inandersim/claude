import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/core/hooks/useHaptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TappableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Basıldığında küçülme oranı */
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'selection' | 'none';
  children?: React.ReactNode;
}

/** Basıldığında hafifçe küçülen, dokunsal geri bildirim veren Pressable. */
export function Tappable({
  style,
  scaleTo = 0.97,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...rest
}: TappableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, { damping: 18, stiffness: 320 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 16, stiffness: 260 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') haptics[haptic]();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
