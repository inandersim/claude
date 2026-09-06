import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  ProgressRing,
  Screen,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { guideDurationMin, heritageSiteScript } from '@/domain';
import { AudioGuideStopCard } from '@/features/heritage/components/AudioGuideStop';
import { useAudioGuide, useHeritageSite, useSpeech } from '@/features/heritage/hooks';

export default function AudioGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const speech = useSpeech();
  const [index, setIndex] = useState(0);

  const site = useHeritageSite(id, null);
  const guide = useAudioGuide(id);
  const stops = useMemo(() => guide.data ?? [], [guide.data]);
  const current = stops[index];
  const total = stops.length;
  const totalMin = guideDurationMin(stops);
  const lang = locale === 'tr' ? 'tr-TR' : 'en-US';

  const read = (key: string, text: string) => {
    if (!speech.supported) {
      toast(t('heritage.speechUnavailable'), 'info');
      return;
    }
    speech.speak(key, text, lang);
  };

  const goTo = (next: number) => {
    speech.stop();
    setIndex(Math.max(0, Math.min(total - 1, next)));
  };

  const finish = () => {
    speech.stop();
    toast(t('heritage.finished'), 'success');
    router.back();
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('heritage.audioGuide')}
        subtitle={site.data?.name}
        showBack
        onBack={() => {
          speech.stop();
          router.back();
        }}
      />
      <View style={styles.content}>
        {guide.isError ? (
          <ErrorState onRetry={() => guide.refetch()} />
        ) : guide.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={90} style={{ borderRadius: radius.xl }} />
            <Skeleton height={220} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : total === 0 || !current ? (
          <EmptyState
            icon="mic-off"
            title={t('heritage.audioGuideEmpty')}
            description={t('heritage.audioGuideEmptyDescription')}
          />
        ) : (
          <>
            <View
              style={[
                styles.progress,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ProgressRing value={(index + 1) / total} size={64} color={colors.accent}>
                <Text variant="label" weight="extrabold">
                  {index + 1}/{total}
                </Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">{t('heritage.stopOf', { current: index + 1, total })}</Text>
                <View style={styles.metaRow}>
                  <Icon name="hourglass" size={13} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted">
                    {t('heritage.totalDuration')}: {formatDuration(totalMin, locale)}
                  </Text>
                </View>
                <Text variant="caption" color={speech.supported ? 'success' : 'textSubtle'}>
                  {speech.supported ? t('heritage.speechWeb') : t('heritage.speechUnavailable')}
                </Text>
              </View>
            </View>

            <View style={styles.dots} accessibilityLabel={t('heritage.progress')}>
              {stops.map((s, i) => (
                <View
                  key={s.id}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i < index ? colors.success : i === index ? colors.accent : colors.border,
                    },
                  ]}
                />
              ))}
            </View>

            <AudioGuideStopCard
              stop={current}
              active
              speaking={speech.speaking && speech.currentKey === current.id}
              onRead={() => read(current.id, `${current.title}. ${current.script}`)}
              onStop={speech.stop}
            />

            <View style={styles.nav}>
              <Button
                label={t('heritage.prev')}
                icon="chevron-left"
                variant="secondary"
                disabled={index === 0}
                onPress={() => goTo(index - 1)}
                style={{ flex: 1 }}
              />
              {index < total - 1 ? (
                <Button
                  label={t('heritage.next')}
                  icon="chevron-right"
                  onPress={() => goTo(index + 1)}
                  style={{ flex: 1 }}
                />
              ) : (
                <Button
                  label={t('heritage.finish')}
                  icon="check"
                  onPress={finish}
                  style={{ flex: 1 }}
                />
              )}
            </View>

            {site.data ? (
              <Button
                label={
                  speech.speaking && speech.currentKey === 'all'
                    ? t('heritage.stop')
                    : t('heritage.readAll')
                }
                icon={speech.speaking && speech.currentKey === 'all' ? 'pause' : 'play'}
                variant="ghost"
                fullWidth
                onPress={() =>
                  speech.speaking && speech.currentKey === 'all'
                    ? speech.stop()
                    : read('all', heritageSiteScript(site.data!, stops))
                }
              />
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  nav: { flexDirection: 'row', gap: spacing.sm },
});
