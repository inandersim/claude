import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { canEdit, COUNTRY_FLAG } from '@/domain';
import { ArticleBody } from '@/features/articles/components/ArticleBody';
import { ArticleHero } from '@/features/articles/components/ArticleHero';
import { CommentList } from '@/features/articles/components/CommentList';
import { RelatedArticles } from '@/features/articles/components/RelatedArticles';
import { WriterBadge } from '@/features/articles/components/WriterBadge';
import {
  useAddArticleComment,
  useArticle,
  useArticleComments,
  useToggleArticleLike,
  useToggleArticleSave,
  useToggleFollowWriter,
  useWriter,
} from '@/features/articles/hooks';
import { useCurrentUser } from '@/features/auth/session.store';

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [draft, setDraft] = useState('');

  const article = useArticle(slug);
  const data = article.data;
  const writer = useWriter(data?.authorId ?? '');
  const comments = useArticleComments(data?.id);
  const addComment = useAddArticleComment(data?.id ?? '');
  const like = useToggleArticleLike();
  const save = useToggleArticleSave();
  const follow = useToggleFollowWriter();

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  const onShare = () => {
    if (!data) return;
    Share.share({
      message: t('articles.shareMessage', {
        title: data.title,
        author: data.writer?.penName ?? data.author.displayName,
      }),
    }).catch(() => undefined);
  };

  const submitComment = () => {
    const content = draft.trim();
    if (!content || !data) return;
    addComment.mutate(content, {
      onSuccess: () => {
        setDraft('');
        toast(t('articles.commentAdded'), 'success');
      },
      onError,
    });
  };

  const owner = data ? canEdit(data, me.id) : false;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header
          title={t('articles.writer')}
          subtitle={data?.writer?.penName ?? data?.author.displayName}
          showBack
          onBack={() => goBack(router, '/explore')}
          right={
            owner && data ? (
              <Button
                label={t('articles.edit')}
                icon="pencil"
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/articles/write', params: { id: data.id } })
                }
              />
            ) : undefined
          }
        />
        <Screen scroll edges={[]} contentStyle={styles.scroll}>
          <View style={styles.content}>
            {article.isError ? (
              <ErrorState onRetry={() => article.refetch()} />
            ) : article.isLoading ? (
              <>
                <Skeleton height={280} style={{ borderRadius: radius.xl }} />
                <Skeleton height={28} />
                <Skeleton height={20} width="60%" />
                <Skeleton height={200} style={{ borderRadius: radius.lg }} />
              </>
            ) : data ? (
              <>
                <ArticleHero article={data} />

                <View
                  style={[
                    styles.authorRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Tappable
                    onPress={() =>
                      router.push({
                        pathname: '/articles/writer/[userId]',
                        params: { userId: data.authorId },
                      })
                    }
                    style={styles.authorMain}
                    accessibilityRole="button"
                    accessibilityLabel={data.author.displayName}
                  >
                    <Avatar
                      uri={data.author.avatarUrl}
                      name={data.author.displayName}
                      size={44}
                      verified={data.author.isVerified}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="title" numberOfLines={1}>
                        {data.writer?.penName ?? data.author.displayName}
                      </Text>
                      <View style={styles.badgeRow}>
                        {data.writer ? <WriterBadge writer={data.writer} /> : null}
                        {writer.data ? (
                          <Text variant="caption" color="textSubtle">
                            {t('articles.followers', {
                              count: formatCompact(writer.data.followerCount, locale),
                            })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Tappable>
                  {writer.data && !owner ? (
                    <Button
                      label={
                        writer.data.followedByMe ? t('articles.following') : t('articles.follow')
                      }
                      icon={writer.data.followedByMe ? 'user-check' : 'user-plus'}
                      size="sm"
                      variant={writer.data.followedByMe ? 'secondary' : 'primary'}
                      loading={follow.isPending}
                      onPress={() => follow.mutate(data.authorId, { onError })}
                    />
                  ) : null}
                </View>

                <ArticleBody body={data.body} />

                {data.tags.length > 0 ? (
                  <View style={styles.tags}>
                    {data.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={`#${tag}`}
                        size="sm"
                        onPress={() => router.push({ pathname: '/articles', params: { tag } })}
                      />
                    ))}
                  </View>
                ) : null}

                <View
                  style={[
                    styles.actions,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <ActionButton
                    icon="heart"
                    label={`${formatCompact(data.likesCount, locale)}`}
                    a11y={data.likedByMe ? t('articles.liked') : t('articles.like')}
                    active={data.likedByMe}
                    color={colors.danger}
                    onPress={() => like.mutate(data.id, { onError })}
                  />
                  <ActionButton
                    icon="bookmark"
                    label={data.savedByMe ? t('articles.savedState') : t('articles.save')}
                    a11y={t('articles.save')}
                    active={data.savedByMe}
                    color={colors.primary}
                    onPress={() => save.mutate(data.id, { onError })}
                  />
                  <ActionButton
                    icon="share"
                    label={t('articles.share')}
                    a11y={t('articles.share')}
                    active={false}
                    color={colors.info}
                    onPress={onShare}
                  />
                </View>

                {data.destinationId || data.countryCode ? (
                  <View style={styles.links}>
                    {data.destinationId ? (
                      <Tappable
                        onPress={() =>
                          router.push({
                            pathname: '/destinations/[id]',
                            params: { id: data.destinationId ?? '' },
                          })
                        }
                        style={[
                          styles.linkCard,
                          { backgroundColor: colors.primarySoft, borderColor: colors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('articles.destinationCard')}
                      >
                        <Icon name="map-pinned" size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text variant="title">{t('articles.destinationCard')}</Text>
                          <Text variant="caption" color="textMuted">
                            {t('articles.openGuide')}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.textSubtle} />
                      </Tappable>
                    ) : null}
                    {data.countryCode ? (
                      <Tappable
                        onPress={() => router.push(`/countries/${data.countryCode}` as Href)}
                        style={[
                          styles.linkCard,
                          { backgroundColor: colors.infoSoft, borderColor: colors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('articles.countryCard')}
                      >
                        <Text variant="h3">{COUNTRY_FLAG(data.countryCode)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text variant="title">
                            {t('articles.countryCard')} · {data.countryCode}
                          </Text>
                          <Text variant="caption" color="textMuted">
                            {t('articles.openGuide')}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.textSubtle} />
                      </Tappable>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.section}>
                  <SectionHeader
                    title={t('articles.comments')}
                    subtitle={t('articles.commentsCount', { count: data.commentsCount })}
                  />
                  <CommentList comments={comments.data} loading={comments.isLoading} now={now} />
                </View>

                <RelatedArticles article={data} />
              </>
            ) : (
              <EmptyState
                icon="book-open"
                title={t('articles.notFound')}
                description={t('articles.notFoundDescription')}
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

        {data ? (
          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('articles.writeComment')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
                multiline
                maxLength={500}
                accessibilityLabel={t('articles.writeComment')}
              />
            </View>
            <IconButton
              icon="send"
              onPress={submitComment}
              disabled={!draft.trim() || addComment.isPending}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
              accessibilityLabel={t('common.send')}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ActionButton({
  icon,
  label,
  a11y,
  active,
  color,
  onPress,
}: {
  icon: 'heart' | 'bookmark' | 'share';
  label: string;
  a11y: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active }}
      haptic="light"
    >
      <Icon
        name={icon}
        size={20}
        color={active ? color : colors.textMuted}
        strokeWidth={active ? 2.6 : 2}
      />
      <Text variant="caption" weight="bold" color={active ? color : 'textMuted'}>
        {label}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  authorMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  action: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  links: { gap: spacing.sm },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  input: { fontSize: 15, lineHeight: 20, minHeight: 24 },
});
