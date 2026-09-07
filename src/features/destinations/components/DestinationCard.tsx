import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import {
  countryFlag,
  DIFFICULTY_META,
  formatDistance,
  type DestinationWithDistance,
} from '@/domain';

import { countryLabelKey, DESTINATION_TYPE_ICON } from './meta';
import { MonthBar } from './MonthBar';

interface Props {
  destination: DestinationWithDistance;
  onPress: () => void;
  onToggleSave: () => void;
  saving?: boolean;
  currentMonth?: number | null;
}

/** Liste kartı: kapak görseli, bayrak, tür rozeti, gün/irtifa/mesafe, en iyi aylar, kaydet. */
export function DestinationCard({
  destination: d,
  onPress,
  onToggleSave,
  saving = false,
  currentMonth = null,
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const adventureType = d.adventureTypes[0] ?? 'hiking';
  const difficulty = DIFFICULTY_META[d.difficulty];
  const countryKey = countryLabelKey(d.countryCode);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${d.name}, ${d.region}`}
        scaleTo={0.985}
      >
        <AdventureImage uri={d.imageUrl} adventureType={adventureType} style={styles.cover} overlay kucuk>
          <View style={styles.coverTop}>
            <Badge
              label={t(`destinations.type.${d.type}`)}
              color={colors.primary}
              icon={DESTINATION_TYPE_ICON[d.type]}
              soft={false}
            />
            <View style={{ flex: 1 }} />
            {d.distanceKm !== null ? (
              <View style={styles.pill}>
                <Icon name="navigation" size={12} color="#F2F7F4" strokeWidth={2.4} />
                <Text variant="label" weight="extrabold" color="#F2F7F4">
                  {formatDistance(d.distanceKm, locale)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="h3" color="#FFFFFF" numberOfLines={2}>
              {countryFlag(d.countryCode)} {d.name}
            </Text>
            <Text variant="caption" color="#E6EFE9" numberOfLines={1}>
              {d.region} · {countryKey ? t(countryKey) : d.countryCode}
            </Text>
          </View>
        </AdventureImage>
        <View style={styles.body}>
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {d.summary}
          </Text>
          <View style={styles.stats}>
            <Stat
              icon="calendar-days"
              value={`${d.typicalDays} ${t('destinations.stats.days').toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')}`}
            />
            <Stat icon="mountain-snow" value={formatAltitude(d.maxElevationM, locale)} />
            <Stat icon="ruler" value={formatDistance(d.totalDistanceKm, locale)} />
            <View style={[styles.diff, { backgroundColor: difficulty.color }]} />
            <Text variant="caption" color="textMuted">
              {t(difficulty.labelKey)}
            </Text>
          </View>
          <MonthBar months={d.bestMonths} currentMonth={currentMonth} compact />
        </View>
      </Tappable>
      <View style={styles.footer}>
        <View style={styles.rating}>
          <Icon name="star" size={14} color={colors.accent} strokeWidth={2.4} />
          <Text variant="caption" weight="bold">
            {d.rating.toFixed(1)}
          </Text>
          <Text variant="caption" color="textSubtle">
            {t('destinations.stats.reviews', { count: d.reviewCount })}
          </Text>
        </View>
        <Tappable
          onPress={onToggleSave}
          disabled={saving}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={
            d.savedByMe ? t('destinations.actions.saved') : t('destinations.actions.save')
          }
          style={[
            styles.saveBtn,
            {
              backgroundColor: d.savedByMe ? colors.primarySoft : colors.surfaceMuted,
              borderColor: d.savedByMe ? colors.primary : colors.border,
            },
          ]}
        >
          <Icon
            name="bookmark"
            size={16}
            color={d.savedByMe ? colors.primary : colors.textMuted}
            strokeWidth={d.savedByMe ? 2.8 : 2}
          />
          <Text variant="caption" weight="bold" color={d.savedByMe ? 'primary' : 'textMuted'}>
            {d.savedByMe ? t('destinations.actions.saved') : t('destinations.actions.save')}
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

function Stat({
  icon,
  value,
}: {
  icon: 'calendar-days' | 'mountain-snow' | 'ruler';
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
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: {
    height: 170,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
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
  body: { padding: spacing.md, gap: spacing.sm },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  diff: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
