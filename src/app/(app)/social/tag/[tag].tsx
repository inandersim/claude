import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Header, Icon, Screen, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { normalizeHashtag, reactionSummary, type FeedPost } from '@/domain';
import { PostCard } from '@/features/feed/components/PostCard';
import { PostCardSkeleton } from '@/features/feed/components/PostCardSkeleton';
import { usePostsByHashtag, useTrendingHashtags } from '@/features/social/hooks';
import { usePostCardActions } from '@/features/social/usePostCardActions';

export default function HashtagScreen() {
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  const tag = normalizeHashtag(raw ?? '');
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const posts = usePostsByHashtag(tag);
  const trending = useTrendingHashtags(20);
  const actions = usePostCardActions();

  const summary = trending.data?.find((h) => h.tag === tag);
  const totalReactions = useMemo(
    () =>
      (posts.data ?? []).reduce(
        (sum, p) => sum + Math.max(p.likesCount, reactionSummary(p.reactionCounts).total),
        0,
      ),
    [posts.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <View style={styles.item}>
        <PostCard
          post={item}
          onReact={actions.onReact}
          onToggleSave={actions.onToggleSave}
          onSaveLongPress={actions.onSaveLongPress}
          onRepost={actions.onRepost}
          onDelete={actions.onDelete}
        />
      </View>
    ),
    [actions],
  );

  const header = (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name="tag" size={24} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h2">#{tag}</Text>
        <Text variant="caption" color="textMuted">
          {t('social.hashtagPosts', { count: posts.data?.length ?? summary?.count ?? 0 })} ·{' '}
          {t('social.reactionsCount', { count: formatCompact(totalReactions, locale) })}
        </Text>
      </View>
      {summary?.trending ? (
        <View style={[styles.trendPill, { backgroundColor: colors.successSoft }]}>
          <Icon name="trending-up" size={12} color={colors.success} strokeWidth={2.6} />
          <Text variant="label" weight="bold" color="success">
            {t('social.trendingBadge')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top']}>
      <Header title={t('social.hashtag')} showBack />
      {posts.isError ? (
        <ErrorState onRetry={() => posts.refetch()} />
      ) : (
        <FlashList
          data={posts.isLoading ? [] : (posts.data ?? [])}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={<View style={styles.item}>{header}</View>}
          ListEmptyComponent={
            posts.isLoading ? (
              <View style={styles.skeletons}>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </View>
            ) : (
              <EmptyState
                icon="tag"
                title={t('social.emptyTag')}
                description={t('social.emptyTagDescription')}
                action={{
                  label: t('social.compose.status'),
                  onPress: () => router.push('/post/status'),
                  icon: 'plus',
                }}
              />
            )
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={posts.isRefetching && !posts.isLoading}
              onRefresh={() => posts.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      {actions.sheets}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
