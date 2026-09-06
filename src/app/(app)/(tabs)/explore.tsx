import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Avatar,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';
import { RecentAdventureRow } from '@/features/explore/components/RecentAdventureRow';
import { RouteCard } from '@/features/explore/components/RouteCard';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { TrendingLocationCard } from '@/features/explore/components/TrendingLocationCard';
import { useExploreSearch, usePopularRoutes, useTrendingLocations } from '@/features/explore/hooks';
import { useFeed } from '@/features/feed/hooks';
import { HazardCard } from '@/features/hazards/components/HazardCard';
import { useHazards } from '@/features/hazards/hooks';
import { InstructorCard } from '@/features/instructors/components/InstructorCard';
import { useInstructors } from '@/features/instructors/hooks';
import { StreamCard } from '@/features/live/components/StreamCard';
import { useStreams } from '@/features/live/hooks';
import { ListingCard } from '@/features/market/components/ListingCard';
import { useListings } from '@/features/market/hooks';
import { useCurrentUser } from '@/features/auth/session.store';
import { PlaceCard } from '@/features/library/components/PlaceCard';
import { useLibrarySearch } from '@/features/library/hooks';
import { BusinessCard } from '@/features/stays/components/BusinessCard';
import { useBusinesses } from '@/features/stays/hooks';

const MODULE_LINKS = [
  { href: '/assistant', icon: 'sparkles', labelKey: 'ai.title', color: '#CE93D8' },
  { href: '/maps', icon: 'map', labelKey: 'maps.title', color: '#5EE39B' },
  { href: '/climbing', icon: 'mountain', labelKey: 'climbing.title', color: '#FF8A5B' },
  { href: '/satellite', icon: 'satellite', labelKey: 'satellite.title', color: '#6CB4FF' },
  { href: '/clubs', icon: 'school', labelKey: 'clubs.title', color: '#FFD54F' },
  { href: '/fun', icon: 'gamepad-2', labelKey: 'fun.title', color: '#FF6B9D' },
  { href: '/destinations', icon: 'compass', labelKey: 'destinations.title', color: '#5EE39B' },
  { href: '/countries', icon: 'globe', labelKey: 'countries.title', color: '#6CB4FF' },
  { href: '/tracks', icon: 'route', labelKey: 'tracks.title', color: '#A3E635' },
  { href: '/weather', icon: 'cloud-sun', labelKey: 'weather.title', color: '#4FC3F7' },
  { href: '/wildlife', icon: 'paw-print', labelKey: 'wildlife.title', color: '#FFB547' },
  { href: '/telemed', icon: 'heart-pulse', labelKey: 'telemed.title', color: '#FF6B6B' },
  { href: '/courses', icon: 'graduation-cap', labelKey: 'courses.title', color: '#CE93D8' },
  { href: '/groups', icon: 'message-square', labelKey: 'groups.title', color: '#6CB4FF' },
  { href: '/articles', icon: 'book-open', labelKey: 'articles.title', color: '#FFD54F' },
  { href: '/tv', icon: 'play', labelKey: 'tv.title', color: '#FF8A5B' },
  { href: '/heritage', icon: 'landmark', labelKey: 'heritage.title', color: '#D7A86E' },
  { href: '/kids', icon: 'party-popper', labelKey: 'kids.title', color: '#FF6B9D' },
  { href: '/assistant/vision', icon: 'camera', labelKey: 'vision.title', color: '#5EE39B' },
] as const;

