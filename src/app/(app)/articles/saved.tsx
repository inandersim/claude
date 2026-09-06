import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Header, Screen, Skeleton } from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing } from '@/core/theme';
import { ArticleCard } from '@/features/articles/components/ArticleCard';
import { useSavedArticles } from '@/features/articles/hooks';

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { t } = useT();
  const saved = useSavedArticles();

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('articles.saved')}
        subtitle={t('articles.savedSubtitle')}
        showBack
        onBack={() => goBack(router, '/explore')}
      />
      <View style={styles.content}>
        {saved.isError ? (
          <ErrorState onRetry={() => saved.refetch()} />
        ) : saved.isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} height={120} style={{ borderRadius: radius.xl }} />
          ))
        ) : saved.data && saved.data.length > 0 ? (
          saved.data.map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)
        ) : (
          <EmptyState
            icon="bookmark"
            title={t('articles.emptySaved')}
            description={t('articles.emptySavedDescription')}
            action={{
              label: t('articles.browse'),
              icon: 'search',
              variant: 'secondary',
              onPress: () => router.replace('/articles'),
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
});
