import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Skeleton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { queryKeys } from '@/core/query/keys';
import { radius, spacing, useTheme } from '@/core/theme';
import { getDataProvider } from '@/data';
import { ADVENTURE_TYPE_META, formatDistance, type HeritageSite } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

interface Props {
  site: HeritageSite;
}

interface LinkCardProps {
  icon: 'footprints' | 'map' | 'compass';
  kindLabel: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

function LinkCard({ icon, kindLabel, title, subtitle, color, onPress }: LinkCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel}: ${title}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Icon name={icon} size={18} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color="textSubtle">
          {kindLabel}
        </Text>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.open}>
        <Text variant="caption" weight="bold" color="primary">
          {t('heritage.linked.open')}
        </Text>
        <Icon name="chevron-right" size={14} color={colors.primary} />
      </View>
    </Tappable>
  );
}

/** Bağlı rota (track / harita bölgesi) ve destinasyon kartları. */
export function LinkedAdventure({ site }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const trailId = site.linkedTrailId;
  const isRegion = Boolean(trailId?.startsWith('reg_'));

  const track = useQuery({
    queryKey: queryKeys.tracks.detail(me.id, trailId ?? ''),
    queryFn: () => getDataProvider().tracks.getById(me.id, trailId ?? ''),
    enabled: Boolean(trailId) && !isRegion,
  });
  const regions = useQuery({
    queryKey: queryKeys.maps.regions,
    queryFn: () => getDataProvider().maps.regions(),
    enabled: isRegion,
  });
  const dest = useQuery({
    queryKey: queryKeys.destinations.detail(me.id, site.linkedDestinationId ?? ''),
    queryFn: () =>
      getDataProvider().destinations.getById(me.id, site.linkedDestinationId ?? '', null),
    enabled: Boolean(site.linkedDestinationId),
  });

  const trackData = track.data ?? null;
  const destData = dest.data ?? null;
  const region = isRegion ? regions.data?.find((r) => r.id === trailId) : undefined;
  const loading =
    (track.isLoading && track.fetchStatus !== 'idle') ||
    (regions.isLoading && regions.fetchStatus !== 'idle') ||
    (dest.isLoading && dest.fetchStatus !== 'idle');
  const hasAny = Boolean(trailId || site.linkedDestinationId || site.nearestTrailhead);
  if (!hasAny) return null;

  return (
    <View style={styles.root}>
      {loading ? <Skeleton height={72} style={{ borderRadius: radius.lg }} /> : null}
      {trackData ? (
        <LinkCard
          icon="footprints"
          kindLabel={t('heritage.linked.trail')}
          title={trackData.name}
          subtitle={`${formatDistance(trackData.distanceKm, locale)} · ${trackData.regionName}`}
          color={ADVENTURE_TYPE_META[trackData.adventureType].color}
          onPress={() => router.push({ pathname: '/tracks/[id]', params: { id: trackData.id } })}
        />
      ) : null}
      {region ? (
        <LinkCard
          icon="map"
          kindLabel={t('heritage.linked.region')}
          title={region.name}
          subtitle={region.countryCode}
          color={colors.info}
          onPress={() => router.push('/maps')}
        />
      ) : null}
      {destData ? (
        <LinkCard
          icon="compass"
          kindLabel={t('heritage.linked.destination')}
          title={destData.name}
          subtitle={destData.region}
          color={colors.accent}
          onPress={() =>
            router.push({ pathname: '/destinations/[id]', params: { id: destData.id } })
          }
        />
      ) : null}
      {site.nearestTrailhead ? (
        <View style={styles.trailhead}>
          <Icon name="flag" size={14} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('heritage.linked.trailhead')}: {site.nearestTrailhead}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trailhead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 4 },
});
