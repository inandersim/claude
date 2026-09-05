import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  CLIMB_TYPES,
  countryFlag,
  defaultSystemFor,
  gradeColor,
  gradeFamily,
  gradesFor,
  type ClimbType,
  type GradeSystem,
  type ID,
} from '@/domain';
import { GradeSystemPicker } from '@/features/climbing/components/GradeSystemPicker';
import { useCrags, useSectors, useSubmitRoute } from '@/features/climbing/hooks';
import { CLIMB_TYPE_META } from '@/features/climbing/meta';

const PITCH_OPTIONS = [1, 2, 3, 4, 6, 8] as const;

export default function SubmitRouteScreen() {
  const params = useLocalSearchParams<{ cragId?: string; sectorId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const submit = useSubmitRoute();

  const crags = useCrags({});
  const [cragId, setCragId] = useState<ID | null>(params.cragId || null);
  const [sectorId, setSectorId] = useState<ID | null>(params.sectorId || null);
  const sectors = useSectors(cragId ?? '');

  const [name, setName] = useState('');
  const [type, setType] = useState<ClimbType>('sport');
  const [system, setSystem] = useState<GradeSystem>('french');
  const [grade, setGrade] = useState<string | null>(null);
  const [lengthM, setLengthM] = useState('');
  const [pitches, setPitches] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    grade?: string;
    crag?: string;
    sector?: string;
  }>({});

  /** Tür değişince derece sistemi ailesini eşle (boulder ↔ rota). */
  const selectType = (item: ClimbType) => {
    setType(item);
    const wanted = item === 'boulder' ? 'boulder' : 'route';
    if (gradeFamily(system) !== wanted) {
      setSystem(defaultSystemFor(item));
      setGrade(null);
    }
  };

  const grades = useMemo(() => gradesFor(system), [system]);

  const onSubmit = () => {
    const next: typeof errors = {};
    if (!cragId) next.crag = t('climbing.form.cragRequired');
    if (!sectorId) next.sector = t('climbing.form.sectorRequired');
    if (!name.trim()) next.name = t('climbing.form.nameRequired');
    if (!grade) next.grade = t('climbing.form.gradeRequired');
    setErrors(next);
    if (Object.keys(next).length || !cragId || !sectorId || !grade) return;
    const parsedLength = Number.parseInt(lengthM, 10);
    submit.mutate(
      {
        cragId,
        sectorId,
        name,
        type,
        grade,
        gradeSystem: system,
        lengthM: Number.isFinite(parsedLength) && parsedLength > 0 ? parsedLength : null,
        pitches,
        description,
      },
      {
        onSuccess: () => {
          toast(t('climbing.form.submitted'), 'success');
          goBack(router);
        },
        onError: (e) => toast(e.message || t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('climbing.form.title')}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.hint, { backgroundColor: colors.infoSoft, borderColor: colors.info }]}
          >
            <Icon name="info" size={16} color={colors.info} strokeWidth={2.4} />
            <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
              {t('climbing.form.hint')}
            </Text>
          </View>

          <Field title={t('climbing.form.crag')} error={errors.crag}>
            {crags.isLoading ? (
              <Skeleton height={36} style={{ borderRadius: radius.full }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                style={{ marginHorizontal: -spacing.lg }}
              >
                {(crags.data ?? []).map((c) => (
                  <Chip
                    key={c.id}
                    label={`${countryFlag(c.countryCode)} ${c.name}`}
                    selected={cragId === c.id}
                    onPress={() => {
                      setCragId(c.id);
                      setSectorId(null);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </Field>

          {cragId ? (
            <Field title={t('climbing.form.sector')} error={errors.sector}>
              {sectors.isLoading ? (
                <Skeleton height={36} style={{ borderRadius: radius.full }} />
              ) : (
                <View style={styles.chips}>
                  {(sectors.data ?? []).map((s) => (
                    <Chip
                      key={s.id}
                      size="sm"
                      label={s.name}
                      selected={sectorId === s.id}
                      onPress={() => setSectorId(s.id)}
                    />
                  ))}
                </View>
              )}
            </Field>
          ) : null}

          <Input
            label={t('climbing.form.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('climbing.form.namePlaceholder')}
            error={errors.name}
            maxLength={60}
          />

          <Field title={t('climbing.form.typeLabel')}>
            <View style={styles.typeGrid}>
              {CLIMB_TYPES.map((item) => {
                const meta = CLIMB_TYPE_META[item];
                const active = type === item;
                return (
                  <Tappable
                    key={item}
                    onPress={() => selectType(item)}
                    haptic="selection"
                    scaleTo={0.94}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: active ? `${meta.color}22` : colors.surface,
                        borderColor: active ? meta.color : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(meta.labelKey)}
                  >
                    <Icon
                      name={meta.icon}
                      size={20}
                      color={active ? meta.color : colors.textMuted}
                      strokeWidth={2.2}
                    />
                    <Text
                      variant="caption"
                      weight="bold"
                      color={active ? meta.color : 'text'}
                      numberOfLines={1}
                    >
                      {t(meta.labelKey)}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </Field>

          <Field title={t('climbing.form.grade')} error={errors.grade}>
            <GradeSystemPicker
              value={system}
              onChange={(s) => {
                setSystem(s);
                setGrade(null);
              }}
              family={type === 'boulder' ? 'boulder' : 'route'}
              showLabel={false}
            />
            <View style={styles.gradeGrid}>
              {grades.map((g) => {
                const active = grade === g;
                const color = gradeColor(g, system);
                return (
                  <Tappable
                    key={g}
                    onPress={() => setGrade(g)}
                    haptic="selection"
                    scaleTo={0.92}
                    style={[
                      styles.gradeCell,
                      {
                        backgroundColor: active ? color : colors.surfaceMuted,
                        borderColor: active ? color : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={g}
                  >
                    <Text variant="caption" weight="extrabold" color={active ? '#FFFFFF' : 'text'}>
                      {g}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </Field>

          {type !== 'boulder' ? (
            <>
              <Input
                label={t('climbing.form.lengthM')}
                value={lengthM}
                onChangeText={setLengthM}
                placeholder={t('climbing.form.lengthPlaceholder')}
                keyboardType="number-pad"
                icon="ruler"
              />
              <Field title={t('climbing.form.pitches')}>
                <View style={styles.chips}>
                  {PITCH_OPTIONS.map((p) => (
                    <Chip
                      key={p}
                      size="sm"
                      label={`${p}`}
                      selected={pitches === p}
                      onPress={() => setPitches(p)}
                    />
                  ))}
                </View>
              </Field>
            </>
          ) : null}

          <View>
            <Text variant="caption" color="textMuted" style={styles.label}>
              {t('climbing.form.descriptionLabel')}
            </Text>
            <View
              style={[
                styles.textarea,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('climbing.form.descriptionPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={600}
                style={[
                  styles.textareaInput,
                  { color: colors.text, fontFamily: fontFamily.medium },
                ]}
                accessibilityLabel={t('climbing.form.descriptionLabel')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <Button
          label={t('climbing.form.submit')}
          icon="send"
          size="lg"
          fullWidth
          loading={submit.isPending}
          onPress={onSubmit}
        />
      </View>
    </Screen>
  );
}

function Field({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color={error ? 'danger' : 'textMuted'} style={styles.label}>
        {error ?? title}
      </Text>
      {children}
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
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { marginLeft: spacing.xs },
  chipRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  gradeCell: {
    minWidth: 52,
    height: 34,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 110,
  },
  textareaInput: { fontSize: 15, paddingVertical: spacing.md, minHeight: 100 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
