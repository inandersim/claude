import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatTime } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  formatCountdown,
  overdueAt,
  returnPlanStatus,
  timeUntilReturn,
  type ReturnPlan,
  type TripPlanStatus,
} from '@/domain';

interface Props {
  plan: ReturnPlan;
  /** Render dışında hesaplanan "şimdi" (ms) */
  now: number;
  destinationName?: string | null;
  onMarkReturned?: () => void;
  onCancel?: () => void;
  busy?: boolean;
  compact?: boolean;
}

/** Dönüş planı kartı: geri sayım, durum rozeti, rota/yol arkadaşları ve "Döndüm" aksiyonu. */
export function ReturnPlanCard({
  plan,
  now,
  destinationName = null,
  onMarkReturned,
  onCancel,
  busy = false,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const status = returnPlanStatus(plan, now);
  const minutes = timeUntilReturn(plan, now);
  const graceLeft = Math.round((overdueAt(plan) - now) / 60_000);
  const meta = ADVENTURE_TYPE_META[plan.adventureType];
  const open = status === 'active' || status === 'planned' || status === 'overdue';

  const statusColor: Record<TripPlanStatus, string> = {
    planned: colors.info,
    active: colors.primary,
    overdue: colors.danger,
    returned: colors.success,
    cancelled: colors.textSubtle,
  };
  const tint = statusColor[status];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: status === 'overdue' ? colors.dangerSoft : colors.surface,
          borderColor: status === 'overdue' ? colors.danger : colors.border,
        },
      ]}
      accessibilityLabel={`${plan.title}, ${t(`destinations.plan.status.${status}`)}`}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: meta.softColor }]}>
          <Icon name={meta.icon} size={18} color={meta.color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={2}>
            {plan.title}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {destinationName ?? t(meta.labelKey)} · {formatDate(plan.startAt, locale, 'd MMM')}{' '}
            {formatTime(plan.startAt)} → {formatTime(plan.expectedReturnAt)}
          </Text>
        </View>
        <Badge label={t(`destinations.plan.status.${status}`)} color={tint} />
      </View>

      {open ? (
        <View
          style={[styles.countdown, { borderColor: tint, backgroundColor: colors.surfaceMuted }]}
        >
          <Icon
            name={status === 'overdue' ? 'siren' : 'timer'}
            size={20}
            color={tint}
            strokeWidth={2.4}
          />
          <View style={{ flex: 1 }}>
            <Text variant="label" color="textSubtle">
              {status === 'overdue'
                ? t('destinations.plan.status.overdue')
                : t('destinations.plan.countdown')}
            </Text>
            <Text variant="h2" color={tint}>
              {status === 'overdue'
                ? t('destinations.plan.overdueBy', { time: formatCountdown(-minutes, locale) })
                : formatCountdown(minutes, locale)}
            </Text>
            <Text variant="caption" color="textMuted">
              {status === 'overdue' && plan.alertSentAt
                ? t('destinations.plan.alertSentAt', { time: formatTime(plan.alertSentAt) })
                : t('destinations.plan.overdueIn', {
                    time:
                      minutes < 0
                        ? formatCountdown(Math.max(0, graceLeft), locale)
                        : formatTime(new Date(overdueAt(plan)).toISOString()),
                  })}
            </Text>
          </View>
        </View>
      ) : null}

      {!compact ? (
        <View style={{ gap: 4 }}>
          {plan.route ? (
            <Row icon="route" label={t('destinations.plan.route')} value={plan.route} />
          ) : null}
          {plan.companions ? (
            <Row icon="users" label={t('destinations.plan.companions')} value={plan.companions} />
          ) : null}
          <Row
            icon="shield-check"
            label={t('destinations.plan.grace')}
            value={`${t('destinations.plan.graceMinutes', { count: plan.graceMin })} · ${t('destinations.plan.form.contactsCount', { count: plan.contactIds.length })}`}
          />
          {status === 'returned' && plan.returnedAt ? (
            <Row
              icon="circle-check"
              label={t('destinations.plan.status.returned')}
              value={`${formatDate(plan.returnedAt, locale, 'd MMM')} ${formatTime(plan.returnedAt)}`}
            />
          ) : null}
        </View>
      ) : null}

      {open && (onMarkReturned || onCancel) ? (
        <View style={styles.actions}>
          {onCancel ? (
            <Button
              label={t('destinations.plan.cancel')}
              variant="ghost"
              size="sm"
              onPress={onCancel}
              disabled={busy}
              style={{ flex: 1 }}
            />
          ) : null}
          {onMarkReturned ? (
            <Button
              label={t('destinations.plan.markReturned')}
              icon="circle-check"
              variant={status === 'overdue' ? 'danger' : 'primary'}
              size="sm"
              onPress={onMarkReturned}
              loading={busy}
              style={{ flex: 2 }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: 'route' | 'users' | 'shield-check' | 'circle-check';
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={14} color={colors.textSubtle} />
      <Text variant="caption" color="textSubtle">
        {label}:
      </Text>
      <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
