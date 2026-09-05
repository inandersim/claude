import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, type TrendingLocation } from '@/domain';

interface Props {
  location: TrendingLocation;
  width?: number;
  /** Tam genişlikte liste düzeni */
  wide?: boolean;
}

export function TrendingLocationCard({ location, width = 220, wide = false }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const primaryType = location.adventureTypes[0] ?? 'hiking';

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/location/[id]', params: { id: location.id } })}
      scaleTo={0.97}
      style={[styles.card, wide ? styles.wide : { width }]}
      accessibilityRole="button"
      accessibilityLabel={location.name}
    >
      <AdventureImage
        uri={location.imageUrl}
        adventureType={primaryType}
        style={styles.image}
        overlay
      >
        <View style={styles.trend}>
          <Icon name="trending-up" size={12} color="#5EE39B" strokeWidth={2.8} />
          <Text variant="label" weight="extrabold" color="#F2F7F4">
            +{location.trendPercent}%
          </Text>
        </View>
        <View style={styles.content}>
          <View style={styles.types}>
            {location.adventureTypes.slice(0, 3).map((type) => (
              <View
                key={type}
                style={[styles.typeDot, { backgroundColor: ADVENTURE_TYPE_META[type].color }]}
              >
                <Icon
                  name={ADVENTURE_TYPE_META[type].icon}
                  size={11}
                  color="#06120B"
                  strokeWidth={2.6}
                />
              </View>
            ))}
          </View>
          <Text variant={wide ? 'h2' : 'h3'} color="#FFFFFF" numberOfLines={1}>
            {location.name}
          </Text>
          <View style={styles.metaRow}>
            <Text
              variant="caption"
              color="rgba(255,255,255,0.75)"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {location.region}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.6)">
              · {formatCompact(location.postsCount, locale)} {t('explore.adventures')}
            </Text>
          </View>
        </View>
      </AdventureImage>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  wide: { width: '100%' },
  image: { aspectRatio: 0.82, width: '100%', borderRadius: radius.xl },
  trend: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  content: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: 4,
  },
  types: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  typeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
