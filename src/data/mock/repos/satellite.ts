import type { SatelliteRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('satellite modülü henüz uygulanmadı');
};

/** satellite modülü mock repository fabrikası. */
export function createSatelliteRepository(_ctx: MockContext): SatelliteRepository {
  return new Proxy({} as SatelliteRepository, { get: () => notReady });
}
