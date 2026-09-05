import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { HAZARD_SEVERITIES, HAZARD_SEVERITY_META, type HazardSeverity } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { HazardCard } from '@/features/hazards/components/HazardCard';
import { HazardRadar } from '@/features/hazards/components/HazardRadar';
import { useHazards } from '@/features/hazards/hooks';

type View_ = 'radar' | 'list';
const RANGES = [25, 50, 100, 250, 1000] as const;

export default function HazardsScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [view, setView] = useState<View_>('radar');
  const [rangeKm, setRangeKm] = useState<number>(100);
  const [severity, setSeverity] = useState<HazardSeverity | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const hazards = useHazards(location.coords, showResolved ? undefined : rangeKm, showResolved);
  const filtered = useMemo(
    () => (hazards.data ?? []).filter((h) => !severity || h.severity === severity),
    [hazards.data, severity],
  );
  const critical = filtered.filter(
    (h) => h.severity === 'critical' && h.status === 'active',
  ).length;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('hazards.title')}
        subtitle={t('hazards.subtitle')}
        showBack
        right={
          <Button
            label={t('hazards.report')}
            icon="siren"
            size="sm"
            variant="danger"
            onPress={() => router.push('/hazards/report')}
          />
        }
      />

      <View style={styles.content}>
        <SegmentedControl<View_>
          value={view}
          onChange={setView}
          segments={[
            { value: 'radar', label: t('hazards.radar') },
            { value: 'list', label: t('hazards.list'), badge: filtered.length || undefined },
          ]}
        />

        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Text variant="caption" color="textMuted" style={{ marginRight: 4 }}>
              {t('zmatch.radius')}
            </Text>
            {RANGES.map((r) => (
              <Chip
                key={r}
                size="sm"
                label={`${r} km`}
                selected={rangeKm === r}
                onPress={() => setRangeKm(r)}
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
              label={t('hazards.all')}
              selected={severity === null}
              onPress={() => setSeverity(null)}
            />
            {HAZARD_SEVERITIES.map((s) => (
              <Chip
                key={s}
                size="sm"
                label={t(HAZARD_SEVERITY_META[s].labelKey)}
                color={HAZARD_SEVERITY_META[s].color}
                selected={severity === s}
                onPress={() => setSeverity(severity === s ? null : s)}
              />
            ))}
            <Chip
              size="sm"
              label={t('hazards.resolved')}
              icon="check"
              selected={showResolved}
              onPress={() => setShowResolved((v) => !v)}
            />
          </ScrollView>
        </View>

        {critical > 0 ? (
          <View
            style={[
              styles.critical,
              { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
            ]}
          >
            <Icon name="siren" size={16} color={colors.danger} strokeWidth={2.4} />
            <Text variant="bodySm" weight="bold" color="danger">
              {t('hazards.severityCount', { count: critical })}
            </Text>
          </View>
        ) : null}

        {hazards.isError ? (
          <ErrorState onRetry={() => hazards.refetch()} />
        ) : hazards.isLoading ? (
          <Skeleton height={300} style={{ borderRadius: radius.xl }} />
        ) : (
          <>
            {view === 'radar' ? (
              <HazardRadar origin={location.coords} hazards={filtered} rangeKm={rangeKm} />
            ) : null}
            {filtered.length === 0 ? (
              <EmptyState
                compact
                icon="shield-check"
                title={t('hazards.empty')}
                description={t('hazards.emptyDescription')}
                action={{
                  label: t('hazards.report'),
                  icon: 'siren',
                  variant: 'secondary',
                  onPress: () => router.push('/hazards/report'),
                }}
              />
            ) : (
              <View style={styles.list}>
                {filtered.map((h) => (
                  <HazardCard key={h.id} hazard={h} compact={view === 'radar'} />
                ))}
              </View>
            )}
          </>
        )}

        <View
          style={[styles.tips, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.tipsHead}>
            <Icon name="life-buoy" size={16} color={colors.primary} strokeWidth={2.4} />
            <Text variant="title">{t('hazards.safetyTips')}</Text>
          </View>
          {[t('hazards.tip1'), t('hazards.tip2', { meters: 500 }), t('hazards.tip3')].map(
            (tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipDot, { backgroundColor: colors.primary }]} />
                <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                  {tip}
                </Text>
              </View>
            ),
          )}
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
  filters: { gap: spacing.sm, marginHorizontal: -spacing.lg },
  chipRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  critical: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { gap: spacing.sm + 2 },
  tips: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
});
