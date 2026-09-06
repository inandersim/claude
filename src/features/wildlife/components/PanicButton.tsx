import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';

export interface PanicButtonProps {
  active: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
  /** Çalarken gösterilen süre etiketi */
  label?: string;
}

const SIZE = 196;

/** Dev kırmızı daire; aktifken Reanimated nabız halkası. */
export function PanicButton({
  active,
  onPress,
  onPressIn,
  disabled = false,
  label,
}: PanicButtonProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      pulse.set(withTiming(0, { duration: 200 }));
    }
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.45 * pulse.get() }],
    opacity: active ? 0.55 * (1 - pulse.get()) : 0,
  }));
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: active ? 1 + 0.04 * pulse.get() : 1 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { backgroundColor: colors.danger }, ring]}
      />
      <Animated.View style={core}>
        <Tappable
          onPress={onPress}
          onPressIn={onPressIn}
          disabled={disabled}
          scaleTo={0.94}
          haptic="medium"
          style={[
            styles.core,
            {
              backgroundColor: active ? '#B3261E' : colors.danger,
              borderColor: 'rgba(255,255,255,0.35)',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={active ? t('wildlife.panic.stop') : t('wildlife.panic.start')}
          accessibilityState={{ disabled, selected: active }}
        >
          <Icon name={active ? 'square' : 'siren'} size={44} color="#FFFFFF" strokeWidth={2.4} />
          <Text variant="h2" color="#FFFFFF" weight="extrabold">
            {active ? t('wildlife.panic.stop') : t('wildlife.panic.start')}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.85)">
            {label ?? t('wildlife.panic.hold')}
          </Text>
        </Tappable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    height: SIZE + 80,
  },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  core: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
