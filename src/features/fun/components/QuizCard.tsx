import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPE_META, type QuizQuestion } from '@/domain';

export interface QuizCardProps {
  question: QuizQuestion;
  index: number;
  total: number;
  /** Seçilen şık; null ise henüz cevaplanmadı */
  selected: number | null;
  onSelect: (answerIndex: number) => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Soru kartı: seçim sonrası doğru/yanlış renkleri ve açıklama. */
export function QuizCard({ question, index, total, selected, onSelect }: QuizCardProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const answered = selected !== null;
  const meta = question.adventureType ? ADVENTURE_TYPE_META[question.adventureType] : null;
  const isCorrect = answered && selected === question.answerIndex;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text variant="label" color="textMuted">
          {t('fun.quiz.question', { current: index + 1, total }).toLocaleUpperCase('tr-TR')}
        </Text>
        {meta ? (
          <View style={[styles.pill, { backgroundColor: meta.softColor }]}>
            <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.4} />
            <Text variant="label" color={meta.color}>
              {t(meta.labelKey)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="h3">{question.question}</Text>

      <View style={styles.options}>
        {question.options.map((option, i) => {
          const isAnswer = i === question.answerIndex;
          const isPicked = i === selected;
          let border = colors.border;
          let bg = colors.surfaceMuted;
          let fg: string = colors.text;
          if (answered && isAnswer) {
            border = colors.success;
            bg = colors.successSoft;
            fg = colors.success;
          } else if (answered && isPicked) {
            border = colors.danger;
            bg = colors.dangerSoft;
            fg = colors.danger;
          }
          return (
            <Tappable
              key={option}
              disabled={answered}
              onPress={() => onSelect(i)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ disabled: answered, selected: isPicked }}
              accessibilityLabel={t('fun.a11y.option', {
                index: LETTERS[i] ?? i + 1,
                text: option,
              })}
              style={[styles.option, { borderColor: border, backgroundColor: bg }]}
            >
              <View style={[styles.letter, { borderColor: border }]}>
                <Text variant="label" weight="extrabold" color={fg}>
                  {LETTERS[i] ?? String(i + 1)}
                </Text>
              </View>
              <Text variant="body" style={{ flex: 1 }} color={fg}>
                {option}
              </Text>
              {answered && isAnswer ? (
                <Icon name="circle-check" size={18} color={colors.success} />
              ) : answered && isPicked ? (
                <Icon name="circle-x" size={18} color={colors.danger} />
              ) : null}
            </Tappable>
          );
        })}
      </View>

      {answered ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[
            styles.explain,
            {
              backgroundColor: isCorrect ? colors.successSoft : colors.dangerSoft,
              borderColor: isCorrect ? colors.success : colors.danger,
            },
          ]}
        >
          <Text variant="title" weight="extrabold" color={isCorrect ? 'success' : 'danger'}>
            {isCorrect ? t('fun.quiz.correct') : t('fun.quiz.wrong')}
          </Text>
          <Text variant="bodySm">{question.explanation}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  letter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explain: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
});
