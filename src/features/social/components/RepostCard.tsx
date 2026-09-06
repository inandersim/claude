import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { isSocialPost, postImages, type Post, type User } from '@/domain';

import { RichText } from './RichText';

interface Props {
  post: (Post & { author: User }) | null | undefined;
  /** Kart bir Tappable içinde ise tıklamayı kapat (iç içe buton kuralı) */
  interactive?: boolean;
}

/** Yeniden paylaşım içindeki orijinal gönderi kartı (iç içe, kompakt). */
export function RepostCard({ post, interactive = true }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useT();

  if (!post) {
    return (
      <View style={[styles.card, styles.deleted, { borderColor: colors.border }]}>
        <Icon name="circle-alert" size={16} color={colors.textSubtle} />
        <Text variant="caption" color="textMuted">
          {t('social.originalDeleted')}
        </Text>
      </View>
    );
  }

  const images = postImages(post);
  const content = (
    <>
      <View style={styles.head}>
        <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={28} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" weight="bold" numberOfLines={1}>
            {post.author.displayName}
          </Text>
          <Text variant="caption" color="textSubtle" numberOfLines={1}>
            @{post.author.username} · {formatRelative(post.createdAt, new Date(), locale)}
          </Text>
        </View>
        {!isSocialPost(post) ? (
          <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
            <Icon name="mountain-snow" size={12} color={colors.primary} strokeWidth={2.4} />
            <Text variant="label" weight="bold" color="primary">
              {post.altitudeM} m
            </Text>
          </View>
        ) : null}
      </View>
      {post.caption ? (
        <RichText text={post.caption} variant="bodySm" numberOfLines={3} interactive={false} />
      ) : null}
      {images.length > 0 ? (
        <AdventureImage uri={images[0]} adventureType={post.adventureType} style={styles.image}>
          {images.length > 1 ? (
            <View style={styles.more}>
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {t('social.more', { count: images.length - 1 })}
              </Text>
            </View>
          ) : null}
        </AdventureImage>
      ) : null}
      <View style={styles.meta}>
        <Icon name="map-pin" size={12} color={colors.textSubtle} />
        <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
          {post.locationName}
        </Text>
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  ];

  if (!interactive) return <View style={cardStyle}>{content}</View>;

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      haptic="selection"
      scaleTo={0.985}
      style={cardStyle}
      accessibilityRole="button"
      accessibilityLabel={post.caption || post.locationName}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  deleted: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  image: { aspectRatio: 16 / 9, borderRadius: radius.md },
  more: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
