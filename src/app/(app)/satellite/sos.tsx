import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import {
  buildSosPayload,
  EMERGENCY_CENTER_META,
  estimatedRescueEtaMin,
  formatDistance,
  LINK_META,
  mapsUrl,
  SAT_MESSAGE_MAX_LEN,
  type EmergencyCenterWithDistance,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useEmergencyCenters } from '@/features/firstaid/hooks';
import { CountryRescueCard } from '@/features/rescue/components/CountryRescueCard';
import { useCountry } from '@/features/rescue/hooks';
import { HoldSosButton } from '@/features/satellite/components/HoldSosButton';
import { SosStageStepper } from '@/features/satellite/components/SosStageStepper';
import {
  useAdvanceSos,
  useCancelSos,
  useLinkStatus,
  useSos,
  useStartSos,
} from '@/features/satellite/hooks';

/** Web'de Alert.alert çalışmaz; onay diyaloğu için basit yedek. */
function confirm(
  title: string,
  message: string,
  okLabel: string,
  cancelLabel: string,
  onOk: () => void,
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}

export default function SatelliteSosScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const link = useLinkStatus();
  const sos = useSos();
  const start = useStartSos();
  const advance = useAdvanceSos();
  const cancel = useCancelSos();
  const session = sos.data ?? null;
  const origin = session?.coords ?? location.coords;
  const centers = useEmergencyCenters(origin);
  const country = useCountry(origin);

  const rescue: EmergencyCenterWithDistance | null =
    centers.data?.find((c) => c.id === session?.rescueCenterId) ??
    centers.data?.find((c) => c.type === 'mountain_rescue' || c.type === 'ambulance') ??
    centers.data?.[0] ??
    null;
  const offline = link.data?.link === 'none';
  const payload = session
    ? buildSosPayload(me, session.coords, me.emergencyContacts, new Date(session.startedAt))
    : null;
  const notified = me.emergencyContacts;

  const onTrigger = () =>
    confirm(
      t('satellite.sos.confirmTitle'),
      t('satellite.sos.confirmDescription'),
      t('satellite.sos.confirmSend'),
      t('common.cancel'),
      () =>
        start.mutate(location.coords, {
          onSuccess: () => toast(t('satellite.sos.started'), 'success'),
          onError: (e) => toast(e.message, 'error'),
        }),
    );

  const onAdvance = () =>
    advance.mutate(undefined, {
      onSuccess: (s) =>
        toast(
          s.stage === 'resolved'
            ? t('satellite.sos.resolvedToast')
            : t('satellite.sos.advanced', { stage: t(`satellite.sos.stage.${s.stage}`) }),
          s.stage === 'resolved' ? 'success' : 'info',
        ),
      onError: (e) => toast(e.message, 'error'),
    });

  const onCancel = () =>
    confirm(
      t('satellite.sos.cancelConfirm'),
      t('satellite.sos.cancelDescription'),
      t('satellite.sos.cancel'),
      t('common.cancel'),
      () =>
        cancel.mutate(undefined, {
          onSuccess: () => toast(t('satellite.sos.cancelled'), 'info'),
          onError: (e) => toast(e.message, 'error'),
        }),
    );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('satellite.sos.title')}
        subtitle={t('satellite.sos.subtitle')}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/satellite'))}
        right={
          link.data ? (
            <Badge
              label={t(LINK_META[link.data.link].labelKey)}
              icon={LINK_META[link.data.link].icon as IconName}
              color={offline ? colors.danger : colors.info}
              soft
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {sos.isError ? (
          <ErrorState onRetry={() => sos.refetch()} />
        ) : sos.isLoading ? (
          <Skeleton height={260} style={{ borderRadius: radius.xxl }} />
        ) : (
          <View
            style={[
              styles.sosCard,
              {
                backgroundColor: colors.surface,
                borderColor: session ? colors.danger : colors.border,
              },
            ]}
          >
            <HoldSosButton
              active={Boolean(session)}
              onTrigger={onTrigger}
              disabled={offline || start.isPending}
            />
            <Text variant="caption" color={offline ? 'danger' : 'textMuted'} align="center">
              {session
                ? t('satellite.sos.whileActive')
                : offline
                  ? t('satellite.link.noneHint')
                  : t('satellite.sos.hold')}
            </Text>
            {session ? <SosStageStepper stage={session.stage} /> : null}
            {session ? (
              <View style={styles.actionRow}>
                <Button
                  label={t('satellite.sos.cancel')}
                  variant="secondary"
                  icon="x"
                  onPress={onCancel}
                  loading={cancel.isPending}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('satellite.sos.nextStage')}
                  icon="arrow-right"
                  onPress={onAdvance}
                  loading={advance.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
          </View>
        )}

        {!session && !sos.isLoading ? (
          <EmptyState
            icon="satellite"
            title={t('satellite.sos.noActive')}
            description={t('satellite.sos.noActiveDescription')}
            compact
          />
        ) : null}

        <SectionHeader title={t('satellite.sos.nearestRescue')} />
        <CountryRescueCard
          profile={country.profile}
          compact
          onPress={() => router.push('/first-aid/country')}
        />
        {centers.isError ? (
          <ErrorState onRetry={() => centers.refetch()} />
        ) : centers.isLoading ? (
          <Skeleton height={80} style={{ borderRadius: radius.lg }} />
        ) : rescue ? (
          <View
            style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View
              style={[
                styles.centerIcon,
                { backgroundColor: `${EMERGENCY_CENTER_META[rescue.type].color}22` },
              ]}
            >
              <Icon
                name={EMERGENCY_CENTER_META[rescue.type].icon}
                size={18}
                color={EMERGENCY_CENTER_META[rescue.type].color}
                strokeWidth={2.2}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title" numberOfLines={2}>
                {rescue.name}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {t(EMERGENCY_CENTER_META[rescue.type].labelKey)} ·{' '}
                {formatDistance(rescue.distanceKm, locale)} · {t('satellite.sos.eta')}{' '}
                {estimatedRescueEtaMin(origin, rescue.coords)} dk
              </Text>
            </View>
            <Button
              label={t('firstAid.directions')}
              size="sm"
              icon="navigation"
              variant="secondary"
              onPress={() =>
                Linking.openURL(
                  mapsUrl(rescue.coords.latitude, rescue.coords.longitude, rescue.name),
                )
              }
            />
          </View>
        ) : null}

        {session ? (
          <>
            <SectionHeader title={t('satellite.sos.timeline')} />
            <View
              style={[
                styles.timeline,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {[...session.timeline].reverse().map((entry, i) => (
                <View key={`${entry.stage}-${entry.at}`} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: i === 0 ? colors.danger : colors.border },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{t(`satellite.sos.stage.${entry.stage}`)}</Text>
                    <Text variant="caption" color="textMuted">
                      {entry.note}
                    </Text>
                  </View>
                  <Text variant="caption" color="textSubtle">
                    {formatTime(entry.at)}
                  </Text>
                </View>
              ))}
            </View>

            <SectionHeader
              title={t('satellite.sos.payload')}
              subtitle={t('satellite.sos.viaLink', { link: t(LINK_META[session.link].labelKey) })}
            />
            <View
              style={[
                styles.payload,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Text variant="bodySm" style={styles.mono} selectable>
                {payload}
              </Text>
              <Text variant="caption" color="textSubtle">
                {t('satellite.sos.payloadHint', { length: payload?.length ?? 0 })}
                {(payload?.length ?? 0) > SAT_MESSAGE_MAX_LEN ? ' !' : ''}
              </Text>
            </View>

            <SectionHeader title={t('satellite.sos.contacts')} />
            {notified.length === 0 ? (
              <Text variant="caption" color="textMuted">
                {t('satellite.sos.noContacts')}
              </Text>
            ) : (
              <View style={styles.contacts}>
                {notified.map((c) => (
                  <Badge
                    key={c.phone}
                    label={c.name}
                    icon={c.userId ? 'user-check' : 'phone'}
                    color={c.userId ? colors.success : colors.textMuted}
                    soft
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
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
  sosCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: {
    padding: spacing.md,
    gap: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  payload: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mono: { fontFamily: 'monospace' },
  contacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
