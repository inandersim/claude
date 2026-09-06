import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  canAcceptPaidBookings,
  CATEGORY_META,
  COURSE_CATEGORIES,
  COURSE_FORMATS,
  COURSE_LEVELS,
  FORMAT_ICON,
  LESSON_TYPE_ICON,
  LESSON_TYPES,
  type AdventureType,
  type CourseCategory,
  type CourseFormat,
  type CourseLevel,
  type LessonType,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCreateCourse, type CreateLessonInput } from '@/features/courses/hooks';
import { useInstructorByUser } from '@/features/instructors/hooks';

interface LessonDraft {
  key: number;
  moduleTitle: string;
  title: string;
  type: LessonType;
  durationMin: string;
}

const emptyLesson = (key: number, moduleTitle = ''): LessonDraft => ({
  key,
  moduleTitle,
  title: '',
  type: 'video',
  durationMin: '10',
});

export default function CreateCourseScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const instructor = useInstructorByUser(me.id);
  const create = useCreateCourse();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CourseCategory>('mountaineering');
  const [level, setLevel] = useState<CourseLevel>('beginner');
  const [format, setFormat] = useState<CourseFormat>('online');
  const [price, setPrice] = useState('0');
  const [duration, setDuration] = useState('8');
  const [provider, setProvider] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [validity, setValidity] = useState('');
  const [adventureTypes, setAdventureTypes] = useState<AdventureType[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>(['']);
  const [lessons, setLessons] = useState<LessonDraft[]>([emptyLesson(1, 'Modül 1')]);
  const [submitted, setSubmitted] = useState(false);

  const canCreate = canAcceptPaidBookings(me.plan);
  const priceNum = Number.parseInt(price, 10);
  const durationNum = Number.parseFloat(duration);
  const cleanOutcomes = outcomes.map((o) => o.trim()).filter(Boolean);

  const errors = {
    title: submitted && title.trim().length < 5 ? t('courses.create.errors.title') : null,
    summary: submitted && !summary.trim() ? t('courses.create.errors.summary') : null,
    price:
      submitted && (Number.isNaN(priceNum) || priceNum < 0)
        ? t('courses.create.errors.price')
        : null,
    duration:
      submitted && (Number.isNaN(durationNum) || durationNum <= 0)
        ? t('courses.create.errors.duration')
        : null,
    outcomes: submitted && cleanOutcomes.length === 0 ? t('courses.create.errors.outcomes') : null,
    adventureTypes:
      submitted && adventureTypes.length === 0 ? t('courses.create.errors.adventureTypes') : null,
  };
  const hasError = Object.values(errors).some(Boolean);

  const toggleType = (a: AdventureType) =>
    setAdventureTypes((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const updateLesson = (key: number, patch: Partial<LessonDraft>) =>
    setLessons((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = () => {
    setSubmitted(true);
    if (
      title.trim().length < 5 ||
      !summary.trim() ||
      Number.isNaN(priceNum) ||
      priceNum < 0 ||
      Number.isNaN(durationNum) ||
      durationNum <= 0 ||
      cleanOutcomes.length === 0 ||
      adventureTypes.length === 0
    ) {
      return;
    }
    const validityNum = Number.parseInt(validity, 10);
    const lessonInputs: CreateLessonInput[] = lessons
      .filter((l) => l.title.trim())
      .map((l, i) => ({
        moduleTitle: l.moduleTitle.trim() || 'Modül 1',
        order: i + 1,
        title: l.title.trim(),
        type: l.type,
        durationMin: Math.max(1, Number.parseInt(l.durationMin, 10) || 10),
        videoUrl: null,
        body: '',
        quiz: null,
        preview: i < 1,
      }));
    create.mutate(
      {
        input: {
          title: title.trim(),
          summary: summary.trim(),
          description: description.trim() || summary.trim(),
          category,
          level,
          format,
          imageUrl: null,
          instructorId: instructor.data?.id ?? null,
          provider: provider.trim() || me.displayName,
          certificateName: certificateName.trim() || null,
          validityMonths: Number.isNaN(validityNum) || validityNum <= 0 ? null : validityNum,
          priceTry: priceNum,
          durationHours: durationNum,
          languages: ['Türkçe'],
          prerequisites: [],
          outcomes: cleanOutcomes,
          adventureTypes,
        },
        lessons: lessonInputs,
      },
      {
        onSuccess: (c) => {
          toast(t('courses.create.success'), 'success');
          router.replace({ pathname: '/courses/[id]', params: { id: c.id } });
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/courses'));

  if (!canCreate) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={t('courses.create.title')} showBack onBack={back} />
        <EmptyState
          icon="crown"
          title={t('courses.needsProGuide')}
          action={{
            label: t('courses.needsProGuideAction'),
            icon: 'crown',
            onPress: () => router.push('/plans'),
          }}
        />
      </Screen>
    );
  }

  if (!instructor.isLoading && !instructor.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={t('courses.create.title')} showBack onBack={back} />
        <EmptyState
          icon="user-plus"
          title={t('courses.needsInstructorProfile')}
          action={{
            label: t('courses.needsInstructorProfileAction'),
            icon: 'users',
            variant: 'secondary',
            onPress: () => router.push('/instructors'),
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('courses.create.title')}
        subtitle={t('courses.create.subtitle')}
        showBack
        onBack={back}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input
          label={t('courses.create.courseTitle')}
          placeholder={t('courses.create.courseTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
        />
        <Input
          label={t('courses.create.summary')}
          placeholder={t('courses.create.summaryPlaceholder')}
          value={summary}
          onChangeText={setSummary}
          error={errors.summary}
        />
        <Input
          label={t('courses.create.description')}
          placeholder={t('courses.create.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Field label={t('courses.create.category')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {COURSE_CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={t(CATEGORY_META[c].labelKey)}
                icon={CATEGORY_META[c].icon}
                color={CATEGORY_META[c].color}
                size="sm"
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
        </Field>
        <Field label={t('courses.create.level')}>
          <View style={styles.chipsWrap}>
            {COURSE_LEVELS.map((l) => (
              <Chip
                key={l}
                label={t(`courses.level.${l}`)}
                size="sm"
                selected={level === l}
                onPress={() => setLevel(l)}
              />
            ))}
          </View>
        </Field>
        <Field label={t('courses.create.format')}>
          <View style={styles.chipsWrap}>
            {COURSE_FORMATS.map((f) => (
              <Chip
                key={f}
                label={t(`courses.format.${f}`)}
                icon={FORMAT_ICON[f]}
                size="sm"
                selected={format === f}
                onPress={() => setFormat(f)}
              />
            ))}
          </View>
        </Field>
        <Field label={t('courses.create.adventureTypes')} error={errors.adventureTypes}>
          <View style={styles.chipsWrap}>
            {ADVENTURE_TYPES.map((a) => (
              <Chip
                key={a}
                label={t(ADVENTURE_TYPE_META[a].labelKey)}
                icon={ADVENTURE_TYPE_META[a].icon}
                color={ADVENTURE_TYPE_META[a].color}
                size="sm"
                selected={adventureTypes.includes(a)}
                onPress={() => toggleType(a)}
              />
            ))}
          </View>
        </Field>

        <View style={styles.twoCol}>
          <Input
            label={t('courses.create.price')}
            hint={t('courses.create.priceHint')}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            icon="banknote"
            error={errors.price}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label={t('courses.create.duration')}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            icon="clock"
            error={errors.duration}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <Input
          label={t('courses.create.provider')}
          value={provider}
          onChangeText={setProvider}
          icon="landmark"
        />
        <View style={styles.twoCol}>
          <Input
            label={t('courses.create.certificateName')}
            value={certificateName}
            onChangeText={setCertificateName}
            icon="award"
            containerStyle={{ flex: 1.4 }}
          />
          <Input
            label={t('courses.create.validityMonths')}
            value={validity}
            onChangeText={setValidity}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Field label={t('courses.create.outcomes')} error={errors.outcomes}>
          {outcomes.map((o, i) => (
            <View key={i} style={styles.rowInput}>
              <Input
                placeholder={t('courses.create.outcomePlaceholder', { n: i + 1 })}
                value={o}
                onChangeText={(v) => setOutcomes((prev) => prev.map((x, j) => (j === i ? v : x)))}
                icon="circle-check"
                containerStyle={{ flex: 1 }}
              />
              {outcomes.length > 1 ? (
                <IconButton
                  icon="x"
                  variant="ghost"
                  onPress={() => setOutcomes((prev) => prev.filter((_, j) => j !== i))}
                  accessibilityLabel={t('common.delete')}
                />
              ) : null}
            </View>
          ))}
          <Button
            label={t('courses.create.addOutcome')}
            icon="plus"
            variant="ghost"
            size="sm"
            onPress={() => setOutcomes((prev) => [...prev, ''])}
          />
        </Field>

        <Field label={t('courses.create.lessons')}>
          {lessons.map((l, i) => (
            <Card key={l.key} padded style={{ gap: spacing.sm }}>
              <View style={styles.lessonHead}>
                <View style={[styles.lessonIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <Icon name={LESSON_TYPE_ICON[l.type]} size={16} color={colors.primary} />
                </View>
                <Text variant="title" style={{ flex: 1 }}>
                  {i + 1}.
                </Text>
                <IconButton
                  icon="trash"
                  variant="ghost"
                  onPress={() => setLessons((prev) => prev.filter((x) => x.key !== l.key))}
                  accessibilityLabel={t('courses.create.removeLesson')}
                />
              </View>
              <Input
                placeholder={t('courses.create.lessonModule')}
                value={l.moduleTitle}
                onChangeText={(v) => updateLesson(l.key, { moduleTitle: v })}
                icon="layers"
              />
              <Input
                placeholder={t('courses.create.lessonTitle')}
                value={l.title}
                onChangeText={(v) => updateLesson(l.key, { title: v })}
              />
              <View style={styles.rowInput}>
                <View style={[styles.chipsWrap, { flex: 1 }]}>
                  {LESSON_TYPES.map((type) => (
                    <Chip
                      key={type}
                      label={t(`courses.lessonType.${type}`)}
                      icon={LESSON_TYPE_ICON[type]}
                      size="sm"
                      selected={l.type === type}
                      onPress={() => updateLesson(l.key, { type })}
                    />
                  ))}
                </View>
              </View>
              <Input
                label={t('courses.create.lessonMinutes')}
                value={l.durationMin}
                onChangeText={(v) => updateLesson(l.key, { durationMin: v })}
                keyboardType="numeric"
                icon="clock"
              />
            </Card>
          ))}
          <Button
            label={t('courses.create.addLesson')}
            icon="plus"
            variant="secondary"
            size="sm"
            onPress={() =>
              setLessons((prev) => [
                ...prev,
                emptyLesson(
                  (prev[prev.length - 1]?.key ?? 0) + 1,
                  prev[prev.length - 1]?.moduleTitle ?? 'Modül 1',
                ),
              ])
            }
          />
        </Field>

        {hasError ? (
          <Text variant="caption" color="danger">
            {Object.values(errors).filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Button
          label={t('courses.create.submit')}
          icon="rocket"
          size="lg"
          fullWidth
          loading={create.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" weight="bold" color="textMuted" style={{ marginLeft: spacing.xs }}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" color="danger" style={{ marginLeft: spacing.xs }}>
          {error}
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
    paddingBottom: spacing.xxl * 2,
  },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  rowInput: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
