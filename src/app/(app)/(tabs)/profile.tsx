import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUserPosts } from '@/features/feed/hooks';
import { PostGrid } from '@/features/profile/components/PostGrid';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { useUser } from '@/features/profile/hooks';

export default function ProfileScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useCurrentUser();
  const user = useUser(session.id);
  const posts = useUserPosts(session.id);
  const profile = user.data ?? session;

  return (
    <Screen scroll withTabBar edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="settings"
          variant="blur"
          onPress={() => router.push('/settings')}
          accessibilityLabel={t('settings.title')}
        />
      </View>

      <ProfileHeader
        user={profile}
        actions={
          <Button
            label={t('profile.editProfile')}
            variant="secondary"
            size="sm"
            icon="pencil"
            onPress={() => router.push('/settings')}
          />
        }
      />

      <View style={styles.section}>
        <SectionHeader
          title={t('profile.posts')}
          subtitle={posts.data ? `${posts.data.length} ${t('explore.adventures')}` : undefined}
        />
        {posts.isLoading ? (
          <View style={styles.skeletonGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="31%" height={110} style={{ borderRadius: radius.md }} />
            ))}
          </View>
        ) : posts.data && posts.data.length > 0 ? (
          <PostGrid posts={posts.data} />
        ) : (
          <EmptyState
            compact
            icon="camera"
            title={t('profile.noPosts')}
            description={t('profile.noPostsDescription')}
            action={{
              label: t('home.createPost'),
              onPress: () => router.push('/post/new'),
              icon: 'plus',
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: { marginTop: spacing.xxl },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
});
