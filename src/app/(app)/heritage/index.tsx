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
  HERITAGE_KINDS,
  heritageCountries,
  heritageKindMeta,
  rescueCountryFlag,
  splitHeritageByMe,
  type HeritageEra,
  type HeritageFilter,
  type HeritageKind,
  type HeritageSiteWithDistance,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { EraChips } from '@/features/heritage/components/EraChips';
import { heritageCountryLabelKey } from '@/features/heritage/components/meta';
import { SiteCard } from '@/features/heritage/components/SiteCard';
import { useHeritageSites, useToggleSaveSite } from '@/features/heritage/hooks';

type Tab = 'explore' | 'saved' | 'visited';

export default function HeritageScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;

  const [tab, setTab] = useState<Tab>('explore');
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(false);
  const [unescoOnly, setUnescoOnly] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [era, setEra] = useState<HeritageEra | null>(null);
  const [kind, setKind] = useState<HeritageKind | null>(null);

  const filter: HeritageFilter = useMemo(
    () => ({
      query: query.trim() || undefined,
      countryCode: country,
      era,
      kind,
      unescoOnly,
      origin: nearMe ? location.coords : null,
    }),
    [query, country, era, kind, unescoOnly, nearMe, location.coords],
  );

  const all = useHeritageSites({});
  const list = useHeritageSites(filter);
  const toggleSave = useToggleSaveSite();
  const [savingId, setSavingId] = useState<string | null>(null);

  const countries = useMemo(() => heritageCountries(all.data ?? []), [all.data]);
  const usedEras = useMemo(() => {
    const set = new Set<HeritageEra>();
    for (const s of all.data ?? []) for (const e of s.eras) set.add(e);
    return [...set];
  }, [all.data]);
  const mine = useMemo(() => splitHeritageByMe(all.data ?? []), [all.data]);
  const hasFilter = Boolean(query || country || era || kind || unescoOnly || nearMe);

  const onToggleSave = (id: string, wasSaved: boolean) => {
    setSavingId(id);
    toggleSave.mutate(id, {
      onSuccess: () =>
        toast(wasSaved ? t('heritage.unsavedToast') : t('heritage.savedToast'), 'success'),
      onError: (e) => toast(e.message, 'error'),
      onSettled: () => setSavingId(null),
    });
  };

  const renderCards = (items: HeritageSiteWithDistance[]) => (
    <View style={[styles.grid, columns === 2 && styles.gridTwo]}>
      {items.map((s) => (
        <View key={s.id} style={columns === 2 ? styles.colTwo : styles.colOne}>
          <SiteCard
            site={s}
            saving={savingId === s.id && toggleSave.isPending}
            onPress={() => router.push({ pathname: '/heritage/[id]', params: { id: s.id } })}
            onToggleSave={() => onToggleSave(s.id, s.savedByMe)}
          />
        </View>
      ))}
    </View>
  );

  const skeletons = (
    <View style={{ gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={290} style={{ borderRadius: radius.xl }} />
      ))}
    </View>
  );

  const renderMine = (items: HeritageSiteWithDistance[], kindOf: 'saved' | 'visited') =>
    all.isError ? (
      <ErrorState onRetry={() => all.refetch()} />
    ) : all.isLoading ? (
      skeletons
    ) : items.length > 0 ? (
      renderCards(items)
    ) : (
      <EmptyState
        icon={kindOf === 'saved' ? 'bookmark' : 'circle-check'}
        title={kindOf === 'saved' ? t('heritage.savedEmpty') : t('heritage.visitedEmpty')}
        description={
          kindOf === 'saved'
            ? t('heritage.savedEmptyDescription')
            : t('heritage.visitedEmptyDescription')
        }
        action={{
          label: t('heritage.tabs.explore'),
          icon: 'compass',
          onPress: () => setTab('explore'),
        }}
      />
    );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('heritage.title')}
        subtitle={t('heritage.subtitle')}
        showBack
        right={
          <IconButton
            icon="route"
            variant="filled"
            onPress={() => router.push('/heritage/tours')}
            accessibilityLabel={t('heritage.planTour')}
          />
        }
      />
      <View style={styles.content}>
        <SegmentedControl<Tab>
          segments={[
            { value: 'explore', label: t('heritage.tabs.explore') },
            {
              value: 'saved',
              label: t('heritage.tabs.saved'),
              badge: mine.saved.length || undefined,
            },
            {
              value: 'visited',
              label: t('heritage.tabs.visited'),
              badge: mine.visited.length || undefined,
            },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'explore' ? (
          <>
            <Input
              placeholder={t('heritage.search')}
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
                label={t('heritage.nearMe')}
                icon="locate"
                selected={nearMe}
                onPress={() => setNearMe((v) => !v)}
                size="sm"
              />
              <Chip
                label={t('heritage.unescoOnly')}
                icon="award"
                selected={unescoOnly}
                onPress={() => setUnescoOnly((v) => !v)}
                size="sm"
                color="#D4A017"
              />
              <Chip
                label={t('heritage.allCountries')}
                selected={country === null}
                onPress={() => setCountry(null)}
                size="sm"
              />
              {countries.map((cc) => {
                const key = heritageCountryLabelKey(cc);
                return (
                  <Chip
                    key={cc}
                    label={`${rescueCountryFlag(cc)} ${key ? t(key) : cc}`}
                    selected={country === cc}
                    onPress={() => setCountry(country === cc ? null : cc)}
                    size="sm"
                  />
                );
              })}
            </ScrollView>
            <EraChips value={era} onChange={setEra} eras={usedEras} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={t('heritage.allKinds')}
                selected={kind === null}
                onPress={() => setKind(null)}
                size="sm"
                color={colors.accent}
              />
              {HERITAGE_KINDS.map((k) => {
                const m = heritageKindMeta[k];
                return (
                  <Chip
                    key={k}
                    label={t(m.labelKey)}
                    icon={m.icon}
                    selected={kind === k}
                    onPress={() => setKind(kind === k ? null : k)}
                    size="sm"
                    color={colors.accent}
                  />
                );
              })}
            </ScrollView>

            <View style={styles.resultRow}>
              <Text variant="caption" color="textSubtle">
                {list.data ? t('heritage.resultCount', { count: list.data.length }) : ' '}
              </Text>
              {hasFilter ? (
                <Chip
                  label={t('heritage.clearFilters')}
                  icon="x"
                  size="sm"
                  onPress={() => {
                    setQuery('');
                    setNearMe(false);
                    setUnescoOnly(false);
                    setCountry(null);
                    setEra(null);
                    setKind(null);
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
                icon="landmark"
                title={t('heritage.empty')}
                description={t('heritage.emptyDescription')}
              />
            )}
          </>
        ) : tab === 'saved' ? (
          renderMine(mine.saved, 'saved')
        ) : (
          renderMine(mine.visited, 'visited')
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
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { gap: spacing.md },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' },
  colOne: { width: '100%' },
  colTwo: { width: '48.5%' },
});
