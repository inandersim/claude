import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  clubCities,
  seasonLabel,
  upcomingEvents,
  type AdventureType,
  type MembershipStatus,
} from '@/domain';
import { ClubCard } from '@/features/clubs/components/ClubCard';
import { EventCard } from '@/features/clubs/components/EventCard';
import { RankingRow } from '@/features/clubs/components/RankingRow';
import { StudentBadge } from '@/features/clubs/components/StudentBadge';
import {
  useClubEvents,
  useClubRanking,
  useClubs,
  useMyClubs,
  useRsvp,
  useStudentVerification,
} from '@/features/clubs/hooks';
import { SearchBar } from '@/features/explore/components/SearchBar';

type Tab = 'discover' | 'mine' | 'ranking' | 'events';

export default function ClubsScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [type, setType] = useState<AdventureType | null>(null);

  const clubs = useClubs({ query, city, adventureType: type });
  const allClubs = useClubs({});
  const mine = useMyClubs();
  const ranking = useClubRanking();
  const events = useClubEvents(null);
  const student = useStudentVerification();
  const rsvp = useRsvp();

  const cities = useMemo(() => clubCities(allClubs.data ?? []), [allClubs.data]);
  const membershipByClub = useMemo(() => {
    const map = new Map<string, MembershipStatus>();
    for (const c of mine.data ?? []) map.set(c.id, c.membership);
    return map;
  }, [mine.data]);
  const myClubIds = useMemo(
    () => new Set((mine.data ?? []).filter((c) => c.membership === 'member').map((c) => c.id)),
    [mine.data],
  );
  const upcoming = useMemo(() => upcomingEvents(events.data ?? [], now), [events.data, now]);
  const isVerifiedStudent = Boolean(student.data?.verifiedAt);

  const onRsvp = (eventId: string) =>
    rsvp.mutate(eventId, {
      onSuccess: (e) => toast(e.rsvped ? t('clubs.rsvpDone') : t('clubs.rsvpCancelled'), 'success'),
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });

  const segments: { value: Tab; label: string; badge?: number }[] = [
    { value: 'discover', label: t('clubs.tabs.discover') },
    { value: 'mine', label: t('clubs.tabs.mine'), badge: mine.data?.length || undefined },
    { value: 'ranking', label: t('clubs.tabs.ranking') },
    { value: 'events', label: t('clubs.tabs.events') },
  ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('clubs.title')}
        subtitle={t('clubs.subtitle')}
        showBack
        right={
          isVerifiedStudent ? (
            <StudentBadge verification={student.data} />
          ) : (
            <Button
              label={t('clubs.verify.bannerAction')}
              icon="graduation-cap"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/clubs/verify')}
            />
          )
        }
      />
      <View style={styles.content}>
        <SegmentedControl segments={segments} value={tab} onChange={setTab} />

        {!isVerifiedStudent && !student.isLoading ? (
          <View
            style={[styles.banner, { backgroundColor: colors.infoSoft, borderColor: colors.info }]}
          >
            <Icon name="graduation-cap" size={20} color={colors.info} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t('clubs.verify.banner')}
            </Text>
            <Button
              label={t('clubs.verify.bannerAction')}
              size="sm"
              variant="secondary"
              onPress={() => router.push('/clubs/verify')}
            />
          </View>
        ) : null}

        {tab === 'discover' ? (
          <>
            <SearchBar value={query} onChange={setQuery} placeholder={t('clubs.search')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ marginHorizontal: -spacing.lg }}
            >
              <Chip
                label={t('clubs.allCities')}
                icon="map-pin"
                size="sm"
                selected={city === null}
                onPress={() => setCity(null)}
              />
              {cities.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  size="sm"
                  selected={city === c}
                  onPress={() => setCity(city === c ? null : c)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ marginHorizontal: -spacing.lg }}
            >
              {ADVENTURE_TYPES.map((a) => (
                <Chip
                  key={a}
                  label={t(ADVENTURE_TYPE_META[a].labelKey)}
                  icon={ADVENTURE_TYPE_META[a].icon}
                  color={ADVENTURE_TYPE_META[a].color}
                  size="sm"
                  selected={type === a}
                  onPress={() => setType(type === a ? null : a)}
                />
              ))}
            </ScrollView>
            {clubs.isError ? (
              <ErrorState onRetry={() => clubs.refetch()} />
            ) : clubs.isLoading ? (
              [0, 1, 2].map((i) => (
                <Skeleton key={i} height={220} style={{ borderRadius: radius.xl }} />
              ))
            ) : clubs.data && clubs.data.length > 0 ? (
              clubs.data.map((c) => <ClubCard key={c.id} club={c} />)
            ) : (
              <EmptyState
                icon="school"
                title={t('clubs.empty')}
                description={t('clubs.emptyDescription')}
              />
            )}
          </>
        ) : null}

        {tab === 'mine' ? (
          mine.isError ? (
            <ErrorState onRetry={() => mine.refetch()} />
          ) : mine.isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} height={96} style={{ borderRadius: radius.xl }} />)
          ) : mine.data && mine.data.length > 0 ? (
            mine.data.map((c) => <ClubCard key={c.id} club={c} compact />)
          ) : (
            <EmptyState
              icon="users"
              title={t('clubs.emptyMine')}
              description={t('clubs.emptyMineDescription')}
              action={{
                label: t('clubs.discover'),
                icon: 'search',
                variant: 'secondary',
                onPress: () => setTab('discover'),
              }}
            />
          )
        ) : null}

        {tab === 'ranking' ? (
          <>
            <View style={[styles.seasonCard, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="trophy" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{t('clubs.ranking')}</Text>
                <Text variant="caption" color="textMuted">
                  {t('clubs.rankingSubtitle', { season: seasonLabel(now, locale) })}
                </Text>
              </View>
            </View>
            {ranking.isError ? (
              <ErrorState onRetry={() => ranking.refetch()} />
            ) : ranking.isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={68} style={{ borderRadius: radius.lg }} />
              ))
            ) : ranking.data && ranking.data.length > 0 ? (
              ranking.data.map((c, i) => (
                <RankingRow key={c.id} club={c} rank={i + 1} highlight={myClubIds.has(c.id)} />
              ))
            ) : (
              <EmptyState icon="trophy" title={t('clubs.empty')} />
            )}
          </>
        ) : null}

        {tab === 'events' ? (
          <>
            <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
              {t('clubs.allUpcoming')}
            </Text>
            {events.isError ? (
              <ErrorState onRetry={() => events.refetch()} />
            ) : events.isLoading ? (
              [0, 1, 2].map((i) => (
                <Skeleton key={i} height={140} style={{ borderRadius: radius.xl }} />
              ))
            ) : upcoming.length > 0 ? (
              upcoming.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  now={now}
                  membership={membershipByClub.get(e.clubId) ?? 'none'}
                  onRsvp={onRsvp}
                  rsvpPending={rsvp.isPending && rsvp.variables === e.id}
                />
              ))
            ) : (
              <EmptyState
                icon="calendar"
                title={t('clubs.emptyEvents')}
                description={t('clubs.emptyEventsDescription')}
              />
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
});
