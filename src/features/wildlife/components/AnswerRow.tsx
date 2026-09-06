import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { WildlifeQuestionWithDetails } from '@/domain';

export type AnswerWithDetails = WildlifeQuestionWithDetails['answers'][number];

export interface AnswerRowProps {
  answer: AnswerWithDetails;
  accepted: boolean;
  /** Soru sahibi mi (kabul edebilir) */
  canAccept: boolean;
  isQuestionAuthor: boolean;
  now: Date;
  onUpvote: () => void;
  onAccept: () => void;
  onOpenSpecies?: (id: string) => void;
}

/** Uzman rozeti, oy düğmesi, kabul düğmesi ve tür etiketi. */
export function AnswerRow({
  answer: a,
  accepted,
  canAccept,
  isQuestionAuthor,
  now,
  onUpvote,
  onAccept,
  onOpenSpecies,
}: AnswerRowProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surface, borderColor: accepted ? colors.success : colors.border },
      ]}
    >
      <View style={styles.head}>
        <Avatar
          uri={a.author.avatarUrl}
          name={a.author.displayName}
          size={32}
          verified={a.author.isVerified}
        />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text variant="bodySm" weight="bold" numberOfLines={1}>
              {a.author.displayName}
            </Text>
            {a.isExpert ? (
              <Badge
                label={t('wildlife.question.expert')}
                color={colors.primary}
                icon="badge-check"
              />
            ) : null}
            {isQuestionAuthor ? (
              <Badge label={t('wildlife.question.byAuthor')} color={colors.textMuted} />
            ) : null}
          </View>
          <Text variant="caption" color="textSubtle">
            {formatRelative(a.createdAt, now, locale)}
          </Text>
        </View>
        {accepted ? <Icon name="circle-check" size={20} color={colors.success} /> : null}
      </View>

      <Text variant="body">{a.body}</Text>

      {a.species ? (
        <Tappable
          onPress={onOpenSpecies ? () => onOpenSpecies(a.species!.id) : undefined}
          style={[styles.species, { backgroundColor: colors.surfaceMuted }]}
          accessibilityRole="button"
          accessibilityLabel={a.species.commonName}
        >
          <Icon name="search" size={13} color={colors.textMuted} />
          <Text variant="caption" weight="bold" numberOfLines={1}>
            {a.species.commonName}
          </Text>
          <Text variant="caption" color="textMuted" style={styles.latin} numberOfLines={1}>
            {a.species.scientificName}
          </Text>
        </Tappable>
      ) : null}

      <View style={styles.actions}>
        <Tappable
          onPress={a.upvotedByMe ? undefined : onUpvote}
          disabled={a.upvotedByMe}
          style={[
            styles.action,
            {
              borderColor: a.upvotedByMe ? colors.primary : colors.border,
              backgroundColor: a.upvotedByMe ? colors.primarySoft : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('wildlife.question.upvote')} ${a.upvotes}`}
          accessibilityState={{ disabled: a.upvotedByMe }}
        >
          <Icon
            name="arrow-up"
            size={14}
            color={a.upvotedByMe ? colors.primary : colors.textMuted}
          />
          <Text
            variant="caption"
            weight="bold"
            color={a.upvotedByMe ? colors.primary : colors.textMuted}
          >
            {a.upvotes} ·{' '}
            {a.upvotedByMe ? t('wildlife.question.upvoted') : t('wildlife.question.upvote')}
          </Text>
        </Tappable>
        {canAccept && !accepted ? (
          <Tappable
            onPress={onAccept}
            style={[styles.action, { borderColor: colors.success }]}
            accessibilityRole="button"
            accessibilityLabel={t('wildlife.question.accept')}
          >
            <Icon name="check" size={14} color={colors.success} />
            <Text variant="caption" weight="bold" color={colors.success}>
              {t('wildlife.question.accept')}
            </Text>
          </Tappable>
        ) : null}
        {accepted ? (
          <Text variant="caption" weight="bold" color={colors.success}>
            {t('wildlife.question.accepted')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  species: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  latin: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
