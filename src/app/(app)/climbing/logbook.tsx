import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  StatTile,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { ascentStats, convertGrade, effectiveSystem, gradeColor, pyramidOf } from '@/domain';
import { AscentRow } from '@/features/climbing/components/AscentRow';
import { GradeBadge } from '@/features/climbing/components/GradeBadge';
import { GradeSystemPicker } from '@/features/climbing/components/GradeSystemPicker';
import { useGradeSystem, useMyAscents } from '@/features/climbing/hooks';

export default function LogbookScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const { system, setGradeSystem } = useGradeSystem();
  const ascents = useMyAscents();

  const routes = useMemo(() => (ascents.data ?? []).map((a) => a.route), [ascents.data]);
  const stats = useMemo(() => ascentStats(ascents.data ?? [], routes), [ascents.data, routes]);
  const pyramid = useMemo(
    () => pyramidOf(ascents.data ?? [], routes, system),
    [ascents.data, routes, system],
  );
  const maxCount = Math.max(1, ...pyramid.map((r) => r.count));
  // "En zor" rozeti de seçilen derece sistemine çevrilir (piramitle tutarlı olsun)
  const hardest = useMemo(() => {
    if (!stats.hardest) return null;
    const target = effectiveSystem(stats.hardest.system, system);
    const grade = convertGrade(stats.hardest.grade, stats.hardest.system, target);
    return grade
      ? { grade, system: target }
      : { grade: stats.hardest.grade, system: stats.hardest.system };
  }, [stats.hardest, system]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('climbing.logbook')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {ascents.isError ? (
          <ErrorState onRetry={() => ascents.refetch()} />
        ) : ascents.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={140} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
            <Skeleton height={72} style={{ borderRadius: radius.lg }} />
          </SkeletonGroup>
        ) : (ascents.data ?? []).length === 0 ? (
          <EmptyState
            icon="book-open"
            title={t('climbing.logbookEmpty')}
            description={t('climbing.logbookEmptyDescription')}
            action={{
              label: t('climbing.browseCrags'),
              icon: 'mountain',
              variant: 'secondary',
              onPress: () => router.push('/climbing'),
            }}
          />
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile
                icon="footprints"
                label={t('climbing.stats.total')}
                value={`${stats.total}`}
                style={styles.tile}
              />
              <StatTile
                icon="circle-check"
                label={t('climbing.stats.sends')}
                value={`${stats.sends}`}
                color={colors.success}
                style={styles.tile}
              />
              <StatTile
                icon="trending-up"
                label={t('climbing.stats.hardest')}
                value={hardest ? hardest.grade : '–'}
                color={hardest ? gradeColor(hardest.grade, hardest.system) : undefined}
                style={styles.tile}
              />
              <StatTile
                icon="mountain"
                label={t('climbing.stats.crags')}
                value={`${stats.cragCount}`}
                color={colors.info}
                style={styles.tile}
              />
            </View>

            <View style={styles.tiles}>
              <StatTile
                icon="eye"
                label={t('climbing.stats.onsight')}
                value={`${stats.byStyle.onsight}`}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="zap"
                label={t('climbing.stats.flash')}
                value={`${stats.byStyle.flash}`}
                color={colors.accent}
                compact
                style={styles.tile}
              />
              <StatTile
                icon="target"
                label={t('climbing.stats.redpoint')}
                value={`${stats.byStyle.redpoint}`}
                color={colors.danger}
                compact
                style={styles.tile}
              />
            </View>

            <GradeSystemPicker value={system} onChange={setGradeSystem} />

            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLabel={t('climbing.pyramid')}
            >
              <Text variant="title" style={{ marginBottom: spacing.sm }}>
                {t('climbing.pyramid')}
              </Text>
              {pyramid.length === 0 ? (
                <Text variant="bodySm" color="textMuted">
                  {t('climbing.pyramidEmpty')}
                </Text>
              ) : (
                <View style={{ gap: spacing.xs + 2 }}>
                  {pyramid.map((row) => (
                    <View key={`${row.system}:${row.grade}`} style={styles.pyramidRow}>
                      <GradeBadge grade={row.grade} system={row.system} size="sm" />
                      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              backgroundColor: gradeColor(row.grade, row.system),
                              width: `${Math.max(8, (row.count / maxCount) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text variant="caption" weight="bold" style={styles.count}>
                        {row.count}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <SectionHeader
              title={t('climbing.recentAscents')}
              subtitle={t('climbing.ascentsCount', { count: stats.total })}
            />
            <View style={styles.list}>
              {(ascents.data ?? []).map((a) => (
                <AscentRow
                  key={a.id}
                  ascent={a}
                  route={a.route}
                  cragName={a.crag.name}
                  preferredSystem={system}
                  onPress={() =>
                    router.push({ pathname: '/climbing/route/[id]', params: { id: a.routeId } })
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '30%', flexGrow: 1 },
  card: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pyramidRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  count: { width: 24, textAlign: 'right' },
  list: { gap: spacing.sm },
});
