import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

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
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useCurrentUser } from '@/features/auth/session.store';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatRelative } from '@/core/utils/time';
import { AMS_SEVERITY_META } from '@/domain';
import { AltitudeStatusCard } from '@/features/destinations/components/AltitudeStatusCard';
import { AmsForm } from '@/features/destinations/components/AmsForm';
import { AmsHistoryChart } from '@/features/destinations/components/AmsHistoryChart';
import { amsSeverityColor, amsSeveritySoft } from '@/features/destinations/components/meta';
import { useAmsChecks, useDestinations, useLogAms } from '@/features/destinations/hooks';
import { useUpdateProfile } from '@/features/profile/hooks';

export default function AmsScreen() {
  const { destinationId, elevation } = useLocalSearchParams<{
    destinationId?: string;
    elevation?: string;
  }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const checks = useAmsChecks();
  const destinations = useDestinations({});
  const logAms = useLogAms();
  const updateProfile = useUpdateProfile();
  const me = useCurrentUser();

  const options = useMemo(
    () =>
      (destinations.data ?? [])
        .filter((d) => d.maxElevationM >= 2500)
        .map((d) => ({ id: d.id, name: d.name })),
    [destinations.data],
  );
  const destinationNames = useMemo(
    () => new Map((destinations.data ?? []).map((d) => [d.id, d.name])),
    [destinations.data],
  );
  const latest = checks.data?.[0] ?? null;
  const latestMeta = latest ? AMS_SEVERITY_META[latest.severity] : null;
  const initialElevation = elevation ? Number(elevation) : null;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('destinations.ams.title')}
        subtitle={t('destinations.ams.subtitle')}
        showBack
      />
      <View style={styles.content}>
        {latest && latestMeta ? (
          <View
            style={[
              styles.advice,
              {
                backgroundColor: amsSeveritySoft(latest.severity, colors),
                borderColor: amsSeverityColor(latest.severity, colors),
              },
            ]}
          >
            <View style={styles.adviceHead}>
              <Icon
                name="heart-pulse"
                size={20}
                color={amsSeverityColor(latest.severity, colors)}
                strokeWidth={2.4}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label" color="textSubtle">
                  {t('destinations.ams.lastCheck')} ·{' '}
                  {formatRelative(latest.createdAt, new Date(), locale)} ·{' '}
                  {formatAltitude(latest.elevationM, locale)}
                </Text>
                <Text variant="h3" color={amsSeverityColor(latest.severity, colors)}>
                  {t(latestMeta.labelKey)} · {t('destinations.ams.score', { score: latest.score })}
                </Text>
              </View>
            </View>
            <Text variant="bodySm">{t(latestMeta.adviceKey)}</Text>
            {latest.severity === 'severe' || latest.severity === 'moderate' ? (
              <Button
                label={t('destinations.ams.descendNow')}
                icon="siren"
                variant="danger"
                fullWidth
                onPress={() => router.push('/satellite/sos')}
              />
            ) : null}
          </View>
        ) : null}

        {/*
          İrtifa durumu: son öz-değerlendirmenin yüksekliği, şiddeti ve
          ölçümleri + profildeki bazal nabız üzerinden okunur.
        */}
        {latest ? (
          <AltitudeStatusCard
            irtifaM={latest.elevationM}
            amsSiddeti={latest.severity}
            spo2={latest.spo2 ?? null}
            dinlenmeNabzi={latest.restingHr ?? null}
            bazalNabiz={me.baselineRestingHr ?? null}
            kanBasinci={
              latest.systolic != null && latest.diastolic != null
                ? { sistolik: latest.systolic, diyastolik: latest.diastolic }
                : null
            }
          />
        ) : null}

        <AmsForm
          destinations={options}
          initialDestinationId={destinationId ?? null}
          initialElevationM={Number.isFinite(initialElevation) ? initialElevation : null}
          submitting={logAms.isPending}
          baselineRestingHr={me.baselineRestingHr ?? null}
          onSubmit={({ baselineRestingHr, ...check }) => {
            // Bazal nabız kontrol kaydına değil **profile** ait: kişisel bir
            // sabit, ölçüm anına ait bir veri değil. Yalnızca değiştiyse gelir.
            if (baselineRestingHr !== undefined) {
              updateProfile.mutate({ baselineRestingHr });
            }
            logAms.mutate(check, {
              onSuccess: (c) =>
                toast(
                  `${t('destinations.ams.logged')} · ${t(AMS_SEVERITY_META[c.severity].labelKey)}`,
                  c.severity === 'severe' ? 'error' : 'success',
                ),
              onError: (e) => toast(e.message, 'error'),
            });
          }}
        />

        <SectionHeader title={t('destinations.ams.history')} />
        {checks.isError ? (
          <ErrorState onRetry={() => checks.refetch()} />
        ) : checks.isLoading ? (
          <Skeleton height={180} style={{ borderRadius: radius.lg }} />
        ) : checks.data && checks.data.length > 0 ? (
          <>
            <AmsHistoryChart checks={checks.data} />
            <View style={{ gap: spacing.sm }}>
              {checks.data.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="title">
                      {formatAltitude(c.elevationM, locale)}
                      {c.destinationId && destinationNames.get(c.destinationId)
                        ? ` · ${destinationNames.get(c.destinationId)}`
                        : ''}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {formatRelative(c.createdAt, new Date(), locale)} · {c.headache}/{c.gi}/
                      {c.fatigue}/{c.dizziness}
                    </Text>
                    {c.note ? (
                      <Text variant="caption" color="textSubtle" numberOfLines={2}>
                        {c.note}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={`${c.score} · ${t(AMS_SEVERITY_META[c.severity].labelKey)}`}
                    color={amsSeverityColor(c.severity, colors)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : (
          <EmptyState
            icon="heart-pulse"
            title={t('destinations.ams.historyEmpty')}
            description={t('destinations.ams.historyEmptyDescription')}
            compact
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
    paddingBottom: spacing.xxl,
  },
  advice: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.xl, borderWidth: 1 },
  adviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
