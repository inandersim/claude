import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { topicMeta, type Article } from '@/domain';

/** Büyük kapak + kategori rozeti + başlık + alt başlık + okuma/görüntülenme bilgisi. */
export function ArticleHero({ article }: { article: Article }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = topicMeta[article.category];

  return (
    <View style={styles.root}>
      <AdventureImage
        uri={article.coverUrl}
        adventureType={article.adventureTypes[0] ?? 'hiking'}
        style={styles.cover}
        overlay
      >
        <View style={styles.overlayContent}>
          <View style={styles.pillRow}>
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
            ) : null}
          </View>
          <Text variant="h1" color="#F7FAF8" accessibilityRole="header">
            {article.title}
          </Text>
        </View>
      </AdventureImage>
      <View style={styles.below}>
        {article.subtitle ? (
          <Text variant="body" color="textMuted">
            {article.subtitle}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Icon name="clock" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('articles.readMin', { min: article.readMinutes })}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="eye" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('articles.views', { count: formatCompact(article.viewsCount, locale) })}
            </Text>
          </View>
          {article.publishedAt ? (
            <View style={styles.meta}>
              <Icon name="calendar" size={14} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted">
                {formatDate(article.publishedAt, locale)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  cover: { width: '100%', height: 280, borderRadius: radius.xl, overflow: 'hidden' },
  overlayContent: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  below: { gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
