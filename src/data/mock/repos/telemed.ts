import type { TelemedRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('telemed modülü henüz uygulanmadı');
};

/** telemed modülü mock repository fabrikası. */
export function createTelemedRepository(_ctx: MockContext): TelemedRepository {
  return new Proxy({} as TelemedRepository, { get: () => notReady });
}
