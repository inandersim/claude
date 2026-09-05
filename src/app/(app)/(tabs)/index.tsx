import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, EmptyState, ErrorState, IconButton, Screen, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, spacing, useTheme } from '@/core/theme';
import type { AdventureType, FeedPost } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { AdventureTypeFilter } from '@/features/feed/components/AdventureTypeFilter';
import { PostCard } from '@/features/feed/components/PostCard';
import { PostCardSkeleton } from '@/features/feed/components/PostCardSkeleton';
import { useFeed, useToggleLike } from '@/features/feed/hooks';
import { HazardBanner } from '@/features/hazards/components/HazardBanner';
import { LiveStrip } from '@/features/live/components/LiveStrip';
import { useUnreadCount } from '@/features/notifications/hooks';

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
  const [type, setType] = useState<AdventureType | null>(null);
  const feed = useFeed(type);
  const toggleLike = useToggleLike();
  const { data: unread = 0 } = useUnreadCount();

  const onToggleLike = useCallback((postId: string) => toggleLike.mutate(postId), [toggleLike]);

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <View style={styles.item}>
        <PostCard post={item} onToggleLike={onToggleLike} />
      </View>
    ),
    [onToggleLike],
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
              icon="bell"
              badge={unread}
              onPress={() => router.push('/notifications')}
              accessibilityLabel={t('tabs.notifications')}
            />
            <IconButton
              icon="plus"
              onPress={() => router.push('/post/new')}
              accessibilityLabel={t('home.createPost')}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
            />
          </View>
        </View>
        <LiveStrip />
        <HazardBanner origin={me.coords} />
        <AdventureTypeFilter value={type} onChange={setType} />
      </View>
    ),
    [colors.onPrimary, colors.primary, me, router, t, type, unread],
  );

  const bottomPadding = layout.tabBarHeight + insets.bottom + spacing.xl;

  return (
    <Screen edges={['top']}>
      {feed.isError ? (
        <>
          {header}
          <ErrorState onRetry={() => feed.refetch()} />
        </>
      ) : (
        <FlashList
          data={feed.isLoading ? [] : (feed.data ?? [])}
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
                title={t('home.emptyTitle')}
                description={t('home.emptyDescription')}
                action={{
                  label: t('home.createPost'),
                  onPress: () => router.push('/post/new'),
                  icon: 'plus',
                }}
              />
            )
          }
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isLoading}
              onRefresh={() => feed.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
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
  item: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
