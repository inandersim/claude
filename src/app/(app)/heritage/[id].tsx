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
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatDuration } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  formatDistance,
  formatMonths,
  guideDurationMin,
  HERITAGE_NEARBY_RADIUS_KM,
  HERITAGE_VISIT_XP,
  heritageCenturyLabel,
  heritageEraMeta,
  heritageKindMeta,
  heritageUnescoLabel,
  mapsUrl,
  nearbyHeritageSites,
  rescueCountryFlag,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { GuideSection } from '@/features/destinations/components/GuideSection';
import { LinkedAdventure } from '@/features/heritage/components/LinkedAdventure';
import { heritageCountryLabelKey } from '@/features/heritage/components/meta';
import { RulesList } from '@/features/heritage/components/RulesList';
import { SiteCard } from '@/features/heritage/components/SiteCard';
import { SiteMapMini } from '@/features/heritage/components/SiteMapMini';
import { VisitInfo } from '@/features/heritage/components/VisitInfo';
import {
  useAudioGuide,
  useHeritageSite,
  useHeritageSites,
  useMarkVisited,
  useToggleSaveSite,
} from '@/features/heritage/hooks';

export default function HeritageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [now] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);

  const site = useHeritageSite(id, location.coords);
  const guide = useAudioGuide(id);
  const all = useHeritageSites({});
  const toggleSave = useToggleSaveSite();
  const markVisited = useMarkVisited();

  const data = site.data;
  const nearby = useMemo(
    () => (data ? nearbyHeritageSites(data, all.data ?? [], 4) : []),
    [data, all.data],
  );
  const countryKey = data ? heritageCountryLabelKey(data.countryCode) : null;
  const unesco = data ? heritageUnescoLabel(data) : null;
  const stops = guide.data ?? [];
  const historyText =
    expanded || !data ? (data?.history ?? '') : (data.history.split('\n\n')[0] ?? '');
  const hasMore = Boolean(data && data.history.includes('\n\n'));

  const onToggleSave = () => {
    if (!data) return;
    toggleSave.mutate(data.id, {
      onSuccess: (saved) =>
        toast(saved ? t('heritage.savedToast') : t('heritage.unsavedToast'), 'success'),
      onError: (e) => toast(e.message, 'error'),
    });
  };

  const onVisited = () => {
    if (!data) return;
    markVisited.mutate(data.id, {
      onSuccess: (visited) =>
        toast(
          visited
            ? t('heritage.visitedToast', { xp: HERITAGE_VISIT_XP })
            : t('heritage.unvisitedToast'),
          visited ? 'success' : 'info',
        ),
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('heritage.title')}
        subtitle={data?.region}
        showBack
        right={
          data ? (
            <IconButton
              icon="bookmark"
              variant={data.savedByMe ? 'filled' : 'outline'}
              onPress={onToggleSave}
              disabled={toggleSave.isPending}
              accessibilityLabel={data.savedByMe ? t('heritage.saved') : t('heritage.save')}
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {site.isError ? (
          <ErrorState onRetry={() => site.refetch()} />
        ) : site.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={230} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : !data ? (
          <ErrorState onRetry={() => site.refetch()} />
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
                  label={t(heritageKindMeta[data.kind].labelKey)}
                  color={heritageKindMeta[data.kind].color}
                  icon={heritageKindMeta[data.kind].icon}
                  soft={false}
                />
                {unesco ? <Badge label={unesco} color="#F1C40F" icon="award" soft={false} /> : null}
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
                  {rescueCountryFlag(data.countryCode)} {data.name}
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
                    {t('heritage.reviews', { count: data.reviewCount })}
                  </Text>
                </View>
              </View>
            </AdventureImage>

            <View style={styles.eras}>
              {data.eras.map((era) => {
                const m = heritageEraMeta[era];
                return (
                  <View key={era} style={[styles.eraChip, { borderColor: m.color }]}>
                    <Icon name={m.icon} size={13} color={m.color} strokeWidth={2.4} />
                    <Text variant="caption" weight="bold">
                      {t(m.labelKey)}
                    </Text>
                    <Text variant="caption" color="textSubtle">
                      {heritageCenturyLabel(era, locale)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.adventures}>
              {data.adventureTypes.map((a) => {
                const m = ADVENTURE_TYPE_META[a];
                return <Badge key={a} label={t(m.labelKey)} icon={m.icon} color={m.color} />;
              })}
              {data.visitedByMe ? (
                <Badge label={t('heritage.visited')} icon="circle-check" color={colors.success} />
              ) : null}
            </View>

            <View style={[styles.summary, { backgroundColor: colors.primarySoft }]}>
              <Text variant="body">{data.summary}</Text>
            </View>

            <SectionHeader title={t('heritage.history')} />
            <GuideSection text={historyText} />
            {hasMore ? (
              <Button
                label={expanded ? t('heritage.readLess') : t('heritage.readMore')}
                icon={expanded ? 'chevron-down' : 'book-open'}
                variant="ghost"
                size="sm"
                onPress={() => setExpanded((v) => !v)}
              />
            ) : null}

            <SectionHeader
              title={t('heritage.hours')}
              subtitle={`${t('heritage.bestMonths')}: ${formatMonths(data.bestMonths, locale)}`}
            />
            <VisitInfo site={data} now={now} />

            {guide.isLoading ? (
              <Skeleton height={80} style={{ borderRadius: radius.lg }} />
            ) : stops.length > 0 ? (
              <Tappable
                onPress={() =>
                  router.push({ pathname: '/heritage/guide/[id]', params: { id: data.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={t('heritage.audioGuide')}
                style={[
                  styles.guideCard,
                  { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                ]}
              >
                <View style={[styles.guideIcon, { backgroundColor: colors.accent }]}>
                  <Icon name="mic" size={20} color={colors.onAccent} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title">{t('heritage.audioGuide')}</Text>
                  <Text variant="caption" color="textMuted">
                    {t('heritage.audioGuideSubtitle', {
                      count: stops.length,
                      duration: formatDuration(guideDurationMin(stops), locale),
                    })}
                  </Text>
                </View>
                <Icon name="play" size={20} color={colors.accent} />
              </Tappable>
            ) : null}

            <SectionHeader title={t('heritage.rules')} />
            <RulesList rules={data.rules} />

            <SectionHeader
              title={t('heritage.linked.title')}
              subtitle={t('heritage.linked.subtitle')}
            />
            <LinkedAdventure site={data} />

            <SectionHeader
              title={t('heritage.nearby')}
              subtitle={t('heritage.nearbySubtitle', { radius: HERITAGE_NEARBY_RADIUS_KM })}
            />
            <SiteMapMini
              sites={[data, ...nearby]}
              focusId={data.id}
              position={location.isFallback ? null : location.coords}
              onSitePress={(s) =>
                s.id !== data.id &&
                router.push({ pathname: '/heritage/[id]', params: { id: s.id } })
              }
              onExpand={() =>
                Linking.openURL(
                  mapsUrl(data.coords.latitude, data.coords.longitude, data.name),
                ).catch(() => undefined)
              }
            />
            {nearby.length === 0 ? (
              <Text variant="caption" color="textSubtle">
                {t('heritage.nearbyEmpty')}
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {nearby.map((s) => (
                  <SiteCard
                    key={s.id}
                    site={{ ...s, savedByMe: false, visitedByMe: false }}
                    compact
                    onPress={() =>
                      router.push({ pathname: '/heritage/[id]', params: { id: s.id } })
                    }
                  />
                ))}
              </View>
            )}

            <SectionHeader
              title={t('heritage.sources')}
              subtitle={`${t('heritage.updated')}: ${formatDate(data.updatedAt, locale)}`}
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

            <View style={[styles.actions, { borderColor: colors.border }]}>
              <Button
                label={data.visitedByMe ? t('heritage.unmarkVisited') : t('heritage.markVisited')}
                icon={data.visitedByMe ? 'circle-x' : 'circle-check'}
                variant={data.visitedByMe ? 'secondary' : 'primary'}
                fullWidth
                loading={markVisited.isPending}
                onPress={onVisited}
              />
              <Button
                label={t('heritage.openMap')}
                icon="map-pin"
                variant="secondary"
                fullWidth
                onPress={() =>
                  Linking.openURL(
                    mapsUrl(data.coords.latitude, data.coords.longitude, data.name),
                  ).catch(() => undefined)
                }
              />
              <Button
                label={t('heritage.planTour')}
                icon="route"
                variant="ghost"
                fullWidth
                onPress={() =>
                  router.push({ pathname: '/heritage/tours', params: { siteId: data.id } })
                }
              />
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
    height: 240,
    borderRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
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
  eras: { gap: spacing.xs },
  eraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  adventures: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summary: { padding: spacing.md, borderRadius: radius.lg },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  actions: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
