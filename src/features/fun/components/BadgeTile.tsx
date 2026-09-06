import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { BadgeTier, BadgeWithStatus } from '@/domain';

/** Rozet kademesi renkleri (halka ve etiket) */
export const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#C98A4B',
  silver: '#9FB0BF',
  gold: '#F2C14E',
  legend: '#B388FF',
};

export interface BadgeTileProps {
  badge: BadgeWithStatus;
  width?: number;
}

/** Kilitliyse gri ve soluk; kazanıldıysa kademe rengiyle halkalı. */
export function BadgeTile({ badge, width }: BadgeTileProps) {
  const { t } = useT();
  const { colors, isDark } = useTheme();
  const earned = badge.earnedAt !== null;
  const tint = earned ? TIER_COLORS[badge.tier] : colors.textSubtle;
  const icon = badge.icon as IconName;

  return (
    <View
      style={[
        styles.root,
        width ? { width } : null,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityLabel={t(earned ? 'fun.a11y.badgeEarned' : 'fun.a11y.badgeLocked', {
        name: badge.name,
      })}
    >
      <View
        style={[
          styles.ring,
          {
            borderColor: tint,
            backgroundColor: earned ? `${tint}${isDark ? '2E' : '22'}` : colors.surfaceMuted,
            borderStyle: earned ? 'solid' : 'dashed',
          },
        ]}
      >
        <Icon name={icon} size={26} color={tint} strokeWidth={earned ? 2.2 : 1.8} />
        {!earned ? (
          <View
            style={[styles.lock, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="lock" size={10} color={colors.textMuted} strokeWidth={2.4} />
          </View>
        ) : null}
      </View>
      <Text
        variant="caption"
        weight="bold"
        align="center"
        numberOfLines={2}
        color={earned ? 'text' : 'textMuted'}
      >
        {badge.name}
      </Text>
      <Text variant="label" color={tint} align="center">
        {t(`fun.tier.${badge.tier}`).toLocaleUpperCase(currentLocale())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 132,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
