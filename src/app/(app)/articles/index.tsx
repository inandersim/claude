import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { ARTICLE_CATEGORIES, canPublish, type ArticleCategory } from '@/domain';
import { ArticleCard } from '@/features/articles/components/ArticleCard';
import { CategoryChips } from '@/features/articles/components/CategoryChips';
import { useArticles, useMyWriterProfile } from '@/features/articles/hooks';
import { SearchBar } from '@/features/explore/components/SearchBar';

const isCategory = (v: string | undefined): v is ArticleCategory =>
  Boolean(v) && (ARTICLE_CATEGORIES as readonly string[]).includes(v as string);

export default function ArticlesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string; category?: string }>();
  const { t } = useT();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ArticleCategory | null>(() =>
    isCategory(params.category) ? params.category : null,
  );
  const [tag, setTag] = useState<string | null>(() => params.tag ?? null);

  const featured = useArticles({ featuredOnly: true });
  const list = useArticles({ query, category, tag });
  const profile = useMyWriterProfile();
  const isWriter = canPublish(profile.data);
  const showFeatured = !query && !category && !tag;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('articles.title')}
        subtitle={t('articles.subtitle')}
        showBack
        right={
          <View style={styles.headerRight}>
            <IconButton
              icon="users"
              variant="ghost"
              onPress={() => router.push('/articles/writers')}
              accessibilityLabel={t('articles.writers')}
            />
            <IconButton
              icon="bookmark"
              variant="ghost"
              onPress={() => router.push('/articles/saved')}
              accessibilityLabel={t('articles.saved')}
            />
          </View>
        }
      />
      <View style={styles.content}>
        {profile.isLoading ? null : isWriter ? (
          <View style={[styles.writerBar, { backgroundColor: colors.primarySoft }]}>
            <Text variant="bodySm" style={{ flex: 1 }}>
              {profile.data?.penName}
            </Text>
            <Button
              label={t('articles.myArticles')}
              size="sm"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/articles/writer/[userId]',
                  params: { userId: profile.data?.userId ?? '' },
                })
              }
            />
            <Button
              label={t('articles.writeAction')}
              icon="pencil"
              size="sm"
              onPress={() => router.push('/articles/write')}
            />
          </View>
        ) : profile.data && !profile.data.approvedAt ? (
          <View style={[styles.writerBar, { backgroundColor: colors.warningSoft }]}>
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t('articles.pendingApproval')}
            </Text>
            <Button
              label={t('articles.apply.statusTitle')}
              size="sm"
              variant="ghost"
              onPress={() => router.push('/articles/apply')}
            />
          </View>
        ) : (
          <View style={[styles.writerBar, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t('articles.apply.subtitle')}
            </Text>
            <Button
              label={t('articles.becomeWriter')}
              icon="pencil"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/articles/apply')}
            />
          </View>
        )}

        <SearchBar value={query} onChange={setQuery} placeholder={t('articles.search')} />
        <CategoryChips value={category} onChange={setCategory} />

        {tag ? (
          <View style={styles.tagRow}>
            <Chip label={t('articles.tagFilter', { tag })} icon="tag" selected />
            <Button
              label={t('articles.clearFilter')}
              size="sm"
              variant="ghost"
              icon="x"
              onPress={() => setTag(null)}
            />
          </View>
        ) : null}

        {showFeatured && featured.data && featured.data.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('articles.featured')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              style={{ marginHorizontal: -spacing.lg }}
            >
              {featured.data.map((a) => (
                <ArticleCard key={a.id} article={a} variant="featured" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          {showFeatured ? <SectionHeader title={t('articles.latest')} /> : null}
          {list.isError ? (
            <ErrorState onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            [0, 1, 2].map((i) => (
              <Skeleton key={i} height={280} style={{ borderRadius: radius.xl }} />
            ))
          ) : list.data && list.data.length > 0 ? (
            list.data
              .filter((a) => !showFeatured || a.status !== 'featured')
              .map((a) => <ArticleCard key={a.id} article={a} />)
          ) : (
            <EmptyState
              icon="book-open"
              title={t('articles.empty')}
              description={t('articles.emptyDescription')}
              action={
                query || category || tag
                  ? {
                      label: t('articles.clearFilter'),
                      icon: 'x',
                      variant: 'secondary',
                      onPress: () => {
                        setQuery('');
                        setCategory(null);
                        setTag(null);
                      },
                    }
                  : undefined
              }
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', gap: spacing.xs },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  writerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  section: { gap: spacing.md },
  strip: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingVertical: 2 },
});
