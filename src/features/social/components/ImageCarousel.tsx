import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { AdventureType } from '@/domain';

interface Props {
  images: string[];
  adventureType: AdventureType;
  /** Tek dokunuş (ör. detayı aç) */
  onPress?: () => void;
  /** Çift dokunuş (ör. beğen) — kalp animasyonu oynatılır */
  onDoubleTap?: () => void;
  aspectRatio?: number;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

const DOUBLE_TAP_MS = 280;

/** Yatay sayfalı fotoğraf kaydırıcı: nokta göstergesi, sayaç ve çift dokunuşla kalp. */
export function ImageCarousel({
  images,
  adventureType,
  onPress,
  onDoubleTap,
  aspectRatio = 4 / 3,
  accessibilityLabel,
  children,
}: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const heart = useSharedValue(0);
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.get(),
    transform: [{ scale: heart.get() }],
  }));

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (single.current) clearTimeout(single.current);
      if (onDoubleTap) {
        onDoubleTap();
        haptics.medium();
        setShowHeart(true);
        heart.set(withSequence(withSpring(1, { damping: 8 }), withSpring(0, { damping: 14 })));
        setTimeout(() => setShowHeart(false), 700);
      }
      return;
    }
    lastTap.current = now;
    single.current = setTimeout(() => {
      if (lastTap.current === now) {
        lastTap.current = 0;
        onPress?.();
      }
    }, DOUBLE_TAP_MS + 10);
  }, [heart, onDoubleTap, onPress]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const sources = images.length > 0 ? images : [null];

  return (
    <View
      style={[styles.root, { aspectRatio }]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 ? (
        <FlatList
          data={sources}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${uri ?? 'empty'}-${i}`}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={sources.length > 1}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <Tappable
              onPress={handleTap}
              haptic="none"
              scaleTo={0.995}
              style={{ width, height: '100%' }}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${accessibilityLabel ?? ''} ${i + 1}/${sources.length}`.trim()}
            >
              <AdventureImage
                uri={item}
                adventureType={adventureType}
                style={styles.image}
                overlay={Boolean(children)}
              >
                {i === index ? children : null}
              </AdventureImage>
            </Tappable>
          )}
        />
      ) : null}

      {sources.length > 1 ? (
        <>
          <View style={styles.counter}>
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {index + 1}/{sources.length}
            </Text>
          </View>
          <View style={[styles.dots, { pointerEvents: 'none' }]}>
            {sources.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? colors.primary : 'rgba(255,255,255,0.55)',
                    width: i === index ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
          <View
            style={styles.photosBadge}
            accessibilityLabel={t('social.photosCount', { count: sources.length })}
          >
            <Icon name="layers" size={12} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </>
      ) : null}

      {showHeart ? (
        <Animated.View style={[styles.heart, heartStyle, { pointerEvents: 'none' }]}>
          <Icon name="heart" size={88} color="#FFFFFF" fill="#FF6B6B" strokeWidth={1.5} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%', borderRadius: 0 },
  counter: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  photosBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm + 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { height: 6, borderRadius: 3 },
  heart: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
