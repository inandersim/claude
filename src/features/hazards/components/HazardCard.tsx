import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import {
  formatDistance,
  HAZARD_SEVERITY_META,
  HAZARD_TYPE_META,
  type HazardZoneWithReporter,
} from '@/domain';

import { SeverityBadge } from './SeverityBadge';

export function HazardCard({
  hazard,
  compact = false,
}: {
  hazard: HazardZoneWithReporter;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const type = HAZARD_TYPE_META[hazard.type];
  const severity = HAZARD_SEVERITY_META[hazard.severity];
  const resolved = hazard.status === 'resolved';

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/hazards/[id]', params: { id: hazard.id } })}
      scaleTo={0.985}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: resolved ? colors.borderStrong : severity.color,
          opacity: resolved ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={hazard.title}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: resolved ? colors.surfaceMuted : `${severity.color}22` },
        ]}
      >
        <Icon
          name={type.icon}
          size={20}
          color={resolved ? colors.textSubtle : severity.color}
          strokeWidth={2.2}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.topRow}>
          <Text variant="caption" weight="bold" color={resolved ? 'textSubtle' : severity.color}>
            {t(type.labelKey)}
          </Text>
          {hazard.distanceKm !== null ? (
            <Text variant="caption" color="textSubtle">
              · {formatDistance(hazard.distanceKm, locale)}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {resolved ? (
            <Text variant="label" weight="extrabold" color="textSubtle">
              {t('hazards.resolved').toLocaleUpperCase('tr-TR')}
            </Text>
          ) : (
            <SeverityBadge severity={hazard.severity} />
          )}
        </View>
        <Text variant="title" numberOfLines={compact ? 1 : 2}>
          {hazard.title}
        </Text>
        {!compact ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {hazard.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Icon name="map-pin" size={12} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {hazard.locationName}
          </Text>
          <Text variant="caption" color="textSubtle">
            · {formatRelative(hazard.createdAt, new Date(), locale)}
          </Text>
          <View style={{ flex: 1 }} />
          <Icon
            name="shield-check"
            size={12}
            color={hazard.confirmedByMe ? colors.primary : colors.textSubtle}
            strokeWidth={2.4}
          />
          <Text
            variant="caption"
            weight="bold"
            color={hazard.confirmedByMe ? 'primary' : 'textMuted'}
          >
            {hazard.confirmations}
          </Text>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
});
