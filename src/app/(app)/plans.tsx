import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Icon, Screen, SegmentedControl, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry, PLAN_SPECS, PLANS, yearlySavings, type Plan } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useEarnings, useSubscribe } from '@/features/plans/hooks';

type Period = 'monthly' | 'yearly';

const PLAN_COLORS: Record<Plan, string> = {
  free: '#9AAEA3',
  pro: '#5EE39B',
  pro_guide: '#FFB547',
  business: '#6CB4FF',
};
const PLAN_ICONS: Record<Plan, 'compass' | 'sparkles' | 'graduation-cap' | 'building-2'> = {
  free: 'compass',
  pro: 'sparkles',
  pro_guide: 'graduation-cap',
  business: 'building-2',
};

export default function PlansScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const subscribe = useSubscribe();
  const earnings = useEarnings();
  const [period, setPeriod] = useState<Period>('yearly');
  const [selected, setSelected] = useState<Plan>(me.plan === 'free' ? 'pro' : me.plan);
  const isProvider = me.plan === 'pro_guide' || me.plan === 'business';

  const purchase = () => {
    subscribe.mutate(
      { plan: selected, period },
      {
        onSuccess: () => {
          toast(t('plans.purchased'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('plans.title')} subtitle={t('plans.subtitle')} showBack />
      <View style={styles.content}>
        {isProvider && earnings.data ? (
          <View
            style={[
              styles.earnings,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text variant="caption" color="textSubtle">
              {t('plans.earnings')} · {earnings.data.bookings} {t('instructors.perSession')}
            </Text>
            <View style={styles.earnRow}>
              <View style={{ flex: 1 }}>
                <Text variant="label" color="textSubtle">
                  {t('plans.gross').toLocaleUpperCase('tr-TR')}
                </Text>
                <Text variant="h3">{formatPriceTry(earnings.data.grossTry, locale, false)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" color="textSubtle">
                  {t('plans.commission').toLocaleUpperCase('tr-TR')} · %
                  {Math.round(PLAN_SPECS[me.plan].commissionRate * 100)}
                </Text>
                <Text variant="h3" color="danger">
                  −{formatPriceTry(earnings.data.commissionTry, locale, false)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" color="textSubtle">
                  {t('plans.net').toLocaleUpperCase('tr-TR')}
                </Text>
                <Text variant="h3" color="primary">
                  {formatPriceTry(earnings.data.netTry, locale, false)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <SegmentedControl<Period>
          value={period}
          onChange={setPeriod}
          segments={[
            { value: 'monthly', label: t('plans.monthly') },
            {
              value: 'yearly',
              label: `${t('plans.yearly')} · ${t('plans.save', { percent: locale === 'tr' ? `%${Math.round(yearlySavings('pro') * 100)}` : `${Math.round(yearlySavings('pro') * 100)}%` })}`,
            },
          ]}
        />

        {PLANS.map((plan) => {
          const p = PLAN_SPECS[plan];
          const color = PLAN_COLORS[plan];
          const active = selected === plan;
          const current = me.plan === plan;
          const price = period === 'yearly' ? p.yearlyTry : p.monthlyTry;
          return (
            <Tappable
              key={plan}
              onPress={() => setSelected(plan)}
              scaleTo={0.985}
              haptic="selection"
              style={[
                styles.plan,
                {
                  backgroundColor: colors.surface,
                  borderColor: active ? color : colors.border,
                  borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.planHead}>
                <View style={[styles.planIcon, { backgroundColor: `${color}22` }]}>
                  <Icon name={PLAN_ICONS[plan]} size={20} color={color} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.planTitleRow}>
                    <Text variant="h3">{t(`plans.${plan}` as TranslationKey)}</Text>
                    {current ? (
                      <View style={[styles.currentPill, { backgroundColor: `${color}22` }]}>
                        <Text variant="label" weight="extrabold" color={color}>
                          {t('plans.current').toLocaleUpperCase('tr-TR')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color="textMuted">
                    {t(`plans.${plan}Description` as TranslationKey)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="h3" color={color}>
                    {price === 0 ? '₺0' : formatPriceTry(price, locale)}
                  </Text>
                  {price > 0 ? (
                    <Text variant="label" color="textSubtle">
                      {period === 'yearly' ? t('plans.perYear') : t('plans.perMonth')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.features}>
                {p.featureKeys.map((key) => (
                  <View key={key} style={styles.feature}>
                    <Icon name="check" size={14} color={color} strokeWidth={2.8} />
                    <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                      {t(key as TranslationKey)}
                    </Text>
                  </View>
                ))}
                {p.forProviders ? (
                  <View style={styles.feature}>
                    <Icon name="banknote" size={14} color={color} strokeWidth={2.4} />
                    <Text variant="bodySm" color="textMuted">
                      {t('plans.commission')}: %{Math.round(p.commissionRate * 100)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Tappable>
          );
        })}

        <Button
          label={me.plan === selected ? t('plans.current') : t('plans.choose')}
          size="lg"
          fullWidth
          icon={PLAN_ICONS[selected]}
          disabled={me.plan === selected}
          loading={subscribe.isPending}
          onPress={purchase}
          style={{ backgroundColor: PLAN_COLORS[selected] }}
        />
        <Tappable
          onPress={() => toast(t('plans.purchased'), 'info')}
          haptic="selection"
          style={{ alignSelf: 'center' }}
          accessibilityRole="button"
        >
          <Text variant="caption" weight="bold" color="primary">
            {t('plans.restore')}
          </Text>
        </Tappable>
        <Text variant="caption" color="textSubtle" align="center">
          {t('plans.legal')}
        </Text>
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
  earnings: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  earnRow: { flexDirection: 'row', gap: spacing.md },
  plan: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currentPill: {
    paddingHorizontal: spacing.sm,
    height: 20,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  features: { gap: spacing.xs + 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
