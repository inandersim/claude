import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  BUSINESS_TYPE_META,
  formatDistance,
  formatPriceTry,
  type BusinessWithOwner,
} from '@/domain';

export function BusinessCard({ business, width }: { business: BusinessWithOwner; width?: number }) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = BUSINESS_TYPE_META[business.type];
  return (
    <Tappable
      onPress={() => router.push({ pathname: '/stays/[id]', params: { id: business.id } })}
      scaleTo={0.97}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: business.isFeatured ? colors.accent : colors.border,
        },
        width ? { width } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={business.name}
    >
      <AdventureImage
        uri={business.imageUrl}
        kucuk
        adventureType={business.adventureTypes[0] ?? 'hiking'}
        style={styles.cover}
        overlay
      >
        <View style={styles.top}>
          <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
            <Icon name={meta.icon} size={12} color="#F2F7F4" strokeWidth={2.4} />
            <Text variant="label" weight="extrabold" color="#F2F7F4">
              {t(meta.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          {business.isFeatured ? (
            <View style={[styles.pill, { backgroundColor: colors.accent }]}>
              <Icon name="sparkles" size={12} color="#1A1000" strokeWidth={2.6} />
              <Text variant="label" weight="extrabold" color="#1A1000">
                {t('stays.featured').toLocaleUpperCase(locale)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <Text variant="h3" color="#FFFFFF" numberOfLines={1}>
            {business.name}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="star" size={12} color="#FFB547" fill="#FFB547" />
            <Text variant="caption" weight="bold" color="#FFFFFF">
              {business.rating.toFixed(1)}
            </Text>
            <Text
              variant="caption"
              color="rgba(255,255,255,0.7)"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              ({business.reviewCount}) · {business.locationName}
              {business.distanceKm !== null
                ? ` · ${formatDistance(business.distanceKm, locale)}`
                : ''}
            </Text>
          </View>
        </View>
      </AdventureImage>
      <View style={styles.foot}>
        <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
          {business.amenities.slice(0, 3).join(' · ')}
        </Text>
        {business.priceFromTry !== null ? (
          <Text variant="bodySm" weight="extrabold" color="primary">
            {formatPriceTry(business.priceFromTry, locale)}
            <Text variant="caption" color="textSubtle">
              {' '}
              {t('stays.perNight')}
            </Text>
          </Text>
        ) : null}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cover: { aspectRatio: 1.5, width: '100%' },
  top: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  bottom: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
