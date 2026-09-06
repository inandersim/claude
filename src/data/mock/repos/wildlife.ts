import type { WildlifeRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('wildlife modülü henüz uygulanmadı');
};

/** wildlife modülü mock repository fabrikası. */
export function createWildlifeRepository(_ctx: MockContext): WildlifeRepository {
  return new Proxy({} as WildlifeRepository, { get: () => notReady });
}
