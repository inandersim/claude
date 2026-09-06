import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, formatDistance, type CommunityTrailWithDetails } from '@/domain';
import { verifyThreshold } from '@/domain/tracks';

interface Props {
  trail: CommunityTrailWithDetails;
  onPress?: () => void;
}

/** Topluluk rotası kartı: ad, mesafe/tırmanış, doğrulama ve katkı sayısı, avatar dizisi */
export function CommunityTrailCard({ trail, onPress }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = ADVENTURE_TYPE_META[trail.adventureType];
  const verified = verifyThreshold(trail.verifiedCount);

  return (
    <Card onPress={onPress} padded>
      <View style={styles.top}>
        <View style={[styles.typeIcon, { backgroundColor: meta.softColor }]}>
          <Icon name={meta.icon} size={18} color={meta.color} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {trail.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {trail.regionName}
            {trail.distanceFromMeKm !== null
              ? ` · ${formatDistance(trail.distanceFromMeKm, locale)}`
              : ''}
          </Text>
        </View>
        {verified ? (
          <Badge label={t('tracks.verified')} color={colors.success} icon="badge-check" soft />
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat icon="ruler" value={formatDistance(trail.distanceKm, locale)} />
        <Stat icon="trending-up" value={formatAltitude(trail.ascentM, locale)} />
        <Stat icon="map-pin" value={t('tracks.poiCount', { count: trail.pois.length })} />
        <Stat
          icon="check-check"
          value={t('tracks.verifiedCount', { count: trail.verifiedCount })}
        />
      </View>

      <View style={styles.bottom}>
        <View style={styles.avatars}>
          {trail.contributors.slice(0, 4).map((u, i) => (
            <View
              key={u.id}
              style={[styles.avatar, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.surface }]}
            >
              <Avatar uri={u.avatarUrl} name={u.displayName} size={24} />
            </View>
          ))}
        </View>
        <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
          {t('tracks.trackCount', { count: trail.trackCount })} ·{' '}
          {t('tracks.contributorsCount', { count: trail.contributors.length })}
        </Text>
      </View>
    </Card>
  );
}

function Stat({
  icon,
  value,
}: {
  icon: 'ruler' | 'trending-up' | 'map-pin' | 'check-check';
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
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { borderRadius: 14, borderWidth: 2 },
});
