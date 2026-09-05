import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, ProgressRing, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  coverageLabel,
  SAT_DEVICE_META,
  satelliteCoverage,
  type GeoPoint,
  type SatDeviceType,
} from '@/domain';

interface Props {
  coords: GeoPoint;
  deviceType: SatDeviceType;
  deviceName?: string;
}

/** Konum + cihaz türüne göre tahmini uydu kapsaması (halka gösterge). */
export function CoverageGauge({ coords, deviceType, deviceName }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const value = satelliteCoverage(coords, deviceType);
  const level = coverageLabel(value);
  const tint =
    level === 'none' || level === 'poor'
      ? colors.danger
      : level === 'fair'
        ? colors.warning
        : colors.success;
  const meta = SAT_DEVICE_META[deviceType];

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t('satellite.coverage')}: ${t(`satellite.coverageLevel.${level}`)}, ${Math.round(value * 100)}%`}
    >
      <ProgressRing value={Math.round(value * 100)} size={76} strokeWidth={7} color={tint}>
        <Text variant="title" weight="extrabold" color={tint}>
          {Math.round(value * 100)}%
        </Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title">{t('satellite.coverage')}</Text>
        <View style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: tint }]} />
          <Text variant="body" weight="bold" color={tint}>
            {t(`satellite.coverageLevel.${level}`)}
          </Text>
        </View>
        <View style={styles.deviceRow}>
          <Icon name={meta.icon as IconName} size={13} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" numberOfLines={2} style={{ flex: 1 }}>
            {deviceName ?? t(meta.labelKey)} · {meta.network}
          </Text>
        </View>
        <Text variant="caption" color="textSubtle" numberOfLines={2}>
          {t('satellite.coverageHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
