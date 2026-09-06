import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDuration, formatRelative } from '@/core/utils/time';
import {
  CATEGORY_META,
  courseDurationLabel,
  FORMAT_ICON,
  formatPriceTry,
  moduleGroups,
  nextLesson,
  totalLessonMinutes,
  type CourseSession,
  type Lesson,
} from '@/domain';
import { CertificateCard } from '@/features/courses/components/CertificateCard';
import { ModuleSection } from '@/features/courses/components/ModuleSection';
import { SessionCard } from '@/features/courses/components/SessionCard';
import {
  useCertificates,
  useCourse,
  useCourseReviews,
  useEnroll,
  useLessons,
  useSessions,
  useWriteCourseReview,
} from '@/features/courses/hooks';
import { RatingStars } from '@/features/instructors/components/RatingStars';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [selectedSession, setSelectedSession] = useState<CourseSession | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const course = useCourse(id);
  const lessons = useLessons(id);
  const sessions = useSessions(id);
  const reviews = useCourseReviews(id);
  const certificates = useCertificates();
  const enroll = useEnroll();
  const writeReview = useWriteCourseReview();

  const data = course.data;
  const enrollment = data?.enrollment ?? null;
  const lessonList = useMemo(() => lessons.data ?? [], [lessons.data]);
  const groups = useMemo(() => moduleGroups(lessonList), [lessonList]);
  const next = useMemo(
    () => (enrollment ? nextLesson(enrollment, lessonList) : null),
    [enrollment, lessonList],
  );
  const myCertificate = useMemo(
    () => certificates.data?.find((c) => c.courseId === id) ?? null,
    [certificates.data, id],
  );
  const alreadyReviewed = useMemo(
    () => reviews.data?.some((r) => r.authorId === enrollment?.userId) ?? false,
    [reviews.data, enrollment?.userId],
  );

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  const doEnroll = () => {
    if (!data) return;
    if (data.format === 'in_person' && !selectedSession) {
      toast(t('courses.sessionRequired'), 'info');
      return;
    }
    enroll.mutate(
      { courseId: data.id, sessionId: selectedSession?.id ?? null },
      {
        onSuccess: () => {
          toast(t('courses.enrolledToast'), 'success');
          setSelectedSession(null);
        },
        onError,
      },
    );
  };

  const openLesson = (lesson: Lesson) => {
    router.push({ pathname: '/courses/lesson/[id]', params: { id: lesson.id, courseId: id } });
  };

  const submitReview = () => {
    writeReview.mutate(
      { courseId: id, rating: reviewRating, text: reviewText },
      {
        onSuccess: () => {
          toast(t('courses.reviewSent'), 'success');
          setReviewText('');
          setShowReviewForm(false);
        },
        onError,
      },
    );
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/courses'));

  const primaryLabel = enrollment
    ? enrollment.status === 'completed'
      ? myCertificate
        ? t('courses.certificate.yours')
        : t('courses.completed')
      : next
        ? t('courses.continue')
        : t('courses.enrolled')
    : data
      ? data.priceTry > 0
        ? t('courses.enrollFor', {
            price: formatPriceTry(data.priceTry + (selectedSession?.priceTry ?? 0), locale),
          })
        : t('courses.enroll')
      : '';

  const onPrimary = () => {
    if (!data) return;
    if (!enrollment) return doEnroll();
    if (enrollment.status === 'completed' && myCertificate) {
      router.push({ pathname: '/courses/certificate/[id]', params: { id: myCertificate.id } });
      return;
    }
    if (next) openLesson(next);
  };

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          onPress={back}
          variant="blur"
          accessibilityLabel={t('common.back')}
        />
      </View>
      {course.isError ? (
        <ErrorState onRetry={() => course.refetch()} />
      ) : course.isLoading || !data ? (
        <View style={{ padding: spacing.lg, gap: spacing.md, paddingTop: insets.top + 64 }}>
          <Skeleton height={220} style={{ borderRadius: radius.xl }} />
          <Skeleton height={28} />
          <Skeleton height={80} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          <AdventureImage
            uri={data.imageUrl}
            adventureType={data.adventureTypes[0] ?? 'hiking'}
            style={styles.cover}
            overlay
          >
            <View style={styles.coverBody}>
              <View style={styles.badges}>
                <Badge
                  label={t(CATEGORY_META[data.category].labelKey)}
                  icon={CATEGORY_META[data.category].icon}
                  color={CATEGORY_META[data.category].color}
                />
                <Badge label={t(`courses.level.${data.level}`)} color="#F2F7F4" soft />
                <Badge
                  label={t(`courses.format.${data.format}`)}
                  icon={FORMAT_ICON[data.format]}
                  color="#F2F7F4"
                  soft
                />
              </View>
              <Text variant="h1" color="#F2F7F4">
                {data.title}
              </Text>
              <Text variant="bodySm" color="#DCE6E0">
                {data.provider}
              </Text>
            </View>
          </AdventureImage>

          <View style={styles.content}>
            <View style={styles.statsRow}>
              <Stat
                icon="star"
                value={data.rating.toFixed(1)}
                label={`${formatCompact(data.reviewCount, locale)} ${t('courses.stat.reviews')}`}
                color={colors.accent}
              />
              <Stat
                icon="clock"
                value={courseDurationLabel(data.durationHours, locale)}
                label={t('courses.lessons', { count: lessonList.length })}
              />
              <Stat
                icon="users"
                value={formatCompact(data.enrolledCount, locale)}
                label={t('courses.stat.enrolled')}
              />
              <Stat
                icon="languages"
                value={data.languages.length.toString()}
                label={data.languages
                  .map((l) => l.slice(0, 2).toLocaleUpperCase('tr-TR'))
                  .join(' ')}
              />
            </View>

            {enrollment ? (
              <Card padded style={{ gap: spacing.sm }}>
                <View style={styles.rowBetween}>
                  <Text variant="title">{t('courses.progress')}</Text>
                  <Text
                    variant="title"
                    weight="extrabold"
                    color={enrollment.status === 'completed' ? 'success' : 'primary'}
                  >
                    %{Math.round(enrollment.progress * 100)}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.round(enrollment.progress * 100)}%`,
                        backgroundColor:
                          enrollment.status === 'completed' ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>
                {next ? (
                  <Text variant="caption" color="textMuted">
                    {t('courses.nextLesson')}: {next.title}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <View style={{ gap: spacing.xs }}>
              <Text variant="h3">{t('courses.about')}</Text>
              <Text variant="body" color="textMuted">
                {data.description}
              </Text>
            </View>

            {data.instructor ? (
              <Tappable
                onPress={() =>
                  data.instructorId
                    ? router.push({
                        pathname: '/instructors/[id]',
                        params: { id: data.instructorId },
                      })
                    : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={`${t('courses.instructor')}: ${data.instructor.displayName}`}
                style={[
                  styles.instructor,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Avatar
                  uri={data.instructor.avatarUrl}
                  name={data.instructor.displayName}
                  size={48}
                  verified={data.instructor.isVerified}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="textMuted">
                    {t('courses.instructor')}
                  </Text>
                  <Text variant="title">{data.instructor.displayName}</Text>
                  <Text variant="caption" color="textSubtle" numberOfLines={1}>
                    {data.instructor.locationName}
                  </Text>
                </View>
                <View style={styles.linkRow}>
                  <Text variant="caption" weight="bold" color="primary">
                    {t('courses.viewProfile')}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.primary} />
                </View>
              </Tappable>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">{t('courses.outcomes')}</Text>
              {data.outcomes.map((o) => (
                <View key={o} style={styles.bullet}>
                  <Icon name="circle-check" size={16} color={colors.success} strokeWidth={2.4} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {o}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">{t('courses.prerequisites')}</Text>
              {data.prerequisites.length === 0 ? (
                <Text variant="body" color="textMuted">
                  {t('courses.noPrerequisites')}
                </Text>
              ) : (
                data.prerequisites.map((p) => (
                  <View key={p} style={styles.bullet}>
                    <Icon name="info" size={16} color={colors.info} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {p}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {lessonList.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <SectionHeader
                  title={t('courses.curriculum')}
                  subtitle={`${t('courses.moduleCount', { count: groups.length })} · ${t('courses.lessons', { count: lessonList.length })} · ${t('courses.totalDuration', { duration: formatDuration(totalLessonMinutes(lessonList), locale) })}`}
                />
                {groups.map((g, gi) => (
                  <ModuleSection
                    key={g.title}
                    title={g.title}
                    lessons={g.lessons}
                    startIndex={groups.slice(0, gi).reduce((n, x) => n + x.lessons.length, 1)}
                    enrollment={enrollment}
                    nextLessonId={next?.id ?? null}
                    onLessonPress={openLesson}
                  />
                ))}
              </View>
            ) : lessons.isLoading ? (
              <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            ) : null}

            {data.format !== 'online' ? (
              <View style={{ gap: spacing.sm }}>
                <SectionHeader
                  title={t('courses.sessions')}
                  subtitle={
                    !enrollment && data.format === 'in_person'
                      ? t('courses.selectSession')
                      : undefined
                  }
                />
                {sessions.isLoading ? (
                  <Skeleton height={110} style={{ borderRadius: radius.xl }} />
                ) : sessions.data && sessions.data.length > 0 ? (
                  sessions.data.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      now={now}
                      selected={selectedSession?.id === s.id}
                      enrolled={enrollment?.sessionId === s.id}
                      onSelect={
                        enrollment
                          ? undefined
                          : (sess) =>
                              setSelectedSession(selectedSession?.id === sess.id ? null : sess)
                      }
                      actionLabel={t('courses.selectSession')}
                    />
                  ))
                ) : (
                  <EmptyState icon="calendar" title={t('courses.noSessions')} compact />
                )}
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">{t('courses.certificate.title')}</Text>
              {myCertificate ? (
                <Tappable
                  onPress={() =>
                    router.push({
                      pathname: '/courses/certificate/[id]',
                      params: { id: myCertificate.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('courses.certificate.yours')}
                >
                  <CertificateCard certificate={myCertificate} course={data} now={now} />
                </Tappable>
              ) : (
                <View style={[styles.certInfo, { backgroundColor: colors.surfaceMuted }]}>
                  <Icon
                    name="award"
                    size={22}
                    color={data.certificateName ? colors.accent : colors.textSubtle}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodySm">
                      {data.certificateName
                        ? t('courses.certificate.earn', { name: data.certificateName })
                        : t('courses.certificate.none')}
                    </Text>
                    {data.certificateName ? (
                      <Text variant="caption" color="textMuted">
                        {data.validityMonths
                          ? t('courses.certificate.validFor', { months: data.validityMonths })
                          : t('courses.certificate.lifetime')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionHeader
                title={t('courses.reviews')}
                subtitle={
                  reviews.data ? `${data.rating.toFixed(1)} · ${data.reviewCount}` : undefined
                }
                actionLabel={
                  enrollment && !alreadyReviewed && !showReviewForm
                    ? t('courses.writeReview')
                    : undefined
                }
                onAction={() => setShowReviewForm(true)}
              />
              {showReviewForm ? (
                <Card padded style={{ gap: spacing.sm }}>
                  <Text variant="caption" color="textMuted">
                    {t('courses.yourRating')}
                  </Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Tappable
                        key={n}
                        onPress={() => setReviewRating(n)}
                        haptic="selection"
                        accessibilityRole="button"
                        accessibilityLabel={`${n}`}
                        style={styles.star}
                      >
                        <Icon
                          name="star"
                          size={26}
                          color={colors.accent}
                          fill={n <= reviewRating ? colors.accent : 'none'}
                        />
                      </Tappable>
                    ))}
                  </View>
                  <Input
                    value={reviewText}
                    onChangeText={setReviewText}
                    placeholder={t('courses.reviewPlaceholder')}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.rowBetween}>
                    <Button
                      label={t('common.cancel')}
                      variant="ghost"
                      size="sm"
                      onPress={() => setShowReviewForm(false)}
                    />
                    <Button
                      label={t('common.send')}
                      icon="send"
                      size="sm"
                      loading={writeReview.isPending}
                      onPress={submitReview}
                    />
                  </View>
                </Card>
              ) : null}
              {reviews.isLoading ? (
                <Skeleton height={80} style={{ borderRadius: radius.lg }} />
              ) : reviews.data && reviews.data.length > 0 ? (
                reviews.data.map((r) => (
                  <View
                    key={r.id}
                    style={[
                      styles.review,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.reviewHead}>
                      <Avatar uri={r.author.avatarUrl} name={r.author.displayName} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySm" weight="semibold">
                          {r.author.displayName}
                        </Text>
                        <Text variant="caption" color="textSubtle">
                          {formatRelative(r.createdAt, new Date(now), locale)}
                        </Text>
                      </View>
                      <RatingStars rating={r.rating} size={12} />
                    </View>
                    <Text variant="bodySm" color="textMuted">
                      {r.text}
                    </Text>
                  </View>
                ))
              ) : (
                <Text variant="bodySm" color="textMuted">
                  {t('courses.noReviews')}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {data ? (
        <View
          style={[
            styles.bottom,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textMuted">
              {enrollment ? t('courses.enrolled') : t('courses.price')}
            </Text>
            <Text variant="h3" weight="extrabold">
              {enrollment
                ? `%${Math.round(enrollment.progress * 100)}`
                : formatPriceTry(data.priceTry + (selectedSession?.priceTry ?? 0), locale)}
            </Text>
            {!enrollment && data.priceTry > 0 ? (
              <Text variant="label" color="textSubtle">
                {t('courses.demoPayment')}
              </Text>
            ) : null}
          </View>
          <Button
            label={primaryLabel}
            icon={
              enrollment
                ? enrollment.status === 'completed'
                  ? 'award'
                  : 'circle-play'
                : 'graduation-cap'
            }
            loading={enroll.isPending}
            disabled={
              Boolean(enrollment) &&
              enrollment?.status !== 'completed' &&
              !next &&
              lessonList.length > 0
            }
            onPress={onPrimary}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: 'star' | 'clock' | 'users' | 'languages';
  value: string;
  label: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={14} color={color ?? colors.textSubtle} strokeWidth={2.4} />
      <Text variant="bodySm" weight="extrabold">
        {value}
      </Text>
      <Text variant="label" color="textSubtle" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topActions: { position: 'absolute', left: spacing.md, zIndex: 10 },
  cover: { width: '100%', height: 300, justifyContent: 'flex-end' },
  coverBody: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  instructor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  certInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  stars: { flexDirection: 'row', gap: spacing.xs },
  star: { padding: 4 },
  review: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
