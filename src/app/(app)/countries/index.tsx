import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  COUNTRY_REGIONS,
  countriesOfDestinations,
  regionLabel,
  regionOf,
  sortByRelevance,
  VISA_TYPES,
  visaLabel,
  type CountryRegion,
  type VisaType,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CountryCard } from '@/features/countries/components/CountryCard';
import { useCountries } from '@/features/countries/hooks';
import { VISA_META } from '@/features/countries/meta';
import { useSavedDestinations } from '@/features/destinations/hooks';
import { useCountry as useDetectedCountry } from '@/features/rescue/hooks';

export default function CountriesScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const detected = useDetectedCountry(location.coords);

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<CountryRegion | null>(null);
  const [visaType, setVisaType] = useState<VisaType | null>(null);

  const countries = useCountries(query);
  const saved = useSavedDestinations();

  const all = useMemo(() => countries.data ?? [], [countries.data]);
  const savedCountries = useMemo(
    () => countriesOfDestinations(all, saved.data ?? []),
    [all, saved.data],
  );
  const currentGuide = useMemo(
    () => all.find((g) => g.countryCode === detected.countryCode) ?? null,
    [all, detected.countryCode],
  );

  const filtered = useMemo(() => {
    const list = all.filter(
      (g) =>
        (region === null || regionOf(g.countryCode) === region) &&
        (visaType === null || g.visa.type === visaType),
    );
    return sortByRelevance(list, detected.countryCode, saved.data ?? []);
  }, [all, region, visaType, detected.countryCode, saved.data]);

  const showHighlights = !query.trim() && region === null && visaType === null;
  const columns = width >= 900 ? 2 : 1;
  const open = (code: string) => router.push({ pathname: '/countries/[code]', params: { code } });

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('countries.title')} subtitle={t('countries.subtitle')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Input
          icon="search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('countries.search')}
          returnKeyType="search"
          autoCapitalize="none"
          accessibilityLabel={t('countries.search')}
        />

        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              size="sm"
              icon="globe"
              label={t('countries.allRegions')}
              selected={region === null}
              onPress={() => setRegion(null)}
            />
            {COUNTRY_REGIONS.map((r) => (
              <Chip
                key={r}
                size="sm"
                label={t(regionLabel(r))}
                selected={region === r}
                onPress={() => setRegion(region === r ? null : r)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              size="sm"
              icon="stamp"
              label={t('countries.allVisas')}
              selected={visaType === null}
              onPress={() => setVisaType(null)}
            />
            {VISA_TYPES.map((type) => (
              <Chip
                key={type}
                size="sm"
                icon={VISA_META[type].icon}
                color={colors[VISA_META[type].color]}
                label={t(visaLabel({ type }, locale))}
                selected={visaType === type}
                onPress={() => setVisaType(visaType === type ? null : type)}
              />
            ))}
          </ScrollView>
        </View>

        {countries.isError ? (
          <ErrorState onRetry={() => countries.refetch()} />
        ) : countries.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : (
          <>
            {showHighlights ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t('countries.currentCountry')}
                  subtitle={t('countries.currentCountryHint')}
                />
                {currentGuide ? (
                  <CountryCard
                    guide={currentGuide}
                    onPress={() => open(currentGuide.countryCode)}
                    highlight={{
                      icon: 'locate',
                      label: t('countries.currentCountry'),
                      color: colors.info,
                    }}
                  />
                ) : (
                  <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}>
                    <Text variant="caption" color="textMuted">
                      {t('countries.currentCountryMissing')}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {showHighlights && savedCountries.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t('countries.savedDestinations')}
                  subtitle={t('countries.savedDestinationsHint')}
                />
                <View style={[styles.grid, columns > 1 && styles.gridWide]}>
                  {savedCountries.map((g) => (
                    <View key={g.countryCode} style={columns > 1 ? styles.gridItem : undefined}>
                      <CountryCard
                        guide={g}
                        compact
                        onPress={() => open(g.countryCode)}
                        highlight={{
                          icon: 'bookmark',
                          label: t('countries.savedDestinations'),
                          color: colors.accent,
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                compact
                icon="globe"
                title={t('countries.empty')}
                description={t('countries.emptyDescription')}
              />
            ) : (
              <View style={styles.section}>
                <Text variant="caption" color="textSubtle">
                  {t('countries.countLabel', { count: filtered.length })}
                </Text>
                <View style={[styles.grid, columns > 1 && styles.gridWide]}>
                  {filtered.map((g) => (
                    <View key={g.countryCode} style={columns > 1 ? styles.gridItem : undefined}>
                      <CountryCard guide={g} onPress={() => open(g.countryCode)} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  filters: { gap: spacing.sm, marginHorizontal: -layout.screenPadding },
  chipRow: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  section: { gap: spacing.sm },
  note: { padding: spacing.md, borderRadius: radius.md },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { flexBasis: '48%', flexGrow: 1 },
});
