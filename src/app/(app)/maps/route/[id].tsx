import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { confirmDialog } from '@/core/utils/confirm';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { countryFlag, difficultyOf, offlinePackFor } from '@/domain';
import { ElevationProfile } from '@/features/maps/components/ElevationProfile';
import { TrailMapView } from '@/features/maps/components/TrailMapView';
import { RouteStats } from '@/features/maps/components/RouteStats';
import { DIFFICULTY_COLOR, PROFILE_ICON } from '@/features/maps/components/meta';
import { shareGpx } from '@/features/maps/gpx';
import {
  useDeleteRoute,
  useMapPacks,
  useRegions,
  useSavedRoutes,
  useTrailGraph,
} from '@/features/maps/hooks';

export default function SavedRouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);

  const saved = useSavedRoutes();
  const route = saved.data?.find((r) => r.id === id) ?? null;
  const graph = useTrailGraph(route?.regionId ?? null);
  const regions = useRegions();
  const packs = useMapPacks();
  const remove = useDeleteRoute();

  const region = regions.data?.find((r) => r.id === route?.regionId) ?? null;
  const offlinePack = region ? offlinePackFor(packs.data ?? [], region.center) : null;
  const difficulty = route ? difficultyOf(route.planned) : null;

  const goBackToList = () => (router.canGoBack() ? router.back() : router.replace('/maps'));

  const confirmDelete = () => {
    if (!route) return;
    const run = () =>
      remove.mutate(route.id, {
        onSuccess: () => {
          toast(t('maps.routeDeleted'), 'success');
          goBackToList();
        },
        onError: () => toast(t('common.error'), 'error'),
      });
    if (Platform.OS === 'web') {
      run();
      return;
    }
    confirmDialog(
      t('maps.deleteRoute'),
      t('maps.deleteConfirm'),
      t('common.delete'),
      t('common.cancel'),
      run,
    );
  };

  const onShare = async () => {
    if (!route) return;
    setSharing(true);
    const result = await shareGpx(route.planned, route.name);
    setSharing(false);
    if (result === 'shared') toast(t('maps.gpxShared'), 'success');
    else if (result === 'copied') toast(t('maps.gpxCopied'), 'success');
    else toast(t('maps.gpxFailed'), 'error');
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={route?.name ?? t('maps.route')}
        subtitle={region ? `${countryFlag(region.countryCode)} ${region.name}` : undefined}
        showBack
        onBack={goBackToList}
        right={
          route ? (
            <IconButton
              icon="trash"
              variant="ghost"
              onPress={confirmDelete}
              accessibilityLabel={t('maps.deleteRoute')}
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {saved.isError ? (
          <ErrorState onRetry={() => saved.refetch()} />
        ) : saved.isLoading ? (
          <>
            <Skeleton height={300} style={{ borderRadius: radius.xl }} />
            <Skeleton height={88} style={{ borderRadius: radius.md }} />
          </>
        ) : !route || !difficulty ? (
          <EmptyState
            icon="map-pin-off"
            title={t('maps.routeNotFound')}
            action={{ label: t('maps.savedRoutes'), onPress: goBackToList, variant: 'secondary' }}
          />
        ) : (
          <>
            <View style={styles.badges}>
              <Badge
                label={t(`maps.profiles.${route.routeProfile}`)}
                color={colors.primary}
                icon={PROFILE_ICON[route.routeProfile]}
                soft
              />
              <Badge
                label={`${t('maps.difficulty')}: ${t(`maps.difficulties.${difficulty}`)}`}
                color={DIFFICULTY_COLOR[difficulty]}
                soft
              />
              {offlinePack ? (
                <Badge label={t('maps.offlineReady')} color={colors.success} icon="wifi-off" soft />
              ) : null}
            </View>

            {graph.isError ? (
              <ErrorState onRetry={() => graph.refetch()} />
            ) : graph.data ? (
              <TrailMapView
                graph={graph.data}
                center={region?.center ?? null}
                routeNodeIds={route.planned.nodeIds}
                routePoints={route.planned.points}
                startId={route.planned.nodeIds[0] ?? null}
                endId={route.planned.nodeIds[route.planned.nodeIds.length - 1] ?? null}
                height={300}
              />
            ) : (
              <Skeleton height={300} style={{ borderRadius: radius.xl }} />
            )}

            <RouteStats planned={route.planned} />
            <ElevationProfile planned={route.planned} />

            <Text variant="caption" color="textSubtle">
              {t('maps.createdAt', { date: formatDate(route.createdAt, locale) })}
            </Text>

            <View style={styles.actions}>
              <Button
                label={t('maps.gpxExport')}
                icon="share-2"
                loading={sharing}
                onPress={onShare}
                style={{ flex: 1 }}
              />
              <Button
                label={t('maps.deleteRoute')}
                icon="trash"
                variant="danger"
                loading={remove.isPending}
                onPress={confirmDelete}
                style={{ flex: 1 }}
              />
            </View>
          </>
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
