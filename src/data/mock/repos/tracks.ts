import type { TrackRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('tracks modülü henüz uygulanmadı');
};

/** tracks modülü mock repository fabrikası. */
export function createTrackRepository(_ctx: MockContext): TrackRepository {
  return new Proxy({} as TrackRepository, { get: () => notReady });
}
