import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { canAccessLesson, totalLessonMinutes, type Enrollment, type Lesson } from '@/domain';

import { LessonRow } from './LessonRow';

interface Props {
  title: string;
  lessons: Lesson[];
  /** Kurs genelindeki ders numarası ofseti */
  startIndex: number;
  enrollment: Enrollment | null;
  nextLessonId: string | null;
  onLessonPress: (lesson: Lesson) => void;
}

/** Müfredat modülü: başlık, toplam süre ve ders satırları. */
export function ModuleSection({
  title,
  lessons,
  startIndex,
  enrollment,
  nextLessonId,
  onLessonPress,
}: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const done = new Set(enrollment?.completedLessonIds ?? []);
  const completedCount = lessons.filter((l) => done.has(l.id)).length;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{title}</Text>
          <Text variant="caption" color="textMuted">
            {t('courses.lessons', { count: lessons.length })} ·{' '}
            {formatDuration(totalLessonMinutes(lessons), locale)}
          </Text>
        </View>
        {enrollment ? (
          <View style={styles.count}>
            <Icon
              name={completedCount === lessons.length ? 'circle-check' : 'circle-play'}
              size={14}
              color={completedCount === lessons.length ? colors.success : colors.textSubtle}
            />
            <Text variant="caption" weight="bold" color="textMuted">
              {completedCount}/{lessons.length}
            </Text>
          </View>
        ) : null}
      </View>
      {lessons.map((lesson, i) => (
        <LessonRow
          key={lesson.id}
          lesson={lesson}
          index={startIndex + i}
          completed={done.has(lesson.id)}
          accessible={canAccessLesson(lesson, enrollment)}
          isNext={lesson.id === nextLessonId}
          onPress={onLessonPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 2 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
