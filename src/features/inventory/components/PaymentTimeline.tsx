import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { formatPriceTry, paymentTimeline, type Payment } from '@/domain';

import { PAYMENT_STATUS_COLOR, PAYMENT_STATUS_ICON } from './meta';

export interface PaymentTimelineProps {
  payment: Payment;
}

/** Dikey adım çubuğu: authorized → escrow → released / refunded. */
export function PaymentTimeline({ payment }: PaymentTimelineProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const steps = paymentTimeline(payment);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text variant="h3" style={{ flex: 1 }}>
          {t('inventory.payment.timeline')}
        </Text>
        <Text variant="caption" color="textSubtle">
          {payment.provider === 'stripe' ? t('inventory.provider.card') : payment.provider}
        </Text>
      </View>
      <View style={[styles.escrow, { backgroundColor: colors.primarySoft }]}>
        <Icon name="shield-check" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="bold">
            {t('inventory.escrow.title')}
          </Text>
          <Text variant="label" color="textMuted">
            {t('inventory.escrow.description')}
          </Text>
        </View>
      </View>
      <View>
        {steps.map((step, i) => {
          const color = PAYMENT_STATUS_COLOR[step.status];
          const active = step.state !== 'upcoming';
          const last = i === steps.length - 1;
          return (
            <View key={`${step.status}-${i}`} style={styles.step}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active ? color : colors.surfaceMuted,
                      borderColor: active ? color : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={PAYMENT_STATUS_ICON[step.status]}
                    size={12}
                    color={active ? '#06120B' : colors.textSubtle}
                    strokeWidth={2.6}
                  />
                </View>
                {!last ? (
                  <View
                    style={[
                      styles.line,
                      { backgroundColor: step.state === 'done' ? color : colors.border },
                    ]}
                  />
                ) : null}
              </View>
              <View style={[styles.stepBody, !last ? { paddingBottom: spacing.md } : null]}>
                <Text
                  variant="bodySm"
                  weight={step.state === 'current' ? 'extrabold' : 'semibold'}
                  color={active ? colors.text : colors.textSubtle}
                >
                  {t(`inventory.paymentStatus.${step.status}`)}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {step.at ? formatDate(step.at, locale, 'd MMM yyyy · HH:mm') : '—'}
                </Text>
                {step.status === 'refunded' && step.state === 'current' ? (
                  <Text variant="caption" weight="bold" color={color}>
                    {t('inventory.payment.refundedAmount', {
                      amount: formatPriceTry(payment.refundedTry, locale, false),
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={[styles.amount, { borderTopColor: colors.border }]}>
        <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
          {t('inventory.payment.title')}
        </Text>
        <Text variant="title">{formatPriceTry(payment.amountTry, locale)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  escrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 24 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  stepBody: { flex: 1, gap: 2 },
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
