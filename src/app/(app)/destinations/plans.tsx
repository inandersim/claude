import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { openPlans, primaryPlan } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { ReturnPlanCard } from '@/features/destinations/components/ReturnPlanCard';
import {
  useCancelReturnPlan,
  useDestinations,
  useMarkReturned,
  useOverdueCheck,
  useReturnPlans,
} from '@/features/destinations/hooks';

/** Geri sayımın tazelenme aralığı (ms). */
const TICK_MS = 30_000;

export default function ReturnPlansScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const [now, setNow] = useState(() => Date.now());

  useOverdueCheck();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const plans = useReturnPlans();
  const destinations = useDestinations({});
  const markReturned = useMarkReturned();
  const cancel = useCancelReturnPlan();
  const [busyId, setBusyId] = useState<string | null>(null);

  const names = useMemo(
    () => new Map((destinations.data ?? []).map((d) => [d.id, d.name])),
    [destinations.data],
  );
  const list = useMemo(() => plans.data ?? [], [plans.data]);
  const primary = useMemo(() => primaryPlan(list, now), [list, now]);
  const others = useMemo(
    () => openPlans(list).filter((p) => p.id !== primary?.id),
    [list, primary],
  );
  const past = useMemo(
    () => list.filter((p) => p.status === 'returned' || p.status === 'cancelled'),
    [list],
  );

  const onReturned = (id: string) => {
    setBusyId(id);
    markReturned.mutate(id, {
      onSuccess: () => toast(t('destinations.plan.returned'), 'success'),
      onError: (e) => toast(e.message, 'error'),
      onSettled: () => setBusyId(null),
    });
  };
  const onCancel = (id: string) => {
    setBusyId(id);
    cancel.mutate(id, {
      onSuccess: () => toast(t('destinations.plan.cancelled'), 'info'),
      onError: (e) => toast(e.message, 'error'),
      onSettled: () => setBusyId(null),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('destinations.plan.title')}
        subtitle={t('destinations.plan.subtitle')}
        showBack
        right={
          <IconButton
            icon="plus"
            onPress={() => router.push('/destinations/plan-new')}
            accessibilityLabel={t('destinations.plan.new')}
          />
        }
      />
      <View style={styles.content}>
        {plans.isError ? (
          <ErrorState onRetry={() => plans.refetch()} />
        ) : plans.isLoading ? (
          <>
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
          </>
        ) : (
          <>
            {primary ? (
              <>
                <SectionHeader title={t('destinations.plan.active')} />
                <ReturnPlanCard
                  plan={primary}
                  now={now}
                  destinationName={
                    primary.destinationId ? (names.get(primary.destinationId) ?? null) : null
                  }
                  busy={busyId === primary.id}
                  onMarkReturned={() => onReturned(primary.id)}
                  onCancel={() => onCancel(primary.id)}
                />
              </>
            ) : (
              <EmptyState
                icon="timer"
                title={t('destinations.plan.empty')}
                description={t('destinations.plan.emptyDescription')}
                action={{
                  label: t('destinations.plan.new'),
                  icon: 'plus',
                  onPress: () => router.push('/destinations/plan-new'),
                }}
              />
            )}

            {others.length > 0 ? (
              <>
                <SectionHeader title={t('destinations.plan.upcoming')} />
                {others.map((p) => (
                  <ReturnPlanCard
                    key={p.id}
                    plan={p}
                    now={now}
                    destinationName={p.destinationId ? (names.get(p.destinationId) ?? null) : null}
                    busy={busyId === p.id}
                    onMarkReturned={() => onReturned(p.id)}
                    onCancel={() => onCancel(p.id)}
                  />
                ))}
              </>
            ) : null}

            <View
              style={[
                styles.explain,
                { backgroundColor: colors.infoSoft, borderColor: colors.info },
              ]}
            >
              <View style={styles.explainHead}>
                <Icon name="info" size={18} color={colors.info} />
                <Text variant="title" style={{ flex: 1 }}>
                  {t('destinations.plan.howItWorks')}
                </Text>
              </View>
              <Text variant="bodySm" color="textMuted">
                {t('destinations.plan.overdueExplain')}
              </Text>
              <Text variant="caption" color="textSubtle">
                {me.emergencyContacts.length > 0
                  ? t('destinations.plan.form.contactsCount', {
                      count: me.emergencyContacts.length,
                    })
                  : t('destinations.plan.form.noContacts')}
              </Text>
              {me.emergencyContacts.length === 0 ? (
                <Button
                  label={t('destinations.plan.form.addContacts')}
                  icon="user-plus"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/first-aid/contacts')}
                />
              ) : null}
            </View>

            {past.length > 0 ? (
              <>
                <SectionHeader title={t('destinations.plan.past')} />
                {past.map((p) => (
                  <ReturnPlanCard
                    key={p.id}
                    plan={p}
                    now={now}
                    destinationName={p.destinationId ? (names.get(p.destinationId) ?? null) : null}
                    compact
                  />
                ))}
              </>
            ) : null}

            {primary ? (
              <Button
                label={t('destinations.plan.new')}
                icon="plus"
                variant="secondary"
                fullWidth
                onPress={() => router.push('/destinations/plan-new')}
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
  explain: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  explainHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
