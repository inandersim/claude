import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  bestSeasonLabel,
  countryFlag,
  formatDistance,
  isInSeason,
  type CragWithDistance,
} from '@/domain';

import { CLIMB_TYPE_META, VERIFICATION_META } from '../meta';

export interface CragCardProps {
  crag: CragWithDistance;
  /** Render dışında hesaplanmış "şimdi" (sezon etiketi için) */
  now?: Date;
}

/** Kaya kartı: kapak, ad, bayrak, rota sayısı, tür rozetleri, doğrulama ve mesafe. */
export function CragCard({ crag, now }: CragCardProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const verification = VERIFICATION_META[crag.verification];
  const inSeason = now ? isInSeason(crag.seasons, now) : false;

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/climbing/[cragId]', params: { cragId: crag.id } })}
      scaleTo={0.985}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${crag.name}, ${crag.locationName}, ${t('climbing.routesCount', { count: crag.routeCount })}`}
    >
      <AdventureImage uri={crag.imageUrl} adventureType="climbing" style={styles.cover} overlay kucuk>
        <View style={styles.coverTop}>
          <View style={[styles.pill, { backgroundColor: verification.color }]}>
            <Icon name={verification.icon} size={12} color="#FFFFFF" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {t(verification.labelKey)}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {crag.distanceKm !== null ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
              <Icon name="navigation" size={12} color="#F2F7F4" strokeWidth={2.4} />
              <Text variant="label" weight="extrabold" color="#F2F7F4">
                {formatDistance(crag.distanceKm, locale)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.coverBottom}>
          <Text variant="h3" color="#FFFFFF" numberOfLines={1}>
            {countryFlag(crag.countryCode)} {crag.name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={1}>
            {crag.locationName} · {crag.rockType}
          </Text>
        </View>
      </AdventureImage>

      <View style={styles.foot}>
        <View style={styles.types}>
          {crag.climbTypes.slice(0, 3).map((type) => {
            const meta = CLIMB_TYPE_META[type];
            return (
              <View
                key={type}
                style={[styles.typeChip, { backgroundColor: `${meta.color}22` }]}
                accessibilityLabel={t(meta.labelKey)}
              >
                <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.4} />
                <Text variant="label" weight="bold" color={meta.color}>
                  {t(meta.labelKey)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.metaRow}>
          <Icon name="route" size={13} color={colors.textSubtle} />
          <Text variant="caption" weight="bold" color="textMuted">
            {t('climbing.routesCount', { count: crag.routeCount })}
          </Text>
          <Text variant="caption" color="textSubtle">
            ·
          </Text>
          <Icon
            name={inSeason ? 'sun' : 'calendar'}
            size={13}
            color={inSeason ? colors.primary : colors.textSubtle}
          />
          <Text variant="caption" color={inSeason ? 'primary' : 'textMuted'} numberOfLines={1}>
            {bestSeasonLabel(crag.seasons, locale)}
          </Text>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: { height: 168, justifyContent: 'space-between', padding: spacing.md },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coverBottom: { gap: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radius.full,
  },
  foot: { padding: spacing.md, gap: spacing.sm },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.full,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
