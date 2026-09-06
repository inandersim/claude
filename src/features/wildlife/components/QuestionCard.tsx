import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { WildlifeQuestionWithDetails } from '@/domain';

export interface QuestionCardProps {
  question: WildlifeQuestionWithDetails;
  onPress: () => void;
  now: Date;
}

/** Acil rozeti, görsel, konum, cevap sayısı ve çevrimiçi yardımcı sayısı. */
export function QuestionCard({ question: q, onPress, now }: QuestionCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const statusColor =
    q.status === 'resolved'
      ? colors.success
      : q.status === 'answered'
        ? colors.info
        : colors.textMuted;
  return (
    <Card
      onPress={onPress}
      padded={false}
      style={[
        styles.card,
        q.urgent && q.status !== 'resolved' ? { borderColor: colors.danger } : null,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <View style={styles.badges}>
            {q.urgent ? (
              <Badge
                label={t('wildlife.questions.urgent')}
                color={colors.danger}
                icon="siren"
                soft={false}
              />
            ) : null}
            <Badge label={t(`wildlife.questions.${q.status}`)} color={statusColor} />
          </View>
          <Text variant="title" numberOfLines={2}>
            {q.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {q.body}
          </Text>
          <View style={styles.meta}>
            <Avatar uri={q.author.avatarUrl} name={q.author.displayName} size={20} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
              {q.author.displayName} · {formatRelative(q.createdAt, now, locale)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="map-pin" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textSubtle" numberOfLines={1} style={styles.flex}>
              {q.locationName}
            </Text>
            <Icon name="message-circle" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textSubtle">
              {t('wildlife.questions.answersCount', { count: q.answersCount })}
            </Text>
            <Icon name="users" size={12} color={colors.success} />
            <Text variant="caption" color={colors.success}>
              {q.onlineHelpers}
            </Text>
          </View>
          {q.speciesGuess ? (
            <Text variant="caption" color="textMuted">
              {t('wildlife.questions.guess', { name: q.speciesGuess.commonName })}
            </Text>
          ) : null}
        </View>
        {q.imageUrl ? (
          <Image
            source={{ uri: q.imageUrl }}
            style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
            accessibilityLabel={q.title}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  body: { flex: 1, gap: spacing.xs },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
});
