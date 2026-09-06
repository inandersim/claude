import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  POI_KINDS,
  type AdventureType,
  type PoiKind,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CommunityTrailCard } from '@/features/tracks/components/CommunityTrailCard';
import { PoiChip, PoiRow } from '@/features/tracks/components/PoiRow';
import { TrackCard } from '@/features/tracks/components/TrackCard';
import {
  useAddPoi,
  useCommunityTrails,
  useConfirmPoi,
  usePoisNear,
  useSuggestedPois,
  useTracks,
} from '@/features/tracks/hooks';

type Tab = 'community' | 'mine' | 'pois';

/** Topluluk rotaları için yarıçap seçenekleri; `null` = tüm bölgeler */
const TRAIL_RADII: (number | null)[] = [50, 250, 1000, null];

export default function TracksScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const [tab, setTab] = useState<Tab>('community');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<AdventureType | null>(null);
  const [poiKind, setPoiKind] = useState<PoiKind | null>(null);
  const [trailRadiusKm, setTrailRadiusKm] = useState<number | null>(null);

  // radiusKm null → repo varsayılanı (150 km) devreye girmesin diye çok geniş bir yarıçap
  const trails = useCommunityTrails(location.coords, trailRadiusKm ?? 40_000);
  const mine = useTracks({ mineOnly: true, query, adventureType: type });
  const pois = usePoisNear(location.coords, 300, poiKind);
  const suggested = useSuggestedPois(location.coords);
  const addPoi = useAddPoi();
  const confirmPoi = useConfirmPoi();

  const suggestions = suggested.data ?? [];

  const acceptSuggestion = (index: number) => {
    const poi = suggestions[index];
    if (!poi) return;
    const { id: _id, userId: _u, confirmations: _c, createdAt: _d, ...input } = poi;
    addPoi.mutate(input, {
      onSuccess: () => {
        toast(t('tracks.suggestedAccepted'), 'success');
        void suggested.refetch();
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  };

  const onConfirm = (poiId: string) =>
    confirmPoi.mutate(poiId, {
      onSuccess: () => toast(t('tracks.poi.confirmedToast'), 'success'),
      onError: (e) => toast(e.message || t('common.error'), 'error'),
    });

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('tracks.title')} subtitle={t('tracks.subtitle')} showBack />
      <View style={styles.content}>
        <View style={styles.actions}>
          <Button
            label={t('tracks.record')}
            icon="locate-fixed"
            style={{ flex: 1 }}
            onPress={() => router.push('/tracks/record')}
          />
          <Button
            label={t('tracks.import')}
            icon="upload"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/tracks/import')}
          />
        </View>

        {suggestions.length > 0 ? (
          <Tappable
            onPress={() => setTab('pois')}
            style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('tracks.suggestedBanner', { count: suggestions.length })}
          >
            <Icon name="sparkles" size={18} color={colors.accent} strokeWidth={2.4} />
            <Text variant="bodySm" weight="bold" style={{ flex: 1 }}>
              {t('tracks.suggestedBanner', { count: suggestions.length })}
            </Text>
            <Icon name="chevron-right" size={16} color={colors.textSubtle} />
          </Tappable>
        ) : null}

        <SegmentedControl<Tab>
          segments={[
            { value: 'community', label: t('tracks.tabs.community'), badge: trails.data?.length },
            { value: 'mine', label: t('tracks.tabs.mine'), badge: mine.data?.length },
            { value: 'pois', label: t('tracks.tabs.pois'), badge: pois.data?.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'community' ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('tracks.nearbyTrails')}
              subtitle={
                trailRadiusKm ? t('tracks.poi.radius', { km: trailRadiusKm }) : t('common.all')
              }
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={{ marginHorizontal: -spacing.lg }}
            >
              {TRAIL_RADII.map((km) => (
                <Chip
                  key={km ?? 'all'}
                  label={km ? `${km} km` : t('common.all')}
                  selected={trailRadiusKm === km}
                  onPress={() => setTrailRadiusKm(km)}
                  size="sm"
                />
              ))}
            </ScrollView>
            {trails.isError ? (
              <ErrorState onRetry={() => trails.refetch()} />
            ) : trails.isLoading ? (
              <>
                <Skeleton height={150} style={{ borderRadius: radius.xl }} />
                <Skeleton height={150} style={{ borderRadius: radius.xl }} />
              </>
            ) : (trails.data ?? []).length === 0 ? (
              <EmptyState
                icon="route"
                title={t('tracks.emptyTrails')}
                description={t('tracks.emptyTrailsDescription')}
                action={{
                  label: t('tracks.record'),
                  icon: 'locate-fixed',
                  onPress: () => router.push('/tracks/record'),
                }}
              />
            ) : (
              (trails.data ?? []).map((trail) => (
                <CommunityTrailCard
                  key={trail.id}
                  trail={trail}
                  onPress={() =>
                    router.push({ pathname: '/tracks/community/[id]', params: { id: trail.id } })
                  }
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'mine' ? (
          <View style={styles.section}>
            <Input
              icon="search"
              placeholder={t('tracks.searchPlaceholder')}
              value={query}
              onChangeText={setQuery}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={{ marginHorizontal: -spacing.lg }}
            >
              <Chip
                label={t('common.all')}
                selected={type === null}
                onPress={() => setType(null)}
                size="sm"
              />
              {ADVENTURE_TYPES.map((a) => (
                <Chip
                  key={a}
                  label={t(ADVENTURE_TYPE_META[a].labelKey)}
                  icon={ADVENTURE_TYPE_META[a].icon}
                  color={ADVENTURE_TYPE_META[a].color}
                  selected={type === a}
                  onPress={() => setType(type === a ? null : a)}
                  size="sm"
                />
              ))}
            </ScrollView>
            {mine.isError ? (
              <ErrorState onRetry={() => mine.refetch()} />
            ) : mine.isLoading ? (
              <>
                <Skeleton height={140} style={{ borderRadius: radius.xl }} />
                <Skeleton height={140} style={{ borderRadius: radius.xl }} />
              </>
            ) : (mine.data ?? []).length === 0 ? (
              <EmptyState
                icon="footprints"
                title={t('tracks.emptyMine')}
                description={t('tracks.emptyMineDescription')}
                action={{
                  label: t('tracks.import'),
                  icon: 'upload',
                  onPress: () => router.push('/tracks/import'),
                }}
              />
            ) : (
              (mine.data ?? []).map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onPress={() =>
                    router.push({ pathname: '/tracks/[id]', params: { id: track.id } })
                  }
                />
              ))
            )}
          </View>
        ) : null}

        {tab === 'pois' ? (
          <View style={styles.section}>
            {suggestions.length > 0 ? (
              <View
                style={[
                  styles.suggestedBox,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <SectionHeader
                  title={t('tracks.suggestedTitle')}
                  subtitle={t('tracks.suggestedDescription')}
                />
                {suggestions.slice(0, 4).map((poi, i) => (
                  <PoiRow
                    key={poi.id}
                    poi={poi}
                    actionLabel={t('tracks.suggestedAccept')}
                    onAction={() => acceptSuggestion(i)}
                  />
                ))}
              </View>
            ) : null}
            <SectionHeader
              title={t('tracks.poi.nearby')}
              subtitle={t('tracks.poi.radius', { km: 300 })}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/tracks/pois')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={{ marginHorizontal: -spacing.lg }}
            >
              <Chip
                label={t('tracks.poi.allKinds')}
                selected={poiKind === null}
                onPress={() => setPoiKind(null)}
                size="sm"
              />
              {POI_KINDS.map((k) => (
                <PoiChip
                  key={k}
                  kind={k}
                  size="sm"
                  selected={poiKind === k}
                  onPress={() => setPoiKind(poiKind === k ? null : k)}
                />
              ))}
            </ScrollView>
            {pois.isError ? (
              <ErrorState onRetry={() => pois.refetch()} />
            ) : pois.isLoading ? (
              <>
                <Skeleton height={76} style={{ borderRadius: radius.lg }} />
                <Skeleton height={76} style={{ borderRadius: radius.lg }} />
              </>
            ) : (pois.data ?? []).length === 0 ? (
              <EmptyState
                icon="map-pin"
                title={t('tracks.emptyPois')}
                description={t('tracks.emptyPoisDescription')}
                action={{
                  label: t('tracks.poi.add'),
                  icon: 'plus',
                  onPress: () => router.push('/tracks/pois'),
                }}
              />
            ) : (
              (pois.data ?? [])
                .slice(0, 8)
                .map((poi) => (
                  <PoiRow
                    key={poi.id}
                    poi={poi}
                    onConfirm={() => onConfirm(poi.id)}
                    confirming={confirmPoi.isPending}
                  />
                ))
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  actions: { flexDirection: 'row', gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  suggestedBox: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
