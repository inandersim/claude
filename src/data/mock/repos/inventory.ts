import type { InventoryRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('inventory modülü henüz uygulanmadı');
};

/** inventory modülü mock repository fabrikası. */
export function createInventoryRepository(_ctx: MockContext): InventoryRepository {
  return new Proxy({} as InventoryRepository, { get: () => notReady });
}
