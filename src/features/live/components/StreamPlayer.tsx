import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';
import type { LiveStreamWithHost } from '@/domain';

import { LiveBadge } from './LiveBadge';

interface Props {
  stream: LiveStreamWithHost;
  muted?: boolean;
  /** Ekran kendi üst çubuğunu çiziyorsa rozetleri gizle. */
  showBadges?: boolean;
}

/**
 * Yayın oynatıcı. Canlı/tekrar için `playbackUrl` oynatılır; planlanmış yayında
 * küçük resim ve geri sayım gösterilir. Gerçek yayın altyapısı bağlanana kadar
 * demo akış kullanılır (bkz. docs/ARCHITECTURE.md).
 */
export function StreamPlayer({ stream, muted = false, showBadges = true }: Props) {
  const { t } = useT();
  const source = stream.playbackUrl ?? null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = stream.status === 'ended';
    p.muted = muted;
    if (source) p.play();
  });

  React.useEffect(() => {
    // expo-video oynatıcısı hook'tan gelen, mutasyonla yönetilen bir nesnedir.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [player, muted]);

  return (
    <View style={styles.root}>
      {source ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={stream.status === 'ended'}
          allowsPictureInPicture
        />
      ) : (
        <AdventureImage
          uri={stream.thumbnailUrl}
          adventureType={stream.adventureType}
          style={StyleSheet.absoluteFill}
          overlay
        >
          <View style={styles.center}>
            <Icon name="calendar" size={28} color="#FFFFFF" />
            <Text variant="title" color="#FFFFFF">
              {t('live.scheduled')}
            </Text>
          </View>
        </AdventureImage>
      )}
      {stream.droneTelemetry ? (
        <View style={styles.telemetry}>
          {[
            { icon: 'mountain-snow' as const, value: `${stream.droneTelemetry.altitudeM} m` },
            { icon: 'gauge' as const, value: `${stream.droneTelemetry.speedKmh} km/s` },
            { icon: 'zap' as const, value: `%${stream.droneTelemetry.batteryPct}` },
            { icon: 'navigation' as const, value: `${stream.droneTelemetry.headingDeg}°` },
          ].map((item) => (
            <View key={item.icon} style={styles.telemetryItem}>
              <Icon name={item.icon} size={11} color="#FFFFFF" strokeWidth={2.4} />
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {showBadges && stream.status === 'live' ? (
        <View style={styles.badges}>
          <LiveBadge />
          <View style={styles.demo}>
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {t('live.demoBadge')}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  telemetry: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  demo: {
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
});
