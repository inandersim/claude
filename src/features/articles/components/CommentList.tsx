import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, EmptyState, Skeleton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { ArticleComment, User } from '@/domain';

type CommentWithAuthor = ArticleComment & { author: User };

interface Props {
  comments: CommentWithAuthor[] | undefined;
  loading?: boolean;
  now: number;
}

/** Yorum listesi: avatar, ad, göreli zaman ve içerik; yükleme ve boş durumları. */
export function CommentList({ comments, loading, now }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={64} style={{ borderRadius: radius.lg }} />
        ))}
      </View>
    );
  }
  if (!comments || comments.length === 0) {
    return <EmptyState icon="message-circle" title={t('articles.noComments')} compact />;
  }
  return (
    <View style={styles.list}>
      {comments.map((c) => (
        <View
          key={c.id}
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Tappable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: c.authorId } })}
            accessibilityRole="button"
            accessibilityLabel={c.author.displayName}
            haptic="selection"
          >
            <Avatar
              uri={c.author.avatarUrl}
              name={c.author.displayName}
              size={36}
              verified={c.author.isVerified}
            />
          </Tappable>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.head}>
              <Text variant="caption" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
                {c.author.displayName}
              </Text>
              <Text variant="caption" color="textSubtle">
                {formatRelative(c.createdAt, new Date(now), locale)}
              </Text>
            </View>
            <Text variant="bodySm">{c.content}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
