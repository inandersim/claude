import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/core/hooks/useHaptics';
import { layout, radius, shadows, spacing, useTheme } from '@/core/theme';

import { Icon, type IconName } from './ui/Icon';
import { Tappable } from './ui/Tappable';
import { Text } from './ui/Text';

export interface TabMeta {
  icon: IconName;
  label: string;
  badge?: number;
}

interface Props extends BottomTabBarProps {
  meta: Record<string, TabMeta>;
}

/**
 * Yüzen, bulanık arka planlı özel sekme çubuğu.
 * Aktif sekme yumuşak bir yay animasyonuyla vurgulanır; her geçişte hafif dokunsal geri bildirim verilir.
 */
export function AppTabBar({ state, descriptors, navigation, meta }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.md);

  return (
    <View style={[styles.wrap, { bottom }, { pointerEvents: 'box-none' }]}>
      <View
        style={[
          styles.bar,
          {
            borderColor: colors.tabBarBorder,
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.tabBar,
          },
          shadows.floating,
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key] ?? {};
          const tab: TabMeta = meta[route.name] ?? { icon: 'compass', label: route.name };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={tab.icon}
              label={tab.label}
              badge={tab.badge}
              onPress={onPress}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? tab.label}
              testID={options?.tabBarButtonTestID}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  focused: boolean;
  icon: IconName;
  label: string;
  badge?: number;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

function TabItem({
  focused,
  icon,
  label,
  badge,
  onPress,
  accessibilityLabel,
  testID,
}: TabItemProps) {
  const { colors } = useTheme();
  const progress = useDerivedValue(
    () => withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 }),
    [focused],
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.85 + progress.get() * 0.15 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() * 1.5 }],
  }));

  return (
    <Tappable
      onPress={onPress}
      haptic="none"
      scaleTo={0.9}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View style={[styles.pill, { backgroundColor: colors.primarySoft }, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Icon
          name={icon}
          size={22}
          color={focused ? colors.primary : colors.textSubtle}
          strokeWidth={focused ? 2.5 : 2}
        />
      </Animated.View>
      <Text
        variant="label"
        weight={focused ? 'extrabold' : 'semibold'}
        color={focused ? colors.primary : colors.textSubtle}
        numberOfLines={1}
      >
        {label}
      </Text>
      {badge && badge > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}
        >
          <Text
            variant="label"
            weight="extrabold"
            color="#FFFFFF"
            style={{ fontSize: 10, lineHeight: 12 }}
          >
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.tabBarHeight,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  pill: { position: 'absolute', top: 8, width: 48, height: 32, borderRadius: radius.full },
  badge: {
    position: 'absolute',
    top: 8,
    right: '22%',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
