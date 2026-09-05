import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { difficultyOf, formatDistance, type MapPack, type SavedRoute } from '@/domain';
import { PackCard } from '@/features/maps/components/PackCard';
import { DIFFICULTY_COLOR, PROFILE_ICON, formatMb } from '@/features/maps/components/meta';
import { useDownloadPack, useMapPacks, useRemovePack, useSavedRoutes } from '@/features/maps/hooks';

export default function MapsScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const packs = useMapPacks();
  const saved = useSavedRoutes();
  const download = useDownloadPack();
  const remove = useRemovePack();

  const list = packs.data ?? [];
  const downloadedPacks = list.filter((p) => p.status !== 'available');
  const availablePacks = list.filter((p) => p.status === 'available');
  const totalMb = downloadedPacks
    .filter((p) => p.status !== 'downloading')
    .reduce((acc, p) => acc + p.sizeMb, 0);

  const onDownload = (pack: MapPack) =>
    download.mutate(pack.id, {
      onSuccess: () => toast(t('maps.downloadStarted', { name: pack.name }), 'info'),
      onError: () => toast(t('common.error'), 'error'),
    });
  const onRemove = (pack: MapPack) =>
    remove.mutate(pack.id, {
      onSuccess: () => toast(t('maps.removed', { name: pack.name }), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('maps.title')} subtitle={t('maps.subtitle')} showBack />
      <View style={styles.content}>
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="h3">{t('maps.planner')}</Text>
            <Text variant="bodySm" color="textMuted">
              {t('maps.plannerSubtitle')}
            </Text>
          </View>
          <Button
            label={t('maps.openPlanner')}
            icon="route"
            size="sm"
            onPress={() => router.push('/maps/planner')}
          />
        </View>

        <SectionHeader
          title={t('maps.downloaded')}
          subtitle={
            downloadedPacks.length > 0
              ? t('maps.storageHint', {
                  count: downloadedPacks.length,
                  size: formatMb(totalMb, locale),
                })
              : undefined
          }
        />
        {packs.isError ? (
          <ErrorState onRetry={() => packs.refetch()} />
        ) : packs.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={96} style={{ borderRadius: radius.lg }} />)
        ) : downloadedPacks.length > 0 ? (
          downloadedPacks.map((p) => (
            <PackCard
              key={p.id}
              pack={p}
              onDownload={onDownload}
              onRemove={onRemove}
              busy={download.isPending && download.variables === p.id}
            />
          ))
        ) : (
          <EmptyState
            icon="hard-drive"
            title={t('maps.noDownloads')}
            description={t('maps.noDownloadsDescription')}
            compact
          />
        )}

        {availablePacks.length > 0 ? (
          <>
            <SectionHeader title={t('maps.available')} />
            {availablePacks.map((p) => (
              <PackCard
                key={p.id}
                pack={p}
                onDownload={onDownload}
                onRemove={onRemove}
                busy={download.isPending && download.variables === p.id}
              />
            ))}
          </>
        ) : null}

        <SectionHeader
          title={t('maps.savedRoutes')}
          actionLabel={t('maps.planner')}
          onAction={() => router.push('/maps/planner')}
        />
        {saved.isError ? (
          <ErrorState onRetry={() => saved.refetch()} />
        ) : saved.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={84} style={{ borderRadius: radius.lg }} />)
        ) : saved.data && saved.data.length > 0 ? (
          saved.data.map((r) => (
            <SavedRouteRow
              key={r.id}
              route={r}
              onPress={() => router.push({ pathname: '/maps/route/[id]', params: { id: r.id } })}
            />
          ))
        ) : (
          <EmptyState
            icon="waypoints"
            title={t('maps.noSavedRoutes')}
            description={t('maps.noSavedRoutesDescription')}
            compact
            action={{
              label: t('maps.planner'),
              icon: 'route',
              variant: 'secondary',
              onPress: () => router.push('/maps/planner'),
            }}
          />
        )}
      </View>
    </Screen>
  );
}

function SavedRouteRow({ route, onPress }: { route: SavedRoute; onPress: () => void }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const difficulty = difficultyOf(route.planned);
  return (
    <Card onPress={onPress} style={styles.routeCard}>
      <View style={[styles.routeIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={PROFILE_ICON[route.routeProfile]} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {route.name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {formatDistance(route.planned.distanceKm, locale)} · ↑{route.planned.ascentM} m ·{' '}
          {formatDuration(route.planned.durationMin, locale)}
        </Text>
      </View>
      <Badge
        label={t(`maps.difficulties.${difficulty}`)}
        color={DIFFICULTY_COLOR[difficulty]}
        soft
      />
    </Card>
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  routeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
