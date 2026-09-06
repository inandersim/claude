import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import type { Lesson } from '@/domain';

interface Props {
  lesson: Lesson;
  /** Video sonuna gelince (isteğe bağlı) */
  onEnded?: () => void;
}

/**
 * Video dersi oynatıcı (`expo-video`). Demo URL'ler oynatılır; gerçek içerik
 * altyapısı bağlanana kadar yerel kontroller kullanılır.
 */
export function VideoLesson({ lesson, onEnded }: Props) {
  const { t } = useT();
  const source = lesson.videoUrl ?? null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = false;
  });

  React.useEffect(() => {
    if (!onEnded) return;
    const sub = player.addListener('playToEnd', onEnded);
    return () => sub.remove();
  }, [player, onEnded]);

  return (
    <View style={styles.root}>
      {source ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
          allowsPictureInPicture
        />
      ) : (
        <View style={styles.center}>
          <Icon name="video-off" size={28} color="#FFFFFF" />
          <Text variant="caption" color="#FFFFFF">
            {t('courses.videoLoading')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderRadius: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
