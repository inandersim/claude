import type { ClimbingRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('climbing modülü henüz uygulanmadı');
};

/** climbing modülü mock repository fabrikası. */
export function createClimbingRepository(_ctx: MockContext): ClimbingRepository {
  return new Proxy({} as ClimbingRepository, { get: () => notReady });
}
