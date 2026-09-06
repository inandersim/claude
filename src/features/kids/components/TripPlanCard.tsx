import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, StatTile, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { familyTripPlan, kidAgeBandMeta, type KidAgeBand, type KidPlace } from '@/domain';

interface Props {
  place: Pick<KidPlace, 'trailMin' | 'trailKm' | 'shade' | 'water'>;
  ageBand: KidAgeBand;
}

/** Yaş bandına göre süre / mola / su / atıştırmalık önerisi. */
export function TripPlanCard({ place, ageBand }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const plan = familyTripPlan(place, ageBand);
  const band = kidAgeBandMeta[ageBand];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name="calendar-check" size={18} color={colors.primary} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text variant="title" weight="extrabold">
            {t('kids.plan.title')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('kids.plan.subtitle', { age: t(band.labelKey) })}
          </Text>
        </View>
      </View>
      <View style={styles.tiles}>
        <StatTile
          compact
          icon="clock"
          label={t('kids.plan.duration')}
          value={formatDuration(plan.durationMin, locale)}
          style={styles.tile}
        />
        <StatTile
          compact
          icon="pause"
          label={t('kids.plan.breaks')}
          value={t('kids.plan.breaksValue', { count: plan.breaks })}
          style={styles.tile}
        />
        <StatTile
          compact
          icon="droplets"
          label={t('kids.plan.water')}
          value={t('kids.plan.waterValue', { liters: plan.waterLiters })}
          color={colors.info}
          style={styles.tile}
        />
        <StatTile
          compact
          icon="package"
          label={t('kids.plan.snacks')}
          value={t('kids.plan.snacksValue', { count: plan.snacks })}
          color={colors.warning}
          style={styles.tile}
        />
      </View>
      <Text variant="caption" color="textMuted">
        {t('kids.plan.startHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
});
