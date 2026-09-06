import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { StreamCard } from '@/features/live/components/StreamCard';
import { useStreams } from '@/features/live/hooks';

export default function LiveScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const streams = useStreams();

  const live = useMemo(
    () => streams.data?.filter((s) => s.status === 'live') ?? [],
    [streams.data],
  );
  const scheduled = useMemo(
    () => streams.data?.filter((s) => s.status === 'scheduled') ?? [],
    [streams.data],
  );
  const replays = useMemo(
    () => streams.data?.filter((s) => s.status === 'ended') ?? [],
    [streams.data],
  );
  const cardWidth = Math.min(280, width * 0.72);

  return (
    <Screen scroll withTabBar edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.logo, { backgroundColor: '#E5484D' }]}>
            <Icon name="radio" size={18} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h1">{t('live.title')}</Text>
            <Text variant="caption" color="textMuted">
              {t('live.subtitle')}
            </Text>
          </View>
          <Button
            label={t('live.goLive')}
            icon="video"
            size="sm"
            variant="danger"
            onPress={() => router.push('/live/start')}
          />
        </View>
      </View>

      {streams.isError ? (
        <ErrorState onRetry={() => streams.refetch()} />
      ) : (
        <>
          {/* Sayı, dile gömülü metinle değil çevrilmiş etiketle birleştirilir. */}
          <SectionHeader
            title={t('live.liveNowSection')}
            subtitle={live.length ? `${live.length} · ${t('live.liveNow')}` : undefined}
          />
          {streams.isLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {[0, 1].map((i) => (
                <Skeleton
                  key={i}
                  width={cardWidth}
                  height={cardWidth / 0.8}
                  style={{ borderRadius: radius.xl }}
                />
              ))}
            </ScrollView>
          ) : live.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              decelerationRate="fast"
              snapToInterval={cardWidth + spacing.md}
              snapToAlignment="start"
            >
              {live.map((s) => (
                <StreamCard key={s.id} stream={s} width={cardWidth} />
              ))}
            </ScrollView>
          ) : (
            <EmptyState
              compact
              icon="video-off"
              title={t('live.empty')}
              description={t('live.emptyDescription')}
              action={{
                label: t('live.goLive'),
                icon: 'video',
                onPress: () => router.push('/live/start'),
              }}
            />
          )}

          {scheduled.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('live.scheduled')} />
              <View style={styles.list}>
                {scheduled.map((s) => (
                  <StreamCard key={s.id} stream={s} row />
                ))}
              </View>
            </View>
          ) : null}

          {replays.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('live.replays')} />
              <View style={styles.list}>
                {replays.map((s) => (
                  <StreamCard key={s.id} stream={s} row />
                ))}
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.notice,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <Icon name="info" size={16} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('live.notice')}
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { marginTop: spacing.xxl },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
