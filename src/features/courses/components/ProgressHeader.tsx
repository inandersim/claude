import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressRing, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { countableLessons, type Enrollment, type Lesson } from '@/domain';

interface Props {
  title: string;
  enrollment: Enrollment;
  lessons: Lesson[];
  subtitle?: string;
}

/** Ders ekranı üst kısmı: halka ilerleme + "x/y ders" + kurs adı. */
export function ProgressHeader({ title, enrollment, lessons, subtitle }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const countable = countableLessons(enrollment, lessons);
  const done = new Set(enrollment.completedLessonIds);
  const completed = countable.filter((l) => done.has(l.id)).length;
  const percent = Math.round(enrollment.progress * 100);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ProgressRing
        value={percent}
        size={56}
        strokeWidth={5}
        color={percent >= 100 ? colors.success : colors.primary}
      >
        <Text variant="label" weight="extrabold">
          %{percent}
        </Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {subtitle ?? t('courses.progress')}
        </Text>
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" weight="bold" color="primary">
          {t('courses.progressOf', { done: completed, total: countable.length })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
});
