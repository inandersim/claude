import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, formatDistance, type FeedPost } from '@/domain';

import { DifficultyBadge } from '@/features/feed/components/DifficultyBadge';

export function RecentAdventureRow({ post }: { post: FeedPost }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const meta = ADVENTURE_TYPE_META[post.adventureType];

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      scaleTo={0.98}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <AdventureImage uri={post.imageUrl} adventureType={post.adventureType} style={styles.thumb} kucuk />
      <View style={styles.info}>
        <View style={styles.top}>
          <View style={[styles.typeChip, { backgroundColor: meta.softColor }]}>
            <Icon name={meta.icon} size={11} color={meta.color} strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color={meta.color}>
              {t(meta.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          <Text variant="caption" color="textSubtle">
            {formatRelative(post.createdAt, new Date(), locale)}
          </Text>
        </View>
        <Text variant="title" numberOfLines={1}>
          {post.locationName}
        </Text>
        <Text variant="bodySm" color="textMuted" numberOfLines={1}>
          {post.author.displayName} · {formatDistance(post.distanceKm, locale)} · {post.altitudeM} m
        </Text>
        <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
          <DifficultyBadge grade={post.difficulty} />
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 96, height: 108, borderRadius: radius.md },
  info: { flex: 1, gap: 2, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 20,
    borderRadius: radius.full,
  },
});
