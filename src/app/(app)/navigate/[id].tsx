import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { formatDistance, type TrackPoint } from '@/domain';
import { roundedDistanceLabel } from '@/domain/tracks';
import { NavigationBanner } from '@/features/tracks/components/NavigationBanner';
import { StepList } from '@/features/tracks/components/StepList';
import { TrackMap } from '@/features/tracks/components/TrackMap';
import { useCommunityTrail, useNavigation, useNavigator, useTrack } from '@/features/tracks/hooks';

const EMPTY_POINTS: TrackPoint[] = [];

export default function NavigateScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: 'track' | 'community' = kindParam === 'community' ? 'community' : 'track';
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const track = useTrack(kind === 'track' ? (id ?? null) : null);
  const trail = useCommunityTrail(kind === 'community' ? (id ?? null) : null);
  const nav = useNavigation(id ?? null, kind);

  const source = kind === 'track' ? track : trail;
  const points = source.data?.points ?? EMPTY_POINTS;
  const pois = source.data?.pois ?? [];
  const name = source.data?.name ?? t('tracks.nav.title');
  const steps = nav.data ?? [];

  const navigator = useNavigator(steps, points, { locale, voiceEnabled });
  const { progress, currentStep, nextStep } = navigator;

  const nextPoi =
    steps.find((s) => s.index > (progress?.stepIndex ?? -1) && s.poiName)?.poiName ?? null;
  const isLoading = source.isLoading || nav.isLoading;
  const isError = source.isError || nav.isError;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={name}
        subtitle={t(`tracks.nav.kind.${kind}`)}
        showBack
        onBack={() => goBack(router, '/')}
        right={
          <IconButton
            icon={voiceEnabled ? 'radio' : 'mic-off'}
            variant="ghost"
            onPress={() => setVoiceEnabled((v) => !v)}
            accessibilityLabel={voiceEnabled ? t('tracks.nav.voiceOn') : t('tracks.nav.voiceOff')}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isError ? (
          <ErrorState
            onRetry={() => {
              void source.refetch();
              void nav.refetch();
            }}
          />
        ) : isLoading ? (
          <>
            <Skeleton height={110} style={{ borderRadius: radius.xl }} />
            <Skeleton height={280} style={{ borderRadius: radius.xl }} />
          </>
        ) : points.length < 2 || steps.length === 0 ? (
          <EmptyState icon="navigation" title={t('tracks.nav.empty')} />
        ) : (
          <>
            <NavigationBanner
              step={currentStep}
              progress={progress}
              arrived={navigator.hasArrived}
            />

            {navigator.voice && voiceEnabled ? (
              <View
                style={[
                  styles.voice,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text variant="caption" color="textMuted" numberOfLines={2}>
                  🔊 {navigator.voice}
                </Text>
              </View>
            ) : null}

            <TrackMap
              points={points}
              pois={pois}
              position={navigator.position}
              highlight={nextStep?.coords ?? null}
              offRoute={progress?.isOffRoute ?? false}
              name={name}
              height={300}
            />

            <View style={styles.stats}>
              <StatTile
                icon="ruler"
                label={t('tracks.nav.remaining')}
                value={progress ? formatDistance(progress.remainingM / 1000, locale) : '—'}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="timer"
                label={t('tracks.nav.eta')}
                value={progress ? formatDuration(progress.etaMin, locale) : '—'}
                color={colors.info}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="map-pin"
                label={t('tracks.nav.nextPoi')}
                value={nextPoi ?? t('tracks.nav.noPoi')}
                color={colors.accent}
                compact
                style={styles.tile}
              />
            </View>

            {navigator.isSimulated ? (
              <View style={styles.demo}>
                <Button
                  label={t('tracks.nav.demoAdvance')}
                  icon="play"
                  variant="secondary"
                  onPress={() => navigator.advanceDemo(150)}
                  style={{ flex: 1 }}
                />
                <Text variant="caption" color="textSubtle" style={{ flex: 1 }}>
                  {t('tracks.nav.demoHint')}
                  {progress
                    ? ` · ${roundedDistanceLabel(navigator.totalM - progress.remainingM, locale)}`
                    : ''}
                </Text>
              </View>
            ) : !navigator.position ? (
              <Text variant="caption" color="textSubtle" align="center">
                {t('tracks.nav.locating')}
              </Text>
            ) : null}

            <SectionHeader
              title={t('tracks.nav.steps')}
              subtitle={t('tracks.nav.stepsCount', { count: steps.length })}
            />
            <StepList steps={steps} activeIndex={progress?.stepIndex ?? 0} />

            <Button
              label={t('tracks.nav.finish')}
              icon="flag"
              variant={navigator.hasArrived ? 'primary' : 'danger'}
              fullWidth
              onPress={() => goBack(router, '/')}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  voice: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
