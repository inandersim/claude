import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Chip, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  documentsDue,
  TRIP_DATE_PRESETS,
  visaRequiresApplication,
  type CountryChecklist,
  type CountryGuide,
  type TripDatePreset,
} from '@/domain';

interface Props {
  guide: CountryGuide;
  checklist: Pick<CountryChecklist, 'done' | 'tripDate'>;
  now: Date;
  onPreset: (preset: TripDatePreset) => void;
  onClear: () => void;
  pending?: boolean;
}

const PRESET_LABEL: Record<TripDatePreset, 'preset2w' | 'preset1m' | 'preset2m' | 'preset3m'> = {
  '2w': 'preset2w',
  '1m': 'preset1m',
  '2m': 'preset2m',
  '3m': 'preset3m',
};

/** Seyahat tarihi + vize aciliyet banner'ı ve hızlı tarih chip'leri. */
export function TripCountdown({ guide, checklist, now, onPreset, onClear, pending }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const due = documentsDue(guide, checklist, now);
  const needsVisa = visaRequiresApplication(guide.visa);

  const tone =
    due.urgency === 'late'
      ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'siren' as IconName }
      : due.urgency === 'soon'
        ? { bg: colors.warningSoft, fg: colors.warning, icon: 'triangle-alert' as IconName }
        : { bg: colors.successSoft, fg: colors.success, icon: 'circle-check' as IconName };

  const urgencyLabel = !checklist.tripDate
    ? null
    : !needsVisa
      ? t('countries.urgency.noVisa')
      : due.visaDone
        ? t('countries.urgency.visaDone')
        : t(`countries.urgency.${due.urgency}`);
  const urgencyHint =
    checklist.tripDate && needsVisa && !due.visaDone
      ? t(`countries.urgency.${due.urgency}Hint`)
      : null;

  const daysLabel =
    due.daysLeft === null
      ? t('countries.trip.none')
      : due.daysLeft < 0
        ? t('countries.trip.past')
        : due.daysLeft === 0
          ? t('countries.trip.today')
          : t('countries.trip.daysLeft', { days: due.daysLeft });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Icon name="calendar" size={18} color={colors.primary} strokeWidth={2.4} />
        <Text variant="title" style={{ flex: 1 }}>
          {t('countries.trip.title')}
        </Text>
        {checklist.tripDate ? (
          <Text variant="caption" color="textMuted">
            {formatDate(checklist.tripDate, locale)}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.banner,
          { backgroundColor: checklist.tripDate ? tone.bg : colors.surfaceMuted },
        ]}
      >
        <Icon
          name={checklist.tripDate ? tone.icon : 'hourglass'}
          size={22}
          color={checklist.tripDate ? tone.fg : colors.textSubtle}
          strokeWidth={2.4}
        />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="h3" color={checklist.tripDate ? tone.fg : 'textMuted'}>
            {daysLabel}
          </Text>
          {urgencyLabel ? (
            <Text variant="body" weight="semibold">
              {urgencyLabel}
            </Text>
          ) : (
            <Text variant="caption" color="textMuted">
              {t('countries.trip.noneHint')}
            </Text>
          )}
          {urgencyHint ? (
            <Text variant="caption" color="textMuted">
              {urgencyHint}
            </Text>
          ) : null}
          {due.applyBy && !due.visaDone ? (
            <Badge
              label={t('countries.trip.applyBy', { date: formatDate(due.applyBy, locale) })}
              icon="stamp"
              color={tone.fg}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.chips}>
        {TRIP_DATE_PRESETS.map((preset) => (
          <Chip
            key={preset}
            size="sm"
            label={t(`countries.trip.${PRESET_LABEL[preset]}`)}
            onPress={pending ? undefined : () => onPreset(preset)}
          />
        ))}
        {checklist.tripDate ? (
          <Chip
            size="sm"
            icon="x"
            color={colors.danger}
            label={t('countries.trip.clear')}
            onPress={pending ? undefined : onClear}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
