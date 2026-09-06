import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Tappable, Text } from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { REACTION_META, REACTION_TYPES, type ReactionType } from '@/domain';

interface Props {
  myReaction: ReactionType | null | undefined;
  /** Toplam tepki (likesCount) */
  total: number;
  onReact: (type: ReactionType | null) => void;
}

const AUTO_CLOSE_MS = 3500;

/**
 * Kısa basış: beğeni aç/kapa. Uzun basış: 5 tepkili balon seçici.
 * Seçici, kartın içinde çubuğun üstünde açılır; seçim ya da zaman aşımıyla kapanır.
 */
export function ReactionBar({ myReaction, total, onReact }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = myReaction ? REACTION_META[myReaction] : null;

  const close = useCallback(() => {
    progress.set(withTiming(0, { duration: 160 }));
    setOpen(false);
  }, [progress]);

  const openPicker = useCallback(() => {
    haptics.medium();
    setOpen(true);
    progress.set(withSpring(1, { damping: 14, stiffness: 220 }));
  }, [progress]);

  useEffect(() => {
    if (!open) return;
    timer.current = setTimeout(close, AUTO_CLOSE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, close]);

  const handlePress = () => {
    if (open) {
      close();
      return;
    }
    pulse.set(withSequence(withSpring(1.3, { damping: 6, stiffness: 400 }), withSpring(1)));
    haptics.light();
    onReact(myReaction ? null : 'like');
  };

  const select = (type: ReactionType) => {
    haptics.success();
    pulse.set(withSequence(withSpring(1.3, { damping: 6, stiffness: 400 }), withSpring(1)));
    onReact(type === myReaction ? null : type);
    close();
  };

  const balloonStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 12 }, { scale: 0.85 + progress.get() * 0.15 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  return (
    <View style={styles.root}>
      {open ? (
        <Animated.View
          style={[
            styles.balloon,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            balloonStyle,
          ]}
          accessibilityRole="menu"
          accessibilityLabel={t('social.reactionPicker')}
        >
          {REACTION_TYPES.map((type, index) => (
            <ReactionOption
              key={type}
              type={type}
              index={index}
              selected={myReaction === type}
              onSelect={select}
            />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View style={pulseStyle}>
        <Tappable
          onPress={handlePress}
          onLongPress={openPicker}
          delayLongPress={260}
          haptic="none"
          scaleTo={0.9}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={current ? t(current.labelKey) : t('social.react')}
          accessibilityHint={t('social.reactionPicker')}
        >
          <Icon
            name={current?.icon ?? 'heart'}
            size={22}
            color={current?.color ?? colors.text}
            fill={current ? current.color : 'none'}
            strokeWidth={2.2}
          />
          <Text variant="bodySm" weight="bold" color={current?.color ?? 'text'}>
            {formatCompact(total, locale)}
          </Text>
        </Tappable>
      </Animated.View>
    </View>
  );
}

function ReactionOption({
  type,
  index,
  selected,
  onSelect,
}: {
  type: ReactionType;
  index: number;
  selected: boolean;
  onSelect: (type: ReactionType) => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const meta = REACTION_META[type];
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.set(withDelay(index * 40, withSpring(1, { damping: 12, stiffness: 260 })));
  }, [enter, index]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ scale: enter.get() }],
  }));

  return (
    <Animated.View style={style}>
      <Tappable
        onPress={() => onSelect(type)}
        haptic="selection"
        scaleTo={0.85}
        style={[
          styles.option,
          { backgroundColor: selected ? `${meta.color}33` : colors.surfaceMuted },
        ]}
        accessibilityRole="menuitem"
        accessibilityLabel={t(meta.labelKey)}
        accessibilityState={{ selected }}
      >
        <Icon name={meta.icon} size={22} color={meta.color} fill={meta.color} strokeWidth={2} />
        <Text variant="label" weight="bold" color={meta.color}>
          {t(meta.labelKey)}
        </Text>
      </Tappable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', zIndex: 5 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingVertical: 4 },
  balloon: {
    position: 'absolute',
    bottom: '100%',
    left: -spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  option: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
});
