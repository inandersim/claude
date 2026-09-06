import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';

export function LiveBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { t } = useT();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={[styles.badge, size === 'sm' && styles.small]}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text variant="label" weight="extrabold" color="#FFFFFF">
        {t('live.liveNow').toLocaleUpperCase(currentLocale())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: '#E5484D',
  },
  small: { height: 20, paddingHorizontal: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
