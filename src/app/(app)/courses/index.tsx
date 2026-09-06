import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import {
  canAcceptPaidBookings,
  COURSE_FORMATS,
  COURSE_LEVELS,
  FORMAT_ICON,
  type CourseCategory,
  type CourseFormat,
  type CourseLevel,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CategoryChips } from '@/features/courses/components/CategoryChips';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { useCourses, useRecommendedCourses } from '@/features/courses/hooks';
import { SearchBar } from '@/features/explore/components/SearchBar';

export default function CoursesScreen() {
  const router = useRouter();
  const { t } = useT();
  const me = useCurrentUser();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CourseCategory | null>(null);
  const [format, setFormat] = useState<CourseFormat | null>(null);
  const [level, setLevel] = useState<CourseLevel | null>(null);

  const courses = useCourses({ query, category, format, level });
  const recommended = useRecommendedCourses(6);
  const hasFilter = Boolean(query || category || format || level);
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const canCreate = canAcceptPaidBookings(me.plan);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('courses.title')}
        subtitle={t('courses.subtitle')}
        showBack
        right={
          <Button
            label={t('courses.my.title')}
            icon="graduation-cap"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/courses/my')}
          />
        }
      />
      <View style={styles.content}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('courses.search')} />
        <CategoryChips value={category} onChange={setCategory} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {COURSE_FORMATS.map((f) => (
            <Chip
              key={f}
              label={t(`courses.format.${f}`)}
              icon={FORMAT_ICON[f]}
              size="sm"
              selected={format === f}
              onPress={() => setFormat(format === f ? null : f)}
            />
          ))}
          <View style={styles.divider} />
          {COURSE_LEVELS.map((l) => (
            <Chip
              key={l}
              label={t(`courses.level.${l}`)}
              size="sm"
              selected={level === l}
              onPress={() => setLevel(level === l ? null : l)}
            />
          ))}
        </ScrollView>

        {!hasFilter ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader
              title={t('courses.recommended')}
              subtitle={t('courses.recommendedSubtitle')}
            />
            {recommended.isLoading ? (
              <View style={styles.hRow}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} height={220} style={{ width: 240, borderRadius: radius.xl }} />
                ))}
              </View>
            ) : recommended.data && recommended.data.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hRow}
                style={styles.chipScroll}
              >
                {recommended.data.map((c) => (
                  <CourseCard key={c.id} course={c} compact />
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <SectionHeader
          title={t('courses.catalog')}
          subtitle={courses.data ? t('courses.results', { count: courses.data.length }) : undefined}
          actionLabel={canCreate ? t('courses.create.action') : undefined}
          onAction={canCreate ? () => router.push('/courses/create') : undefined}
        />
        {courses.isError ? (
          <ErrorState onRetry={() => courses.refetch()} />
        ) : courses.isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} height={260} style={{ borderRadius: radius.xl }} />
          ))
        ) : courses.data && courses.data.length > 0 ? (
          <View style={styles.grid}>
            {courses.data.map((c) => (
              <View
                key={c.id}
                style={{ width: columns === 1 ? '100%' : `${100 / columns - 1.5}%` }}
              >
                <CourseCard course={c} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="graduation-cap"
            title={t('courses.empty')}
            description={t('courses.emptyDescription')}
            action={{
              label: t('courses.all'),
              icon: 'x',
              variant: 'secondary',
              onPress: () => {
                setQuery('');
                setCategory(null);
                setFormat(null);
                setLevel(null);
              },
            }}
          />
        )}
        {!canCreate ? (
          <Text variant="caption" color="textSubtle" align="center">
            {t('courses.needsProGuide')}
          </Text>
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
  chipScroll: { marginHorizontal: -spacing.lg },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(128,128,128,0.3)', marginHorizontal: 2 },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
