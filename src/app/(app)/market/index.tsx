import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { LISTING_CATEGORIES, LISTING_CATEGORY_META, type ListingCategory } from '@/domain';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { ListingCard } from '@/features/market/components/ListingCard';
import { useListings, useToggleFavorite } from '@/features/market/hooks';

export default function MarketScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const listings = useListings({ query, category });
  const toggleFavorite = useToggleFavorite();

  const columns = width >= 768 ? 3 : 2;
  const gap = spacing.sm + 2;
  const cardWidth =
    (Math.min(width, layout.maxContentWidth) - spacing.lg * 2 - gap * (columns - 1)) / columns;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('market.title')}
        subtitle={t('market.subtitle')}
        showBack
        right={
          <Button
            label={t('market.sell')}
            icon="plus"
            size="sm"
            onPress={() => router.push('/market/new')}
          />
        }
      />
      <View style={styles.content}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('market.searchPlaceholder')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <Chip
            label={t('common.all')}
            selected={category === null}
            onPress={() => setCategory(null)}
            icon="sparkles"
          />
          {LISTING_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(LISTING_CATEGORY_META[c].labelKey)}
              icon={LISTING_CATEGORY_META[c].icon}
              selected={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          ))}
        </ScrollView>

        <View style={[styles.safe, { backgroundColor: colors.primarySoft }]}>
          <Icon name="shield-check" size={14} color={colors.primary} strokeWidth={2.4} />
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('market.safeTrade')}
          </Text>
        </View>

        {listings.isError ? (
          <ErrorState onRetry={() => listings.refetch()} />
        ) : listings.isLoading ? (
          <View style={[styles.grid, { gap }]}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width={cardWidth}
                height={cardWidth + 70}
                style={{ borderRadius: radius.lg }}
              />
            ))}
          </View>
        ) : listings.data && listings.data.length > 0 ? (
          <View style={[styles.grid, { gap }]}>
            {listings.data.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                width={cardWidth}
                onToggleFavorite={(id) => toggleFavorite.mutate(id)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="store"
            title={t('market.empty')}
            description={t('market.emptyDescription')}
            action={{
              label: t('market.sell'),
              icon: 'plus',
              onPress: () => router.push('/market/new'),
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  safe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
