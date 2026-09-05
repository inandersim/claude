import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import type { StayReviewWithAuthor } from '@/domain';

export interface ReviewRowProps {
  review: StayReviewWithAuthor;
}

/** Yorum satırı: avatar, yıldızlar, "Doğrulanmış konaklama" rozeti, metin. */
export function ReviewRow({ review }: ReviewRowProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Avatar
          uri={review.author.avatarUrl}
          name={review.author.displayName}
          size={36}
          verified={review.author.isVerified}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodySm" weight="bold" numberOfLines={1}>
            {review.author.displayName}
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Icon
                key={i}
                name="star"
                size={12}
                color="#FFB547"
                fill={i <= review.rating ? '#FFB547' : 'none'}
                strokeWidth={2}
              />
            ))}
            <Text variant="label" color="textSubtle" style={{ marginLeft: 4 }}>
              {formatDate(review.createdAt, locale, 'd MMM yyyy')}
            </Text>
          </View>
        </View>
        {review.verifiedStay ? (
          <Badge label={t('inventory.verifiedStay')} color={colors.primary} icon="badge-check" />
        ) : null}
      </View>
      <Text variant="bodySm" color="textMuted">
        {review.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
