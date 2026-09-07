import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import type { FeedPost, FeedTabValue } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { PostCard } from '@/features/feed/components/PostCard';
import { PostCardSkeleton } from '@/features/feed/components/PostCardSkeleton';
import { HazardBanner } from '@/features/hazards/components/HazardBanner';
import { useUnreadCount } from '@/features/notifications/hooks';
import { ComposeSheet } from '@/features/social/components/ComposeSheet';
import { FeedTabs } from '@/features/social/components/FeedTabs';
import { HashtagChip } from '@/features/social/components/HashtagChip';
import { useSocialFeedPages, useTrendingHashtags } from '@/features/social/hooks';
import { usePostCardActions } from '@/features/social/usePostCardActions';
import { StoriesStrip } from '@/features/stories/components/StoriesStrip';

function greetingKey(): 'home.greetingMorning' | 'home.greetingDay' | 'home.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
}

export default function HomeScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const [tab, setTab] = useState<FeedTabValue>('all');
  const [hashtag, setHashtag] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const filter = useMemo(() => ({ tab, hashtag }), [tab, hashtag]);
  const feed = useSocialFeedPages(filter);
  // Sayfalar tek listeye düzleştirilir; kaydırma sonunda bir sonraki sayfa
  // istenir. "Daha var mı" kararı repository'den gelir (bkz. useSocialFeedPages).
  const posts = useMemo(() => feed.data?.pages.flatMap((s) => s.posts) ?? [], [feed.data]);
  const trending = useTrendingHashtags(8);
  const { data: unread = 0 } = useUnreadCount();
  const actions = usePostCardActions();

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

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.greeting}>
            <Avatar uri={me.avatarUrl} name={me.displayName} size={40} verified={me.isVerified} />
            <View>
              <Text variant="caption" color="textMuted">
                {t(greetingKey())}
              </Text>
              <Text variant="h3">{me.displayName.split(' ')[0]}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon="users"
              onPress={() => router.push('/social')}
              accessibilityLabel={t('social.community')}
            />
            <IconButton
              icon="message-circle"
              onPress={() => router.push('/groups')}
              accessibilityLabel={t('social.messages')}
            />
            <IconButton
              icon="bell"
              badge={unread}
              onPress={() => router.push('/notifications')}
              accessibilityLabel={t('tabs.notifications')}
            />
            <IconButton
              icon="plus"
              onPress={() => setComposeOpen(true)}
              accessibilityLabel={t('social.compose.title')}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
            />
          </View>
        </View>
        <FeedTabs value={tab} onChange={setTab} />
        {trending.data && trending.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendRow}
          >
            <Tappable
              onPress={() => router.push('/social')}
              haptic="selection"
              style={[styles.trendLabel, { backgroundColor: colors.primarySoft }]}
              accessibilityRole="button"
              accessibilityLabel={t('social.trending')}
            >
              <Text variant="caption" weight="extrabold" color="primary">
                {t('social.trending')}
              </Text>
            </Tappable>
            {trending.data.map((h) => (
              <HashtagChip
                key={h.tag}
                tag={h.tag}
                trending={h.trending}
                selected={hashtag === h.tag}
                onPress={(tag) => setHashtag((prev) => (prev === tag ? null : tag))}
                size="sm"
              />
            ))}
          </ScrollView>
        ) : null}
        <StoriesStrip />
        <HazardBanner origin={me.coords} />
      </View>
    ),
    [
      colors.onPrimary,
      colors.primary,
      colors.primarySoft,
      hashtag,
      me,
      router,
      t,
      tab,
      trending.data,
      unread,
    ],
  );

  const bottomPadding = layout.tabBarHeight + insets.bottom + spacing.xl;
  const emptyTitle = tab === 'following' ? t('social.emptyFollowing') : t('social.empty');
  const emptyDescription =
    tab === 'following' ? t('social.emptyFollowingDescription') : t('social.emptyDescription');

  return (
    <Screen edges={['top']}>
      {feed.isError ? (
        <>
          {header}
          <ErrorState onRetry={() => feed.refetch()} />
        </>
      ) : (
        <FlashList
          data={feed.isLoading ? [] : posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            feed.isLoading ? (
              <View style={styles.skeletons}>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </View>
            ) : (
              <EmptyState
                icon="tent"
                title={emptyTitle}
                description={emptyDescription}
                action={
                  tab === 'following'
                    ? {
                        label: t('social.discover'),
                        onPress: () => router.push('/social'),
                        icon: 'users',
                      }
                    : {
                        label: t('social.compose.status'),
                        onPress: () => router.push('/post/status'),
                        icon: 'plus',
                      }
                }
              />
            )
          }
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Liste sonuna yaklaşınca bir sonraki sayfa istenir. `hasNextPage`
          // repository'nin verdiği kürsöre dayanır; süzülmüş liste uzunluğuna
          // bakmak kaydırmayı erken durdururdu.
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.skeletons}>
                <PostCardSkeleton />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isLoading && !feed.isFetchingNextPage}
              onRefresh={() => feed.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      <ComposeSheet visible={composeOpen} onClose={() => setComposeOpen(false)} />
      {actions.sheets}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  trendRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  trendLabel: {
    height: 30,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  item: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
