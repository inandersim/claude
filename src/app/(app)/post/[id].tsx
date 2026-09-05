import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPE_META, DIFFICULTY_META, formatDistance } from '@/domain';
import { RoutePreview } from '@/features/explore/components/RoutePreview';
import { CommentItem } from '@/features/feed/components/CommentItem';
import { PostCard } from '@/features/feed/components/PostCard';
import { PostCardSkeleton } from '@/features/feed/components/PostCardSkeleton';
import {
  useAddComment,
  useComments,
  usePost,
  useRoute,
  useToggleLike,
} from '@/features/feed/hooks';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const post = usePost(id);
  const comments = useComments(id);
  const route = useRoute(post.data?.routeId ?? null);
  const toggleLike = useToggleLike();
  const addComment = useAddComment(id);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    addComment.mutate(content);
  };

  return (
    <Screen edges={['top']}>
      <Header title={t('post.title')} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {post.isError ? (
            <ErrorState onRetry={() => post.refetch()} />
          ) : post.isLoading ? (
            <PostCardSkeleton />
          ) : post.data ? (
            <>
              <PostCard
                post={post.data}
                onToggleLike={(postId) => toggleLike.mutate(postId)}
                detailed
              />

              {route.data ? (
                <View
                  style={[
                    styles.routeCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.routeHead}>
                    <Icon
                      name="route"
                      size={18}
                      color={ADVENTURE_TYPE_META[route.data.adventureType].color}
                      strokeWidth={2.4}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{route.data.name}</Text>
                      <Text variant="caption" color="textMuted">
                        {route.data.locationName}
                      </Text>
                    </View>
                  </View>
                  <RoutePreview
                    path={route.data.path}
                    color={ADVENTURE_TYPE_META[route.data.adventureType].color}
                    height={140}
                  />
                  <View style={styles.routeStats}>
                    <RouteStat
                      label={t('home.distance')}
                      value={formatDistance(route.data.distanceKm, locale)}
                    />
                    <RouteStat
                      label={t('post.elevationGain')}
                      value={`${route.data.elevationGainM} m`}
                    />
                    <RouteStat
                      label={t('post.difficulty')}
                      value={t(DIFFICULTY_META[route.data.difficulty].labelKey)}
                      color={DIFFICULTY_META[route.data.difficulty].color}
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.comments}>
                <Text variant="h3">
                  {t('post.commentsTitle')}
                  {comments.data ? (
                    <Text variant="h3" color="textSubtle">
                      {' '}
                      · {comments.data.length}
                    </Text>
                  ) : null}
                </Text>
                {comments.isLoading ? (
                  [0, 1].map((i) => (
                    <Skeleton key={i} height={52} style={{ borderRadius: radius.md }} />
                  ))
                ) : comments.data && comments.data.length > 0 ? (
                  comments.data.map((c) => <CommentItem key={c.id} comment={c} />)
                ) : (
                  <EmptyState
                    compact
                    icon="message-circle"
                    title={t('post.noComments')}
                    description={t('post.noCommentsDescription')}
                  />
                )}
              </View>
            </>
          ) : (
            <EmptyState
              icon="compass"
              title={t('notFound.title')}
              description={t('notFound.description')}
            />
          )}
        </ScrollView>

        {post.data ? (
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
                placeholder={t('post.writeComment')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
                multiline
                maxLength={500}
                accessibilityLabel={t('post.writeComment')}
              />
            </View>
            <IconButton
              icon="send"
              onPress={submit}
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

function RouteStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="title" weight="extrabold" color={color}>
        {value}
      </Text>
      <Text variant="label" color="textSubtle">
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  routeCard: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
  },
  routeStats: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  comments: { gap: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: { fontSize: 15, paddingVertical: spacing.sm + 2 },
});