export default function ExploreScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<AdventureType | null>(null);

  const trending = useTrendingLocations();
  const routes = usePopularRoutes();
  const recent = useFeed(type);
  const search = useExploreSearch(query);
  const me = useCurrentUser();
  const streams = useStreams();
  const hazards = useHazards(me.coords, 250);
  const instructors = useInstructors(me.coords, { sortBy: 'rating' });
  const listings = useListings({});
  const library = useLibrarySearch({ origin: me.coords });
  const businesses = useBusinesses({ origin: me.coords });
  const liveNow = streams.data?.filter((s) => s.status === 'live') ?? [];
  const searching = query.trim().length >= 2;

  const cardWidth = Math.min(240, width * 0.62);

  return (
    <Screen scroll withTabBar edges={['top']}>
      <View style={styles.header}>
        <Text variant="h1">{t('explore.title')}</Text>
        <SearchBar value={query} onChange={setQuery} />
      </View>

      {searching ? (
        <SearchResults
          loading={search.isLoading}
          data={search.data}
          onUser={(id) => router.push({ pathname: '/user/[id]', params: { id } })}
        />
      ) : (
        <>
          {/* Trend lokasyonlar */}
          <SectionHeader title={t('explore.trending')} />
          {trending.isError ? (
            <ErrorState onRetry={() => trending.refetch()} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              decelerationRate="fast"
              snapToInterval={cardWidth + spacing.md}
              snapToAlignment="start"
            >
              {trending.isLoading
                ? [0, 1, 2].map((i) => (
                    <Skeleton
                      key={i}
                      width={cardWidth}
                      height={cardWidth / 0.82}
                      style={{ borderRadius: radius.xl }}
                    />
                  ))
                : trending.data?.map((loc) => (
                    <TrendingLocationCard key={loc.id} location={loc} width={cardWidth} />
                  ))}
            </ScrollView>
          )}

          {/* Canlı yayınlar */}
          {liveNow.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title={t('live.liveNowSection')}
                actionLabel={t('common.seeAll')}
                onAction={() => router.push('/live')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hList}
              >
                {liveNow.map((s) => (
                  <StreamCard key={s.id} stream={s} width={Math.min(200, width * 0.5)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Kütüphane */}
          <View style={styles.section}>
            <SectionHeader
              title={t('library.title')}
              subtitle={t('library.subtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/library')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {library.isLoading
                ? [0, 1].map((i) => (
                    <Skeleton
                      key={i}
                      width={180}
                      height={164}
                      style={{ borderRadius: radius.lg }}
                    />
                  ))
                : library.data
                    ?.slice(0, 8)
                    .map((p) => <PlaceCard key={p.id} place={p} width={180} />)}
            </ScrollView>
          </View>

          {/* Güvenlik uyarıları */}
          <View style={styles.section}>
            <SectionHeader
              title={t('hazards.title')}
              subtitle={t('hazards.subtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/hazards')}
            />
            <View style={styles.recentList}>
              {hazards.isLoading ? (
                <Skeleton height={96} style={{ borderRadius: radius.lg }} />
              ) : hazards.data && hazards.data.length > 0 ? (
                hazards.data.slice(0, 3).map((h) => <HazardCard key={h.id} hazard={h} compact />)
              ) : (
                <EmptyState compact icon="shield-check" title={t('hazards.empty')} />
              )}
            </View>
          </View>

          {/* Türe göre keşfet */}
          <View style={styles.section}>
            <SectionHeader title={t('explore.byType')} />
            <View style={styles.typeGrid}>
              {ADVENTURE_TYPES.map((item) => {
                const meta = ADVENTURE_TYPE_META[item];
                const active = type === item;
                return (
                  <Tappable
                    key={item}
                    onPress={() => setType(active ? null : item)}
                    haptic="selection"
                    scaleTo={0.94}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: active ? meta.color : colors.surface,
                        borderColor: active ? meta.color : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: active ? 'rgba(6,18,11,0.18)' : meta.softColor },
                      ]}
                    >
                      <Icon
                        name={meta.icon}
                        size={18}
                        color={active ? '#06120B' : meta.color}
                        strokeWidth={2.4}
                      />
                    </View>
                    <Text
                      variant="caption"
                      weight="bold"
                      color={active ? '#06120B' : colors.text}
                      numberOfLines={1}
                    >
                      {t(meta.labelKey)}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </View>

          {/* İlk yardım & SOS */}
          <View style={styles.section}>
            <Tappable
              onPress={() => router.push('/first-aid')}
              scaleTo={0.985}
              style={[
                styles.sosBanner,
                { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.sosIcon, { backgroundColor: colors.danger }]}>
                <Icon name="siren" size={18} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title">{t('firstAid.title')}</Text>
                <Text variant="caption" color="textMuted">
                  {t('firstAid.subtitle')}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.danger} />
            </Tappable>
          </View>

          {/* v1.2 modülleri */}
          <View style={styles.section}>
            <SectionHeader title={t('explore.modules')} subtitle={t('explore.modulesSubtitle')} />
            <View style={styles.moduleGrid}>
              {MODULE_LINKS.map((m) => (
                <Tappable
                  key={m.href}
                  onPress={() => router.push(m.href)}
                  scaleTo={0.97}
                  style={[
                    styles.moduleTile,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t(m.labelKey)}
                >
                  <View style={[styles.moduleIcon, { backgroundColor: m.color + '22' }]}>
                    <Icon name={m.icon} size={20} color={m.color} strokeWidth={2.4} />
                  </View>
                  <Text variant="caption" weight="bold" numberOfLines={2}>
                    {t(m.labelKey)}
                  </Text>
                </Tappable>
              ))}
            </View>
          </View>

          {/* Konaklama & işletmeler */}
          <View style={styles.section}>
            <SectionHeader
              title={t('stays.title')}
              subtitle={t('stays.subtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/stays')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {businesses.isLoading
                ? [0, 1].map((i) => (
                    <Skeleton
                      key={i}
                      width={280}
                      height={240}
                      style={{ borderRadius: radius.xl }}
                    />
                  ))
                : businesses.data
                    ?.slice(0, 5)
                    .map((b) => <BusinessCard key={b.id} business={b} width={280} />)}
            </ScrollView>
          </View>

          {/* Eğitmenler */}
          <View style={styles.section}>
            <SectionHeader
              title={t('instructors.title')}
              subtitle={t('instructors.subtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/instructors')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {instructors.isLoading
                ? [0, 1].map((i) => (
                    <Skeleton
                      key={i}
                      width={260}
                      height={170}
                      style={{ borderRadius: radius.xl }}
                    />
                  ))
                : instructors.data
                    ?.slice(0, 5)
                    .map((i) => <InstructorCard key={i.id} instructor={i} width={260} />)}
            </ScrollView>
          </View>

          {/* Market */}
          <View style={styles.section}>
            <SectionHeader
              title={t('market.title')}
              subtitle={t('market.subtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/market')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {listings.isLoading
                ? [0, 1].map((i) => (
                    <Skeleton
                      key={i}
                      width={160}
                      height={230}
                      style={{ borderRadius: radius.lg }}
                    />
                  ))
                : listings.data
                    ?.slice(0, 6)
                    .map((l) => <ListingCard key={l.id} listing={l} width={160} />)}
            </ScrollView>
          </View>

          {/* Popüler rotalar */}
          <View style={styles.section}>
            <SectionHeader title={t('explore.routes')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {routes.isLoading
                ? [0, 1].map((i) => (
                    <Skeleton
                      key={i}
                      width={200}
                      height={180}
                      style={{ borderRadius: radius.lg }}
                    />
                  ))
                : routes.data?.map((route) => <RouteCard key={route.id} route={route} />)}
            </ScrollView>
          </View>

          {/* Son maceralar */}
          <View style={styles.section}>
            <SectionHeader
              title={t('explore.recent')}
              subtitle={type ? t(ADVENTURE_TYPE_META[type].labelKey) : undefined}
              actionLabel={type ? t('common.all') : undefined}
              onAction={type ? () => setType(null) : undefined}
            />
            <View style={styles.recentList}>
              {recent.isLoading ? (
                [0, 1, 2].map((i) => (
                  <Skeleton key={i} height={124} style={{ borderRadius: radius.lg }} />
                ))
              ) : recent.data?.length ? (
                recent.data
                  .slice(0, 8)
                  .map((post) => <RecentAdventureRow key={post.id} post={post} />)
              ) : (
                <EmptyState
                  compact
                  icon="tent"
                  title={t('home.emptyTitle')}
                  description={t('home.emptyDescription')}
                />
              )}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

function SearchResults({
  loading,
  data,
  onUser,
}: {
  loading: boolean;
  data: ReturnType<typeof useExploreSearch>['data'];
  onUser: (id: string) => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.recentList}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={72} style={{ borderRadius: radius.lg }} />
        ))}
      </View>
    );
  }

  const total =
    (data?.locations.length ?? 0) + (data?.users.length ?? 0) + (data?.routes.length ?? 0);
  if (!data || total === 0) {
    return (
      <EmptyState
        icon="search"
        title={t('explore.noResults')}
        description={t('explore.noResultsDescription')}
      />
    );
  }

  return (
    <View style={styles.results}>
      {data.locations.length > 0 ? (
        <View style={styles.resultGroup}>
          <Text variant="label" color="textSubtle" style={styles.groupLabel}>
            {t('explore.trending').toLocaleUpperCase('tr-TR')}
          </Text>
          {data.locations.map((loc) => (
            <TrendingLocationCard key={loc.id} location={loc} wide />
          ))}
        </View>
      ) : null}
      {data.users.length > 0 ? (
        <View style={styles.resultGroup}>
          <Text variant="label" color="textSubtle" style={styles.groupLabel}>
            {t('zmatch.subtitle').toLocaleUpperCase('tr-TR')}
          </Text>
          {data.users.map((user) => (
            <Tappable
              key={user.id}
              onPress={() => onUser(user.id)}
              haptic="selection"
              style={[
                styles.userRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="button"
            >
              <Avatar
                uri={user.avatarUrl}
                name={user.displayName}
                size={44}
                verified={user.isVerified}
              />
              <View style={{ flex: 1 }}>
                <Text variant="title">{user.displayName}</Text>
                <Text variant="caption" color="textMuted">
                  @{user.username} · {user.locationName}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textSubtle} />
            </Tappable>
          ))}
        </View>
      ) : null}
      {data.routes.length > 0 ? (
        <View style={styles.resultGroup}>
          <Text variant="label" color="textSubtle" style={styles.groupLabel}>
            {t('explore.routes').toLocaleUpperCase('tr-TR')}
          </Text>
          <View style={styles.chips}>
            {data.routes.map((route) => (
              <Chip
                key={route.id}
                label={route.name}
                icon={ADVENTURE_TYPE_META[route.adventureType].icon}
                color={ADVENTURE_TYPE_META[route.adventureType].color}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  hList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { marginTop: spacing.xxl },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  moduleTile: {
    width: '31%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sosIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  typeCard: {
    flexBasis: '30%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  results: { gap: spacing.xl, paddingHorizontal: spacing.lg },
  resultGroup: { gap: spacing.sm + 2 },
  groupLabel: { marginLeft: spacing.xs },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
