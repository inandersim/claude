import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { gradeQuiz, QUIZ_PASS_SCORE, type Lesson, type LessonQuizResult } from '@/domain';

interface Props {
  lesson: Lesson;
  /** Geçen sonuç üst bileşene iletilir (ders tamamlama) */
  onFinished: (result: LessonQuizResult) => void;
  pending?: boolean;
  /** Daha önce alınmış puan varsa gösterilir */
  previousScore?: number | null;
}

/** Soru-soru ilerleyen quiz oynatıcı; sonunda sonuç kartı. */
export function QuizPlayer({ lesson, onFinished, pending = false, previousScore = null }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const questions = lesson.quiz ?? [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<LessonQuizResult | null>(null);

  const current = questions[index];
  const selected = answers[index] ?? null;
  const isLast = index === questions.length - 1;

  const choose = (optionIndex: number) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? optionIndex : a)));
  };

  const next = () => {
    if (isLast) {
      const graded = gradeQuiz(lesson, answers);
      setResult(graded);
      if (graded.passed) onFinished(graded);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const retry = () => {
    setAnswers(questions.map(() => null));
    setIndex(0);
    setResult(null);
  };

  if (questions.length === 0) {
    return (
      <Text variant="body" color="textMuted">
        —
      </Text>
    );
  }

  if (result) {
    const color = result.passed ? colors.success : colors.danger;
    return (
      <View style={[styles.result, { backgroundColor: colors.surface, borderColor: color }]}>
        <Icon name={result.passed ? 'trophy' : 'refresh-cw'} size={36} color={color} />
        <Text variant="h2" weight="extrabold" align="center">
          {result.passed ? t('courses.quiz.passed') : t('courses.quiz.failed')}
        </Text>
        <Text variant="title" color={color}>
          {t('courses.quiz.score', {
            correct: result.correct,
            total: result.total,
            score: result.score,
          })}
        </Text>
        {!result.passed ? (
          <>
            <Text variant="bodySm" color="textMuted" align="center">
              {t('courses.quiz.passHint', { score: QUIZ_PASS_SCORE })}
            </Text>
            {result.wrongIndexes.length > 0 ? (
              <Text variant="caption" color="textSubtle" align="center">
                {t('courses.quiz.review', {
                  list: result.wrongIndexes.map((i) => i + 1).join(', '),
                })}
              </Text>
            ) : null}
            <Button label={t('courses.quiz.retry')} icon="refresh-cw" onPress={retry} />
          </>
        ) : pending ? (
          <Button label={t('common.loading')} loading onPress={() => {}} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        <Text variant="caption" weight="bold" color="textMuted">
          {t('courses.quiz.question', { n: index + 1, total: questions.length })}
        </Text>
        {previousScore !== null ? (
          <Text variant="caption" color="textSubtle">
            %{previousScore}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${((index + 1) / questions.length) * 100}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <Text variant="h3">{current?.question}</Text>
      <View style={styles.options}>
        {current?.options.map((option, i) => {
          const active = selected === i;
          return (
            <Tappable
              key={option}
              onPress={() => choose(i)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option}
              style={[
                styles.option,
                {
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: active ? colors.primary : colors.borderStrong },
                  active && { backgroundColor: colors.primary },
                ]}
              />
              <Text variant="body" weight={active ? 'semibold' : 'regular'} style={{ flex: 1 }}>
                {option}
              </Text>
            </Tappable>
          );
        })}
      </View>
      <Button
        label={isLast ? t('courses.quiz.submit') : t('courses.quiz.next')}
        iconRight={isLast ? 'check' : 'arrow-right'}
        disabled={selected === null}
        onPress={next}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  radio: { width: 18, height: 18, borderRadius: radius.full, borderWidth: 2 },
  result: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 2,
  },
});
