import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, DIFFICULTY_META, mapsUrl } from '@/domain';
import { RecentAdventureRow } from '@/features/explore/components/RecentAdventureRow';
import { useLocationDetail } from '@/features/explore/hooks';
import { DifficultyBadge } from '@/features/feed/components/DifficultyBadge';
import { usePostsByLocation } from '@/features/feed/hooks';
import { HazardCard } from '@/features/hazards/components/HazardCard';
import { useHazards } from '@/features/hazards/hooks';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const location = useLocationDetail(id);
  const posts = usePostsByLocation(location.data?.name.split(' ')[0] ?? '');
  const hazards = useHazards(location.data?.coords ?? null, 30);

  /** Lokasyonu harita bağlantısıyla paylaşır. */
  const onShare = () => {
    const data = location.data;
    if (!data) return;
    Share.share({
      message: `${data.name} · ${data.region} — ${mapsUrl(data.coords.latitude, data.coords.longitude, data.name)}`,
    }).catch(() => undefined);
  };

  return (
    <Screen scroll edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          accessibilityLabel={t('common.back')}
        />
        <IconButton
          icon="share"
          variant="blur"
          onPress={onShare}
          disabled={!location.data}
          accessibilityLabel={t('common.share')}
        />
      </View>

      {location.isError ? (
        <ErrorState onRetry={() => location.refetch()} />
      ) : location.isLoading ? (
        <Skeleton height={320} style={{ borderRadius: 0 }} />
      ) : location.data ? (
        <>
          <AdventureImage
            uri={location.data.imageUrl}
            adventureType={location.data.adventureTypes[0] ?? 'hiking'}
            style={styles.hero}
            overlay
          >
            <View style={styles.heroContent}>
              <View style={styles.trendPill}>
                <Icon name="trending-up" size={12} color="#5EE39B" strokeWidth={2.8} />
                <Text variant="label" weight="extrabold" color="#F2F7F4">
                  +{location.data.trendPercent}% {t('explore.trending').toLocaleUpperCase('tr-TR')}
                </Text>
              </View>
              <Text variant="display" color="#FFFFFF">
                {location.data.name}
              </Text>
              <View style={styles.metaRow}>
                <Icon name="map-pin" size={14} color="rgba(255,255,255,0.8)" />
                <Text variant="bodySm" color="rgba(255,255,255,0.8)">
                  {location.data.region}
                </Text>
              </View>
            </View>
          </AdventureImage>

          <View style={styles.body}>
            <View style={styles.chips}>
              {location.data.adventureTypes.map((type) => {
                const meta = ADVENTURE_TYPE_META[type];
                return (
                  <Badge key={type} label={t(meta.labelKey)} color={meta.color} icon={meta.icon} />
                );
              })}
              <DifficultyBadge grade={location.data.difficulty} />
            </View>

            <View
              style={[
                styles.statsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Stat
                icon="activity"
                label={t('explore.adventures')}
                value={formatCompact(location.data.postsCount, locale)}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Stat
                icon="gauge"
                label={t('post.difficulty')}
                value={t(DIFFICULTY_META[location.data.difficulty].labelKey)}
                color={DIFFICULTY_META[location.data.difficulty].color}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Stat
                icon="sun"
                label={t('explore.bestSeason')}
                value={location.data.bestSeason}
                small
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">{t('explore.aboutLocation')}</Text>
              <Text variant="body" color="textMuted">
                {location.data.description}
              </Text>
            </View>
          </View>

          {hazards.data && hazards.data.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title={t('hazards.title')}
                actionLabel={t('common.seeAll')}
                onAction={() => router.push('/hazards')}
              />
              <View style={styles.list}>
                {hazards.data.slice(0, 3).map((h) => (
                  <HazardCard key={h.id} hazard={h} compact />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={t('explore.adventuresHere')} />
            <View style={styles.list}>
              {posts.isLoading ? (
                [0, 1].map((i) => (
                  <Skeleton key={i} height={124} style={{ borderRadius: radius.lg }} />
                ))
              ) : posts.data && posts.data.length > 0 ? (
                posts.data.map((post) => <RecentAdventureRow key={post.id} post={post} />)
              ) : (
                <EmptyState compact icon="tent" title={t('home.emptyTitle')} />
              )}
            </View>
          </View>
        </>
      ) : (
        <EmptyState
          icon="compass"
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      )}
    </Screen>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={16} color={color ?? colors.primary} strokeWidth={2.4} />
      <Text
        variant={small ? 'caption' : 'title'}
        weight="extrabold"
        color={color}
        numberOfLines={2}
        align="center"
      >
        {value}
      </Text>
      <Text variant="label" color="textSubtle" align="center">
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: { height: 360, width: '100%' },
  heroContent: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    gap: spacing.xs,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    marginBottom: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  divider: { width: StyleSheet.hairlineWidth },
  section: { marginTop: spacing.xxl },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
});
