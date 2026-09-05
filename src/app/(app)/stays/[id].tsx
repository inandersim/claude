import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
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
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  BUSINESS_TYPE_META,
  formatDistance,
  formatPriceTry,
  mapsUrl,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { RatingStars } from '@/features/instructors/components/RatingStars';
import { useBusiness } from '@/features/stays/hooks';

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const business = useBusiness(id, me.coords);
  const data = business.data;
  const meta = data ? BUSINESS_TYPE_META[data.type] : null;

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/stays'))}
          accessibilityLabel={t('common.back')}
        />
        {data ? (
          <IconButton
            icon="map"
            variant="blur"
            onPress={() =>
              Linking.openURL(mapsUrl(data.coords.latitude, data.coords.longitude, data.name))
            }
            accessibilityLabel={t('library.openInMaps')}
          />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {business.isError ? (
          <ErrorState onRetry={() => business.refetch()} />
        ) : business.isLoading ? (
          <View style={{ padding: spacing.lg, paddingTop: insets.top + 60 }}>
            <Text variant="body" color="textMuted">
              {t('common.loading')}
            </Text>
          </View>
        ) : data && meta ? (
          <>
            <AdventureImage
              uri={data.imageUrl}
              adventureType={data.adventureTypes[0] ?? 'hiking'}
              style={styles.hero}
              overlay
            >
              <View style={styles.heroContent}>
                <View style={styles.chips}>
                  <Badge label={t(meta.labelKey)} color="#F2F7F4" icon={meta.icon} />
                  {data.isVerified ? (
                    <Badge label={t('stays.verified')} color={colors.primary} icon="badge-check" />
                  ) : null}
                  {data.isFeatured ? (
                    <Badge
                      label={t('stays.featured')}
                      color={colors.accent}
                      icon="sparkles"
                      soft={false}
                    />
                  ) : null}
                </View>
                <Text variant="display" color="#FFFFFF" style={{ fontSize: 30, lineHeight: 36 }}>
                  {data.name}
                </Text>
                <View style={styles.metaRow}>
                  <RatingStars rating={data.rating} count={data.reviewCount} />
                  <Icon name="map-pin" size={12} color="rgba(255,255,255,0.8)" />
                  <Text variant="caption" color="rgba(255,255,255,0.8)">
                    {data.locationName}
                    {data.distanceKm !== null
                      ? ` · ${formatDistance(data.distanceKm, locale)}`
                      : ''}
                  </Text>
                </View>
              </View>
            </AdventureImage>

            <View style={styles.body}>
              <View style={{ gap: spacing.xs }}>
                <Text variant="h3">{t('stays.about')}</Text>
                <Text variant="body" color="textMuted">
                  {data.description}
                </Text>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text variant="h3">{t('stays.amenities')}</Text>
                <View style={styles.chips}>
                  {data.amenities.map((a) => (
                    <View
                      key={a}
                      style={[
                        styles.amenity,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                      ]}
                    >
                      <Icon name="check" size={12} color={colors.primary} strokeWidth={2.8} />
                      <Text variant="caption" weight="bold">
                        {a}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text variant="h3">{t('stays.suitableFor')}</Text>
                <View style={styles.chips}>
                  {data.adventureTypes.map((type) => (
                    <Badge
                      key={type}
                      label={t(ADVENTURE_TYPE_META[type].labelKey)}
                      color={ADVENTURE_TYPE_META[type].color}
                      icon={ADVENTURE_TYPE_META[type].icon}
                    />
                  ))}
                </View>
              </View>

              <View
                style={[
                  styles.contact,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Tappable
                  onPress={() =>
                    router.push({ pathname: '/user/[id]', params: { id: data.ownerId } })
                  }
                  haptic="selection"
                  style={styles.ownerRow}
                  accessibilityRole="button"
                >
                  <Avatar
                    uri={data.owner.avatarUrl}
                    name={data.owner.displayName}
                    size={40}
                    verified={data.owner.isVerified}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color="textSubtle">
                      {t('stays.contact')}
                    </Text>
                    <Text variant="title">{data.owner.displayName}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSubtle} />
                </Tappable>
                <View style={styles.contactRow}>
                  {data.phone ? (
                    <Button
                      label={t('firstAid.call')}
                      icon="mail"
                      variant="secondary"
                      size="sm"
                      onPress={() => Linking.openURL(`tel:${data.phone}`)}
                    />
                  ) : null}
                  {data.website ? (
                    <Button
                      label={t('library.website')}
                      icon="globe"
                      variant="secondary"
                      size="sm"
                      onPress={() => Linking.openURL(data.website!)}
                    />
                  ) : null}
                  <Button
                    label={t('zmatch.message')}
                    icon="message-circle"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[id]',
                        params: { id: data.ownerId, matchId: '' },
                      })
                    }
                  />
                </View>
              </View>
            </View>
          </>
        ) : (
          <EmptyState
            icon="building-2"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        )}
      </ScrollView>
      {data && data.priceFromTry !== null ? (
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
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSubtle">
              {t('stays.from')}
            </Text>
            <Text variant="h3" color="primary">
              {formatPriceTry(data.priceFromTry, locale)}
              <Text variant="caption" color="textSubtle">
                {' '}
                {t('stays.perNight')}
              </Text>
            </Text>
          </View>
          <Button
            label={t('stays.reserve')}
            icon="calendar-check"
            size="lg"
            onPress={() =>
              router.push({ pathname: '/stays/reserve', params: { businessId: data.id } })
            }
          />
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
  hero: { width: '100%', height: 340 },
  heroContent: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  amenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    height: 28,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contact: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
