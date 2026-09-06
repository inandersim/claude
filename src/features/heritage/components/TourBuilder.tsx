import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Icon, Input, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import {
  formatDistance,
  heritageTourSummary,
  heritageVisitPlan,
  rescueCountryFlag,
  validateHeritageTourInput,
  type GeoPoint,
  type HeritageSite,
  type HeritageTour,
} from '@/domain';

interface Props {
  sites: HeritageSite[];
  /** "Yakınlık sırasına diz" için başlangıç noktası */
  origin: GeoPoint | null;
  onSubmit: (input: Omit<HeritageTour, 'id' | 'userId' | 'createdAt'>) => void;
  submitting?: boolean;
  initialSiteIds?: string[];
}

/** Tur oluşturucu: alan seçimi, sıralama, tarih, notlar ve toplam süre/mesafe. */
export function TourBuilder({
  sites,
  origin,
  onSubmit,
  submitting = false,
  initialSiteIds = [],
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(initialSiteIds);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const chosen = useMemo(
    () => selected.map((id) => byId.get(id)).filter((s): s is HeritageSite => Boolean(s)),
    [selected, byId],
  );
  const summary = useMemo(
    () => heritageTourSummary({ siteIds: selected }, sites),
    [selected, sites],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return sites
      .filter((s) => !selected.includes(s.id))
      .filter((s) => !q || `${s.name} ${s.region}`.toLocaleLowerCase('tr-TR').includes(q))
      .slice(0, 12);
  }, [sites, selected, query]);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...selected];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    setSelected(next);
  };

  const optimize = () => {
    const plan = heritageVisitPlan(chosen, origin ?? chosen[0]?.coords ?? null);
    setSelected(plan.order.map((s) => s.id));
  };

  const submit = () => {
    const input = { title: title.trim(), siteIds: selected, date: date.trim() || null };
    const err = validateHeritageTourInput(input);
    if (err) {
      setError(t(`heritage.tour.${err}`));
      return;
    }
    setError(null);
    onSubmit({ ...input, notes: notes.trim() });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="h3">{t('heritage.tour.builderTitle')}</Text>
      <Input
        label={t('heritage.tour.name')}
        placeholder={t('heritage.tour.namePlaceholder')}
        value={title}
        onChangeText={setTitle}
        icon="pencil"
      />
      <Input
        label={t('heritage.tour.date')}
        placeholder={t('heritage.tour.datePlaceholder')}
        value={date}
        onChangeText={setDate}
        icon="calendar"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      <View style={styles.sectionHead}>
        <Text variant="label" color="textSubtle">
          {t('heritage.tour.order')} · {t('heritage.tour.selected', { count: selected.length })}
        </Text>
        {selected.length >= 3 ? (
          <Chip label={t('heritage.tour.optimize')} icon="route" size="sm" onPress={optimize} />
        ) : null}
      </View>
      {chosen.length === 0 ? (
        <Text variant="bodySm" color="textSubtle">
          {t('heritage.tour.minSites')}
        </Text>
      ) : (
        <View style={styles.list}>
          {chosen.map((s, i) => (
            <View key={s.id} style={[styles.row, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.num, { backgroundColor: colors.primary }]}>
                <Text variant="label" weight="extrabold" color={colors.onPrimary}>
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold" numberOfLines={1}>
                  {rescueCountryFlag(s.countryCode)} {s.name}
                </Text>
                <Text variant="caption" color="textSubtle" numberOfLines={1}>
                  {formatDuration(s.visitDurationMin, locale)} · {s.region}
                </Text>
              </View>
              <Tappable
                onPress={() => move(i, -1)}
                disabled={i === 0}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={t('heritage.tour.moveUp')}
                style={styles.iconBtn}
              >
                <Icon name="arrow-up" size={16} color={i === 0 ? colors.border : colors.text} />
              </Tappable>
              <Tappable
                onPress={() => move(i, 1)}
                disabled={i === chosen.length - 1}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={t('heritage.tour.moveDown')}
                style={styles.iconBtn}
              >
                <Icon
                  name="chevron-down"
                  size={16}
                  color={i === chosen.length - 1 ? colors.border : colors.text}
                />
              </Tappable>
              <Tappable
                onPress={() => setSelected(selected.filter((id) => id !== s.id))}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={t('heritage.tour.remove')}
                style={styles.iconBtn}
              >
                <Icon name="x" size={16} color={colors.danger} />
              </Tappable>
            </View>
          ))}
        </View>
      )}

      <Text variant="label" color="textSubtle">
        {t('heritage.tour.selectSites')}
      </Text>
      <Input
        placeholder={t('heritage.search')}
        value={query}
        onChangeText={setQuery}
        icon="search"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {candidates.map((s) => (
          <Chip
            key={s.id}
            label={`${rescueCountryFlag(s.countryCode)} ${s.name}`}
            icon="plus"
            size="sm"
            onPress={() => setSelected([...selected, s.id])}
          />
        ))}
      </View>

      <Input
        label={t('heritage.tour.notes')}
        placeholder={t('heritage.tour.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <View style={[styles.summary, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.stat}>
          <Icon name="hourglass" size={14} color={colors.primary} />
          <Text variant="caption" color="textMuted">
            {t('heritage.tour.totalDuration')}:
          </Text>
          <Text variant="caption" weight="bold">
            {formatDuration(summary.totalDurationMin, locale)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="route" size={14} color={colors.primary} />
          <Text variant="caption" color="textMuted">
            {t('heritage.tour.totalDistance')}:
          </Text>
          <Text variant="caption" weight="bold">
            {formatDistance(summary.totalDistanceKm, locale)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="calendar-days" size={14} color={colors.primary} />
          <Text variant="caption" weight="bold">
            {t('heritage.tour.days', { count: summary.estimatedDays })}
          </Text>
        </View>
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label={t('heritage.tour.save')}
        icon="check"
        fullWidth
        loading={submitting}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summary: { padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
