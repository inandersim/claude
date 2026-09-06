import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { popularPosts, type FeedPost, type User } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { PostCard } from '@/features/feed/components/PostCard';
import { PostCardSkeleton } from '@/features/feed/components/PostCardSkeleton';
import { useIsFollowing, useToggleFollow } from '@/features/profile/hooks';
import { CollectionCard } from '@/features/social/components/CollectionCard';
import { HashtagChip } from '@/features/social/components/HashtagChip';
import {
  useCollections,
  useSocialFeed,
  useTrendingHashtags,
  useUserSearch,
} from '@/features/social/hooks';
import { usePostCardActions } from '@/features/social/usePostCardActions';

export default function CommunityScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const me = useCurrentUser();
  const trending = useTrendingHashtags(12);
  const feed = useSocialFeed({ tab: 'all' });
  const people = useUserSearch('', true);
  const collections = useCollections();
  const actions = usePostCardActions();

  const popular = useMemo(() => popularPosts(feed.data ?? [], 4), [feed.data]);
  const postCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of feed.data ?? []) map.set(p.authorId, (map.get(p.authorId) ?? 0) + 1);
    return map;
  }, [feed.data]);
  const suggested = useMemo(
    () =>
      (people.data ?? [])
        .filter((u) => u.id !== me.id)
        .sort((a, b) => (postCount.get(b.id) ?? 0) - (postCount.get(a.id) ?? 0)),
    [people.data, me.id, postCount],
  );
  const cardWidth = Math.min(200, width * 0.5);

  return (
    <Screen scroll edges={['top']} contentStyle={styles.content}>
      <Header
        title={t('social.community')}
        subtitle={t('social.communityHint')}
        showBack
        right={
          <IconButton
            icon="bookmark"
            onPress={() => router.push('/social/saved')}
            accessibilityLabel={t('social.savedTab')}
          />
        }
      />

      {/* Trend etiketler */}
      <View style={styles.section}>
        <SectionHeader title={t('social.trending')} />
        {trending.isLoading ? (
          <View style={styles.chipsRow}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={90} height={30} style={{ borderRadius: radius.full }} />
            ))}
          </View>
        ) : trending.isError ? (
          <ErrorState onRetry={() => trending.refetch()} />
        ) : trending.data && trending.data.length > 0 ? (
          <View style={styles.chipsRow}>
            {trending.data.map((h) => (
              <HashtagChip key={h.tag} tag={h.tag} count={h.count} trending={h.trending} />
            ))}
          </View>
        ) : (
          <EmptyState compact icon="tag" title={t('social.empty')} />
        )}
      </View>

      {/* Koleksiyonlarım */}
      <View style={styles.section}>
        <SectionHeader
          title={t('social.myCollections')}
          actionLabel={t('social.seeAll')}
          onAction={() => router.push('/social/saved')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hRow}
        >
          {collections.isLoading
            ? [0, 1].map((i) => (
                <Skeleton
                  key={i}
                  width={cardWidth}
                  height={150}
                  style={{ borderRadius: radius.lg }}
                />
              ))
            : (collections.data ?? []).map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  width={cardWidth}
                  onPress={() =>
                    router.push({ pathname: '/social/saved', params: { collection: c.id } })
                  }
                />
              ))}
          <Tappable
            onPress={() => router.push('/social/saved')}
            scaleTo={0.96}
            style={[
              styles.newCollection,
              {
                width: cardWidth,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('social.newCollection')}
          >
            <Icon name="plus" size={22} color={colors.primary} strokeWidth={2.4} />
            <Text variant="caption" weight="bold" color="primary">
              {t('social.newCollection')}
            </Text>
          </Tappable>
        </ScrollView>
      </View>

      {/* Önerilen kullanıcılar */}
      <View style={styles.section}>
        <SectionHeader title={t('social.suggestedUsers')} />
        {people.isLoading ? (
          <View style={[styles.hRow, { paddingHorizontal: spacing.lg }]}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={140} height={168} style={{ borderRadius: radius.lg }} />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            {suggested.map((user) => (
              <SuggestedUserCard
                key={user.id}
                user={user}
                posts={postCount.get(user.id) ?? 0}
                locale={locale}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Popüler gönderiler */}
      <View style={styles.section}>
        <SectionHeader title={t('social.popular')} />
        <View style={styles.posts}>
          {feed.isLoading ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : feed.isError ? (
            <ErrorState onRetry={() => feed.refetch()} />
          ) : popular.length > 0 ? (
            popular.map((post: FeedPost) => (
              <PostCard
                key={post.id}
                post={post}
                onReact={actions.onReact}
                onToggleSave={actions.onToggleSave}
                onSaveLongPress={actions.onSaveLongPress}
                onRepost={actions.onRepost}
                onDelete={actions.onDelete}
              />
            ))
          ) : (
            <EmptyState
              icon="tent"
              title={t('social.empty')}
              description={t('social.emptyDescription')}
              action={{
                label: t('social.compose.status'),
                onPress: () => router.push('/post/status'),
                icon: 'plus',
              }}
            />
          )}
        </View>
      </View>
      {actions.sheets}
    </Screen>
  );
}

function SuggestedUserCard({ user, posts, locale }: { user: User; posts: number; locale: string }) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const following = useIsFollowing(user.id);
  const toggleFollow = useToggleFollow(user.id);
  if (following.data) return null;

  return (
    <View
      style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Tappable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        haptic="selection"
        style={styles.userInfo}
        accessibilityRole="button"
        accessibilityLabel={user.displayName}
      >
        <Avatar uri={user.avatarUrl} name={user.displayName} size={56} verified={user.isVerified} />
        <Text variant="title" numberOfLines={1} align="center">
          {user.displayName}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          @{user.username}
        </Text>
        <Text variant="caption" color="textSubtle" numberOfLines={1}>
          {t('social.postsCount', { count: posts })} · {formatCompact(user.followersCount, locale)}{' '}
          {t('profile.followers').toLocaleLowerCase('tr-TR')}
        </Text>
      </Tappable>
      <Button
        label={t('social.follow')}
        size="sm"
        icon="user-plus"
        fullWidth
        loading={toggleFollow.isPending}
        onPress={() => toggleFollow.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge, gap: spacing.xl },
  section: { gap: spacing.sm },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  hRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  newCollection: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  userCard: {
    width: 156,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  userInfo: { alignItems: 'center', gap: 3 },
  posts: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
});
