import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { CommentWithAuthor } from '@/domain';

export function CommentItem({ comment }: { comment: CommentWithAuthor }) {
  const router = useRouter();
  const { locale } = useT();
  return (
    <View style={styles.row}>
      <Tappable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: comment.authorId } })}
        haptic="selection"
      >
        <Avatar
          uri={comment.author.avatarUrl}
          name={comment.author.displayName}
          size={34}
          verified={comment.author.isVerified}
        />
      </Tappable>
      <View style={{ flex: 1 }}>
        <View style={styles.head}>
          <Text variant="bodySm" weight="bold">
            {comment.author.displayName}
          </Text>
          <Text variant="caption" color="textSubtle">
            {formatRelative(comment.createdAt, new Date(), locale)}
          </Text>
        </View>
        <Text variant="bodySm" style={{ marginTop: 2 }}>
          {comment.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm + 2, paddingVertical: spacing.sm + 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
