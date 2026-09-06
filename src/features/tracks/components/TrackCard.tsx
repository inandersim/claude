import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDuration } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, formatDistance, type TrackWithUser } from '@/domain';

import { SourceBadge } from './SourceBadge';

interface Props {
  track: TrackWithUser;
  onPress?: () => void;
}

/** Parça kartı: ad, kaynak rozeti, tür, km/tırmanış/süre, POI sayısı, kullanıcı */
export function TrackCard({ track, onPress }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = ADVENTURE_TYPE_META[track.adventureType];

  return (
    <Card onPress={onPress} padded>
      <View style={styles.top}>
        <View style={[styles.typeIcon, { backgroundColor: meta.softColor }]}>
          <Icon name={meta.icon} size={18} color={meta.color} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {track.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {track.regionName}
            {track.distanceFromMeKm !== null
              ? ` · ${formatDistance(track.distanceFromMeKm, locale)}`
              : ''}
          </Text>
        </View>
        <SourceBadge source={track.source} />
      </View>

      <View style={styles.stats}>
        <Stat icon="ruler" value={formatDistance(track.distanceKm, locale)} />
        <Stat icon="trending-up" value={formatAltitude(track.ascentM, locale)} />
        <Stat icon="timer" value={formatDuration(track.durationMin, locale)} />
        {track.poiCount > 0 ? (
          <Stat icon="map-pin" value={t('tracks.poiCount', { count: track.poiCount })} />
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Avatar uri={track.user.avatarUrl} name={track.user.displayName} size={22} />
        <Text variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
          {track.user.displayName}
        </Text>
        {track.status === 'draft' ? (
          <Badge label={t('tracks.draft')} color={colors.warning} soft />
        ) : track.status === 'verified' ? (
          <Badge label={t('tracks.verified')} color={colors.success} icon="badge-check" soft />
        ) : !track.isPublic ? (
          <Badge label={t('tracks.private')} color={colors.textSubtle} icon="lock" soft />
        ) : null}
      </View>
    </Card>
  );
}

function Stat({
  icon,
  value,
}: {
  icon: 'ruler' | 'trending-up' | 'timer' | 'map-pin';
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={13} color={colors.textSubtle} strokeWidth={2.4} />
      <Text variant="caption" color="textMuted">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
