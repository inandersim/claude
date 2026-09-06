import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  AdventureImage,
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { topicMeta } from '@/domain';
import { ArticleCard } from '@/features/articles/components/ArticleCard';
import { WriterBadge } from '@/features/articles/components/WriterBadge';
import { useArticles, useToggleFollowWriter, useWriter } from '@/features/articles/hooks';
import { useCurrentUser } from '@/features/auth/session.store';

export default function WriterProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const me = useCurrentUser();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const writer = useWriter(userId);
  const articles = useArticles({ authorId: userId });
  const follow = useToggleFollowWriter();
  const data = writer.data;
  const isMe = userId === me.id;

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('articles.writer')}
        showBack
        onBack={() => goBack(router, '/explore')}
        right={
          isMe && data?.approvedAt ? (
            <Button
              label={t('articles.writeAction')}
              icon="pencil"
              size="sm"
              onPress={() => router.push('/articles/write')}
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {writer.isError ? (
          <ErrorState onRetry={() => writer.refetch()} />
        ) : writer.isLoading ? (
          <>
            <Skeleton height={160} style={{ borderRadius: radius.xl }} />
            <Skeleton height={24} width="50%" />
            <Skeleton height={60} />
          </>
        ) : data ? (
          <>
            <AdventureImage
              uri={data.user.coverUrl}
              adventureType={data.user.favoriteTypes[0] ?? 'hiking'}
              style={styles.cover}
              overlay
            />
            <View style={styles.profileRow}>
              <Tappable
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: data.userId } })}
                accessibilityRole="button"
                accessibilityLabel={data.user.displayName}
                haptic="selection"
              >
                <Avatar
                  uri={data.user.avatarUrl}
                  name={data.user.displayName}
                  size={72}
                  verified={data.user.isVerified}
                  ring
                />
              </Tappable>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="h3">{data.penName}</Text>
                <Text variant="caption" color="textMuted">
                  {data.user.displayName} · @{data.user.username}
                </Text>
                <WriterBadge writer={data} />
              </View>
            </View>

            {!isMe ? (
              <Button
                label={data.followedByMe ? t('articles.following') : t('articles.follow')}
                icon={data.followedByMe ? 'user-check' : 'user-plus'}
                variant={data.followedByMe ? 'secondary' : 'primary'}
                loading={follow.isPending}
                fullWidth
                onPress={() => follow.mutate(data.userId, { onError })}
              />
            ) : null}

            <View style={styles.stats}>
              <StatTile
                icon="users"
                label={t('articles.followersLabel')}
                value={formatCompact(data.followerCount, locale)}
                compact
              />
              <StatTile
                icon="book-open"
                label={t('articles.authorArticles')}
                value={String(data.articleCount)}
                compact
              />
            </View>

            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text variant="label" color="textSubtle">
                {t('articles.bio').toLocaleUpperCase('tr-TR')}
              </Text>
              <Text variant="body">{data.bio}</Text>
              <View style={styles.metaRow}>
                <Icon name="languages" size={14} color={colors.textSubtle} />
                <Text variant="caption" color="textMuted">
                  {t('articles.languages')}: {data.languages.map((l) => l.toUpperCase()).join(', ')}
                </Text>
              </View>
              <View style={styles.chips}>
                {data.topics.map((topic) => (
                  <Chip
                    key={topic}
                    label={t(topicMeta[topic].labelKey)}
                    icon={topicMeta[topic].icon}
                    color={topicMeta[topic].color}
                    size="sm"
                    selected
                    onPress={() =>
                      router.push({ pathname: '/articles', params: { category: topic } })
                    }
                  />
                ))}
              </View>
              {data.website ? (
                <Button
                  label={data.website.replace(/^https?:\/\//, '')}
                  icon="external-link"
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    Linking.openURL(data.website ?? '').catch(() => undefined);
                  }}
                  style={{ alignSelf: 'flex-start' }}
                />
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionHeader title={t('articles.authorArticles')} />
              {articles.isError ? (
                <ErrorState onRetry={() => articles.refetch()} />
              ) : articles.isLoading ? (
                [0, 1].map((i) => (
                  <Skeleton key={i} height={260} style={{ borderRadius: radius.xl }} />
                ))
              ) : articles.data && articles.data.length > 0 ? (
                articles.data.map((a) => <ArticleCard key={a.id} article={a} />)
              ) : (
                <EmptyState
                  icon="book-open"
                  title={isMe ? t('articles.emptyMine') : t('articles.empty')}
                  description={isMe ? t('articles.emptyMineDescription') : undefined}
                  action={
                    isMe && data.approvedAt
                      ? {
                          label: t('articles.writeAction'),
                          icon: 'pencil',
                          onPress: () => router.push('/articles/write'),
                        }
                      : undefined
                  }
                />
              )}
            </View>
          </>
        ) : (
          <EmptyState icon="user" title={t('articles.writerNotFound')} />
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
  cover: { width: '100%', height: 140, borderRadius: radius.xl, overflow: 'hidden' },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: -spacing.xl,
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  card: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
});
