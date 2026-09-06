import type { HeritageRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('heritage modülü henüz uygulanmadı');
};

/** heritage modülü mock repository fabrikası. */
export function createHeritageRepository(_ctx: MockContext): HeritageRepository {
  return new Proxy({} as HeritageRepository, { get: () => notReady });
}
