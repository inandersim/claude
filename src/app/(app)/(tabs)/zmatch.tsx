import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
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
  isAcceptedPlan,
  isIncomingRequest,
  isOutgoingRequest,
  type AdventureType,
  type MatchCandidate,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { AdventureTypeFilter } from '@/features/feed/components/AdventureTypeFilter';
import { MatchCandidateCard } from '@/features/zmatch/components/MatchCandidateCard';
import { MatchRequestCard } from '@/features/zmatch/components/MatchRequestCard';
import { useMatchCandidates, useMyMatches, useRespondMatch } from '@/features/zmatch/hooks';

type Segment = 'nearby' | 'requests' | 'plans';
const RADII = [10, 25, 50, 100, 500] as const;

export default function ZMatchScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const [segment, setSegment] = useState<Segment>('nearby');
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [type, setType] = useState<AdventureType | null>(null);

  const nextRadius = RADII.find((r) => r > radiusKm);
  const candidates = useMatchCandidates(location.coords, radiusKm, type);
  const matches = useMyMatches();
  const respond = useRespondMatch();

  const incoming = useMemo(
    () => matches.data?.filter((m) => isIncomingRequest(m, me.id)) ?? [],
    [matches.data, me.id],
  );
  const outgoing = useMemo(
    () => matches.data?.filter((m) => isOutgoingRequest(m, me.id)) ?? [],
    [matches.data, me.id],
  );
  const plans = useMemo(
    () => matches.data?.filter((m) => isAcceptedPlan(m, me.id)) ?? [],
    [matches.data, me.id],
  );

  const onRequest = (candidate: MatchCandidate) => {
    router.push({ pathname: '/match/request', params: { userId: candidate.user.id } });
  };

  const onRespond = (matchId: string, accept: boolean) => {
    respond.mutate(
      { matchId, accept },
      {
        onSuccess: () =>
          toast(
            accept ? t('zmatch.acceptedToast') : t('zmatch.rejectedToast'),
            accept ? 'success' : 'info',
          ),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen scroll withTabBar edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Icon
              name="zap"
              size={18}
              color={colors.onPrimary}
              strokeWidth={2.8}
              fill={colors.onPrimary}
            />
          </View>
          <View>
            <Text variant="h1">{t('zmatch.title')}</Text>
            <Text variant="caption" color="textMuted">
              {t('zmatch.subtitle')}
            </Text>
          </View>
        </View>
        <SegmentedControl<Segment>
          value={segment}
          onChange={setSegment}
          segments={[
            { value: 'nearby', label: t('zmatch.nearby') },
            { value: 'requests', label: t('zmatch.requests'), badge: incoming.length || undefined },
            { value: 'plans', label: t('zmatch.plans'), badge: plans.length || undefined },
          ]}
        />
      </View>

      {segment === 'nearby' ? (
        <View style={styles.list}>
          {location.isFallback ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Icon name="locate-fixed" size={18} color={colors.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySm" weight="bold">
                  {t('zmatch.locationPermission')}
                </Text>
                <Text variant="caption" color="textMuted">
                  {t('zmatch.locationPermissionDescription')}
                </Text>
              </View>
              <Button
                label={t('zmatch.grantLocation')}
                size="sm"
                variant="accent"
                onPress={location.request}
                loading={location.status === 'requesting'}
              />
            </View>
          ) : null}

          <View style={styles.filters}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.radiusRow}
            >
              <Text variant="caption" color="textMuted" style={{ marginRight: 4 }}>
                {t('zmatch.radius')}
              </Text>
              {RADII.map((r) => (
                <Chip
                  key={r}
                  size="sm"
                  label={`${r} ${t('common.km')}`}
                  selected={radiusKm === r}
                  onPress={() => setRadiusKm(r)}
                />
              ))}
            </ScrollView>
            <View style={{ marginHorizontal: -spacing.lg }}>
              <AdventureTypeFilter value={type} onChange={setType} />
            </View>
          </View>

          {candidates.isError ? (
            <ErrorState onRetry={() => candidates.refetch()} />
          ) : candidates.isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} height={340} style={{ borderRadius: radius.xl }} />)
          ) : candidates.data && candidates.data.length > 0 ? (
            candidates.data.map((candidate) => (
              <MatchCandidateCard
                key={candidate.user.id}
                candidate={candidate}
                onRequest={onRequest}
              />
            ))
          ) : (
            <EmptyState
              icon="users"
              title={t('zmatch.noNearby')}
              description={t('zmatch.noNearbyDescription')}
              action={
                nextRadius
                  ? {
                      label: `${nextRadius} ${t('common.km')}`,
                      onPress: () => setRadiusKm(nextRadius),
                      icon: 'sliders',
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
          )}
        </View>
      ) : null}

      {segment === 'requests' ? (
        <View style={styles.list}>
          {matches.isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} height={200} style={{ borderRadius: radius.xl }} />)
          ) : incoming.length === 0 && outgoing.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={t('zmatch.noRequests')}
              description={t('zmatch.noRequestsDescription')}
            />
          ) : (
            <>
              {incoming.length > 0 ? (
                <Text variant="label" color="textSubtle">
                  {t('zmatch.incoming').toLocaleUpperCase('tr-TR')} · {incoming.length}
                </Text>
              ) : null}
              {incoming.map((m) => (
                <MatchRequestCard
                  key={m.id}
                  match={m}
                  meId={me.id}
                  onAccept={(id) => onRespond(id, true)}
                  onReject={(id) => onRespond(id, false)}
                  busy={respond.isPending && respond.variables?.matchId === m.id}
                />
              ))}
              {outgoing.length > 0 ? (
                <Text variant="label" color="textSubtle" style={{ marginTop: spacing.sm }}>
                  {t('zmatch.outgoing').toLocaleUpperCase('tr-TR')} · {outgoing.length}
                </Text>
              ) : null}
              {outgoing.map((m) => (
                <MatchRequestCard key={m.id} match={m} meId={me.id} />
              ))}
            </>
          )}
        </View>
      ) : null}

      {segment === 'plans' ? (
        <View style={styles.list}>
          {matches.isLoading ? (
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          ) : plans.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={t('zmatch.noPlans')}
              description={t('zmatch.noPlansDescription')}
            />
          ) : (
            plans.map((m) => <MatchRequestCard key={m.id} match={m} meId={me.id} />)
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filters: { gap: spacing.sm },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
