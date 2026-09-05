import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  formatPriceTry,
  LISTING_CATEGORY_META,
  LISTING_CONDITION_META,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useListing, useMarkSold, useToggleFavorite } from '@/features/market/hooks';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const listing = useListing(id);
  const toggleFavorite = useToggleFavorite();
  const markSold = useMarkSold();
  const data = listing.data;
  const isMine = data?.sellerId === me.id;

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/market'))}
          accessibilityLabel={t('common.back')}
        />
        {data ? (
          <IconButton
            icon="heart"
            variant="blur"
            color={data.favoritedByMe ? '#FF6B6B' : '#FFFFFF'}
            fill={data.favoritedByMe ? '#FF6B6B' : 'none'}
            onPress={() => toggleFavorite.mutate(id)}
            accessibilityLabel={data.favoritedByMe ? t('market.unfavorite') : t('market.favorite')}
          />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {listing.isError ? (
          <ErrorState onRetry={() => listing.refetch()} />
        ) : listing.isLoading ? (
          <Skeleton height={360} style={{ borderRadius: 0 }} />
        ) : data ? (
          <>
            <AdventureImage
              uri={data.imageUrls[0] ?? null}
              adventureType={data.adventureTypes[0] ?? 'hiking'}
              style={styles.hero}
            />
            <View style={styles.body}>
              <View style={styles.priceRow}>
                <Text variant="display" color="primary" style={{ fontSize: 30, lineHeight: 36 }}>
                  {formatPriceTry(data.priceTry, locale)}
                  {data.category === 'rental' ? (
                    <Text variant="bodySm" color="textMuted">
                      {' '}
                      / gün
                    </Text>
                  ) : null}
                </Text>
                {data.isSold ? (
                  <Badge label={t('market.sold')} color={colors.danger} soft={false} />
                ) : null}
              </View>
              <Text variant="h2">{data.title}</Text>
              <View style={styles.chips}>
                <Badge
                  label={t(LISTING_CATEGORY_META[data.category].labelKey)}
                  color={colors.info}
                  icon={LISTING_CATEGORY_META[data.category].icon}
                />
                <Badge
                  label={t(LISTING_CONDITION_META[data.condition].labelKey)}
                  color={LISTING_CONDITION_META[data.condition].color}
                />
                {data.adventureTypes.map((type) => (
                  <Badge
                    key={type}
                    label={t(ADVENTURE_TYPE_META[type].labelKey)}
                    color={ADVENTURE_TYPE_META[type].color}
                    icon={ADVENTURE_TYPE_META[type].icon}
                  />
                ))}
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text variant="h3">{t('market.details')}</Text>
                <Text variant="body" color="textMuted">
                  {data.description}
                </Text>
              </View>

              <View style={[styles.facts, { borderColor: colors.border }]}>
                <View style={styles.fact}>
                  <Icon name="map-pin" size={14} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted">
                    {data.locationName}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Icon name="calendar" size={14} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted">
                    {t('market.posted')}: {formatDate(data.createdAt, locale, 'd MMM')}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Icon name="heart" size={14} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted">
                    {data.favoritesCount} {t('market.favorites')}
                  </Text>
                </View>
              </View>

              <Tappable
                onPress={() =>
                  router.push({ pathname: '/user/[id]', params: { id: data.sellerId } })
                }
                haptic="selection"
                style={[
                  styles.seller,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                accessibilityRole="button"
              >
                <Avatar
                  uri={data.seller.avatarUrl}
                  name={data.seller.displayName}
                  size={44}
                  verified={data.seller.isVerified}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="textSubtle">
                    {t('market.seller')}
                  </Text>
                  <Text variant="title">{data.seller.displayName}</Text>
                </View>
                <View style={[styles.trust, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="shield-check" size={12} color={colors.primary} strokeWidth={2.6} />
                  <Text variant="label" weight="extrabold" color="primary">
                    {data.seller.trustScore}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textSubtle} />
              </Tappable>

              <View style={[styles.safe, { backgroundColor: colors.accentSoft }]}>
                <Icon name="life-buoy" size={14} color={colors.accent} strokeWidth={2.4} />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {t('market.safeTrade')}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <EmptyState
            icon="store"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        )}
      </ScrollView>
      {data ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {isMine ? (
            <Button
              label={data.isSold ? t('market.sold') : t('market.markSold')}
              icon="check"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={data.isSold}
              loading={markSold.isPending}
              onPress={() =>
                markSold.mutate(id, { onSuccess: () => toast(t('market.sold'), 'success') })
              }
            />
          ) : (
            <Button
              label={t('market.contactSeller')}
              icon="message-circle"
              size="lg"
              fullWidth
              disabled={data.isSold}
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: data.sellerId, matchId: '' } })
              }
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: { width: '100%', aspectRatio: 1 },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  safe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
