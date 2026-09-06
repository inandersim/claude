import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import type { HashtagSummary } from '@/domain';

interface Props {
  tag: string;
  count?: number;
  trending?: boolean;
  selected?: boolean;
  /** Verilirse rota yerine bu çağrılır (ör. composer'a ekleme) */
  onPress?: (tag: string) => void;
  size?: 'sm' | 'md';
}

/** #etiket çipi; varsayılan olarak etiket akışına gider. */
export function HashtagChip({ tag, count, trending, selected, onPress, size = 'md' }: Props) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, locale } = useT();
  const fg = selected ? (isDark ? '#06120B' : '#FFFFFF') : colors.text;

  const handle = () => {
    if (onPress) return onPress(tag);
    router.push({ pathname: '/social/tag/[tag]', params: { tag } });
  };

  return (
    <Tappable
      onPress={handle}
      haptic="selection"
      scaleTo={0.94}
      style={[
        styles.chip,
        size === 'sm' && styles.chipSm,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceMuted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`#${tag}`}
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text variant={size === 'sm' ? 'caption' : 'bodySm'} weight="bold" color={fg}>
        #{tag}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" weight="bold" color={selected ? fg : 'textMuted'}>
          {formatCompact(count, locale)}
        </Text>
      ) : null}
      {trending ? (
        <View accessibilityLabel={t('social.trendingBadge')}>
          <Icon
            name="trending-up"
            size={12}
            color={selected ? fg : colors.primary}
            strokeWidth={2.6}
          />
        </View>
      ) : null}
    </Tappable>
  );
}

/** Yatay trend şeridi için kısayol. */
export function HashtagStrip({
  tags,
  onPress,
  selected,
}: {
  tags: HashtagSummary[];
  onPress?: (tag: string) => void;
  selected?: string | null;
}) {
  return (
    <View style={styles.strip}>
      {tags.map((h) => (
        <HashtagChip
          key={h.tag}
          tag={h.tag}
          count={h.count}
          trending={h.trending}
          selected={selected === h.tag}
          onPress={onPress}
          size="sm"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipSm: { height: 30, paddingHorizontal: spacing.sm + 2 },
  strip: { flexDirection: 'row', gap: spacing.sm },
});
