import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore, type ToastKind } from '@/core/hooks/useToast';
import { radius, shadows, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const icons: Record<ToastKind, IconName> = {
  success: 'circle-check',
  error: 'circle-alert',
  info: 'info',
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + spacing.sm }, { pointerEvents: 'none' }]}>
      {toasts.map((toast) => {
        const tint = { success: colors.success, error: colors.danger, info: colors.info }[
          toast.kind
        ];
        return (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.springify().damping(18)}
            exiting={FadeOutUp.duration(180)}
            style={[
              styles.toast,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              shadows.floating,
            ]}
          >
            <Icon name={icons[toast.kind]} size={18} color={tint} strokeWidth={2.4} />
            <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>
              {toast.message}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
