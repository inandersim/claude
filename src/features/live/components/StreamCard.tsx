import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate, formatRelative } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, type LiveStreamWithHost } from '@/domain';

import { LiveBadge } from './LiveBadge';

interface Props {
  stream: LiveStreamWithHost;
  width?: number;
  /** Küçük yatay satır düzeni (yaklaşan / tekrar) */
  row?: boolean;
}

export function StreamCard({ stream, width, row = false }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = ADVENTURE_TYPE_META[stream.adventureType];
  const open = () => router.push({ pathname: '/live/[id]', params: { id: stream.id } });

  if (row) {
    return (
      <Tappable
        onPress={open}
        scaleTo={0.98}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={stream.title}
      >
        <AdventureImage
          uri={stream.thumbnailUrl}
          adventureType={stream.adventureType}
          style={styles.rowThumb}
        >
          <View style={styles.rowPlay}>
            <Icon
              name={stream.status === 'scheduled' ? 'calendar' : 'play'}
              size={16}
              color="#FFFFFF"
              fill={stream.status === 'scheduled' ? 'none' : '#FFFFFF'}
            />
          </View>
        </AdventureImage>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.rowTop}>
            <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color={meta.color}>
              {t(meta.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          <Text variant="title" numberOfLines={2}>
            {stream.title}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {stream.host.displayName} ·{' '}
            {stream.status === 'scheduled' && stream.scheduledAt
              ? `${t('live.startsAt')}: ${formatDate(stream.scheduledAt, locale, 'd MMM HH:mm')}`
              : `${formatCompact(stream.peakViewers, locale)} ${t('live.viewers')} · ${formatRelative(stream.endedAt ?? stream.startedAt ?? stream.scheduledAt ?? '', new Date(), locale)}`}
          </Text>
        </View>
      </Tappable>
    );
  }

  return (
    <Tappable
      onPress={open}
      scaleTo={0.97}
      style={[styles.card, width ? { width } : styles.full]}
      accessibilityRole="button"
      accessibilityLabel={stream.title}
    >
      <AdventureImage
        uri={stream.thumbnailUrl}
        adventureType={stream.adventureType}
        style={styles.cover}
        overlay
      >
        <View style={styles.top}>
          <View style={styles.badges}>
            <LiveBadge />
            {stream.source === 'drone' ? (
              <View style={styles.droneBadge}>
                <Icon name="radio-tower" size={11} color="#06120B" strokeWidth={2.8} />
                <Text variant="label" weight="extrabold" color="#06120B">
                  {t('drone.badge')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.viewers}>
            <Icon name="eye" size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {formatCompact(stream.viewerCount, locale)}
            </Text>
          </View>
        </View>
        {stream.altitudeM !== null ? (
          <View style={styles.altitude}>
            <Icon name="mountain-snow" size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {stream.altitudeM} m
            </Text>
          </View>
        ) : null}
        <View style={styles.bottom}>
          <View style={styles.hostRow}>
            <Avatar
              uri={stream.host.avatarUrl}
              name={stream.host.displayName}
              size={28}
              verified={stream.host.isVerified}
            />
            <Text
              variant="caption"
              weight="bold"
              color="#FFFFFF"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {stream.host.displayName}
            </Text>
          </View>
          <Text variant="h3" color="#FFFFFF" numberOfLines={2}>
            {stream.title}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={12} color="rgba(255,255,255,0.75)" />
            <Text variant="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>
              {stream.locationName}
            </Text>
          </View>
        </View>
      </AdventureImage>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  full: { width: '100%' },
  cover: { aspectRatio: 0.8, width: '100%', borderRadius: radius.xl },
  top: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: { flexDirection: 'row', gap: 6 },
  droneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: '#6CB4FF',
  },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  altitude: {
    position: 'absolute',
    top: spacing.md + 32,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  bottom: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 6 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowThumb: { width: 110, height: 78, borderRadius: radius.md },
  rowPlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
