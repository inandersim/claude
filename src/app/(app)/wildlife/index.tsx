import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { DangerLevel, SpeciesGroup } from '@/domain';
import { COUNTRY_FLAG, DANGER_LEVELS, SPECIES_GROUPS, wildlifeCountryFromCoords } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { dangerColor } from '@/features/wildlife/components/DangerBadge';
import { SpeciesCard } from '@/features/wildlife/components/SpeciesCard';
import { useOnlineHelpers, useSpecies } from '@/features/wildlife/hooks';

const FALLBACK_COUNTRY = 'TR';

/**
 * Canlı tanıma ana ekranı: acil tepki kartı, tanı/soru kısayolları, filtreler ve tür listesi.
 */
export default function WildlifeHomeScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const { coords, isFallback } = useLocation(me.coords);
  const myCountry = wildlifeCountryFromCoords(isFallback ? me.coords : coords) ?? FALLBACK_COUNTRY;

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<SpeciesGroup | null>(null);
  const [danger, setDanger] = useState<DangerLevel | null>(null);
  const [country, setCountry] = useState<string | null>(myCountry);

  const all = useSpecies({});
  const species = useSpecies({ query, group, danger, countryCode: country });
  const online = useOnlineHelpers();

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of all.data ?? [])
      for (const c of s.countryCodes) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => (a[0] === myCountry ? -1 : b[0] === myCountry ? 1 : b[1] - a[1]))
      .map(([code]) => code)
      .slice(0, 14);
  }, [all.data, myCountry]);

  const list = species.data ?? [];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('wildlife.title')} subtitle={t('wildlife.subtitle')} showBack />

      <View style={styles.content}>
        {/* Acil canlı tepkisi */}
        <Tappable
          onPress={() => router.push('/wildlife/deterrent')}
          style={[styles.panic, { backgroundColor: colors.danger }]}
          accessibilityRole="button"
          accessibilityLabel={t('wildlife.home.panicTitle')}
        >
          <View style={styles.panicIcon}>
            <Icon name="siren" size={34} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View style={styles.flex}>
            <Text variant="h3" color="#FFFFFF" weight="extrabold">
              {t('wildlife.home.panicTitle')}
            </Text>
            <Text variant="bodySm" color="rgba(255,255,255,0.9)">
              {t('wildlife.home.panicSubtitle')}
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color="#FFFFFF" />
        </Tappable>

        {/* Kısayollar */}
        <View style={styles.shortcuts}>
          <Card onPress={() => router.push('/wildlife/identify')} style={styles.flex}>
            <View style={[styles.shortcutIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="camera" size={22} color={colors.primary} />
            </View>
            <Text variant="title">{t('wildlife.home.identify')}</Text>
            <Text variant="caption" color="textMuted">
              {t('wildlife.home.identifyHint')}
            </Text>
          </Card>
          <Card onPress={() => router.push('/wildlife/questions')} style={styles.flex}>
            <View style={[styles.shortcutIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="message-circle" size={22} color={colors.accent} />
            </View>
            <Text variant="title">{t('wildlife.home.ask')}</Text>
            <Text variant="caption" color="textMuted">
              {t('wildlife.home.askHint')}
            </Text>
            <View style={styles.online}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text variant="caption" color={colors.success} weight="bold">
                {t('wildlife.onlineHelpers', { count: online.data?.count ?? 0 })}
              </Text>
            </View>
          </Card>
        </View>

        {/* Arama + filtreler */}
        <Input
          icon="search"
          placeholder={t('wildlife.search')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          accessibilityLabel={t('wildlife.search')}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('wildlife.filters.all')}
            selected={group === null}
            onPress={() => setGroup(null)}
            size="sm"
          />
          {SPECIES_GROUPS.map((g) => (
            <Chip
              key={g}
              label={t(`wildlife.group.${g}`)}
              selected={group === g}
              onPress={() => setGroup(group === g ? null : g)}
              size="sm"
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {DANGER_LEVELS.map((d) => (
            <Chip
              key={d}
              label={t(`wildlife.danger.${d}`)}
              selected={danger === d}
              color={dangerColor(d, colors)}
              onPress={() => setDanger(danger === d ? null : d)}
              size="sm"
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('wildlife.filters.everywhere')}
            icon="globe"
            selected={country === null}
            onPress={() => setCountry(null)}
            size="sm"
          />
          {countries.map((code) => (
            <Chip
              key={code}
              label={`${COUNTRY_FLAG(code)} ${code === myCountry ? t('wildlife.filters.myCountry') : code}`}
              selected={country === code}
              onPress={() => setCountry(code)}
              size="sm"
            />
          ))}
        </ScrollView>

        {/* Liste */}
        <View style={styles.listHead}>
          <Text variant="h3">{t('wildlife.home.speciesTitle')}</Text>
          <Text variant="caption" color="textMuted">
            {t('wildlife.home.speciesCount', { count: list.length })}
          </Text>
        </View>

        {species.isError ? (
          <ErrorState onRetry={() => void species.refetch()} />
        ) : species.isLoading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={92} style={styles.skeleton} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('wildlife.home.empty')}
            description={t('wildlife.home.emptyHint')}
            action={{
              label: t('wildlife.filters.everywhere'),
              icon: 'globe',
              onPress: () => {
                // Aramayı da temizle: yoksa "her yer" sonrası liste boş kalır
                setQuery('');
                setCountry(null);
                setGroup(null);
                setDanger(null);
              },
            }}
            compact
          />
        ) : (
          <View style={styles.list}>
            {list.map((s) => (
              <SpeciesCard
                key={s.id}
                species={s}
                onPress={() =>
                  router.push({ pathname: '/wildlife/species/[id]', params: { id: s.id } })
                }
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  panic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  panicIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { gap: spacing.xs, paddingRight: spacing.lg },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  list: { gap: spacing.sm },
  skeleton: { borderRadius: radius.lg },
});
