import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Tappable, Text } from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';

interface Props {
  active: boolean;
  /** 2 saniye basılı tutulunca çağrılır */
  onTrigger: () => void;
  onResolve: () => void;
  size?: number;
}

/** Yanlışlıkla tetiklemeyi önlemek için basılı tutma gerektiren SOS düğmesi. */
export function SosButton({ active, onTrigger, onResolve, size = 140 }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useSharedValue(1);
  const progress = useSharedValue(0);

  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }],
    opacity: active ? 0.35 : 0.18,
  }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scale: progress.get() }] }));

  const startHold = () => {
    if (active) return;
    setHolding(true);
    haptics.medium();
    progress.set(withTiming(1, { duration: 2000, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      setHolding(false);
      progress.set(0);
      haptics.success();
      onTrigger();
    }, 2000);
  };
  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    progress.set(withTiming(0, { duration: 150 }));
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: size,
            backgroundColor: colors.danger,
          },
          haloStyle,
        ]}
      />
      <Tappable
        onPressIn={startHold}
        onPressOut={cancelHold}
        onPress={active ? onResolve : undefined}
        haptic="none"
        scaleTo={0.96}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: active ? colors.success : colors.danger,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={active ? t('firstAid.sosResolve') : t('firstAid.sos')}
        accessibilityHint={t('firstAid.sosHint')}
      >
        <Animated.View
          style={[styles.fill, { width: size, height: size, borderRadius: size / 2 }, fillStyle]}
        />
        <Icon
          name={active ? 'shield-check' : 'siren'}
          size={size * 0.26}
          color="#FFFFFF"
          strokeWidth={2.4}
        />
        <Text variant="h2" color="#FFFFFF" weight="extrabold">
          {active ? t('firstAid.sosActive') : holding ? '…' : t('firstAid.sos')}
        </Text>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  halo: { position: 'absolute' },
  button: { alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  fill: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.25)' },
});
