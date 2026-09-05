import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Icon, IconButton, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, formatDistance, type TripPlan } from '@/domain';

export interface TripPlanCardProps {
  plan: TripPlan;
  onClose?: () => void;
  onOpenPlanner?: () => void;
}

/** Günler, mesafe/irtifa, paketleme ve güvenlik notlarını gösteren plan kartı. */
export function TripPlanCard({ plan, onClose, onOpenPlanner }: TripPlanCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = ADVENTURE_TYPE_META[plan.adventureType];
  const totalKm = plan.days.reduce((sum, d) => sum + d.distanceKm, 0);
  const totalAscent = plan.days.reduce((sum, d) => sum + d.ascentM, 0);

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label" color="textMuted">
            {t('ai.plan.title')}
          </Text>
          <Text variant="h3">{plan.title}</Text>
        </View>
        {onClose ? (
          <IconButton
            icon="x"
            variant="ghost"
            size={32}
            onPress={onClose}
            accessibilityLabel={t('ai.plan.close')}
          />
        ) : null}
      </View>

      <View style={styles.badges}>
        <Badge label={t(meta.labelKey)} color={meta.color} icon={meta.icon} soft />
        <Badge
          label={t('ai.plan.daysCount', { count: plan.days.length })}
          color={colors.textMuted}
          icon="calendar-days"
          soft
        />
      </View>

      <View style={[styles.totals, { backgroundColor: colors.surfaceMuted }]}>
        <View style={styles.total}>
          <Icon name="ruler" size={16} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {t('ai.plan.total')} · {t('ai.plan.distance')}
          </Text>
          <Text variant="title">{formatDistance(totalKm, locale)}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.total}>
          <Icon name="trending-up" size={16} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {t('ai.plan.total')} · {t('ai.plan.ascent')}
          </Text>
          <Text variant="title">{formatAltitude(totalAscent, locale)}</Text>
        </View>
      </View>

      <Text variant="label" color="textMuted">
        {t('ai.plan.days')}
      </Text>
      <View style={styles.days}>
        {plan.days.map((day) => (
          <View key={day.day} style={[styles.day, { borderColor: colors.border }]}>
            <View style={[styles.dayIndex, { backgroundColor: meta.softColor }]}>
              <Text variant="label" color={meta.color}>
                {t('ai.plan.day', { day: day.day })}
              </Text>
            </View>
            <View style={styles.dayBody}>
              <Text variant="title">{day.title}</Text>
              <Text variant="caption" color="textMuted">
                {formatDistance(day.distanceKm, locale)} · +{formatAltitude(day.ascentM, locale)}
              </Text>
              <Text variant="bodySm" color="textMuted">
                {day.notes}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text variant="label" color="textMuted">
        {t('ai.plan.packing')}
      </Text>
      <View style={styles.packing}>
        {plan.packing.map((item) => (
          <View key={item} style={[styles.packItem, { backgroundColor: colors.surfaceMuted }]}>
            <Icon name="check" size={12} color={colors.success} strokeWidth={2.6} />
            <Text variant="caption">{item}</Text>
          </View>
        ))}
      </View>

      <Text variant="label" color="textMuted">
        {t('ai.plan.safety')}
      </Text>
      <View style={styles.safety}>
        {plan.safety.map((note) => (
          <View key={note} style={styles.safetyRow}>
            <Icon name="shield-alert" size={14} color={colors.warning} />
            <Text variant="bodySm" style={styles.safetyText}>
              {note}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption" color="textSubtle">
        {t('ai.disclaimer')}
      </Text>

      {onOpenPlanner ? (
        <Button
          label={t('ai.plan.openPlanner')}
          icon="route"
          variant="secondary"
          size="sm"
          onPress={onOpenPlanner}
          fullWidth
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  totals: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  days: { gap: spacing.sm },
  day: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  dayIndex: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  dayBody: { flex: 1, gap: 2 },
  packing: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  packItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  safety: { gap: spacing.xs },
  safetyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  safetyText: { flex: 1 },
});
