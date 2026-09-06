import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatDuration } from '@/core/utils/time';
import {
  formatDistance,
  heritageTourSummary,
  rescueCountryFlag,
  type HeritageSite,
  type HeritageTour,
} from '@/domain';

interface Props {
  tour: HeritageTour;
  sites: HeritageSite[];
  onOpenSite: (siteId: string) => void;
  onDelete: () => void;
  deleting?: boolean;
}

/** Tur kartı: ad, tarih, alan sırası, toplam süre/mesafe, sil. */
export function TourCard({ tour, sites, onOpenSite, onDelete, deleting = false }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const summary = heritageTourSummary(tour, sites);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" numberOfLines={2}>
            {tour.title}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="calendar" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textSubtle">
              {tour.date
                ? formatDate(`${tour.date}T00:00:00.000Z`, locale)
                : t('heritage.tour.noDate')}
            </Text>
            <Text variant="caption" color="textSubtle">
              · {t('heritage.tour.days', { count: summary.estimatedDays })}
            </Text>
          </View>
        </View>
        <Tappable
          onPress={onDelete}
          disabled={deleting}
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel={t('heritage.tour.delete')}
          style={[styles.deleteBtn, { backgroundColor: colors.dangerSoft }]}
        >
          <Icon name="trash" size={16} color={colors.danger} />
        </Tappable>
      </View>

      <View style={styles.stats}>
        <Stat
          icon="landmark"
          value={t('heritage.tour.sitesCount', { count: summary.sites.length })}
        />
        <Stat icon="hourglass" value={formatDuration(summary.totalDurationMin, locale)} />
        <Stat icon="route" value={formatDistance(summary.totalDistanceKm, locale)} />
        {summary.unescoCount > 0 ? (
          <Stat
            icon="award"
            value={t('heritage.tour.unescoCount', { count: summary.unescoCount })}
          />
        ) : null}
      </View>

      <View style={styles.list}>
        {summary.sites.map((s, i) => (
          <Tappable
            key={s.id}
            onPress={() => onOpenSite(s.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t('heritage.tour.openSite')}: ${s.name}`}
            style={styles.siteRow}
          >
            <View style={[styles.num, { backgroundColor: colors.primarySoft }]}>
              <Text variant="label" weight="extrabold" color="primary">
                {i + 1}
              </Text>
            </View>
            <Text variant="bodySm" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {rescueCountryFlag(s.countryCode)} {s.name}
            </Text>
            <Text variant="caption" color="textSubtle">
              {formatDuration(s.visitDurationMin, locale)}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textSubtle} />
          </Tappable>
        ))}
      </View>

      {tour.notes ? (
        <Text variant="caption" color="textMuted">
          {tour.notes}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({
  icon,
  value,
}: {
  icon: 'landmark' | 'hourglass' | 'route' | 'award';
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={13} color={colors.textSubtle} strokeWidth={2.2} />
      <Text variant="caption" color="textMuted">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list: { gap: 2 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
