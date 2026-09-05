import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { LINK_META, signalBars, type LinkStatus } from '@/domain';

interface Props {
  status: LinkStatus;
}

/** Aktif bağlantı katmanı: ikon, sinyal çubukları, uydu sayısı ve gecikme. */
export function LinkBanner({ status }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const meta = LINK_META[status.link];
  const offline = status.link === 'none';
  const tint = offline ? colors.danger : status.link === 'satellite' ? colors.info : colors.success;
  const bars = signalBars(status.signal);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: offline ? colors.dangerSoft : colors.surface,
          borderColor: offline ? colors.danger : colors.border,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${t(meta.labelKey)} · ${t('satellite.link.signal')} ${status.signal}%`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
        <Icon name={meta.icon as IconName} size={22} color={tint} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {t(meta.labelKey)}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {offline
            ? t('satellite.link.noneHint')
            : status.link === 'satellite'
              ? `${t('satellite.link.satellitesInView', { count: status.satellitesInView })} · ${t('satellite.link.latency', { seconds: status.estimatedLatencyS })}`
              : `${t('satellite.link.signal')} ${status.signal}% · ${t('satellite.link.latency', { seconds: status.estimatedLatencyS })}`}
        </Text>
      </View>
      <View style={styles.bars} accessible={false}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 6 + i * 4,
                backgroundColor: i <= bars ? tint : colors.border,
              },
            ]}
          />
        ))}
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
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  bar: { width: 5, borderRadius: 2 },
});
