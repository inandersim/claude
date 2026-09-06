import type { GroupRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('groups modülü henüz uygulanmadı');
};

/** groups modülü mock repository fabrikası. */
export function createGroupRepository(_ctx: MockContext): GroupRepository {
  return new Proxy({} as GroupRepository, { get: () => notReady });
}
