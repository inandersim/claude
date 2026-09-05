import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AdventureImage,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  SkeletonGroup,
  StatTile,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import {
  bestSeasonLabel,
  countryFlag,
  cragSummary,
  formatDistance,
  isInSeason,
  CLIMB_TYPES,
  type ID,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { GradeHistogram } from '@/features/climbing/components/GradeHistogram';
import { GradeSystemPicker } from '@/features/climbing/components/GradeSystemPicker';
import { RouteRow } from '@/features/climbing/components/RouteRow';
import { VerificationBadge } from '@/features/climbing/components/VerificationBadge';
import { useClimbingRoutes, useCrag, useGradeSystem, useSectors } from '@/features/climbing/hooks';
import { CLIMB_TYPE_META } from '@/features/climbing/meta';

export default function CragDetailScreen() {
  const { cragId } = useLocalSearchParams<{ cragId: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const { system, setGradeSystem } = useGradeSystem();
  const [now] = useState(() => new Date());
  const [sectorId, setSectorId] = useState<ID | null>(null);

  const crag = useCrag(cragId, location.coords);
  const sectors = useSectors(cragId);
  const allRoutes = useClimbingRoutes(cragId, null);
  const routes = useClimbingRoutes(cragId, sectorId);

  const summary = useMemo(() => cragSummary(allRoutes.data ?? []), [allRoutes.data]);
  const sectorById = useMemo(
    () => new Map((sectors.data ?? []).map((s) => [s.id, s])),
    [sectors.data],
  );
  const data = crag.data;
  const inSeason = data ? isInSeason(data.seasons, now) : false;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('climbing.title')}
        subtitle={data?.locationName}
        showBack
        right={
          <IconButton
            icon="plus"
            variant="filled"
            onPress={() =>
              router.push({
                pathname: '/climbing/submit',
                params: { cragId, sectorId: sectorId ?? '' },
              })
            }
            accessibilityLabel={t('climbing.submitRoute')}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {crag.isError ? (
          <ErrorState onRetry={() => crag.refetch()} />
        ) : crag.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={220} style={{ borderRadius: radius.xl }} />
            <Skeleton height={90} style={{ borderRadius: radius.xl }} />
            <Skeleton height={160} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : data ? (
          <>
            <AdventureImage
              uri={data.imageUrl}
              adventureType="climbing"
              style={styles.cover}
              overlay
            >
              <View style={styles.coverTop}>
                <VerificationBadge status={data.verification} />
                <View style={{ flex: 1 }} />
                {data.distanceKm !== null ? (
                  <View style={styles.pill}>
                    <Icon name="navigation" size={12} color="#F2F7F4" strokeWidth={2.4} />
                    <Text variant="label" weight="extrabold" color="#F2F7F4">
                      {formatDistance(data.distanceKm, locale)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="h1" color="#FFFFFF" numberOfLines={2}>
                  {countryFlag(data.countryCode)} {data.name}
                </Text>
                <View style={styles.types}>
                  {data.climbTypes.map((type) => (
                    <View key={type} style={styles.pill}>
                      <Icon
                        name={CLIMB_TYPE_META[type].icon}
                        size={12}
                        color={CLIMB_TYPE_META[type].color}
                        strokeWidth={2.4}
                      />
                      <Text variant="label" weight="bold" color="#F2F7F4">
                        {t(CLIMB_TYPE_META[type].labelKey)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </AdventureImage>

            <Text variant="body" color="textMuted">
              {data.description}
            </Text>

            <View style={styles.tiles}>
              <StatTile
                icon="route"
                label={t('climbing.routes')}
                value={`${data.routeCount}`}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="star"
                label={t('climbing.avgStars')}
                value={summary.total ? summary.avgStars.toFixed(1) : '–'}
                color={colors.accent}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="footprints"
                label={t('climbing.approach')}
                value={formatDuration(data.approachMin, locale)}
                color={colors.info}
                compact
                style={styles.tile}
              />
              <StatTile
                icon={inSeason ? 'sun' : 'calendar'}
                label={t('climbing.seasons')}
                value={bestSeasonLabel(data.seasons, locale)}
                color={inSeason ? colors.success : colors.warning}
                compact
                style={styles.tile}
              />
            </View>

            <View
              style={[
                styles.facts,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Fact icon="layers" label={t('climbing.rockType')} value={data.rockType} />
              <Fact
                icon="hexagon"
                label={t('climbing.sectors')}
                value={t('climbing.sectorsCount', { count: sectors.data?.length ?? 0 })}
              />
              <Fact
                icon="chart-bar"
                label={t('climbing.overview')}
                value={CLIMB_TYPES.filter((ct) => summary.byType[ct])
                  .map((ct) => `${summary.byType[ct]} ${t(CLIMB_TYPE_META[ct].labelKey)}`)
                  .join(' · ')}
                last
              />
            </View>

            {allRoutes.data?.length ? <GradeHistogram histogram={summary.histogram} /> : null}

            <VerificationBadge status={data.verification} explained />

            <GradeSystemPicker value={system} onChange={setGradeSystem} />

            <View>
              <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                {t('climbing.sectors')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                style={{ marginHorizontal: -spacing.lg }}
              >
                <Chip
                  label={`${t('climbing.allSectors')} · ${data.routeCount}`}
                  selected={sectorId === null}
                  onPress={() => setSectorId(null)}
                />
                {(sectors.data ?? []).map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.name} · ${s.routeCount}`}
                    selected={sectorId === s.id}
                    onPress={() => setSectorId(sectorId === s.id ? null : s.id)}
                  />
                ))}
              </ScrollView>
            </View>

            {routes.isError ? (
              <ErrorState onRetry={() => routes.refetch()} />
            ) : routes.isLoading ? (
              <SkeletonGroup>
                <Skeleton height={64} style={{ borderRadius: radius.lg }} />
                <Skeleton height={64} style={{ borderRadius: radius.lg }} />
                <Skeleton height={64} style={{ borderRadius: radius.lg }} />
              </SkeletonGroup>
            ) : (routes.data ?? []).length === 0 ? (
              <EmptyState
                compact
                icon="route"
                title={t('climbing.emptyRoutes')}
                description={t('climbing.emptyRoutesDescription')}
                action={{
                  label: t('climbing.submitRoute'),
                  icon: 'plus',
                  variant: 'secondary',
                  onPress: () =>
                    router.push({
                      pathname: '/climbing/submit',
                      params: { cragId, sectorId: sectorId ?? '' },
                    }),
                }}
              />
            ) : (
              <View style={styles.list}>
                {(routes.data ?? []).map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    preferredSystem={system}
                    subtitle={sectorId ? undefined : sectorById.get(route.sectorId)?.name}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <EmptyState
            icon="compass"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Fact({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fact,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Icon name={icon} size={16} color={colors.textSubtle} />
      <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySm" weight="bold" style={{ flexShrink: 1 }} align="right">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  cover: {
    height: 240,
    borderRadius: radius.xl,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  facts: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: { gap: spacing.sm },
});
