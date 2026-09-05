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
  disabled?: boolean;
  size?: number;
}

const HOLD_MS = 2000;

/** Uydu SOS başlatma düğmesi: yanlışlıkla tetiklemeye karşı 2 sn basılı tutma ister. */
export function HoldSosButton({ active, onTrigger, disabled = false, size = 168 }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useSharedValue(1);
  const progress = useSharedValue(0);

  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [pulse]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }],
    opacity: active ? 0.32 : 0.16,
  }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scale: progress.get() }] }));

  const startHold = () => {
    if (active || disabled) return;
    setHolding(true);
    haptics.medium();
    progress.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      progress.set(0);
      haptics.success();
      onTrigger();
    }, HOLD_MS);
  };
  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    progress.set(withTiming(0, { duration: 150 }));
  };

  const bg = active ? colors.danger : disabled ? colors.textSubtle : colors.danger;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.halo,
          { width: size * 1.35, height: size * 1.35, borderRadius: size, backgroundColor: bg },
          haloStyle,
        ]}
      />
      <Tappable
        onPressIn={startHold}
        onPressOut={cancelHold}
        haptic="none"
        scaleTo={0.96}
        disabled={active || disabled}
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ]}
        accessibilityRole="button"
        accessibilityLabel={active ? t('satellite.sos.active') : t('satellite.sos.start')}
        accessibilityHint={t('satellite.sos.hold')}
        accessibilityState={{ disabled: active || disabled }}
      >
        <Animated.View
          style={[styles.fill, { width: size, height: size, borderRadius: size / 2 }, fillStyle]}
        />
        <Icon
          name={active ? 'satellite' : 'siren'}
          size={size * 0.24}
          color="#FFFFFF"
          strokeWidth={2.4}
        />
        <Text variant="h1" color="#FFFFFF" weight="extrabold">
          {active ? t('satellite.sos.active') : holding ? '…' : t('satellite.sos.start')}
        </Text>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  halo: { position: 'absolute' },
  button: { alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  fill: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.25)' },
});
