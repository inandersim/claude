import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Input,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  countryCodesOf,
  countryFlag,
  DESTINATION_TYPES,
  distanceKm,
  monthShort,
  type AdventureType,
  type DestinationFilter,
  type DestinationType,
  type DestinationWithDistance,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { DestinationCard } from '@/features/destinations/components/DestinationCard';
import { countryLabelKey, DESTINATION_TYPE_ICON } from '@/features/destinations/components/meta';
import {
  useDestinations,
  useOverdueCheck,
  useSavedDestinations,
  useToggleSaveDestination,
} from '@/features/destinations/hooks';

type Tab = 'explore' | 'saved';
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function DestinationsScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;
  const [currentMonth] = useState(() => new Date().getMonth() + 1);

  useOverdueCheck();

  const [tab, setTab] = useState<Tab>('explore');
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [type, setType] = useState<DestinationType | null>(null);
  const [adventure, setAdventure] = useState<AdventureType | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  const filter: DestinationFilter = useMemo(
    () => ({
      query: query.trim() || undefined,
      countryCode: country,
      type,
      adventureType: adventure,
      month,
      origin: nearMe ? location.coords : null,
    }),
    [query, country, type, adventure, month, nearMe, location.coords],
  );

  const all = useDestinations({});
  const list = useDestinations(filter);
  const saved = useSavedDestinations();
  const toggleSave = useToggleSaveDestination();
  const [savingId, setSavingId] = useState<string | null>(null);

  const countries = useMemo(() => countryCodesOf(all.data ?? []), [all.data]);
  const hasFilter = Boolean(query || country || type || adventure || month || nearMe);

  const savedItems: DestinationWithDistance[] = useMemo(
    () =>
      (saved.data ?? []).map((d) => ({
        ...d,
        savedByMe: true,
        distanceKm: nearMe ? Math.round(distanceKm(location.coords, d.coords)) : null,
      })),
    [saved.data, nearMe, location.coords],
  );

  const onToggleSave = (id: string, wasSaved: boolean) => {
    setSavingId(id);
    toggleSave.mutate(id, {
      onSuccess: () =>
        toast(
          wasSaved ? t('destinations.actions.unsaved') : t('destinations.actions.saved'),
          'success',
        ),
      onError: (e) => toast(e.message, 'error'),
      onSettled: () => setSavingId(null),
    });
  };

  const renderCards = (items: DestinationWithDistance[]) => (
    <View style={[styles.grid, columns === 2 && styles.gridTwo]}>
      {items.map((d) => (
        <View key={d.id} style={columns === 2 ? styles.colTwo : styles.colOne}>
          <DestinationCard
            destination={d}
            currentMonth={currentMonth}
            saving={savingId === d.id && toggleSave.isPending}
            onPress={() => router.push({ pathname: '/destinations/[id]', params: { id: d.id } })}
            onToggleSave={() => onToggleSave(d.id, d.savedByMe)}
          />
        </View>
      ))}
    </View>
  );

  const skeletons = (
    <View style={{ gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={300} style={{ borderRadius: radius.xl }} />
      ))}
    </View>
  );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('destinations.title')}
        subtitle={t('destinations.subtitle')}
        showBack
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon="heart-pulse"
              variant="outline"
              onPress={() => router.push('/destinations/ams')}
              accessibilityLabel={t('destinations.ams.title')}
            />
            <IconButton
              icon="timer"
              variant="filled"
              onPress={() => router.push('/destinations/plans')}
              accessibilityLabel={t('destinations.plan.title')}
            />
          </View>
        }
      />
      <View style={styles.content}>
        <SegmentedControl<Tab>
          segments={[
            { value: 'explore', label: t('destinations.tabs.explore') },
            {
              value: 'saved',
              label: t('destinations.tabs.saved'),
              badge: saved.data?.length || undefined,
            },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'explore' ? (
          <>
            <Input
              placeholder={t('destinations.search')}
              value={query}
              onChangeText={setQuery}
              icon="search"
              returnKeyType="search"
              autoCorrect={false}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={t('destinations.nearMe')}
                icon="locate"
                selected={nearMe}
                onPress={() => setNearMe((v) => !v)}
                size="sm"
              />
              <Chip
                label={t('destinations.allCountries')}
                selected={country === null}
                onPress={() => setCountry(null)}
                size="sm"
              />
              {countries.map((cc) => {
                const key = countryLabelKey(cc);
                return (
                  <Chip
                    key={cc}
                    label={`${countryFlag(cc)} ${key ? t(key) : cc}`}
                    selected={country === cc}
                    onPress={() => setCountry(country === cc ? null : cc)}
                    size="sm"
                  />
                );
              })}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={t('destinations.allTypes')}
                selected={type === null}
                onPress={() => setType(null)}
                size="sm"
                color={colors.accent}
              />
              {DESTINATION_TYPES.map((k) => (
                <Chip
                  key={k}
                  label={t(`destinations.type.${k}`)}
                  icon={DESTINATION_TYPE_ICON[k]}
                  selected={type === k}
                  onPress={() => setType(type === k ? null : k)}
                  size="sm"
                  color={colors.accent}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {ADVENTURE_TYPES.map((a) => {
                const meta = ADVENTURE_TYPE_META[a];
                return (
                  <Chip
                    key={a}
                    label={t(meta.labelKey)}
                    icon={meta.icon}
                    color={meta.color}
                    selected={adventure === a}
                    onPress={() => setAdventure(adventure === a ? null : a)}
                    size="sm"
                  />
                );
              })}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={t('destinations.anyMonth')}
                selected={month === null}
                onPress={() => setMonth(null)}
                size="sm"
                color={colors.info}
              />
              {MONTHS.map((m) => (
                <Chip
                  key={m}
                  label={monthShort(m, locale)}
                  selected={month === m}
                  onPress={() => setMonth(month === m ? null : m)}
                  size="sm"
                  color={m === currentMonth ? colors.success : colors.info}
                />
              ))}
            </ScrollView>

            <View style={styles.resultRow}>
              <Text variant="caption" color="textSubtle">
                {list.data ? t('destinations.resultCount', { count: list.data.length }) : ' '}
              </Text>
              {hasFilter ? (
                <Chip
                  label={t('destinations.clearFilters')}
                  icon="x"
                  size="sm"
                  onPress={() => {
                    setQuery('');
                    setNearMe(false);
                    setCountry(null);
                    setType(null);
                    setAdventure(null);
                    setMonth(null);
                  }}
                />
              ) : null}
            </View>

            {list.isError ? (
              <ErrorState onRetry={() => list.refetch()} />
            ) : list.isLoading ? (
              skeletons
            ) : list.data && list.data.length > 0 ? (
              renderCards(list.data)
            ) : (
              <EmptyState
                icon="compass"
                title={t('destinations.empty')}
                description={t('destinations.emptyDescription')}
              />
            )}
          </>
        ) : saved.isError ? (
          <ErrorState onRetry={() => saved.refetch()} />
        ) : saved.isLoading ? (
          skeletons
        ) : savedItems.length > 0 ? (
          renderCards(savedItems)
        ) : (
          <EmptyState
            icon="bookmark"
            title={t('destinations.savedEmpty')}
            description={t('destinations.savedEmptyDescription')}
            action={{
              label: t('destinations.tabs.explore'),
              icon: 'compass',
              onPress: () => setTab('explore'),
            }}
          />
        )}
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
    maxWidth: layout.maxContentWidth * 1.5,
    paddingBottom: spacing.xxl,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { gap: spacing.md },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' },
  colOne: { width: '100%' },
  colTwo: { width: '48.5%' },
});
