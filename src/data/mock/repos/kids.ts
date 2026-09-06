import type { KidsRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('kids modülü henüz uygulanmadı');
};

/** kids modülü mock repository fabrikası. */
export function createKidsRepository(_ctx: MockContext): KidsRepository {
  return new Proxy({} as KidsRepository, { get: () => notReady });
}
