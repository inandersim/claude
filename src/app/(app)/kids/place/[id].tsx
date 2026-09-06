import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ProgressRing,
  Screen,
  Skeleton,
  StatTile,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import {
  formatDistance,
  formatPriceTry,
  kidAgeBandMeta,
  kidPlaceKindMeta,
  kidPlaceOpenInMonth,
  kidSuitabilityScore,
  mapsUrl,
  type KidAgeBand,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { AgeBandChips } from '@/features/kids/components/AgeBandChips';
import { SafetyNotes } from '@/features/kids/components/SafetyNotes';
import { TripPlanCard } from '@/features/kids/components/TripPlanCard';
import { useChildren, useKidPlace, useToggleSaveKidPlace } from '@/features/kids/hooks';

const MONTHS_TR = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export default function KidPlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const toast = useToast();
  const place = useKidPlace(id, me.coords);
  const children = useChildren();
  const toggleSave = useToggleSaveKidPlace();
  const [month] = useState(() => new Date().getMonth() + 1);
  const [ageOverride, setAgeOverride] = useState<KidAgeBand | null>(null);

  const data = place.data;
  const firstChild = children.data?.[0] ?? null;
  const ageBand: KidAgeBand = ageOverride ?? firstChild?.ageBand ?? data?.ageBands[0] ?? '4_6';
  const months = locale === 'tr' ? MONTHS_TR : MONTHS_EN;

  const onSave = () => {
    if (!data) return;
    toggleSave.mutate(data.id, {
      onSuccess: (saved) => toast(saved ? t('kids.saved') : t('kids.unsaved'), 'success'),
    });
  };

  return (
    <Screen edges={[]} scroll>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/kids'))}
          accessibilityLabel={t('common.back')}
        />
        {data ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <IconButton
              icon="map"
              variant="blur"
              onPress={() =>
                Linking.openURL(
                  mapsUrl(data.coords.latitude, data.coords.longitude, data.name),
                ).catch(() => undefined)
              }
              accessibilityLabel={t('kids.openInMaps')}
            />
            <IconButton
              icon="bookmark"
              variant="blur"
              fill={data.savedByMe ? '#FFFFFF' : undefined}
              onPress={onSave}
              accessibilityLabel={data.savedByMe ? t('kids.saved') : t('kids.save')}
            />
          </View>
        ) : null}
      </View>

      {place.isError ? (
        <View style={[styles.content, { paddingTop: insets.top + 72 }]}>
          <ErrorState onRetry={() => place.refetch()} />
        </View>
      ) : place.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={300} />
          <View style={styles.content}>
            <Skeleton height={28} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
          </View>
        </View>
      ) : !data ? (
        <View style={[styles.content, { paddingTop: insets.top + 72 }]}>
          <EmptyState icon="map-pin-off" title={t('kids.empty')} />
        </View>
      ) : (
        <>
          <AdventureImage uri={data.imageUrl} adventureType="hiking" style={styles.hero} overlay>
            <View style={[styles.heroText, { paddingBottom: spacing.lg }]}>
              <Badge
                label={t(kidPlaceKindMeta[data.kind].labelKey)}
                icon={kidPlaceKindMeta[data.kind].icon as IconName}
                color={kidPlaceKindMeta[data.kind].color}
                soft={false}
              />
              <Text variant="h1" color="#FFFFFF">
                {data.name}
              </Text>
              <View style={styles.metaRow}>
                <Icon name="map-pin" size={14} color="rgba(255,255,255,0.85)" />
                <Text variant="bodySm" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                  {data.locationName}
                  {data.distanceKm !== null
                    ? ` · ${t('kids.distanceAway', { distance: formatDistance(data.distanceKm, locale) })}`
                    : ''}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Icon name="star" size={14} color="#FFB547" fill="#FFB547" />
                <Text variant="bodySm" weight="bold" color="#FFFFFF">
                  {data.rating.toFixed(1)}
                </Text>
                <Text variant="bodySm" color="rgba(255,255,255,0.75)">
                  · {t('kids.reviews', { count: data.reviewCount })}
                </Text>
              </View>
            </View>
          </AdventureImage>

          <View style={styles.content}>
            <Text variant="body" color="textMuted">
              {data.description}
            </Text>

            {/* Yaş bantları + uygunluk */}
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.suitRow}>
                <ProgressRing
                  value={kidSuitabilityScore(data, ageBand)}
                  size={64}
                  color={kidAgeBandMeta[ageBand].color}
                >
                  <Text variant="caption" weight="extrabold">
                    {kidSuitabilityScore(data, ageBand)}
                  </Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title" weight="extrabold">
                    {firstChild && !ageOverride
                      ? t('kids.suitabilityFor', { name: firstChild.name })
                      : t('kids.suitability')}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {t(kidAgeBandMeta[ageBand].labelKey)}
                  </Text>
                </View>
              </View>
              <AgeBandChips
                value={ageBand}
                onChange={(b) => b && setAgeOverride(b)}
                allowAll={false}
                size="sm"
                wrap
              />
              <View style={styles.wrapRow}>
                {data.ageBands.map((b) => (
                  <Badge
                    key={b}
                    label={t(kidAgeBandMeta[b].labelKey)}
                    icon={kidAgeBandMeta[b].icon as IconName}
                    color={kidAgeBandMeta[b].color}
                  />
                ))}
              </View>
            </View>

            {/* Olanaklar */}
            <View style={styles.tiles}>
              <StatTile
                compact
                icon="backpack"
                label={t('kids.stroller')}
                value={data.strollerFriendly ? '✓' : '—'}
                color={data.strollerFriendly ? colors.success : colors.textSubtle}
                style={styles.tile}
              />
              <StatTile
                compact
                icon="trees"
                label={t('kids.shade')}
                value={data.shade ? '✓' : '—'}
                color={data.shade ? colors.success : colors.textSubtle}
                style={styles.tile}
              />
              <StatTile
                compact
                icon="house"
                label={t('kids.toilets')}
                value={data.toilets ? '✓' : '—'}
                color={data.toilets ? colors.success : colors.textSubtle}
                style={styles.tile}
              />
              <StatTile
                compact
                icon="droplets"
                label={t('kids.water')}
                value={data.water ? '✓' : '—'}
                color={data.water ? colors.success : colors.textSubtle}
                style={styles.tile}
              />
            </View>
            <View style={styles.wrapRow}>
              {data.facilities.map((f) => (
                <Badge key={f} label={f} color={colors.textMuted} />
              ))}
            </View>

            {/* Patika / ücret / sezon */}
            <View style={styles.tiles}>
              {data.trailKm !== null || data.trailMin !== null ? (
                <StatTile
                  icon="footprints"
                  label={t('kids.trail')}
                  value={
                    data.trailKm !== null && data.trailMin !== null
                      ? t('kids.trailInfo', { km: data.trailKm, min: data.trailMin })
                      : data.trailKm !== null
                        ? `${data.trailKm} km`
                        : formatDuration(data.trailMin ?? 0, locale)
                  }
                  style={styles.tile}
                />
              ) : null}
              {data.entryFeeTry !== null ? (
                <StatTile
                  icon="ticket"
                  label={t('kids.entryFee')}
                  value={formatPriceTry(data.entryFeeTry, locale)}
                  color={colors.accent}
                  style={styles.tile}
                />
              ) : null}
            </View>
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.metaRow}>
                <Icon name="calendar-days" size={16} color={colors.textMuted} />
                <Text variant="title" weight="extrabold">
                  {t('kids.season')}
                </Text>
                {!kidPlaceOpenInMonth(data, month) ? (
                  <Badge
                    label={t('kids.seasonClosed')}
                    color={colors.warning}
                    icon="triangle-alert"
                  />
                ) : null}
              </View>
              {data.seasonMonths.length === 0 ? (
                <Text variant="bodySm" color="textMuted">
                  {t('kids.seasonAllYear')}
                </Text>
              ) : (
                <View style={styles.wrapRow}>
                  {months.map((m, i) => {
                    const open = data.seasonMonths.includes(i + 1);
                    return (
                      <View
                        key={m}
                        style={[
                          styles.month,
                          {
                            backgroundColor: open ? colors.successSoft : colors.surfaceMuted,
                            borderColor: i + 1 === month ? colors.primary : 'transparent',
                          },
                        ]}
                      >
                        <Text variant="label" weight="bold" color={open ? 'success' : 'textSubtle'}>
                          {m}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <SafetyNotes place={data} />
            <TripPlanCard place={data} ageBand={ageBand} />

            {/* Bağlantılar */}
            {data.linkedBusinessId || data.linkedLibraryPlaceId ? (
              <View style={styles.linkRow}>
                {data.linkedBusinessId ? (
                  <Tappable
                    onPress={() =>
                      router.push({
                        pathname: '/stays/[id]',
                        params: { id: data.linkedBusinessId! },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('kids.linkedBusiness')}
                    style={[
                      styles.link,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Icon name="store" size={18} color={colors.accent} />
                    <Text variant="bodySm" weight="bold" style={{ flex: 1 }}>
                      {t('kids.linkedBusiness')}
                    </Text>
                    <Icon name="chevron-right" size={16} color={colors.textSubtle} />
                  </Tappable>
                ) : null}
                {data.linkedLibraryPlaceId ? (
                  <Tappable
                    onPress={() =>
                      router.push({
                        pathname: '/library/[id]',
                        params: { id: data.linkedLibraryPlaceId! },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('kids.linkedLibrary')}
                    style={[
                      styles.link,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Icon name="book-open" size={18} color={colors.info} />
                    <Text variant="bodySm" weight="bold" style={{ flex: 1 }}>
                      {t('kids.linkedLibrary')}
                    </Text>
                    <Icon name="chevron-right" size={16} color={colors.textSubtle} />
                  </Tappable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                label={t('kids.openInMaps')}
                icon="map"
                variant="secondary"
                fullWidth
                onPress={() =>
                  Linking.openURL(
                    mapsUrl(data.coords.latitude, data.coords.longitude, data.name),
                  ).catch(() => undefined)
                }
              />
              <Button
                label={data.savedByMe ? t('kids.saved') : t('kids.save')}
                icon="bookmark"
                fullWidth
                loading={toggleSave.isPending}
                onPress={onSave}
              />
            </View>
            <View style={{ height: insets.bottom + spacing.lg }} />
          </View>
        </>
      )}
    </Screen>
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
  hero: { width: '100%', aspectRatio: 1.1, maxHeight: 420 },
  heroText: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    gap: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  suitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  month: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  linkRow: { gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
