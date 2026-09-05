import { useRouter } from 'expo-router';
import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { AdventureImage, Avatar, Icon, IconButton, Tappable, Text } from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatRelative } from '@/core/utils/time';
import { type FeedPost } from '@/domain';

import { AdventureTypeBadge } from './AdventureTypeBadge';
import { DifficultyBadge } from './DifficultyBadge';
import { PostMetrics } from './PostMetrics';
import { TrailConditionBadge } from './TrailConditionBadge';

interface Props {
  post: FeedPost;
  onToggleLike: (postId: string) => void;
  /** Detay sayfasında görsel daha büyük ve metrikler tam gösterilir */
  detailed?: boolean;
}

function PostCardComponent({ post, onToggleLike, detailed = false }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const [showHeart, setShowHeart] = useState(false);
  const heartScale = useSharedValue(0);
  const likeScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.get() }],
    opacity: heartScale.get(),
  }));
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.get() }] }));

  const openPost = useCallback(
    () => router.push({ pathname: '/post/[id]', params: { id: post.id } }),
    [router, post.id],
  );
  const openAuthor = useCallback(
    () => router.push({ pathname: '/user/[id]', params: { id: post.authorId } }),
    [router, post.authorId],
  );

  const handleLike = useCallback(() => {
    likeScale.set(withSequence(withSpring(1.35, { damping: 6, stiffness: 400 }), withSpring(1)));
    haptics.medium();
    onToggleLike(post.id);
  }, [likeScale, onToggleLike, post.id]);

  const lastTap = React.useRef(0);
  const handleImagePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!post.likedByMe) onToggleLike(post.id);
      setShowHeart(true);
      heartScale.set(withSequence(withSpring(1, { damping: 8 }), withSpring(0, { damping: 14 })));
      haptics.medium();
      setTimeout(() => setShowHeart(false), 700);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current === now) {
        lastTap.current = 0;
        if (!detailed) openPost();
      }
    }, 290);
  }, [detailed, heartScale, onToggleLike, openPost, post.id, post.likedByMe]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Yazar satırı */}
      <View style={styles.authorRow}>
        <Tappable
          onPress={openAuthor}
          haptic="selection"
          style={styles.authorInfo}
          accessibilityRole="button"
        >
          <Avatar
            uri={post.author.avatarUrl}
            name={post.author.displayName}
            size={40}
            verified={post.author.isVerified}
          />
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>
              {post.author.displayName}
            </Text>
            <View style={styles.metaRow}>
              <Icon name="map-pin" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {post.locationName}
              </Text>
              <Text variant="caption" color="textSubtle">
                · {formatRelative(post.createdAt, new Date(), locale)}
              </Text>
            </View>
          </View>
        </Tappable>
        <AdventureTypeBadge type={post.adventureType} />
      </View>

      {/* Görsel */}
      <Tappable
        onPress={handleImagePress}
        haptic="none"
        scaleTo={0.995}
        accessibilityRole="imagebutton"
        accessibilityLabel={post.caption}
      >
        <AdventureImage
          uri={post.imageUrl}
          adventureType={post.adventureType}
          style={[styles.image, detailed && styles.imageDetailed]}
          overlay
        >
          <View style={styles.imageOverlayTop}>
            {post.isVerifiedInfo ? (
              <View style={[styles.verifiedPill, { backgroundColor: 'rgba(8,14,12,0.55)' }]}>
                <Icon name="shield-check" size={12} color="#5EE39B" strokeWidth={2.6} />
                <Text variant="label" weight="extrabold" color="#F2F7F4">
                  {t('home.verifiedInfo').toLocaleUpperCase('tr-TR')}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <DifficultyBadge grade={post.difficulty} />
          </View>
          <View style={styles.imageOverlayBottom}>
            <View style={styles.altitudeRow}>
              <Icon name="mountain-snow" size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text variant="h2" color="#FFFFFF">
                {post.altitudeM.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} m
              </Text>
            </View>
            <TrailConditionBadge condition={post.trailCondition} />
          </View>
          {showHeart ? (
            <Animated.View pointerEvents="none" style={[styles.bigHeart, heartStyle]}>
              <Icon name="heart" size={88} color="#FFFFFF" fill="#FF6B6B" strokeWidth={1.5} />
            </Animated.View>
          ) : null}
        </AdventureImage>
      </Tappable>

      {/* Açıklama + metrikler */}
      <View style={styles.body}>
        <Text variant="body" numberOfLines={detailed ? undefined : 3}>
          {post.caption}
        </Text>
        <PostMetrics post={post} compact={!detailed} />
      </View>

      {/* Aksiyonlar */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Animated.View style={likeStyle}>
          <Tappable
            onPress={handleLike}
            haptic="none"
            scaleTo={0.9}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={t('home.likes')}
          >
            <Icon
              name="heart"
              size={22}
              color={post.likedByMe ? colors.danger : colors.text}
              fill={post.likedByMe ? colors.danger : 'none'}
            />
            <Text variant="bodySm" weight="bold" color={post.likedByMe ? 'danger' : 'text'}>
              {formatCompact(post.likesCount, locale)}
            </Text>
          </Tappable>
        </Animated.View>
        <Tappable
          onPress={openPost}
          haptic="selection"
          scaleTo={0.9}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={t('home.comments')}
        >
          <Icon name="message-circle" size={22} />
          <Text variant="bodySm" weight="bold">
            {formatCompact(post.commentsCount, locale)}
          </Text>
        </Tappable>
        <View style={{ flex: 1 }} />
        {post.routeId ? (
          <Tappable
            onPress={openPost}
            haptic="selection"
            style={[styles.routePill, { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
          >
            <Icon name="route" size={14} color={colors.primary} strokeWidth={2.4} />
            <Text variant="caption" weight="bold" color="primary">
              {t('post.viewRoute')}
            </Text>
          </Tappable>
        ) : null}
        <IconButton
          icon="share"
          variant="ghost"
          size={36}
          iconSize={20}
          accessibilityLabel={t('common.share')}
        />
      </View>
    </View>
  );
}

export const PostCard = memo(PostCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm + 2,
  },
  authorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  image: { aspectRatio: 4 / 3, marginHorizontal: spacing.sm, borderRadius: radius.lg },
  imageDetailed: { aspectRatio: 1 },
  imageOverlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageOverlayBottom: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  altitudeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  bigHeart: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: spacing.md },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingVertical: 4 },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    height: 30,
    borderRadius: radius.full,
  },
});
