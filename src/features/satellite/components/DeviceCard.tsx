import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { SAT_DEVICE_META, type SatDevice } from '@/domain';

interface Props {
  device: SatDevice;
  onUnpair?: () => void;
  unpairing?: boolean;
}

function batteryIcon(pct: number | null): IconName {
  if (pct === null) return 'zap';
  if (pct < 20) return 'battery-low';
  if (pct < 60) return 'battery-medium';
  return 'battery';
}

/** Eşleşmiş uydu cihazı: tür ikonu, pil, son görülme ve aylık kota çubuğu. */
export function DeviceCard({ device, onUnpair, unpairing = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = SAT_DEVICE_META[device.type];
  const unlimited = device.monthlyQuota <= 0;
  const ratio = unlimited ? 0 : Math.min(1, device.usedThisMonth / device.monthlyQuota);
  const quotaColor = ratio > 0.9 ? colors.danger : ratio > 0.7 ? colors.warning : colors.primary;
  const batteryColor =
    device.batteryPct !== null && device.batteryPct < 20 ? colors.danger : colors.textMuted;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${device.name}, ${t(meta.labelKey)}`}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: colors.infoSoft }]}>
          <Icon name={meta.icon as IconName} size={20} color={colors.info} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {device.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {t(meta.labelKey)} · {meta.network}
            {device.imei ? ` · IMEI ${device.imei.slice(-6)}` : ''}
          </Text>
        </View>
        {onUnpair ? (
          <Button
            label={t('satellite.unpair')}
            size="sm"
            variant="ghost"
            icon="unlink"
            onPress={onUnpair}
            loading={unpairing}
          />
        ) : null}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Icon name={batteryIcon(device.batteryPct)} size={14} color={batteryColor} />
          <Text variant="caption" weight="bold" color={batteryColor}>
            {device.batteryPct === null ? '—' : `${device.batteryPct}%`}
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="clock" size={14} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted">
            {t('satellite.lastSeen')}:{' '}
            {device.lastSeenAt ? formatRelative(device.lastSeenAt, new Date(), locale) : '—'}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <View style={styles.quotaRow}>
          <Text variant="caption" color="textSubtle">
            {t('satellite.quota')}
          </Text>
          <Text variant="caption" weight="bold">
            {unlimited
              ? t('satellite.quotaUnlimited')
              : t('satellite.quotaUsed', {
                  used: device.usedThisMonth,
                  total: device.monthlyQuota,
                })}
          </Text>
        </View>
        <View
          style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        >
          <View
            style={[
              styles.fill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: quotaColor },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
