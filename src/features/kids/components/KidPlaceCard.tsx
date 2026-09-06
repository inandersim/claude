import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  KID_SAFETY_LEVEL_META,
  formatDistance,
  formatPriceTry,
  kidAgeBandMeta,
  kidPlaceKindMeta,
  kidSafetyLevel,
  type KidPlaceWithDistance,
} from '@/domain';

interface Props {
  place: KidPlaceWithDistance;
  width?: number;
}

/** Yer kartı: görsel, tür rozeti, yaş bantları, olanak ikonları, mesafe ve güvenlik seviyesi. */
export function KidPlaceCard({ place, width }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const kind = kidPlaceKindMeta[place.kind];
  const level = kidSafetyLevel(place);
  const levelMeta = KID_SAFETY_LEVEL_META[level];
  const levelColor =
    levelMeta.tone === 'success'
      ? colors.success
      : levelMeta.tone === 'warning'
        ? colors.warning
        : colors.danger;

  const perks: { icon: IconName; label: string; on: boolean }[] = [
    { icon: 'backpack', label: t('kids.stroller'), on: place.strollerFriendly },
    { icon: 'trees', label: t('kids.shade'), on: place.shade },
    { icon: 'house', label: t('kids.toilets'), on: place.toilets },
    { icon: 'droplets', label: t('kids.water'), on: place.water },
  ];

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/kids/place/[id]', params: { id: place.id } })}
      scaleTo={0.97}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        width ? { width } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${t(kind.labelKey)}`}
    >
      <AdventureImage uri={place.imageUrl} adventureType="hiking" style={styles.cover} overlay>
        <View style={styles.top}>
          <View style={[styles.pill, { backgroundColor: kind.color }]}>
            <Icon name={kind.icon as IconName} size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {t(kind.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          {place.savedByMe ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
              <Icon name="bookmark" size={12} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <Text variant="h3" color="#FFFFFF" numberOfLines={1}>
            {place.name}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="star" size={12} color="#FFB547" fill="#FFB547" />
            <Text variant="caption" weight="bold" color="#FFFFFF">
              {place.rating.toFixed(1)}
            </Text>
            <Text
              variant="caption"
              color="rgba(255,255,255,0.75)"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              · {place.locationName}
              {place.distanceKm !== null ? ` · ${formatDistance(place.distanceKm, locale)}` : ''}
            </Text>
          </View>
        </View>
      </AdventureImage>

      <View style={styles.foot}>
        <View style={styles.ageRow}>
          {place.ageBands.map((b) => (
            <View
              key={b}
              style={[styles.ageDot, { backgroundColor: `${kidAgeBandMeta[b].color}26` }]}
            >
              <Text variant="label" weight="bold" color={kidAgeBandMeta[b].color}>
                {t(kidAgeBandMeta[b].labelKey).replace(/ yaş|Ages /g, '')}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.perkRow}>
          {perks.map((p) => (
            <View
              key={p.icon}
              style={styles.perk}
              accessibilityLabel={`${p.label}: ${p.on ? '✓' : '✗'}`}
            >
              <Icon
                name={p.icon}
                size={14}
                color={p.on ? colors.primary : colors.textSubtle}
                strokeWidth={2.2}
              />
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <View style={[styles.level, { backgroundColor: `${levelColor}22` }]}>
            <Icon
              name={levelMeta.icon as IconName}
              size={12}
              color={levelColor}
              strokeWidth={2.4}
            />
            <Text variant="label" weight="bold" color={levelColor}>
              {t(levelMeta.labelKey)}
            </Text>
          </View>
          {place.entryFeeTry !== null ? (
            <Text variant="caption" weight="extrabold" color="primary">
              {formatPriceTry(place.entryFeeTry, locale)}
            </Text>
          ) : null}
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cover: { aspectRatio: 1.6, width: '100%' },
  top: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  bottom: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ageDot: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  perk: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
});
