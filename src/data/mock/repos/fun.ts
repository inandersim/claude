import type { FunRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('fun modülü henüz uygulanmadı');
};

/** fun modülü mock repository fabrikası. */
export function createFunRepository(_ctx: MockContext): FunRepository {
  return new Proxy({} as FunRepository, { get: () => notReady });
}
