import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import { recommendCourses, type Course, type CourseFilter, type ID, type Lesson } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useCourses(filter: CourseFilter = {}) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.courses.list(me.id, filter),
    queryFn: () => getDataProvider().courses.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useCourse(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.courses.detail(me.id, id),
    queryFn: () => getDataProvider().courses.getById(me.id, id),
    enabled: Boolean(id),
  });
}

export function useLessons(courseId: ID) {
  return useQuery({
    queryKey: queryKeys.courses.lessons(courseId),
    queryFn: () => getDataProvider().courses.lessons(courseId),
    enabled: Boolean(courseId),
  });
}

export function useSessions(courseId: ID) {
  return useQuery({
    queryKey: queryKeys.courses.sessions(courseId),
    queryFn: () => getDataProvider().courses.sessions(courseId),
    enabled: Boolean(courseId),
  });
}

export function useEnroll() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, sessionId }: { courseId: ID; sessionId?: ID | null }) =>
      getDataProvider().courses.enroll(me.id, courseId, sessionId ?? null),
    onSuccess: (_e, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.courses.all });
      qc.invalidateQueries({ queryKey: queryKeys.courses.sessions(vars.courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useCompleteLesson() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      lessonId,
      quizScore,
    }: {
      courseId: ID;
      lessonId: ID;
      quizScore?: number | null;
    }) => getDataProvider().courses.completeLesson(me.id, courseId, lessonId, quizScore ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.courses.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMyCourses() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.courses.mine(me.id),
    queryFn: () => getDataProvider().courses.myCourses(me.id),
  });
}

export function useCertificates() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.courses.certificates(me.id),
    queryFn: () => getDataProvider().courses.certificates(me.id),
  });
}

export function useCourseReviews(courseId: ID) {
  return useQuery({
    queryKey: queryKeys.courses.reviews(courseId),
    queryFn: () => getDataProvider().courses.reviews(courseId),
    enabled: Boolean(courseId),
  });
}

export function useWriteCourseReview() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, rating, text }: { courseId: ID; rating: number; text: string }) =>
      getDataProvider().courses.review(me.id, courseId, rating, text),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.courses.reviews(vars.courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses.detail(me.id, vars.courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses.all });
    },
  });
}

export type CreateCourseInput = Omit<
  Course,
  'id' | 'slug' | 'rating' | 'reviewCount' | 'enrolledCount' | 'createdAt' | 'lessonCount'
>;
export type CreateLessonInput = Omit<Lesson, 'id' | 'courseId'>;

export function useCreateCourse() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, lessons }: { input: CreateCourseInput; lessons: CreateLessonInput[] }) =>
      getDataProvider().courses.createCourse(me.id, input, lessons),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.courses.all }),
  });
}

/** Katalog + kayıtlarım üzerinden kişiye özel öneri şeridi. */
export function useRecommendedCourses(limit = 6) {
  const me = useCurrentUser();
  const all = useCourses({});
  const mine = useMyCourses();
  const data = useMemo(() => {
    if (!all.data) return undefined;
    const enrollments = (mine.data ?? [])
      .map((c) => c.enrollment)
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    return recommendCourses(
      all.data,
      { favoriteTypes: me.favoriteTypes, plan: me.plan, enrollments },
      limit,
    );
  }, [all.data, mine.data, me.favoriteTypes, me.plan, limit]);
  return { data, isLoading: all.isLoading || mine.isLoading, isError: all.isError };
}
