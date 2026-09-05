import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { effectiveSystem, formatGrade, type ClimbingRoute, type GradeSystem } from '@/domain';

import { CLIMB_TYPE_META, VERIFICATION_META } from '../meta';
import { GradeBadge } from './GradeBadge';

export interface RouteRowProps {
  route: ClimbingRoute;
  preferredSystem: GradeSystem;
  /** Rota listelerinde sektör adını göstermek için */
  subtitle?: string;
}

/** Rota satırı: derece rozeti, ad, tür ikonu, yıldız, uzunluk/pitch ve doğrulama. */
export function RouteRow({ route, preferredSystem, subtitle }: RouteRowProps) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const type = CLIMB_TYPE_META[route.type];
  const verification = VERIFICATION_META[route.verification];
  const system = effectiveSystem(route.gradeSystem, preferredSystem);
  const grade = formatGrade(route, system);

  const detail: string[] = [];
  if (route.lengthM) detail.push(`${route.lengthM} m`);
  if (route.pitches > 1) detail.push(t('climbing.pitchesValue', { count: route.pitches }));
  if (route.bolts) detail.push(`${route.bolts} ${t('climbing.bolts').toLocaleLowerCase('tr-TR')}`);

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/climbing/route/[id]', params: { id: route.id } })}
      scaleTo={0.985}
      haptic="selection"
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${route.name}, ${grade}, ${t(type.labelKey)}, ${t(verification.labelKey)}`}
    >
      <GradeBadge grade={grade} system={system} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {route.name}
          </Text>
          {route.verification !== 'verified' ? (
            <Icon name={verification.icon} size={14} color={verification.color} strokeWidth={2.4} />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Icon name={type.icon} size={12} color={type.color} strokeWidth={2.4} />
          <Text variant="caption" weight="bold" color={type.color}>
            {t(type.labelKey)}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSubtle" numberOfLines={1} style={{ flexShrink: 1 }}>
              · {subtitle}
            </Text>
          ) : null}
          {detail.length ? (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              · {detail.join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        <Stars value={route.stars} />
        <Text variant="label" color="textSubtle">
          {t('climbing.ascentsCount', { count: route.ascentCount })}
        </Text>
      </View>
    </Tappable>
  );
}

/** 0–5 yıldız; dolu yıldızlar accent renginde. */
export function Stars({ value, size = 11 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stars} accessibilityLabel={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          color={i <= value ? colors.accent : colors.borderStrong}
          fill={i <= value ? colors.accent : 'none'}
          strokeWidth={2}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { alignItems: 'flex-end', gap: 4 },
  stars: { flexDirection: 'row', gap: 1 },
});
