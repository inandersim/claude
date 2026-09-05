import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { PLACE_KINDS, PLACE_KIND_META, type PlaceKind } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { flagFor, PlaceCard } from '@/features/library/components/PlaceCard';
import { useLibraryCountries, useLibrarySearch } from '@/features/library/hooks';

export default function LibraryScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PlaceKind | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const countries = useLibraryCountries();
  const results = useLibrarySearch({
    query,
    kind,
    countryCode: country,
    origin: nearMe ? location.coords : null,
    radiusKm: nearMe ? 500 : null,
  });

  const columns = width >= 768 ? 3 : 2;
  const gap = spacing.sm + 2;
  const cardWidth =
    (Math.min(width, layout.maxContentWidth) - spacing.lg * 2 - gap * (columns - 1)) / columns;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('library.title')} subtitle={t('library.subtitle')} showBack />
      <View style={styles.content}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('library.searchPlaceholder')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Chip
            label={t('library.nearMe')}
            icon="locate-fixed"
            selected={nearMe}
            onPress={() => setNearMe((v) => !v)}
          />
          <Chip label={t('common.all')} selected={kind === null} onPress={() => setKind(null)} />
          {PLACE_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(PLACE_KIND_META[k].labelKey)}
              icon={PLACE_KIND_META[k].icon}
              color={PLACE_KIND_META[k].color}
              selected={kind === k}
              onPress={() => setKind(kind === k ? null : k)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Chip
            size="sm"
            label={t('library.allCountries')}
            selected={country === null}
            onPress={() => setCountry(null)}
          />
          {countries.data?.map((c) => (
            <Chip
              key={c.countryCode}
              size="sm"
              label={`${flagFor(c.countryCode)} ${c.countryCode} · ${c.count}`}
              selected={country === c.countryCode}
              onPress={() => setCountry(country === c.countryCode ? null : c.countryCode)}
            />
          ))}
        </ScrollView>

        {results.isError ? (
          <ErrorState onRetry={() => results.refetch()} />
        ) : results.isLoading ? (
          <View style={[styles.grid, { gap }]}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width={cardWidth}
                height={cardWidth / 1.1}
                style={{ borderRadius: radius.lg }}
              />
            ))}
          </View>
        ) : results.data && results.data.length > 0 ? (
          <>
            <Text variant="caption" color="textSubtle">
              {results.data.length} {t('library.results')}
            </Text>
            <View style={[styles.grid, { gap }]}>
              {results.data.map((p) => (
                <PlaceCard key={p.id} place={p} width={cardWidth} />
              ))}
            </View>
          </>
        ) : (
          <EmptyState
            icon="globe"
            title={t('library.empty')}
            description={t('library.emptyDescription')}
          />
        )}

        <View
          style={[
            styles.notice,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <Icon name="info" size={14} color={colors.textSubtle} />
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('library.dataNotice')}
          </Text>
        </View>
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
  },
  chipScroll: { marginHorizontal: -spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
