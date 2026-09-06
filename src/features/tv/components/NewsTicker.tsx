import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { newsCategoryMeta, newsSeverityMeta, type NewsItem } from '@/domain';

interface Props {
  news: NewsItem[];
  /** Otomatik geçiş aralığı (ms) */
  intervalMs?: number;
}

/**
 * Haber şeridi: her `intervalMs`'de bir sonraki habere kayarak geçer (Reanimated).
 * Dokununca gösterilen haberin detayı açılır.
 */
export function NewsTicker({ news, intervalMs = 5_000 }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);

  const count = news.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(timer);
  }, [count, intervalMs]);

  useEffect(() => {
    // Yeni haber: aşağıdan yukarı kayarak belirir.
    offset.set(
      withSequence(
        withTiming(14, { duration: 0 }),
        withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }),
      ),
    );
    opacity.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 320 })));
  }, [index, offset, opacity]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
    opacity: opacity.get(),
  }));

  const item = news[Math.min(index, Math.max(0, count - 1))];
  if (!item) return null;
  const category = newsCategoryMeta[item.category];
  const severity = newsSeverityMeta[item.severity];

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/tv/news/[id]', params: { id: item.id } })}
      scaleTo={0.985}
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${t('tv.news.ticker')}: ${item.title}`}
    >
      <View style={[styles.bar, { backgroundColor: severity.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: `${category.color}22` }]}>
        <Icon name={category.icon} size={16} color={category.color} strokeWidth={2.4} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.labelRow}>
          <Text variant="label" weight="extrabold" color={severity.color}>
            {t(severity.labelKey).toLocaleUpperCase(locale)}
          </Text>
          <Text variant="label" color="textSubtle">
            · {t(category.labelKey)} · {item.region}
          </Text>
        </View>
        <Animated.View style={animated}>
          <Text variant="bodySm" weight="bold" numberOfLines={1}>
            {item.title}
          </Text>
        </Animated.View>
      </View>
      {count > 1 ? (
        <Text variant="label" color="textSubtle">
          {index + 1}/{count}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={16} color={colors.textSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  textWrap: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
});
