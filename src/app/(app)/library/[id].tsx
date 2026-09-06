import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  formatDistance,
  localizedPlaceName,
  mapsUrl,
  PLACE_KIND_META,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { HazardCard } from '@/features/hazards/components/HazardCard';
import { useHazards } from '@/features/hazards/hooks';
import { flagFor, PlaceCard } from '@/features/library/components/PlaceCard';
import { useLibraryPlace, useNearbyPlaces } from '@/features/library/hooks';

const TAG_LABELS: Record<string, string> = {
  fee: 'Ücret',
  drinking_water: 'İçme suyu',
  shower: 'Duş',
  toilets: 'Tuvalet',
  capacity: 'Kapasite',
  tents: 'Çadır',
  power_supply: 'Elektrik',
  internet_access: 'İnternet',
  reservation: 'Rezervasyon',
  permit: 'İzin',
  distance: 'Mesafe (km)',
  ascent: 'Tırmanış (m)',
  'climbing:routes': 'Rota sayısı',
  'climbing:grade:french:min': 'Min. derece',
  'climbing:grade:french:max': 'Maks. derece',
  'climbing:sport': 'Sport',
  'climbing:boulder': 'Boulder',
  'climbing:trad': 'Trad',
  'climbing:multipitch': 'Çok uzunluklu',
  'climbing:deepwater': 'Deep water solo',
  depth: 'Derinlik (m)',
  'scuba:visibility': 'Görüş (m)',
  'whitewater:rapid_grade': 'Akarsu derecesi',
  'piste:type': 'Pist türü',
  network: 'Ağ',
  cave: 'Mağara',
};

export default function LibraryPlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const place = useLibraryPlace(id, location.coords);
  const data = place.data;
  const origin = data ? { latitude: data.lat, longitude: data.lng } : null;
  const nearby = useNearbyPlaces(origin, 150, null, 6);
  const hazards = useHazards(origin, 40);
  const name = data ? localizedPlaceName(data, locale) : '';

  /** Yeri harita bağlantısı ve kaynak atfıyla paylaşır. */
  const onShare = () => {
    if (!data) return;
    Share.share({
      message: `${name} — ${mapsUrl(data.lat, data.lng, name)}\n${t('library.source')}: ${data.attribution}`,
    }).catch(() => undefined);
  };

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
          accessibilityLabel={t('common.back')}
        />
        <IconButton
          icon="share"
          variant="blur"
          onPress={onShare}
          disabled={!data}
          accessibilityLabel={t('common.share')}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {place.isError ? (
          <ErrorState onRetry={() => place.refetch()} />
        ) : place.isLoading ? (
          <Skeleton height={340} style={{ borderRadius: 0 }} />
        ) : data ? (
          <>
            <AdventureImage
              uri={data.image?.url ?? null}
              adventureType={data.adventureTypes[0] ?? 'hiking'}
              style={styles.hero}
              overlay
            >
              <View style={styles.heroContent}>
                <Badge
                  label={t(PLACE_KIND_META[data.kind].labelKey)}
                  color={PLACE_KIND_META[data.kind].color}
                  icon={PLACE_KIND_META[data.kind].icon}
                />
                <Text variant="display" color="#FFFFFF" style={{ fontSize: 30, lineHeight: 36 }}>
                  {name}
                </Text>
                <Text variant="bodySm" color="rgba(255,255,255,0.8)">
                  {flagFor(data.countryCode)} {data.countryCode ?? ''}
                  {data.elevationM !== null ? ` · ${Math.round(data.elevationM)} m` : ''}
                  {data.distanceKm !== null ? ` · ${formatDistance(data.distanceKm, locale)}` : ''}
                </Text>
              </View>
            </AdventureImage>
            {data.image ? (
              <Text variant="label" color="textSubtle" style={styles.credit}>
                {t('library.imageCredit')}: {data.image.attribution}
              </Text>
            ) : null}

            <View style={styles.body}>
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
              {data.description ? (
                <Text variant="body" color="textMuted">
                  {data.description}
                </Text>
              ) : null}

              {Object.keys(data.tags).length > 0 ? (
                <View
                  style={[
                    styles.facts,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text variant="h3" style={{ marginBottom: spacing.xs }}>
                    {t('library.details')}
                  </Text>
                  {Object.entries(data.tags).map(([k, v]) => (
                    <View key={k} style={[styles.fact, { borderTopColor: colors.border }]}>
                      <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                        {TAG_LABELS[k] ?? k}
                      </Text>
                      <Text variant="bodySm" weight="bold">
                        {v === 'yes' ? '✓' : v === 'no' ? '✕' : v}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View
                style={[
                  styles.facts,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Fact
                  icon="map-pin"
                  label={t('library.coordinates')}
                  value={`${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`}
                />
                {data.website ? (
                  <Fact
                    icon="globe"
                    label={t('library.website')}
                    value={data.website.replace(/^https?:\/\//, '')}
                    onPress={() => Linking.openURL(data.website!)}
                  />
                ) : null}
                {data.phone ? (
                  <Fact
                    icon="mail"
                    label={t('library.phone')}
                    value={data.phone}
                    onPress={() => Linking.openURL(`tel:${data.phone}`)}
                  />
                ) : null}
                {data.openingHours ? (
                  <Fact icon="clock" label={t('library.openingHours')} value={data.openingHours} />
                ) : null}
                <Fact icon="info" label={t('library.source')} value={data.attribution} />
              </View>
            </View>

            {hazards.data && hazards.data.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t('hazards.title')}
                  actionLabel={t('common.seeAll')}
                  onAction={() => router.push('/hazards')}
                />
                <View style={styles.list}>
                  {hazards.data.slice(0, 2).map((h) => (
                    <HazardCard key={h.id} hazard={h} compact />
                  ))}
                </View>
              </View>
            ) : null}

            {nearby.data && nearby.data.filter((p) => p.id !== data.id).length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('library.nearbyPlaces')} />
                <View style={styles.list}>
                  {nearby.data
                    .filter((p) => p.id !== data.id)
                    .slice(0, 5)
                    .map((p) => (
                      <PlaceCard key={p.id} place={p} row />
                    ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="globe"
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
          <Button
            label={t('library.openInMaps')}
            icon="navigation"
            size="lg"
            fullWidth
            onPress={() => Linking.openURL(mapsUrl(data.lat, data.lng, name))}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Fact({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { borderTopColor: colors.border }]}>
      <Icon name={icon} size={14} color={colors.textSubtle} />
      <Text variant="bodySm" color="textMuted" style={{ width: 96 }}>
        {label}
      </Text>
      <Text
        variant="bodySm"
        weight="bold"
        color={onPress ? 'primary' : 'text'}
        style={{ flex: 1 }}
        align="right"
        numberOfLines={2}
        onPress={onPress}
      >
        {value}
      </Text>
    </View>
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
    alignItems: 'flex-start',
  },
  credit: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  facts: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  section: { marginTop: spacing.xxl },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
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
