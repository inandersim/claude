import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { Species, SpeciesGroup } from '@/domain';
import { COUNTRY_FLAG, groupEmoji } from '@/domain';

import { DangerBadge } from './DangerBadge';

const GROUP_ICONS: Record<SpeciesGroup, IconName> = {
  snake: 'activity',
  mammal: 'paw-print',
  insect: 'bug',
  arachnid: 'bug',
  marine: 'fish',
  bird: 'bird',
  plant: 'tree-pine',
  fungus: 'hexagon',
};

export interface SpeciesCardProps {
  species: Species;
  onPress?: () => void;
  compact?: boolean;
}

/** Görsel/emoji, ad, latince ad, tehlike rozeti, grup ikonu ve ülke bayrakları. */
export function SpeciesCard({ species, onPress, compact = false }: SpeciesCardProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const flags = species.countryCodes.slice(0, 5).map(COUNTRY_FLAG).join(' ');
  return (
    <Card onPress={onPress} padded={false} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
          {species.imageUrl && !compact ? (
            <Image
              source={{ uri: species.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={species.commonName}
            />
          ) : (
            <Text style={styles.emoji}>{groupEmoji(species.group)}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text variant="title" numberOfLines={1}>
            {species.commonName}
          </Text>
          <Text variant="caption" color="textMuted" style={styles.latin} numberOfLines={1}>
            {species.scientificName}
          </Text>
          <View style={styles.meta}>
            <DangerBadge level={species.danger} />
            <View style={styles.group}>
              <Icon name={GROUP_ICONS[species.group]} size={13} color={colors.textMuted} />
              <Text variant="caption" color="textMuted">
                {t(`wildlife.group.${species.group}`)}
              </Text>
            </View>
          </View>
          {flags ? (
            <Text
              variant="caption"
              color="textSubtle"
              accessibilityLabel={t('wildlife.species.countries')}
            >
              {flags}
              {species.countryCodes.length > 5 ? ` +${species.countryCodes.length - 5}` : ''}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-right" size={18} color={colors.textSubtle} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: { fontSize: 30 },
  body: { flex: 1, gap: spacing.xxs },
  latin: { fontStyle: 'italic' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
