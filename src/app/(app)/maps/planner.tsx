import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Input,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ROUTE_PROFILES,
  countryFlag,
  difficultyOf,
  offlinePackFor,
  type ID,
  type RouteProfile,
  type TrailNode,
} from '@/domain';
import { ElevationProfile } from '@/features/maps/components/ElevationProfile';
import { RouteMap } from '@/features/maps/components/RouteMap';
import { RouteStats } from '@/features/maps/components/RouteStats';
import { DIFFICULTY_COLOR, PROFILE_ICON, SURFACE_COLOR } from '@/features/maps/components/meta';
import { shareGpx } from '@/features/maps/gpx';
import {
  useMapPacks,
  usePlanRoute,
  useRegions,
  useSaveRoute,
  useTrailGraph,
} from '@/features/maps/hooks';

export default function RoutePlannerScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const regions = useRegions();
  const packs = useMapPacks();
  const [regionId, setRegionId] = useState<ID | null>(null);
  const [profile, setProfile] = useState<RouteProfile>('hike');
  const [startId, setStartId] = useState<ID | null>(null);
  const [endId, setEndId] = useState<ID | null>(null);
  const [name, setName] = useState('');
  const [sharing, setSharing] = useState(false);

  const activeRegionId = regionId ?? regions.data?.[0]?.id ?? null;
  const activeRegion = regions.data?.find((r) => r.id === activeRegionId) ?? null;
  const graph = useTrailGraph(activeRegionId);
  const plan = usePlanRoute(activeRegionId, startId, endId, profile);
  const save = useSaveRoute();

  const offlinePack = activeRegion ? offlinePackFor(packs.data ?? [], activeRegion.center) : null;
  const planned = plan.data ?? null;
  const difficulty = planned ? difficultyOf(planned) : null;

  const startNode = graph.data?.nodes.find((n) => n.id === startId) ?? null;
  const endNode = graph.data?.nodes.find((n) => n.id === endId) ?? null;

  const selectRegion = (id: ID) => {
    setRegionId(id);
    setStartId(null);
    setEndId(null);
  };

  /** İlk dokunuş başlangıç, ikinci bitiş; ikisi de doluysa yeni başlangıç. */
  const onNodePress = (node: TrailNode) => {
    if (!startId || (startId && endId)) {
      setStartId(node.id);
      setEndId(null);
      return;
    }
    if (node.id === startId) return;
    setEndId(node.id);
  };

  const clear = () => {
    setStartId(null);
    setEndId(null);
  };

  const swap = () => {
    setStartId(endId);
    setEndId(startId);
  };

  const onSave = () => {
    if (!planned || !activeRegionId) return;
    const routeName =
      name.trim() || `${startNode?.name ?? t('maps.start')} → ${endNode?.name ?? t('maps.end')}`;
    save.mutate(
      { regionId: activeRegionId, name: routeName, routeProfile: profile, planned },
      {
        onSuccess: (route) => {
          toast(t('maps.routeSaved'), 'success');
          setName('');
          router.push({ pathname: '/maps/route/[id]', params: { id: route.id } });
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  const onShare = async () => {
    if (!planned) return;
    setSharing(true);
    const routeName = name.trim() || `${startNode?.name ?? 'A'} → ${endNode?.name ?? 'B'}`;
    const result = await shareGpx(planned, routeName);
    setSharing(false);
    if (result === 'shared') toast(t('maps.gpxShared'), 'success');
    else if (result === 'copied') toast(t('maps.gpxCopied'), 'success');
    else toast(t('maps.gpxFailed'), 'error');
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('maps.planner')}
        subtitle={t('maps.plannerSubtitle')}
        showBack
        right={
          offlinePack ? (
            <Badge label={t('maps.offlineReady')} color={colors.success} icon="wifi-off" soft />
          ) : (
            <Badge label={t('maps.offlineMissing')} color={colors.warning} icon="download" soft />
          )
        }
      />
      <View style={styles.content}>
        {regions.isError ? (
          <ErrorState onRetry={() => regions.refetch()} />
        ) : regions.isLoading ? (
          <Skeleton height={36} style={{ borderRadius: radius.full }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={{ marginHorizontal: -spacing.lg }}
          >
            {(regions.data ?? []).map((r) => (
              <Chip
                key={r.id}
                label={`${countryFlag(r.countryCode)} ${r.name}`}
                selected={r.id === activeRegionId}
                onPress={() => selectRegion(r.id)}
              />
            ))}
          </ScrollView>
        )}

        <SegmentedControl
          segments={ROUTE_PROFILES.map((p) => ({ value: p, label: t(`maps.profiles.${p}`) }))}
          value={profile}
          onChange={setProfile}
        />

        {graph.isError ? (
          <ErrorState onRetry={() => graph.refetch()} />
        ) : graph.isLoading || !graph.data ? (
          <Skeleton height={320} style={{ borderRadius: radius.xl }} />
        ) : (
          <>
            <RouteMap
              graph={graph.data}
              routeNodeIds={planned?.nodeIds ?? []}
              startId={startId}
              endId={endId}
              onNodePress={onNodePress}
            />
            <View style={styles.legend}>
              {(Object.keys(SURFACE_COLOR) as (keyof typeof SURFACE_COLOR)[]).map((s) => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: SURFACE_COLOR[s] }]} />
                  <Text variant="caption" color="textSubtle">
                    {t(`maps.surfaces.${s}`)}
                  </Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendLine, styles.dashed, { borderColor: colors.textSubtle }]}
                />
                <Text variant="caption" color="textSubtle">
                  {t('maps.technicalEdge')}
                </Text>
              </View>
            </View>
          </>
        )}

        <View
          style={[
            styles.selection,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" color="textSubtle">
              {!startId ? t('maps.tapStart') : !endId ? t('maps.tapEnd') : t('maps.route')}
            </Text>
            <Text variant="bodySm" numberOfLines={2}>
              <Text variant="bodySm" color="success" weight="bold">
                A
              </Text>{' '}
              {startNode?.name ?? '—'}
              {'   '}
              <Text variant="bodySm" color="danger" weight="bold">
                B
              </Text>{' '}
              {endNode?.name ?? '—'}
            </Text>
          </View>
          <Button
            label={t('maps.swap')}
            icon="repeat"
            size="sm"
            variant="ghost"
            disabled={!startId || !endId}
            onPress={swap}
          />
          <Button
            label={t('maps.clear')}
            icon="x"
            size="sm"
            variant="ghost"
            disabled={!startId && !endId}
            onPress={clear}
          />
        </View>

        {plan.isFetching && !planned ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color="textMuted" align="center">
              {t('maps.planning')}
            </Text>
            <Skeleton height={88} style={{ borderRadius: radius.md }} />
          </View>
        ) : plan.isError ? (
          <EmptyState
            icon="map-pin-off"
            title={t('maps.noRoute')}
            description={t('maps.noRouteDescription')}
            compact
          />
        ) : planned && difficulty ? (
          <>
            <View style={styles.diffRow}>
              <Badge
                label={`${t('maps.difficulty')}: ${t(`maps.difficulties.${difficulty}`)}`}
                color={DIFFICULTY_COLOR[difficulty]}
                icon={PROFILE_ICON[profile]}
                soft
              />
              <Text variant="caption" color="textSubtle">
                {t('maps.nodes', { count: planned.nodeIds.length })}
              </Text>
            </View>
            <RouteStats planned={planned} />
            <ElevationProfile planned={planned} />

            <Input
              label={t('maps.routeName')}
              icon="bookmark"
              placeholder={t('maps.routeNamePlaceholder')}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
            <View style={styles.actions}>
              <Button
                label={t('maps.saveRoute')}
                icon="bookmark"
                loading={save.isPending}
                onPress={onSave}
                style={{ flex: 1 }}
              />
              <Button
                label={t('maps.gpxExport')}
                icon="share-2"
                variant="secondary"
                loading={sharing}
                onPress={onShare}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : null}
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
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendLine: { width: 14, height: 3, borderRadius: radius.full },
  dashed: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', height: 0 },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  diffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
