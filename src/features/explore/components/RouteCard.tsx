import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPE_META, DIFFICULTY_META, formatDistance, type Route } from '@/domain';

import { RoutePreview } from './RoutePreview';

export function RouteCard({ route, width = 200 }: { route: Route; width?: number }) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const meta = ADVENTURE_TYPE_META[route.adventureType];
  const difficulty = DIFFICULTY_META[route.difficulty];

  return (
    <View
      style={[styles.card, { width, backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <RoutePreview path={route.path} color={meta.color} height={90} />
      <View style={styles.body}>
        <Text variant="title" numberOfLines={2}>
          {route.name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {route.locationName}
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Icon name="route" size={12} color={colors.textSubtle} />
            <Text variant="caption" weight="bold">
              {formatDistance(route.distanceKm, locale)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Icon name="arrow-up" size={12} color={colors.textSubtle} />
            <Text variant="caption" weight="bold">
              {route.elevationGainM} m
            </Text>
          </View>
          <View style={[styles.stat, { marginLeft: 'auto' }]}>
            <View style={[styles.dot, { backgroundColor: difficulty.color }]} />
            <Text variant="caption" weight="bold" color={difficulty.color}>
              {t(difficulty.labelKey)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  body: { padding: spacing.md, gap: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
