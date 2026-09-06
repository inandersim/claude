import type { DestinationRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('destinations modülü henüz uygulanmadı');
};

/** destinations modülü mock repository fabrikası. */
export function createDestinationRepository(_ctx: MockContext): DestinationRepository {
  return new Proxy({} as DestinationRepository, { get: () => notReady });
}
