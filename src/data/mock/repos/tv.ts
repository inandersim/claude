import type { TvRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('tv modülü henüz uygulanmadı');
};

/** tv modülü mock repository fabrikası. */
export function createTvRepository(_ctx: MockContext): TvRepository {
  return new Proxy({} as TvRepository, { get: () => notReady });
}
