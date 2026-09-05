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

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

export interface StreakFlameProps {
  days: number;
  size?: 'sm' | 'md';
}

/** Hafifçe "nefes alan" alev; seri yoksa sönük. */
export function StreakFlame({ days, size = 'md' }: StreakFlameProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const active = days > 0;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      scale.set(1);
      return;
    }
    scale.set(
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.96, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [active, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const tint = active ? colors.warning : colors.textSubtle;
  const iconSize = size === 'sm' ? 18 : 26;

  return (
    <View
      style={[
        styles.root,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: active ? colors.warningSoft : colors.surfaceMuted },
      ]}
      accessibilityLabel={active ? t('fun.streak.active', { count: days }) : t('fun.streak.none')}
    >
      <Animated.View style={animated}>
        <Icon
          name="flame"
          size={iconSize}
          color={tint}
          strokeWidth={2.2}
          fill={active ? tint : 'none'}
        />
      </Animated.View>
      <Text variant={size === 'sm' ? 'caption' : 'title'} weight="extrabold" color={tint}>
        {days}
      </Text>
      {size === 'md' ? (
        <Text variant="caption" color="textMuted">
          {t('fun.streak.title')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  sm: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 2, minWidth: 44 },
  md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xxs,
    minWidth: 72,
  },
});
