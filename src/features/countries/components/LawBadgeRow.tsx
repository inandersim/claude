import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { campingLaw, lawTone, type CountryGuide, type LawTone } from '@/domain';
import { LAW_TONE_COLOR } from '@/features/countries/meta';

interface Props {
  guide: CountryGuide;
}

const TONE_ICON: Record<LawTone, IconName> = {
  allowed: 'circle-check',
  restricted: 'circle-alert',
  banned: 'ban',
};

/** Drone / alkol / kamp için üç hızlı rozet — metinden çıkarılan sinyal renklendirir. */
export function LawBadgeRow({ guide }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const camping = campingLaw(guide);
  const items: { key: string; label: string; icon: IconName; tone: LawTone }[] = [
    {
      key: 'drone',
      label: t('countries.law.drone'),
      icon: 'radar',
      tone: lawTone(guide.droneRules),
    },
    {
      key: 'alcohol',
      label: t('countries.law.alcohol'),
      icon: 'droplets',
      tone: lawTone(guide.alcoholRules),
    },
    {
      key: 'camping',
      label: t('countries.law.camping'),
      icon: 'tent',
      tone: camping ? lawTone(camping) : 'restricted',
    },
  ];

  return (
    <View style={styles.row}>
      {items.map((item) => {
        const color = colors[LAW_TONE_COLOR[item.tone]];
        return (
          <View
            key={item.key}
            style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: color }]}
            accessibilityLabel={`${item.label}: ${item.tone}`}
          >
            <Icon name={item.icon} size={16} color={color} strokeWidth={2.4} />
            <Text variant="caption" weight="bold" style={{ flex: 1 }}>
              {item.label}
            </Text>
            <Icon name={TONE_ICON[item.tone]} size={14} color={color} strokeWidth={2.6} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
