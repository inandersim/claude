import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, flagEmoji, type PassportStamp } from '@/domain';

export interface StampCardProps {
  stamp: PassportStamp;
  width?: number;
}

/** Pasaport damgası: dairesel kesikli kenar, bayrak, tarih ve irtifa. Hafif eğik. */
export function StampCard({ stamp, width }: StampCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = ADVENTURE_TYPE_META[stamp.adventureType];
  const tilt = (stamp.id.charCodeAt(stamp.id.length - 1) % 3) - 1; // -1, 0, 1 → hafif eğim

  return (
    <View
      style={[styles.wrap, width ? { width } : null]}
      accessibilityLabel={t('fun.a11y.stamp', {
        place: stamp.placeName,
        country: stamp.countryCode,
      })}
    >
      <View
        style={[
          styles.stamp,
          {
            borderColor: meta.color,
            backgroundColor: meta.softColor,
            transform: [{ rotate: `${tilt * 4}deg` }],
          },
        ]}
      >
        <View style={[styles.inner, { borderColor: meta.color }]}>
          <Text style={styles.flag}>{flagEmoji(stamp.countryCode)}</Text>
          <Text
            variant="caption"
            weight="extrabold"
            align="center"
            numberOfLines={2}
            color={colors.text}
          >
            {stamp.placeName}
          </Text>
          <View style={styles.meta}>
            <Icon name={meta.icon} size={11} color={meta.color} strokeWidth={2.6} />
            <Text variant="label" color={meta.color}>
              {stamp.elevationM !== null
                ? formatAltitude(stamp.elevationM, locale)
                : t('fun.passport.noElevation')}
            </Text>
          </View>
          <Text variant="label" color="textMuted">
            {formatDate(stamp.stampedAt, locale, 'MMM yyyy')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xs },
  stamp: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
  },
  flag: { fontSize: 26, lineHeight: 32 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
