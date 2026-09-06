import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useT, type TranslationKey } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUserPosts } from '@/features/feed/hooks';
import { PostGrid } from '@/features/profile/components/PostGrid';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { useUser } from '@/features/profile/hooks';

export default function ProfileScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
          <>
            <Button
              label={
                session.plan === 'free'
                  ? t('plans.upgrade')
                  : t(`plans.${session.plan}` as TranslationKey)
              }
              variant={session.plan === 'free' ? 'accent' : 'secondary'}
              size="sm"
              icon="sparkles"
              onPress={() => router.push('/plans')}
            />
            <IconButton
              icon="pencil"
              size={36}
              iconSize={16}
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('profile.editProfile')}
            />
          </>
        }
      />

      <View style={styles.section}>
        <SectionHeader title={t('profile.shortcuts')} />
        <View style={styles.shortcuts}>
          {(
            [
              { icon: 'siren', label: t('firstAid.title'), href: '/first-aid' },
              { icon: 'locate-fixed', label: t('presence.title'), href: '/live-location' },
              { icon: 'globe', label: t('library.title'), href: '/library' },
              { icon: 'building-2', label: t('stays.title'), href: '/stays' },
              { icon: 'calendar-check', label: t('booking.title'), href: '/bookings' },
              { icon: 'store', label: t('market.myListings'), href: '/market' },
              { icon: 'triangle-alert', label: t('hazards.title'), href: '/hazards' },
              { icon: 'sparkles', label: t('plans.title'), href: '/plans' },
              { icon: 'bot', label: t('ai.title'), href: '/assistant' },
              { icon: 'map', label: t('maps.title'), href: '/maps' },
              { icon: 'mountain', label: t('climbing.title'), href: '/climbing' },
              { icon: 'satellite', label: t('satellite.title'), href: '/satellite' },
              { icon: 'school', label: t('clubs.title'), href: '/clubs' },
              { icon: 'gamepad-2', label: t('fun.title'), href: '/fun' },
              { icon: 'wallet', label: t('inventory.title'), href: '/stays/host' },
              { icon: 'compass', label: t('destinations.title'), href: '/destinations' },
              { icon: 'route', label: t('tracks.title'), href: '/tracks' },
              { icon: 'book-open', label: t('articles.title'), href: '/articles' },
              { icon: 'graduation-cap', label: t('courses.title'), href: '/courses/my' },
              { icon: 'message-square', label: t('groups.title'), href: '/groups' },
              { icon: 'heart-pulse', label: t('telemed.title'), href: '/telemed' },
              { icon: 'play', label: t('tv.title'), href: '/tv' },
              { icon: 'party-popper', label: t('kids.title'), href: '/kids' },
            ] as {
              icon: IconName;
              label: string;
              href:
                | '/first-aid'
                | '/live-location'
                | '/library'
                | '/stays'
                | '/bookings'
                | '/market'
                | '/hazards'
                | '/plans'
                | '/assistant'
                | '/maps'
                | '/climbing'
                | '/satellite'
                | '/clubs'
                | '/fun'
                | '/stays/host'
                | '/destinations'
                | '/tracks'
                | '/articles'
                | '/courses/my'
                | '/groups'
                | '/telemed'
                | '/tv'
                | '/kids';
            }[]
          ).map((item) => (
            <Tappable
              key={item.href}
              onPress={() => router.push(item.href)}
              haptic="selection"
              scaleTo={0.95}
              style={[
                styles.shortcut,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name={item.icon} size={18} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text variant="caption" weight="bold" numberOfLines={1}>
                {item.label}
              </Text>
            </Tappable>
          ))}
        </View>
      </View>

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
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  shortcut: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
});
