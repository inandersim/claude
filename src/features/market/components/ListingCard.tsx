import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry, LISTING_CONDITION_META, type ListingWithSeller } from '@/domain';

interface Props {
  listing: ListingWithSeller;
  onToggleFavorite?: (id: string) => void;
  width?: number;
}

export function ListingCard({ listing, onToggleFavorite, width }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const condition = LISTING_CONDITION_META[listing.condition];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        width ? { width } : null,
      ]}
    >
      <Tappable
        onPress={() => router.push({ pathname: '/market/[id]', params: { id: listing.id } })}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={listing.title}
      >
        <AdventureImage
          uri={listing.imageUrls[0] ?? null}
          kucuk
          adventureType={listing.adventureTypes[0] ?? 'hiking'}
          style={styles.image}
        >
          {listing.isSold ? (
            <View style={styles.sold}>
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {t('market.sold').toLocaleUpperCase(locale)}
              </Text>
            </View>
          ) : null}
        </AdventureImage>
        <View style={styles.body}>
          <Text variant="title" weight="extrabold" color="primary">
            {formatPriceTry(listing.priceTry, locale)}
            {listing.category === 'rental' ? (
              <Text variant="caption" color="textMuted">
                {' '}
                {t('market.perDay')}
              </Text>
            ) : null}
          </Text>
          <Text variant="bodySm" weight="semibold" numberOfLines={2}>
            {listing.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.dot, { backgroundColor: condition.color }]} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {t(condition.labelKey)} · {listing.locationName.split(',')[0]}
            </Text>
          </View>
        </View>
      </Tappable>
      {/* Favori düğmesi kart düğmesinin kardeşi olarak konumlanır (iç içe düğme olmaz) */}
      {onToggleFavorite ? (
        <Tappable
          onPress={() => onToggleFavorite(listing.id)}
          haptic="medium"
          scaleTo={0.85}
          style={styles.fav}
          accessibilityRole="button"
          accessibilityLabel={listing.favoritedByMe ? t('market.unfavorite') : t('market.favorite')}
        >
          <Icon
            name="heart"
            size={16}
            color={listing.favoritedByMe ? '#FF6B6B' : '#FFFFFF'}
            fill={listing.favoritedByMe ? '#FF6B6B' : 'none'}
            strokeWidth={2.4}
          />
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { aspectRatio: 1, width: '100%' },
  sold: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(229,72,77,0.9)',
    justifyContent: 'center',
  },
  fav: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(8,14,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.sm + 2, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
