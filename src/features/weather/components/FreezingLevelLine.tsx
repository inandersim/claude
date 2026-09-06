import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';

interface Props {
  freezingLevelM: number | null;
  /** Kullanıcının / hedefin rakımı */
  elevationM: number | null;
}

/** Donma seviyesi çizgisi: 0–5000 m ölçeğinde donma seviyesi ve konum işaretçileri. */
export function FreezingLevelLine({ freezingLevelM, elevationM }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const max = 5000;
  const pct = (m: number) => Math.min(100, Math.max(0, (m / max) * 100));

  const diff = freezingLevelM != null && elevationM != null ? freezingLevelM - elevationM : null;
  const belowYou = diff != null && diff < 0;
  const tint = belowYou ? colors.info : colors.primary;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={
        freezingLevelM != null
          ? `${t('weather.freezingLevel')}: ${formatAltitude(freezingLevelM, locale)}`
          : t('weather.freezingLevelUnknown')
      }
    >
      <View style={styles.head}>
        <Icon name="thermometer" size={18} color={tint} />
        <Text variant="title" style={{ flex: 1 }}>
          {t('weather.freezingLevel')}
        </Text>
        <Text variant="title" weight="extrabold" color={tint}>
          {freezingLevelM != null ? formatAltitude(freezingLevelM, locale) : '—'}
        </Text>
      </View>

      <View style={styles.track} accessible={false}>
        <View style={[styles.rail, { backgroundColor: colors.surfaceMuted }]}>
          {freezingLevelM != null ? (
            <View
              style={[
                styles.fill,
                { width: `${pct(freezingLevelM)}%`, backgroundColor: `${colors.info}55` },
              ]}
            />
          ) : null}
        </View>
        {freezingLevelM != null ? (
          <View style={[styles.marker, { left: `${pct(freezingLevelM)}%` }]}>
            <View style={[styles.markerLine, { backgroundColor: colors.info }]} />
            <Icon name="snowflake" size={12} color={colors.info} />
          </View>
        ) : null}
        {elevationM != null ? (
          <View style={[styles.marker, styles.markerYou, { left: `${pct(elevationM)}%` }]}>
            <Icon name="map-pin" size={12} color={colors.primary} />
            <View style={[styles.markerLine, { backgroundColor: colors.primary }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text variant="caption" color="textSubtle">
          0 m
        </Text>
        <Text variant="caption" color="textSubtle">
          2500 m
        </Text>
        <Text variant="caption" color="textSubtle">
          5000 m
        </Text>
      </View>

      <Text variant="caption" color="textMuted" numberOfLines={2}>
        {diff == null
          ? t('weather.freezingLevelHint')
          : belowYou
            ? t('weather.freezingLevelBelowYou', { diff: Math.abs(Math.round(diff)) })
            : t('weather.freezingLevelAboveYou', { diff: Math.round(diff) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 44, justifyContent: 'center', marginHorizontal: 6 },
  rail: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  marker: { position: 'absolute', top: 0, alignItems: 'center', marginLeft: -6, gap: 1 },
  markerYou: { top: undefined, bottom: 0 },
  markerLine: { width: 2, height: 10, borderRadius: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
