import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { formatAltitude, formatTemperature } from '@/core/utils/format';
import { formatDuration } from '@/core/utils/time';
import { formatDistance, type Post } from '@/domain';

interface Props {
  post: Pick<Post, 'altitudeM' | 'distanceKm' | 'temperatureC' | 'windKmh' | 'durationMin'>;
  compact?: boolean;
}

/** İrtifa / mesafe / sıcaklık / rüzgar teknik verileri. */
export function PostMetrics({ post, compact = false }: Props) {
  const { t, locale } = useT();
  return (
    <View style={styles.grid}>
      <StatTile
        compact={compact}
        icon="mountain-snow"
        label={t('home.altitude')}
        value={formatAltitude(post.altitudeM, locale)}
        color="#6CB4FF"
        style={styles.tile}
      />
      <StatTile
        compact={compact}
        icon="route"
        label={t('home.distance')}
        value={formatDistance(post.distanceKm, locale)}
        color="#5EE39B"
        style={styles.tile}
      />
      <StatTile
        compact={compact}
        icon="thermometer"
        label={t('home.temperature')}
        value={formatTemperature(post.temperatureC)}
        color="#FFB547"
        style={styles.tile}
      />
      <StatTile
        compact={compact}
        icon="wind"
        label={t('home.wind')}
        value={`${post.windKmh} km/s`}
        color="#CE93D8"
        style={styles.tile}
      />
      {!compact ? (
        <StatTile
          icon="timer"
          label={t('home.duration')}
          value={formatDuration(post.durationMin, locale)}
          color="#FF8A5B"
          style={styles.tile}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%' },
});
