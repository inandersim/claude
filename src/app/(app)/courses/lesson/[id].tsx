import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  canAccessLesson,
  countableLessons,
  LESSON_TYPE_ICON,
  nextLesson,
  type LessonQuizResult,
} from '@/domain';
import { ProgressHeader } from '@/features/courses/components/ProgressHeader';
import { QuizPlayer } from '@/features/courses/components/QuizPlayer';
import { ReadingView } from '@/features/courses/components/ReadingView';
import { VideoLesson } from '@/features/courses/components/VideoLesson';
import { useCompleteLesson, useCourse, useLessons } from '@/features/courses/hooks';

export default function LessonScreen() {
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId: string }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [justCompleted, setJustCompleted] = useState(false);

  const course = useCourse(courseId);
  const lessons = useLessons(courseId);
  const complete = useCompleteLesson();

  const lessonList = useMemo(() => lessons.data ?? [], [lessons.data]);
  const lesson = useMemo(() => lessonList.find((l) => l.id === id) ?? null, [lessonList, id]);
  const enrollment = course.data?.enrollment ?? null;
  const accessible = lesson ? canAccessLesson(lesson, enrollment) : false;
  const completed = Boolean(lesson && enrollment?.completedLessonIds.includes(lesson.id));
  const isPracticalLocked = lesson?.type === 'practical' && !enrollment?.sessionId;

  // Sonraki ders: sıradaki tamamlanmamış; yoksa listede bir sonraki.
  const following = useMemo(() => {
    if (!lesson) return null;
    if (enrollment) {
      const n = nextLesson(enrollment, lessonList);
      if (n && n.id !== lesson.id) return n;
      const ordered = countableLessons(enrollment, lessonList);
      const idx = ordered.findIndex((l) => l.id === lesson.id);
      return ordered[idx + 1] ?? null;
    }
    return lessonList.find((l) => l.order > lesson.order && l.preview) ?? null;
  }, [lesson, enrollment, lessonList]);

  const goBackToCourse = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/courses/[id]', params: { id: courseId } });

  const markComplete = (quizScore: number | null = null) => {
    if (!lesson || !enrollment) return;
    complete.mutate(
      { courseId, lessonId: lesson.id, quizScore },
      {
        onSuccess: (e) => {
          setJustCompleted(true);
          if (e.status === 'completed') {
            toast(
              course.data?.certificateName ? t('courses.certificate.issued') : t('courses.allDone'),
              'success',
            );
          }
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const onQuizFinished = (result: LessonQuizResult) => {
    if (result.passed && !completed) markComplete(result.score);
  };

  const openNext = () => {
    if (!following) return goBackToCourse();
    router.replace({
      pathname: '/courses/lesson/[id]',
      params: { id: following.id, courseId },
    });
  };

  const loading = course.isLoading || lessons.isLoading;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={lesson ? t(`courses.lessonType.${lesson.type}`) : t('courses.title')}
        subtitle={course.data?.title}
        showBack
        onBack={goBackToCourse}
      />
      <View style={styles.content}>
        {course.isError || lessons.isError ? (
          <ErrorState
            onRetry={() => {
              course.refetch();
              lessons.refetch();
            }}
          />
        ) : loading ? (
          <>
            <Skeleton height={72} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </>
        ) : !lesson ? (
          <EmptyState icon="book-open" title={t('courses.lessonNotFound')} />
        ) : !accessible ? (
          <EmptyState
            icon="lock"
            title={t('courses.locked')}
            description={t('courses.lockedHint')}
            action={{
              label: t('courses.enroll'),
              icon: 'graduation-cap',
              onPress: goBackToCourse,
            }}
          />
        ) : (
          <>
            {enrollment && course.data ? (
              <ProgressHeader
                title={course.data.title}
                enrollment={enrollment}
                lessons={lessonList}
                subtitle={lesson.moduleTitle}
              />
            ) : (
              <View style={[styles.previewBanner, { backgroundColor: colors.primarySoft }]}>
                <Icon name="eye" size={16} color={colors.primary} />
                <Text variant="caption" weight="bold" color="primary">
                  {t('courses.preview')} · {lesson.moduleTitle}
                </Text>
              </View>
            )}

            <View style={styles.titleRow}>
              <View style={[styles.typeIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name={LESSON_TYPE_ICON[lesson.type]} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">{lesson.title}</Text>
                <Text variant="caption" color="textMuted">
                  {t('courses.duration', { min: lesson.durationMin })}
                  {completed ? ` · ${t('courses.completed')}` : ''}
                </Text>
              </View>
              {completed ? <Icon name="circle-check" size={22} color={colors.success} /> : null}
            </View>

            {lesson.type === 'video' ? <VideoLesson lesson={lesson} /> : null}
            {lesson.type === 'reading' ? <ReadingView lesson={lesson} /> : null}
            {lesson.type === 'quiz' ? (
              <QuizPlayer
                lesson={lesson}
                onFinished={onQuizFinished}
                pending={complete.isPending}
                previousScore={enrollment?.quizScores[lesson.id] ?? null}
              />
            ) : null}
            {lesson.type === 'practical' ? (
              <Card padded style={{ gap: spacing.sm }}>
                <View style={styles.rowCenter}>
                  <Icon name="map-pin" size={18} color={colors.accent} />
                  <Text variant="title">{t('courses.lessonType.practical')}</Text>
                </View>
                <Text variant="body" color="textMuted">
                  {lesson.body}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {isPracticalLocked ? t('courses.practicalLocked') : t('courses.practicalHint')}
                </Text>
              </Card>
            ) : null}

            {enrollment ? (
              <View style={styles.actions}>
                {!completed && lesson.type !== 'quiz' ? (
                  <Button
                    label={t('courses.markComplete')}
                    icon="check"
                    fullWidth
                    loading={complete.isPending}
                    disabled={Boolean(isPracticalLocked)}
                    onPress={() => markComplete(null)}
                  />
                ) : null}
                {completed || justCompleted ? (
                  <Button
                    label={following ? t('courses.nextLesson') : t('courses.finishCourse')}
                    iconRight={following ? 'arrow-right' : 'award'}
                    variant={completed ? 'primary' : 'secondary'}
                    fullWidth
                    onPress={openNext}
                  />
                ) : null}
              </View>
            ) : (
              <Button
                label={t('courses.enroll')}
                icon="graduation-cap"
                fullWidth
                onPress={goBackToCourse}
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
