import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { type ShareMode } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { HazardRadar } from '@/features/hazards/components/HazardRadar';
import { ShareCard } from '@/features/presence/components/ShareCard';
import {
  useLocationPublisher,
  useMyShare,
  useStartShare,
  useStopShare,
  useVisibleShares,
} from '@/features/presence/hooks';

const DURATIONS: { min: number | null; label: string }[] = [
  { min: 60, label: '1' },
  { min: 240, label: '4' },
  { min: 720, label: '12' },
  { min: null, label: '∞' },
];

export default function LiveLocationScreen() {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const mine = useMyShare();
  const shares = useVisibleShares(location.coords);
  const start = useStartShare();
  const stop = useStopShare();
  const [mode, setMode] = useState<ShareMode>('friends');
  const [duration, setDuration] = useState<number | null>(240);
  const [now] = useState(() => Date.now());
  const active = Boolean(mine.data);
  useLocationPublisher(active);

  const onStart = async () => {
    if (location.isFallback) await location.request();
    start.mutate(
      { mode, coords: location.coords, durationMin: duration },
      {
        onSuccess: () => toast(t('presence.startedToast'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };
  const onStop = () =>
    stop.mutate(undefined, { onSuccess: () => toast(t('presence.stoppedToast'), 'info') });

  const modes: { value: ShareMode; label: string; icon: 'users' | 'heart-handshake' | 'siren' }[] =
    [
      { value: 'friends', label: t('presence.modeFriends'), icon: 'users' },
      { value: 'matches', label: t('presence.modeMatches'), icon: 'heart-handshake' },
      { value: 'sos', label: t('presence.modeSos'), icon: 'siren' },
    ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('presence.title')} subtitle={t('presence.subtitle')} showBack />
      <View style={styles.content}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: active ? colors.primarySoft : colors.surface,
              borderColor: active ? colors.primary : colors.border,
            },
          ]}
        >
          <View style={styles.panelHead}>
            <View
              style={[styles.dot, { backgroundColor: active ? colors.primary : colors.textSubtle }]}
            />
            <Text variant="title" style={{ flex: 1 }}>
              {active ? t('presence.sharing') : t('presence.share')}
            </Text>
            {mine.data?.expiresAt ? (
              <Text variant="caption" color="textMuted">
                {t('presence.remaining')}:{' '}
                {formatDuration(
                  Math.max(1, Math.round((new Date(mine.data.expiresAt).getTime() - now) / 60_000)),
                  locale,
                )}
              </Text>
            ) : null}
          </View>
          {!active ? (
            <>
              <Text variant="caption" color="textMuted">
                {t('presence.mode')}
              </Text>
              <View style={styles.chips}>
                {modes.map((m) => (
                  <Chip
                    key={m.value}
                    label={m.label}
                    icon={m.icon}
                    selected={mode === m.value}
                    color={m.value === 'sos' ? colors.danger : undefined}
                    onPress={() => setMode(m.value)}
                  />
                ))}
              </View>
              <Text variant="caption" color="textMuted">
                {t('presence.duration')}
              </Text>
              <View style={styles.chips}>
                {DURATIONS.map((d) => (
                  <Chip
                    key={d.label}
                    size="sm"
                    label={
                      d.min === null ? t('presence.untilOff') : `${d.label} ${t('presence.hour')}`
                    }
                    selected={duration === d.min}
                    onPress={() => setDuration(d.min)}
                  />
                ))}
              </View>
              <Button
                label={t('presence.share')}
                icon="locate-fixed"
                size="lg"
                fullWidth
                loading={start.isPending || location.status === 'requesting'}
                onPress={onStart}
              />
            </>
          ) : (
            <Button
              label={t('presence.stop')}
              icon="square"
              variant="danger"
              size="lg"
              fullWidth
              loading={stop.isPending}
              onPress={onStop}
            />
          )}
          <View style={styles.privacy}>
            <Icon name="lock" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textSubtle" style={{ flex: 1 }}>
              {t('presence.privacy')}
            </Text>
          </View>
        </View>

        <HazardRadar origin={location.coords} hazards={[]} rangeKm={25} height={220} />

        <Text variant="h3">
          {t('presence.activeShares')}
          {shares.data ? (
            <Text variant="h3" color="textSubtle">
              {' '}
              · {shares.data.length}
            </Text>
          ) : null}
        </Text>
        {shares.isError ? (
          <ErrorState onRetry={() => shares.refetch()} />
        ) : shares.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={110} style={{ borderRadius: radius.xl }} />)
        ) : shares.data && shares.data.length > 0 ? (
          shares.data.map((s) => <ShareCard key={s.userId} share={s} />)
        ) : (
          <EmptyState
            compact
            icon="map-pin-off"
            title={t('presence.noShares')}
            description={t('presence.noSharesDescription')}
          />
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
  },
  panel: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.sm + 2 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.xs },
});
