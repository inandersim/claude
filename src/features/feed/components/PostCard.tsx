import { useRouter } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, IconButton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatRelative } from '@/core/utils/time';
import { isSocialPost, postImages, type FeedPost, type ReactionType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { ImageCarousel } from '@/features/social/components/ImageCarousel';
import { ReactionBar } from '@/features/social/components/ReactionBar';
import { ReactionSummary } from '@/features/social/components/ReactionSummary';
import { RepostCard } from '@/features/social/components/RepostCard';
import { RichText } from '@/features/social/components/RichText';

import { AdventureTypeBadge } from './AdventureTypeBadge';
import { DifficultyBadge } from './DifficultyBadge';
import { PostMetrics } from './PostMetrics';
import { TrailConditionBadge } from './TrailConditionBadge';

interface Props {
  post: FeedPost;
  /** Tepki ver / değiştir / kaldır (null = kaldır) */
  onReact?: (postId: string, type: ReactionType | null) => void;
  /** Eski API: beğeni aç/kapa — onReact verilmediğinde kullanılır */
  onToggleLike?: (postId: string) => void;
  onToggleSave?: (postId: string) => void;
  /** Yer imine uzun basınca koleksiyon seçimi */
  onSaveLongPress?: (post: FeedPost) => void;
  onRepost?: (post: FeedPost) => void;
  /** Yalnızca kendi gönderilerinde gösterilir */
  onDelete?: (post: FeedPost) => void;
  /** Detay sayfasında görsel daha büyük ve metrikler tam gösterilir */
  detailed?: boolean;
}

function PostCardComponent({
  post,
  onReact,
  onToggleLike,
  onToggleSave,
  onSaveLongPress,
  onRepost,
  onDelete,
  detailed = false,
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const me = useCurrentUser();
  const social = isSocialPost(post);
  const images = postImages(post);
  const isMine = post.authorId === me.id;

  const openPost = useCallback(
    () => router.push({ pathname: '/post/[id]', params: { id: post.id } }),
    [router, post.id],
  );
  const openAuthor = useCallback(
    () => router.push({ pathname: '/user/[id]', params: { id: post.authorId } }),
    [router, post.authorId],
  );

  const react = useCallback(
    (type: ReactionType | null) => {
      if (onReact) onReact(post.id, type);
      else onToggleLike?.(post.id);
    },
    [onReact, onToggleLike, post.id],
  );

  const handleDoubleTap = useCallback(() => {
    if (!post.likedByMe) react('like');
  }, [post.likedByMe, react]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Yeniden paylaşım başlığı */}
      {post.repostOfId ? (
        <View style={[styles.repostHead, { borderBottomColor: colors.border }]}>
          <Icon name="repeat" size={14} color={colors.primary} strokeWidth={2.4} />
          <Text variant="caption" weight="bold" color="textMuted" numberOfLines={1}>
            {t('social.repostedBy', { name: post.author.displayName })}
          </Text>
        </View>
      ) : null}

      {/* Yazar satırı */}
      <View style={styles.authorRow}>
        <Tappable
          onPress={openAuthor}
          haptic="selection"
          style={styles.authorInfo}
          accessibilityRole="button"
          accessibilityLabel={post.author.displayName}
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
        {social ? (
          post.kind === 'photo' ? (
            <View style={[styles.kindPill, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="image" size={12} color={colors.textMuted} strokeWidth={2.4} />
              {images.length > 1 ? (
                <Text variant="label" weight="bold" color="textMuted">
                  {images.length}
                </Text>
              ) : null}
            </View>
          ) : null
        ) : (
          <AdventureTypeBadge type={post.adventureType} />
        )}
      </View>

      {/* Görsel(ler) */}
      {images.length > 0 ? (
        <View style={styles.imageWrap}>
          <ImageCarousel
            images={images}
            adventureType={post.adventureType}
            aspectRatio={detailed ? 1 : 4 / 3}
            onPress={detailed ? undefined : openPost}
            onDoubleTap={handleDoubleTap}
            accessibilityLabel={post.caption}
          >
            {!social ? (
              <>
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
              </>
            ) : null}
          </ImageCarousel>
        </View>
      ) : null}

      {/* Açıklama + (macera ise) metrikler + (repost ise) orijinal */}
      <View style={styles.body}>
        {post.caption ? (
          <RichText
            text={post.caption}
            numberOfLines={detailed ? undefined : social ? 6 : 3}
            variant={social && images.length === 0 ? 'title' : 'body'}
            weight={social && images.length === 0 ? 'medium' : undefined}
          />
        ) : null}
        {post.repostOfId ? <RepostCard post={post.repostOf} interactive={!detailed} /> : null}
        {!social ? <PostMetrics post={post} compact={!detailed} /> : null}

        <View style={styles.summaryRow}>
          <ReactionSummary counts={post.reactionCounts} fallbackTotal={post.likesCount} />
          <View style={{ flex: 1 }} />
          {post.commentsCount > 0 ? (
            <Text variant="caption" weight="bold" color="textMuted">
              {formatCompact(post.commentsCount, locale)}{' '}
              {t('home.comments').toLocaleLowerCase('tr-TR')}
            </Text>
          ) : null}
          {(post.repostsCount ?? 0) > 0 ? (
            <Text variant="caption" weight="bold" color="textMuted">
              · {formatCompact(post.repostsCount ?? 0, locale)}{' '}
              {t('social.reposted').toLocaleLowerCase('tr-TR')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Aksiyonlar */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <ReactionBar myReaction={post.myReaction} total={post.likesCount} onReact={react} />
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
        {onRepost ? (
          <Tappable
            onPress={() => onRepost(post)}
            haptic="selection"
            scaleTo={0.9}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={t('social.repost')}
          >
            <Icon name="repeat" size={22} strokeWidth={2.2} />
            {(post.repostsCount ?? 0) > 0 ? (
              <Text variant="bodySm" weight="bold">
                {formatCompact(post.repostsCount ?? 0, locale)}
              </Text>
            ) : null}
          </Tappable>
        ) : null}
        <View style={{ flex: 1 }} />
        {post.routeId && !social ? (
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
        {isMine && onDelete ? (
          <IconButton
            icon="trash"
            variant="ghost"
            size={36}
            iconSize={18}
            color={colors.danger}
            onPress={() => onDelete(post)}
            accessibilityLabel={t('social.delete')}
          />
        ) : null}
        {onToggleSave ? (
          <Tappable
            onPress={() => onToggleSave(post.id)}
            onLongPress={onSaveLongPress ? () => onSaveLongPress(post) : undefined}
            delayLongPress={260}
            haptic="light"
            scaleTo={0.85}
            style={styles.iconAction}
            accessibilityRole="button"
            accessibilityLabel={post.savedByMe ? t('social.unsave') : t('social.save')}
            accessibilityHint={onSaveLongPress ? t('social.selectCollection') : undefined}
          >
            <Icon
              name="bookmark"
              size={22}
              color={post.savedByMe ? colors.primary : colors.text}
              fill={post.savedByMe ? colors.primary : 'none'}
              strokeWidth={2.2}
            />
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
  repostHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  imageWrap: { marginHorizontal: spacing.sm },
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
  body: { padding: spacing.md, gap: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 18 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingVertical: 4 },
  iconAction: { paddingVertical: 4, paddingHorizontal: 2 },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    height: 30,
    borderRadius: radius.full,
  },
});
