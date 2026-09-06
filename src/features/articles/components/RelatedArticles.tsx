import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { relatedArticles, type ArticleWithAuthor } from '@/domain';
import { useArticles } from '@/features/articles/hooks';

import { ArticleCard } from './ArticleCard';

/** Aynı destinasyon / ülke / etiketteki yazılar (en fazla 3). */
export function RelatedArticles({ article }: { article: ArticleWithAuthor }) {
  const { t } = useT();
  const all = useArticles({});
  const related = useMemo(() => relatedArticles(article, all.data ?? [], 3), [article, all.data]);
  if (related.length === 0) return null;
  return (
    <View style={styles.root}>
      <SectionHeader title={t('articles.related')} />
      {related.map((a) => (
        <ArticleCard key={a.id} article={a} variant="compact" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});
