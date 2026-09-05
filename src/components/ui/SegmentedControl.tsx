import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/core/theme';

import { Tappable } from './Tappable';
import { Text } from './Text';

export interface Segment<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );
  const segmentWidth = width > 0 ? (width - 8) / segments.length : 0;
  const target = index * segmentWidth;
  const translate = useDerivedValue(
    () => withSpring(target, { damping: 20, stiffness: 240 }),
    [target],
  );

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: translate.get() }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      onLayout={onLayout}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
            indicator,
          ]}
        />
      ) : null}
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Tappable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            haptic="selection"
            scaleTo={1}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text variant="bodySm" weight="bold" color={active ? 'text' : 'textMuted'}>
              {segment.label}
            </Text>
            {segment.badge ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: active ? colors.primary : colors.borderStrong },
                ]}
              >
                <Text
                  variant="label"
                  weight="extrabold"
                  color={active ? colors.onPrimary : colors.text}
                >
                  {segment.badge}
                </Text>
              </View>
            ) : null}
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
