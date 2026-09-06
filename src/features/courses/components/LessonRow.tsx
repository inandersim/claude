import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { LESSON_TYPE_ICON, type Lesson } from '@/domain';

interface Props {
  lesson: Lesson;
  index: number;
  completed: boolean;
  accessible: boolean;
  /** Sırada olan ders vurgulanır */
  isNext?: boolean;
  onPress: (lesson: Lesson) => void;
}

/** Müfredat satırı: tür ikonu, başlık, süre; kilit / önizleme / tamamlandı durumu. */
export function LessonRow({ lesson, index, completed, accessible, isNext, onPress }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const statusIcon = completed ? 'circle-check' : accessible ? null : 'lock';
  const statusColor = completed ? colors.success : colors.textSubtle;

  return (
    <Tappable
      onPress={() => onPress(lesson)}
      haptic="selection"
      style={[
        styles.row,
        { borderColor: isNext ? colors.primary : colors.border, backgroundColor: colors.surface },
        !accessible && !completed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${index}. ${lesson.title}, ${t(`courses.lessonType.${lesson.type}`)}, ${
        completed ? t('courses.completed') : accessible ? '' : t('courses.locked')
      }`}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Icon
          name={LESSON_TYPE_ICON[lesson.type]}
          size={16}
          color={completed ? colors.success : colors.primary}
          strokeWidth={2.4}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySm" weight="semibold" numberOfLines={2}>
          {index}. {lesson.title}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" color="textMuted">
            {t(`courses.lessonType.${lesson.type}`)} ·{' '}
            {t('courses.duration', { min: lesson.durationMin })}
          </Text>
          {lesson.preview && !completed ? (
            <View style={[styles.previewPill, { backgroundColor: colors.primarySoft }]}>
              <Text variant="label" weight="bold" color="primary">
                {t('courses.preview')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {statusIcon ? <Icon name={statusIcon} size={18} color={statusColor} /> : null}
      {!statusIcon && isNext ? (
        <Icon name="circle-play" size={18} color={colors.primary} strokeWidth={2.4} />
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  previewPill: {
    paddingHorizontal: spacing.sm,
    height: 18,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
});
