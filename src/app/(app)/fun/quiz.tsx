import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  ProgressRing,
  Screen,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { dayNumber, type QuizResult } from '@/domain';
import { QuizCard } from '@/features/fun/components/QuizCard';
import { StreakFlame } from '@/features/fun/components/StreakFlame';
import { useFunSummary, useQuiz, useSubmitQuiz, useXpHistory } from '@/features/fun/hooks';

type Phase = 'intro' | 'playing' | 'result';

export default function QuizScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const quiz = useQuiz(5);
  const submit = useSubmitQuiz();
  const summary = useFunSummary();
  const history = useXpHistory();

  const [phase, setPhase] = useState<Phase>('intro');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [today] = useState(() => dayNumber(Date.now()));

  const questions = quiz.data ?? [];
  const question = questions[current];
  const selected = question ? (answers[question.id] ?? null) : null;
  const isLast = current === questions.length - 1;
  const doneToday =
    history.data?.some((e) => e.source === 'quiz' && dayNumber(e.createdAt) === today) ?? false;

  const start = () => {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setPhase('playing');
  };

  const select = (i: number) => {
    if (!question || selected !== null) return;
    setAnswers((prev) => ({ ...prev, [question.id]: i }));
    if (i === question.answerIndex) haptics.success();
    else haptics.error();
  };

  const next = () => {
    if (!isLast) {
      setCurrent((c) => c + 1);
      return;
    }
    const payload = questions.map((q) => ({ questionId: q.id, answerIndex: answers[q.id] ?? -1 }));
    submit.mutate(payload, {
      onSuccess: (r) => {
        setResult(r);
        setPhase('result');
      },
      onError: () => toast(t('fun.quiz.submitError'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('fun.quiz.title')} subtitle={t('fun.quiz.subtitle')} showBack />
      <View style={styles.content}>
        {quiz.isError ? (
          <ErrorState onRetry={() => quiz.refetch()} />
        ) : quiz.isLoading ? (
          <Skeleton height={320} style={{ borderRadius: radius.xl }} />
        ) : questions.length === 0 ? (
          <EmptyState icon="brain" title={t('fun.quiz.empty')} />
        ) : phase === 'intro' ? (
          <Card elevated style={styles.intro}>
            <View style={[styles.introIcon, { backgroundColor: colors.infoSoft }]}>
              <Icon name="brain" size={30} color={colors.info} strokeWidth={1.8} />
            </View>
            <Text variant="h2" align="center">
              {t('fun.hub.todayQuiz')}
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              {t('fun.hub.todayQuizHint')}
            </Text>
            <View
              style={[
                styles.note,
                { backgroundColor: doneToday ? colors.warningSoft : colors.surfaceMuted },
              ]}
            >
              <Icon
                name={doneToday ? 'circle-alert' : 'info'}
                size={14}
                color={doneToday ? colors.warning : colors.textMuted}
              />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {doneToday ? t('fun.quiz.noXpToday') : t('fun.quiz.dailyNote')}
              </Text>
            </View>
            <Button
              label={doneToday ? t('fun.quiz.playAgain') : t('fun.quiz.start')}
              icon="play"
              onPress={start}
              fullWidth
              variant={doneToday ? 'secondary' : 'primary'}
            />
          </Card>
        ) : phase === 'playing' && question ? (
          <>
            <View style={styles.progressRow}>
              {questions.map((q, i) => {
                const a = answers[q.id];
                const bg =
                  a === undefined
                    ? i === current
                      ? colors.primary
                      : colors.surfaceMuted
                    : a === q.answerIndex
                      ? colors.success
                      : colors.danger;
                return <View key={q.id} style={[styles.progressDot, { backgroundColor: bg }]} />;
              })}
            </View>
            <Animated.View key={question.id} entering={FadeIn.duration(200)}>
              <QuizCard
                question={question}
                index={current}
                total={questions.length}
                selected={selected}
                onSelect={select}
              />
            </Animated.View>
            <Button
              label={isLast ? t('fun.quiz.finish') : t('fun.quiz.next')}
              iconRight={isLast ? 'check' : 'arrow-right'}
              onPress={next}
              disabled={selected === null}
              loading={submit.isPending}
              fullWidth
            />
          </>
        ) : result ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.resultWrap}>
            <Card elevated style={styles.resultCard}>
              <ProgressRing
                value={result.total ? (result.correct / result.total) * 100 : 0}
                size={120}
                strokeWidth={10}
                color={result.correct === result.total ? colors.success : colors.primary}
              >
                <Text variant="h1">{result.correct}</Text>
                <Text variant="caption" color="textMuted">
                  / {result.total}
                </Text>
              </ProgressRing>
              <Text variant="h2" align="center">
                {t('fun.quiz.score', { correct: result.correct, total: result.total })}
              </Text>
              {result.correct === result.total && result.xpEarned > 0 ? (
                <Text variant="title" color="success" align="center">
                  {t('fun.quiz.perfect')}
                </Text>
              ) : null}
              <Text
                variant="title"
                weight="extrabold"
                color={result.xpEarned > 0 ? 'accent' : 'textMuted'}
                align="center"
              >
                {result.xpEarned > 0
                  ? t('fun.quiz.xpEarned', { xp: result.xpEarned })
                  : t('fun.quiz.noXpToday')}
              </Text>
              <View style={styles.statRow}>
                <StatTile
                  icon="trending-up"
                  label={t('fun.quiz.bestRun')}
                  value={String(result.streak)}
                  compact
                  style={{ flex: 1 }}
                />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <StreakFlame days={summary.data?.streakDays ?? 0} />
                </View>
              </View>
            </Card>
            <Button
              label={t('fun.quiz.playAgain')}
              variant="secondary"
              icon="refresh-cw"
              onPress={start}
              fullWidth
            />
            <Button
              label={t('fun.quiz.backToHub')}
              variant="ghost"
              onPress={() => router.back()}
              fullWidth
            />
          </Animated.View>
        ) : null}
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
    paddingBottom: spacing.xxl,
  },
  intro: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    alignSelf: 'stretch',
  },
  progressRow: { flexDirection: 'row', gap: spacing.xs },
  progressDot: { flex: 1, height: 6, borderRadius: radius.full },
  resultWrap: { gap: spacing.md },
  resultCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
});
