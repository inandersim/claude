import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  formatDistance,
  localizedPlaceName,
  PLACE_KIND_META,
  type LibraryPlaceWithDistance,
} from '@/domain';

const FLAGS: Record<string, string> = {
  TR: '🇹🇷',
  GR: '🇬🇷',
  DE: '🇩🇪',
  AT: '🇦🇹',
  CH: '🇨🇭',
  FR: '🇫🇷',
  ES: '🇪🇸',
  IT: '🇮🇹',
  GB: '🇬🇧',
  US: '🇺🇸',
  CA: '🇨🇦',
  JP: '🇯🇵',
  NZ: '🇳🇿',
  AU: '🇦🇺',
  NP: '🇳🇵',
  BR: '🇧🇷',
  EG: '🇪🇬',
  TH: '🇹🇭',
  ID: '🇮🇩',
  MX: '🇲🇽',
  AR: '🇦🇷',
  CL: '🇨🇱',
  ZA: '🇿🇦',
  IS: '🇮🇸',
  PT: '🇵🇹',
  SI: '🇸🇮',
  MY: '🇲🇾',
  PE: '🇵🇪',
  TZ: '🇹🇿',
  RU: '🇷🇺',
  ZM: '🇿🇲',
};
export const flagFor = (code: string | null) => (code ? (FLAGS[code] ?? code) : '');

export function PlaceCard({
  place,
  width,
  row = false,
}: {
  place: LibraryPlaceWithDistance;
  width?: number;
  row?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = PLACE_KIND_META[place.kind];
  const open = () => router.push({ pathname: '/library/[id]', params: { id: place.id } });
  const name = localizedPlaceName(place, locale);

  if (row) {
    return (
      <Tappable
        onPress={open}
        scaleTo={0.98}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={name}
      >
        <AdventureImage
          uri={place.image?.thumbUrl ?? null}
          kucuk
          adventureType={place.adventureTypes[0] ?? 'hiking'}
          style={styles.rowThumb}
        >
          <View style={[styles.kindDot, { backgroundColor: meta.color }]}>
            <Icon name={meta.icon} size={11} color="#06120B" strokeWidth={2.6} />
          </View>
        </AdventureImage>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" weight="extrabold" color={meta.color}>
            {t(meta.labelKey).toLocaleUpperCase(locale)}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {flagFor(place.countryCode)} {place.countryCode ?? ''}
            {place.elevationM !== null ? ` · ${Math.round(place.elevationM)} m` : ''}
            {place.distanceKm !== null ? ` · ${formatDistance(place.distanceKm, locale)}` : ''}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textSubtle} />
      </Tappable>
    );
  }

  return (
    <Tappable
      onPress={open}
      scaleTo={0.97}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        width ? { width } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <AdventureImage
        uri={place.image?.thumbUrl ?? null}
        kucuk
        adventureType={place.adventureTypes[0] ?? 'hiking'}
        style={styles.cover}
        overlay
      >
        <View style={[styles.kindPill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
          <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.6} />
          <Text variant="label" weight="extrabold" color="#F2F7F4">
            {t(meta.labelKey).toLocaleUpperCase(locale)}
          </Text>
        </View>
        <View style={styles.bottom}>
          <Text variant="title" color="#FFFFFF" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>
            {flagFor(place.countryCode)} {place.countryCode ?? ''}
            {place.elevationM !== null ? ` · ${Math.round(place.elevationM)} m` : ''}
            {place.distanceKm !== null ? ` · ${formatDistance(place.distanceKm, locale)}` : ''}
          </Text>
        </View>
      </AdventureImage>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cover: { aspectRatio: 1.1, width: '100%' },
  kindPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  bottom: {
    position: 'absolute',
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    bottom: spacing.sm + 2,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowThumb: { width: 72, height: 72, borderRadius: radius.md },
  kindDot: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
