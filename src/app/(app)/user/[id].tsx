import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUserPosts } from '@/features/feed/hooks';
import { PostGrid } from '@/features/profile/components/PostGrid';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { useIsFollowing, useToggleFollow, useUser } from '@/features/profile/hooks';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const me = useCurrentUser();
  const isMe = id === me.id;

  const user = useUser(id);
  const posts = useUserPosts(id);
  const following = useIsFollowing(id);
  const toggleFollow = useToggleFollow(id);

  return (
    <Screen scroll edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel={t('common.back')}
        />
        {isMe ? (
          <IconButton
            icon="settings"
            variant="blur"
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('settings.title')}
          />
        ) : (
          <View />
        )}
      </View>

      {user.isError ? (
        <ErrorState onRetry={() => user.refetch()} />
      ) : user.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md, paddingTop: insets.top + 60 }}>
          <Skeleton width={88} height={88} round />
          <Skeleton width="50%" height={22} />
          <Skeleton height={14} />
          <Skeleton height={120} style={{ borderRadius: radius.xl }} />
        </View>
      ) : user.data ? (
        <>
          <ProfileHeader
            user={user.data}
            actions={
              isMe ? (
                <Button
                  label={t('profile.editProfile')}
                  variant="secondary"
                  size="sm"
                  icon="pencil"
                  onPress={() => router.push('/settings')}
                />
              ) : (
                <>
                  <Button
                    label={following.data ? t('profile.unfollow') : t('profile.follow')}
                    variant={following.data ? 'secondary' : 'primary'}
                    size="sm"
                    icon={following.data ? 'user-check' : 'user-plus'}
                    onPress={() => toggleFollow.mutate()}
                    loading={toggleFollow.isPending}
                  />
                  <IconButton
                    icon="message-circle"
                    size={36}
                    iconSize={18}
                    onPress={() =>
                      router.push({ pathname: '/chat/[id]', params: { id, matchId: '' } })
                    }
                    accessibilityLabel={t('zmatch.message')}
                  />
                </>
              )
            }
          />
          <View style={styles.section}>
            <SectionHeader
              title={t('profile.posts')}
              subtitle={posts.data ? `${posts.data.length} ${t('explore.adventures')}` : undefined}
            />
            {posts.isLoading ? (
              <View style={styles.skeletonGrid}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="31%" height={110} style={{ borderRadius: radius.md }} />
                ))}
              </View>
            ) : posts.data && posts.data.length > 0 ? (
              <PostGrid posts={posts.data} />
            ) : (
              <EmptyState compact icon="camera" title={t('profile.noPosts')} />
            )}
          </View>
        </>
      ) : (
        <EmptyState
          icon="user"
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  section: { marginTop: spacing.xxl },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
});
