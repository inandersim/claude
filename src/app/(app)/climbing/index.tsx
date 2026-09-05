import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Input,
  Screen,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { CLIMB_TYPES, countryFlag, type ClimbType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CragCard } from '@/features/climbing/components/CragCard';
import { useCrags } from '@/features/climbing/hooks';
import { CLIMB_TYPE_META } from '@/features/climbing/meta';

const COUNTRIES = ['TR', 'GR', 'FR', 'US'] as const;

export default function ClimbingScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [now] = useState(() => new Date());

  const [query, setQuery] = useState('');
  const [climbType, setClimbType] = useState<ClimbType | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [nearby, setNearby] = useState(false);

  const filter = useMemo(
    () => ({
      query: query.trim() || undefined,
      climbType,
      countryCode: country,
      verifiedOnly,
      origin: nearby ? location.coords : null,
    }),
    [query, climbType, country, verifiedOnly, nearby, location.coords],
  );
  const crags = useCrags(filter);
  const columns = width >= 900 ? 2 : 1;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('climbing.title')}
        subtitle={t('climbing.subtitle')}
        showBack
        right={
          <IconButton
            icon="book-open"
            variant="filled"
            onPress={() => router.push('/climbing/logbook')}
            accessibilityLabel={t('climbing.logbook')}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Input
          icon="search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('climbing.search')}
          returnKeyType="search"
          accessibilityLabel={t('climbing.search')}
        />

        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              size="sm"
              icon="locate"
              label={t('climbing.nearby')}
              selected={nearby}
              onPress={() => {
                setNearby((v) => !v);
                if (!nearby && location.status === 'idle')
                  location.request().catch(() => undefined);
              }}
            />
            <Chip
              size="sm"
              icon="badge-check"
              label={t('climbing.verifiedOnly')}
              selected={verifiedOnly}
              onPress={() => setVerifiedOnly((v) => !v)}
            />
            <Chip
              size="sm"
              label={t('climbing.allCountries')}
              selected={country === null}
              onPress={() => setCountry(null)}
            />
            {COUNTRIES.map((cc) => (
              <Chip
                key={cc}
                size="sm"
                label={`${countryFlag(cc)} ${cc}`}
                selected={country === cc}
                onPress={() => setCountry(country === cc ? null : cc)}
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
              label={t('climbing.allTypes')}
              selected={climbType === null}
              onPress={() => setClimbType(null)}
            />
            {CLIMB_TYPES.map((type) => (
              <Chip
                key={type}
                size="sm"
                icon={CLIMB_TYPE_META[type].icon}
                color={CLIMB_TYPE_META[type].color}
                label={t(CLIMB_TYPE_META[type].labelKey)}
                selected={climbType === type}
                onPress={() => setClimbType(climbType === type ? null : type)}
              />
            ))}
          </ScrollView>
        </View>

        {crags.isError ? (
          <ErrorState onRetry={() => crags.refetch()} />
        ) : crags.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={240} style={{ borderRadius: radius.xl }} />
            <Skeleton height={240} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : (crags.data ?? []).length === 0 ? (
          <EmptyState
            compact
            icon="mountain"
            title={t('climbing.empty')}
            description={t('climbing.emptyDescription')}
            action={{
              label: t('climbing.submitRoute'),
              icon: 'plus',
              variant: 'secondary',
              onPress: () => router.push('/climbing/submit'),
            }}
          />
        ) : (
          <>
            <Text variant="caption" color="textSubtle">
              {t('climbing.cragsCount', { count: crags.data?.length ?? 0 })} ·{' '}
              {t('climbing.routesCount', {
                count: (crags.data ?? []).reduce((sum, c) => sum + c.routeCount, 0),
              })}
            </Text>
            <View style={[styles.grid, columns > 1 && styles.gridWide]}>
              {(crags.data ?? []).map((crag) => (
                <View key={crag.id} style={columns > 1 ? styles.gridItem : undefined}>
                  <CragCard crag={crag} now={now} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Button
          label={t('climbing.submitRoute')}
          icon="plus"
          fullWidth
          size="lg"
          onPress={() => router.push('/climbing/submit')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth * 1.6,
  },
  filters: { gap: spacing.sm, marginHorizontal: -spacing.lg },
  chipRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { flexBasis: '48%', flexGrow: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
