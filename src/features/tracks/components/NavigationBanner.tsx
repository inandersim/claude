import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { NavigationProgress, NavigationStep } from '@/domain';
import { instructionText, roundedDistanceLabel } from '@/domain/tracks';

import { MANEUVER_ICON } from './meta';

interface Props {
  step: NavigationStep | null;
  progress: NavigationProgress | null;
  arrived?: boolean;
}

/** Büyük manevra ikonu + mesafe + talimat; rotadan çıkıldıysa kırmızı uyarı */
export function NavigationBanner({ step, progress, arrived = false }: Props) {
  const { t, locale } = useT();
  const { colors, isDark } = useTheme();

  const offRoute = progress?.isOffRoute ?? false;
  const bg = offRoute ? colors.danger : arrived ? colors.success : colors.primary;
  const fg = isDark && !offRoute ? '#06120B' : '#FFFFFF';
  const distanceM = progress?.distanceToNextM ?? step?.distanceM ?? 0;

  let title: string;
  let subtitle: string | null = null;
  let icon = MANEUVER_ICON.continue;
  if (offRoute && progress) {
    title = t('tracks.nav.offRoute', {
      distance: roundedDistanceLabel(progress.offRouteM, locale),
    });
    icon = { icon: 'triangle-alert', rotate: 0 };
  } else if (arrived) {
    title = t('tracks.nav.arrived');
    icon = MANEUVER_ICON.arrive;
  } else if (step) {
    const next = step;
    const instruction = instructionText(next, locale, distanceM);
    title = t(instruction.key, instruction.params);
    subtitle = next.poiName;
    icon = MANEUVER_ICON[next.maneuver];
  } else {
    title = t('tracks.nav.locating');
  }

  return (
    <View
      style={[styles.root, { backgroundColor: bg }]}
      accessibilityRole="header"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,0,0,0.18)' }]}>
        <View style={{ transform: [{ rotate: `${icon.rotate}deg` }] }}>
          <Icon name={icon.icon} size={34} color={fg} strokeWidth={2.6} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {!offRoute && !arrived && step ? (
          <Text variant="h1" color={fg} weight="extrabold">
            {roundedDistanceLabel(distanceM, locale)}
          </Text>
        ) : null}
        <Text variant="title" color={fg} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={fg} style={{ opacity: 0.85 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
