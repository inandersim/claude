import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { excerpt, topicMeta, type ArticleWithAuthor } from '@/domain';

import { WriterBadge } from './WriterBadge';

interface Props {
  article: ArticleWithAuthor;
  /** Yatay şerit için sabit genişlikli kart */
  variant?: 'default' | 'featured' | 'compact';
}

/**
 * Yazı kartı: kapak, kategori rozeti, başlık, alt başlık/özet, yazar satırı
 * (avatar, ad, rozet), okuma süresi ve beğeni sayısı.
 */
export function ArticleCard({ article, variant = 'default' }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = topicMeta[article.category];
  const summary = article.subtitle || excerpt(article.body, 140);
  const featured = variant === 'featured';
  const compact = variant === 'compact';

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/articles/[slug]', params: { slug: article.slug } })}
      scaleTo={0.97}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        featured && styles.featured,
        compact && styles.compactCard,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}, ${article.author.displayName}`}
    >
      <AdventureImage
        uri={article.coverUrl}
        adventureType={article.adventureTypes[0] ?? 'hiking'}
        style={[styles.cover, featured && styles.featuredCover, compact && styles.compactCover]}
        overlay
      >
        <View style={styles.coverTop}>
          <View style={[styles.pill, { backgroundColor: meta.color }]}>
            <Icon name={meta.icon} size={12} color="#0B1410" strokeWidth={2.4} />
            <Text variant="label" weight="extrabold" color="#0B1410">
              {t(meta.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          {article.status === 'draft' ? (
            <View style={[styles.pill, { backgroundColor: colors.warning }]}>
              <Text variant="label" weight="extrabold" color="#0B1410">
                {t('articles.status.draft').toLocaleUpperCase(locale)}
              </Text>
            </View>
          ) : article.status === 'featured' ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
              <Icon name="sparkles" size={12} color="#F5B301" strokeWidth={2.4} />
              <Text variant="label" weight="extrabold" color="#F2F7F4">
                {t('articles.status.featured').toLocaleUpperCase(locale)}
              </Text>
            </View>
          ) : null}
        </View>
      </AdventureImage>
      <View style={styles.body}>
        <Text variant={featured ? 'h3' : 'title'} numberOfLines={2}>
          {article.title}
        </Text>
        {!compact ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={featured ? 2 : 3}>
            {summary}
          </Text>
        ) : null}
        <View style={styles.authorRow}>
          <Avatar
            uri={article.author.avatarUrl}
            name={article.author.displayName}
            size={26}
            verified={article.author.isVerified}
          />
          <Text variant="caption" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {article.writer?.penName ?? article.author.displayName}
          </Text>
          {article.writer && !compact ? <WriterBadge writer={article.writer} /> : null}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Icon name="clock" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('articles.readMin', { min: article.readMinutes })}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon
              name="heart"
              size={13}
              color={article.likedByMe ? colors.danger : colors.textSubtle}
            />
            <Text variant="caption" color="textMuted">
              {formatCompact(article.likesCount, locale)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="message-circle" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {formatCompact(article.commentsCount, locale)}
            </Text>
          </View>
          {article.savedByMe ? <Icon name="bookmark" size={13} color={colors.primary} /> : null}
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  featured: { width: 280 },
  compactCard: { flexDirection: 'row', alignItems: 'stretch' },
  cover: { width: '100%', height: 160 },
  featuredCover: { height: 150 },
  compactCover: { width: 110, height: '100%', minHeight: 110 },
  coverTop: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  body: { padding: spacing.md, gap: spacing.sm, flex: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
