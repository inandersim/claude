import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { topicMeta, type WriterWithUser } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

import { WriterBadge } from './WriterBadge';

interface Props {
  writer: WriterWithUser;
  onToggleFollow?: (userId: string) => void;
  followPending?: boolean;
}

/**
 * Yazar kartı: avatar, mahlas, rozet, konular, takipçi ve yazı sayısı; takip
 * butonu kartın dışında ayrı bir buton (iç içe buton kuralı).
 */
export function WriterCard({ writer, onToggleFollow, followPending }: Props) {
  const router = useRouter();
  const me = useCurrentUser();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const isMe = writer.userId === me.id;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Tappable
        onPress={() =>
          router.push({ pathname: '/articles/writer/[userId]', params: { userId: writer.userId } })
        }
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={writer.penName}
      >
        <Avatar
          uri={writer.user.avatarUrl}
          name={writer.user.displayName}
          size={52}
          verified={writer.user.isVerified}
        />
        <View style={styles.info}>
          <Text variant="title" numberOfLines={1}>
            {writer.penName}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            @{writer.user.username}
          </Text>
          <View style={styles.topics}>
            <WriterBadge writer={writer} />
            {writer.topics.slice(0, 2).map((topic) => (
              <View key={topic} style={styles.topic}>
                <Icon name={topicMeta[topic].icon} size={12} color={topicMeta[topic].color} />
                <Text variant="caption" color="textMuted">
                  {t(topicMeta[topic].labelKey)}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="caption" color="textSubtle">
            {t('articles.followers', { count: formatCompact(writer.followerCount, locale) })} ·{' '}
            {t('articles.articlesCount', { count: writer.articleCount })}
          </Text>
        </View>
      </Tappable>
      {onToggleFollow && !isMe ? (
        <Button
          label={writer.followedByMe ? t('articles.following') : t('articles.follow')}
          icon={writer.followedByMe ? 'user-check' : 'user-plus'}
          size="sm"
          variant={writer.followedByMe ? 'secondary' : 'primary'}
          loading={followPending}
          onPress={() => onToggleFollow(writer.userId)}
          style={styles.follow}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  topics: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  follow: { alignSelf: 'center' },
});
