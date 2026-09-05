import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  formatDistance,
  formatPriceTry,
  type InstructorWithUser,
} from '@/domain';

import { RatingStars } from './RatingStars';

export function InstructorCard({
  instructor,
  width,
}: {
  instructor: InstructorWithUser;
  width?: number;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/instructors/[id]', params: { id: instructor.id } })}
      scaleTo={0.98}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        width ? { width } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={instructor.user.displayName}
    >
      <View style={styles.head}>
        <Avatar
          uri={instructor.user.avatarUrl}
          name={instructor.user.displayName}
          size={56}
          verified={instructor.user.isVerified}
          ring
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {instructor.user.displayName}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {instructor.headline}
          </Text>
          <RatingStars rating={instructor.rating} count={instructor.reviewCount} size={12} />
        </View>
      </View>
      <View style={styles.types}>
        {instructor.specialties.map((type) => {
          const meta = ADVENTURE_TYPE_META[type];
          return (
            <View key={type} style={[styles.typeChip, { backgroundColor: meta.softColor }]}>
              <Icon name={meta.icon} size={11} color={meta.color} strokeWidth={2.6} />
              <Text variant="label" weight="extrabold" color={meta.color}>
                {t(meta.labelKey).toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <View style={styles.footItem}>
          <Icon name="map-pin" size={12} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {instructor.locationName.split(',')[0]}
            {instructor.distanceKm !== null
              ? ` · ${formatDistance(instructor.distanceKm, locale)}`
              : ''}
          </Text>
        </View>
        <Text variant="bodySm" weight="extrabold" color="primary">
          {formatPriceTry(instructor.pricePerSessionTry, locale)}
          <Text variant="caption" color="textSubtle">
            {' '}
            / {t('instructors.perSession')}
          </Text>
        </Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
});
