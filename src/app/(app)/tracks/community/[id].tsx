import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, formatDistance } from '@/domain';
import { VERIFY_THRESHOLD, verifyThreshold } from '@/domain/tracks';
import { PoiRow } from '@/features/tracks/components/PoiRow';
import { TrackMap } from '@/features/tracks/components/TrackMap';
import { useCommunityTrail, useConfirmPoi, useVerifyTrail } from '@/features/tracks/hooks';

export default function CommunityTrailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const trail = useCommunityTrail(id ?? null);
  const verify = useVerifyTrail();
  const confirmPoi = useConfirmPoi();
  const data = trail.data ?? null;
  const meta = data ? ADVENTURE_TYPE_META[data.adventureType] : null;
  const verified = data ? verifyThreshold(data.verifiedCount) : false;

  const onVerify = () => {
    if (!data) return;
    verify.mutate(data.id, {
      onSuccess: () => toast(t('tracks.verifiedToast'), 'success'),
      onError: (e) =>
        toast(
          e.message.includes('zaten') ? t('tracks.alreadyVerified') : t('common.error'),
          'error',
        ),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('tracks.community.title')}
        subtitle={
          data
            ? `${data.regionName} · ${t('tracks.community.derivedFrom', { count: data.trackCount })}`
            : undefined
        }
        showBack
        onBack={() => goBack(router, '/')}
        right={
          verified ? (
            <Badge label={t('tracks.verified')} color={colors.success} icon="badge-check" soft />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {trail.isError ? (
          <ErrorState onRetry={() => trail.refetch()} />
        ) : trail.isLoading ? (
          <>
            <Skeleton height={280} style={{ borderRadius: radius.xl }} />
            <Skeleton height={64} style={{ borderRadius: radius.lg }} />
          </>
        ) : !data ? (
          <EmptyState icon="map-pin-off" title={t('tracks.trailNotFound')} />
        ) : (
          <>
            <TrackMap
              points={data.points}
              pois={data.pois}
              name={data.name}
              strokeColor={meta?.color}
            />

            <View style={styles.stats}>
              <StatTile
                icon="ruler"
                label={t('tracks.stats.distance')}
                value={formatDistance(data.distanceKm, locale)}
                style={styles.tile}
              />
              <StatTile
                icon="trending-up"
                label={t('tracks.stats.ascent')}
                value={`${data.ascentM} m`}
                color={colors.success}
                style={styles.tile}
              />
              <StatTile
                icon="users"
                label={t('tracks.contributors')}
                value={String(data.contributors.length)}
                color={colors.info}
                style={styles.tile}
              />
              <StatTile
                icon="star"
                label={t('tracks.community.popularity')}
                value={String(data.popularity)}
                color={colors.accent}
                style={styles.tile}
              />
            </View>

            <View
              style={[
                styles.verifyBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ProgressRing
                value={Math.min(1, data.verifiedCount / VERIFY_THRESHOLD)}
                size={56}
                color={verified ? colors.success : colors.primary}
              >
                <Text variant="caption" weight="bold">
                  {data.verifiedCount}
                </Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">
                  {t('tracks.verifiedCount', { count: data.verifiedCount })}
                </Text>
                <Text variant="caption" color="textMuted">
                  {verified
                    ? t('tracks.verified')
                    : t('tracks.community.verifyHint', {
                        count: VERIFY_THRESHOLD - data.verifiedCount,
                      })}
                </Text>
              </View>
            </View>
            <Button
              label={t('tracks.verify')}
              icon="check-check"
              variant="secondary"
              onPress={onVerify}
              loading={verify.isPending}
              fullWidth
            />

            <View style={styles.actions}>
              <Button
                label={t('tracks.navigate')}
                icon="navigation"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: '/navigate/[id]',
                    params: { id: data.id, kind: 'community' },
                  })
                }
              />
              <Button
                label={t('tracks.openInPlanner')}
                icon="route"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push('/maps/planner')}
              />
            </View>

            <SectionHeader
              title={t('tracks.contributors')}
              subtitle={t('tracks.community.updated', { date: formatDate(data.updatedAt, locale) })}
            />
            <View style={styles.contributors}>
              {data.contributors.map((u) => (
                <View key={u.id} style={styles.contributor}>
                  <Avatar
                    uri={u.avatarUrl}
                    name={u.displayName}
                    size={40}
                    verified={u.isVerified}
                  />
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {u.displayName.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </View>

            <SectionHeader
              title={t('tracks.community.pois')}
              subtitle={t('tracks.poiCount', { count: data.pois.length })}
            />
            {data.pois.length === 0 ? (
              <EmptyState icon="map-pin" title={t('tracks.emptyPois')} compact />
            ) : (
              data.pois.map((poi) => (
                <PoiRow
                  key={poi.id}
                  poi={poi}
                  onConfirm={() =>
                    confirmPoi.mutate(poi.id, {
                      onSuccess: () => toast(t('tracks.poi.confirmedToast'), 'success'),
                      onError: (e) => toast(e.message || t('common.error'), 'error'),
                    })
                  }
                  confirming={confirmPoi.isPending}
                />
              ))
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  verifyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  contributors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  contributor: { alignItems: 'center', gap: 4, width: 56 },
});
