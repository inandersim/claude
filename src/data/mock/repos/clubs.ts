import type { ClubRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('clubs modülü henüz uygulanmadı');
};

/** clubs modülü mock repository fabrikası. */
export function createClubRepository(_ctx: MockContext): ClubRepository {
  return new Proxy({} as ClubRepository, { get: () => notReady });
}
