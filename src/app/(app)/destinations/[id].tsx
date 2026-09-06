import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  AdventureImage,
  Badge,
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  StatTile,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import {
  acclimatizationPlan,
  ascentRateWarning,
  countryFlag,
  DIFFICULTY_META,
  formatDistance,
  formatMonths,
  packingForDestination,
  sleepingNights,
  totalAscent,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { BudgetCard } from '@/features/destinations/components/BudgetCard';
import { GuideSection } from '@/features/destinations/components/GuideSection';
import { countryLabelKey, DESTINATION_TYPE_ICON } from '@/features/destinations/components/meta';
import { MonthBar } from '@/features/destinations/components/MonthBar';
import { PermitList } from '@/features/destinations/components/PermitList';
import { StageElevationChart } from '@/features/destinations/components/StageElevationChart';
import { StageTimeline } from '@/features/destinations/components/StageTimeline';
import { TransportList } from '@/features/destinations/components/TransportList';
import {
  useDestination,
  useDestinationStages,
  useToggleSaveDestination,
} from '@/features/destinations/hooks';

type Tab = 'guide' | 'stages' | 'transport' | 'budget' | 'safety';

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [tab, setTab] = useState<Tab>('guide');
  const [currentMonth] = useState(() => new Date().getMonth() + 1);

  const dest = useDestination(id, location.coords);
  const stages = useDestinationStages(id);
  const toggleSave = useToggleSaveDestination();

  const data = dest.data;
  const stageList = useMemo(() => stages.data ?? [], [stages.data]);
  const warnings = useMemo(() => ascentRateWarning(stageList), [stageList]);
  const warningIds = useMemo(() => new Set(warnings.map((w) => w.stageId)), [warnings]);
  const acclim = useMemo(() => acclimatizationPlan(stageList), [stageList]);
  const packing = useMemo(() => (data ? packingForDestination(data) : []), [data]);
  const countryKey = data ? countryLabelKey(data.countryCode) : null;

  const onToggleSave = () => {
    if (!data) return;
    toggleSave.mutate(data.id, {
      onSuccess: (r) =>
        toast(
          r.saved ? t('destinations.actions.saved') : t('destinations.actions.unsaved'),
          'success',
        ),
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('destinations.title')}
        subtitle={data?.region}
        showBack
        right={
          data ? (
            <IconButton
              icon="bookmark"
              variant={data.savedByMe ? 'filled' : 'outline'}
              onPress={onToggleSave}
              disabled={toggleSave.isPending}
              accessibilityLabel={
                data.savedByMe ? t('destinations.actions.saved') : t('destinations.actions.save')
              }
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {dest.isError ? (
          <ErrorState onRetry={() => dest.refetch()} />
        ) : dest.isLoading || !data ? (
          <SkeletonGroup>
            <Skeleton height={220} style={{ borderRadius: radius.xl }} />
            <Skeleton height={90} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : (
          <>
            <AdventureImage
              uri={data.imageUrl}
              adventureType={data.adventureTypes[0] ?? 'hiking'}
              style={styles.cover}
              overlay
            >
              <View style={styles.coverTop}>
                <Badge
                  label={t(`destinations.type.${data.type}`)}
                  color={colors.primary}
                  icon={DESTINATION_TYPE_ICON[data.type]}
                  soft={false}
                />
                <View style={{ flex: 1 }} />
                {data.distanceKm !== null ? (
                  <View style={styles.pill}>
                    <Icon name="navigation" size={12} color="#F2F7F4" strokeWidth={2.4} />
                    <Text variant="label" weight="extrabold" color="#F2F7F4">
                      {formatDistance(data.distanceKm, locale)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="h1" color="#FFFFFF" numberOfLines={2}>
                  {countryFlag(data.countryCode)} {data.name}
                </Text>
                <Text variant="bodySm" color="#E6EFE9" numberOfLines={1}>
                  {data.region} · {countryKey ? t(countryKey) : data.countryCode}
                </Text>
                <View style={styles.rating}>
                  <Icon name="star" size={13} color="#FFD166" strokeWidth={2.4} />
                  <Text variant="caption" weight="bold" color="#FFFFFF">
                    {data.rating.toFixed(1)}
                  </Text>
                  <Text variant="caption" color="#E6EFE9">
                    {t('destinations.stats.reviews', { count: data.reviewCount })}
                  </Text>
                </View>
              </View>
            </AdventureImage>

            <View style={styles.statRow}>
              <StatTile
                icon="mountain-snow"
                label={t('destinations.stats.maxElevation')}
                value={formatAltitude(data.maxElevationM, locale)}
                compact
                style={{ flex: 1 }}
              />
              <StatTile
                icon="calendar-days"
                label={t('destinations.stats.days')}
                value={String(data.typicalDays)}
                color={colors.info}
                compact
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.statRow}>
              <StatTile
                icon="ruler"
                label={t('destinations.stats.distance')}
                value={formatDistance(data.totalDistanceKm, locale)}
                color={colors.accent}
                compact
                style={{ flex: 1 }}
              />
              <StatTile
                icon="gauge"
                label={t('destinations.stats.difficulty')}
                value={t(DIFFICULTY_META[data.difficulty].labelKey)}
                color={DIFFICULTY_META[data.difficulty].color}
                compact
                style={{ flex: 1 }}
              />
            </View>
            <View
              style={[
                styles.monthCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text variant="label" color="textSubtle">
                {t('destinations.stats.bestMonths')}
              </Text>
              <MonthBar months={data.bestMonths} currentMonth={currentMonth} />
            </View>

            <SegmentedControl<Tab>
              segments={[
                { value: 'guide', label: t('destinations.detailTabs.guide') },
                { value: 'stages', label: t('destinations.detailTabs.stages') },
                { value: 'transport', label: t('destinations.detailTabs.transport') },
                { value: 'budget', label: t('destinations.detailTabs.budget') },
                { value: 'safety', label: t('destinations.detailTabs.safety') },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'guide' ? (
              <View style={styles.section}>
                <View style={[styles.summary, { backgroundColor: colors.primarySoft }]}>
                  <Text variant="body">{data.summary}</Text>
                </View>
                <GuideSection text={data.guide} />
                <SectionHeader
                  title={t('destinations.sources.title')}
                  subtitle={`${t('destinations.sources.updated')}: ${formatDate(data.updatedAt, locale)}`}
                />
                {data.sources.map((url) => (
                  <Tappable
                    key={url}
                    onPress={() => Linking.openURL(url).catch(() => undefined)}
                    accessibilityRole="link"
                    accessibilityLabel={url}
                    style={styles.sourceRow}
                  >
                    <Icon name="external-link" size={14} color={colors.primary} />
                    <Text variant="caption" color="primary" numberOfLines={1} style={{ flex: 1 }}>
                      {url.replace(/^https?:\/\//, '')}
                    </Text>
                  </Tappable>
                ))}
                <Text variant="caption" color="textSubtle">
                  {t('destinations.sources.license')}
                </Text>
              </View>
            ) : null}

            {tab === 'stages' ? (
              <View style={styles.section}>
                {stages.isError ? (
                  <ErrorState onRetry={() => stages.refetch()} />
                ) : stages.isLoading ? (
                  <Skeleton height={180} style={{ borderRadius: radius.lg }} />
                ) : (
                  <>
                    <StageElevationChart stages={stageList} />
                    <View style={styles.statRow}>
                      <StatTile
                        icon="trending-up"
                        label={t('destinations.stats.ascent')}
                        value={formatAltitude(totalAscent(stageList), locale)}
                        compact
                        style={{ flex: 1 }}
                      />
                      <StatTile
                        icon="moon"
                        label={t('destinations.stats.nights')}
                        value={String(sleepingNights(stageList))}
                        color={colors.info}
                        compact
                        style={{ flex: 1 }}
                      />
                      <StatTile
                        icon="milestone"
                        label={t('destinations.stats.stages')}
                        value={String(stageList.length)}
                        color={colors.accent}
                        compact
                        style={{ flex: 1 }}
                      />
                    </View>

                    <SectionHeader title={t('destinations.stages.warningsTitle')} />
                    {warnings.length === 0 ? (
                      <View
                        style={[
                          styles.note,
                          { backgroundColor: colors.successSoft, borderColor: colors.success },
                        ]}
                      >
                        <Icon name="circle-check" size={16} color={colors.success} />
                        <Text variant="bodySm" style={{ flex: 1 }}>
                          {t('destinations.stages.noWarnings')}
                        </Text>
                      </View>
                    ) : (
                      warnings.map((w) => (
                        <View
                          key={w.stageId}
                          style={[
                            styles.note,
                            { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                          ]}
                        >
                          <Icon name="triangle-alert" size={16} color={colors.warning} />
                          <Text variant="bodySm" style={{ flex: 1 }}>
                            {t('destinations.stages.ascentWarning', {
                              name: w.stageName,
                              from: w.fromElevationM,
                              to: w.toElevationM,
                              gain: w.gainM,
                            })}
                          </Text>
                        </View>
                      ))
                    )}
                    {acclim.length > 0 ? (
                      <>
                        <SectionHeader
                          title={t('destinations.stages.acclimTitle')}
                          subtitle={t('destinations.stages.extraDays', { count: acclim.length })}
                        />
                        {acclim.map((a) => (
                          <View key={a.stageId} style={styles.acclimRow}>
                            <Icon name="calendar-plus" size={15} color={colors.success} />
                            <Text variant="bodySm" style={{ flex: 1 }}>
                              {a.stageName} ({formatAltitude(a.elevationM, locale)})
                            </Text>
                            <Text variant="caption" color="textMuted">
                              {t(`destinations.stages.acclimReason.${a.reason}`)}
                            </Text>
                          </View>
                        ))}
                      </>
                    ) : null}

                    <SectionHeader title={t('destinations.stages.title')} />
                    <StageTimeline stages={stageList} warningIds={warningIds} />
                  </>
                )}
              </View>
            ) : null}

            {tab === 'transport' ? (
              <View style={styles.section}>
                <SectionHeader title={t('destinations.transport.title')} />
                <TransportList transports={data.transports} />
                <SectionHeader title={t('destinations.permits.title')} />
                <PermitList permits={data.permits} />
                <View
                  style={[
                    styles.note,
                    data.insuranceRequired
                      ? { backgroundColor: colors.dangerSoft, borderColor: colors.danger }
                      : { backgroundColor: colors.infoSoft, borderColor: colors.info },
                  ]}
                >
                  <Icon
                    name="shield-check"
                    size={16}
                    color={data.insuranceRequired ? colors.danger : colors.info}
                  />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {data.insuranceRequired
                      ? t('destinations.insurance.required')
                      : t('destinations.insurance.recommended')}
                  </Text>
                </View>
              </View>
            ) : null}

            {tab === 'budget' ? (
              <View style={styles.section}>
                <BudgetCard budget={data.budgetTry} typicalDays={data.typicalDays} />
                <SectionHeader
                  title={t('destinations.gear.title')}
                  subtitle={t('destinations.gear.standard')}
                />
                <View
                  style={[
                    styles.list,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {data.gear.map((g) => (
                    <View key={g} style={styles.listRow}>
                      <Icon name="backpack" size={14} color={colors.primary} />
                      <Text variant="bodySm" style={{ flex: 1 }}>
                        {g}
                      </Text>
                    </View>
                  ))}
                </View>
                {packing.length > 0 ? (
                  <>
                    <SectionHeader title={t('destinations.gear.extra')} />
                    <View
                      style={[
                        styles.list,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      {packing.map((p) => (
                        <View key={p.key} style={styles.listRow}>
                          <Icon name="sparkle" size={14} color={colors.accent} />
                          <Text variant="bodySm" style={{ flex: 1 }}>
                            {t(p.key)}
                          </Text>
                          <Badge
                            label={t(`destinations.gear.reason.${p.reason}`)}
                            color={colors.textSubtle}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {tab === 'safety' ? (
              <View style={styles.section}>
                <SectionHeader title={t('destinations.risks.title')} />
                <View
                  style={[
                    styles.list,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {data.risks.map((r) => (
                    <View key={r} style={styles.listRow}>
                      <Icon name="triangle-alert" size={14} color={colors.warning} />
                      <Text variant="bodySm" style={{ flex: 1 }}>
                        {r}
                      </Text>
                    </View>
                  ))}
                </View>
                <SectionHeader title={t('destinations.rescue.title')} />
                <View
                  style={[
                    styles.note,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Icon name="life-buoy" size={16} color={colors.danger} />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {data.rescueNote}
                  </Text>
                </View>
                <View
                  style={[
                    styles.note,
                    data.insuranceRequired
                      ? { backgroundColor: colors.dangerSoft, borderColor: colors.danger }
                      : { backgroundColor: colors.infoSoft, borderColor: colors.info },
                  ]}
                >
                  <Icon
                    name="shield-check"
                    size={16}
                    color={data.insuranceRequired ? colors.danger : colors.info}
                  />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {data.insuranceRequired
                      ? t('destinations.insurance.required')
                      : t('destinations.insurance.recommended')}
                  </Text>
                </View>
                <Button
                  label={t('destinations.safety.amsCheck')}
                  icon="heart-pulse"
                  variant="secondary"
                  fullWidth
                  onPress={() =>
                    router.push({
                      pathname: '/destinations/ams',
                      params: { destinationId: data.id, elevation: String(data.maxElevationM) },
                    })
                  }
                />
                <View style={styles.linkRow}>
                  <Tappable
                    onPress={() => router.push('/first-aid')}
                    accessibilityRole="button"
                    accessibilityLabel={t('destinations.safety.firstAid')}
                    style={[
                      styles.linkCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Icon name="cross" size={18} color={colors.danger} />
                    <Text variant="caption" weight="bold" numberOfLines={2} style={{ flex: 1 }}>
                      {t('destinations.safety.firstAid')}
                    </Text>
                  </Tappable>
                  <Tappable
                    onPress={() => router.push('/satellite/sos')}
                    accessibilityRole="button"
                    accessibilityLabel={t('destinations.safety.sos')}
                    style={[
                      styles.linkCard,
                      { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                    ]}
                  >
                    <Icon name="siren" size={18} color={colors.danger} />
                    <Text variant="caption" weight="bold" numberOfLines={2} style={{ flex: 1 }}>
                      {t('destinations.safety.sos')}
                    </Text>
                  </Tappable>
                </View>
              </View>
            ) : null}

            <View style={[styles.actions, { borderColor: colors.border }]}>
              <Button
                label={t('destinations.actions.createPlan')}
                icon="timer"
                fullWidth
                onPress={() =>
                  router.push({
                    pathname: '/destinations/plan-new',
                    params: { destinationId: data.id },
                  })
                }
              />
              <Button
                label={t('destinations.actions.askAi')}
                icon="sparkles"
                variant="secondary"
                fullWidth
                onPress={() =>
                  router.push({
                    pathname: '/assistant/[threadId]',
                    params: {
                      threadId: 'new',
                      initial: t('destinations.actions.aiPrompt', { name: data.name }),
                    },
                  })
                }
              />
              <Text variant="caption" color="textSubtle" align="center">
                {formatMonths(data.bestMonths, locale)} · {data.stageCount}{' '}
                {t('destinations.stats.stages').toLocaleLowerCase(
                  locale === 'tr' ? 'tr-TR' : 'en-US',
                )}
              </Text>
            </View>
          </>
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
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  cover: {
    height: 230,
    borderRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  monthCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing.md },
  summary: { padding: spacing.md, borderRadius: radius.lg },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  acclimRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
