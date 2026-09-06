import type { CourseRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('courses modülü henüz uygulanmadı');
};

/** courses modülü mock repository fabrikası. */
export function createCourseRepository(_ctx: MockContext): CourseRepository {
  return new Proxy({} as CourseRepository, { get: () => notReady });
}
