import type { MapsRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('maps modülü henüz uygulanmadı');
};

/** maps modülü mock repository fabrikası. */
export function createMapsRepository(_ctx: MockContext): MapsRepository {
  return new Proxy({} as MapsRepository, { get: () => notReady });
}
