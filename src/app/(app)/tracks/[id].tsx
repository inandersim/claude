import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { confirmDialog } from '@/core/utils/confirm';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDate, formatDuration } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, DIFFICULTY_META, formatDistance, parcaZorlugu } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { PoiRow } from '@/features/tracks/components/PoiRow';
import { SourceBadge } from '@/features/tracks/components/SourceBadge';
import { TrackMapView } from '@/features/tracks/components/TrackMapView';
import { shareTrackGpx } from '@/features/tracks/gpx';
import { useConfirmPoi, usePublishTrack, useRemoveTrack, useTrack } from '@/features/tracks/hooks';

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();

  const track = useTrack(id ?? null);
  const publish = usePublishTrack();
  const remove = useRemoveTrack();
  const confirmPoi = useConfirmPoi();
  const [sharing, setSharing] = useState(false);

  const data = track.data ?? null;
  const isMine = data?.userId === me.id;

  const onPublish = () => {
    if (!data) return;
    publish.mutate(data.id, {
      onSuccess: (updated) => {
        toast(
          updated.communityTrailId
            ? t('tracks.publishedTrail', { name: updated.name })
            : t('tracks.published'),
          'success',
        );
      },
      onError: (e) => toast(e.message || t('common.error'), 'error'),
    });
  };

  const onDelete = () => {
    if (!data) return;
    const run = () =>
      remove.mutate(data.id, {
        onSuccess: () => {
          toast(t('tracks.deleted'), 'success');
          goBack(router, '/');
        },
        onError: () => toast(t('common.error'), 'error'),
      });
    if (Platform.OS === 'web') {
      run();
      return;
    }
    confirmDialog(
      t('tracks.delete'),
      t('tracks.deleteConfirm'),
      t('common.delete'),
      t('common.cancel'),
      run,
    );
  };

  const onShare = async () => {
    if (!data) return;
    setSharing(true);
    const result = await shareTrackGpx(data.points, data.name);
    setSharing(false);
    if (result === 'shared') toast(t('tracks.gpxShared'), 'success');
    else if (result === 'copied') toast(t('tracks.gpxCopied'), 'success');
    else toast(t('tracks.gpxFailed'), 'error');
  };

  const meta = data ? ADVENTURE_TYPE_META[data.adventureType] : null;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('tracks.title')}
        subtitle={data ? `${data.regionName} · ${formatDate(data.startedAt, locale)}` : undefined}
        showBack
        onBack={() => goBack(router, '/')}
        right={data ? <SourceBadge source={data.source} /> : undefined}
      />
      <View style={styles.content}>
        {track.isError ? (
          <ErrorState onRetry={() => track.refetch()} />
        ) : track.isLoading ? (
          <>
            <Skeleton height={280} style={{ borderRadius: radius.xl }} />
            <Skeleton height={64} style={{ borderRadius: radius.lg }} />
          </>
        ) : !data ? (
          <EmptyState icon="map-pin-off" title={t('tracks.notFound')} />
        ) : (
          <>
            <TrackMapView
              points={data.points}
              pois={data.pois}
              name={data.name}
              strokeColor={meta?.color}
            />

            <View style={styles.badges}>
              {meta ? (
                <Badge label={t(meta.labelKey)} color={meta.color} icon={meta.icon} soft />
              ) : null}
              {data.status === 'draft' ? (
                <Badge label={t('tracks.draft')} color={colors.warning} soft />
              ) : data.status === 'verified' ? (
                <Badge
                  label={t('tracks.verified')}
                  color={colors.success}
                  icon="badge-check"
                  soft
                />
              ) : (
                <Badge label={t('tracks.public')} color={colors.info} icon="globe" soft />
              )}
              {!data.isPublic ? (
                <Badge label={t('tracks.private')} color={colors.textSubtle} icon="lock" soft />
              ) : null}
              <Badge
                label={t(DIFFICULTY_META[parcaZorlugu(data)].labelKey)}
                color={DIFFICULTY_META[parcaZorlugu(data)].color}
                icon="gauge"
                soft
              />
            </View>

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
                value={formatAltitude(data.ascentM, locale)}
                color={colors.success}
                style={styles.tile}
              />
              <StatTile
                icon="timer"
                label={t('tracks.stats.duration')}
                value={formatDuration(data.durationMin, locale)}
                color={colors.info}
                style={styles.tile}
              />
              <StatTile
                icon="mountain-snow"
                label={t('tracks.stats.maxAlt')}
                value={
                  data.maxElevationM !== null ? formatAltitude(data.maxElevationM, locale) : '—'
                }
                color={colors.accent}
                style={styles.tile}
              />
              <StatTile
                icon="trending-down"
                label={t('tracks.stats.minAlt')}
                value={
                  data.minElevationM !== null ? formatAltitude(data.minElevationM, locale) : '—'
                }
                color={colors.info}
                style={styles.tile}
              />
            </View>

            <View style={styles.userRow}>
              <Avatar uri={data.user.avatarUrl} name={data.user.displayName} size={32} />
              <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                {t('tracks.by', { name: data.user.displayName })}
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                label={t('tracks.navigate')}
                icon="navigation"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: '/navigate/[id]',
                    params: { id: data.id, kind: 'track' },
                  })
                }
              />
              <Button
                label={t('tracks.exportGpx')}
                icon="share-2"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void onShare()}
                loading={sharing}
              />
            </View>
            {data.communityTrailId ? (
              <Button
                label={t('tracks.community.title')}
                icon="route"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/tracks/community/[id]',
                    params: { id: data.communityTrailId! },
                  })
                }
              />
            ) : null}

            {isMine ? (
              <View
                style={[
                  styles.ownerBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {data.status === 'draft' ? (
                  <>
                    <Text variant="caption" color="textMuted">
                      {t('tracks.publishHint')}
                    </Text>
                    <Button
                      label={t('tracks.publish')}
                      icon="globe"
                      onPress={onPublish}
                      loading={publish.isPending}
                      fullWidth
                    />
                  </>
                ) : null}
                <Button
                  label={t('tracks.delete')}
                  icon="trash"
                  variant="danger"
                  onPress={onDelete}
                  loading={remove.isPending}
                  fullWidth
                />
              </View>
            ) : null}

            <SectionHeader
              title={t('tracks.poi.onRoute')}
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  ownerBox: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
