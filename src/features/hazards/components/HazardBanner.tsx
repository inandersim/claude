import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { GeoPoint } from '@/domain';
import { useHazards } from '@/features/hazards/hooks';

/** Ana sayfada yakın (50 km) aktif tehlike sayısını gösteren uyarı şeridi. */
export function HazardBanner({ origin }: { origin: GeoPoint }) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const hazards = useHazards(origin, 50);
  const list = hazards.data ?? [];
  if (list.length === 0) return null;
  const critical = list.some((h) => h.severity === 'critical');
  const tint = critical ? colors.danger : colors.accent;
  const bg = critical ? colors.dangerSoft : colors.accentSoft;
  const top = list[0];

  return (
    <Tappable
      onPress={() => router.push('/hazards')}
      scaleTo={0.985}
      style={[styles.banner, { backgroundColor: bg, borderColor: tint }]}
      accessibilityRole="button"
    >
      <View style={[styles.icon, { backgroundColor: tint }]}>
        <Icon
          name={critical ? 'siren' : 'triangle-alert'}
          size={16}
          color="#06120B"
          strokeWidth={2.6}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodySm" weight="bold">
          {list.length === 1
            ? t('hazards.nearbyBannerOne')
            : t('hazards.nearbyBanner', { count: list.length })}
        </Text>
        {top ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {top.title}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={tint} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginHorizontal: spacing.lg,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
