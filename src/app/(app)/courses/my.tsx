import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  Skeleton,
  StatTile,
  Tappable,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { CertificateCard } from '@/features/courses/components/CertificateCard';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { useCertificates, useMyCourses } from '@/features/courses/hooks';

type Tab = 'active' | 'completed' | 'certificates';

export default function MyCoursesScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>('active');

  const mine = useMyCourses();
  const certificates = useCertificates();

  const active = useMemo(
    () => (mine.data ?? []).filter((c) => c.enrollment?.status === 'active'),
    [mine.data],
  );
  const completed = useMemo(
    () => (mine.data ?? []).filter((c) => c.enrollment?.status === 'completed'),
    [mine.data],
  );

  const segments: { value: Tab; label: string; badge?: number }[] = [
    { value: 'active', label: t('courses.my.active'), badge: active.length || undefined },
    { value: 'completed', label: t('courses.my.completed'), badge: completed.length || undefined },
    {
      value: 'certificates',
      label: t('courses.my.certificates'),
      badge: certificates.data?.length || undefined,
    },
  ];

  const browse = {
    label: t('courses.my.browse'),
    icon: 'search' as const,
    variant: 'secondary' as const,
    onPress: () => router.replace('/courses'),
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('courses.my.title')} showBack />
      <View style={styles.content}>
        <View style={styles.stats}>
          <StatTile
            icon="circle-play"
            label={t('courses.my.active')}
            value={String(active.length)}
            color={colors.primary}
            compact
          />
          <StatTile
            icon="circle-check"
            label={t('courses.my.completed')}
            value={String(completed.length)}
            color={colors.success}
            compact
          />
          <StatTile
            icon="award"
            label={t('courses.my.certificates')}
            value={String(certificates.data?.length ?? 0)}
            color={colors.accent}
            compact
          />
        </View>
        <SegmentedControl segments={segments} value={tab} onChange={setTab} />

        {tab !== 'certificates' ? (
          mine.isError ? (
            <ErrorState onRetry={() => mine.refetch()} />
          ) : mine.isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} height={240} style={{ borderRadius: radius.xl }} />)
          ) : (tab === 'active' ? active : completed).length > 0 ? (
            (tab === 'active' ? active : completed).map((c) => <CourseCard key={c.id} course={c} />)
          ) : (
            <EmptyState
              icon={tab === 'active' ? 'circle-play' : 'circle-check'}
              title={
                tab === 'active' ? t('courses.my.emptyActive') : t('courses.my.emptyCompleted')
              }
              description={
                tab === 'active'
                  ? t('courses.my.emptyActiveDescription')
                  : t('courses.my.emptyCompletedDescription')
              }
              action={browse}
            />
          )
        ) : certificates.isError ? (
          <ErrorState onRetry={() => certificates.refetch()} />
        ) : certificates.isLoading ? (
          <Skeleton height={220} style={{ borderRadius: radius.xl }} />
        ) : certificates.data && certificates.data.length > 0 ? (
          certificates.data.map((c) => (
            <Tappable
              key={c.id}
              onPress={() =>
                router.push({ pathname: '/courses/certificate/[id]', params: { id: c.id } })
              }
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${c.course.certificateName ?? c.course.title}, ${c.code}`}
            >
              <CertificateCard certificate={c} course={c.course} now={now} />
            </Tappable>
          ))
        ) : (
          <EmptyState
            icon="award"
            title={t('courses.certificate.empty')}
            description={t('courses.certificate.emptyDescription')}
            action={browse}
          />
        )}
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
  stats: { flexDirection: 'row', gap: spacing.sm },
});
