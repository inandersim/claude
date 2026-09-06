import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDuration } from '@/core/utils/time';
import { formatDistance, sortStages, type DestinationStage } from '@/domain';

import { CONNECTIVITY_ICON, STAGE_KIND_ICON } from './meta';

interface Props {
  stages: DestinationStage[];
  /** Uyarı verilen etap id'leri (ascentRateWarning) */
  warningIds?: Set<string>;
}

/** Dikey zaman çizelgesi: irtifa, mesafe/süre, konaklama, bağlantı, dinlenme günü rozeti. */
export function StageTimeline({ stages, warningIds }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const sorted = sortStages(stages);

  return (
    <View style={styles.root}>
      {sorted.map((s, i) => {
        const isLast = i === sorted.length - 1;
        const warned = warningIds?.has(s.id) ?? false;
        const isTop = s.kind === 'summit' || s.kind === 'pass';
        const dotColor = warned ? colors.warning : isTop ? colors.accent : colors.primary;
        return (
          <View key={s.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[styles.dot, { backgroundColor: dotColor, borderColor: colors.surface }]}
              >
                <Icon name={STAGE_KIND_ICON[s.kind]} size={12} color="#FFFFFF" strokeWidth={2.6} />
              </View>
              {!isLast ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: warned ? colors.warning : colors.border,
                },
              ]}
            >
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" color="textSubtle">
                    {String(s.order).padStart(2, '0')} · {t(`destinations.stageKind.${s.kind}`)}
                  </Text>
                  <Text variant="title" numberOfLines={2}>
                    {s.name}
                  </Text>
                </View>
                <Text variant="h3" color={isTop ? 'accent' : 'primary'}>
                  {formatAltitude(s.elevationM, locale)}
                </Text>
              </View>
              {i > 0 ? (
                <View style={styles.metaRow}>
                  <Icon name="ruler" size={13} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted">
                    {formatDistance(s.distanceKm, locale)} · {formatDuration(s.durationMin, locale)}{' '}
                    {t('destinations.stages.fromPrevious')}
                  </Text>
                </View>
              ) : null}
              <View style={styles.badges}>
                {s.sleeping ? (
                  <Badge
                    label={t('destinations.stages.sleepHere')}
                    color={colors.primary}
                    icon="moon"
                  />
                ) : (
                  <Badge
                    label={t('destinations.stages.passThrough')}
                    color={colors.textSubtle}
                    icon="footprints"
                  />
                )}
                {s.restDayRecommended ? (
                  <Badge
                    label={t('destinations.stages.restDay')}
                    color={colors.success}
                    icon="calendar-plus"
                  />
                ) : null}
                <Badge
                  label={t(`destinations.connectivity.${s.connectivity}`)}
                  color={s.connectivity === 'none' ? colors.textSubtle : colors.info}
                  icon={CONNECTIVITY_ICON[s.connectivity]}
                />
                <Badge
                  label={
                    s.waterAvailable
                      ? t('destinations.stages.water')
                      : t('destinations.stages.noWater')
                  }
                  color={s.waterAvailable ? colors.info : colors.danger}
                  icon="droplets"
                />
              </View>
              {s.facilities.length > 0 ? (
                <Text variant="caption" color="textMuted" numberOfLines={2}>
                  {t('destinations.stages.facilities')}: {s.facilities.join(' · ')}
                </Text>
              ) : null}
              {s.note ? (
                <Text variant="bodySm" color="textMuted">
                  {s.note}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 28, alignItems: 'center' },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: spacing.sm,
  },
  line: { flex: 1, width: 2, marginVertical: 2 },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
