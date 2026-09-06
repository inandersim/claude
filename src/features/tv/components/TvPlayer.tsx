import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { WATCH_COMPLETED_RATIO, type TvProgramWithChannel } from '@/domain';

import { useSaveProgress } from '../hooks';

interface Props {
  program: TvProgramWithChannel;
  /** Kaldığı yerden başlatmak için saniye */
  initialPositionSec?: number;
  /** Aynı dizinin sonraki bölümü */
  next?: TvProgramWithChannel | null;
  onNext?: (next: TvProgramWithChannel) => void;
}

/**
 * Program oynatıcı (`expo-video`). Başlık/bölüm üst bilgisini çizer, ilerlemeyi
 * her saniye alıp 5 sn'de bir kaydeder; sona yaklaşınca "Sonraki bölüm" düğmesi çıkar.
 */
export function TvPlayer({ program, initialPositionSec = 0, next = null, onNext }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { save, flush } = useSaveProgress(program.id);
  const [nearEnd, setNearEnd] = useState(false);
  const [failed, setFailed] = useState(false);
  const seeked = useRef(false);
  // İlk konum yalnızca montajda okunur; sonraki ilerleme güncellemeleri seek tetiklemez.
  const startAt = useRef(initialPositionSec);

  const player = useVideoPlayer(program.videoUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    const status = player.addListener('statusChange', ({ status }) => {
      setFailed(status === 'error');
      if (status !== 'readyToPlay' || seeked.current) return;
      seeked.current = true;
      const position = startAt.current;
      if (position > 0 && position < player.duration) {
        // expo-video oynatıcısı mutasyonla yönetilen bir nesnedir.
        player.currentTime = position;
      }
      player.play();
    });
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      const duration = player.duration;
      if (!duration) return;
      save(currentTime, duration);
      setNearEnd(currentTime / duration >= WATCH_COMPLETED_RATIO);
    });
    const end = player.addListener('playToEnd', () => {
      const duration = player.duration;
      if (duration) save(duration, duration);
      flush();
      setNearEnd(true);
    });
    return () => {
      status.remove();
      time.remove();
      end.remove();
    };
  }, [player, save, flush]);

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture
      />
      {failed ? (
        <View style={styles.failed}>
          <ErrorState
            onRetry={() => {
              setFailed(false);
              seeked.current = false;
              player.replace(program.videoUrl, true);
            }}
          />
        </View>
      ) : null}
      <View style={styles.header} pointerEvents="none">
        <View style={styles.headerText}>
          <Text variant="caption" weight="bold" color="rgba(255,255,255,0.85)" numberOfLines={1}>
            {program.channel.name}
            {program.episode != null ? ` · ${t('tv.episode', { n: program.episode })}` : ''}
          </Text>
          <Text variant="bodySm" weight="extrabold" color="#FFFFFF" numberOfLines={1}>
            {program.seriesTitle ?? program.title}
          </Text>
        </View>
        <View style={styles.demo}>
          <Text variant="label" weight="extrabold" color="#FFFFFF">
            {t('tv.demoBadge')}
          </Text>
        </View>
      </View>
      {nearEnd && next && onNext ? (
        <Tappable
          onPress={() => onNext(next)}
          scaleTo={0.96}
          style={[styles.next, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={`${t('tv.nextEpisode')}: ${next.title}`}
        >
          <Icon name="chevron-right" size={16} color={colors.onPrimary} strokeWidth={2.6} />
          <View style={styles.nextText}>
            <Text variant="label" weight="extrabold" color={colors.onPrimary}>
              {t('tv.nextEpisode').toLocaleUpperCase(locale)}
            </Text>
            <Text variant="caption" weight="bold" color={colors.onPrimary} numberOfLines={1}>
              {next.title}
            </Text>
          </View>
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden' },
  // absoluteFill tek başına yetmez: <video> yerine geçen bir eleman olduğundan
  // web'de genişlik/yükseklik verilmezse doğal boyutunda (300×150) kalır.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  failed: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerText: { flex: 1, gap: 2 },
  demo: {
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  next: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xxxl + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    maxWidth: 240,
  },
  nextText: { flexShrink: 1 },
});
