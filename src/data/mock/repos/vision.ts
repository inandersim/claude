import type { VisionRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('vision modülü henüz uygulanmadı');
};

/** vision modülü mock repository fabrikası. */
export function createVisionRepository(_ctx: MockContext): VisionRepository {
  return new Proxy({} as VisionRepository, { get: () => notReady });
}
