import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Header, Icon, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatTime } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  validateReturnPlanInput,
  type AdventureType,
  type ID,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCreateReturnPlan, useDestinations } from '@/features/destinations/hooks';

type DayChoice = 'today' | 'tomorrow';
const HOURS = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
/** Süre seçenekleri (dakika) */
const DURATIONS = [120, 240, 360, 480, 720, 1440, 2880, 4320];
const GRACES = [30, 60, 120, 180];

function buildStart(base: number, day: DayChoice, hour: number): Date {
  const d = new Date(base);
  if (day === 'tomorrow') d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Bugün için hâlâ ileride olan saatler. Geçmiş bir saat seçilirse plan doğduğu anda
 * "gecikti" sayılır ve acil kişilere boş yere uyarı gider; bu yüzden hiç sunulmaz.
 */
function hoursLeftToday(base: number): number[] {
  const next = new Date(base).getHours() + 1;
  return HOURS.filter((h) => h >= next);
}

export default function NewReturnPlanScreen() {
  const { destinationId: initialDestination } = useLocalSearchParams<{ destinationId?: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const [base] = useState(() => Date.now());

  const destinations = useDestinations({});
  const create = useCreateReturnPlan();

  const preset = useMemo(
    () => (destinations.data ?? []).find((d) => d.id === initialDestination) ?? null,
    [destinations.data, initialDestination],
  );

  const todayHours = useMemo(() => hoursLeftToday(base), [base]);
  const [title, setTitle] = useState('');
  const [destinationId, setDestinationId] = useState<ID | null>(initialDestination ?? null);
  const [type, setType] = useState<AdventureType>('hiking');
  const [day, setDay] = useState<DayChoice>(todayHours.length > 0 ? 'today' : 'tomorrow');
  const [hour, setHour] = useState(() => todayHours[0] ?? HOURS[0]!);
  const [durationMin, setDurationMin] = useState(480);
  const [graceMin, setGraceMin] = useState(60);
  const [route, setRoute] = useState('');
  const [companions, setCompanions] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hourOptions = day === 'today' ? todayHours : HOURS;
  const selectDay = (next: DayChoice) => {
    setDay(next);
    const options = next === 'today' ? todayHours : HOURS;
    if (!options.includes(hour)) setHour(options[0] ?? HOURS[0]!);
  };

  const startAt = useMemo(() => buildStart(base, day, hour), [base, day, hour]);
  const returnAt = useMemo(
    () => new Date(startAt.getTime() + durationMin * 60_000),
    [startAt, durationMin],
  );
  const contactCount = me.emergencyContacts.length;
  const effectiveTitle = title.trim() || (preset ? `${preset.name}` : '');

  const durationLabel = (min: number) =>
    min >= 1440
      ? t('destinations.plan.form.days', { count: Math.round(min / 1440) })
      : t('destinations.plan.form.hours', { count: Math.round(min / 60) });

  const submit = () => {
    const input = {
      title: effectiveTitle,
      destinationId,
      adventureType: type,
      startAt: startAt.toISOString(),
      expectedReturnAt: returnAt.toISOString(),
      graceMin,
      route: route.trim(),
      companions: companions.trim(),
    };
    const errors = validateReturnPlanInput(input);
    if (errors[0]) {
      setError(t(errors[0]));
      return;
    }
    setError(null);
    create.mutate(input, {
      onSuccess: () => {
        toast(t('destinations.plan.form.saved'), 'success');
        router.replace('/destinations/plans');
      },
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('destinations.plan.new')}
        subtitle={t('destinations.plan.subtitle')}
        showBack
        onBack={() => goBack(router, '/explore')}
      />
      <View style={styles.content}>
        <Input
          label={t('destinations.plan.form.title')}
          placeholder={preset ? preset.name : t('destinations.plan.form.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          icon="pencil"
          error={error === t('destinations.plan.errors.title') ? error : null}
        />

        <Field label={t('destinations.plan.form.destination')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label={t('destinations.plan.form.noDestination')}
              selected={destinationId === null}
              onPress={() => setDestinationId(null)}
              size="sm"
            />
            {(destinations.data ?? []).map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                selected={destinationId === d.id}
                onPress={() => {
                  setDestinationId(d.id);
                  const primaryType = d.adventureTypes[0];
                  if (primaryType) setType(primaryType);
                }}
                size="sm"
              />
            ))}
          </ScrollView>
        </Field>

        <Field label={t('destinations.plan.form.type')}>
          <View style={styles.wrap}>
            {ADVENTURE_TYPES.map((a) => {
              const meta = ADVENTURE_TYPE_META[a];
              return (
                <Chip
                  key={a}
                  label={t(meta.labelKey)}
                  icon={meta.icon}
                  color={meta.color}
                  selected={type === a}
                  onPress={() => setType(a)}
                  size="sm"
                />
              );
            })}
          </View>
        </Field>

        <Field label={t('destinations.plan.form.start')}>
          <View style={styles.wrap}>
            {todayHours.length > 0 ? (
              <Chip
                label={t('destinations.plan.form.today')}
                selected={day === 'today'}
                onPress={() => selectDay('today')}
                size="sm"
              />
            ) : null}
            <Chip
              label={t('destinations.plan.form.tomorrow')}
              selected={day === 'tomorrow'}
              onPress={() => selectDay('tomorrow')}
              size="sm"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {hourOptions.map((h) => (
              <Chip
                key={h}
                label={`${String(h).padStart(2, '0')}:00`}
                selected={hour === h}
                onPress={() => setHour(h)}
                size="sm"
                color={colors.info}
              />
            ))}
          </ScrollView>
        </Field>

        <Field label={t('destinations.plan.form.duration')}>
          <View style={styles.wrap}>
            {DURATIONS.map((d) => (
              <Chip
                key={d}
                label={durationLabel(d)}
                selected={durationMin === d}
                onPress={() => setDurationMin(d)}
                size="sm"
                color={colors.accent}
              />
            ))}
          </View>
        </Field>

        <Field
          label={t('destinations.plan.form.grace')}
          hint={t('destinations.plan.form.graceHint')}
        >
          <View style={styles.wrap}>
            {GRACES.map((g) => (
              <Chip
                key={g}
                label={t('destinations.plan.graceMinutes', { count: g })}
                selected={graceMin === g}
                onPress={() => setGraceMin(g)}
                size="sm"
                color={colors.warning}
              />
            ))}
          </View>
        </Field>

        <View
          style={[
            styles.summary,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <Icon name="timer" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="title">
              {formatDate(startAt.toISOString(), locale, 'd MMM')}{' '}
              {formatTime(startAt.toISOString())} →{' '}
              {formatDate(returnAt.toISOString(), locale, 'd MMM')}{' '}
              {formatTime(returnAt.toISOString())}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('destinations.plan.form.summary', {
                return: formatTime(returnAt.toISOString()),
                grace: graceMin,
              })}
            </Text>
          </View>
        </View>
        {error && error !== t('destinations.plan.errors.title') ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}

        <Input
          label={t('destinations.plan.form.route')}
          placeholder={t('destinations.plan.form.routePlaceholder')}
          value={route}
          onChangeText={setRoute}
          icon="route"
          multiline
        />
        <Input
          label={t('destinations.plan.form.companions')}
          placeholder={t('destinations.plan.form.companionsPlaceholder')}
          value={companions}
          onChangeText={setCompanions}
          icon="users"
        />

        <View
          style={[
            styles.contacts,
            contactCount > 0
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: colors.warningSoft, borderColor: colors.warning },
          ]}
        >
          <View style={styles.contactsHead}>
            <Icon
              name="shield-check"
              size={18}
              color={contactCount > 0 ? colors.success : colors.warning}
            />
            <Text variant="title" style={{ flex: 1 }}>
              {t('destinations.plan.form.contacts')}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('destinations.plan.form.contactsCount', { count: contactCount })}
            </Text>
          </View>
          {contactCount > 0 ? (
            me.emergencyContacts.map((c) => (
              <View key={`${c.name}-${c.phone}`} style={styles.contactRow}>
                <Icon
                  name={c.userId ? 'user-check' : 'phone'}
                  size={14}
                  color={colors.textSubtle}
                />
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {c.phone}
                </Text>
              </View>
            ))
          ) : (
            <>
              <Text variant="bodySm" color="textMuted">
                {t('destinations.plan.form.noContacts')}
              </Text>
              <Button
                label={t('destinations.plan.form.addContacts')}
                icon="user-plus"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/first-aid/contacts')}
              />
            </>
          )}
        </View>

        <Button
          label={t('destinations.plan.form.save')}
          icon="check"
          size="lg"
          fullWidth
          onPress={submit}
          loading={create.isPending}
        />
      </View>
    </Screen>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textSubtle">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" color="textSubtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.huge,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  contacts: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contactsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
