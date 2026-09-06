import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import {
  CATEGORY_META,
  courseDurationLabel,
  FORMAT_ICON,
  formatPriceTry,
  type CourseWithInstructor,
} from '@/domain';

interface Props {
  course: CourseWithInstructor;
  /** Yatay şeritte dar kart */
  compact?: boolean;
}

/**
 * Kurs kartı: kapak, kategori rozeti, seviye, format, süre, fiyat, puan;
 * kayıtlıysa ilerleme çubuğu.
 */
export function CourseCard({ course, compact = false }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = CATEGORY_META[course.category];
  const enrollment = course.enrollment;
  const progress = enrollment ? Math.round(enrollment.progress * 100) : null;

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/courses/[id]', params: { id: course.id } })}
      scaleTo={0.97}
      style={[
        styles.card,
        compact && styles.compact,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, ${t(meta.labelKey)}, ${t(`courses.level.${course.level}`)}`}
    >
      <AdventureImage
        uri={course.imageUrl}
        adventureType={course.adventureTypes[0] ?? 'hiking'}
        style={compact ? styles.coverCompact : styles.cover}
        overlay
      >
        <View style={styles.coverTop}>
          <View style={[styles.pill, { backgroundColor: meta.color }]}>
            <Icon name={meta.icon} size={12} color="#0B1410" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#0B1410">
              {t(meta.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          {enrollment?.status === 'completed' ? (
            <View style={[styles.pill, { backgroundColor: colors.success }]}>
              <Icon name="award" size={12} color="#0B1410" strokeWidth={2.6} />
              <Text variant="label" weight="extrabold" color="#0B1410">
                {t('courses.completed').toLocaleUpperCase(locale)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.coverBottom}>
          <Text variant="label" weight="extrabold" color="#F2F7F4">
            {formatPriceTry(course.priceTry, locale)}
          </Text>
        </View>
      </AdventureImage>
      <View style={styles.body}>
        <Text variant="title" numberOfLines={2}>
          {course.title}
        </Text>
        {!compact ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {course.summary}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Icon name={FORMAT_ICON[course.format]} size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t(`courses.format.${course.format}`)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="gauge" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t(`courses.level.${course.level}`)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="clock" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {courseDurationLabel(course.durationHours, locale)}
            </Text>
          </View>
        </View>
        <View style={styles.foot}>
          <View style={styles.meta}>
            <Icon name="star" size={13} color={colors.accent} strokeWidth={2.4} />
            <Text variant="caption" weight="bold">
              {course.rating.toFixed(1)}
            </Text>
            <Text variant="caption" color="textSubtle">
              ({formatCompact(course.reviewCount, locale)})
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="users" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('courses.students', { count: formatCompact(course.enrolledCount, locale) })}
            </Text>
          </View>
        </View>
        {progress !== null ? (
          <View style={styles.progressWrap}>
            <View
              style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress }}
            >
              <View
                style={[
                  styles.fill,
                  {
                    width: `${progress}%`,
                    backgroundColor: progress >= 100 ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text variant="label" weight="bold" color={progress >= 100 ? 'success' : 'primary'}>
              %{progress}
            </Text>
          </View>
        ) : null}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  compact: { width: 240 },
  cover: { width: '100%', height: 140 },
  coverCompact: { width: '100%', height: 110 },
  coverTop: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  coverBottom: {
    position: 'absolute',
    bottom: spacing.sm + 2,
    right: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.65)',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  body: { padding: spacing.md, gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
